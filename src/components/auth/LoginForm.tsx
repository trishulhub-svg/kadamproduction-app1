"use client";
import { useActionState } from "react";
import { loginAction } from "@/server/auth-actions";
import { Film } from "lucide-react";

export function LoginForm({ logoUrl }: { logoUrl: string | null }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-950 p-4">
      <div className="w-full max-w-md">
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <div className="mb-6 text-center">
            {logoUrl ? (
              <div className="mx-auto mb-3 overflow-hidden">
                <img
                  src={logoUrl}
                  alt="Kadam Production"
                  className="kp-logo-zoom mx-auto h-20 w-20 rounded-2xl object-contain"
                />
              </div>
            ) : (
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg">
                <Film className="h-8 w-8" />
              </div>
            )}
            <h1 className="text-xl font-extrabold tracking-wide text-gray-900 dark:text-gray-100">KADAM PRODUCTION</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Professional Event Services</p>
          </div>

          {state?.error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                name="email"
                type="email"
                required
                autoFocus
                className="glass-input h-11 w-full rounded-lg px-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 dark:text-gray-100 dark:placeholder-gray-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input
                name="password"
                type="password"
                required
                className="glass-input h-11 w-full rounded-lg px-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 dark:text-gray-100 dark:placeholder-gray-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="h-11 w-full rounded-lg bg-[var(--accent)] font-semibold text-white shadow-sm shadow-[var(--accent-glow)] transition-all hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {pending ? "Signing in\u2026" : "LOGIN"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-white/60">
          &copy; {year} Kadam Production / Powered by{" "}
          <a href="https://trishulhub.in" target="_blank" rel="noopener noreferrer" className="font-medium text-white/80 underline hover:text-white">
            Trishulhub
          </a>
        </p>
      </div>
    </div>
  );
}
