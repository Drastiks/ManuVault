"use client";

import { CloudUpload, RefreshCw, WifiOff } from "lucide-react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { ActivityPanel } from "@/components/shell/activity-panel";
import { DialogHost } from "@/components/files/dialogs";
import { SearchResults } from "@/components/files/search-results";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { useCurrentFolder } from "@/lib/use-current-folder";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, loadError, reload } = useVault();
  const { query, dragging } = useUi();
  const folder = useCurrentFolder();
  const searching = query.trim().length > 0;

  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#contenu"
        className="sr-only z-[90] rounded-lg bg-volt-600 px-3 py-2 text-sm text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Aller au contenu
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="contenu" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-8 sm:py-8">
            {!ready ? (
              <LoadingSkeleton />
            ) : loadError ? (
              <LoadError message={loadError} onRetry={() => void reload()} />
            ) : searching ? (
              <SearchResults />
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      <ActivityPanel />
      <DialogHost />

      {dragging && (
        <div
          className="pointer-events-none fixed inset-0 z-[75] flex animate-fade items-center justify-center bg-ink-950/80 p-6 backdrop-blur-sm"
          aria-hidden
        >
          <div className="absolute inset-4 rounded-3xl border-2 border-dashed border-volt-500/70 sm:inset-6" />
          <div className="relative flex flex-col items-center text-center">
            <span className="relative mb-5 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-volt-600 text-white shadow-glow">
              <span className="absolute inset-0 animate-ping rounded-2xl bg-volt-500/40 [animation-duration:1.8s]" />
              <CloudUpload className="relative h-9 w-9" />
            </span>
            <p className="text-xl font-semibold tracking-[-0.02em]">Dépose pour importer</p>
            <p className="mt-1.5 text-sm text-text-muted">
              Dans « {folder ? folder.name : "Tous mes fichiers"} ». Les dossiers sont acceptés.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement de tes fichiers">
      <div className="skeleton mb-6 h-7 w-48" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton h-[148px] rounded-xl2" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md animate-rise text-center">
      <span className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/12 text-rose-300">
        <WifiOff className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold tracking-[-0.01em]">Impossible de charger tes fichiers</h2>
      <p className="mt-2 text-sm text-text-muted">{message}</p>
      <p className="mt-1 text-[13px] text-text-faint">
        Si tu n'as pas ouvert ManuVault depuis une semaine, ton projet Supabase gratuit est peut-être en pause :
        réactive-le depuis le tableau de bord Supabase.
      </p>
      <button type="button" className="btn-primary mt-6" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Réessayer
      </button>
    </div>
  );
}
