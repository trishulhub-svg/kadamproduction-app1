// src/components/StatCard.tsx
// The colored dashboard cards (recreates Bootstrap bg-* classes).
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TONES: Record<string, string> = {
  primary: "glass bg-gradient-to-br from-blue-500/20 to-blue-600/10 text-blue-900 border border-blue-200/40",
  success: "glass bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-900 border border-emerald-200/40",
  warning: "glass bg-gradient-to-br from-amber-400/20 to-amber-500/10 text-amber-900 border border-amber-200/40",
  danger: "glass bg-gradient-to-br from-red-500/20 to-red-600/10 text-red-900 border border-red-200/40",
  info: "glass bg-gradient-to-br from-cyan-400/20 to-cyan-500/10 text-cyan-900 border border-cyan-200/40",
  secondary: "glass bg-gradient-to-br from-gray-500/20 to-gray-600/10 text-gray-900 border border-gray-200/40",
  dark: "glass bg-gradient-to-br from-gray-800/30 to-gray-900/20 text-gray-900 border border-gray-300/30",
  purple: "glass bg-gradient-to-br from-purple-500/20 to-purple-600/10 text-purple-900 border border-purple-200/40",
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
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black/5">
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
