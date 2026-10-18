"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CloudUpload, FolderPlus, FolderX, FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/files/empty-state";
import { FileBrowser } from "@/components/files/file-browser";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { useCurrentFolder } from "@/lib/use-current-folder";
import { childrenOf } from "@/lib/tree";
import { plural } from "@/lib/format";

export function FilesView() {
  const params = useParams<{ dossier?: string[] }>();
  const { index } = useVault();
  const { openDialog, pickFiles } = useUi();
  const folder = useCurrentFolder();
  const requested = params?.dossier?.[0];

  if (requested && !folder) {
    return (
      <EmptyState
        icon={FolderX}
        title="Dossier introuvable"
        description="Ce dossier n'existe plus ou se trouve dans la corbeille."
      >
        <Link href="/fichiers" className="btn-primary">
          <FolderOpen className="h-4 w-4" aria-hidden />
          Tous mes fichiers
        </Link>
      </EmptyState>
    );
  }

  const parentId = folder?.id ?? null;
  const items = childrenOf(index, parentId);

  if (!items.length) {
    return (
      <EmptyState
        icon={FolderOpen}
        title={folder ? "Ce dossier est vide" : "Aucun fichier pour l'instant"}
        description="Glisse des fichiers ou des dossiers dans la fenêtre, ou utilise les boutons ci-dessous."
      >
        <button type="button" className="btn-primary" onClick={() => pickFiles(parentId)}>
          <CloudUpload className="h-4 w-4" aria-hidden />
          Importer des fichiers
        </button>
        <button type="button" className="btn-secondary" onClick={() => openDialog({ type: "newFolder", parentId })}>
          <FolderPlus className="h-4 w-4" aria-hidden />
          Nouveau dossier
        </button>
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-text-muted">{plural(items.length, "élément", "éléments")}</p>
        <button type="button" className="btn-secondary" onClick={() => openDialog({ type: "newFolder", parentId })}>
          <FolderPlus className="h-4 w-4" aria-hidden />
          Nouveau dossier
        </button>
      </div>
      <FileBrowser items={items} sortableHeader />
    </div>
  );
}
