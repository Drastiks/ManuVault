import type { Item, SortDir, SortKey } from "./types";

const UNITS = ["o", "Ko", "Mo", "Go"];

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 o";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: digits })} ${UNITS[unit]}`;
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (withTime ? dateTimeFmt : dateFmt).format(d);
}

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

export function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const diffSec = Math.round((d - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(iso);
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toLowerCase() : "";
}

export type FileKind =
  | "folder"
  | "image"
  | "pdf"
  | "code"
  | "text"
  | "archive"
  | "doc"
  | "sheet"
  | "slides"
  | "other";

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const CODE = new Set([
  "html", "htm", "css", "scss", "js", "mjs", "cjs", "jsx", "ts", "tsx", "json", "py",
  "java", "c", "cpp", "h", "cs", "php", "sql", "sh", "bash", "xml", "yml", "yaml",
  "rb", "go", "rs", "vue", "svelte", "kt", "swift", "lua", "ipynb",
]);
const TEXT = new Set(["txt", "md", "csv", "log", "ini", "toml", "tsv", "rtf"]);
const ARCHIVE = new Set(["zip", "rar", "7z", "tar", "gz", "tgz"]);
const DOC = new Set(["doc", "docx", "odt"]);
const SHEET = new Set(["xls", "xlsx", "ods"]);
const SLIDES = new Set(["ppt", "pptx", "odp"]);

export function fileKind(item: Pick<Item, "kind" | "name">): FileKind {
  if (item.kind === "folder") return "folder";
  const ext = extOf(item.name);
  if (IMAGE.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (CODE.has(ext)) return "code";
  if (TEXT.has(ext)) return "text";
  if (ARCHIVE.has(ext)) return "archive";
  if (DOC.has(ext)) return "doc";
  if (SHEET.has(ext)) return "sheet";
  if (SLIDES.has(ext)) return "slides";
  return "other";
}

export function typeLabel(item: Pick<Item, "kind" | "name">): string {
  if (item.kind === "folder") return "Dossier";
  const ext = extOf(item.name);
  return ext ? ext.toUpperCase() : "Fichier";
}

export type PreviewKind = "image" | "pdf" | "text";

export function previewKind(item: Item): PreviewKind | null {
  if (item.kind !== "file") return null;
  const kind = fileKind(item);
  if (kind === "image") return "image";
  if (kind === "pdf") return "pdf";
  if ((kind === "code" || kind === "text") && item.size <= 1024 * 1024) return "text";
  return null;
}

export function compareItems(key: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return (a: Item, b: Item): number => {
    // Les dossiers passent toujours avant les fichiers.
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    let r = 0;
    if (key === "name") r = a.name.localeCompare(b.name, "fr", { numeric: true, sensitivity: "base" });
    else if (key === "date") r = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    else r = a.size - b.size;
    if (r === 0) r = a.name.localeCompare(b.name, "fr", { numeric: true });
    return r * sign;
  };
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString("fr-FR")} ${n > 1 ? many : one}`;
}
