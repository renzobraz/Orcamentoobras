
-- Criação da tabela de projetos
-- Usamos aspas ("columnName") para forçar o camelCase e casar automaticamente com o TypeScript

create table if not exists public.projects (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Dados Básicos
  "name" text not null,
  "type" text not null,
  "standard" text not null,
  "area" numeric not null default 0,
  
  -- Custos e Valores
  "cubValue" numeric not null default 0,
  "landValue" numeric not null default 0,
  "foundationCost" numeric not null default 0,
  "documentationCost" numeric not null default 0,
  "marketingCost" numeric not null default 0,
  "otherCosts" numeric not null default 0,
  
  -- Premissas de Venda
  "unitPrice" numeric not null default 0,
  "totalUnits" numeric not null default 0,

  -- Dados do Corretor e Observações
  "brokerName" text,
  "brokerPhone" text,
  "observations" text,
  
  -- Custos Detalhados (JSONB para flexibilidade)
  "useDetailedCosts" boolean not null default false,
  "detailedCosts" jsonb
);

-- Habilitar Row Level Security (Segurança a nível de linha)
alter table public.projects enable row level security;

-- Política de Acesso Público (Para teste/desenvolvimento)
-- PERMITE QUE QUALQUER UM LEIA, INSERE, ATUALIZE E DELETE
-- Em produção, você deve restringir isso para usuários autenticados.
create policy "Public Access Policy"
on public.projects
for all
using (true)
with check (true);
