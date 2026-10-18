-- ============================================================================
--  ManuVault : script d'initialisation Supabase
--
--  OÙ L'EXÉCUTER : tableau de bord Supabase > "SQL Editor" > "New query"
--  puis colle tout ce fichier et clique sur "Run".
--
--  AVANT DE LANCER : remplace l'adresse e-mail ci-dessous (ligne marquée
--  "À MODIFIER") par la tienne. Elle est la SEULE à pouvoir lire ou écrire.
--  Le script peut être relancé sans danger (il ne supprime aucune donnée).
-- ============================================================================

-- 1. Qui est le propriétaire ? ------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = lower('axelchau0@gmail.com')
$$;

-- 2. Table des dossiers et fichiers (métadonnées) ---------------------------
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid(),
  parent_id    uuid references public.items (id) on delete cascade,
  kind         text not null check (kind in ('folder', 'file')),
  name         text not null check (char_length(name) between 1 and 255),
  storage_path text,             -- chemin dans le bucket (fichiers seulement)
  size         bigint not null default 0 check (size >= 0),
  mime         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,      -- non nul = dans la corbeille
  constraint file_has_path check (kind = 'folder' or storage_path is not null)
);

create index if not exists items_parent_idx  on public.items (parent_id);
create index if not exists items_created_idx on public.items (created_at desc);

-- Deux éléments actifs ne peuvent pas porter le même nom dans un même dossier.
create unique index if not exists items_unique_name
  on public.items (
    coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  where deleted_at is null;

-- Met à jour "updated_at" automatiquement.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_touch on public.items;
create trigger items_touch
  before update on public.items
  for each row execute function public.touch_updated_at();

-- 3. Sécurité de la table (RLS) ---------------------------------------------
alter table public.items enable row level security;

revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;

drop policy if exists "owner select" on public.items;
drop policy if exists "owner insert" on public.items;
drop policy if exists "owner update" on public.items;
drop policy if exists "owner delete" on public.items;

create policy "owner select" on public.items
  for select to authenticated using (public.is_owner());
create policy "owner insert" on public.items
  for insert to authenticated with check (public.is_owner());
create policy "owner update" on public.items
  for update to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "owner delete" on public.items
  for delete to authenticated using (public.is_owner());

-- 4. Bucket de stockage PRIVÉ (50 Mo max par fichier = limite du plan gratuit) -
insert into storage.buckets (id, name, public, file_size_limit)
values ('vault', 'vault', false, 52428800)
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800;

-- 5. Sécurité du stockage ----------------------------------------------------
drop policy if exists "vault select" on storage.objects;
drop policy if exists "vault insert" on storage.objects;
drop policy if exists "vault update" on storage.objects;
drop policy if exists "vault delete" on storage.objects;

create policy "vault select" on storage.objects
  for select to authenticated
  using (bucket_id = 'vault' and public.is_owner());
create policy "vault insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vault' and public.is_owner());
create policy "vault update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vault' and public.is_owner())
  with check (bucket_id = 'vault' and public.is_owner());
create policy "vault delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vault' and public.is_owner());

-- Terminé. Aucun accès pour le rôle "anon" (visiteur non connecté).
