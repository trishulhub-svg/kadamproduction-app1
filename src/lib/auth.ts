// src/lib/auth.ts
import { randomBytes, randomInt, createHash } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { eq, and, isNull, gte, asc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "./db";
import { checkRateLimit as generalRateLimit, clearRateLimit } from "./rate-limiter";

const COOKIE = "kp_session";
const MAX_ADMIN_DEVICES = 2;
const SESSION_GRACE_MS = 15_000; // Turso read-after-write grace for new sessions
// Precomputed bcrypt of a fixed string — used only for timing equalization.
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.trim().length < 8) {
    throw new Error(
      "AUTH_SECRET is required and must be at least 8 characters. Current value length: " +
        (s ? s.length : "undefined")
    );
  }
  if (s.trim().length < 32) {
    console.warn(
      "[auth] AUTH_SECRET is shorter than 32 characters. Generate a stronger secret with: openssl rand -base64 32"
    );
  }
  return new TextEncoder().encode(s);
}

function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  // Persist session before issuing JWT — fail closed if DB write fails so
  // sessions remain revocable.
  if (user.role === "admin") {
    const activeSessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(
        and(
          eq(schema.sessions.userId, user.id),
          isNull(schema.sessions.revokedAt),
          gte(schema.sessions.expiresAt, now)
        )
      )
      .orderBy(asc(schema.sessions.createdAt));

    const toRevokeCount = Math.max(0, activeSessions.length - (MAX_ADMIN_DEVICES - 1));
    for (let i = 0; i < toRevokeCount; i++) {
      await db
        .update(schema.sessions)
        .set({ revokedAt: now })
        .where(eq(schema.sessions.id, activeSessions[i].id));
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

  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionId,
    mustChangePwd: Boolean(user.mustChangePwd),
  })
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
    return null;
  }
  const user = payload as unknown as SessionUser & { iat?: number };
  if (!user || typeof user.id !== "number" || !user.role) return null;
  if (!user.sessionId) return null;

  // Fail closed: session must exist and not be revoked.
  try {
    const session = await db
      .select({ revokedAt: schema.sessions.revokedAt })
      .from(schema.sessions)
      .where(eq(schema.sessions.id, user.sessionId))
      .limit(1)
      .then((r) => r[0]);

    if (!session) {
      // Allow a short grace window for Turso eventual consistency right after login.
      const iatMs = typeof payload.iat === "number" ? payload.iat * 1000 : 0;
      if (!iatMs || Date.now() - iatMs > SESSION_GRACE_MS) return null;
    } else if (session.revokedAt) {
      return null;
    }
  } catch (err) {
    console.error("[auth] session lookup DB error — failing closed:", err);
    return null;
  }

  // Fail closed: user must exist, be active, not soft-deleted.
  try {
    const dbUser = await db
      .select({
        deletedAt: schema.users.deletedAt,
        active: schema.users.active,
        mustChangePwd: schema.users.mustChangePwd,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1)
      .then((r) => r[0]);
    if (!dbUser || dbUser.deletedAt) return null;
    if (dbUser.active === false) return null;
    return {
      id: user.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
      sessionId: user.sessionId,
      mustChangePwd: Boolean(dbUser.mustChangePwd),
    };
  } catch (err) {
    console.error("[auth] user lookup DB error — failing closed:", err);
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

export async function login(
  email: string,
  password: string
): Promise<{ ok: true; mustChangePwd?: boolean } | { ok: false; error: string }> {
  const normalized = email.toLowerCase().trim();
  const rl = await generalRateLimit(normalized, { max: 5, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };
  }

  let user;
  try {
    user = await db
      .select()
      .from(schema.users)
      .where(and(eq(schema.users.email, normalized), isNull(schema.users.deletedAt)))
      .limit(1)
      .then((r) => r[0]);
  } catch (err) {
    console.error("[auth] DB error fetching user:", err);
    return { ok: false, error: "Server error. Please try again." };
  }

  // Always run bcrypt to avoid timing-based email enumeration.
  const hash = user?.password ?? DUMMY_HASH;
  let match = false;
  try {
    match = await bcrypt.compare(password, hash);
  } catch (err) {
    console.error("[auth] bcrypt compare error:", err);
    return { ok: false, error: "Server error. Please try again." };
  }

  if (!user || !match) {
    return { ok: false, error: "Invalid Credentials" };
  }

  if (user.active === false) {
    return { ok: false, error: "Your account has been deactivated. Contact your administrator." };
  }

  try {
    await clearRateLimit(normalized);
  } catch (err) {
    console.error("[auth] clearRateLimit error:", err);
  }

  const store = await cookies();
  let token: string;
  try {
    token = await sign({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePwd: Boolean(user.mustChangePwd),
    });
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
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const sid = payload.sessionId as string | undefined;
      if (sid) {
        await db
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(eq(schema.sessions.id, sid));
      }
    } catch {
      // invalid token — just delete cookie
    }
  }
  store.delete(COOKIE);
}

/** Hash a password (bcrypt) — used by seed + employee create. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ──────────────────────────────────────────────────────────────────────────
// Forgot Password — OTP via SMTP
// ──────────────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export async function sendForgotOtp(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = email.toLowerCase().trim();
  const rl = await generalRateLimit(normalized, { max: 3, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${rl.retryAfter ?? 60}s.` };
  }

  const user = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.email, normalized), isNull(schema.users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);
  // Do not reveal whether the email exists.
  if (!user) return { ok: true };

  const otp = generateOtp();
  const hashed = await bcrypt.hash(otp, 12);
  const key = `forgot_otp_${normalized.replace(/[^a-z0-9]/g, "")}`;
  await db
    .insert(schema.settings)
    .values({ key, value: JSON.stringify({ otp: hashed, expiresAt: Date.now() + 10 * 60 * 1000 }) })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: JSON.stringify({ otp: hashed, expiresAt: Date.now() + 10 * 60 * 1000 }) },
    });

  const { sendEmail } = await import("@/lib/email");
  await sendEmail({
    to: normalized,
    subject: "Password Reset OTP — Kadam Production",
    html: `
      <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
        <h2 style="color:#1e40af">Password Reset Request</h2>
        <p>Hello <strong>${escapeHtml(user.name)}</strong>,</p>
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

export async function verifyForgotOtp(
  email: string,
  otp: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const normalized = email.toLowerCase().trim();
  const rl = await generalRateLimit(`verify_otp_${normalized.replace(/[^a-z0-9]/g, "")}`, {
    max: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) return { ok: false, error: "Too many attempts. Try again later." };

  const key = `forgot_otp_${normalized.replace(/[^a-z0-9]/g, "")}`;
  const row = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return { ok: false, error: "Invalid or expired OTP." };

  let data: { otp: string; expiresAt: number };
  try {
    data = JSON.parse(row.value);
  } catch {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "Invalid or expired OTP." };
  }
  if (!data.otp || typeof data.expiresAt !== "number") {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "Invalid or expired OTP." };
  }
  if (Date.now() > data.expiresAt) {
    await db.delete(schema.settings).where(eq(schema.settings.key, key));
    return { ok: false, error: "Invalid or expired OTP." };
  }

  if (!(await bcrypt.compare(otp, data.otp))) return { ok: false, error: "Invalid or expired OTP." };

  await db.delete(schema.settings).where(eq(schema.settings.key, key));

  const user = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.email, normalized), isNull(schema.users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);
  if (!user) return { ok: false, error: "Invalid or expired OTP." };

  // Invalidate prior unused reset tokens for this user.
  await db
    .update(schema.passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.passwordResets.userId, user.id), isNull(schema.passwordResets.usedAt)));

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.insert(schema.passwordResets).values({
    userId: user.id,
    token: tokenHash,
    expiresAt,
  });

  const resetToken = await new SignJWT({
    email: normalized,
    purpose: "password_reset",
    jti: rawToken,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(getSecret());

  return { ok: true, token: resetToken };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (newPassword.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "password_reset" || !payload.email || !payload.jti) {
      return { ok: false, error: "Invalid reset token." };
    }
    const email = payload.email as string;
    const jti = payload.jti as string;
    const tokenHash = hashResetToken(jti);

    const resetRow = await db
      .select()
      .from(schema.passwordResets)
      .where(and(eq(schema.passwordResets.token, tokenHash), isNull(schema.passwordResets.usedAt)))
      .limit(1)
      .then((r) => r[0]);
    if (!resetRow || resetRow.expiresAt.getTime() < Date.now()) {
      return { ok: false, error: "Invalid or expired reset token." };
    }

    const user = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.email, email), isNull(schema.users.deletedAt)))
      .limit(1)
      .then((r) => r[0]);
    if (!user || user.id !== resetRow.userId) return { ok: false, error: "User not found." };

    await db
      .update(schema.passwordResets)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResets.id, resetRow.id));

    await db
      .update(schema.users)
      .set({ password: await hashPassword(newPassword), mustChangePwd: false })
      .where(eq(schema.users.id, user.id));
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt)));

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
  const user = await db
    .select()
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), isNull(schema.users.deletedAt)))
    .limit(1)
    .then((r) => r[0]);
  if (!user) return { ok: false, error: "User not found" };
  if (current === next) return { ok: false, error: "New password must be different from the current password." };
  if (next.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!(await bcrypt.compare(current, user.password))) return { ok: false, error: "Current password is incorrect" };
  await db
    .update(schema.users)
    .set({ password: await hashPassword(next), mustChangePwd: false })
    .where(eq(schema.users.id, userId));

  // Re-issue cookie with mustChangePwd=false and revoke other device sessions.
  const store = await cookies();
  const oldToken = store.get(COOKIE)?.value;
  let keepSessionId: string | undefined;
  if (oldToken) {
    try {
      const { payload } = await jwtVerify(oldToken, getSecret());
      keepSessionId = payload.sessionId as string | undefined;
    } catch {
      keepSessionId = undefined;
    }
  }
  const sessions = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  for (const s of sessions) {
    if (keepSessionId && s.id === keepSessionId) continue;
    await db.update(schema.sessions).set({ revokedAt: new Date() }).where(eq(schema.sessions.id, s.id));
  }

  // Mint a fresh JWT reflecting mustChangePwd=false (reuse current session row if present).
  const sessionId = keepSessionId || crypto.randomUUID();
  if (!keepSessionId) {
    const now = new Date();
    await db.insert(schema.sessions).values({
      id: sessionId,
      userId,
      refreshToken: sessionId,
      rotated: false,
      expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
      createdAt: now,
    });
  }
  const fresh = await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionId,
    mustChangePwd: false,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(getSecret());
  store.set(COOKIE, fresh, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return { ok: true };
}
