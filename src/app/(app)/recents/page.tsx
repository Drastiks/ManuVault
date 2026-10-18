import type { Metadata } from "next";
import { RecentsView } from "@/components/pages/recents-view";

export const metadata: Metadata = { title: "Récents" };

export default function RecentsPage() {
  return <RecentsView />;
}
