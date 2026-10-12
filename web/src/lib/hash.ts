import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { Hex } from "viem";

const CHUNK = 8 * 1024 * 1024; // 8 MB at a time keeps memory flat and the tab responsive

/**
 * SHA-256 of a file, read in chunks. `onProgress` gets 0…1. Yields to the browser between chunks,
 * so a 50 MB video doesn't freeze the page.
 */
export async function fingerprintFile(file: Blob, onProgress?: (done: number) => void, signal?: AbortSignal): Promise<Hex> {
  const hasher = sha256.create();
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const chunk = new Uint8Array(await file.slice(offset, offset + CHUNK).arrayBuffer());
    hasher.update(chunk);
    onProgress?.(Math.min(1, (offset + chunk.length) / file.size));
    await new Promise((r) => setTimeout(r, 0));
  }
  if (file.size === 0) onProgress?.(1);
  return `0x${bytesToHex(hasher.digest())}`;
}
