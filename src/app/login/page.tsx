import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      {/* Halo violet unique, c'est le seul dégradé de l'application */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-18%] h-[520px] w-[860px] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(112,72,245,0.32), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-[400px] animate-rise">
        <div className="mb-8 flex justify-center">
          <Logo size={36} />
        </div>

        <div className="card p-6 sm:p-7">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Ouvre ton coffre</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Tes exercices et tes cours de La Manu, rangés et accessibles partout.
          </p>
          <LoginForm denied={erreur === "refuse"} />
        </div>

        <p className="mt-5 text-center text-[13px] text-text-faint">
          Accès privé. Les inscriptions sont fermées.
        </p>
      </div>
    </main>
  );
}
