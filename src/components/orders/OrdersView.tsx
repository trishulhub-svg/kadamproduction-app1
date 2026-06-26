// src/components/orders/OrdersView.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button, Input, Select, Modal, Label, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { Fab } from "@/components/Fab";
import { EVENT_CATEGORIES } from "@/drizzle/schema";
import { createOrder, deleteOrder } from "@/server/order-actions";
import type { OrderListRow } from "@/lib/orders-queries";
import { formatINR, formatDateDMY } from "@/lib/utils";

type Props = {
  orders: OrderListRow[];
  counts: Record<string, number>;
  filters: Record<string, string>;
  hasFilter: boolean;
  openNew: boolean;
};

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: "all", label: "All Orders" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function OrdersView({ orders, counts, filters, hasFilter, openNew }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(openNew);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`/orders?${next.toString()}`));
  }
  function clearFilters() {
    startTransition(() => router.replace("/orders"));
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">Smart view — select a status or date to load orders</p>
        </div>
      </div>

      {/* Filter bar (improvement #5) */}
      <Card className="mb-4 p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Status</Label>
            <Select value={filters.status || ""} onChange={(e) => setFilter("status", e.target.value)}>
              <option value="">— Select status —</option>
              {STATUS_OPTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label} ({counts[s.value] ?? 0})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Start Date</Label>
            <Input type="date" value={filters.startDate || ""} onChange={(e) => setFilter("startDate", e.target.value)} />
          </div>
          <div>
            <Label>End Date</Label>
            <Input type="date" value={filters.endDate || ""} onChange={(e) => setFilter("endDate", e.target.value)} />
          </div>
          <div>
            <Label>Year</Label>
            <Select value={filters.year || ""} onChange={(e) => setFilter("year", e.target.value)}>
              <option value="">All years</option>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="client / event / address" className="pl-9" defaultValue={filters.search || ""} onBlur={(e) => setFilter("search", e.target.value)} />
            </div>
          </div>
        </div>
        {activeFilterCount > 0 && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4" /> Clear Filters</Button>
          </div>
        )}
      </Card>

      {/* Smart empty state (#5) */}
      {!hasFilter ? (
        <EmptyState title="Select a status or date to view orders" hint="Filters keep the list fast and focused." />
      ) : orders.length === 0 ? (
        <EmptyState title="No orders match your filters" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Event Date</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">#{o.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{o.clientName}</td>
                    <td className="px-4 py-3 text-gray-600">{o.contactPerson ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{o.eventCategory ?? "Other"}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateDMY(o.eventDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatINR(o.totalBudget)}</td>
                    <td className="px-4 py-3 font-semibold text-kp-danger">{o.status === "cancelled" ? "—" : formatINR(o.due)}</td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3">
                      {/* Improvement #7: actions (incl. Delete) always visible, incl. mobile */}
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link href={`/orders/${o.id}/invoice`} target="_blank"><Button size="sm" variant="success">Invoice</Button></Link>
                        <Link href={`/orders/${o.id}`}><Button size="sm" variant="primary">Manage</Button></Link>
                        <DeleteOrderBtn id={o.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Fab onClick={() => setCreateOpen(true)} label="New order" />
      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const f = new FormData(e.currentTarget);
    const id = await createOrder({
      clientName: String(f.get("clientName")),
      contactPerson: String(f.get("contactPerson") || ""),
      contactPhone: String(f.get("contactPhone") || ""),
      contactEmail: String(f.get("contactEmail") || ""),
      transportContactName: String(f.get("transportContactName") || ""),
      transportContactPhone: String(f.get("transportContactPhone") || ""),
      eventDate: String(f.get("eventDate") || ""),
      eventTime: String(f.get("eventTime") || ""),
      setupDate: String(f.get("setupDate") || ""),
      setupTime: String(f.get("setupTime") || ""),
      address: String(f.get("address") || ""),
      billingAddress: String(f.get("billingAddress") || ""),
      totalBudget: Number(f.get("totalBudget") || 0),
      advancePayment: Number(f.get("advancePayment") || 0),
      eventCategory: String(f.get("eventCategory") || "Other"),
    });
    if (id) router.push(`/orders/${id}`);
    onClose();
  }
  return (
    <Modal open onClose={onClose} title="Create New Order" className="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label>Client Name *</Label><Input name="clientName" required /></div>
          <div><Label>Event Name</Label><Input name="contactPerson" /></div>
          <div><Label>Contact Phone</Label><Input name="contactPhone" /></div>
          <div><Label>Contact Email</Label><Input name="contactEmail" type="email" /></div>
          <div><Label>Transport Contact Name</Label><Input name="transportContactName" /></div>
          <div><Label>Transport Contact Phone</Label><Input name="transportContactPhone" /></div>
          <div><Label>Event Date</Label><Input name="eventDate" type="date" /></div>
          <div><Label>Event Time</Label><Input name="eventTime" type="time" /></div>
          <div><Label>Setup Date</Label><Input name="setupDate" type="date" /></div>
          <div><Label>Setup Time</Label><Input name="setupTime" type="time" /></div>
          {/* Improvement #6 — event categories */}
          <div>
            <Label>Event Category</Label>
            <Select name="eventCategory" defaultValue="Other">
              {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div><Label>Total Budget (₹)</Label><Input name="totalBudget" type="number" min={0} defaultValue={0} /></div>
          <div><Label>Advance Payment (₹)</Label><Input name="advancePayment" type="number" min={0} defaultValue={0} /></div>
        </div>
        <div><Label>Billing Address</Label><Input name="billingAddress" /></div>
        <div><Label>Event Address</Label><Input name="address" /></div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create Order"}</Button></div>
      </form>
    </Modal>
  );
}

function DeleteOrderBtn({ id }: { id: number }) {
  const [pending, setPending] = useState(false);
  async function run() {
    if (!confirm(`Delete order #${id}?`)) return;
    setPending(true);
    try { await deleteOrder(id); } catch (e) { alert((e as Error).message); setPending(false); }
  }
  return <Button size="sm" variant="danger" onClick={run} disabled={pending}>{pending ? "…" : "Delete"}</Button>;
}
