// src/components/orders/ManageOrderView.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Select, Modal, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { EVENT_CATEGORIES, ORDER_STATUS } from "@/drizzle/schema";
import { updateOrderStatus, saveAssignments, reserveItems, unreserveItem, updateOrder } from "@/server/order-actions";
import { formatINR, formatDateDMY } from "@/lib/utils";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
type SubCat = { id: number; name: string; categoryId: number };

type Detail = {
  order: { id: number; clientName: string; contactPerson: string | null; contactPhone: string | null; contactEmail: string | null; eventDate: string | null; eventTime: string | null; setupDate: string | null; setupTime: string | null; address: string | null; billingAddress: string | null; totalBudget: number; status: string; eventCategory: string | null; gstEnabled: boolean | null; createdAt: Date | null };
  orderItems: { id: number; itemId: number; name: string; barcode: string; quantity: number; reservedAt: Date | null }[];
  assignments: { userId: number; name: string }[];
  allItems: { id: number; name: string; categoryId: number | null; subcategoryId: number | null; quantity: number; status: string; subcategoryName: string | null }[];
  itemAvail: Record<number, number>;
  paid: number;
  subcategories: { id: number; name: string; categoryId: number }[];
  categories: { id: number; name: string }[];
  employees: { id: number; name: string }[];
};

export function ManageOrderView({ detail }: { detail: Detail }) {
  const { order, orderItems = [], assignments = [], allItems = [], itemAvail = {}, paid = 0, subcategories = [], categories = [] } = detail;
  if (!order) return <Card className="p-8 text-center"><p className="text-sm text-red-500">Order data unavailable.</p></Card>;
  const due = Math.max(0, Number(order.totalBudget) - paid);

  const [statusOpen, setStatusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [amountsVisible, setAmountsVisible] = useState(false);

  return (
    <div>
      <Link href="/orders" className="mb-4 inline-flex items-center gap-2 text-sm text-kp-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order #{order.id}</h1>
          <p className="text-sm text-gray-500">{order.clientName}</p>
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
          <Button variant="outline" onClick={() => setEditOpen(true)}>Edit</Button>
          <Button variant="primary" onClick={() => setStatusOpen(true)}>Change Status</Button>
          <Link href={`/orders/${order.id}/invoice`}><Button variant="success">Invoice</Button></Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left sidebar: Order details + Workforce */}
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-700">Order Details</h3>
            <DetailRow k="Client" v={order.clientName} />
            <DetailRow k="Category" v={order.eventCategory} />
            <DetailRow k="Event Date" v={formatDateDMY(order.eventDate)} />
            <DetailRow k="Event Time" v={order.eventTime} />
            <DetailRow k="Setup" v={`${formatDateDMY(order.setupDate)} ${order.setupTime ?? ""}`} />
            <DetailRow k="Phone" v={order.contactPhone} />
            <DetailRow k="Email" v={order.contactEmail} />
            <DetailRow k="Address" v={order.address} />
            <DetailRow k="Amount" v={formatINR(Number(order.totalBudget))} blur={!amountsVisible} />
            <DetailRow k="Paid" v={formatINR(paid)} blur={!amountsVisible} />
            <DetailRow k="Due" v={formatINR(due)} accent blur={!amountsVisible} />
          </Card>

          <WorkforceSection orderId={order.id} assigned={assignments} employees={detail.employees} />
        </div>

        {/* Main: Inventory assignment (spans 2 cols on desktop) */}
        <div className="lg:col-span-2">
          <InventorySection
            orderId={order.id}
            orderItems={orderItems}
            allItems={allItems}
            itemAvail={itemAvail}
            subcategories={subcategories}
            categories={categories}
          />
        </div>
      </div>

      {editOpen && (
        <EditOrderModal
          order={order}
          onClose={() => setEditOpen(false)}
        />
      )}
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
  categories,
}: {
  orderId: number;
  orderItems: { id: number; itemId: number; name: string; barcode: string; quantity: number }[];
  allItems: { id: number; name: string; categoryId: number | null; subcategoryId: number | null; quantity: number; status: string; subcategoryName: string | null }[];
  itemAvail: Record<number, number>;
  subcategories: SubCat[];
  categories: { id: number; name: string }[];
}) {
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [pending, setPending] = useState(false);

  const subToCat = new Map<number, number>();
  subcategories.forEach((s) => subToCat.set(s.id, s.categoryId));

  function itemCategoryId(it: (typeof allItems)[number]): number | null {
    return it.categoryId ?? (it.subcategoryId ? subToCat.get(it.subcategoryId) ?? null : null);
  }

  const catsWithItems = categories.filter((c) => allItems.some((i) => itemCategoryId(i) === c.id));
  const subcategoriesInCat = selectedCat !== null ? subcategories.filter((s) => s.categoryId === selectedCat) : [];

  const visibleItems = selectedSub !== null
    ? allItems.filter((i) => i.subcategoryId === selectedSub)
    : selectedCat !== null
      ? allItems.filter((i) => itemCategoryId(i) === selectedCat)
      : [];

  const draftEntries = Object.entries(draft).filter(([, qty]) => qty > 0);
  const draftCount = draftEntries.length;
  const draftTotalQty = draftEntries.reduce((s, [, q]) => s + q, 0);

  const itemMap = new Map(allItems.map((i) => [i.id, i]));

  function setQty(itemId: number, qty: number) {
    const avail = itemAvail[itemId] ?? itemMap.get(itemId)?.quantity ?? 0;
    const clamped = Math.min(avail, Math.max(0, qty));
    setDraft((d) => {
      if (clamped === 0) {
        const next = { ...d };
        delete next[itemId];
        return next;
      }
      return { ...d, [itemId]: clamped };
    });
  }

  function clearDraftItem(itemId: number) {
    setDraft((d) => { const n = { ...d }; delete n[itemId]; return n; });
  }

  async function reserve() {
    const payload = draftEntries.map(([itemId, qty]) => ({ itemId: Number(itemId), qty }));
    if (payload.length === 0) return;
    setPending(true);
    await reserveItems(orderId, payload);
    setDraft({});
    setPending(false);
  }

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Assign Inventory</h3>
        {draftCount > 0 && (
          <span className="rounded-full bg-kp-primary px-2.5 py-0.5 text-xs font-bold text-white">
            {draftCount} · {draftTotalQty} qty
          </span>
        )}
      </div>

      {/* Reserved items */}
      <div className="mb-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reserved for this order</p>
        {orderItems.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing reserved yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {orderItems.map((oi) => (
              <li key={oi.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                <span>{oi.name} <span className="text-gray-400">x{oi.quantity}</span></span>
                <UnreserveBtn orderId={orderId} itemId={oi.itemId} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Step 1: Pick Category */}
      {selectedCat === null ? (
        <div className="flex-1">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">1. Choose a Category</p>
          {catsWithItems.length === 0 ? (
            <p className="text-sm text-gray-400">No inventory categories found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {catsWithItems.map((c) => {
                const cnt = allItems.filter((i) => itemCategoryId(i) === c.id).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCat(c.id); setSelectedSub(null); }}
                    className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-4 text-center transition hover:border-kp-primary hover:shadow-md dark:border-gray-700 dark:bg-gray-800/30"
                  >
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{c.name}</span>
                    <span className="mt-0.5 text-[11px] text-gray-400">{cnt} item{cnt !== 1 ? "s" : ""}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Step 2: Back + Pick Subcategory */}
          <div className="mb-2.5 flex items-center gap-2">
            <button
              onClick={() => { setSelectedCat(null); setSelectedSub(null); }}
              className="text-xs font-medium text-kp-primary hover:underline"
            >← Back to categories</button>
            <span className="text-xs text-gray-400">{categories.find((c) => c.id === selectedCat)?.name}</span>
          </div>

          {selectedSub === null && subcategoriesInCat.length > 0 && (
            <div className="mb-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">2. Pick Subcategory (or browse all)</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSub(-1)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition hover:border-kp-primary ${selectedSub === -1 ? "border-kp-primary bg-kp-primary text-white" : "border-gray-200 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-300"}`}
                >All Items</button>
                {subcategoriesInCat.map((s) => {
                  const cnt = allItems.filter((i) => i.subcategoryId === s.id).length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSub(s.id)}
                      className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-medium text-gray-600 transition hover:border-kp-primary dark:border-gray-600 dark:bg-gray-800/30 dark:text-gray-300"
                    >
                      {s.name} <span className="text-gray-400">({cnt})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedSub === null && subcategoriesInCat.length === 0 && (
            <div className="mb-3">
              <button
                onClick={() => setSelectedSub(-1)}
                className="rounded-full border border-kp-primary bg-kp-primary px-3.5 py-1.5 text-xs font-medium text-white"
              >Browse All Items</button>
            </div>
          )}

          {/* Step 3: Items */}
          {selectedSub !== null && (
            <>
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => setSelectedSub(null)}
                  className="text-xs font-medium text-kp-primary hover:underline"
                >← Back to subcategories</button>
                <span className="text-xs text-gray-400">
                  {selectedSub === -1 ? "All Items" : subcategories.find((s) => s.id === selectedSub)?.name}
                </span>
              </div>

              {visibleItems.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">No items found.</p>
              ) : (
                <div className="max-h-64 flex-1 space-y-1 overflow-y-auto pr-1">
                  {visibleItems.map((it) => {
                    const avail = itemAvail[it.id] ?? it.quantity;
                    const draftQty = draft[it.id] ?? 0;
                    const isSelected = draftQty > 0;
                    const reservedQty = orderItems.find((oi) => oi.itemId === it.id)?.quantity ?? 0;
                    const effectiveAvail = Math.max(0, avail - reservedQty);
                    return (
                      <div
                        key={it.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${isSelected ? "border-kp-primary bg-gray-50 dark:bg-gray-800/50" : "border-gray-100 dark:border-gray-700"}`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{it.name}</span>
                          {it.subcategoryName && <span className="ml-1.5 text-xs text-gray-400">({it.subcategoryName})</span>}
                          <span className="ml-2 text-xs text-gray-500">Remaining: {effectiveAvail - draftQty}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            max={effectiveAvail}
                            placeholder="qty"
                            value={draftQty || ""}
                            onChange={(e) => setQty(it.id, Number(e.target.value))}
                            className="h-8 w-16 text-center"
                          />
                          {isSelected && (
                            <button onClick={() => clearDraftItem(it.id)} className="text-xs text-red-400 hover:text-red-600">×</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Reserve button */}
      {selectedCat !== null && (
        <Button
          className="mt-3 w-full shrink-0"
          variant="success"
          onClick={reserve}
          disabled={pending || draftCount === 0}
        >
          {pending ? "Reserving..." : `Reserve All (${draftCount} item${draftCount !== 1 ? "s" : ""})`}
        </Button>
      )}
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

function EditOrderModal({ order, onClose }: { order: Detail["order"]; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const f = new FormData(e.currentTarget);
      const input: Record<string, unknown> = {
        clientName: String(f.get("clientName")),
        contactPerson: String(f.get("contactPerson") || ""),
        contactPhone: String(f.get("contactPhone") || ""),
        contactEmail: String(f.get("contactEmail") || ""),
        eventDate: String(f.get("eventDate") || ""),
        eventTime: String(f.get("eventTime") || ""),
        setupDate: String(f.get("setupDate") || ""),
        setupTime: String(f.get("setupTime") || ""),
        address: String(f.get("address") || ""),
        billingAddress: String(f.get("billingAddress") || ""),
        totalBudget: Number(f.get("totalBudget") || 0),
        eventCategory: String(f.get("eventCategory") || ""),
        gstEnabled: f.get("gstEnabled") === "on",
      };
      await updateOrder(order.id, input);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={`Edit Order #${order.id}`}>
      <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label>Client Name</Label><Input name="clientName" defaultValue={order.clientName} required /></div>
          <div><Label>Phone</Label><Input name="contactPhone" defaultValue={order.contactPhone ?? ""} /></div>
          <div><Label>Email</Label><Input name="contactEmail" defaultValue={order.contactEmail ?? ""} type="email" /></div>
          <div><Label>Event Date</Label><Input name="eventDate" defaultValue={order.eventDate ?? ""} type="date" /></div>
          <div><Label>Event Time</Label><Input name="eventTime" defaultValue={order.eventTime ?? ""} type="time" /></div>
          <div><Label>Setup Date</Label><Input name="setupDate" defaultValue={order.setupDate ?? ""} type="date" /></div>
          <div><Label>Setup Time</Label><Input name="setupTime" defaultValue={order.setupTime ?? ""} type="time" /></div>
          <div><Label>Event Category</Label>
            <Select name="eventCategory" defaultValue={order.eventCategory ?? ""}>
              {EVENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div><Label>Total Amount (\u20B9)</Label><Input name="totalBudget" type="number" min={0} defaultValue={order.totalBudget} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" name="gstEnabled" defaultChecked={!!order.gstEnabled} className="h-4 w-4 accent-kp-primary" />
          GST Invoice
        </label>
        <div><Label>Event Address</Label><textarea name="address" defaultValue={order.address ?? ""} rows={2} className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none" /></div>
        <div><Label>Billing Address</Label><textarea name="billingAddress" defaultValue={order.billingAddress ?? ""} rows={2} className="glass-input w-full rounded-lg px-3 py-2 text-sm outline-none" /></div>
        {error && <p className="text-sm text-kp-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving\u2026" : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
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
