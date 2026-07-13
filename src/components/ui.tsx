// src/components/ui.tsx — minimal primitives (shadcn-style, no external dep)
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "dark" | "outline" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  const variants: Record<string, string> = {
    primary: "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-sm",
    secondary: "bg-gray-500 hover:bg-gray-600 text-white dark:bg-gray-600 dark:hover:bg-gray-500",
    success: "bg-kp-success hover:bg-emerald-700 text-white",
    warning: "bg-kp-warning hover:bg-amber-600 text-white",
    danger: "bg-kp-danger hover:bg-red-700 text-white",
    info: "bg-gray-500 hover:bg-gray-600 text-white",
    dark: "bg-kp-dark hover:bg-black text-white",
    outline: "border border-gray-200 bg-white/50 hover:bg-white text-gray-700 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10",
    ghost: "hover:bg-[var(--nav-hover)] text-gray-600 dark:text-gray-400",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    icon: "h-10 w-10",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "glass-input h-10 w-full rounded-lg px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "glass-input w-full rounded-lg px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  // L16: native <option> dropdown list uses browser-default styling. We rely on
  // globals.css setting `color-scheme: dark` on `.dark body` (and `light` on
  // :root), which makes the OS-rendered option list match the active theme
  // (dark bg + light text in dark mode). `glass-input` does not override
  // color-scheme, so no extra handling is needed here.
  return (
    <select
      className={cn(
        "glass-input h-10 w-full rounded-lg px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300", className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card rounded-xl", className)} {...props} />;
}

export function Badge({ className, tone = "gray", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: string }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    yellow: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    blue: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    dark: "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone] ?? tones.gray, className)} {...props} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/30 p-4 backdrop-blur-sm sm:p-8">
      <div className={cn("glass relative w-full max-w-lg rounded-2xl my-8", className)}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="glass-card rounded-xl py-12 text-center">
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
