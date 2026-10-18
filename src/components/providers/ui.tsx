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
import { useToast } from "@/components/providers/toast";
import { useVault, type DropNode } from "@/components/providers/vault";
import { useCurrentFolder } from "@/lib/use-current-folder";
import type { Item, SortDir, SortKey, ViewMode } from "@/lib/types";

export type DialogState =
  | { type: "newFolder"; parentId: string | null }
  | { type: "rename"; item: Item }
  | { type: "move"; items: Item[] }
  | { type: "trash"; items: Item[] }
  | { type: "purge"; items: Item[] }
  | { type: "preview"; item: Item }
  | { type: "backup" };

type UiApi = {
  query: string;
  setQuery: (q: string) => void;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  sort: { key: SortKey; dir: SortDir };
  setSort: (s: { key: SortKey; dir: SortDir }) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  dialog: DialogState | null;
  openDialog: (d: DialogState) => void;
  closeDialog: () => void;
  /** Ouvre le sélecteur de fichiers du système. */
  pickFiles: (parentId: string | null) => void;
  /** Ouvre le sélecteur de dossier du système. */
  pickFolder: (parentId: string | null) => void;
  dragging: boolean;
};

const UiContext = createContext<UiApi | null>(null);

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi doit être utilisé dans <UiProvider>");
  return ctx;
}

const IGNORED_FILES = new Set([".ds_store", "thumbs.db", "desktop.ini"]);
const IGNORED_DIRS = new Set(["node_modules", ".git", "__pycache__", ".venv", "venv", ".next"]);

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function readEntry(entry: FileSystemEntry, ignored: Set<string>): Promise<DropNode | null> {
  if (entry.isFile) {
    if (IGNORED_FILES.has(entry.name.toLowerCase())) return null;
    return { name: entry.name, file: await readFile(entry as FileSystemFileEntry) };
  }
  if (entry.isDirectory) {
    if (IGNORED_DIRS.has(entry.name.toLowerCase())) {
      ignored.add(entry.name);
      return null;
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: DropNode[] = [];
    for (;;) {
      const batch = await readBatch(reader);
      if (!batch.length) break;
      for (const child of batch) {
        const node = await readEntry(child, ignored);
        if (node) children.push(node);
      }
    }
    return { name: entry.name, children };
  }
  return null;
}

/** Reconstruit une arborescence à partir de webkitRelativePath (sélecteur de dossier). */
function treeFromFiles(files: File[], ignored: Set<string>): DropNode[] {
  const root: DropNode[] = [];
  for (const file of files) {
    if (IGNORED_FILES.has(file.name.toLowerCase())) continue;
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const parts = rel.split("/").filter(Boolean);
    const skip = parts.slice(0, -1).find((p) => IGNORED_DIRS.has(p.toLowerCase()));
    if (skip) {
      ignored.add(skip);
      continue;
    }
    let level = root;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        level.push({ name: file.name, file });
      } else {
        let dir = level.find((n) => n.children && n.name === part);
        if (!dir) {
          dir = { name: part, children: [] };
          level.push(dir);
        }
        level = dir.children!;
      }
    });
  }
  return root;
}

export function UiProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { uploadFiles, importTree } = useVault();
  const currentFolder = useCurrentFolder();
  const currentFolderId = currentFolder?.id ?? null;
  const folderRef = useRef<string | null>(null);
  folderRef.current = currentFolderId;

  const [query, setQuery] = useState("");
  const [view, setViewState] = useState<ViewMode>("grid");
  const [sort, setSortState] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  // Préférences d'affichage mémorisées dans ce navigateur (aucune donnée de fichier).
  useEffect(() => {
    try {
      const v = localStorage.getItem("manuvault:view");
      if (v === "grid" || v === "list") setViewState(v);
      const s = JSON.parse(localStorage.getItem("manuvault:sort") ?? "null");
      if (s && ["name", "date", "size"].includes(s.key) && ["asc", "desc"].includes(s.dir)) setSortState(s);
    } catch {
      /* stockage indisponible : on garde les valeurs par défaut */
    }
  }, []);

  const setView = useCallback((v: ViewMode) => {
    setViewState(v);
    try {
      localStorage.setItem("manuvault:view", v);
    } catch {
      /* ignoré */
    }
  }, []);

  const setSort = useCallback((s: { key: SortKey; dir: SortDir }) => {
    setSortState(s);
    try {
      localStorage.setItem("manuvault:sort", JSON.stringify(s));
    } catch {
      /* ignoré */
    }
  }, []);

  const openDialog = useCallback((d: DialogState) => setDialog(d), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const pickFiles = useCallback((parentId: string | null) => {
    target.current = parentId;
    fileInput.current?.click();
  }, []);
  const pickFolder = useCallback((parentId: string | null) => {
    target.current = parentId;
    folderInput.current?.click();
  }, []);

  const reportIgnored = useCallback(
    (ignored: Set<string>) => {
      if (ignored.size)
        toast.info("Dossiers ignorés", `${[...ignored].join(", ")} : dossiers techniques, à garder sur GitHub.`);
    },
    [toast],
  );

  /* ---- glisser-déposer dans toute la fenêtre ---- */
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      const parentId = folderRef.current;

      // Les entrées doivent être lues pendant l'événement, avant tout "await".
      const entries = Array.from(dt.items ?? [])
        .map((it) => (typeof it.webkitGetAsEntry === "function" ? it.webkitGetAsEntry() : null))
        .filter((x): x is FileSystemEntry => !!x);
      const plainFiles = Array.from(dt.files);

      void (async () => {
        if (entries.length) {
          try {
            const ignored = new Set<string>();
            const nodes: DropNode[] = [];
            for (const entry of entries) {
              const node = await readEntry(entry, ignored);
              if (node) nodes.push(node);
            }
            reportIgnored(ignored);
            await importTree(nodes, parentId);
          } catch {
            toast.error("Dépôt impossible", "Le navigateur n'a pas pu lire ces éléments. Utilise le bouton Importer.");
          }
        } else if (plainFiles.length) {
          await uploadFiles(plainFiles, parentId);
        }
      })();
    };

    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [importTree, uploadFiles, reportIgnored, toast]);

  const value = useMemo<UiApi>(
    () => ({
      query,
      setQuery,
      view,
      setView,
      sort,
      setSort,
      sidebarOpen,
      setSidebarOpen,
      dialog,
      openDialog,
      closeDialog,
      pickFiles,
      pickFolder,
      dragging,
    }),
    [query, view, setView, sort, setSort, sidebarOpen, dialog, openDialog, closeDialog, pickFiles, pickFolder, dragging],
  );

  return (
    <UiContext.Provider value={value}>
      {children}
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void uploadFiles(files, target.current);
        }}
      />
      <input
        ref={folderInput}
        type="file"
        hidden
        tabIndex={-1}
        // @ts-expect-error attribut non standard mais supporté par tous les navigateurs modernes
        webkitdirectory=""
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!files.length) return;
          const ignored = new Set<string>();
          const nodes = treeFromFiles(files, ignored);
          reportIgnored(ignored);
          void importTree(nodes, target.current);
        }}
      />
    </UiContext.Provider>
  );
}
