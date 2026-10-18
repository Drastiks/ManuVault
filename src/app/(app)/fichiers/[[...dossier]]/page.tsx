import type { Metadata } from "next";
import { FilesView } from "@/components/pages/files-view";

export const metadata: Metadata = { title: "Tous mes fichiers" };

export default function FilesPage() {
  return <FilesView />;
}
