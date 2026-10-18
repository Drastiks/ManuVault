"use client";

import { useState } from "react";
import { AlertCircle, Archive, CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { useVault } from "@/components/providers/vault";
import { formatSize, plural } from "@/lib/format";

/** Panneau flottant : progression réelle des imports et préparation des archives ZIP. */
export function ActivityPanel() {
  const { uploads, zipJob, clearActivity } = useVault();
  const [collapsed, setCollapsed] = useState(false);

  if (!uploads.length && !zipJob) return null;

  const running = uploads.filter((u) => u.status === "uploading" || u.status === "queued").length;
  const done = uploads.filter((u) => u.status === "done").length;
  const errors = uploads.filter((u) => u.status === "error").length;
  const zipRunning = !!zipJob && !zipJob.failed && zipJob.done < zipJob.total;
  const busy = running > 0 || zipRunning;

  const title = busy
    ? running > 0
      ? `Import en cours · ${done} sur ${uploads.length}`
      : "Préparation de l'archive…"
    : errors > 0
      ? `Terminé avec ${plural(errors, "erreur", "erreurs")}`
      : "Terminé";

  return (
    <section
      aria-label="Activité"
      className="fixed bottom-4 right-4 z-[55] w-[calc(100vw-2rem)] max-w-[360px] animate-toast overflow-hidden rounded-xl border border-ink-600 bg-ink-800 shadow-pop"
    >
      <header className="flex items-center gap-2 border-b border-ink-700 px-3.5 py-2.5">
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-volt-400" aria-hidden />
        ) : errors > 0 ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
        )}
        <h2 className="flex-1 truncate text-sm font-medium">{title}</h2>
        <button
          type="button"
          className="icon-btn h-7 w-7"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Déplier le panneau" : "Replier le panneau"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {!busy && (
          <button type="button" className="icon-btn h-7 w-7" onClick={clearActivity} aria-label="Fermer le panneau">
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {!collapsed && (
        <ul className="max-h-60 divide-y divide-ink-700/70 overflow-y-auto">
          {zipJob && (
            <li className="px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-[13px]">
                <Archive className="h-4 w-4 shrink-0 text-volt-300" aria-hidden />
                <span className="flex-1 truncate">{zipJob.label}.zip</span>
                <span className="tabular-nums text-text-faint">
                  {zipJob.failed ? "Échec" : `${zipJob.done}/${zipJob.total}`}
                </span>
              </div>
              {zipJob.failed ? (
                <p className="mt-1 text-xs text-rose-300">{zipJob.failed}</p>
              ) : (
                <Bar ratio={zipJob.total ? zipJob.done / zipJob.total : 0} />
              )}
            </li>
          )}
          {uploads.map((u) => (
            <li key={u.id} className="px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate" title={u.name}>
                  {u.name}
                </span>
                <span className="shrink-0 tabular-nums text-text-faint">
                  {u.status === "done"
                    ? formatSize(u.size)
                    : u.status === "error"
                      ? "Échec"
                      : u.status === "queued"
                        ? "En attente"
                        : `${Math.round(u.progress * 100)} %`}
                </span>
              </div>
              {u.status === "error" ? (
                <p className="mt-1 text-xs text-rose-300">{u.error}</p>
              ) : (
                <Bar ratio={u.status === "done" ? 1 : u.progress} done={u.status === "done"} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Bar({ ratio, done }: { ratio: number; done?: boolean }) {
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-600">
      <div
        className={`h-full rounded-full transition-[width] duration-200 ${done ? "bg-emerald-400" : "bg-volt-500"}`}
        style={{ width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` }}
      />
    </div>
  );
}
