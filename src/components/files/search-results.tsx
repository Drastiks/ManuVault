"use client";

import { SearchX } from "lucide-react";
import { useMemo } from "react";
import { EmptyState } from "@/components/files/empty-state";
import { FileBrowser } from "@/components/files/file-browser";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { plural } from "@/lib/format";

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function SearchResults() {
  const { items } = useVault();
  const { query, setQuery } = useUi();
  const q = normalize(query.trim());

  const results = useMemo(
    () => items.filter((i) => !i.deleted_at && normalize(i.name).includes(q)),
    [items, q],
  );

  if (!results.length) {
    return (
      <EmptyState
        icon={SearchX}
        title="Aucun résultat"
        description={`Rien ne correspond à « ${query.trim()} ». Vérifie l'orthographe ou cherche une partie du nom.`}
      >
        <button type="button" className="btn-secondary" onClick={() => setQuery("")}>
          Effacer la recherche
        </button>
      </EmptyState>
    );
  }

  return (
    <div className="animate-fade">
      <p className="mb-4 text-sm text-text-muted">
        {plural(results.length, "résultat", "résultats")} pour « {query.trim()} »
      </p>
      <FileBrowser items={results} showPath sortableHeader />
    </div>
  );
}
