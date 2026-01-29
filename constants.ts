
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
  cubValue: 2480.20,
  landValue: 1500000,
  foundationCost: 350000,
  documentationCost: 80000,
  marketingCost: 120000,
  unitPrice: 450000,
  totalUnits: 12,
  otherCosts: 50000,
  useDetailedCosts: false,
  detailedCosts: {
    structure: 650,
    masonry: 400,
    electrical: 150,
    plumbing: 120,
    finishing: 850,
    roofing: 250
  },
  brokerName: '',
  brokerPhone: '',
  observations: ''
};
