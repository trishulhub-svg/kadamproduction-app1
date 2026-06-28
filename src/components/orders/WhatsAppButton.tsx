// src/components/orders/WhatsAppButton.tsx
"use client";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { formatINR } from "@/lib/utils";

export function WhatsAppButton({
  phone,
  orderNum,
  clientName,
  total,
  paid,
  due,
}: {
  phone: string;
  orderNum: string;
  clientName: string;
  total: number;
  paid: number;
  due: number;
}) {
  function send() {
    const cleaned = phone.replace(/[\s\-+()]/g, "");
    let num = cleaned;
    if (num && !num.startsWith("91") && num.length === 10) num = "91" + num;
    if (!num) {
      alert("No contact phone number on this order.");
      return;
    }
    const msg =
      `Hello ${clientName},\n\n` +
      `Here are your invoice details from Kadam Production:\n` +
      `Order Number: ${orderNum}\n` +
      `Total Amount: ${formatINR(total)}\n` +
      `Advance Paid: ${formatINR(paid)}\n` +
      `Balance Due: ${formatINR(due)}\n\n` +
      `Thank you for choosing Kadam Production.\n` +
      `kadamproduction.in`;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  return (
    <Button variant="success" onClick={send}>
      <MessageCircle className="h-4 w-4" /> WhatsApp
    </Button>
  );
}
