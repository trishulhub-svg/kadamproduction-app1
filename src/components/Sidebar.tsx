// src/components/Sidebar.tsx  (Improvement #2: enhanced side menu design; #3: logo)
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
  // For employees, filter out Scan Item when scanEnabled is off
  const nav = (role === "admin" ? ADMIN_NAV : EMPLOYEE_NAV).filter(
    (item) => item.href !== "/scan" || role === "admin" || scanEnabled
  );
  const brand = role === "admin" ? "KP Admin" : "KP Staff";

  return (
    <aside className="flex h-full w-64 flex-col bg-white shadow-xl">
      {/* Brand header — improvement #2 + #3 (logo) */}
      <div className="bg-brand-gradient px-5 py-5 text-white">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center">
              <Film className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-base font-bold">{brand}</div>
            <div className="truncate text-xs text-white/70">Kadam Production</div>
          </div>
        </div>
        <div className="mt-3 truncate rounded-lg bg-white/10 px-3 py-1.5 text-xs">
          <span className="text-white/60">Signed in as </span>
          <span className="font-semibold">{name}</span>
        </div>
      </div>

      {/* Nav — improvement #2: rounded, grouped, hover states, active pill */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-brand-gradient text-white shadow"
                  : item.tone === "warning"
                  ? "text-amber-600 hover:bg-amber-50"
                  : item.tone === "info"
                  ? "text-cyan-600 hover:bg-cyan-50"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-kp-danger transition hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
        <p className="mt-2 px-3 text-[10px] text-gray-400">© {new Date().getFullYear()} Kadam Production / Powered by <a href="https://trishulhub.in" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">Trishulhub</a></p>
      </div>
    </aside>
  );
}
