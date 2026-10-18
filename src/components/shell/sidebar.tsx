"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  FolderPlus,
  FolderTree,
  FolderUp,
  Clock3,
  Home,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { MenuTrigger, type MenuEntry } from "@/components/ui/pop-menu";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { useCurrentFolder } from "@/lib/use-current-folder";
import { createClient } from "@/lib/supabase/client";
import { formatSize } from "@/lib/format";
import { STORAGE_QUOTA_BYTES } from "@/lib/types";
import { trashRoots } from "@/lib/tree";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean; badge?: number };

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, openDialog, pickFiles, pickFolder, setQuery } = useUi();
  const { usedBytes, index, ready } = useVault();
  const folder = useCurrentFolder();
  const [leaving, setLeaving] = useState(false);

  // Referme le menu mobile après chaque navigation.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const trashCount = ready ? trashRoots(index).length : 0;
  const nav: NavItem[] = [
    { href: "/", label: "Accueil", icon: Home, match: (p) => p === "/" },
    { href: "/fichiers", label: "Tous mes fichiers", icon: FolderTree, match: (p) => p.startsWith("/fichiers") },
    { href: "/recents", label: "Récents", icon: Clock3, match: (p) => p.startsWith("/recents") },
    {
      href: "/corbeille",
      label: "Corbeille",
      icon: Trash2,
      match: (p) => p.startsWith("/corbeille"),
      badge: trashCount,
    },
  ];

  const parentId = folder?.id ?? null;
  const newEntries: MenuEntry[] = [
    { label: "Nouveau dossier", icon: FolderPlus, onSelect: () => openDialog({ type: "newFolder", parentId }) },
    "separator",
    { label: "Importer des fichiers", icon: Upload, onSelect: () => pickFiles(parentId) },
    { label: "Importer un dossier", icon: FolderUp, onSelect: () => pickFolder(parentId) },
  ];

  const ratio = Math.min(1, usedBytes / STORAGE_QUOTA_BYTES);
  const tone = ratio >= 0.95 ? "bg-rose-400" : ratio >= 0.8 ? "bg-amber-400" : "bg-volt-500";

  async function signOut() {
    setLeaving(true);
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade bg-ink-950/70 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-ink-700 bg-ink-900 transition-transform duration-200 ease-out lg:static lg:z-auto lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigation principale"
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-5">
          <Link href="/" className="rounded-lg" aria-label="ManuVault, retour à l'accueil">
            <Logo />
          </Link>
          <button
            type="button"
            className="icon-btn lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <MenuTrigger
            entries={newEntries}
            ariaLabel="Nouveau : dossier ou import"
            className="btn-primary h-10 w-full justify-start gap-2.5 px-3.5"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nouveau
          </MenuTrigger>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Sections">
          {nav.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setQuery("")}
                aria-current={active ? "page" : undefined}
                className={`group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                  active ? "bg-ink-700 text-text" : "text-text-muted hover:bg-ink-800 hover:text-text"
                }`}
              >
                {active && (
                  <span className="absolute -left-3 top-2 h-6 w-[3px] rounded-r-full bg-volt-500" aria-hidden />
                )}
                <n.icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-volt-300" : "text-text-faint group-hover:text-text-muted"}`}
                  aria-hidden
                />
                <span className="flex-1 truncate">{n.label}</span>
                {!!n.badge && (
                  <span className="rounded-full bg-ink-600 px-2 py-0.5 text-xs tabular-nums text-text-muted">
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-ink-700 p-4">
          <div>
            <div className="mb-2 flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-text-muted">Stockage</span>
              <span className="tabular-nums text-text-faint">{Math.round(ratio * 100)} %</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-ink-700"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 100)}
              aria-label="Espace de stockage utilisé"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
                style={{ width: `${Math.max(ratio * 100, usedBytes > 0 ? 1.5 : 0)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-text-faint">
              {formatSize(usedBytes)} utilisés sur {formatSize(STORAGE_QUOTA_BYTES)}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary h-9 flex-1 px-2.5"
              onClick={() => openDialog({ type: "backup" })}
            >
              <DatabaseBackup className="h-4 w-4" aria-hidden />
              Sauvegarde
            </button>
            <button
              type="button"
              className="btn-secondary h-9 w-9 px-0"
              onClick={signOut}
              disabled={leaving}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              {leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
