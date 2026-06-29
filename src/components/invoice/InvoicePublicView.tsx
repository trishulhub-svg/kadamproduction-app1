// src/components/invoice/InvoicePublicView.tsx
"use client";
import { useState, useEffect } from "react";
import { formatINR, formatDateDMY } from "@/lib/utils";

type OrderData = {
  id: number;
  clientName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactPerson: string | null;
  eventDate: string | null;
  eventCategory: string | null;
  address: string | null;
  billingAddress: string | null;
  totalBudget: number;
  gstEnabled: boolean | null;
  createdAt: string;
};
type InvoiceData = { order: OrderData; orderNum: string; paid: number; grandTotal: number; gstNumber: string; gstPercentage: number; gstAmount: number; total: number; due: number; sameAddress: boolean; billingAddr: string; eventAddr: string };

export function InvoicePublicView({ invoice }: { invoice: InvoiceData }) {
  const { order, orderNum, paid, grandTotal, gstNumber, gstPercentage, gstAmount, total, due, sameAddress, billingAddr, eventAddr } = invoice;
  const [step, setStep] = useState<"checking" | "verify" | "otp" | "view">("checking");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    fetch(`/api/invoice-otp?orderId=${order.id}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setStep(data.verified ? "view" : "verify"))
      .catch(() => setStep("verify"))
      .finally(() => clearTimeout(t));
    return () => { ctrl.abort(); clearTimeout(t); };
  }, [order.id]);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const r = await fetch("/api/invoice-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_otp", orderId: order.id, email: email.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error); setPending(false); return; }
      setStep("otp");
    } catch { setError("Network error. Try again."); }
    setPending(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const r = await fetch("/api/invoice-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", orderId: order.id, email: email.trim(), otp: otp.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error); setPending(false); return; }
      setStep("view");
    } catch { setError("Network error. Try again."); }
    setPending(false);
  }

  if (step === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-800 border-t-transparent" />
      </div>
    );
  }

  if (step === "verify" || step === "otp") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-bold text-gray-900">Kadam Production</h1>
            <p className="mt-1 text-sm text-gray-500">Invoice Access — {orderNum}</p>
          </div>

          {step === "verify" && (
            <form onSubmit={sendOtp} className="space-y-4">
              <p className="text-sm text-gray-600">Enter your email to receive a one-time passcode.</p>
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-800"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={pending} className="h-11 w-full rounded-lg bg-gray-900 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">
                {pending ? "Sending…" : "Send OTP"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verifyOtp} className="space-y-4">
              <p className="text-sm text-gray-600">Enter the 6-digit code sent to <strong>{email}</strong></p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-center text-lg tracking-[8px] outline-none focus:border-gray-800"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={pending || otp.length !== 6} className="h-11 w-full rounded-lg bg-gray-900 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">
                {pending ? "Verifying…" : "View Invoice"}
              </button>
              <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={() => setStep("verify")} className="text-xs text-gray-500 underline hover:text-gray-700">
                  Use a different email
                </button>
                <span className="text-xs text-gray-300">|</span>
                <button type="button" onClick={async () => { setError(""); setPending(true); try { const r = await fetch("/api/invoice-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_otp", orderId: order.id, email: email.trim() }) }); const d = await r.json(); if (!r.ok) setError(d.error); else setError(""); } catch { setError("Network error."); } setPending(false); }} className="text-xs text-gray-500 underline hover:text-gray-700">
                  Resend OTP
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-3 sm:p-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">Invoice — {orderNum}</p>
        <button onClick={() => window.print()} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          Print / Download PDF
        </button>
      </div>

      <div className="print-area rounded-lg border border-gray-800 bg-white p-5 text-black sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 border-b-2 border-black pb-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-wide sm:text-3xl">KADAM PRODUCTION</h1>
            <p className="mt-0.5 text-xs text-gray-500">kadamproduction.in</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-2xl font-black tracking-widest sm:text-3xl">INVOICE</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Order Number</p>
            <p className="text-sm font-bold">{orderNum}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 sm:gap-6">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Bill To</p>
            <p className="font-semibold">{order.clientName}</p>
            {order.contactPhone && <p className="text-gray-700">{order.contactPhone}</p>}
            {order.contactEmail && <p className="text-gray-700">{order.contactEmail}</p>}
            <p className="mt-1 text-gray-700">{billingAddr || eventAddr || "\u2014"}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-gray-700"><span className="text-gray-500">Invoice Date:</span> {formatDateDMY(new Date().toISOString().slice(0, 10))}</p>
            {order.eventDate && <p className="text-gray-700"><span className="text-gray-500">Event Date:</span> {formatDateDMY(order.eventDate)}</p>}
            {order.eventCategory && <p className="text-gray-700"><span className="text-gray-500">Category:</span> {order.eventCategory}</p>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Billing Address</p>
            <p className="text-gray-700">{billingAddr || eventAddr || "\u2014"}</p>
          </div>
          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Event Address</p>
            <p className="text-gray-700">
              {sameAddress ? <span className="italic text-gray-500">Same as billing address</span> : (eventAddr || "\u2014")}
            </p>
          </div>
        </div>

        <table className="mt-6 w-full border border-black text-sm">
          <thead className="bg-black text-white">
            <tr><th className="p-2 text-left text-xs sm:text-sm">Description</th><th className="p-2 text-right text-xs sm:text-sm">Amount</th></tr>
          </thead>
          <tbody>
            <tr className="border-b border-black">
              <td className="p-2 text-xs sm:text-sm">Total Amount</td>
              <td className="p-2 text-right text-xs sm:text-sm">{formatINR(total)}</td>
            </tr>
            {gstPercentage > 0 && (
              <tr className="border-b border-black">
                <td className="p-2 text-xs sm:text-sm">GST ({gstPercentage}%)</td>
                <td className="p-2 text-right text-xs sm:text-sm">{formatINR(gstAmount)}</td>
              </tr>
            )}
            <tr className="border-b border-black">
              <td className="p-2 text-xs sm:text-sm">Advance Paid</td>
              <td className="p-2 text-right text-xs sm:text-sm">{formatINR(paid)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black bg-gray-100">
              <td className="p-2 text-sm font-black sm:text-base">Balance Due</td>
              <td className="p-2 text-right text-sm font-black sm:text-base">{formatINR(due)}</td>
            </tr>
          </tfoot>
        </table>

        {gstNumber && <p className="mt-2 text-xs text-gray-600">GST Number: {gstNumber}</p>}

        <div className="mt-6 border-t border-black pt-4 text-center text-xs text-gray-600">
          <p>Thank you for choosing Kadam Production.</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} Kadam Production — kadamproduction.in</p>
        </div>
      </div>
    </div>
  );
}
