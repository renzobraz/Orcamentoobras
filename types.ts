
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

export interface ProjectData {
  id?: string;
  created_at?: string;
  name: string;
  type: ProjectType;
  standard: StandardType;
  area: number;
  cubValue: number;
  landValue: number;
  foundationCost: number;
  documentationCost: number;
  marketingCost: number;
  unitPrice: number;
  totalUnits: number;
  otherCosts: number;
  useDetailedCosts: boolean;
  detailedCosts: DetailedCosts;
  // Novos campos
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
  constructionTime: number; // Prazo estimado em meses
  breakdown: {
    category: string;
    value: number;
    percentage: number;
  }[];
  cashFlow: {
    month: number;
    value: number;
  }[];
}
