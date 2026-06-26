// src/server/category-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { generateBarcode } from "@/lib/barcode";

// ── Master Category CRUD ──
export async function createCategory(input: { name: string; description?: string }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (input.name.trim().length < 2) throw new Error("Category name must be at least 2 characters.");
  await db.insert(schema.categories).values({ name: input.name.trim(), description: input.description?.trim() || null });
  revalidatePath("/categories");
}

export async function updateCategory(id: number, input: { name?: string; description?: string }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  await db.update(schema.categories).set({ name: input.name?.trim(), description: input.description?.trim() }).where(eq(schema.categories.id, id));
  revalidatePath("/categories");
}

export async function deleteCategory(id: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const [directItems, itemsInSubs] = await Promise.all([
    db.select({ id: schema.items.id }).from(schema.items).where(eq(schema.items.categoryId, id)).limit(1),
    db.select({ id: schema.items.id }).from(schema.items).innerJoin(schema.subcategories, eq(schema.items.subcategoryId, schema.subcategories.id)).where(eq(schema.subcategories.categoryId, id)).limit(1),
  ]);
  if (directItems.length > 0 || itemsInSubs.length > 0) {
    throw new Error("Cannot delete a category that has items in its sub-categories.");
  }
  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  revalidatePath("/categories");
}

// ── Sub Category CRUD ──
export async function createSubcategory(input: { name: string; categoryId: number; description?: string }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (input.name.trim().length < 2) throw new Error("Sub-category name must be at least 2 characters.");
  await db.insert(schema.subcategories).values({
    name: input.name.trim(),
    categoryId: input.categoryId,
    description: input.description?.trim() || null,
  });
  revalidatePath("/categories");
}

export async function updateSubcategory(id: number, input: { name?: string; description?: string }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  await db.update(schema.subcategories).set({ name: input.name?.trim(), description: input.description?.trim() }).where(eq(schema.subcategories.id, id));
  revalidatePath("/categories");
}

export async function deleteSubcategory(id: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const inUse = await db.select({ id: schema.items.id }).from(schema.items).where(eq(schema.items.subcategoryId, id)).limit(1);
  if (inUse.length > 0) throw new Error("Cannot delete sub-category with items in it.");
  await db.delete(schema.subcategories).where(eq(schema.subcategories.id, id));
  revalidatePath("/categories");
}

// ── Item (under sub-category) ──
export async function createCategoryItem(input: { name: string; subcategoryId: number; description?: string; quantity: number }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (!input.subcategoryId) throw new Error("Items must be created under a sub-category.");
  const name = input.name.trim().toUpperCase();
  await db.insert(schema.items).values({
    name,
    subcategoryId: input.subcategoryId,
    description: input.description?.trim() || null,
    quantity: Number(input.quantity) || 0,
    barcode: generateBarcode(),
    status: "available",
  });
  revalidatePath("/categories");
  revalidatePath("/inventory");
}
