
export enum ProjectType {
  HOUSE = 'Casa',
  BUILDING = 'Prédio'
}

export enum StandardType {
  LOW = 'Baixo',
  NORMAL = 'Normal',
  HIGH = 'Alto'
}

export interface DetailedCosts {
  structure: number;
  masonry: number;
  electrical: number;
  plumbing: number;
  finishing: number;
  roofing: number;
}

// Nova interface para o custo detalhado por setor
export interface SegmentedCosts {
  foundation: { pricePerSqm: number }; // Aplicado sobre a área total
  garage: { area: number; pricePerSqm: number };
  leisure: { area: number; pricePerSqm: number };
  standard: { area: number; pricePerSqm: number }; // Apts Tipo
  penthouse: { area: number; pricePerSqm: number };
}

export interface ApartmentUnit {
  id: string;
  name: string; // Ex: "Tipo A - 2 Quartos"
  quantity: number;
  area: number; // m² privativos
  pricePerSqm: number; // R$/m² de venda
}

export interface ZoningData {
  occupancyRate: number; // Taxa de Ocupação (%)
  utilizationCoefficient: number; // Coeficiente de Aproveitamento
  minSetback: number; // Afastamento Mínimo (m)
  maxHeight: number; // Altura Máxima (m)
  
  // Pavimentos Detalhados
  garageFloors: number; // Garagem
  standardFloors: number; // Pavimentos Tipo
  penthouseFloors: number; // Cobertura
  leisureFloors: number; // Lazer/Comum
}

export interface MediaData {
  locationLink?: string;
  imageUrls: string[]; // URLs de imagens
  projectFiles: string[]; // URLs de PDFs/Projetos
}

// --- NOVOS TIPOS PARA VIABILIDADE RÁPIDA ---
export interface QuickFeasibilityData {
  // Premissas do Terreno
  landArea: number; // m²
  askingPrice: number; // R$
  physicalSwap: number; // % Permuta Física
  financialSwap: number; // % Permuta Financeira
  
  // Premissas do Produto
  constructionPotential: number; // Coeficiente (x)
  efficiency: number; // % Eficiência
  salePricePerSqm: number; // R$/m² Venda
  constructionCostPerSqm: number; // R$/m² Obra
  
  // Configs
  softCostRate: number; // % Despesas/Impostos (Padrão 10%)
  requiredMargin: number; // % Margem desejada (Padrão 20%)
}

// --- PREMISSAS FINANCEIRAS DETALHADAS ---
export interface FinancialAssumptions {
  landCommissionPct: number; // % Comissão na Compra do Terreno (ex: 6%)
  landRegistryPct: number; // % ITBI e Registro (ex: 4%)
  saleCommissionPct: number; // % Comissão de Venda (Stand/Corretor) (ex: 4%)
  taxesPct: number; // % Impostos s/ Venda (RET) (ex: 4.09%)
  marketingSplitLaunch: number; // % do Marketing gasto no Lançamento (ex: 60%)
}

// --- ESTRUTURA DO DASHBOARD ---
export interface DashboardData {
  synthetic: {
    revenue: number;
    landCost: number;
    constructionCost: number;
    expenses: number;
    taxes: number;
    result: number;
  };
  analytical: {
    revenue: { total: number };
    land: { total: number; acquisition: number; commission: number; taxes: number };
    construction: { total: number; direct: number; indirect: number };
    expenses: { total: number; marketingLaunch: number; marketingMaintenance: number; admin: number; sales: number };
    taxes: { total: number };
  };
  kpis: {
    landArea: number;
    builtArea: number;
    privateArea: number;
    efficiency: number;
    occupancy: number; // %
    utilization: number; // x
    vgvPerSqmPrivate: number;
    costPerSqmBuilt: number;
  };
}

export interface ProjectData {
  id?: string;
  created_at?: string;
  name: string;
  type: ProjectType;
  standard: StandardType;
  
  area: number; // Área Total Construída (Global - calculada ou manual)
  landArea: number; // Área do Terreno
  
  // Custos e Valores
  cubValue: number;
  landValue: number;
  foundationCost: number; // Usado no modo simples
  documentationCost: number;
  marketingCost: number;
  otherCosts: number;
  
  // Premissas de Venda (Legado)
  unitPrice: number; 
  totalUnits: number;

  // Novos Campos
  units: ApartmentUnit[];
  zoning: ZoningData;
  media: MediaData;
  
  useDetailedCosts: boolean; // Alterna entre modo simples e detalhado
  detailedCosts: DetailedCosts; // Detalhe por material (Legado/Opcional)
  useSegmentedCosts: boolean; // Novo modo: Detalhe por Tipologia (Garagem, Lazer, etc)
  segmentedCosts: SegmentedCosts;
  
  // Módulo Viabilidade Rápida
  quickFeasibility?: QuickFeasibilityData;
  
  // Módulo Financeiro Avançado
  financials: FinancialAssumptions;

  brokerName?: string;
  brokerPhone?: string;
  observations?: string;
}

export interface CalculationResults {
  constructionCost: number;
  totalCost: number;
  vgv: number;
  profit: number;
  roi: number;
  constructionTime: number; 
  permittedArea: number; // Área permitida pelo zoneamento
  breakdown: {
    category: string;
    value: number;
    percentage: number;
  }[];
  cashFlow: {
    month: number;
    value: number;
  }[];
  // Dados pré-calculados para o Dashboard
  dashboard: DashboardData;
}
