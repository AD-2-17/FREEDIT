import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "./env";

let client: SupabaseClient | undefined;

/** Supabase with the service-role key. Server only: it bypasses Row Level Security, so every caller checks access first. */
export function db(): SupabaseClient {
  client ??= createClient(serverEnv.supabaseUrl, serverEnv.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const PREVIEWS = "previews";
export const FINALS = "finals";
export const MAX_FILE_BYTES = 50 * 1024 * 1024; // Supabase free-plan limit (D11); also enforced on the buckets
