// src/server/scan-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function scanItem(barcode: string, action: "checkout" | "checkin" | "damaged", orderId?: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const code = barcode.trim();
  if (!code) throw new Error("Enter a barcode.");
  const item = await db.select().from(schema.items).where(and(eq(schema.items.barcode, code), isNull(schema.items.deletedAt))).limit(1).then((r) => r[0]);
  if (!item) throw new Error("Item not found for this barcode.");

  if (action !== "checkout" && action !== "checkin" && action !== "damaged") {
    throw new Error("Invalid scan action.");
  }

  if (action === "checkout") {
    if (!orderId) throw new Error("Select an ongoing event.");
    const order = await db.select().from(schema.orders).where(and(eq(schema.orders.id, orderId), isNull(schema.orders.deletedAt))).limit(1).then((r) => r[0]);
    if (!order) throw new Error("Order not found.");
    // FIX: validate the order is actually "ongoing" — don't allow checkout to upcoming/completed/cancelled orders.
    if (order.status !== "ongoing") throw new Error(`Cannot check out to a "${order.status}" order. Only ongoing events are eligible.`);
    if (item.status === "busy" && item.currentOrderId) throw new Error("This item is already checked out to another order. Check it in first.");
    await db.update(schema.items).set({ status: "busy", currentOrderId: orderId }).where(eq(schema.items.id, item.id));
    await db.insert(schema.orderItems).values({ orderId, itemId: item.id, quantity: 1, scannedOutAt: new Date() });
    return { ok: true, msg: `${item.name} → checked out to ${order.clientName}.` };
  } else if (action === "checkin") {
    await db.update(schema.items).set({ status: "available", currentOrderId: null }).where(eq(schema.items.id, item.id));
    if (item.currentOrderId) {
      const existing = await db.select().from(schema.orderItems)
        .where(and(eq(schema.orderItems.itemId, item.id), eq(schema.orderItems.orderId, item.currentOrderId)))
        .limit(1).then((r) => r[0]);
      if (existing) await db.update(schema.orderItems).set({ scannedInAt: new Date() }).where(eq(schema.orderItems.id, existing.id));
    }
    return { ok: true, msg: `${item.name} → returned to stock.` };
  } else if (action === "damaged") {
    await db.update(schema.items).set({ status: "damaged", currentOrderId: null }).where(eq(schema.items.id, item.id));
    return { ok: true, msg: `${item.name} → marked damaged.` };
  }

  throw new Error("Invalid scan action.");
}
