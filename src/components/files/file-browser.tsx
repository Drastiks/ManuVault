"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  Check,
  Download,
  Eye,
  FolderInput,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { FileTypeIcon } from "@/components/files/file-icon";
import { PopMenu, type MenuEntry } from "@/components/ui/pop-menu";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { childrenOf, pathOf } from "@/lib/tree";
import { compareItems, formatDate, formatSize, plural, previewKind, typeLabel } from "@/lib/format";
import type { Item, SortKey, ViewMode } from "@/lib/types";

type Props = {
  items: Item[];
  /** "normal" : fichiers ; "trash" : corbeille (restaurer / supprimer pour toujours). */
  mode?: "normal" | "trash";
  /** Affiche le dossier parent sous le nom (résultats de recherche, récents). */
  showPath?: boolean;
  /** Garde l'ordre fourni au lieu d'appliquer le tri choisi. */
  keepOrder?: boolean;
  /** Force un affichage (accueil) au lieu de la préférence enregistrée. */
  forceView?: ViewMode;
  /** Désactive les cases à cocher et la barre d'actions groupées. */
  selectable?: boolean;
  /** Colonnes cliquables pour trier (vue liste). */
  sortableHeader?: boolean;
};

export function FileBrowser({
  items,
  mode = "normal",
  showPath = false,
  keepOrder = false,
  forceView,
  selectable = true,
  sortableHeader = false,
}: Props) {
  const router = useRouter();
  const vault = useVault();
  const { index, download, downloadZip, restore } = vault;
  const { view: prefView, sort, setSort, openDialog, setQuery } = useUi();
  const view = forceView ?? prefView;
  const trash = mode === "trash";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; alignRight?: boolean; item: Item } | null>(null);

  const sorted = useMemo(
    () => (keepOrder ? items : [...items].sort(compareItems(sort.key, sort.dir))),
    [items, keepOrder, sort],
  );

  // Retire de la sélection les éléments qui ne sont plus affichés.
  useEffect(() => {
    setSelected((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(items.map((i) => i.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  useEffect(() => {
    if (!selected.size) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"], [role="menu"]')) setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  const selectedItems = useMemo(() => sorted.filter((i) => selected.has(i.id)), [sorted, selected]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const open = useCallback(
    (item: Item) => {
      if (trash) return toggle(item.id);
      if (selected.size > 0 && selectable) return toggle(item.id);
      if (item.kind === "folder") {
        setQuery("");
        router.push(`/fichiers/${item.id}`);
      } else {
        openDialog({ type: "preview", item });
      }
    },
    [trash, selected.size, selectable, toggle, router, setQuery, openDialog],
  );

  const targetsFor = useCallback(
    (item: Item): Item[] => (selected.has(item.id) && selected.size > 1 ? selectedItems : [item]),
    [selected, selectedItems],
  );

  const entriesFor = useCallback(
    (item: Item): MenuEntry[] => {
      const targets = targetsFor(item);
      const multi = targets.length > 1;
      const zipLabel = multi
        ? `manuvault-selection-${new Date().toISOString().slice(0, 10)}`
        : item.name.replace(/\.zip$/i, "") || "archive";

      if (trash) {
        return [
          { label: multi ? `Restaurer (${targets.length})` : "Restaurer", icon: RotateCcw, onSelect: () => void restore(targets) },
          "separator",
          {
            label: multi ? `Supprimer définitivement (${targets.length})` : "Supprimer définitivement",
            icon: Trash2,
            danger: true,
            onSelect: () => openDialog({ type: "purge", items: targets }),
          },
        ];
      }

      const entries: MenuEntry[] = [];
      if (!multi) {
        if (item.kind === "folder")
          entries.push({ label: "Ouvrir", icon: FolderOpen, onSelect: () => open(item) });
        else if (previewKind(item))
          entries.push({ label: "Aperçu", icon: Eye, onSelect: () => openDialog({ type: "preview", item }) });
      }
      if (!multi && item.kind === "file")
        entries.push({ label: "Télécharger", icon: Download, onSelect: () => void download(item) });
      if (multi || item.kind === "folder")
        entries.push({
          label: multi ? `Télécharger en ZIP (${targets.length})` : "Télécharger en ZIP",
          icon: Archive,
          onSelect: () => void downloadZip(targets, zipLabel),
        });
      entries.push("separator");
      if (!multi) entries.push({ label: "Renommer", icon: Pencil, onSelect: () => openDialog({ type: "rename", item }) });
      entries.push({
        label: multi ? `Déplacer (${targets.length})` : "Déplacer",
        icon: FolderInput,
        onSelect: () => openDialog({ type: "move", items: targets }),
      });
      entries.push("separator");
      entries.push({
        label: multi ? `Supprimer (${targets.length})` : "Supprimer",
        icon: Trash2,
        danger: true,
        onSelect: () => openDialog({ type: "trash", items: targets }),
      });
      return entries;
    },
    [targetsFor, trash, restore, openDialog, open, download, downloadZip],
  );

  const parentLabel = useCallback(
    (item: Item): string => {
      const chain = pathOf(index, item.parent_id);
      return chain.length ? chain.map((c) => c.name).join(" / ") : "Tous mes fichiers";
    },
    [index],
  );

  const metaFor = (item: Item) => {
    if (item.kind === "folder") {
      const n = trash ? 0 : childrenOf(index, item.id).length;
      return trash ? "Dossier" : n === 0 ? "Dossier vide" : plural(n, "élément", "éléments");
    }
    return `${typeLabel(item)} · ${formatSize(item.size)}`;
  };

  const dateFor = (item: Item) =>
    trash && item.deleted_at ? `Supprimé le ${formatDate(item.deleted_at)}` : formatDate(item.created_at);

  const openMenuAt = (item: Item, x: number, y: number, alignRight = false) => setMenu({ x, y, alignRight, item });

  const rowProps = (item: Item) => ({
    item,
    selected: selected.has(item.id),
    selectionActive: selected.size > 0,
    selectable: selectable || trash,
    meta: metaFor(item),
    date: dateFor(item),
    path: showPath ? parentLabel(item) : null,
    onOpen: () => open(item),
    onToggle: () => toggle(item.id),
    onMenuButton: (r: DOMRect) => openMenuAt(item, r.right, r.bottom + 6, true),
    onContextMenu: (x: number, y: number) => openMenuAt(item, x, y),
  });

  const allSelected = sorted.length > 0 && selected.size === sorted.length;

  return (
    <>
      {view === "grid" ? (
        <div
          key="grid"
          className="stagger grid grid-cols-[repeat(auto-fill,minmax(172px,1fr))] gap-3.5"
          role="list"
        >
          {sorted.map((item) => (
            <ItemCard key={item.id} {...rowProps(item)} />
          ))}
        </div>
      ) : (
        <div key="list" className="animate-fade overflow-hidden rounded-xl2 border border-ink-700 bg-ink-850" role="list">
          <ListHeader
            sortable={sortableHeader}
            sortKey={sort.key}
            dir={sort.dir}
            onSort={(key) => setSort({ key, dir: sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" })}
            dateLabel={trash ? "Supprimé le" : "Ajouté le"}
          />
          <div className="divide-y divide-ink-700/70">
            {sorted.map((item) => (
              <ItemRow key={item.id} {...rowProps(item)} />
            ))}
          </div>
        </div>
      )}

      {menu && (
        <PopMenu
          x={menu.x}
          y={menu.y}
          alignRight={menu.alignRight}
          entries={entriesFor(menu.item)}
          onClose={() => setMenu(null)}
        />
      )}

      {selectable && selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Actions sur la sélection"
          className="fixed inset-x-3 bottom-4 z-[45] mx-auto flex max-w-fit animate-toast flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-ink-500 bg-ink-800 p-1.5 shadow-pop sm:bottom-6"
        >
          <span className="px-3 text-sm font-medium tabular-nums">
            {plural(selected.size, "sélectionné", "sélectionnés")}
          </span>
          <button
            type="button"
            className="btn-ghost h-8 px-2.5 text-[13px]"
            onClick={() => setSelected(allSelected ? new Set() : new Set(sorted.map((i) => i.id)))}
          >
            <Check className="h-4 w-4" aria-hidden />
            {allSelected ? "Désélectionner" : "Tout sélectionner"}
          </button>
          <span className="mx-0.5 hidden h-5 w-px bg-ink-600 sm:block" aria-hidden />
          {trash ? (
            <>
              <button
                type="button"
                className="btn-ghost h-8 px-2.5 text-[13px]"
                onClick={async () => {
                  if (await restore(selectedItems)) setSelected(new Set());
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Restaurer
              </button>
              <button
                type="button"
                className="btn-ghost h-8 px-2.5 text-[13px] text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                onClick={() => openDialog({ type: "purge", items: selectedItems })}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Supprimer
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn-ghost h-8 px-2.5 text-[13px]"
                onClick={() =>
                  void downloadZip(selectedItems, `manuvault-selection-${new Date().toISOString().slice(0, 10)}`)
                }
              >
                <Archive className="h-4 w-4" aria-hidden />
                ZIP
              </button>
              <button
                type="button"
                className="btn-ghost h-8 px-2.5 text-[13px]"
                onClick={() => openDialog({ type: "move", items: selectedItems })}
              >
                <FolderInput className="h-4 w-4" aria-hidden />
                Déplacer
              </button>
              <button
                type="button"
                className="btn-ghost h-8 px-2.5 text-[13px] text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                onClick={() => openDialog({ type: "trash", items: selectedItems })}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Supprimer
              </button>
            </>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSelected(new Set())}
            aria-label="Annuler la sélection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------- éléments */

type RowProps = {
  item: Item;
  selected: boolean;
  selectionActive: boolean;
  selectable: boolean;
  meta: string;
  date: string;
  path: string | null;
  onOpen: () => void;
  onToggle: () => void;
  onMenuButton: (rect: DOMRect) => void;
  onContextMenu: (x: number, y: number) => void;
};

function Checkbox({ checked, onToggle, label, className = "" }: { checked: boolean; onToggle: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`flex h-[22px] w-[22px] items-center justify-center rounded-md border transition-all duration-150 ${
        checked
          ? "border-volt-500 bg-volt-600 text-white"
          : "border-ink-500 bg-ink-900/90 text-transparent hover:border-volt-400"
      } ${className}`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}

function ItemCard({ item, selected, selectionActive, selectable, meta, date, path, onOpen, onToggle, onMenuButton, onContextMenu }: RowProps) {
  const reveal = selectionActive
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";
  return (
    <div
      role="listitem"
      className={`group relative rounded-xl2 border bg-ink-850 shadow-card transition-[border-color,background-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:bg-ink-800 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.8)] ${
        selected ? "border-volt-500/70 bg-volt-500/[0.07] hover:bg-volt-500/[0.1]" : "border-ink-700 hover:border-ink-500"
      }`}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 rounded-xl2"
        aria-label={`${item.kind === "folder" ? "Ouvrir le dossier" : "Ouvrir"} ${item.name}`}
        onClick={onOpen}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY);
        }}
      />
      <div className="pointer-events-none relative z-[1] flex h-full flex-col p-4">
        <FileTypeIcon item={item} size={44} />
        <p className="mt-4 line-clamp-2 break-words text-sm font-medium leading-snug" title={item.name}>
          {item.name}
        </p>
        {path && <p className="mt-0.5 truncate text-xs text-text-faint">{path}</p>}
        <div className="mt-auto pt-3 text-xs text-text-muted">
          <p className="truncate">{meta}</p>
          <p className="truncate text-text-faint">{date}</p>
        </div>
      </div>

      {selectable && (
        <Checkbox
          checked={selected}
          onToggle={onToggle}
          label={`Sélectionner ${item.name}`}
          className={`absolute left-2.5 top-2.5 z-[2] ${selected ? "opacity-100" : reveal}`}
        />
      )}
      <button
        type="button"
        aria-label={`Actions pour ${item.name}`}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          onMenuButton(e.currentTarget.getBoundingClientRect());
        }}
        className={`icon-btn absolute right-2 top-2 z-[2] bg-ink-850/80 transition-opacity ${reveal}`}
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

function ItemRow({ item, selected, selectionActive, selectable, meta, date, path, onOpen, onToggle, onMenuButton, onContextMenu }: RowProps) {
  const [type, size] = item.kind === "folder" ? [meta, ""] : [typeLabel(item), formatSize(item.size)];
  const reveal = selectionActive
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100";
  return (
    <div
      role="listitem"
      className={`group relative grid grid-cols-[24px_minmax(0,1fr)_32px] items-center gap-3 px-3.5 py-2.5 transition-colors duration-150 md:grid-cols-[24px_minmax(0,1fr)_96px_88px_150px_32px] ${
        selected ? "bg-volt-500/[0.08]" : "hover:bg-ink-800"
      }`}
    >
      <button
        type="button"
        className="absolute inset-0 z-0"
        aria-label={`Ouvrir ${item.name}`}
        onClick={onOpen}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e.clientX, e.clientY);
        }}
      />
      {selectable ? (
        <Checkbox
          checked={selected}
          onToggle={onToggle}
          label={`Sélectionner ${item.name}`}
          className={`relative z-[2] ${selected ? "opacity-100" : reveal}`}
        />
      ) : (
        <span />
      )}

      <div className="pointer-events-none relative z-[1] flex min-w-0 items-center gap-3">
        <FileTypeIcon item={item} size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={item.name}>
            {item.name}
          </p>
          <p className="truncate text-xs text-text-faint md:hidden">
            {meta} · {date}
          </p>
          {path && <p className="hidden truncate text-xs text-text-faint md:block">{path}</p>}
        </div>
      </div>

      <span className="pointer-events-none relative z-[1] hidden truncate text-[13px] text-text-muted md:block">{type}</span>
      <span className="pointer-events-none relative z-[1] hidden text-[13px] tabular-nums text-text-muted md:block">{size}</span>
      <span className="pointer-events-none relative z-[1] hidden truncate text-[13px] text-text-muted md:block">{date}</span>

      <button
        type="button"
        aria-label={`Actions pour ${item.name}`}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          onMenuButton(e.currentTarget.getBoundingClientRect());
        }}
        className={`icon-btn relative z-[2] transition-opacity ${reveal}`}
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

function ListHeader({
  sortable,
  sortKey,
  dir,
  onSort,
  dateLabel,
}: {
  sortable: boolean;
  sortKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  dateLabel: string;
}) {
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  const col = (key: SortKey, label: string) =>
    sortable ? (
      <button
        type="button"
        onClick={() => onSort(key)}
        className={`inline-flex items-center gap-1 rounded-md text-left transition-colors hover:text-text ${sortKey === key ? "text-text" : ""}`}
      >
        {label}
        {sortKey === key && <Arrow className="h-3 w-3" aria-hidden />}
      </button>
    ) : (
      <span>{label}</span>
    );
  return (
    <div className="hidden grid-cols-[24px_minmax(0,1fr)_96px_88px_150px_32px] items-center gap-3 border-b border-ink-700 px-3.5 py-2.5 text-xs font-medium text-text-faint md:grid">
      <span />
      {col("name", "Nom")}
      <span>Type</span>
      {col("size", "Taille")}
      {col("date", dateLabel)}
      <span />
    </div>
  );
}
