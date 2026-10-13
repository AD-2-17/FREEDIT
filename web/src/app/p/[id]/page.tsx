import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { ProjectView } from "./project-view";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Project #${id}` };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientOnly><ProjectView idText={id} /></ClientOnly>;
}
