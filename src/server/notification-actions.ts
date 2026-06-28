"use server";
import { createClient } from "@libsql/client";
import { getCurrentUser } from "@/lib/auth";

function db() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
}

export type Notification = {
  id: number;
  userId: number;
  orderId: number | null;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  read: number;
  createdAt: number;
};

export async function fetchNotifications(limit = 10) {
  const user = await getCurrentUser();
  if (!user) return [];
  const client = db();
  const r = await client.execute({
    sql: "SELECT id, user_id AS userId, order_id AS orderId, type, title, message, link, read, created_at AS createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
    args: [user.id, limit],
  });
  return r.rows as unknown as Notification[];
}

export async function getUnreadCount() {
  const user = await getCurrentUser();
  if (!user) return 0;
  const client = db();
  const r = await client.execute({
    sql: "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND read = 0",
    args: [user.id],
  });
  const cntRow = r.rows[0] as unknown as { cnt: number } | undefined;
  return Number(cntRow?.cnt ?? 0);
}

export async function markNotificationRead(id: number) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const client = db();
  await client.execute({
    sql: "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?",
    args: [id, user.id],
  });
}

export async function markAllRead() {
  const user = await getCurrentUser();
  if (!user) return;
  const client = db();
  await client.execute({
    sql: "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0",
    args: [user.id],
  });
}

export async function createNotification(input: {
  userId: number;
  orderId?: number;
  type: string;
  title: string;
  message?: string;
  link?: string;
}) {
  const client = db();
  await client.execute({
    sql: "INSERT INTO notifications (user_id, order_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)",
    args: [input.userId, input.orderId ?? null, input.type, input.title, input.message ?? null, input.link ?? null],
  });
}
