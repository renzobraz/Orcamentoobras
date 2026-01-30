
-- SCRIPT DE CORREÇÃO E CRIAÇÃO DA TABELA PROJECTS
-- Execute este script no SQL Editor do Supabase para corrigir erros de salvamento.

-- 1. Cria a tabela se ela não existir
create table if not exists public.projects (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "name" text not null,
  "type" text not null,
  "standard" text not null
);

-- 2. Adiciona colunas numéricas/texto básicas (caso não existam)
alter table public.projects add column if not exists "area" numeric default 0;
alter table public.projects add column if not exists "landArea" numeric default 0; -- CORREÇÃO IMPORTANTE
alter table public.projects add column if not exists "cubValue" numeric default 0;
alter table public.projects add column if not exists "landValue" numeric default 0;
alter table public.projects add column if not exists "foundationCost" numeric default 0;
alter table public.projects add column if not exists "documentationCost" numeric default 0;
alter table public.projects add column if not exists "marketingCost" numeric default 0;
alter table public.projects add column if not exists "otherCosts" numeric default 0;
alter table public.projects add column if not exists "unitPrice" numeric default 0;
alter table public.projects add column if not exists "totalUnits" numeric default 0;
alter table public.projects add column if not exists "brokerName" text;
alter table public.projects add column if not exists "brokerPhone" text;
alter table public.projects add column if not exists "observations" text;
alter table public.projects add column if not exists "useDetailedCosts" boolean default false;
alter table public.projects add column if not exists "useSegmentedCosts" boolean default false; -- CORREÇÃO IMPORTANTE

-- 3. ADICIONA AS COLUNAS JSONB (CRÍTICO PARA O DASHBOARD E VIABILIDADE)
-- Se o erro de salvamento persistir, é porque uma destas colunas falta.
alter table public.projects add column if not exists "detailedCosts" jsonb;
alter table public.projects add column if not exists "units" jsonb;
alter table public.projects add column if not exists "zoning" jsonb;
alter table public.projects add column if not exists "media" jsonb;
alter table public.projects add column if not exists "segmentedCosts" jsonb;
alter table public.projects add column if not exists "quickFeasibility" jsonb;
alter table public.projects add column if not exists "financials" jsonb;

-- 4. Configurações de Segurança (RLS)
alter table public.projects enable row level security;

-- Remove política antiga para recriar (evita erro de duplicidade)
drop policy if exists "Public Access Policy" on public.projects;

create policy "Public Access Policy"
on public.projects
for all
using (true)
with check (true);
