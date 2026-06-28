// src/lib/auth.ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq, and, isNull, gte, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "./db";

const COOKIE = "kp_session";
const MAX_ADMIN_DEVICES = 2;

// H1: No weak fallback in production
function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required in production.");
    }
    return new TextEncoder().encode("dev-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "employee";
  sessionId?: string;
  mustChangePwd?: boolean;
};

async function sign(user: SessionUser): Promise<string> {
  const sessionId = crypto.randomUUID();
  // M1: persist session in DB for revocation
  try {
    // Phase 6: Admin 2-device limit — revoke oldest sessions beyond the limit
    if (user.role === "admin") {
      const activeSessions = await db
        .select({ id: schema.sessions.id })
        .from(schema.sessions)
        .where(and(
          eq(schema.sessions.userId, user.id),
          isNull(schema.sessions.revokedAt),
          gte(schema.sessions.expiresAt, new Date()),
        ))
        .orderBy(asc(schema.sessions.createdAt));

      const toRevokeCount = Math.max(0, activeSessions.length - MAX_ADMIN_DEVICES + 1);
      for (let i = 0; i < toRevokeCount; i++) {
        await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, activeSessions[i].id));
      }
    }

    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      refreshToken: sessionId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day
    });
  } catch {
    // sessions table might not exist yet — non-fatal
  }
  return new SignJWT({ ...user, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("1d") // L3: shortened from 7d
    .sign(getSecret());
}

async function verify(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const user = payload as unknown as SessionUser;
    // M1: verify session is still active (not revoked)
    if (user.sessionId) {
      try {
        const session = await db
          .select()
          .from(schema.sessions)
          .where(eq(schema.sessions.id, user.sessionId))
          .limit(1)
          .then((r) => r[0]);
        if (!session || session.revokedAt) return null;
      } catch {
        // sessions table might not exist — allow if DB unavailable
      }
    }
    return user;
  } catch {
    return null;
  }
}

/** Get current user from cookie (server components / route handlers). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  return verify(token);
}

/** Require an authenticated user, else redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("UNAUTHENTICATED");
  return u;
}

/** Require an admin; otherwise return null so pages can redirect. */
export async function requireAdmin(): Promise<SessionUser | null> {
  const u = await getCurrentUser();
  if (!u || u.role !== "admin") return null;
  return u;
}

// H2: Brute-force protection using settings table
async function checkRateLimit(email: string): Promise<{ allowed: boolean; error?: string }> {
  const key = `rl_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  try {
    const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
    if (row) {
      const data = JSON.parse(row.value);
      const now = Date.now();
      // Reset after 5 minutes
      if (now - data.firstAttempt > 5 * 60 * 1000) {
        return { allowed: true };
      }
      if (data.count >= 5) {
        const waitSec = Math.ceil((5 * 60 * 1000 - (now - data.firstAttempt)) / 1000);
        return { allowed: false, error: `Too many attempts. Try again in ${waitSec}s.` };
      }
    }
  } catch {
    // settings table might not exist — allow
  }
  return { allowed: true };
}

async function recordFailedAttempt(email: string): Promise<void> {
  const key = `rl_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  try {
    const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
    const now = Date.now();
    if (row) {
      const data = JSON.parse(row.value);
      if (now - data.firstAttempt > 5 * 60 * 1000) {
        // Window expired, reset
        await db.update(schema.settings).set({ value: JSON.stringify({ count: 1, firstAttempt: now }) }).where(eq(schema.settings.key, key));
      } else {
        await db.update(schema.settings).set({ value: JSON.stringify({ count: data.count + 1, firstAttempt: data.firstAttempt }) }).where(eq(schema.settings.key, key));
      }
    } else {
      await db.insert(schema.settings).values({ key, value: JSON.stringify({ count: 1, firstAttempt: now }) });
    }
  } catch {
    // non-fatal
  }
}

async function clearRateLimit(email: string): Promise<void> {
  const key = `rl_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  try {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
  } catch {
    // non-fatal
  }
}

export async function login(email: string, password: string): Promise<{ ok: true; mustChangePwd?: boolean } | { ok: false; error: string }> {
  // H2: Rate limit check
  const rl = await checkRateLimit(email);
  if (!rl.allowed) return { ok: false, error: rl.error! };

  const user = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.email, email.toLowerCase()), isNull(schema.users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);

  // No email enumeration — same generic error as PHP.
  if (!user) {
    await recordFailedAttempt(email);
    return { ok: false, error: "Invalid Credentials" };
  }

  // Deactivation check
  if (user.active === false) {
    await recordFailedAttempt(email);
    return { ok: false, error: "Your account has been deactivated. Contact your administrator." };
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    await recordFailedAttempt(email);
    return { ok: false, error: "Invalid Credentials" };
  }

  // H2: Clear rate limit on success
  await clearRateLimit(email);

  const store = await cookies();
  const token = await sign({ id: user.id, name: user.name, email: user.email, role: user.role });
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict", // M4: tightened from lax
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24, // L3: 1 day (was 7 days)
  });
  return { ok: true, mustChangePwd: Boolean(user.mustChangePwd) };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  // M1: Revoke session server-side
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const sid = payload.sessionId as string | undefined;
      if (sid) {
        await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, sid));
      }
    } catch {
      // invalid token — just delete cookie
    }
  }
  store.delete(COOKIE);
}

/** Hash a password (bcrypt) — used by seed + employee create. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12); // L3: bumped from 10 to 12
}

/** Verify current + set new password (Change Password page). */
export async function changePassword(
  userId: number,
  current: string,
  next: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1).then((r) => r[0]);
  if (!user) return { ok: false, error: "User not found" };
  if (!(await bcrypt.compare(current, user.password))) return { ok: false, error: "Current password is incorrect" };
  await db.update(schema.users).set({ password: await hashPassword(next), mustChangePwd: false }).where(eq(schema.users.id, userId));
  return { ok: true };
}
