import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { Receipt } from "./receipt";

export const metadata: Metadata = { title: "Payment receipt" };

export default async function Page({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = await params;
  return <ClientOnly><Receipt tx={tx} /></ClientOnly>;
}
