// Server-only settings. Never import this from a "use client" file: the service-role key must not reach browsers.

export const serverEnv = {
  supabaseUrl: process.env.SUPABASE_URL?.trim() || "",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  sessionSecret: process.env.SESSION_SECRET?.trim() || "",
};

/** File storage and shared labels need Supabase; sign-in needs the session secret. */
export const storageConfigured = () => !!(serverEnv.supabaseUrl && serverEnv.supabaseKey && serverEnv.sessionSecret);
export const sessionConfigured = () => serverEnv.sessionSecret.length >= 32;
