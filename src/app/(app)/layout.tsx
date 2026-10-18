import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { ToastProvider } from "@/components/providers/toast";
import { VaultProvider } from "@/components/providers/vault";
import { UiProvider } from "@/components/providers/ui";
import { AppShell } from "@/components/shell/app-shell";

// Contrôle d'accès côté serveur, en plus du middleware et des règles RLS.
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowedEmail(user.email)) redirect("/login");

  return (
    <ToastProvider>
      <VaultProvider>
        <UiProvider>
          <AppShell>{children}</AppShell>
        </UiProvider>
      </VaultProvider>
    </ToastProvider>
  );
}
