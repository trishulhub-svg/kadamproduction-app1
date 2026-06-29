// src/app/invoice/[id]/page.tsx — public invoice with OTP verification
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { formatOrderNumber } from "@/lib/invoice-number";
import { formatINR } from "@/lib/utils";
import { getGstSettings } from "@/lib/settings";
import { InvoicePublicView } from "@/components/invoice/InvoicePublicView";

type PageProps = { params: Promise<{ id: string }> };

export default async function PublicInvoicePage({ params }: PageProps) {
  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) notFound();

  const order = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId)).limit(1).then((r) => r[0]);
  if (!order) notFound();

  const txns = await db.select().from(schema.finance).where(eq(schema.finance.orderId, orderId));
  const paid = txns.filter((t) => t.type === "income").reduce((a, t) => a + Number(t.amount), 0);
  const total = Number(order.totalBudget);

  const orderNum = formatOrderNumber(order.id, order.createdAt);
  const billingAddr = (order.billingAddress ?? "").trim();
  const eventAddr = (order.address ?? "").trim();
  const sameAddress = !billingAddr || !eventAddr || billingAddr.toLowerCase() === eventAddr.toLowerCase();
  const showGst = !!order.gstEnabled;

  let gstNumber = "";
  let gstPercentage = 0;
  let gstAmount = 0;
  if (showGst) {
    try { const g = await getGstSettings(); gstNumber = g.number; gstPercentage = g.percentage; gstAmount = Math.round(total * gstPercentage / 100); } catch {}
  }
  const grandTotal = total + gstAmount;
  const due = Math.max(0, grandTotal - paid);

  return (
    <InvoicePublicView
      invoice={{
        order: {
          id: order.id,
          clientName: order.clientName,
          contactEmail: order.contactEmail,
          contactPhone: order.contactPhone,
          contactPerson: order.contactPerson,
          eventDate: order.eventDate,
          eventCategory: order.eventCategory,
          address: order.address,
          billingAddress: order.billingAddress,
          totalBudget: order.totalBudget,
          gstEnabled: order.gstEnabled,
          createdAt: order.createdAt ? order.createdAt.toISOString() : new Date().toISOString(),
        },
        orderNum,
        paid,
        grandTotal,
        gstNumber,
        gstPercentage,
        gstAmount,
        total,
        due,
        sameAddress,
        billingAddr,
        eventAddr,
      }}
    />
  );
}
