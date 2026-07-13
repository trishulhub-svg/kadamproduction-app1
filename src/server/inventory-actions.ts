// src/server/inventory-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { generateBarcode } from "@/lib/barcode";
import { ITEM_STATUS } from "@/drizzle/schema";

export async function createItem(input: { name: string; categoryId?: number; subcategoryId?: number; description?: string; quantity: number }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (!input.subcategoryId) throw new Error("Items must be created under a sub-category.");
  const name = input.name.trim().toUpperCase();
  // L15: retry the insert on barcode collisions, regenerating the barcode each attempt.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.insert(schema.items).values({
        name,
        categoryId: input.categoryId || null,
        subcategoryId: input.subcategoryId,
        description: input.description?.trim() || null,
        quantity: Number(input.quantity) || 0,
        barcode: generateBarcode(),
        status: "available",
      });
      revalidatePath("/inventory");
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("[inventory] barcode collision after 3 attempts:", lastErr);
  throw new Error("Failed to generate a unique barcode. Please try again.");
}

export async function quickUpdateQty(itemId: number, newQuantity: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const q = Number(newQuantity);
  if (isNaN(q)) throw new Error("Quantity must be a valid number.");
  await db.update(schema.items).set({ quantity: Math.max(0, Math.floor(q)) }).where(eq(schema.items.id, itemId));
  revalidatePath("/inventory");
}

export async function updateItem(itemId: number, input: { name?: string; categoryId?: number | null; subcategoryId?: number | null; description?: string; quantity?: number; status?: string; newBarcode?: string }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim().toUpperCase();
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId == null ? null : input.categoryId;
  if (input.subcategoryId !== undefined) patch.subcategoryId = input.subcategoryId == null ? null : input.subcategoryId;
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.quantity !== undefined) patch.quantity = Math.max(0, Math.floor(input.quantity));
  if (input.status !== undefined) {
    // M2: validate against allowed enum
    if (!ITEM_STATUS.includes(input.status as typeof ITEM_STATUS[number])) throw new Error("Invalid status value.");
    patch.status = input.status;
  }
  if (input.newBarcode && input.newBarcode.trim()) {
    // M2: basic barcode format validation (alphanumeric, 4-30 chars)
    const bc = input.newBarcode.trim();
    if (!/^[A-Za-z0-9]{4,30}$/.test(bc)) throw new Error("Invalid barcode format.");
    patch.barcode = bc;
  }
  await db.update(schema.items).set(patch).where(eq(schema.items.id, itemId));
  revalidatePath("/inventory");
}

export async function deleteItem(itemId: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  // Enhancement: block if item has active order_items
  const active = await db
    .select({ id: schema.orderItems.id })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(and(eq(schema.orderItems.itemId, itemId), inArray(schema.orders.status, ["upcoming", "ongoing"])))
    .limit(1);
  if (active.length > 0) throw new Error("Cannot delete item with active reservations. Remove reservations first.");
  await db.update(schema.items).set({ deletedAt: new Date() }).where(eq(schema.items.id, itemId)); // soft delete
  revalidatePath("/inventory");
}
