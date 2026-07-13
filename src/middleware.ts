// src/middleware.ts
// Auth + RBAC gate. Public routes: /login, static assets.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/forgot-password", "/invoice"];
const COOKIE = "kp_session";

async function roleFromToken(token?: string): Promise<"admin" | "employee" | null> {
  if (!token) return null;
  try {
    const secretStr = process.env.AUTH_SECRET;
    if (!secretStr) return null; // H1: no weak fallback
    const secret = new TextEncoder().encode(secretStr);
    const { payload } = await jwtVerify(token, secret);
    return (payload.role as "admin" | "employee") ?? null;
  } catch {
    return null;
  }
}

// L2: Validate redirect param — only allow same-origin relative paths
function sanitizeRedirect(path: string): string {
  if (/^\/(?!\/)/.test(path) && !path.startsWith("//")) return path;
  return "/";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  const role = await roleFromToken(token);

  if (!role) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", sanitizeRedirect(pathname)); // L2
    return NextResponse.redirect(url);
  }

  // Employee-restricted admin modules
  const ADMIN_ONLY = ["/inventory", "/categories", "/orders", "/finance", "/employees", "/teams", "/settings"];
  if (role === "employee" && ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|api).*)"],
};
