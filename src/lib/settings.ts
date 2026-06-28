// src/lib/settings.ts
import { eq } from "drizzle-orm";
import { db, schema } from "./db";
import { unstable_cache as nextCache } from "next/cache";

async function _getSetting(key: string): Promise<string | null> {
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
  return row?.value ?? null;
}

export const getSetting = nextCache(_getSetting, ["settings"], { revalidate: 30 });

export async function getLogoUrl(): Promise<string | null> {
  const v = await getSetting("logo_url");
  return v && v.length > 0 ? v : null;
}

export async function getScanEnabled(): Promise<boolean> {
  const v = await getSetting("scan_enabled");
  return v !== "false";
}

export async function getGstSettings() {
  const [number, percentage] = await Promise.all([
    getSetting("gst_number"),
    getSetting("gst_percentage"),
  ]);
  return { number: number ?? "", percentage: percentage ? Number(percentage) : 0 };
}

export async function getSmtpSettings() {
  const [host, port, user, pass, from] = await Promise.all([
    getSetting("smtp_host"),
    getSetting("smtp_port"),
    getSetting("smtp_user"),
    getSetting("smtp_pass"),
    getSetting("smtp_from"),
  ]);
  return { host: host ?? "", port: port ?? "", user: user ?? "", pass: pass ?? "", from: from ?? "" };
}
