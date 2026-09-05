-- task-manager 用 Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行してください。

create extension if not exists pgcrypto;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  tag text,
  date_str text not null,
  time_str text not null,
  duration numeric not null default 0,
  memo text not null default '',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- updated_at を更新のたびに自動更新するトリガー
create or replace function public.tasks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at_trigger on public.tasks;
create trigger tasks_set_updated_at_trigger
before update on public.tasks
for each row execute function public.tasks_set_updated_at();

-- Row Level Security: 自分の行だけ読み書きできるようにする
alter table public.tasks enable row level security;

drop policy if exists "select own tasks" on public.tasks;
create policy "select own tasks" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "insert own tasks" on public.tasks;
create policy "insert own tasks" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own tasks" on public.tasks;
create policy "update own tasks" on public.tasks
  for update using (auth.uid() = user_id);

drop policy if exists "delete own tasks" on public.tasks;
create policy "delete own tasks" on public.tasks
  for delete using (auth.uid() = user_id);

-- 複数端末間でのリアルタイム同期を有効にする
alter publication supabase_realtime add table public.tasks;

-- =========================================================
-- snippets テーブル (全端末で共有するテキストスパンディング設定)
-- =========================================================

create table if not exists public.snippets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trigger text not null,
  expansion text not null default '',
  created_at timestamptz not null default now(),
  constraint snippets_user_trigger_key unique (user_id, trigger)
);

create index if not exists snippets_user_id_idx on public.snippets (user_id);

alter table public.snippets enable row level security;

drop policy if exists "select own snippets" on public.snippets;
create policy "select own snippets" on public.snippets
  for select using (auth.uid() = user_id);

drop policy if exists "insert own snippets" on public.snippets;
create policy "insert own snippets" on public.snippets
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own snippets" on public.snippets;
create policy "update own snippets" on public.snippets
  for update using (auth.uid() = user_id);

drop policy if exists "delete own snippets" on public.snippets;
create policy "delete own snippets" on public.snippets
  for delete using (auth.uid() = user_id);
