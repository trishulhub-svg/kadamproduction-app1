// src/lib/queries.ts — data fetchers (Turso reads)
import { count, eq, and, isNull, inArray, sql, ne } from "drizzle-orm";
import { db, schema } from "./db";
import type { ItemStatus, OrderStatus } from "@/drizzle/schema";

/** Committed quantity of an item across active orders (optionally on a given event date). */
export async function committedQty(itemId: number, onDate?: string): Promise<number> {
  const activeStatuses: OrderStatus[] = ["upcoming", "ongoing"];
  const conditions = [
    eq(schema.orderItems.itemId, itemId),
    inArray(schema.orders.status, activeStatuses),
  ];
  if (onDate) conditions.push(eq(schema.orders.eventDate, onDate));

  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${schema.orderItems.quantity}),0)` })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(and(...conditions));

  return Number(rows[0]?.total ?? 0);
}

export type ItemRow = {
  id: number;
  name: string;
  barcode: string;
  categoryId: number | null;
  categoryName: string | null;
  subcategoryId: number | null;
  subcategoryName: string | null;
  description: string | null;
  quantity: number;
  status: ItemStatus;
  committed: number; // across active orders (all dates)
  available: number;
};

/** Inventory list with computed availability. `onDate` enables improvement #1. */
export async function listItems(opts?: { categoryId?: number; subcategoryId?: number; search?: string; onDate?: string }): Promise<ItemRow[]> {
  const conds = [isNull(schema.items.deletedAt)];
  if (opts?.categoryId) conds.push(eq(schema.items.categoryId, opts.categoryId));
  if (opts?.subcategoryId) conds.push(eq(schema.items.subcategoryId, opts.subcategoryId));
  if (opts?.search) conds.push(sql`upper(${schema.items.name}) like ${"%" + opts.search.toUpperCase() + "%"}`);

  const rows = await db
    .select({
      id: schema.items.id,
      name: schema.items.name,
      barcode: schema.items.barcode,
      categoryId: schema.items.categoryId,
      categoryName: schema.categories.name,
      subcategoryId: schema.items.subcategoryId,
      subcategoryName: schema.subcategories.name,
      description: schema.items.description,
      quantity: schema.items.quantity,
      status: schema.items.status,
    })
    .from(schema.items)
    .leftJoin(schema.categories, eq(schema.items.categoryId, schema.categories.id))
    .leftJoin(schema.subcategories, eq(schema.items.subcategoryId, schema.subcategories.id))
    .where(and(...conds));

  const out: ItemRow[] = [];
  for (const r of rows) {
    const committed = await committedQty(r.id, opts?.onDate);
    out.push({ ...r, committed, available: Math.max(0, r.quantity - committed) });
  }
  return out;
}

export async function getDashboardStats() {
  const [totalItems] = await db.select({ v: count() }).from(schema.items).where(isNull(schema.items.deletedAt));
  const [available] = await db
    .select({ v: count() })
    .from(schema.items)
    .where(and(isNull(schema.items.deletedAt), eq(schema.items.status, "available")));
  const [busy] = await db
    .select({ v: count() })
    .from(schema.items)
    .where(and(isNull(schema.items.deletedAt), eq(schema.items.status, "busy")));
  const [damaged] = await db
    .select({ v: count() })
    .from(schema.items)
    .where(and(isNull(schema.items.deletedAt), eq(schema.items.status, "damaged")));
  const [ongoingOrders] = await db
    .select({ v: count() })
    .from(schema.orders)
    .where(and(isNull(schema.orders.deletedAt), eq(schema.orders.status, "ongoing")));
  const [upcomingOrders] = await db
    .select({ v: count() })
    .from(schema.orders)
    .where(and(isNull(schema.orders.deletedAt), eq(schema.orders.status, "upcoming")));
  const [employees] = await db
    .select({ v: count() })
    .from(schema.users)
    .where(and(isNull(schema.users.deletedAt), eq(schema.users.role, "employee")));
  const [categories] = await db.select({ v: count() }).from(schema.categories);

  return {
    totalItems: totalItems?.v ?? 0,
    available: available?.v ?? 0,
    busy: busy?.v ?? 0,
    damaged: damaged?.v ?? 0,
    ongoingOrders: ongoingOrders?.v ?? 0,
    upcomingOrders: upcomingOrders?.v ?? 0,
    employees: employees?.v ?? 0,
    categories: categories?.v ?? 0,
  };
}

export async function countAssignedOrders(userId: number) {
  const [r] = await db
    .select({ v: count() })
    .from(schema.orderAssignments)
    .innerJoin(schema.orders, eq(schema.orderAssignments.orderId, schema.orders.id))
    .where(and(eq(schema.orderAssignments.userId, userId), ne(schema.orders.status, "cancelled")));
  return r?.v ?? 0;
}
