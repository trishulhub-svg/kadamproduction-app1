// src/server/order-actions.ts
"use server";
import { createClient } from "@libsql/client";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
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
  gstEnabled?: boolean;
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
      gstEnabled: input.gstEnabled ?? false,
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
  try {
    const patch: Record<string, unknown> = {};
    for (const k of ["clientName", "contactPerson", "contactPhone", "contactEmail", "transportContactName", "transportContactPhone", "eventDate", "eventTime", "setupDate", "setupTime", "address", "billingAddress"]) {
      if (input[k] !== undefined) patch[k] = input[k] || null;
    }
    if (input.totalBudget !== undefined) patch.totalBudget = Number(input.totalBudget || 0);
    if (input.eventCategory !== undefined && (EVENT_CATEGORIES as readonly string[]).includes(String(input.eventCategory))) patch.eventCategory = input.eventCategory;
    await db.update(schema.orders).set(patch).where(eq(schema.orders.id, id));
    revalidatePath("/orders");
    revalidatePath(`/orders/${id}`);
  } catch (err) {
    console.error("updateOrder error:", err);
    throw new Error("Failed to update order. Please try again.");
  }
}

/** Check if an email is already used by another order. */
export async function checkEmailDuplicate(email: string, excludeOrderId?: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) return [];
  const conds = [eq(schema.orders.contactEmail, emailLower), isNull(schema.orders.deletedAt)];
  if (excludeOrderId) conds.push(sql`${schema.orders.id} <> ${excludeOrderId}`);
  const rows = await db
    .select({ id: schema.orders.id, clientName: schema.orders.clientName })
    .from(schema.orders)
    .where(and(...conds))
    .limit(5);
  return rows;
}

/** Send invoice email to the order's contact email. */
export async function sendInvoiceEmail(orderId: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const order = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1).then((r) => r[0]);
  if (!order) throw new Error("Order not found.");
  if (!order.contactEmail) throw new Error("Order has no contact email.");
  const { formatOrderNumber } = await import("@/lib/invoice-number");
  const { formatINR } = await import("@/lib/utils");
  const txns = await db.select().from(schema.finance).where(eq(schema.finance.orderId, orderId));
  const paid = txns.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const total = Number(order.totalBudget);
  const due = Math.max(0, total - paid);
  const orderNum = formatOrderNumber(order.id, order.createdAt);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://kadamproduction-opencode.vercel.app";
  const invoiceUrl = `${baseUrl}/orders/${orderId}/invoice`;
  const html = `
    <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
      <div style="text-align:center;padding:24px 0">
        <h2 style="margin:0;color:#1e40af">Kadam Production</h2>
        <p style="color:#6b7280;font-size:13px">Invoice — ${orderNum}</p>
      </div>
      <p>Hello <strong>${order.clientName}</strong>,</p>
      <p>Thank you for choosing Kadam Production. Here is your invoice summary:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Order</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${orderNum}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Total Amount</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${formatINR(total)}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Advance Paid</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${formatINR(paid)}</td></tr>
        <tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Balance Due</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${formatINR(due)}</td></tr>
      </table>
      <a href="${invoiceUrl}" style="display:inline-block;margin-top:12px;padding:10px 24px;background:#1e40af;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">View Full Invoice</a>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
      <p style="font-size:12px;color:#6b7280">Kadam Production — ${new Date().getFullYear()}</p>
    </div>
  `;
  const { sendEmail } = await import("@/lib/email");
  await sendEmail({ to: order.contactEmail, subject: `Invoice ${orderNum} — Kadam Production`, html });
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
