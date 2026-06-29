// src/app/api/invoice-otp/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db, schema } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { formatOrderNumber } from "@/lib/invoice-number";
import { formatINR } from "@/lib/utils";

const OTP_EXPIRY = 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = 3;
const ACCESS_EXPIRY = 24 * 60 * 60 * 1000; // 24h
const COOKIE_NAME = "kp_inv_access";

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  return new TextEncoder().encode(s || "dev-secret-invoice");
}

export async function POST(req: NextRequest) {
  try {
    const { action, orderId, email, otp } = await req.json();
    if (!orderId || !email) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const order = await db.select().from(schema.orders).where(eq(schema.orders.id, Number(orderId))).limit(1).then((r) => r[0]);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const orderEmail = (order.contactEmail ?? "").toLowerCase().trim();
    if (email.toLowerCase().trim() !== orderEmail) {
      return NextResponse.json({ error: "Email does not match the order record" }, { status: 403 });
    }

    if (action === "send_otp") {
      const key = `otp:${orderId}`;
      const existing = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
      if (existing) {
        const data = JSON.parse(existing.value);
        if (data.attempts >= MAX_ATTEMPTS) {
          return NextResponse.json({ error: "Too many OTP attempts. Please try again later." }, { status: 429 });
        }
      }

      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const hashed = await bcrypt.hash(otpCode, 10);
      const value = JSON.stringify({ otp: hashed, email, attempts: 0, createdAt: Date.now() });

      if (existing) {
        await db.update(schema.settings).set({ value }).where(eq(schema.settings.key, key));
      } else {
        await db.insert(schema.settings).values({ key, value });
      }

      const orderNum = formatOrderNumber(order.id, order.createdAt);
      await sendEmail({
        to: email,
        subject: `Your OTP for Invoice ${orderNum} — Kadam Production`,
        html: `
          <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;color:#333">
            <h2 style="color:#1e293b">Invoice Access — Kadam Production</h2>
            <p>Hello <strong>${order.clientName}</strong>,</p>
            <p>Use the following OTP to view your invoice for order <strong>${orderNum}</strong>:</p>
            <div style="margin:20px 0;padding:16px 24px;background:#f1f5f9;border-radius:12px;text-align:center;font-size:28px;font-weight:bold;letter-spacing:6px;color:#0f172a">${otpCode}</div>
            <p style="font-size:13px;color:#64748b">This OTP expires in 10 minutes.</p>
            <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0" />
            <p style="font-size:12px;color:#94a3b8">If you did not request this, please ignore this email.</p>
          </div>
        `,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "verify_otp") {
      if (!otp) return NextResponse.json({ error: "OTP is required" }, { status: 400 });

      const key = `otp:${orderId}`;
      const row = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1).then((r) => r[0]);
      if (!row) return NextResponse.json({ error: "No OTP was sent. Request a new one." }, { status: 400 });

      const data = JSON.parse(row.value);
      if (data.attempts >= MAX_ATTEMPTS) {
        await db.delete(schema.settings).where(eq(schema.settings.key, key));
        return NextResponse.json({ error: "Too many failed attempts. Request a new OTP." }, { status: 429 });
      }

      if (Date.now() - data.createdAt > OTP_EXPIRY) {
        await db.delete(schema.settings).where(eq(schema.settings.key, key));
        return NextResponse.json({ error: "OTP has expired. Request a new one." }, { status: 410 });
      }

      const match = await bcrypt.compare(otp, data.otp);
      if (!match) {
        data.attempts += 1;
        await db.update(schema.settings).set({ value: JSON.stringify(data) }).where(eq(schema.settings.key, key));
        return NextResponse.json({ error: "Invalid OTP" }, { status: 403 });
      }

      await db.delete(schema.settings).where(eq(schema.settings.key, key));

      const token = await new SignJWT({ orderId: Number(orderId), email, verifiedAt: Date.now() })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("24h")
        .sign(getSecret());

      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: `/invoice/${orderId}`,
        maxAge: 60 * 60 * 24,
      });
      return res;
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Invoice OTP error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orderId = Number(url.searchParams.get("orderId"));
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ verified: false });

    const { payload } = await jwtVerify(token, getSecret());
    if (payload.orderId !== orderId) return NextResponse.json({ verified: false });

    return NextResponse.json({ verified: true, email: payload.email });
  } catch {
    return NextResponse.json({ verified: false });
  }
}
