"use client";

import { useMemo } from "react";
import { CloudUpload, Clock3 } from "lucide-react";
import { EmptyState } from "@/components/files/empty-state";
import { FileBrowser } from "@/components/files/file-browser";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";

export function RecentsView() {
  const { items } = useVault();
  const { pickFiles } = useUi();

  const recent = useMemo(
    () =>
      items
        .filter((i) => i.kind === "file" && !i.deleted_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 50),
    [items],
  );

  if (!recent.length) {
    return (
      <EmptyState
        icon={Clock3}
        title="Rien de récent"
        description="Les fichiers que tu importes apparaîtront ici, du plus récent au plus ancien."
      >
        <button type="button" className="btn-primary" onClick={() => pickFiles(null)}>
          <CloudUpload className="h-4 w-4" aria-hidden />
          Importer des fichiers
        </button>
      </EmptyState>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-text-muted">Les 50 derniers fichiers ajoutés.</p>
      <FileBrowser items={recent} keepOrder showPath />
    </div>
  );
}
