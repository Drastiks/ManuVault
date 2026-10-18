import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 text-volt-300">
          <Compass className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Page introuvable</h1>
        <p className="mt-2 text-sm text-text-muted">Cette adresse ne mène nulle part dans ManuVault.</p>
        <Link href="/" className="btn-primary mt-6">
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
