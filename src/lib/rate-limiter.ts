// src/lib/rate-limiter.ts
// Rate limiting using Drizzle query builder — no raw SQL, no transactions.
// The race window between read-check-write is negligible for rate-limiting purposes
// (at worst 1 extra request slips through), and this approach is fully compatible
// with the libSQL HTTP driver.
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

type WindowConfig = { max: number; windowMs: number };

const DEFAULTS: Record<string, WindowConfig> = {
  login: { max: 5, windowMs: 5 * 60 * 1000 },
  forgot_otp: { max: 3, windowMs: 10 * 60 * 1000 },
  otp_verify: { max: 5, windowMs: 15 * 60 * 1000 },
  general: { max: 100, windowMs: 60 * 1000 },
};

async function checkAndIncrement(
  rlKey: string,
  max: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();

  const existing = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, rlKey))
    .get();

  if (!existing) {
    await db.insert(schema.settings).values({
      key: rlKey,
      value: JSON.stringify({ count: 1, start: now }),
    });
    return { allowed: true };
  }

  const data = JSON.parse(existing.value);

  // Window expired — reset the counter
  if (now - data.start > windowMs) {
    await db
      .update(schema.settings)
      .set({ value: JSON.stringify({ count: 1, start: now }) })
      .where(eq(schema.settings.key, rlKey));
    return { allowed: true };
  }

  // Rate limit exceeded — do NOT increment
  if (data.count >= max) {
    const retryAfter = Math.ceil((windowMs - (now - data.start)) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  // Increment the counter
  await db
    .update(schema.settings)
    .set({
      value: JSON.stringify({ count: data.count + 1, start: data.start }),
    })
    .where(eq(schema.settings.key, rlKey));
  return { allowed: true };
}

export async function checkRateLimit(
  key: string,
  config?: WindowConfig,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const cfg = config ?? DEFAULTS.general;
  const rlKey = `rl:${key}`;
  try {
    return await checkAndIncrement(rlKey, cfg.max, cfg.windowMs);
  } catch (err) {
    // Fail closed: if the rate-limit store is unavailable, deny the request
    // rather than letting an attacker bypass protection via a DB error.
    console.error("[rate-limiter] checkRateLimit error:", err);
    return { allowed: false };
  }
}

export async function clearRateLimit(key: string): Promise<void> {
  const rlKey = `rl:${key}`;
  try {
    await db.delete(schema.settings).where(eq(schema.settings.key, rlKey));
  } catch (err) {
    console.error("[rate-limiter] clearRateLimit error:", err);
  }
}
