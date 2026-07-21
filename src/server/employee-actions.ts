// src/server/employee-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { eq, isNull, and, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { dispatchNotification } from "./notification-dispatcher";

/** Only allow mutating employee-role users (never other admins). */
async function getTargetEmployee(userId: number) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      active: schema.users.active,
    })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, userId),
        eq(schema.users.role, "employee"),
        isNull(schema.users.deletedAt)
      )
    )
    .limit(1)
    .then((r) => r[0]);
}

export async function createEmployee(input: { name: string; email: string; phone?: string; password: string }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (input.name.trim().length < 2) throw new Error("Name must be at least 2 characters.");
  const email = input.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");
  const exists = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
    .limit(1);
  if (exists.length) throw new Error("Email already in use.");
  const result = await db
    .insert(schema.users)
    .values({
      name: input.name.trim(),
      email,
      phone: input.phone || null,
      password: await hashPassword(input.password),
      role: "employee",
      mustChangePwd: true,
    })
    .then(() =>
      db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1).then((r) => r[0])
    );
  try {
    const { sendWelcomeEmail } = await import("@/lib/email");
    await sendWelcomeEmail({ to: email, name: input.name.trim() });
    await dispatchNotification({
      userId: result.id,
      type: "account_created",
      title: "Welcome to Kadam Production",
      message: `Your account has been created. Check your email for login details.`,
      link: "/my-tasks",
    });
  } catch (err) {
    console.error("[employee-actions] Failed to send welcome notification:", err);
  }
  revalidatePath("/employees");
}

export async function resetPassword(userId: number, newPassword: string) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const emp = await getTargetEmployee(userId);
  if (!emp) throw new Error("Employee not found.");
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  await db
    .update(schema.users)
    .set({ password: await hashPassword(newPassword), mustChangePwd: true })
    .where(eq(schema.users.id, userId));
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  try {
    const { sendPasswordResetEmail } = await import("@/lib/email");
    await sendPasswordResetEmail({ to: emp.email, name: emp.name });
  } catch (err) {
    console.error("[employee-actions] Failed to send password reset email:", err);
  }
  revalidatePath("/employees");
}

export async function updateEmployee(input: { id: number; name: string; email?: string; phone?: string }) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  const emp = await getTargetEmployee(input.id);
  if (!emp) throw new Error("Employee not found.");
  // Employee email cannot be changed here — use the email-change request/approve/verify flow.
  if (input.email && input.email.toLowerCase().trim() !== emp.email.toLowerCase()) {
    throw new Error(
      "Employee email cannot be changed directly. The employee must request a change; approve it under Email Requests."
    );
  }
  await db
    .update(schema.users)
    .set({ name: input.name.trim(), phone: input.phone || null })
    .where(eq(schema.users.id, input.id));
  revalidatePath("/employees");
}

export async function deleteEmployee(userId: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (user.id === userId) throw new Error("You cannot delete or deactivate your own account.");
  const emp = await getTargetEmployee(userId);
  if (!emp) throw new Error("Employee not found.");
  await db
    .update(schema.users)
    .set({
      deletedAt: new Date(),
      email: sql`"deleted_" || ${schema.users.id} || "_" || ${schema.users.email}`,
    })
    .where(eq(schema.users.id, userId));
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  revalidatePath("/employees");
}

export async function toggleEmployeeActive(userId: number) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (user.id === userId) throw new Error("You cannot delete or deactivate your own account.");
  const emp = await getTargetEmployee(userId);
  if (!emp) throw new Error("Employee not found.");
  const nextActive = !emp.active;
  await db.update(schema.users).set({ active: nextActive }).where(eq(schema.users.id, userId));
  // Revoke sessions when deactivating so access ends immediately.
  if (!nextActive) {
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  }
  revalidatePath("/employees");
}

export async function listEmployees() {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      phone: schema.users.phone,
      active: schema.users.active,
    })
    .from(schema.users)
    .where(and(eq(schema.users.role, "employee"), isNull(schema.users.deletedAt)));
}
