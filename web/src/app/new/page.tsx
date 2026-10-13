import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { AppBar } from "@/components/app-bar";
import { NewProject } from "./new-project";

export const metadata: Metadata = { title: "New project" };

export default function Page() {
  return (
    <ClientOnly>
      <div className="shell">
        <AppBar crumbs={[{ label: "Projects", href: "/dashboard" }, { label: "New project" }]} />
        <main className="container"><NewProject /></main>
      </div>
    </ClientOnly>
  );
}
