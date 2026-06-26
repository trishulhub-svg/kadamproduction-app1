// src/app/(dashboard)/inventory/page.tsx
import { getCurrentUser } from "@/lib/auth";
import { listItems } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { InventoryView } from "@/components/inventory/InventoryView";
import { todayISO } from "@/lib/utils";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  const sp = await searchParams;
  const date = sp.date || todayISO();

  const [items, categories, subcategories] = await Promise.all([
    listItems({ onDate: date }),
    db.select().from(schema.categories),
    db.select().from(schema.subcategories),
  ]);

  const total = items.reduce((a, i) => a + i.quantity, 0);
  const available = items.reduce((a, i) => a + i.available, 0);
  const committed = items.reduce((a, i) => a + i.committed, 0);
  const damaged = items.filter((i) => i.status === "damaged").length;

  return (
    <InventoryView
      categories={categories}
      subcategories={subcategories}
      items={items}
      date={date}
      totals={{ total, available, committed, damaged }}
    />
  );
}
