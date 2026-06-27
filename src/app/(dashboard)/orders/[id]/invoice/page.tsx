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
    <div className="mx-auto max-w-3xl p-3 sm:p-8">
      <div className="no-print mb-4 flex justify-end">
        <PrintButton />
      </div>

      <div className="print-area rounded-lg border border-gray-800 bg-white p-5 text-black sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 border-b-2 border-black pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="h-12 w-12 rounded object-contain grayscale sm:h-14 sm:w-14" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-black text-lg font-black text-white sm:h-14 sm:w-14">KP</div>
            )}
            <div>
              <h1 className="text-xl font-black tracking-wide sm:text-2xl">KADAM PRODUCTION</h1>
              <p className="text-[10px] text-gray-600 sm:text-xs">Professional Event Services</p>
              <p className="mt-0.5 text-[10px] text-gray-500">kadamproduction.in</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-2xl font-black tracking-widest sm:text-3xl">INVOICE</p>
            <p className="mt-0.5 text-sm font-semibold">#{invoiceNumber(order.id)}</p>
          </div>
        </div>

        {/* Bill To + Details */}
        <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 sm:gap-6">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Bill To</p>
            <p className="font-semibold">{order.clientName}</p>
            <p className="text-gray-700">{order.contactPhone ?? "\u2014"}</p>
            <p className="text-gray-700">{order.contactEmail ?? "\u2014"}</p>
            <p className="mt-1 text-gray-700">{order.billingAddress ?? order.address ?? "\u2014"}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-gray-700"><span className="text-gray-500">Invoice Date:</span> {formatDateDMY(new Date().toISOString().slice(0, 10))}</p>
            <p className="text-gray-700"><span className="text-gray-500">Event Date:</span> {formatDateDMY(order.eventDate)}</p>
            <p className="text-gray-700"><span className="text-gray-500">Category:</span> {order.eventCategory ?? "Other"}</p>
            <p className="text-gray-700"><span className="text-gray-500">Status:</span> <span className="font-semibold uppercase">{order.status}</span></p>
          </div>
        </div>

        {/* Event Address */}
        <div className="mt-4">
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Event Address</p>
          <p className="text-sm text-gray-700">{order.address ?? "\u2014"}</p>
        </div>

        {/* Financial Table */}
        <table className="mt-6 w-full border border-black text-sm">
          <thead className="bg-black text-white">
            <tr><th className="p-2 text-left text-xs sm:text-sm">Description</th><th className="p-2 text-right text-xs sm:text-sm">Amount</th></tr>
          </thead>
          <tbody>
            <tr className="border-b border-black"><td className="p-2 text-xs sm:text-sm">Event Service \u2014 {order.contactPerson ?? order.clientName}</td><td className="p-2 text-right text-xs sm:text-sm">{formatINR(Number(order.totalBudget))}</td></tr>
            <tr><td className="p-2 text-xs sm:text-sm">Advance / Payments Received</td><td className="p-2 text-right text-xs sm:text-sm">\u2212{formatINR(paid)}</td></tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black bg-gray-100">
              <td className="p-2 text-sm font-black sm:text-base">Balance Due</td>
              <td className="p-2 text-right text-sm font-black sm:text-base">{formatINR(due)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div className="mt-6 border-t border-black pt-4 text-center text-xs text-gray-600">
          <p>Thank you for choosing Kadam Production.</p>
          <p className="mt-1">\u00A9 {new Date().getFullYear()} Kadam Production — <a href="https://kadamproduction.in" target="_blank" rel="noopener noreferrer" className="font-medium underline hover:text-gray-800">kadamproduction.in</a></p>
        </div>
      </div>
    </div>
  );
}
