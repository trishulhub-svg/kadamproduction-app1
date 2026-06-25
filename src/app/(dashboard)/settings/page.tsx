// src/app/(dashboard)/settings/page.tsx
import { getCurrentUser } from "@/lib/auth";
import { getLogoUrl } from "@/lib/settings";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  let logoUrl: string | null = null;
  try { logoUrl = await getLogoUrl(); } catch { logoUrl = null; }
  return <SettingsView logoUrl={logoUrl} />;
}
