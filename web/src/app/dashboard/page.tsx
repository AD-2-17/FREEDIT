import type { Metadata } from "next";
import { AppBar } from "@/components/app-bar";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return (
    <div className="shell">
      <AppBar crumbs={[{ label: "Projects" }]} />
      <main className="container"><Dashboard /></main>
    </div>
  );
}
