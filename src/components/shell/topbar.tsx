"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronRight,
  LayoutGrid,
  List,
  Menu,
  Search,
  Upload,
  X,
} from "lucide-react";
import { MenuTrigger, type MenuEntry } from "@/components/ui/pop-menu";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { useCurrentFolder } from "@/lib/use-current-folder";
import { pathOf } from "@/lib/tree";
import type { SortKey } from "@/lib/types";

const SORT_LABELS: Record<SortKey, string> = { name: "Nom", date: "Date d'ajout", size: "Taille" };

function pageTitle(pathname: string, searching: boolean): string {
  if (searching) return "Résultats de recherche";
  if (pathname === "/") return "Accueil";
  if (pathname.startsWith("/fichiers")) return "Tous mes fichiers";
  if (pathname.startsWith("/recents")) return "Récents";
  if (pathname.startsWith("/corbeille")) return "Corbeille";
  return "ManuVault";
}

export function Topbar() {
  const pathname = usePathname();
  const { index } = useVault();
  const { query, setQuery, view, setView, sort, setSort, setSidebarOpen, pickFiles } = useUi();
  const folder = useCurrentFolder();
  const searchRef = useRef<HTMLInputElement>(null);

  const searching = query.trim().length > 0;
  const inFiles = pathname.startsWith("/fichiers");
  const showLayoutControls = (inFiles || searching) && !pathname.startsWith("/corbeille");
  const canImport = !pathname.startsWith("/corbeille");

  // Raccourci "/" pour atteindre la recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = useMemo(() => (folder && !searching ? pathOf(index, folder.id) : []), [folder, index, searching]);

  const sortEntries: MenuEntry[] = [
    ...(Object.keys(SORT_LABELS) as SortKey[]).map<MenuEntry>((key) => ({
      label: SORT_LABELS[key],
      icon: sort.key === key ? Check : undefined,
      onSelect: () => setSort({ key, dir: sort.key === key ? sort.dir : key === "name" ? "asc" : "desc" }),
    })),
    "separator",
    {
      label: sort.dir === "asc" ? "Ordre croissant" : "Ordre décroissant",
      icon: sort.dir === "asc" ? ArrowUpAZ : ArrowDownAZ,
      hint: "Inverser",
      onSelect: () => setSort({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" }),
    },
  ];

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-8 lg:min-h-16 lg:flex-nowrap lg:py-0">
        <button
          type="button"
          className="icon-btn -ml-2 lg:hidden"
          onClick={() => setSidebarOpen(true)}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 lg:flex-none lg:basis-[34%]">
          {crumbs.length > 0 ? (
            <nav aria-label="Fil d'Ariane" className="flex min-w-0 items-center gap-1 text-sm">
              <Link
                href="/fichiers"
                className="shrink-0 rounded-md px-1.5 py-0.5 font-medium text-text-muted transition-colors hover:bg-ink-700 hover:text-text"
              >
                Tous mes fichiers
              </Link>
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <span key={c.id} className={`flex min-w-0 items-center gap-1 ${last ? "" : "max-sm:hidden"}`}>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-faint" aria-hidden />
                    {last ? (
                      <h1 className="truncate text-base font-semibold tracking-[-0.01em]" aria-current="page">
                        {c.name}
                      </h1>
                    ) : (
                      <Link
                        href={`/fichiers/${c.id}`}
                        className="truncate rounded-md px-1.5 py-0.5 font-medium text-text-muted transition-colors hover:bg-ink-700 hover:text-text"
                      >
                        {c.name}
                      </Link>
                    )}
                  </span>
                );
              })}
            </nav>
          ) : (
            <h1 className="truncate text-lg font-semibold tracking-[-0.02em]">{pageTitle(pathname, searching)}</h1>
          )}
        </div>

        <div className="order-last w-full lg:order-none lg:w-auto lg:flex-1">
          <div className="relative mx-auto max-w-xl">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  searchRef.current?.blur();
                }
              }}
              placeholder="Rechercher un fichier ou un dossier"
              aria-label="Rechercher par nom"
              className="field h-10 pl-9 pr-14 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                className="icon-btn absolute right-1 top-1"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-ink-600 px-1.5 text-[11px] leading-5 text-text-faint sm:block">
                /
              </kbd>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showLayoutControls && (
            <>
              <MenuTrigger
                entries={sortEntries}
                ariaLabel={`Trier : ${SORT_LABELS[sort.key]}`}
                alignRight
                className="btn-secondary h-9 px-2.5 sm:px-3"
              >
                {sort.dir === "asc" ? (
                  <ArrowUpAZ className="h-4 w-4" aria-hidden />
                ) : (
                  <ArrowDownAZ className="h-4 w-4" aria-hidden />
                )}
                <span className="hidden sm:inline">{SORT_LABELS[sort.key]}</span>
              </MenuTrigger>

              <div className="flex rounded-lg border border-ink-600 bg-ink-800 p-0.5" role="group" aria-label="Affichage">
                {(
                  [
                    ["grid", LayoutGrid, "Grille"],
                    ["list", List, "Liste"],
                  ] as const
                ).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setView(mode)}
                    aria-pressed={view === mode}
                    aria-label={`Vue ${label.toLowerCase()}`}
                    title={`Vue ${label.toLowerCase()}`}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                      view === mode ? "bg-ink-600 text-text" : "text-text-faint hover:text-text"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </>
          )}

          {canImport && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => pickFiles(folder?.id ?? null)}
              aria-label="Importer des fichiers"
            >
              <Upload className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Importer</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
