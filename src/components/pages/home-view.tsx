"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CloudUpload, FolderPlus } from "lucide-react";
import { EmptyState } from "@/components/files/empty-state";
import { FileBrowser } from "@/components/files/file-browser";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { childrenOf } from "@/lib/tree";

export function HomeView() {
  const { items, index } = useVault();
  const { openDialog, pickFiles } = useUi();

  const hasContent = items.some((i) => !i.deleted_at);
  const folders = useMemo(
    () => childrenOf(index, null).filter((i) => i.kind === "folder").sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true })),
    [index],
  );
  const recent = useMemo(
    () =>
      items
        .filter((i) => i.kind === "file" && !i.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8),
    [items],
  );

  if (!hasContent) {
    return (
      <EmptyState
        large
        icon={CloudUpload}
        title="Ton coffre est vide pour l'instant"
        description="Importe tes premiers exercices ou cours. Tu peux aussi glisser des fichiers ou des dossiers n'importe où dans cette fenêtre."
      >
        <button type="button" className="btn-primary btn-lg" onClick={() => pickFiles(null)}>
          <CloudUpload className="h-[18px] w-[18px]" aria-hidden />
          Importer des fichiers
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={() => openDialog({ type: "newFolder", parentId: null })}>
          <FolderPlus className="h-[18px] w-[18px]" aria-hidden />
          Créer un dossier
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">Content de te revoir</h2>
          <p className="mt-1 text-sm text-text-muted">Tes cours et tes exercices, là où tu les as rangés.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => pickFiles(null)}>
          <CloudUpload className="h-4 w-4" aria-hidden />
          Importer un fichier
        </button>
      </div>

      <section aria-labelledby="home-folders">
        <div className="mb-3.5 flex items-center justify-between">
          <h3 id="home-folders" className="text-sm font-medium text-text-muted">
            Dossiers principaux
          </h3>
          <Link
            href="/fichiers"
            className="inline-flex items-center gap-1 rounded-md text-[13px] text-text-muted transition-colors hover:text-volt-300"
          >
            Tout voir
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        {folders.length ? (
          <FileBrowser items={folders} forceView="grid" keepOrder selectable={false} />
        ) : (
          <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <p className="text-sm text-text-muted">Aucun dossier. Range tes fichiers par matière ou par semaine.</p>
            <button type="button" className="btn-secondary" onClick={() => openDialog({ type: "newFolder", parentId: null })}>
              <FolderPlus className="h-4 w-4" aria-hidden />
              Nouveau dossier
            </button>
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="home-recent">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 id="home-recent" className="text-sm font-medium text-text-muted">
              Ajoutés récemment
            </h3>
            <Link
              href="/recents"
              className="inline-flex items-center gap-1 rounded-md text-[13px] text-text-muted transition-colors hover:text-volt-300"
            >
              Tout voir
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <FileBrowser items={recent} forceView="grid" keepOrder showPath selectable={false} />
        </section>
      )}
    </div>
  );
}
