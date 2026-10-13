import type { Metadata } from "next";
import { ClientOnly } from "@/components/client-only";
import { UploadVersion } from "./upload-version";

export const metadata: Metadata = { title: "Upload version" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientOnly><UploadVersion idText={id} /></ClientOnly>;
}
