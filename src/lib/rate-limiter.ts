// src/lib/rate-limiter.ts
// Atomic rate limiting using Drizzle transactions — avoids raw SQL compatibility issues.
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

type WindowConfig = { max: number; windowMs: number };

const DEFAULTS: Record<string, WindowConfig> = {
  login: { max: 5, windowMs: 5 * 60 * 1000 },
  forgot_otp: { max: 3, windowMs: 10 * 60 * 1000 },
  otp_verify: { max: 5, windowMs: 15 * 60 * 1000 },
  general: { max: 100, windowMs: 60 * 1000 },
};

/**
 * Atomic rate-limit check + increment using a database transaction.
 * The read-check-write is wrapped in a transaction to close the race window.
 */
async function atomicCheckAndIncrement(
  rlKey: string,
  max: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, rlKey))
      .get();

    if (!existing) {
      await tx.insert(schema.settings).values({
        key: rlKey,
        value: JSON.stringify({ count: 1, start: now }),
      });
      return { allowed: true };
    }

    const data = JSON.parse(existing.value);

    // Window expired — reset the counter
    if (now - data.start > windowMs) {
      await tx
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
    await tx
      .update(schema.settings)
      .set({
        value: JSON.stringify({ count: data.count + 1, start: data.start }),
      })
      .where(eq(schema.settings.key, rlKey));
    return { allowed: true };
  }) as Promise<{ allowed: boolean; retryAfter?: number }>;
}

export async function checkRateLimit(
  key: string,
  config?: WindowConfig,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const cfg = config ?? DEFAULTS.general;
  const rlKey = `rl:${key}`;
  try {
    return await atomicCheckAndIncrement(rlKey, cfg.max, cfg.windowMs);
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
