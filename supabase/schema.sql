-- Plataforma Mendonça — sincronização em nuvem (Supabase)
-- Rode este SQL no SQL Editor do projeto xiegypwxoovoijlkwcrb.

create table if not exists public.app_state (
  user_id    text primary key,
  data       jsonb not null,
  rev        bigint not null default 0,
  version    integer not null default 5,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- RLS pública para a chave anon. O app embute a anon key no cliente e faz
-- last-write-wins por `rev`; a tabela guarda o snapshot do dispositivo
-- (user_id = UUID persistido em localStorage).
create policy "app_state_select" on public.app_state for select using (true);
create policy "app_state_insert" on public.app_state for insert with check (true);
create policy "app_state_update" on public.app_state for update using (true);