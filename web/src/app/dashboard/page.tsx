import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { AppBar } from "@/components/app-bar";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return (
    <ClientOnly>
      <div className="shell">
        <AppBar crumbs={[{ label: "Projects" }]} />
        <main className="container"><Dashboard /></main>
      </div>
    </ClientOnly>
  );
}
