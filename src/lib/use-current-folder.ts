"use client";

import { useParams } from "next/navigation";
import { useVault } from "@/components/providers/vault";
import type { Item } from "@/lib/types";

/**
 * Dossier affiché dans l'URL (/fichiers/<id>).
 * Renvoie null à la racine ou si le dossier n'existe pas / est dans la corbeille.
 */
export function useCurrentFolder(): Item | null {
  const params = useParams<{ dossier?: string[] }>();
  const { index } = useVault();
  const id = params?.dossier?.[0];
  if (!id) return null;
  const folder = index.byId.get(id);
  return folder && folder.kind === "folder" && !folder.deleted_at ? folder : null;
}
