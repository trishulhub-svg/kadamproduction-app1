// src/server/auth-actions.ts
"use server";
import { redirect } from "next/navigation";
import { login, logout, getCurrentUser, changePassword } from "@/lib/auth";

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function loginAction(_prev: { error?: string } | null, formData: FormData) {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const res = await login(email, password);
  if (!res.ok) return { error: res.error };
  return { ok: true, mustChangePwd: res.mustChangePwd ?? false };
}

export async function changePasswordAction(_prev: { ok: boolean; error?: string } | null, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Session expired. Please log in again." };
  const current = String(formData.get("current") || "");
  const next = String(formData.get("new") || "");
  const confirmPw = String(formData.get("confirm") || "");
  if (next.length < 6) return { ok: false, error: "New password must be at least 6 characters." };
  if (next !== confirmPw) return { ok: false, error: "Passwords do not match." };
  const res = await changePassword(user.id, current, next);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}
