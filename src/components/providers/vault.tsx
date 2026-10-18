"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/providers/toast";
import {
  BUCKET,
  MAX_FILE_BYTES,
  STORAGE_QUOTA_BYTES,
  type Item,
} from "@/lib/types";
import { buildIndex, childrenOf, descendants, isInside, pathOf, uniqueName, type Index } from "@/lib/tree";
import { fileKind, formatSize, plural } from "@/lib/format";

/* ---------------------------------------------------------------- types */

export type UploadStatus = "queued" | "uploading" | "done" | "error";
export type UploadEntry = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0..1
  status: UploadStatus;
  error?: string;
};
export type ZipJob = { label: string; done: number; total: number; failed?: string } | null;

/** Arborescence issue d'un glisser-déposer (fichiers et dossiers). */
export type DropNode = { name: string; file?: File; children?: DropNode[] };

type VaultApi = {
  items: Item[];
  index: Index;
  ready: boolean;
  loadError: string | null;
  usedBytes: number;
  uploads: UploadEntry[];
  zipJob: ZipJob;
  clearActivity: () => void;
  reload: () => Promise<void>;
  validateName: (name: string, parentId: string | null, excludeId?: string) => string | null;
  createFolder: (parentId: string | null, name: string) => Promise<Item | null>;
  uploadFiles: (files: File[], parentId: string | null) => Promise<void>;
  importTree: (nodes: DropNode[], parentId: string | null) => Promise<void>;
  rename: (item: Item, name: string) => Promise<boolean>;
  move: (items: Item[], targetId: string | null) => Promise<boolean>;
  trash: (items: Item[]) => Promise<boolean>;
  restore: (items: Item[]) => Promise<boolean>;
  deleteForever: (items: Item[]) => Promise<boolean>;
  download: (item: Item) => Promise<void>;
  downloadZip: (items: Item[], label: string, withMetadata?: boolean) => Promise<void>;
  signedUrl: (item: Item) => Promise<string | null>;
  exportMetadata: () => void;
};

const VaultContext = createContext<VaultApi | null>(null);

export function useVault(): VaultApi {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault doit être utilisé dans <VaultProvider>");
  return ctx;
}

/* -------------------------------------------------------------- helpers */

const CHUNK = 100;
const ZIP_MAX_BYTES = 400 * 1024 * 1024;

function chunked<T>(list: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function explain(err: unknown): string {
  const e = err as { code?: string; message?: string; statusCode?: string | number } | null;
  const msg = (e?.message ?? "").toString();
  if (e?.code === "23505") return "Un élément porte déjà ce nom dans ce dossier.";
  if (/failed to fetch|networkerror|load failed/i.test(msg))
    return "Connexion impossible. Vérifie ta connexion internet puis réessaie.";
  if (/jwt|expired|not authenticated|invalid claim/i.test(msg))
    return "Ta session a expiré. Recharge la page et reconnecte-toi.";
  if (/row-level security|permission|not authorized|unauthorized/i.test(msg))
    return "Accès refusé. Vérifie que ton e-mail est bien celui configuré dans schema.sql.";
  if (/exceeded|too large|payload/i.test(msg)) return `Le fichier dépasse la limite de ${formatSize(MAX_FILE_BYTES)}.`;
  return msg || "Une erreur inattendue est survenue.";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Envoi réel vers Supabase Storage avec suivi de progression. */
function xhrUpload(
  url: string,
  token: string,
  anonKey: string,
  file: File,
  onProgress: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", "false");
    // Même format d'envoi que la bibliothèque officielle (multipart), avec progression en plus.
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "";
      try {
        message = JSON.parse(xhr.responseText)?.message ?? "";
      } catch {
        /* réponse non JSON */
      }
      if (xhr.status === 413) message = `Le fichier dépasse la limite de ${formatSize(MAX_FILE_BYTES)}.`;
      reject(new Error(message || `Échec de l'envoi (code ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Failed to fetch"));
    xhr.onabort = () => reject(new Error("Envoi annulé."));
    xhr.send(body);
  });
}

/* ------------------------------------------------------------- provider */

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();

  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef<Item[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [zipJob, setZipJob] = useState<ZipJob>(null);

  const index = useMemo(() => buildIndex(items), [items]);

  const commit = useCallback((updater: (prev: Item[]) => Item[]) => {
    itemsRef.current = updater(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const mergeRows = useCallback(
    (rows: Item[]) => {
      if (!rows.length) return;
      const byId = new Map(rows.map((r) => [r.id, r]));
      commit((prev) => {
        const seen = new Set<string>();
        const next = prev.map((it) => {
          const upd = byId.get(it.id);
          if (upd) seen.add(it.id);
          return upd ?? it;
        });
        for (const r of rows) if (!seen.has(r.id)) next.push(r);
        return next;
      });
    },
    [commit],
  );

  const currentIndex = () => buildIndex(itemsRef.current);

  const usedBytes = useMemo(
    () => items.reduce((sum, it) => (it.kind === "file" ? sum + it.size : sum), 0),
    [items],
  );

  /* ---- chargement ---- */

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const all: Item[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("items")
          .select("*")
          .order("created_at", { ascending: true })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...((data ?? []) as Item[]));
        if (!data || data.length < 1000) break;
      }
      commit(() => all);
      setReady(true);
    } catch (err) {
      setLoadError(explain(err));
      setReady(true);
    }
  }, [supabase, commit]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /* ---- validation ---- */

  const validateName = useCallback(
    (name: string, parentId: string | null, excludeId?: string): string | null => {
      const n = name.trim();
      if (!n) return "Le nom ne peut pas être vide.";
      if (n.length > 255) return "Le nom est trop long (255 caractères maximum).";
      if (/[\\/]/.test(n)) return "Le nom ne peut pas contenir / ou \\.";
      if (n === "." || n === "..") return "Ce nom n'est pas autorisé.";
      const clash = childrenOf(currentIndex(), parentId).some(
        (c) => c.id !== excludeId && c.name.toLowerCase() === n.toLowerCase(),
      );
      return clash ? "Un élément porte déjà ce nom dans ce dossier." : null;
    },
    [],
  );

  /* ---- mises à jour par lots ---- */

  const updateMany = useCallback(
    async (ids: string[], patch: Partial<Item>): Promise<Item[]> => {
      const out: Item[] = [];
      for (const part of chunked(ids)) {
        const { data, error } = await supabase.from("items").update(patch).in("id", part).select();
        if (error) throw error;
        out.push(...((data ?? []) as Item[]));
      }
      mergeRows(out);
      return out;
    },
    [supabase, mergeRows],
  );

  /* ---- dossiers ---- */

  const createFolderInternal = useCallback(
    async (parentId: string | null, name: string): Promise<Item> => {
      const { data, error } = await supabase
        .from("items")
        .insert({ parent_id: parentId, kind: "folder", name: name.trim() })
        .select()
        .single();
      if (error) throw error;
      mergeRows([data as Item]);
      return data as Item;
    },
    [supabase, mergeRows],
  );

  const createFolder = useCallback(
    async (parentId: string | null, name: string) => {
      const problem = validateName(name, parentId);
      if (problem) {
        toast.error("Dossier non créé", problem);
        return null;
      }
      try {
        const folder = await createFolderInternal(parentId, name);
        toast.success("Dossier créé", folder.name);
        return folder;
      } catch (err) {
        toast.error("Dossier non créé", explain(err));
        return null;
      }
    },
    [validateName, createFolderInternal, toast],
  );

  /* ---- import ---- */

  const patchUpload = useCallback((id: string, patch: Partial<UploadEntry>) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const runUploads = useCallback(
    async (tasks: { file: File; parentId: string | null }[]) => {
      if (!tasks.length) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Import impossible", "Ta session a expiré. Recharge la page et reconnecte-toi.");
        return;
      }
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const entries: UploadEntry[] = tasks.map((t) => ({
        id: crypto.randomUUID(),
        name: t.file.name,
        size: t.file.size,
        progress: 0,
        status: "queued",
      }));
      setUploads((list) => [...entries, ...list].slice(0, 30));
      let budget = STORAGE_QUOTA_BYTES - itemsRef.current.reduce((s, it) => (it.kind === "file" ? s + it.size : s), 0);

      let ok = 0;
      let failed = 0;
      let cursor = 0;

      const worker = async () => {
        while (cursor < tasks.length) {
          const i = cursor++;
          const { file, parentId } = tasks[i];
          const entry = entries[i];

          if (file.size > MAX_FILE_BYTES) {
            patchUpload(entry.id, { status: "error", error: `Dépasse la limite de ${formatSize(MAX_FILE_BYTES)} par fichier.` });
            failed++;
            continue;
          }
          if (file.size > budget) {
            patchUpload(entry.id, { status: "error", error: "Stockage plein : libère de la place ou vide la corbeille." });
            failed++;
            continue;
          }
          budget -= file.size;

          const id = crypto.randomUUID();
          const path = `${session.user.id}/${id}`;
          patchUpload(entry.id, { status: "uploading" });
          let uploaded = false;
          try {
            await xhrUpload(
              `${baseUrl}/storage/v1/object/${BUCKET}/${path}`,
              session.access_token,
              anonKey,
              file,
              (ratio) => patchUpload(entry.id, { progress: ratio }),
            );
            uploaded = true;

            let row: Item | null = null;
            let lastError: unknown = null;
            for (let attempt = 0; attempt < 3 && !row; attempt++) {
              const name = uniqueName(currentIndex(), parentId, file.name);
              const { data, error } = await supabase
                .from("items")
                .insert({
                  id,
                  parent_id: parentId,
                  kind: "file",
                  name,
                  storage_path: path,
                  size: file.size,
                  mime: file.type || null,
                })
                .select()
                .single();
              if (error) {
                lastError = error;
                if (error.code !== "23505") break;
              } else {
                row = data as Item;
              }
            }
            if (!row) throw lastError ?? new Error("Enregistrement impossible.");
            mergeRows([row]);
            patchUpload(entry.id, { status: "done", progress: 1 });
            ok++;
          } catch (err) {
            if (uploaded) await supabase.storage.from(BUCKET).remove([path]);
            budget += file.size;
            patchUpload(entry.id, { status: "error", error: explain(err) });
            failed++;
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, worker));

      if (failed === 0) toast.success(ok > 1 ? `${ok} fichiers importés` : "Fichier importé", "Enregistré dans ton espace privé.");
      else if (ok === 0) toast.error("Import échoué", "Ouvre le panneau d'activité pour voir la raison.");
      else toast.info(`${plural(ok, "fichier importé", "fichiers importés")}`, `${plural(failed, "échec", "échecs")} : voir le panneau d'activité.`);
    },
    [supabase, toast, mergeRows, patchUpload],
  );

  const uploadFiles = useCallback(
    async (files: File[], parentId: string | null) => {
      await runUploads(files.map((file) => ({ file, parentId })));
    },
    [runUploads],
  );

  const importTree = useCallback(
    async (nodes: DropNode[], parentId: string | null) => {
      const tasks: { file: File; parentId: string | null }[] = [];
      try {
        const walk = async (list: DropNode[], parent: string | null) => {
          for (const node of list) {
            if (node.file) {
              tasks.push({ file: node.file, parentId: parent });
            } else if (node.children) {
              const existing = childrenOf(currentIndex(), parent).find(
                (c) => c.kind === "folder" && c.name.toLowerCase() === node.name.toLowerCase(),
              );
              const folder = existing ?? (await createFolderInternal(parent, node.name));
              await walk(node.children, folder.id);
            }
          }
        };
        await walk(nodes, parentId);
      } catch (err) {
        toast.error("Import du dossier impossible", explain(err));
        return;
      }
      if (!tasks.length) {
        toast.info("Rien à importer", "Les dossiers déposés étaient vides.");
        return;
      }
      await runUploads(tasks);
    },
    [createFolderInternal, runUploads, toast],
  );

  /* ---- renommer / déplacer ---- */

  const rename = useCallback(
    async (item: Item, name: string) => {
      const problem = validateName(name, item.parent_id, item.id);
      if (problem) {
        toast.error("Renommage impossible", problem);
        return false;
      }
      try {
        await updateMany([item.id], { name: name.trim() });
        toast.success("Renommé", name.trim());
        return true;
      } catch (err) {
        toast.error("Renommage impossible", explain(err));
        return false;
      }
    },
    [validateName, updateMany, toast],
  );

  const move = useCallback(
    async (list: Item[], targetId: string | null) => {
      const idx = currentIndex();
      const toMove = list.filter((it) => it.parent_id !== targetId);
      if (!toMove.length) {
        toast.info("Déjà dans ce dossier");
        return false;
      }
      for (const it of toMove) {
        if (it.kind === "folder" && isInside(idx, it.id, targetId)) {
          toast.error("Déplacement impossible", `Impossible de déplacer « ${it.name} » dans lui-même.`);
          return false;
        }
        const clash = childrenOf(idx, targetId).some((c) => c.name.toLowerCase() === it.name.toLowerCase());
        if (clash) {
          toast.error("Déplacement impossible", `La destination contient déjà « ${it.name} ».`);
          return false;
        }
      }
      try {
        await updateMany(
          toMove.map((i) => i.id),
          { parent_id: targetId },
        );
        toast.success(toMove.length > 1 ? `${toMove.length} éléments déplacés` : "Élément déplacé");
        return true;
      } catch (err) {
        toast.error("Déplacement impossible", explain(err));
        return false;
      }
    },
    [updateMany, toast],
  );

  /* ---- corbeille ---- */

  const trash = useCallback(
    async (list: Item[]) => {
      const idx = currentIndex();
      const ids = new Set<string>();
      for (const it of list) {
        ids.add(it.id);
        if (it.kind === "folder") descendants(idx, it.id, false).forEach((d) => ids.add(d.id));
      }
      try {
        await updateMany([...ids], { deleted_at: new Date().toISOString() });
        toast.success(
          list.length > 1 ? `${list.length} éléments placés dans la corbeille` : "Placé dans la corbeille",
          "Tu peux le restaurer depuis la corbeille.",
        );
        return true;
      } catch (err) {
        toast.error("Suppression impossible", explain(err));
        return false;
      }
    },
    [updateMany, toast],
  );

  const restore = useCallback(
    async (list: Item[]) => {
      try {
        for (const root of list) {
          const idx = currentIndex();
          const stamp = root.deleted_at;
          if (!stamp) continue;
          const parent = root.parent_id ? idx.byId.get(root.parent_id) : undefined;
          const parentId = parent && parent.deleted_at ? null : root.parent_id;
          const name = uniqueName(idx, parentId, root.name);
          const rest = descendants(idx, root.id, true).filter((d) => d.deleted_at === stamp);
          await updateMany([root.id], { deleted_at: null, parent_id: parentId, name });
          if (rest.length) await updateMany(rest.map((r) => r.id), { deleted_at: null });
        }
        toast.success(list.length > 1 ? `${list.length} éléments restaurés` : "Élément restauré");
        return true;
      } catch (err) {
        toast.error("Restauration impossible", explain(err));
        return false;
      }
    },
    [updateMany, toast],
  );

  const deleteForever = useCallback(
    async (list: Item[]) => {
      try {
        const idx = currentIndex();
        const removeIds = new Set<string>();
        const paths: string[] = [];
        for (const root of list) {
          const all = [root, ...(root.kind === "folder" ? descendants(idx, root.id, true) : [])];
          for (const it of all) {
            removeIds.add(it.id);
            if (it.kind === "file" && it.storage_path) paths.push(it.storage_path);
          }
        }
        // 1) les vrais fichiers ; 2) seulement ensuite les métadonnées.
        for (const part of chunked(paths)) {
          const { error } = await supabase.storage.from(BUCKET).remove(part);
          if (error) throw error;
        }
        for (const part of chunked(list.map((r) => r.id))) {
          const { error } = await supabase.from("items").delete().in("id", part);
          if (error) throw error;
        }
        commit((prev) => prev.filter((it) => !removeIds.has(it.id)));
        toast.success("Supprimé définitivement", plural(list.length, "élément", "éléments"));
        return true;
      } catch (err) {
        toast.error("Suppression impossible", explain(err));
        return false;
      }
    },
    [supabase, commit, toast],
  );

  /* ---- téléchargements ---- */

  const signedUrl = useCallback(
    async (item: Item) => {
      if (!item.storage_path) return null;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 300);
      if (error || !data) {
        toast.error("Lien indisponible", explain(error));
        return null;
      }
      return data.signedUrl;
    },
    [supabase, toast],
  );

  const download = useCallback(
    async (item: Item) => {
      if (!item.storage_path) return;
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(item.storage_path, 60, { download: item.name });
      if (error || !data) {
        toast.error("Téléchargement impossible", explain(error));
        return;
      }
      triggerDownload(data.signedUrl);
    },
    [supabase, toast],
  );

  const exportMetadata = useCallback(() => {
    const idx = currentIndex();
    const payload = {
      application: "ManuVault",
      exportedAt: new Date().toISOString(),
      note: "Liste de tous les dossiers et fichiers (corbeille comprise). Les fichiers eux-mêmes sont dans l'archive ZIP de sauvegarde.",
      items: itemsRef.current.map((it) => ({
        id: it.id,
        chemin: pathOf(idx, it.id).map((p) => p.name).join("/"),
        type: it.kind === "folder" ? "dossier" : "fichier",
        nom: it.name,
        taille_octets: it.size,
        mime: it.mime,
        ajoute_le: it.created_at,
        modifie_le: it.updated_at,
        dans_la_corbeille: !!it.deleted_at,
        parent_id: it.parent_id,
        chemin_stockage: it.storage_path,
      })),
    };
    saveBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `manuvault-metadonnees-${today()}.json`);
    toast.success("Métadonnées exportées", "Fichier JSON téléchargé.");
  }, [toast]);

  const downloadZip = useCallback(
    async (list: Item[], label: string, withMetadata = false) => {
      if (zipJob && !zipJob.failed && zipJob.done < zipJob.total) {
        toast.info("Une archive est déjà en préparation");
        return;
      }
      const idx = currentIndex();

      // Liste à plat : { chemin dans le ZIP, élément }
      const flat: { zipPath: string; item: Item }[] = [];
      const walk = (item: Item, prefix: string) => {
        const zipPath = prefix + item.name;
        if (item.kind === "folder") {
          flat.push({ zipPath: zipPath + "/", item });
          for (const child of childrenOf(idx, item.id)) walk(child, zipPath + "/");
        } else {
          flat.push({ zipPath, item });
        }
      };
      list.forEach((it) => walk(it, ""));

      const files = flat.filter((f) => f.item.kind === "file" && f.item.storage_path);
      const total = files.reduce((s, f) => s + f.item.size, 0);
      if (!files.length) {
        toast.info("Rien à archiver", "La sélection ne contient aucun fichier.");
        return;
      }
      if (total > ZIP_MAX_BYTES) {
        toast.error(
          "Archive trop volumineuse",
          `Le navigateur ne peut pas assembler plus de ${formatSize(ZIP_MAX_BYTES)} d'un coup. Sélectionne moins de fichiers (total demandé : ${formatSize(total)}).`,
        );
        return;
      }

      setZipJob({ label, done: 0, total: files.length });
      try {
        const { data: urls, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrls(files.map((f) => f.item.storage_path!), 900);
        if (error || !urls) throw error ?? new Error("Liens indisponibles.");
        const urlByPath = new Map(urls.map((u) => [u.path, u.signedUrl]));

        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let finished: () => void = () => {};
        let failed: (e: Error) => void = () => {};
        const done = new Promise<void>((res, rej) => {
          finished = res;
          failed = rej;
        });
        const zip = new Zip((err, chunk, final) => {
          if (err) return failed(err);
          chunks.push(chunk as Uint8Array<ArrayBuffer>);
          if (final) finished();
        });

        for (const f of flat) {
          if (f.item.kind === "folder") {
            const dir = new ZipPassThrough(f.zipPath);
            zip.add(dir);
            dir.push(new Uint8Array(0), true);
          }
        }

        let n = 0;
        for (const f of files) {
          const url = urlByPath.get(f.item.storage_path!);
          if (!url) throw new Error(`Lien introuvable pour « ${f.item.name} ».`);
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Lecture impossible de « ${f.item.name} » (code ${res.status}).`);
          const data = new Uint8Array(await res.arrayBuffer());
          const kind = fileKind(f.item);
          const entry =
            kind === "image" || kind === "pdf" || kind === "archive" || kind === "doc" || kind === "sheet" || kind === "slides"
              ? new ZipPassThrough(f.zipPath)
              : new ZipDeflate(f.zipPath, { level: 6 });
          entry.mtime = new Date(f.item.updated_at).getTime();
          zip.add(entry);
          entry.push(data, true);
          n++;
          setZipJob({ label, done: n, total: files.length });
        }

        if (withMetadata) {
          const meta = new ZipDeflate("_manuvault-metadonnees.json", { level: 6 });
          zip.add(meta);
          const json = JSON.stringify(
            itemsRef.current.map((it) => ({
              chemin: pathOf(idx, it.id).map((p) => p.name).join("/"),
              type: it.kind,
              taille_octets: it.size,
              ajoute_le: it.created_at,
              dans_la_corbeille: !!it.deleted_at,
            })),
            null,
            2,
          );
          meta.push(new TextEncoder().encode(json), true);
        }

        zip.end();
        await done;
        saveBlob(new Blob(chunks, { type: "application/zip" }), `${label}.zip`);
        toast.success("Archive prête", `${plural(files.length, "fichier", "fichiers")} dans ${label}.zip`);
        setZipJob(null);
      } catch (err) {
        const message = explain(err);
        setZipJob({ label, done: 0, total: files.length, failed: message });
        toast.error("Archive impossible", message);
      }
    },
    [supabase, toast, zipJob],
  );

  const clearActivity = useCallback(() => {
    setUploads((list) => list.filter((u) => u.status === "uploading" || u.status === "queued"));
    setZipJob((job) => (job && !job.failed && job.done < job.total ? job : null));
  }, []);

  const value = useMemo<VaultApi>(
    () => ({
      items,
      index,
      ready,
      loadError,
      usedBytes,
      uploads,
      zipJob,
      clearActivity,
      reload,
      validateName,
      createFolder,
      uploadFiles,
      importTree,
      rename,
      move,
      trash,
      restore,
      deleteForever,
      download,
      downloadZip,
      signedUrl,
      exportMetadata,
    }),
    [
      items, index, ready, loadError, usedBytes, uploads, zipJob, clearActivity, reload, validateName,
      createFolder, uploadFiles, importTree, rename, move, trash, restore, deleteForever, download,
      downloadZip, signedUrl, exportMetadata,
    ],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
