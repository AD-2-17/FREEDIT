-- Freedit · Supabase setup. Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
--
-- Who can touch what:
--   * Browsers never talk to the database directly. Every read and write goes through the Freedit server
--     (Next.js API routes), which checks the wallet's signed-in session against the contract on Arc first.
--   * Row Level Security is ON with no policies, so the public "anon" key can read or write nothing.
--   * Money facts (who pays whom, how much, which file was approved) live on Arc, not here.

-- Labels shown in the app: project title and display names. Public (they also appear on the receipt).
create table if not exists public.project_meta (
  chain_id    integer     not null,
  project_id  bigint      not null,
  title       text        check (char_length(title) <= 80),
  editor_name text        check (char_length(editor_name) <= 60),
  client_name text        check (char_length(client_name) <= 60),
  updated_at  timestamptz not null default now(),
  primary key (chain_id, project_id)
);

-- Change-request notes. Only the project's editor and client can read them; on-chain is only keccak256(body).
create table if not exists public.notes (
  chain_id   integer     not null,
  note_hash  text        not null check (note_hash ~ '^0x[0-9a-f]{64}$'),
  project_id bigint      not null,
  body       text        not null check (char_length(body) between 1 and 1000),
  author     text        not null check (author ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  primary key (chain_id, note_hash)
);
create index if not exists notes_by_project on public.notes (chain_id, project_id);

-- Uploaded files. "final" rows are matched to the on-chain fingerprint at download time.
create table if not exists public.files (
  id         bigserial   primary key,
  chain_id   integer     not null,
  project_id bigint      not null,
  version    integer     not null check (version > 0),
  kind       text        not null check (kind in ('preview', 'final')),
  path       text        not null unique,
  file_name  text        not null check (char_length(file_name) <= 200),
  sha256     text        check (sha256 ~ '^0x[0-9a-f]{64}$'),
  size       bigint      not null check (size > 0 and size <= 52428800),
  created_at timestamptz not null default now()
);
create index if not exists files_by_project on public.files (chain_id, project_id, kind);

-- Sign-in nonces already used, so a signed sign-in message can't be replayed (rows older than a day are pruned).
create table if not exists public.siwe_nonces (
  nonce   text        primary key,
  used_at timestamptz not null default now()
);

alter table public.siwe_nonces  enable row level security;
alter table public.project_meta enable row level security;
alter table public.notes        enable row level security;
alter table public.files        enable row level security;

-- Storage buckets, 50 MB per file (the free-plan limit).
--   previews: public. Watermarked clips; their link is recorded on-chain with each version.
--   finals:   private. Released only through 60-second signed links after the contract says "paid".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('previews', 'previews', true,  52428800, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('finals',   'finals',   false, 52428800, null)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
