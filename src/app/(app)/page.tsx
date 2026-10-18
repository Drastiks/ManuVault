import type { Metadata } from "next";
import { HomeView } from "@/components/pages/home-view";

export const metadata: Metadata = { title: "Accueil" };

export default function HomePage() {
  return <HomeView />;
}
