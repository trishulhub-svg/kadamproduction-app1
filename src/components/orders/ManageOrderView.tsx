// src/components/orders/ManageOrderView.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Select, Modal, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { EVENT_CATEGORIES, ORDER_STATUS } from "@/drizzle/schema";
import { updateOrderStatus, saveAssignments, reserveItems, unreserveItem } from "@/server/order-actions";
import { formatINR, formatDateDMY } from "@/lib/utils";
import { Search, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getOrderDetail } from "@/lib/orders-queries";

type Detail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
type SubCat = { id: number; name: string; categoryId: number };

export function ManageOrderView({ detail }: { detail: Detail }) {
  const { order, orderItems, assignments, allItems, itemAvail, paid, subcategories } = detail;
  const due = Math.max(0, Number(order.totalBudget) - paid);

  const [statusOpen, setStatusOpen] = useState(false);
  const [amountsVisible, setAmountsVisible] = useState(false);

  return (
    <div>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-kp-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order #{order.id}</h1>
          <p className="text-sm text-gray-500">{order.clientName} · {order.contactPerson ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAmountsVisible(!amountsVisible)}
            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {amountsVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {amountsVisible ? "Hide" : "Show"}
          </button>
          <StatusBadge status={order.status} />
          <Button variant="primary" onClick={() => setStatusOpen(true)}>Change Status</Button>
          <Link href={`/orders/${order.id}/invoice`} target="_blank"><Button variant="success">Invoice</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Order details */}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Order Details</h3>
          <DetailRow k="Client" v={order.clientName} />
          <DetailRow k="Event" v={order.contactPerson} />
          <DetailRow k="Category" v={order.eventCategory} />
          <DetailRow k="Event Date" v={formatDateDMY(order.eventDate)} />
          <DetailRow k="Event Time" v={order.eventTime} />
          <DetailRow k="Setup" v={`${formatDateDMY(order.setupDate)} ${order.setupTime ?? ""}`} />
          <DetailRow k="Phone" v={order.contactPhone} />
          <DetailRow k="Email" v={order.contactEmail} />
          <DetailRow k="Address" v={order.address} />
          <DetailRow k="Budget" v={formatINR(Number(order.totalBudget))} blur={!amountsVisible} />
          <DetailRow k="Paid" v={formatINR(paid)} blur={!amountsVisible} />
          <DetailRow k="Due" v={formatINR(due)} accent blur={!amountsVisible} />
        </Card>

        {/* Workforce */}
        <WorkforceSection orderId={order.id} assigned={assignments} employees={detail.employees} />

        {/* Inventory assignment */}
        <InventorySection
          orderId={order.id}
          orderItems={orderItems}
          allItems={allItems}
          itemAvail={itemAvail}
          subcategories={subcategories}
        />
      </div>

      {statusOpen && (
        <ChangeStatusModal
          orderId={order.id}
          current={order.status}
          onClose={() => setStatusOpen(false)}
        />
      )}
    </div>
  );
}

function DetailRow({ k, v, accent, blur }: { k: string; v: unknown; accent?: boolean; blur?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-50 py-1.5 text-sm">
      <span className="text-gray-500">{k}</span>
      <span className={`text-right ${blur ? "blur-sm select-none" : ""} ${accent ? "font-bold text-kp-danger" : "font-medium text-gray-800"}`}>{(v as string) || "—"}</span>
    </div>
  );
}

function WorkforceSection({ orderId, assigned, employees }: { orderId: number; assigned: { userId: number; name: string }[]; employees: { id: number; name: string }[] }) {
  const [sel, setSel] = useState<number[]>(assigned.map((a) => a.userId));
  const [pending, setPending] = useState(false);
  async function save() {
    setPending(true);
    await saveAssignments(orderId, sel);
    setPending(false);
  }
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Assign Workforce</h3>
      {employees.length === 0 ? (
        <p className="text-sm text-gray-400">No employees available. Add them in Employees.</p>
      ) : (
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {employees.map((e) => {
            const on = sel.includes(e.id);
            return (
              <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setSel((s) => (on ? s.filter((x) => x !== e.id) : [...s, e.id]))}
                  className="h-4 w-4 accent-kp-primary"
                />
                <span className="text-sm">{e.name}</span>
              </label>
            );
          })}
        </div>
      )}
      <Button className="mt-3 w-full" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save Assignments"}</Button>
    </Card>
  );
}

function InventorySection({
  orderId,
  orderItems,
  allItems,
  itemAvail,
  subcategories,
}: {
  orderId: number;
  orderItems: { id: number; itemId: number; name: string; barcode: string; quantity: number }[];
  allItems: { id: number; name: string; quantity: number; status: string; subcategoryId: number | null; subcategoryName: string | null }[];
  itemAvail: Record<number, number>;
  subcategories: SubCat[];
}) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);
  const [subFilter, setSubFilter] = useState<string>("");

  const filtered = (showAll || query.length >= 2
    ? allItems.filter((i) => {
        if (query && !i.name.toLowerCase().includes(query.toLowerCase())) return false;
        if (subFilter && String(i.subcategoryId) !== subFilter) return false;
        return true;
      })
    : []);

  async function reserve() {
    const payload = Object.entries(draft)
      .map(([itemId, qty]) => ({ itemId: Number(itemId), qty }))
      .filter((x) => x.qty > 0);
    if (payload.length === 0) return;
    setPending(true);
    await reserveItems(orderId, payload);
    setDraft({});
    setPending(false);
  }

  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Assign Inventory</h3>

      {/* Reserved items */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reserved for this order</p>
        {orderItems.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing reserved yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {orderItems.map((oi) => (
              <li key={oi.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                <span>{oi.name} <span className="text-gray-400">×{oi.quantity}</span></span>
                <UnreserveBtn orderId={orderId} itemId={oi.itemId} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Subcategory filter */}
      <Label>Filter by subcategory</Label>
      <Select value={subFilter} onChange={(e) => setSubFilter(e.target.value)} className="mb-2">
        <option value="">All subcategories</option>
        {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </Select>

      {/* Search */}
      <Label>Or search by name</Label>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Type at least 2 chars…"
          className="pl-9"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowAll(false); }}
        />
      </div>
      <button
        type="button"
        onClick={() => setShowAll((v) => !v)}
        className="mb-2 text-xs text-kp-primary hover:underline"
      >
        {showAll ? "Hide list" : "Show all items"}
      </button>

      {filtered.length > 0 && (
        <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((it) => {
            const avail = itemAvail[it.id] ?? it.quantity;
            const draftQty = draft[it.id] ?? 0;
            const previewQty = Math.max(0, avail - draftQty);
            return (
              <div key={it.id} className="rounded-lg border border-gray-100 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{it.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{it.subcategoryName ?? ""}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Available: <span className={previewQty < avail ? "font-bold text-kp-warning" : "text-kp-success"}>{previewQty}</span> / {it.quantity}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={avail}
                    placeholder="qty"
                    value={draftQty || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [it.id]: Math.min(avail, Math.max(0, Number(e.target.value))) }))}
                    className="h-8 w-20 sm:w-24"
                  />
                  {draftQty > 0 && <span className="text-xs text-gray-400">−{draftQty} until reserved</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Button className="mt-3 w-full" variant="success" onClick={reserve} disabled={pending || Object.values(draft).every((v) => !v)}>
        {pending ? "Reserving…" : "Reserve Items"}
      </Button>
      <p className="mt-1 text-center text-xs text-gray-400">Stock is reduced in the list only — real stock updates on reserve.</p>
    </Card>
  );
}

function UnreserveBtn({ orderId, itemId }: { orderId: number; itemId: number }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={async () => { setPending(true); await unreserveItem(orderId, itemId); }}
    >
      {pending ? "…" : "Remove"}
    </Button>
  );
}

function ChangeStatusModal({ orderId, current, onClose }: { orderId: number; current: string; onClose: () => void }) {
  const [status, setStatus] = useState(current);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"automatic" | "manual" | null>(null);

  const completing = status === "completed";

  async function submit() {
    if (completing && !mode) { alert("Choose how inventory returns to the warehouse."); return; }
    setPending(true);
    await updateOrderStatus(orderId, status, mode || undefined);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Change Order Status">
      <div className="space-y-4">
        <div>
          <Label>New Status</Label>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setMode(null); }}>
            {ORDER_STATUS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </Select>
        </div>

        {/* Improvement #8b — completion popup (manual vs automatic return) */}
        {completing && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Take inventory back to warehouse?
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ModeCard active={mode === "automatic"} onClick={() => setMode("automatic")} title="Automatic" desc="Items return via scanner in the system (stock auto-updates)." />
              <ModeCard active={mode === "manual"} onClick={() => setMode("manual")} title="Manual" desc="You will return items manually to warehouse stock." />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "Updating…" : "Update Status"}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ModeCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition ${active ? "border-kp-primary bg-gray-50 ring-2 ring-gray-400/30 dark:bg-gray-800 dark:ring-gray-500/30" : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800/30 dark:hover:bg-gray-800/50"}`}
    >
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-xs text-gray-500">{desc}</p>
    </button>
  );
}
