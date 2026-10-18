"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ChevronRight,
  Download,
  FileJson,
  FolderOpen,
  Home,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { FileTypeIcon } from "@/components/files/file-icon";
import { useVault } from "@/components/providers/vault";
import { useUi } from "@/components/providers/ui";
import { childrenOf, descendants, isInside } from "@/lib/tree";
import { formatDate, formatSize, plural, previewKind, typeLabel } from "@/lib/format";
import { STORAGE_QUOTA_BYTES, type Item } from "@/lib/types";

/* ------------------------------------------------------------ aiguillage */

export function DialogHost() {
  const { dialog, closeDialog } = useUi();
  if (!dialog) return null;
  switch (dialog.type) {
    case "newFolder":
      return <NameDialog mode="create" parentId={dialog.parentId} onClose={closeDialog} />;
    case "rename":
      return <NameDialog mode="rename" item={dialog.item} parentId={dialog.item.parent_id} onClose={closeDialog} />;
    case "move":
      return <MoveDialog items={dialog.items} onClose={closeDialog} />;
    case "trash":
      return <TrashDialog items={dialog.items} onClose={closeDialog} />;
    case "purge":
      return <PurgeDialog items={dialog.items} onClose={closeDialog} />;
    case "preview":
      return <PreviewDialog item={dialog.item} onClose={closeDialog} />;
    case "backup":
      return <BackupDialog onClose={closeDialog} />;
  }
}

/* ------------------------------------------------- créer / renommer */

type NameProps =
  | { mode: "create"; parentId: string | null; item?: undefined; onClose: () => void }
  | { mode: "rename"; parentId: string | null; item: Item; onClose: () => void };

function NameDialog(props: NameProps) {
  const { mode, parentId, onClose } = props;
  const { createFolder, rename, validateName } = useVault();
  const initial = props.mode === "rename" ? props.item.name : "";
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const error = useMemo(
    () => validateName(value, parentId, props.mode === "rename" ? props.item.id : undefined),
    [validateName, value, parentId, props],
  );
  const unchanged = mode === "rename" && value.trim() === initial;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (error || busy) return;
    if (unchanged) return onClose();
    setBusy(true);
    const ok = props.mode === "rename" ? await rename(props.item, value) : !!(await createFolder(parentId, value));
    setBusy(false);
    if (ok) onClose();
  }

  const isFile = props.mode === "rename" && props.item.kind === "file";

  return (
    <Modal
      title={mode === "create" ? "Nouveau dossier" : isFile ? "Renommer le fichier" : "Renommer le dossier"}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" form="name-form" className="btn-primary" disabled={busy || (touched && !!error)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {mode === "create" ? "Créer le dossier" : "Renommer"}
          </button>
        </>
      }
    >
      <form id="name-form" onSubmit={submit} noValidate>
        <label htmlFor="item-name" className="field-label">
          Nom
        </label>
        <input
          id="item-name"
          className="field"
          value={value}
          autoComplete="off"
          spellCheck={false}
          placeholder={mode === "create" ? "Ex. : Exercices JavaScript" : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setTouched(true);
          }}
          onFocus={(e) => {
            if (props.mode === "rename" && props.item.kind === "file") {
              const dot = e.target.value.lastIndexOf(".");
              if (dot > 0) e.target.setSelectionRange(0, dot);
              else e.target.select();
            } else e.target.select();
          }}
          aria-invalid={touched && !!error}
          aria-describedby="item-name-error"
        />
        <p id="item-name-error" className="mt-2 min-h-[20px] text-[13px] text-rose-300" role="status">
          {touched && !unchanged ? error : ""}
        </p>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------- déplacer */

function MoveDialog({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const { index, move } = useVault();
  const [target, setTarget] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const out: { id: string | null; name: string; depth: number; disabled: boolean; reason?: string }[] = [];
    const movingIds = new Set(items.filter((i) => i.kind === "folder").map((i) => i.id));
    const currentParent = items[0]?.parent_id ?? null;
    const sameParent = items.every((i) => i.parent_id === currentParent);

    out.push({
      id: null,
      name: "Tous mes fichiers",
      depth: 0,
      disabled: sameParent && currentParent === null,
      reason: "Déjà ici",
    });
    const walk = (parent: string | null, depth: number) => {
      for (const f of childrenOf(index, parent).filter((c) => c.kind === "folder")
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }))) {
        const inside = [...movingIds].some((m) => isInside(index, m, f.id));
        out.push({
          id: f.id,
          name: f.name,
          depth,
          disabled: inside || (sameParent && currentParent === f.id),
          reason: inside ? "Impossible" : "Déjà ici",
        });
        if (!inside) walk(f.id, depth + 1);
      }
    };
    walk(null, 1);
    return out;
  }, [index, items]);

  async function submit() {
    if (target === undefined || busy) return;
    setBusy(true);
    const ok = await move(items, target);
    setBusy(false);
    if (ok) onClose();
  }

  const label = items.length === 1 ? `« ${items[0].name} »` : plural(items.length, "élément", "éléments");

  return (
    <Modal
      title="Déplacer vers…"
      description={`Choisis la destination de ${label}.`}
      onClose={onClose}
      flush
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn-primary" disabled={target === undefined || busy} onClick={submit}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Déplacer ici
          </button>
        </>
      }
    >
      <ul className="max-h-[50dvh] space-y-0.5 overflow-y-auto p-2" role="listbox" aria-label="Dossiers">
        {rows.map((r) => {
          const selected = target === r.id && target !== undefined;
          return (
            <li key={r.id ?? "root"} role="option" aria-selected={selected} aria-disabled={r.disabled}>
              <button
                type="button"
                disabled={r.disabled}
                onClick={() => setTarget(r.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg py-2 pr-3 text-left text-sm transition-colors ${
                  selected
                    ? "bg-volt-500/15 text-text ring-1 ring-inset ring-volt-500/50"
                    : "text-text hover:bg-ink-700 disabled:text-text-faint disabled:hover:bg-transparent"
                }`}
                style={{ paddingLeft: 12 + r.depth * 18 }}
              >
                {r.id === null ? (
                  <Home className="h-4 w-4 shrink-0 text-volt-300" aria-hidden />
                ) : (
                  <FolderOpen className="h-4 w-4 shrink-0 text-volt-300" aria-hidden />
                )}
                <span className="flex-1 truncate">{r.name}</span>
                {r.disabled && <span className="text-xs text-text-faint">{r.reason}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

/* ------------------------------------------------ corbeille / suppression */

function NameList({ items }: { items: Item[] }) {
  const shown = items.slice(0, 4);
  return (
    <ul className="mt-3 space-y-1.5 rounded-lg border border-ink-700 bg-ink-900/70 p-2.5">
      {shown.map((it) => (
        <li key={it.id} className="flex items-center gap-2.5 text-sm">
          <FileTypeIcon item={it} size={24} />
          <span className="truncate">{it.name}</span>
        </li>
      ))}
      {items.length > shown.length && (
        <li className="px-1 text-[13px] text-text-muted">
          et {plural(items.length - shown.length, "autre", "autres")}
        </li>
      )}
    </ul>
  );
}

function TrashDialog({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const { trash, index } = useVault();
  const [busy, setBusy] = useState(false);
  const inner = useMemo(
    () =>
      items.reduce(
        (n, it) => n + (it.kind === "folder" ? descendants(index, it.id, false).length : 0),
        0,
      ),
    [items, index],
  );
  const single = items.length === 1;

  return (
    <Modal
      title={single ? `Supprimer « ${items[0].name} » ?` : `Supprimer ${items.length} éléments ?`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-danger"
            data-autofocus
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await trash(items);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Mettre à la corbeille
          </button>
        </>
      }
    >
      <p className="text-sm text-text-muted">
        {inner > 0
          ? `Ce dossier contient ${plural(inner, "élément", "éléments")}, qui iront aussi à la corbeille. `
          : ""}
        Tu pourras tout restaurer depuis la corbeille tant que tu ne la vides pas.
      </p>
      <NameList items={items} />
    </Modal>
  );
}

function PurgeDialog({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const { deleteForever } = useVault();
  const [busy, setBusy] = useState(false);
  const single = items.length === 1;

  return (
    <Modal
      title={single ? `Supprimer « ${items[0].name} » pour toujours ?` : `Supprimer ${items.length} éléments pour toujours ?`}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const ok = await deleteForever(items);
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Supprimer définitivement
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-[13px] leading-snug text-rose-100">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>Cette action est irréversible : les fichiers sont effacés du stockage et ne pourront pas être récupérés.</p>
      </div>
      <NameList items={items} />
    </Modal>
  );
}

/* ------------------------------------------------------------ aperçu */

function PreviewDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { signedUrl, download } = useVault();
  const kind = previewKind(item);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    (async () => {
      const link = await signedUrl(item);
      if (cancelled) return;
      if (!link) {
        setError("Impossible de charger l'aperçu.");
        return;
      }
      setUrl(link);
      if (kind === "text") {
        try {
          const res = await fetch(link);
          if (!res.ok) throw new Error(String(res.status));
          const content = await res.text();
          if (!cancelled) setText(content);
        } catch {
          if (!cancelled) setError("Impossible de lire ce fichier texte.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item, kind, signedUrl]);

  const loading = !!kind && !error && (!url || (kind === "text" && text === null));

  return (
    <Modal
      title={item.name}
      description={`${typeLabel(item)} · ${formatSize(item.size)} · ajouté le ${formatDate(item.created_at)}`}
      onClose={onClose}
      size="xl"
      flush
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="btn-primary" onClick={() => void download(item)}>
            <Download className="h-4 w-4" aria-hidden />
            Télécharger
          </button>
        </>
      }
    >
      <div className="flex min-h-[320px] items-center justify-center bg-ink-900">
        {!kind && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <FileTypeIcon item={item} size={56} />
            <p className="mt-4 text-sm font-medium">Pas d'aperçu pour ce type de fichier</p>
            <p className="mt-1 text-[13px] text-text-muted">
              {item.size > 1024 * 1024 && (item.name.match(/\.(txt|md|html|css|js|py|json)$/i))
                ? "Ce fichier texte dépasse 1 Mo : télécharge-le pour l'ouvrir."
                : "Télécharge-le pour l'ouvrir dans l'application adaptée."}
            </p>
          </div>
        )}
        {error && <p className="px-6 py-16 text-sm text-rose-300">{error}</p>}
        {loading && <Loader2 className="h-6 w-6 animate-spin text-volt-400" aria-label="Chargement de l'aperçu" />}
        {!error && url && kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={item.name} className="max-h-[68dvh] w-auto max-w-full object-contain p-4" />
        )}
        {!error && url && kind === "pdf" && (
          <div className="flex h-[68dvh] w-full flex-col">
            <iframe src={url} title={item.name} className="h-full w-full flex-1 bg-white" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-t border-ink-700 px-4 py-2 text-center text-[13px] text-volt-300 hover:text-volt-400"
            >
              L'aperçu ne s'affiche pas ? Ouvrir le PDF dans un nouvel onglet
            </a>
          </div>
        )}
        {!error && kind === "text" && text !== null && (
          <pre className="max-h-[68dvh] w-full overflow-auto p-5 font-mono text-[13px] leading-relaxed text-text">
            {text.length ? text : "(fichier vide)"}
          </pre>
        )}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------- sauvegarde */

function BackupDialog({ onClose }: { onClose: () => void }) {
  const { index, items, usedBytes, downloadZip, exportMetadata, zipJob } = useVault();
  const roots = childrenOf(index, null);
  const filesCount = items.filter((i) => i.kind === "file" && !i.deleted_at).length;
  const busy = !!zipJob && !zipJob.failed && zipJob.done < zipJob.total;

  return (
    <Modal
      title="Sauvegarde et export"
      description="Garde une copie de tes fichiers sur ton ordinateur."
      onClose={onClose}
      size="md"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Fermer
        </button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-volt-500/15 text-volt-300">
              <Archive className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Tout télécharger en ZIP</p>
              <p className="mt-0.5 text-[13px] text-text-muted">
                {plural(filesCount, "fichier", "fichiers")} avec l'arborescence de tes dossiers, plus la liste des
                métadonnées. Hors corbeille.
              </p>
              <button
                type="button"
                className="btn-primary mt-3"
                disabled={busy || filesCount === 0}
                onClick={() => void downloadZip(roots, `manuvault-sauvegarde-${new Date().toISOString().slice(0, 10)}`, true)}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
                {busy ? "Préparation…" : "Créer la sauvegarde"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-ink-700 bg-ink-900/70 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky2-500/14 text-sky2-400">
              <FileJson className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Exporter les métadonnées</p>
              <p className="mt-0.5 text-[13px] text-text-muted">
                Un fichier JSON avec les noms, chemins, tailles et dates de tout ce que contient ton espace.
              </p>
              <button type="button" className="btn-secondary mt-3" onClick={exportMetadata}>
                <Download className="h-4 w-4" aria-hidden />
                Exporter en JSON
              </button>
            </div>
          </div>
        </div>

        <p className="flex items-start gap-2 text-[13px] leading-snug text-text-muted">
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-faint" aria-hidden />
          Il n'y a pas de sauvegarde automatique : fais cette sauvegarde de temps en temps. Espace utilisé :{" "}
          {formatSize(usedBytes)} sur {formatSize(STORAGE_QUOTA_BYTES)}. Pour restaurer, importe le contenu du ZIP
          décompressé (voir le README).
        </p>
      </div>
    </Modal>
  );
}
