// src/app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getLogoUrl } from "@/lib/settings";
import { DashboardShell } from "@/components/DashboardShell";
import { logoutAction } from "@/server/auth-actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Defensive: a logo DB read must never break the whole shell.
  let logoUrl: string | null = null;
  try {
    logoUrl = await getLogoUrl();
  } catch {
    logoUrl = null;
  }

  return (
    <DashboardShell role={user.role} name={user.name} logoUrl={logoUrl} logout={logoutAction}>
      {children}
    </DashboardShell>
  );
}
