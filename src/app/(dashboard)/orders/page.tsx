// src/app/(dashboard)/orders/page.tsx
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { listOrders, statusCounts } from "@/lib/orders-queries";
import { OrdersView } from "@/components/orders/OrdersView";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  const sp = await searchParams;
  const filters = {
    status: sp.status,
    year: sp.year,
    startDate: sp.startDate,
    endDate: sp.endDate,
    search: sp.search,
  };
  const openNew = sp.new === "1";

  // Improvement #5 — "smart" orders: only query when a status or date is chosen
  const hasFilter = Boolean(filters.status || filters.startDate || filters.endDate || filters.search || filters.year);
  const [orders, counts] = await Promise.all([hasFilter ? listOrders(filters) : Promise.resolve([]), statusCounts()]);

  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading orders…</div>}>
      <OrdersView orders={orders} counts={counts} filters={filters as Record<string, string>} hasFilter={hasFilter} openNew={openNew} />
    </Suspense>
  );
}
