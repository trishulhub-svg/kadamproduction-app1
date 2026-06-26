// src/app/(dashboard)/page.tsx — Dashboard
import { Plus, CalendarClock, CalendarCheck, Users, FolderOpen, ClipboardList, TrendingUp, TrendingDown, Wallet, IndianRupee } from "lucide-react";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardStats, countAssignedOrders } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { formatINR } from "@/lib/utils";

export default async function DashboardPage() {
  const user = (await getCurrentUser())!;
  const isAdmin = user.role === "admin";

  if (!isAdmin) {
    const assigned = await countAssignedOrders(user.id);
    return (
      <div>
        <Header name={user.name} role="EMPLOYEE" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="My Assigned Orders" value={assigned} tone="primary" href="/my-tasks" icon={ClipboardList} />
        </div>
        <Card className="mt-6 p-5">
          <p className="text-sm text-gray-600">
            Welcome! Use the <span className="font-semibold">Scan Item</span> feature to check items in/out for your assigned events.
            Check <span className="font-semibold">My Tasks</span> to see your upcoming events.
          </p>
        </Card>
      </div>
    );
  }

  const s = await getDashboardStats();

  // Finance summary for dashboard
  const [incRow] = await db
    .select({ v: sql<number>`coalesce(sum(${schema.finance.amount}),0)` })
    .from(schema.finance)
    .where(and(eq(schema.finance.type, "income"), isNull(schema.finance.deletedAt)));
  const [expRow] = await db
    .select({ v: sql<number>`coalesce(sum(${schema.finance.amount}),0)` })
    .from(schema.finance)
    .where(and(eq(schema.finance.type, "expense"), isNull(schema.finance.deletedAt)));
  const totalIncome = Number(incRow?.v ?? 0);
  const totalExpense = Number(expRow?.v ?? 0);

  // Total Due = sum of (budget - paid) across non-cancelled, non-deleted orders
  const [dueRow] = await db
    .select({
      v: sql<number>`coalesce(sum(
        case when ${schema.orders.totalBudget} > 0
        then max(0, ${schema.orders.totalBudget} - coalesce((
          select sum(${schema.finance.amount}) from ${schema.finance}
          where ${schema.finance.orderId} = ${schema.orders.id}
          and ${schema.finance.type} = 'income'
          and ${schema.finance.deletedAt} is null
        ),0))
        else 0 end
      ),0)`,
    })
    .from(schema.orders)
    .where(and(isNull(schema.orders.deletedAt), sql`${schema.orders.status} != 'cancelled'`));

  const totalDue = Number(dueRow?.v ?? 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <div>
      <Header name={user.name} role="ADMIN" />

      {/* Finance cards — colorful */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceCard label="Total Income" value={formatINR(totalIncome)} icon={TrendingUp} className="bg-emerald-500 text-white" />
        <FinanceCard label="Total Expense" value={formatINR(totalExpense)} icon={TrendingDown} className="bg-red-500 text-white" />
        <FinanceCard label="Total Due" value={formatINR(totalDue)} icon={Wallet} className="bg-blue-500 text-white" />
        <FinanceCard label="Net Profit" value={formatINR(netProfit)} icon={IndianRupee} className="bg-amber-400 text-black" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Create New Order" value="New" tone="purple" href="/orders?new=1" icon={Plus} smallText />
        <StatCard label="On Events" value={s.busy} tone="warning" href="/inventory" icon={CalendarClock} />
        <StatCard label="Ongoing Orders" value={s.ongoingOrders} tone="info" href="/orders?status=ongoing" icon={CalendarClock} />
        <StatCard label="Upcoming" value={s.upcomingOrders} tone="secondary" href="/orders?status=upcoming" icon={CalendarCheck} />
        <StatCard label="Employees" value={s.employees} tone="dark" href="/employees" icon={Users} />
        <StatCard label="Categories" value={s.categories} tone="success" href="/categories" icon={FolderOpen} />
      </div>

      {/* Quick Information — visually enhanced */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="overflow-hidden border-l-4 border-l-kp-success p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">Active Events</p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
              <CalendarClock className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="text-sm text-gray-600">
              <StatusBadge status="ongoing" /> <span className="font-semibold text-gray-900">{s.ongoingOrders}</span> ongoing<br />
              <StatusBadge status="upcoming" /> <span className="font-semibold text-gray-900">{s.upcomingOrders}</span> upcoming
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-l-4 border-l-kp-primary p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">Inventory</p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <FolderOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{s.busy}</span> on events<br />
              <span className="font-semibold text-gray-900">{s.totalItems}</span> total items
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-l-4 border-l-kp-warning p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">Team</p>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{s.employees}</span> employees on staff
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FinanceCard({ label, value, icon: Icon, className }: { label: string; value: string; icon: typeof TrendingUp; className: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 shadow-sm ${className}`}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
        <div className="truncate text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function Header({ name, role }: { name: string; role: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {name}!</h1>
        <p className="text-sm text-gray-500">Here&apos;s what&apos;s happening today</p>
      </div>
      <span className="rounded-lg bg-kp-primary px-3 py-1.5 text-sm font-semibold text-white">{role}</span>
    </div>
  );
}
