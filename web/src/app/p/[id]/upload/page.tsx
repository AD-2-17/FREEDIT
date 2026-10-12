import type { Metadata } from "next";
import { UploadVersion } from "./upload-version";

export const metadata: Metadata = { title: "Upload version" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UploadVersion idText={id} />;
}
