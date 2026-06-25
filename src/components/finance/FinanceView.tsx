// src/components/finance/FinanceView.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { Button, Input, Label, Select, Modal, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { Fab } from "@/components/Fab";
import { createTransaction, deleteTransaction } from "@/server/finance-actions";
import { todayISO, formatDateDMY, formatINR } from "@/lib/utils";

type Tx = { id: number; orderId: number | null; orderLabel: string | null; type: string; category: string; amount: number; description: string | null; date: string | null };

export function FinanceView({ summary, transactions, orders, startDate, endDate }: {
  summary: { totalIncome: number; totalExpenses: number; netProfit: number };
  transactions: Tx[];
  orders: { id: number; clientName: string }[];
  startDate?: string;
  endDate?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  function setRange(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value); else next.delete(key);
    startTransition(() => router.replace(`/finance?${next.toString()}`));
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-gray-900">Finance</h1>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-gray-500">Total Income</p><p className="text-xl font-bold text-kp-success">{formatINR(summary.totalIncome)}</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">Total Expenses</p><p className="text-xl font-bold text-kp-danger">{formatINR(summary.totalExpenses)}</p></Card>
        <Card className="p-4"><p className="text-xs text-gray-500">Net Profit</p><p className="text-xl font-bold text-gray-900">{formatINR(summary.netProfit)}</p></Card>
      </div>

      <Card className="mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Label>Start Date</Label><Input type="date" value={startDate || ""} onChange={(e) => setRange("startDate", e.target.value)} /></div>
        <div className="flex-1"><Label>End Date</Label><Input type="date" value={endDate || ""} onChange={(e) => setRange("endDate", e.target.value)} /></div>
      </Card>

      <Card className="overflow-hidden">
        {transactions.length === 0 ? (
          <EmptyState title="No transactions" hint="Use the + button to add an entry." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Order</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDateDMY(t.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{t.orderLabel ?? "General"}</td>
                    <td className="px-4 py-3 text-gray-900">{t.category}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.type} /></td>
                    <td className={`px-4 py-3 font-semibold ${t.type === "income" ? "text-kp-success" : "text-kp-danger"}`}>{t.type === "income" ? "+" : "−"}{formatINR(t.amount)}</td>
                    <td className="px-4 py-3 text-right"><DelBtn id={t.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Fab onClick={() => setAddOpen(true)} label="Add entry" />
      {addOpen && <AddModal orders={orders} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function AddModal({ orders, onClose }: { orders: { id: number; clientName: string }[]; onClose: () => void }) {
  const [pending, setPending] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const f = new FormData(e.currentTarget);
    await createTransaction({
      orderId: Number(f.get("orderId")) || undefined,
      type: String(f.get("type")) as "income" | "expense",
      category: String(f.get("category")),
      amount: Number(f.get("amount")),
      description: String(f.get("description") || ""),
      date: String(f.get("date")),
    });
    onClose();
  }
  return (
    <Modal open onClose={onClose} title="Add Finance Entry">
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Order (optional)</Label><Select name="orderId" defaultValue=""><option value="">General (no order)</option>{orders.map((o) => <option key={o.id} value={o.id}>#{o.id} {o.clientName}</option>)}</Select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Type</Label><Select name="type" defaultValue="income"><option value="income">Income</option><option value="expense">Expense</option></Select></div>
          <div><Label>Category</Label><Input name="category" placeholder="Advance Payment, Transport…" required defaultValue="Advance Payment" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount (₹)</Label><Input name="amount" type="number" min={0} required /></div>
          <div><Label>Date</Label><Input name="date" type="date" required defaultValue={todayISO()} /></div>
        </div>
        <div><Label>Description</Label><Input name="description" /></div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add Entry"}</Button></div>
      </form>
    </Modal>
  );
}

function DelBtn({ id }: { id: number }) {
  const [pending, setPending] = useState(false);
  return <Button size="sm" variant="danger" disabled={pending} onClick={async () => { if (confirm("Delete this entry?")) { setPending(true); await deleteTransaction(id); } }}>{pending ? "…" : "Delete"}</Button>;
}
