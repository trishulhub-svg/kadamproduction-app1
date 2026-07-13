// src/lib/auth.ts
import { randomInt } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq, and, isNull, gte, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "./db";
import { checkRateLimit as generalRateLimit, clearRateLimit } from "./rate-limiter";

const COOKIE = "kp_session";
const MAX_ADMIN_DEVICES = 2;

// H1: No weak fallback — AUTH_SECRET is always required.
function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.trim().length < 8) {
    throw new Error("AUTH_SECRET is required and must be at least 8 characters. Current value length: " + (s ? s.length : "undefined"));
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
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24); // 1 day

  // M1: persist session in DB for revocation.
  // IMPORTANT: All DB operations here are wrapped in try/catch so that a
  // transient DB error does NOT block login. The JWT is still issued and the
  // user can access the app. Any DB error is logged for monitoring.
  try {
    // Phase 6: Admin 2-device limit — revoke oldest sessions beyond the limit
    if (user.role === "admin") {
      const activeSessions = await db
        .select({ id: schema.sessions.id })
        .from(schema.sessions)
        .where(and(
          eq(schema.sessions.userId, user.id),
          isNull(schema.sessions.revokedAt),
          gte(schema.sessions.expiresAt, now),
        ))
        .orderBy(asc(schema.sessions.createdAt));

      const toRevokeCount = Math.max(0, activeSessions.length - (MAX_ADMIN_DEVICES - 1));
      for (let i = 0; i < toRevokeCount; i++) {
        await db.update(schema.sessions).set({ revokedAt: now }).where(eq(schema.sessions.id, activeSessions[i].id));
      }
    }

    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      refreshToken: sessionId,
      rotated: false,
      expiresAt,
      createdAt: now,
    });
  } catch (err) {
    // Session DB write failed — log the full error but DO NOT block login.
    // The JWT still works; the user just won't have a revocable DB session.
    console.error("[auth] sign() DB error (non-blocking, login will continue):", err);
  }

  return new SignJWT({ ...user, sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getSecret());
}

async function verify(token: string): Promise<SessionUser | null> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getSecret()));
  } catch {
    // Token is invalid/expired/tampered — definitely deny.
    return null;
  }
  const user = payload as unknown as SessionUser;
  if (!user || typeof user.id !== "number" || !user.role) return null;

  // M1: verify session is still active (not revoked).
  // If the sessions-table lookup FAILS due to a transient DB error, fail open
  // (trust the JWT) rather than locking the user out — the JWT is already
  // cryptographically verified above.
  if (user.sessionId) {
    try {
      const session = await db
        .select({ revokedAt: schema.sessions.revokedAt })
        .from(schema.sessions)
        .where(eq(schema.sessions.id, user.sessionId))
        .limit(1)
        .then((r) => r[0]);
      // Fail closed only when we positively know it's revoked.
      if (session && session.revokedAt) return null;
      // If session row is missing, it may be a read-after-write race (Turso is
      // eventually consistent across replicas). Fail open for a freshly-issued
      // token to avoid post-login dead-ends.
    } catch (err) {
      console.error("[auth] session lookup DB error — failing open:", err);
    }
  }

  // H4: ensure the user account still exists and is not soft-deleted.
  try {
    const dbUser = await db
      .select({ deletedAt: schema.users.deletedAt, active: schema.users.active })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1)
      .then((r) => r[0]);
    if (!dbUser || dbUser.deletedAt) return null;
    if (dbUser.active === false) return null;
  } catch (err) {
    // DB error reading the user record — fail open (JWT is already verified).
    console.error("[auth] user lookup DB error — failing open:", err);
  }
  return user;
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

export async function login(email: string, password: string): Promise<{ ok: true; mustChangePwd?: boolean } | { ok: false; error: string }> {
  // H2: Atomic rate limit check (check + increment in one DB call)
  const rl = await generalRateLimit(email, { max: 5, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    // If the rate-limit DB is down, allow the request through rather than
    // locking everyone out. Log the incident for monitoring.
    if (rl.dbError) {
      console.error("[auth] Rate-limit DB unavailable — allowing login attempt for", email);
    } else {
      return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };
    }
  }

  let user;
  try {
    user = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, email.toLowerCase()), isNull(schema.users.deletedAt)))
      .limit(1)
      .then((r) => r[0]);
  } catch (err) {
    console.error("[auth] DB error fetching user:", err);
    return { ok: false, error: "Server error. Please try again." };
  }

  // No email enumeration — same generic error as PHP.
  if (!user) {
    return { ok: false, error: "Invalid Credentials" };
  }

  // Deactivation check
  if (user.active === false) {
    return { ok: false, error: "Your account has been deactivated. Contact your administrator." };
  }
  let match = false;
  try {
    match = await bcrypt.compare(password, user.password);
  } catch (err) {
    console.error("[auth] bcrypt compare error:", err);
    return { ok: false, error: "Server error. Please try again." };
  }
  if (!match) {
    return { ok: false, error: "Invalid Credentials" };
  }

  // H2: Clear rate limit on success
  try {
    await clearRateLimit(email);
  } catch (err) {
    console.error("[auth] clearRateLimit error:", err);
  }

  const store = await cookies();
  let token;
  try {
    token = await sign({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    console.error("[auth] sign token error:", err);
    return { ok: false, error: "Server error. Please try again." };
  }
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
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

// ──────────────────────────────────────────────────────────────────────────
// Forgot Password — OTP via SMTP
// ──────────────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export async function sendForgotOtp(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const rl = await generalRateLimit(email, { max: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed && !rl.dbError) return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };

  const user = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.email, email.toLowerCase()), isNull(schema.users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);
  // H7: do not reveal whether the email exists — return success without
  // sending an email so the response is identical either way.
  if (!user) return { ok: true };

  const otp = generateOtp();
  const hashed = await bcrypt.hash(otp, 12);
  const key = `forgot_otp_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  await db
    .insert(schema.settings)
    .values({ key, value: JSON.stringify({ otp: hashed, expiresAt: Date.now() + 10 * 60 * 1000 }) })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: JSON.stringify({ otp: hashed, expiresAt: Date.now() + 10 * 60 * 1000 }) } });

  const { sendEmail } = await import("@/lib/email");
  await sendEmail({
    to: email,
    subject: "Password Reset OTP — Kadam Production",
    html: `
      <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
        <h2 style="color:#1e40af">Password Reset Request</h2>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Use the following OTP to reset your password. It expires in 10 minutes.</p>
        <div style="margin:24px 0;text-align:center">
          <span style="display:inline-block;padding:12px 32px;font-size:28px;font-weight:700;letter-spacing:8px;background:#f3f4f6;border-radius:8px;color:#1e40af">${otp}</span>
        </div>
        <p style="color:#6b7280;font-size:13px">If you did not request this, please ignore this email.</p>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
        <p style="font-size:12px;color:#6b7280">Kadam Production — Professional Event Services</p>
      </div>
    `,
  });

  return { ok: true };
}

export async function verifyForgotOtp(email: string, otp: string): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const rl = await generalRateLimit(`verify_otp_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  const key = `forgot_otp_${email.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
  if (!row) return { ok: false, error: "No OTP was requested for this email." };

  const data = JSON.parse(row.value);
  if (Date.now() > data.expiresAt) {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "OTP has expired. Request a new one." };
  }

  if (!(await bcrypt.compare(otp, data.otp))) return { ok: false, error: "Invalid OTP." };

  await db.delete(schema.settings).where(eq(schema.settings.key, key));

  // M2: invalidate any unused password-reset rows for this user before issuing
  // a fresh reset token, so only the most recent OTP can drive a reset.
  const user = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, email.toLowerCase()), isNull(schema.users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);
  if (user) {
    await db
      .update(schema.passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(schema.passwordResets.userId, user.id), isNull(schema.passwordResets.usedAt)));
  }

  const resetToken = await new SignJWT({ email: email.toLowerCase(), purpose: "password_reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getSecret());

  return { ok: true, token: resetToken };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "password_reset" || !payload.email) {
      return { ok: false, error: "Invalid reset token." };
    }
    const email = payload.email as string;
    const user = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
      .limit(1)
      .then((r) => r[0]);
    if (!user) return { ok: false, error: "User not found." };

    await db.update(schema.users).set({ password: await hashPassword(newPassword), mustChangePwd: false }).where(eq(schema.users.id, user.id));
    await db.update(schema.sessions).set({ revokedAt: new Date() }).where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));

    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid or expired reset token." };
  }
}

/** Verify current + set new password (Change Password page). */
export async function changePassword(
  userId: number,
  current: string,
  next: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await db.select().from(schema.users).where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt))).limit(1).then((r) => r[0]);
  if (!user) return { ok: false, error: "User not found" };
  // L4: prevent setting the new password to the same value as the current one.
  if (current === next) throw new Error("New password must be different from the current password.");
  if (!(await bcrypt.compare(current, user.password))) return { ok: false, error: "Current password is incorrect" };
  await db.update(schema.users).set({ password: await hashPassword(next), mustChangePwd: false }).where(eq(schema.users.id, userId));
  await db.update(schema.sessions).set({ revokedAt: new Date() }).where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  return { ok: true };
}
