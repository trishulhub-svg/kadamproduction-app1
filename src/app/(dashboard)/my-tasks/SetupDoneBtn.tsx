"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { markSetupDone } from "@/server/order-actions";

export function SetupDoneBtn({ orderId, done }: { orderId: number; done: boolean }) {
  const [pending, setPending] = useState(false);
  if (done) {
    return <span className="inline-flex items-center rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">Setup Done ✓</span>;
  }
  async function handle() {
    setPending(true);
    await markSetupDone(orderId);
    setPending(false);
  }
  return (
    <Button variant="success" onClick={handle} disabled={pending}>
      {pending ? "Marking…" : "Mark Setup Done"}
    </Button>
  );
}
