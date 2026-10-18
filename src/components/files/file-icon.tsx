import {
  File as FileIcon,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  Image as ImageIcon,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { fileKind, type FileKind } from "@/lib/format";
import type { Item } from "@/lib/types";

const MAP: Record<FileKind, { icon: LucideIcon; tone: string }> = {
  folder: { icon: Folder, tone: "bg-volt-500/15 text-volt-300" },
  image: { icon: ImageIcon, tone: "bg-fuchsia-500/12 text-fuchsia-300" },
  pdf: { icon: FileText, tone: "bg-rose-500/12 text-rose-300" },
  code: { icon: FileCode2, tone: "bg-sky2-500/14 text-sky2-400" },
  text: { icon: FileText, tone: "bg-slate-400/12 text-slate-300" },
  archive: { icon: FileArchive, tone: "bg-amber-500/12 text-amber-300" },
  doc: { icon: FileText, tone: "bg-blue-500/14 text-blue-300" },
  sheet: { icon: FileSpreadsheet, tone: "bg-emerald-500/12 text-emerald-300" },
  slides: { icon: Presentation, tone: "bg-orange-500/12 text-orange-300" },
  other: { icon: FileIcon, tone: "bg-slate-400/10 text-slate-300" },
};

type Props = {
  item: Pick<Item, "kind" | "name">;
  /** Taille de la pastille en pixels. */
  size?: number;
};

export function FileTypeIcon({ item, size = 40 }: Props) {
  const { icon: Icon, tone } = MAP[fileKind(item)];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] ${tone}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.8} />
    </span>
  );
}
