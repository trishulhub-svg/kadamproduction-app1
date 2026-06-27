// src/components/Sidebar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Boxes,
  FolderOpen,
  CalendarDays,
  LineChart,
  Users,
  UsersRound,
  Settings,
  ScanLine,
  ListChecks,
  KeyRound,
  LogOut,
  Film,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { label: string; href: string; icon: typeof LayoutDashboard; tone?: "warning" | "info" | "danger" };

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Categories", href: "/categories", icon: FolderOpen },
  { label: "Orders", href: "/orders", icon: CalendarDays },
  { label: "Finance", href: "/finance", icon: LineChart },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Teams", href: "/teams", icon: UsersRound },
  { label: "Scan Item", href: "/scan", icon: ScanLine, tone: "warning" },
  { label: "Change Password", href: "/change-password", icon: KeyRound, tone: "warning" },
  { label: "Settings", href: "/settings", icon: Settings },
];

const EMPLOYEE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Scan Item", href: "/scan", icon: ScanLine, tone: "warning" },
  { label: "My Tasks", href: "/my-tasks", icon: ListChecks, tone: "info" },
  { label: "Change Password", href: "/change-password", icon: KeyRound, tone: "warning" },
];

export function Sidebar({
  role,
  name,
  logoUrl,
  scanEnabled = true,
  onLogout,
}: {
  role: "admin" | "employee";
  name: string;
  logoUrl?: string | null;
  scanEnabled?: boolean;
  onLogout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const nav = (role === "admin" ? ADMIN_NAV : EMPLOYEE_NAV).filter(
    (item) => item.href !== "/scan" || role === "admin" || scanEnabled
  );
  const brand = role === "admin" ? "KP Admin" : "KP Staff";

  return (
    <aside className="glass-sidebar flex h-full w-64 flex-col">
      {/* Brand header with gradient */}
      <div className="brand-header px-5 py-5 text-white">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-11 w-11 rounded-xl object-contain ring-2 ring-white/20" />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Film className="h-6 w-6 text-white" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-white drop-shadow-sm">{brand}</div>
            <div className="truncate text-xs text-white/60">Kadam Production</div>
          </div>
        </div>
        <div className="mt-3 truncate rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 ring-1 ring-white/10">
          <span className="text-white/50">Signed in as </span>
          <span className="font-semibold text-white">{name}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] shadow-sm"
                  : "text-gray-600 hover:bg-[var(--nav-hover)] hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0 transition-transform", active && "scale-110")} />
              <span className="truncate">{item.label}</span>
              {item.tone && !active && (
                <span className={cn(
                  "ml-auto h-1.5 w-1.5 rounded-full",
                  item.tone === "warning" && "bg-amber-400",
                  item.tone === "info" && "bg-cyan-400",
                  item.tone === "danger" && "bg-red-400",
                )} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-1">
        <ThemeToggle className="w-full justify-center" />
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3 dark:border-white/5">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 transition-all hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
        <p className="mt-2 px-3 text-[10px] text-gray-400 dark:text-gray-600">© {new Date().getFullYear()} Kadam Production / Powered by <a href="https://trishulhub.in" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 dark:hover:text-gray-400">Trishulhub</a></p>
      </div>
    </aside>
  );
}
