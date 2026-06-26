// src/components/StatCard.tsx
// The colored dashboard cards (recreates Bootstrap bg-* classes).
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TONES: Record<string, string> = {
  primary: "bg-kp-primary text-white",
  success: "bg-kp-success text-white",
  warning: "bg-kp-warning text-black",
  danger: "bg-kp-danger text-white",
  info: "bg-kp-info text-black",
  secondary: "bg-kp-secondary text-white",
  dark: "bg-kp-dark text-white",
  purple: "bg-purple-gradient text-white",
};

export function StatCard({
  label,
  value,
  tone = "primary",
  href,
  icon: Icon,
  smallText,
}: {
  label: string;
  value: number | string;
  tone?: keyof typeof TONES;
  href?: string;
  icon?: LucideIcon;
  smallText?: boolean;
}) {
  const body = (
    <div className={cn("group flex items-center gap-4 rounded-xl p-4 shadow-sm transition hover:shadow-md hover:-translate-y-0.5", TONES[tone])}>
      {Icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
        <div className={cn("font-bold", smallText ? "text-lg" : "text-2xl")}>{value}</div>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{body}</Link>;
  return body;
}
