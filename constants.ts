
import { StandardType, ProjectType } from './types';

export const DEFAULT_CUB: Record<StandardType, number> = {
  [StandardType.LOW]: 1950.45,
  [StandardType.NORMAL]: 2480.20,
  [StandardType.HIGH]: 3120.90
};

export const SQL_FIX_SCRIPT = `-- SCRIPT DE CORREÇÃO COMPLETO (Rode no Supabase SQL Editor)
-- Atualizado para incluir TODAS as colunas necessárias

-- 1. Cria a tabela base se não existir
create table if not exists public.projects (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "name" text not null,
  "type" text not null,
  "standard" text not null
);

-- 2. Adiciona colunas básicas (ALTER TABLE)
alter table public.projects add column if not exists "area" numeric default 0;
alter table public.projects add column if not exists "landArea" numeric default 0; -- CORREÇÃO: Coluna essencial
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
alter table public.projects add column if not exists "useSegmentedCosts" boolean default false; -- CORREÇÃO: Coluna essencial

-- 3. COLUNAS NOVAS (JSONB)
alter table public.projects add column if not exists "detailedCosts" jsonb;
alter table public.projects add column if not exists "units" jsonb;
alter table public.projects add column if not exists "zoning" jsonb;
alter table public.projects add column if not exists "media" jsonb;
alter table public.projects add column if not exists "segmentedCosts" jsonb;
alter table public.projects add column if not exists "quickFeasibility" jsonb;
alter table public.projects add column if not exists "financials" jsonb;

-- 4. Permissões
alter table public.projects enable row level security;
drop policy if exists "Public Access Policy" on public.projects;
create policy "Public Access Policy" on public.projects for all using (true) with check (true);
`;

export const INITIAL_DATA = {
  name: 'Meu Novo Empreendimento',
  type: ProjectType.BUILDING,
  standard: StandardType.NORMAL,
  
  area: 1200,
  landArea: 600, // Área do Terreno Padrão
  
  cubValue: 2480.20,
  landValue: 1500000,
  foundationCost: 350000,
  documentationCost: 80000,
  marketingCost: 120000,
  unitPrice: 0, 
  totalUnits: 0, 
  otherCosts: 50000,
  
  units: [
    {
      id: '1',
      name: 'Tipo A (2 Quartos)',
      quantity: 10,
      area: 65,
      pricePerSqm: 7500
    }
  ],
  zoning: {
    occupancyRate: 60,
    utilizationCoefficient: 2.5,
    minSetback: 3.0,
    maxHeight: 15.0,
    garageFloors: 1,
    standardFloors: 4,
    penthouseFloors: 0,
    leisureFloors: 1
  },
  media: {
    locationLink: '',
    imageUrls: [],
    projectFiles: []
  },

  useDetailedCosts: false,
  useSegmentedCosts: false, // Inicia falso para manter simplicidade inicial
  
  detailedCosts: {
    structure: 650,
    masonry: 400,
    electrical: 150,
    plumbing: 120,
    finishing: 850,
    roofing: 250
  },

  // Inicialização dos Custos por Tipologia
  segmentedCosts: {
    foundation: { pricePerSqm: 350 },
    garage: { area: 300, pricePerSqm: 1800 },
    leisure: { area: 150, pricePerSqm: 2800 },
    standard: { area: 750, pricePerSqm: 2480 },
    penthouse: { area: 0, pricePerSqm: 3200 }
  },

  // Inicialização Viabilidade Rápida
  quickFeasibility: {
    landArea: 1000,
    askingPrice: 2000000,
    physicalSwap: 0,
    financialSwap: 0,
    constructionPotential: 2.5,
    efficiency: 70,
    salePricePerSqm: 12000,
    constructionCostPerSqm: 5500,
    softCostRate: 10,
    requiredMargin: 20
  },

  // Inicialização Financeiro Detalhado
  financials: {
    landCommissionPct: 6, // 6%
    landRegistryPct: 4, // 4%
    saleCommissionPct: 4, // 4%
    taxesPct: 4.09, // RET
    marketingSplitLaunch: 60, // 60%
    indirectCostsPct: 10 // 10% (Novo campo padrão)
  },

  brokerName: '',
  brokerPhone: '',
  observations: ''
};
