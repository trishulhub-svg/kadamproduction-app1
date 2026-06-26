// src/app/(dashboard)/finance/page.tsx
import { Suspense } from "react";
import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { FinanceView } from "@/components/finance/FinanceView";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ startDate?: string; endDate?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  const sp = await searchParams;

  const conds = [isNull(schema.finance.deletedAt)];
  if (sp.startDate) conds.push(gte(schema.finance.date, sp.startDate));
  if (sp.endDate) conds.push(lte(schema.finance.date, sp.endDate));

  const [rows, orders] = await Promise.all([
    db.select().from(schema.finance).where(and(...conds)).orderBy(desc(schema.finance.date)),
    db.select({ id: schema.orders.id, clientName: schema.orders.clientName }).from(schema.orders).where(isNull(schema.orders.deletedAt)),
  ]);

  let income = 0, expense = 0;
  for (const r of rows) { if (r.type === "income") income += Number(r.amount); else expense += Number(r.amount); }

  // Calculate total due from orders
  const ordersForDue = await db.select({ id: schema.orders.id, budget: schema.orders.totalBudget }).from(schema.orders).where(and(isNull(schema.orders.deletedAt), sql`${schema.orders.status} != 'cancelled'`));
  let totalDue = 0;
  for (const o of ordersForDue) {
    const incForOrder = rows.filter((r) => r.orderId === o.id && r.type === "income").reduce((a, r) => a + Number(r.amount), 0);
    totalDue += Math.max(0, Number(o.budget) - incForOrder);
  }

  const summary = { totalIncome: income, totalExpenses: expense, netProfit: income - expense, totalDue };

  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading finance…</div>}>
      <FinanceView
        transactions={rows.map((r) => ({ ...r, amount: Number(r.amount), orderLabel: orders.find((o) => o.id === r.orderId)?.clientName ?? null }))}
        summary={summary}
        orders={orders}
        startDate={sp.startDate}
        endDate={sp.endDate}
      />
    </Suspense>
  );
}
