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
    primary: "bg-kp-primary hover:bg-blue-700 text-white",
    secondary: "bg-kp-secondary hover:bg-gray-600 text-white",
    success: "bg-kp-success hover:bg-emerald-700 text-white",
    warning: "bg-kp-warning hover:bg-yellow-500 text-black",
    danger: "bg-kp-danger hover:bg-red-700 text-white",
    info: "bg-kp-info hover:bg-cyan-500 text-black",
    dark: "bg-kp-dark hover:bg-black text-white",
    outline: "border border-gray-300 bg-white hover:bg-gray-50 text-gray-800",
    ghost: "hover:bg-gray-100 text-gray-700",
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-blue-400/40",
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
        "glass-input h-10 w-full rounded-lg px-3 text-sm outline-none transition focus:border-kp-primary focus:ring-2 focus:ring-blue-400/30",
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
        "glass-input w-full rounded-lg px-3 py-2 text-sm outline-none transition focus:border-kp-primary focus:ring-2 focus:ring-blue-400/30",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "glass-input h-10 w-full rounded-lg px-3 text-sm outline-none transition focus:border-kp-primary focus:ring-2 focus:ring-blue-400/30",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1 block text-sm font-medium text-gray-700", className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass-card rounded-xl", className)} {...props} />;
}

export function Badge({ className, tone = "gray", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: string }) {
  const tones: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    dark: "bg-gray-800 text-white",
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
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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
