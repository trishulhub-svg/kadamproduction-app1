// src/server/settings-actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

async function upsertSetting(key: string, value: string) {
  const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
  if (existing) {
    await db.update(schema.settings).set({ value }).where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({ key, value });
  }
}

// Logo stored as a data URL so it works on Vercel's read-only filesystem.
const MAX_BYTES = 300_000;

export async function setLogo(dataUrl: string) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  if (!dataUrl.startsWith("data:image/")) throw new Error("Only image files are allowed.");
  if (dataUrl.length > MAX_BYTES) throw new Error("Logo too large. Please use an image under ~220KB.");
  await upsertSetting("logo_url", dataUrl);
  revalidatePath("/", "layout");
}

export async function removeLogo() {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  await db.delete(schema.settings).where(eq(schema.settings.key, "logo_url"));
  revalidatePath("/", "layout");
}

export async function setScanEnabled(enabled: boolean) {
  const user = await requireAdmin();
  if (!user) throw new Error("Unauthorized");
  await upsertSetting("scan_enabled", enabled ? "true" : "false");
  revalidatePath("/", "layout");
}
