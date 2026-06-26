// src/components/auth/LoginForm.tsx
"use client";
import { useActionState } from "react";
import { loginAction } from "@/server/auth-actions";
import { Film } from "lucide-react";

export function LoginForm({ logoUrl }: { logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="mb-6 text-center">
            {logoUrl ? (
              <div className="mx-auto mb-3 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Kadam Production"
                  className="kp-logo-zoom mx-auto h-20 w-20 object-contain"
                />
              </div>
            ) : (
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-brand-gradient text-white">
                <Film className="h-7 w-7" />
              </div>
            )}
            <h1 className="text-xl font-extrabold tracking-wide text-gray-900">KADAM PRODUCTION</h1>
            <p className="text-sm text-gray-500">Professional Event Services</p>
          </div>

          {state?.error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-kp-danger">{state.error}</div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                name="email"
                type="email"
                required
                autoFocus
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-kp-primary focus:ring-2 focus:ring-blue-400/30"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <input
                name="password"
                type="password"
                required
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-kp-primary focus:ring-2 focus:ring-blue-400/30"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-lg bg-brand-gradient font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
            >
              {pending ? "Signing in…" : "LOGIN"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-white/80">
          © {year} Kadam Production / Powered by Trishulhub
        </p>
      </div>
    </div>
  );
}
