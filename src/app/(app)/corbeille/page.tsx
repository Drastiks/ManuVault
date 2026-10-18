import type { Metadata } from "next";
import { TrashView } from "@/components/pages/trash-view";

export const metadata: Metadata = { title: "Corbeille" };

export default function TrashPage() {
  return <TrashView />;
}
