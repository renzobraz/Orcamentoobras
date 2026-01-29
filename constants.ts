
import { StandardType, ProjectType } from './types';

export const DEFAULT_CUB: Record<StandardType, number> = {
  [StandardType.LOW]: 1950.45,
  [StandardType.NORMAL]: 2480.20,
  [StandardType.HIGH]: 3120.90
};

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

  brokerName: '',
  brokerPhone: '',
  observations: ''
};
