export type ItemKind = "folder" | "file";

export type Item = {
  id: string;
  parent_id: string | null;
  kind: ItemKind;
  name: string;
  storage_path: string | null;
  size: number;
  mime: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SortKey = "name" | "date" | "size";
export type SortDir = "asc" | "desc";
export type ViewMode = "grid" | "list";

/** Limites de l'offre gratuite Supabase (vérifiées en octobre 2026). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 Mo par fichier
export const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 Go au total
export const BUCKET = "vault";
