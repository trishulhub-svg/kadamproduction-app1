// src/app/(dashboard)/orders/[id]/invoice/page.tsx
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { invoiceNumber } from "@/lib/invoice-number";
import { formatINR, formatDateDMY } from "@/lib/utils";
import { PrintButton } from "@/components/orders/PrintButton";
import { getLogoUrl } from "@/lib/settings";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { id } = await params;

  const order = await db.select().from(schema.orders).where(eq(schema.orders.id, Number(id))).limit(1).then((r) => r[0]);
  if (!order) notFound();

  const txns = await db.select().from(schema.finance).where(eq(schema.finance.orderId, Number(id)));
  const paid = txns.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const due = Math.max(0, Number(order.totalBudget) - paid);
  let logoUrl: string | null = null;
  try { logoUrl = await getLogoUrl(); } catch { logoUrl = null; }

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      {/* Improvement #9: strict black & white, no equipment section */}
      <div className="print-area rounded-lg border border-gray-800 bg-white p-8 text-black">
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" className="h-12 w-12 object-contain grayscale" />
            ) : (
              <div className="text-xl font-black tracking-widest">KP</div>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-wide">KADAM PRODUCTION</h1>
              <p className="text-xs">Professional Event Services</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black">INVOICE</p>
            <p className="mt-1 text-sm font-semibold">#{invoiceNumber(order.id)}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-1 font-semibold uppercase text-gray-500">Bill To</p>
            <p className="font-semibold">{order.clientName}</p>
            <p>{order.contactPhone ?? "—"}</p>
            <p>{order.contactEmail ?? "—"}</p>
            <p className="mt-1">{order.billingAddress ?? order.address ?? "—"}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-500">Invoice Date:</span> {formatDateDMY(new Date().toISOString().slice(0, 10))}</p>
            <p><span className="text-gray-500">Event Date:</span> {formatDateDMY(order.eventDate)}</p>
            <p><span className="text-gray-500">Category:</span> {order.eventCategory ?? "Other"}</p>
            <p><span className="text-gray-500">Status:</span> <span className="uppercase">{order.status}</span></p>
          </div>
        </div>

        <div className="mt-6">
          <p className="mb-1 font-semibold uppercase text-gray-500">Event Address</p>
          <p className="text-sm">{order.address ?? "—"}</p>
        </div>

        {/* Financial summary only (equipment section removed per improvement #9) */}
        <table className="mt-8 w-full border border-black text-sm">
          <thead className="bg-black text-white">
            <tr><th className="p-2 text-left">Description</th><th className="p-2 text-right">Amount</th></tr>
          </thead>
          <tbody>
            <tr className="border-b border-black"><td className="p-2">Event Service — {order.contactPerson ?? order.clientName}</td><td className="p-2 text-right">{formatINR(Number(order.totalBudget))}</td></tr>
            <tr><td className="p-2 font-semibold">Advance / Payments Received</td><td className="p-2 text-right">−{formatINR(paid)}</td></tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black bg-gray-100">
              <td className="p-2 text-base font-black">Balance Due</td>
              <td className="p-2 text-right text-base font-black">{formatINR(due)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 border-t border-black pt-4 text-center text-xs text-gray-600">
          <p>Thank you for choosing Kadam Production.</p>
          <p className="mt-1">© {new Date().getFullYear()} Kadam Production / Powered by Trishulhub</p>
        </div>
      </div>
    </div>
  );
}
