
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Files table
create table public.pdf_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pdf_files enable row level security;
create policy "files_select_own" on public.pdf_files for select using (auth.uid() = user_id);
create policy "files_insert_own" on public.pdf_files for insert with check (auth.uid() = user_id);
create policy "files_update_own" on public.pdf_files for update using (auth.uid() = user_id);
create policy "files_delete_own" on public.pdf_files for delete using (auth.uid() = user_id);
create index pdf_files_user_id_idx on public.pdf_files(user_id, created_at desc);

-- Storage bucket (private)
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

create policy "pdfs_select_own" on storage.objects for select
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs_insert_own" on storage.objects for insert
  with check (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs_update_own" on storage.objects for update
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "pdfs_delete_own" on storage.objects for delete
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
