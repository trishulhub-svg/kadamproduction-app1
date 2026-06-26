// src/app/(auth)/login/page.tsx
import { getLogoUrl } from "@/lib/settings";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage() {
  let logoUrl: string | null = null;
  try {
    logoUrl = await getLogoUrl();
  } catch {
    logoUrl = null;
  }
  return <LoginForm logoUrl={logoUrl} />;
}
