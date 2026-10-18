"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/files/empty-state";
import { FileBrowser } from "@/components/files/file-browser";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { trashRoots } from "@/lib/tree";
import { plural } from "@/lib/format";

export function TrashView() {
  const { index } = useVault();
  const { openDialog } = useUi();

  const roots = useMemo(
    () => trashRoots(index).sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? "")),
    [index],
  );

  if (!roots.length) {
    return (
      <EmptyState
        icon={Trash2}
        title="La corbeille est vide"
        description="Les éléments que tu supprimes arrivent ici. Tu peux les restaurer tant que tu ne les supprimes pas définitivement."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {plural(roots.length, "élément", "éléments")}. Ils restent ici jusqu'à leur suppression définitive.
        </p>
        <button type="button" className="btn-secondary text-rose-300 hover:text-rose-200" onClick={() => openDialog({ type: "purge", items: roots })}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Vider la corbeille
        </button>
      </div>
      <FileBrowser items={roots} mode="trash" keepOrder />
    </div>
  );
}
