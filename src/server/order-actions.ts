// src/server/order-actions.ts
"use server";
import { createClient } from "@libsql/client";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { createNotification } from "./notification-actions";
import { EVENT_CATEGORIES } from "@/drizzle/schema";
import type { OrderStatus } from "@/drizzle/schema";

export async function createOrder(input: {
  clientName: string;
  contactPerson: string;
  contactPhone?: string;
  contactEmail?: string;
  transportContactName?: string;
  transportContactPhone?: string;
  eventDate?: string;
  eventTime?: string;
  setupDate?: string;
  setupTime?: string;
  address?: string;
  billingAddress?: string;
  totalBudget?: number;
  advancePayment?: number;
  eventCategory?: string;
}) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");

  const budget = Number(input.totalBudget || 0);
  const advance = Number(input.advancePayment || 0);

  const [order] = await db
    .insert(schema.orders)
    .values({
      clientName: input.clientName.trim(),
      contactPerson: input.contactPerson.trim() || null,
      contactPhone: input.contactPhone || null,
      contactEmail: input.contactEmail || null,
      transportContactName: input.transportContactName || null,
      transportContactPhone: input.transportContactPhone || null,
      eventDate: input.eventDate || null,
      eventTime: input.eventTime || null,
      setupDate: input.setupDate || null,
      setupTime: input.setupTime || null,
      address: input.address || null,
      billingAddress: input.billingAddress || null,
      totalBudget: budget,
      status: "upcoming",
      eventCategory: (EVENT_CATEGORIES as readonly string[]).includes(input.eventCategory || "") ? (input.eventCategory as typeof EVENT_CATEGORIES[number]) : "Other",
    })
    .returning({ id: schema.orders.id });

  // Advance stored as a finance income row (preserves PHP behavior)
  if (advance > 0 && order) {
    await db.insert(schema.finance).values({
      orderId: order.id,
      type: "income",
      category: "Advance Payment",
      amount: advance,
      date: input.eventDate || new Date().toISOString().slice(0, 10),
      description: "Advance at order creation",
    });
  }

  revalidatePath("/orders");
  return order?.id;
}

export async function updateOrder(id: number, input: Record<string, unknown>) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const patch: Record<string, unknown> = {};
  for (const k of ["clientName", "contactPerson", "contactPhone", "contactEmail", "transportContactName", "transportContactPhone", "eventDate", "eventTime", "setupDate", "setupTime", "address", "billingAddress"]) {
    if (input[k] !== undefined) patch[k] = input[k] || null;
  }
  if (input.totalBudget !== undefined) patch.totalBudget = Number(input.totalBudget || 0);
  if (input.eventCategory !== undefined && (EVENT_CATEGORIES as readonly string[]).includes(String(input.eventCategory))) patch.eventCategory = input.eventCategory;
  await db.update(schema.orders).set(patch).where(eq(schema.orders.id, id));
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

/**
 * Improvement #8b — completing an order asks how inventory returns:
 *  - "automatic": items auto-return to warehouse via scanner (set status=available)
 *  - "manual":    admin returns inventory manually (leave item states as-is)
 */
export async function updateOrderStatus(id: number, status: string, completeMode?: "automatic" | "manual") {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");

  await db.update(schema.orders).set({ status: status as OrderStatus }).where(eq(schema.orders.id, id));

  if (status === "completed" && completeMode === "automatic") {
    const linked = await db
      .select({ itemId: schema.orderItems.itemId })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, id));
    if (linked.length) {
      await db
        .update(schema.items)
        .set({ status: "available", currentOrderId: null })
        .where(inArray(schema.items.id, linked.map((l) => l.itemId)));
    }
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
}

export async function deleteOrder(id: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const [o] = await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (o?.status === "ongoing") throw new Error("Cannot delete an ongoing order. Complete or cancel it first.");
  await db.update(schema.orders).set({ deletedAt: new Date() }).where(eq(schema.orders.id, id)); // soft delete
  revalidatePath("/orders");
}

export async function saveAssignments(orderId: number, employeeIds: number[]) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const [order] = await db
    .select({ clientName: schema.orders.clientName })
    .from(schema.orders)
    .where(eq(schema.orders.id, orderId))
    .limit(1)
    .then((r) => r);
  const existing = await db
    .select({ userId: schema.orderAssignments.userId })
    .from(schema.orderAssignments)
    .where(eq(schema.orderAssignments.orderId, orderId))
    .then((r) => r.map((x) => x.userId));
  await db.delete(schema.orderAssignments).where(eq(schema.orderAssignments.orderId, orderId));
  if (employeeIds.length) {
    await db.insert(schema.orderAssignments).values(employeeIds.map((userId) => ({ orderId, userId })));
    const newly = employeeIds.filter((eid) => !existing.includes(eid));
    for (const uid of newly) {
      await createNotification({
        userId: uid,
        orderId,
        type: "order_assigned",
        title: "New Order Assignment",
        message: `You have been assigned to "${order?.clientName || "Untitled"}" order.`,
        link: `/orders/${orderId}`,
      });
    }
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function reserveItems(orderId: number, items: { itemId: number; qty: number }[]) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  for (const { itemId, qty } of items) {
    if (qty <= 0) continue;
    const existing = await db
      .select()
      .from(schema.orderItems)
      .where(and(eq(schema.orderItems.orderId, orderId), eq(schema.orderItems.itemId, itemId)))
      .limit(1)
      .then((r) => r[0]);
    if (existing) {
      await db.update(schema.orderItems).set({ quantity: existing.quantity + qty }).where(eq(schema.orderItems.id, existing.id));
    } else {
      await db.insert(schema.orderItems).values({ orderId, itemId, quantity: qty, reservedAt: new Date() });
    }
  }
  revalidatePath(`/orders/${orderId}`);
}

export async function unreserveItem(orderId: number, itemId: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  await db.delete(schema.orderItems).where(and(eq(schema.orderItems.orderId, orderId), eq(schema.orderItems.itemId, itemId)));
  revalidatePath(`/orders/${orderId}`);
}

export async function markSetupDone(orderId: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  await client.execute({
    sql: "UPDATE orders SET setup_done = 1 WHERE id = ?",
    args: [orderId],
  });
  // Notify all admins
  const adminRows = await client.execute({
    sql: "SELECT id FROM users WHERE role = 'admin' AND deleted_at IS NULL",
    args: [],
  });
  const orderRow = await client.execute({
    sql: "SELECT client_name FROM orders WHERE id = ?",
    args: [orderId],
  });
  const clientName = (orderRow.rows[0] as any)?.client_name ?? "Untitled";
  for (const row of adminRows.rows) {
    await createNotification({
      userId: Number((row as any).id),
      orderId,
      type: "setup_done",
      title: "Setup Completed",
      message: `${user.name} marked setup as done for "${clientName}" order.`,
      link: `/orders/${orderId}`,
    });
  }
  revalidatePath("/my-tasks");
  revalidatePath(`/orders/${orderId}`);
}
