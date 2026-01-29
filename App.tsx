
import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { ProjectData, ProjectType, StandardType, CalculationResults, DetailedCosts, ApartmentUnit, SegmentedCosts, QuickFeasibilityData, DashboardData } from './types';
import { DEFAULT_CUB, INITIAL_DATA } from './constants';
import { InputField } from './components/InputSection';
import { analyzeFeasibility } from './services/geminiService';
import { saveProject, fetchProjects, deleteProject, testConnection } from './services/supabaseClient';
import { DashboardSection } from './components/DashboardSection';

// Lazy load heavy components
const CostBreakdownChart = React.lazy(() => import('./components/ChartSection').then(module => ({ default: module.CostBreakdownChart })));
const CashFlowChart = React.lazy(() => import('./components/ChartSection').then(module => ({ default: module.CashFlowChart })));
const SettingsSection = React.lazy(() => import('./components/SettingsSection').then(module => ({ default: module.SettingsSection })));

const App: React.FC = () => {
  const [data, setData] = useState<ProjectData>(INITIAL_DATA);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'inputs' | 'dashboard' | 'history' | 'settings'>('quick');
  const [isDbConnected, setIsDbConnected] = useState(false);
  
  // Estado para cenário de estresse na Viabilidade Rápida
  const [stressTest, setStressTest] = useState(false);

  useEffect(() => {
    checkDbConnection();
    if (activeTab === 'history') {
        loadProjects();
    }
  }, [activeTab]);

  const checkDbConnection = async () => {
    const connected = await testConnection();
    setIsDbConnected(connected);
  };

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const list = await fetchProjects();
      const mergedList = list.map(p => ({
        ...INITIAL_DATA,
        ...p,
        units: p.units || [],
        zoning: { ...INITIAL_DATA.zoning, ...(p.zoning || {}) },
        media: p.media || INITIAL_DATA.media,
        segmentedCosts: p.segmentedCosts || INITIAL_DATA.segmentedCosts,
        quickFeasibility: p.quickFeasibility || INITIAL_DATA.quickFeasibility
      }));
      setProjects(mergedList);
    } catch (e) {
      console.warn("Using local storage fallback.");
      const local = localStorage.getItem('calcconstru_projects');
      if (local) setProjects(JSON.parse(local));
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleNewProject = () => {
    if (confirm("Deseja iniciar um novo empreendimento? Os dados não salvos serão perdidos.")) {
      const newData = { ...INITIAL_DATA, id: undefined, units: [...INITIAL_DATA.units] };
      setData(newData);
      setAiAnalysis('');
      setActiveTab('quick');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const projectToSave = { ...data, id: data.id || crypto.randomUUID() };
      await saveProject(projectToSave);
      setData(projectToSave);
      alert("Projeto salvo com sucesso no Banco de Dados!");
    } catch (e: any) {
      console.error(e);
      const projectToSave = { ...data, id: data.id || crypto.randomUUID() };
      let localProjects = [];
      try { localProjects = JSON.parse(localStorage.getItem('calcconstru_projects') || '[]'); } catch {}
      const newList = [projectToSave, ...localProjects.filter((p: any) => p.id !== projectToSave.id)];
      localStorage.setItem('calcconstru_projects', JSON.stringify(newList));
      setProjects(newList);
      setData(projectToSave);
      alert("Salvo localmente (Offline ou Erro Supabase).");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir este projeto?")) return;
    try {
      await deleteProject(id);
      await loadProjects();
    } catch (e) {
      const newList = projects.filter(p => p.id !== id);
      localStorage.setItem('calcconstru_projects', JSON.stringify(newList));
      setProjects(newList);
    }
  };

  // --- Handlers Detalhados ---
  const addUnit = () => {
    const newUnit: ApartmentUnit = {
      id: crypto.randomUUID(),
      name: 'Novo Tipo',
      quantity: 1,
      area: 50,
      pricePerSqm: 5000
    };
    setData({ ...data, units: [...data.units, newUnit] });
  };

  const updateUnit = (id: string, field: keyof ApartmentUnit, value: any) => {
    setData({
      ...data,
      units: data.units.map(u => u.id === id ? { ...u, [field]: value } : u)
    });
  };

  const updateUnitTotalPrice = (id: string, totalPrice: number) => {
    setData({
      ...data,
      units: data.units.map(u => {
        if (u.id === id) {
           const area = u.area || 1; 
           return { ...u, pricePerSqm: totalPrice / area };
        }
        return u;
      })
    });
  };

  const removeUnit = (id: string) => {
    setData({ ...data, units: data.units.filter(u => u.id !== id) });
  };

  const updateSegmentedCost = (
    type: keyof SegmentedCosts,
    field: 'area' | 'pricePerSqm',
    value: number
  ) => {
    setData({
        ...data,
        segmentedCosts: {
            ...data.segmentedCosts,
            [type]: {
                ...data.segmentedCosts[type],
                [field]: value
            }
        }
    });
  };

  const updateDetailedCost = (key: keyof DetailedCosts, val: number) => {
    setData({
      ...data,
      detailedCosts: { ...data.detailedCosts, [key]: val }
    });
  };

  // --- Handlers Viabilidade Rápida ---
  const updateQuick = (key: keyof QuickFeasibilityData, val: number) => {
    setData({
        ...data,
        quickFeasibility: {
            ...(data.quickFeasibility || INITIAL_DATA.quickFeasibility),
            [key]: val
        }
    });
  };

  // --- Cálculos Viabilidade Rápida ---
  const quickResults = useMemo(() => {
    const q = data.quickFeasibility || INITIAL_DATA.quickFeasibility;
    const salesPrice = stressTest ? q.salePricePerSqm * 0.90 : q.salePricePerSqm;
    const costPrice = stressTest ? q.constructionCostPerSqm * 1.10 : q.constructionCostPerSqm;
    const builtArea = q.landArea * q.constructionPotential;
    const privateArea = builtArea * (q.efficiency / 100);
    const vgv = privateArea * salesPrice;
    const hardCost = builtArea * costPrice;
    const softCost = vgv * (q.softCostRate / 100);
    const totalCost = q.askingPrice + hardCost + softCost;
    const profit = vgv - totalCost;
    const margin = vgv > 0 ? (profit / vgv) * 100 : 0;
    const swapTotalPct = (q.physicalSwap + q.financialSwap) / 100;
    const initialLandDisbursement = q.askingPrice * (1 - swapTotalPct);
    const cashExposure = initialLandDisbursement + (hardCost * 0.20);
    const targetProfit = vgv * (q.requiredMargin / 100);
    const maxLandValue = vgv - hardCost - softCost - targetProfit;

    return { builtArea, privateArea, vgv, hardCost, softCost, totalCost, profit, margin, cashExposure, maxLandValue };
  }, [data.quickFeasibility, stressTest]);

  // --- Cálculos Principais (Detalhada + Dashboard) ---
  const results = useMemo<CalculationResults>(() => {
    let constructionCost = 0;
    let foundationCostFinal = 0;
    let currentArea = data.area;

    // Cálculo de Custo
    if (data.useSegmentedCosts) {
       const sc = data.segmentedCosts;
       currentArea = sc.garage.area + sc.leisure.area + sc.standard.area + sc.penthouse.area;
       const garageCost = sc.garage.area * sc.garage.pricePerSqm;
       const leisureCost = sc.leisure.area * sc.leisure.pricePerSqm;
       const standardCost = sc.standard.area * sc.standard.pricePerSqm;
       const penthouseCost = sc.penthouse.area * sc.penthouse.pricePerSqm;
       foundationCostFinal = currentArea * sc.foundation.pricePerSqm;
       constructionCost = garageCost + leisureCost + standardCost + penthouseCost;

    } else if (data.useDetailedCosts) {
      const d = data.detailedCosts;
      const m2Cost = d.structure + d.masonry + d.electrical + d.plumbing + d.finishing + d.roofing;
      constructionCost = data.area * m2Cost;
      foundationCostFinal = data.foundationCost;
    } else {
      constructionCost = data.area * data.cubValue;
      foundationCostFinal = data.foundationCost;
    }

    const permittedArea = data.landArea * data.zoning.utilizationCoefficient;

    let vgv = 0;
    let totalPrivateArea = 0;
    if (data.units && data.units.length > 0) {
        vgv = data.units.reduce((acc, unit) => acc + (unit.quantity * unit.area * unit.pricePerSqm), 0);
        totalPrivateArea = data.units.reduce((acc, unit) => acc + (unit.quantity * unit.area), 0);
    } else {
        vgv = data.unitPrice * data.totalUnits;
        totalPrivateArea = data.area * 0.70; // fallback estimativo
    }

    const totalCost = constructionCost + data.landValue + foundationCostFinal + data.documentationCost + data.marketingCost + data.otherCosts;
    const profit = vgv - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    const breakdown = [
      { category: 'Construção', value: constructionCost, percentage: (constructionCost / totalCost) * 100 },
      { category: 'Terreno', value: data.landValue, percentage: (data.landValue / totalCost) * 100 },
      { category: 'Fundação', value: foundationCostFinal, percentage: (foundationCostFinal / totalCost) * 100 },
      { category: 'Documentação', value: data.documentationCost, percentage: (data.documentationCost / totalCost) * 100 },
      { category: 'Marketing', value: data.marketingCost, percentage: (data.marketingCost / totalCost) * 100 },
      { category: 'Outros', value: data.otherCosts, percentage: (data.otherCosts / totalCost) * 100 },
    ];

    let timeEstimate = 0;
    if (data.type === ProjectType.HOUSE) {
        timeEstimate = 5 + (currentArea / 40);
    } else {
        const baseMobilization = 4; 
        const timePerGarage = (data.zoning?.garageFloors || 0) * 1.5;
        const timePerStandard = (data.zoning?.standardFloors || 0) * 1.0; 
        const timePerLeisure = (data.zoning?.leisureFloors || 0) * 2.0; 
        const timePerPenthouse = (data.zoning?.penthouseFloors || 0) * 1.5;
        const calculatedByFloors = baseMobilization + timePerGarage + timePerStandard + timePerLeisure + timePerPenthouse;
        const hasFloorInputs = (data.zoning?.standardFloors || 0) > 0;
        if (hasFloorInputs) timeEstimate = calculatedByFloors;
        else timeEstimate = 12 + (currentArea / 60);
    }
    const constructionTime = Math.max(3, Math.ceil(timeEstimate));

    const costToDistribute = constructionCost + foundationCostFinal;
    const cashFlow = [];
    const initialPhase = Math.ceil(constructionTime * 0.2);
    const middlePhase = Math.ceil(constructionTime * 0.6);
    const finalPhase = constructionTime - initialPhase - middlePhase;
    const initialCostPerMonth = (costToDistribute * 0.20) / initialPhase;
    const middleCostPerMonth = (costToDistribute * 0.60) / middlePhase;
    const finalCostPerMonth = (costToDistribute * 0.20) / finalPhase;

    for (let i = 1; i <= constructionTime; i++) {
        let val = 0;
        if (i <= initialPhase) val = initialCostPerMonth;
        else if (i <= initialPhase + middlePhase) val = middleCostPerMonth;
        else val = finalCostPerMonth;
        if (i === 1) val += data.landValue + data.documentationCost + data.otherCosts;
        val += (data.marketingCost / constructionTime);
        cashFlow.push({ month: i, value: val });
    }

    // --- CÁLCULO DASHBOARD ANALÍTICO ---
    const totalConstruction = constructionCost + foundationCostFinal;
    
    // Estimativas para decomposição (simulando a partir dos totais)
    const landCommission = data.landValue * 0.05;
    const landTaxes = data.landValue * 0.04;
    const landAcquisition = data.landValue - landCommission - landTaxes;
    
    // Se Viabilidade Rápida estiver ativa, usamos suas taxas se não houverem dados detalhados
    const taxesRate = data.quickFeasibility?.softCostRate && data.otherCosts === 0 ? 0.04 : 0; 
    const taxesValue = vgv * (0.0409); // RET Padrão ~4.09%

    const totalExpenses = data.marketingCost + data.otherCosts + data.documentationCost;
    const marketingLaunch = data.marketingCost * 0.6;
    const marketingMaintenance = data.marketingCost * 0.4;
    const salesCommission = vgv * 0.04; // Estimativa de 4% comissão geral se não estiver explicito
    
    // Ajuste do resultado final considerando impostos calculados
    const finalResult = vgv - data.landValue - totalConstruction - totalExpenses - taxesValue - salesCommission;

    const dashboard: DashboardData = {
        synthetic: {
            revenue: vgv,
            landCost: data.landValue,
            constructionCost: totalConstruction,
            expenses: totalExpenses + salesCommission, // Inclui comissão no sintético
            taxes: taxesValue,
            result: finalResult
        },
        analytical: {
            revenue: { total: vgv },
            land: { 
                total: data.landValue, 
                acquisition: landAcquisition, 
                commission: landCommission, 
                taxes: landTaxes 
            },
            construction: { 
                total: totalConstruction, 
                direct: totalConstruction * 0.9, 
                indirect: totalConstruction * 0.1 
            },
            expenses: { 
                total: totalExpenses + salesCommission, 
                marketingLaunch, 
                marketingMaintenance, 
                admin: data.otherCosts + data.documentationCost,
                sales: salesCommission
            },
            taxes: { total: taxesValue }
        },
        kpis: {
            landArea: data.landArea,
            builtArea: currentArea,
            privateArea: totalPrivateArea,
            efficiency: currentArea > 0 ? (totalPrivateArea / currentArea) * 100 : 0,
            occupancy: data.zoning.occupancyRate,
            utilization: data.landArea > 0 ? currentArea / data.landArea : 0,
            vgvPerSqmPrivate: totalPrivateArea > 0 ? vgv / totalPrivateArea : 0,
            costPerSqmBuilt: currentArea > 0 ? totalConstruction / currentArea : 0
        }
    };

    return { constructionCost, totalCost, vgv, profit, roi, breakdown, constructionTime, cashFlow, permittedArea, dashboard };
  }, [data]);

  const handleStandardChange = (std: StandardType) => {
    const newCub = DEFAULT_CUB[std];
    setData(prev => ({ 
        ...prev, 
        standard: std, 
        cubValue: newCub,
        segmentedCosts: {
            ...prev.segmentedCosts,
            standard: { ...prev.segmentedCosts.standard, pricePerSqm: newCub },
            garage: { ...prev.segmentedCosts.garage, pricePerSqm: newCub * 0.7 },
            leisure: { ...prev.segmentedCosts.leisure, pricePerSqm: newCub * 1.2 },
            penthouse: { ...prev.segmentedCosts.penthouse, pricePerSqm: newCub * 1.1 },
            foundation: { ...prev.segmentedCosts.foundation, pricePerSqm: newCub * 0.15 }
        }
    }));
  };

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeFeasibility(data, results);
    setAiAnalysis(result || '');
    setIsAnalyzing(false);
  };

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white py-4 px-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('quick')}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CalcConstru Pro</h1>
              <p className="text-slate-400 text-xs font-medium">Viabilidade & Gestão Supabase</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Main Tabs */}
             <div className="flex bg-slate-800 rounded-lg p-1 mr-2">
                <button onClick={() => setActiveTab('quick')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'quick' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                    🚀 Rápida
                </button>
                <button onClick={() => setActiveTab('inputs')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'inputs' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                    🛠️ Detalhada
                </button>
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                    📊 Dashboard
                </button>
                <button onClick={() => setActiveTab('history')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                    📚 Histórico
                </button>
             </div>

             <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                <button onClick={handleNewProject} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white" title="Novo Projeto">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
                <button onClick={handleSave} disabled={isSaving} className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white disabled:opacity-50" title="Salvar">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                </button>
                <button onClick={() => setActiveTab('settings')} className={`p-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-20">
        
        {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto">
                <Suspense fallback={<div className="flex justify-center py-20">Carregando...</div>}>
                    <SettingsSection onConfigUpdate={checkDbConnection} />
                </Suspense>
            </div>
        )}

        {/* ... (Histórico omitido para brevidade, sem alterações) ... */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 animate-fadeIn">
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">Histórico de Empreendimentos</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {projects.map((p) => {
                   let vgv = 0;
                   if (p.quickFeasibility) {
                       const built = p.quickFeasibility.landArea * p.quickFeasibility.constructionPotential;
                       const priv = built * (p.quickFeasibility.efficiency / 100);
                       vgv = priv * p.quickFeasibility.salePricePerSqm;
                   } else if (p.units && p.units.length > 0) {
                      vgv = p.units.reduce((acc: any, u: any) => acc + (u.quantity * u.area * u.pricePerSqm), 0);
                   } else {
                      vgv = p.unitPrice * p.totalUnits;
                   }
                   return (
                     <div key={p.id} onClick={() => { setData(p); setActiveTab(p.quickFeasibility ? 'quick' : 'inputs'); }} className="group cursor-pointer bg-slate-50 hover:bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"><button onClick={(e) => handleDelete(p.id!, e)} className="text-red-500 hover:text-red-700 font-bold px-2">✕</button></div>
                       <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{p.type} • {p.standard}</span>
                       <h3 className="font-bold text-slate-900 text-lg mb-2 truncate pr-6">{p.name}</h3>
                       <p className="text-emerald-600 font-bold">{formatCurrency(vgv)}</p>
                       <p className="text-xs text-slate-500 mt-1">{p.quickFeasibility ? 'Viabilidade Rápida' : 'Viabilidade Detalhada'}</p>
                     </div>
                   );
                 })}
             </div>
          </div>
        )}

        {/* --- NOVO: DASHBOARD ANALÍTICO --- */}
        {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto">
               <DashboardSection data={results.dashboard} />
            </div>
        )}
        
        {/* --- VIABILIDADE RÁPIDA --- */}
        {activeTab === 'quick' && (
           <div className="animate-fadeIn space-y-8">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <InputField label="Nome do Empreendimento" type="text" value={data.name} onChange={(v) => setData({...data, name: v})} />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   {/* Inputs Esquerda */}
                   <div className="space-y-6">
                       <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                           <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-orange-500 rounded-full"></span>Premissas do Terreno</h2>
                           <div className="grid grid-cols-2 gap-4">
                               <InputField label="Área Terreno (m²)" value={data.landArea} onChange={(v) => {setData({...data, landArea: v}); updateQuick('landArea', v)}} />
                               <InputField label="Valor Pedido (R$)" prefix="R$" value={data.quickFeasibility?.askingPrice || data.landValue} onChange={(v) => {updateQuick('askingPrice', v); setData({...data, landValue: v})}} />
                               <InputField label="% Permuta Física" value={data.quickFeasibility?.physicalSwap || 0} onChange={(v) => updateQuick('physicalSwap', v)} />
                               <InputField label="% Permuta Financeira" value={data.quickFeasibility?.financialSwap || 0} onChange={(v) => updateQuick('financialSwap', v)} />
                           </div>
                       </section>

                       <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                           <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-blue-600 rounded-full"></span>Premissas do Produto</h2>
                           <div className="grid grid-cols-2 gap-4 mb-4">
                               <InputField label="Potencial Construtivo (x)" value={data.quickFeasibility?.constructionPotential || 0} step="0.1" onChange={(v) => updateQuick('constructionPotential', v)} />
                               <InputField label="Eficiência de Projeto (%)" value={data.quickFeasibility?.efficiency || 0} onChange={(v) => updateQuick('efficiency', v)} />
                           </div>
                           <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                               <InputField label="Preço Venda (R$/m²)" prefix="R$" value={data.quickFeasibility?.salePricePerSqm || 0} onChange={(v) => updateQuick('salePricePerSqm', v)} />
                               <InputField label="Custo Obra (R$/m²)" prefix="R$" value={data.quickFeasibility?.constructionCostPerSqm || 0} onChange={(v) => updateQuick('constructionCostPerSqm', v)} />
                           </div>
                           <div className="mt-4 flex gap-4 text-xs text-slate-500">
                               <label className="flex items-center gap-2">
                                  <span>Margem Alvo (%):</span>
                                  <input type="number" className="w-12 border rounded px-1" value={data.quickFeasibility?.requiredMargin || 20} onChange={(e) => updateQuick('requiredMargin', parseFloat(e.target.value))} />
                               </label>
                               <label className="flex items-center gap-2">
                                  <span>Despesas (%):</span>
                                  <input type="number" className="w-12 border rounded px-1" value={data.quickFeasibility?.softCostRate || 10} onChange={(e) => updateQuick('softCostRate', parseFloat(e.target.value))} />
                               </label>
                           </div>
                       </section>
                   </div>

                   {/* Resultados Direita */}
                   <div className="space-y-6">
                       {/* Motor de Cálculo Visual */}
                       <section className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
                           <div className="flex justify-between items-start z-10 relative">
                               <div>
                                   <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">VGV Total (Valor Geral de Vendas)</p>
                                   <h3 className="text-3xl font-bold text-white mb-1">{formatCurrency(quickResults.vgv)}</h3>
                                   <p className="text-xs text-slate-500">Área Privativa: {quickResults.privateArea.toLocaleString()} m² ({data.quickFeasibility?.efficiency}%)</p>
                               </div>
                               <div className="text-right">
                                   <div className="bg-slate-800 px-3 py-1 rounded-lg inline-block">
                                        <p className="text-slate-400 text-[10px] font-bold uppercase">Área Construída Total</p>
                                        <p className="text-lg font-bold">{quickResults.builtArea.toLocaleString()} m²</p>
                                   </div>
                               </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4 mt-6 z-10 relative">
                               <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                   <p className="text-red-300 text-xs mb-1">Custo Obra (Hard)</p>
                                   <p className="font-bold">{formatCurrency(quickResults.hardCost)}</p>
                               </div>
                               <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                   <p className="text-red-300 text-xs mb-1">Despesas (Soft)</p>
                                   <p className="font-bold">{formatCurrency(quickResults.softCost)}</p>
                               </div>
                           </div>

                           {/* Stress Test Toggle */}
                           <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center">
                               <span className="text-xs font-bold uppercase text-slate-400">Cenário Estresse (-10% Venda / +10% Obra)</span>
                               <button 
                                  onClick={() => setStressTest(!stressTest)}
                                  className={`w-12 h-6 rounded-full relative transition-all ${stressTest ? 'bg-red-500' : 'bg-slate-600'}`}
                               >
                                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${stressTest ? 'left-7' : 'left-1'}`}></div>
                               </button>
                           </div>
                       </section>

                       {/* Painel de Decisão */}
                       <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                           <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
                               <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                               Painel de Decisão
                           </h2>
                           
                           <div className="space-y-6">
                               {/* Resultado Líquido */}
                               <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                                   <div>
                                       <p className="text-xs text-slate-500 font-bold uppercase mb-1">Resultado Líquido (Lucro)</p>
                                       <h3 className={`text-2xl font-black ${quickResults.profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                           {formatCurrency(quickResults.profit)}
                                       </h3>
                                   </div>
                                   <div className="text-right">
                                       <p className="text-xs text-slate-500 font-bold uppercase mb-1">Margem Líquida</p>
                                       <h3 className={`text-2xl font-bold ${quickResults.margin > (data.quickFeasibility?.requiredMargin || 20) ? 'text-emerald-600' : 'text-amber-500'}`}>
                                           {quickResults.margin.toFixed(1)}%
                                       </h3>
                                   </div>
                               </div>

                               {/* Indicadores Chave */}
                               <div className="grid grid-cols-2 gap-4">
                                   <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                       <p className="text-orange-800 text-xs font-bold uppercase mb-1">Exposição de Caixa (Est.)</p>
                                       <p className="text-lg font-bold text-orange-900">{formatCurrency(quickResults.cashExposure)}</p>
                                       <p className="text-[10px] text-orange-700 mt-1">Terreno (Entrada) + 20% Obra</p>
                                   </div>
                                   <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                       <p className="text-blue-800 text-xs font-bold uppercase mb-1">Teto para Terreno</p>
                                       <p className="text-lg font-bold text-blue-900">{formatCurrency(quickResults.maxLandValue)}</p>
                                       <p className="text-[10px] text-blue-700 mt-1">Para Margem de {data.quickFeasibility?.requiredMargin}%</p>
                                   </div>
                               </div>
                           </div>
                       </section>
                   </div>
               </div>
           </div>
        )}

        {/* --- VIABILIDADE DETALHADA --- */}
        {activeTab === 'inputs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            
            <div className="lg:col-span-5 space-y-6">
              
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-blue-600 rounded-full"></span>Dados do Projeto</h2>
                <div className="space-y-4">
                  <InputField label="Nome do Empreendimento" type="text" value={data.name} onChange={(v) => setData({...data, name: v})} />
                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Tipo</label>
                        <select className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={data.type} onChange={(e) => setData({...data, type: e.target.value as ProjectType})}>
                            {Object.values(ProjectType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Padrão</label>
                        <select className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={data.standard} onChange={(e) => handleStandardChange(e.target.value as StandardType)}>
                            {Object.values(StandardType).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                     </div>
                  </div>
                </div>
              </section>

              {/* Zoneamento, Pavimentos e Terreno */}
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-teal-500 rounded-full"></span>Zoneamento & Terreno</h2>
                
                {/* Terreno e Altura */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <InputField label="Área Terreno (m²)" value={data.landArea} onChange={(v) => setData({...data, landArea: v})} />
                    <InputField label="Altura Máx. (m)" value={data.zoning.maxHeight} onChange={(v) => setData({...data, zoning: {...data.zoning, maxHeight: v}})} />
                    <div className="col-span-2 bg-teal-50 p-3 rounded-xl border border-teal-100 flex justify-between items-center">
                        <span className="text-xs font-bold text-teal-700 uppercase">Potencial Construtivo</span>
                        <span className="text-lg font-bold text-teal-900">{results.permittedArea.toLocaleString()} m²</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                    <InputField label="T. Ocupação (%)" value={data.zoning?.occupancyRate || 0} onChange={(v) => setData({...data, zoning: {...data.zoning, occupancyRate: v}})} />
                    <InputField label="Coef. Aprov." value={data.zoning?.utilizationCoefficient || 0} onChange={(v) => setData({...data, zoning: {...data.zoning, utilizationCoefficient: v}})} step="0.1" />
                    <InputField label="Afastamento (m)" value={data.zoning?.minSetback || 0} onChange={(v) => setData({...data, zoning: {...data.zoning, minSetback: v}})} />
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">Pavimentos</p>
                    <div className="grid grid-cols-2 gap-3">
                        <InputField label="Garagem" value={data.zoning?.garageFloors || 0} onChange={(v) => setData({...data, zoning: {...data.zoning, garageFloors: v}})} />
                        <InputField label="Tipo (Padrão)" value={data.zoning?.standardFloors || 0} onChange={(v) => setData({...data, zoning: {...data.zoning, standardFloors: v}})} />
                        <InputField label="Lazer/Comum" value={data.zoning?.leisureFloors || 0} onChange={(v) => setData({...data, zoning: {...data.zoning, leisureFloors: v}})} />
                        <InputField label="Cobertura" value={data.zoning?.penthouseFloors || 0} onChange={(v) => setData({...data, zoning: {...data.zoning, penthouseFloors: v}})} />
                    </div>
                </div>
              </section>

              {/* Custos da Obra (Com opção de CUB Detalhado) */}
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-indigo-600 rounded-full"></span>Custos da Obra</h2>
                  
                  {/* Toggle para Segmentação */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">CUB Detalhado</span>
                    <button 
                      onClick={() => setData({...data, useSegmentedCosts: !data.useSegmentedCosts, useDetailedCosts: false})}
                      className={`w-10 h-5 rounded-full relative transition-all ${data.useSegmentedCosts ? 'bg-indigo-600' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${data.useSegmentedCosts ? 'left-6' : 'left-1'}`}></div>
                    </button>
                  </div>
                </div>

                {data.useSegmentedCosts ? (
                   // --- CUB POR TIPOLOGIA ---
                   <div className="space-y-4 animate-fadeIn">
                      <div className="text-xs text-slate-500 font-medium mb-2 bg-indigo-50 p-2 rounded border border-indigo-100">
                        Insira a Área (m²) e o custo CUB Unitário (R$/m²) para cada setor.
                      </div>
                      
                      {/* Tabela de Inputs Customizada */}
                      <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase mb-1">
                          <div className="col-span-4">Setor</div>
                          <div className="col-span-4">Área m²</div>
                          <div className="col-span-4">R$/m²</div>
                      </div>

                      {/* Garagem */}
                      <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 text-sm font-medium text-slate-700">Garagem</div>
                          <div className="col-span-4"><InputField label="" value={data.segmentedCosts.garage.area} onChange={(v) => updateSegmentedCost('garage', 'area', v)} /></div>
                          <div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.garage.pricePerSqm} onChange={(v) => updateSegmentedCost('garage', 'pricePerSqm', v)} /></div>
                      </div>
                      
                      {/* Lazer */}
                      <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 text-sm font-medium text-slate-700">Lazer/Comum</div>
                          <div className="col-span-4"><InputField label="" value={data.segmentedCosts.leisure.area} onChange={(v) => updateSegmentedCost('leisure', 'area', v)} /></div>
                          <div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.leisure.pricePerSqm} onChange={(v) => updateSegmentedCost('leisure', 'pricePerSqm', v)} /></div>
                      </div>

                      {/* Tipo */}
                      <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 text-sm font-medium text-slate-700">Apt. Tipo</div>
                          <div className="col-span-4"><InputField label="" value={data.segmentedCosts.standard.area} onChange={(v) => updateSegmentedCost('standard', 'area', v)} /></div>
                          <div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.standard.pricePerSqm} onChange={(v) => updateSegmentedCost('standard', 'pricePerSqm', v)} /></div>
                      </div>

                      {/* Cobertura */}
                      <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-4 text-sm font-medium text-slate-700">Cobertura</div>
                          <div className="col-span-4"><InputField label="" value={data.segmentedCosts.penthouse.area} onChange={(v) => updateSegmentedCost('penthouse', 'area', v)} /></div>
                          <div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.penthouse.pricePerSqm} onChange={(v) => updateSegmentedCost('penthouse', 'pricePerSqm', v)} /></div>
                      </div>
                      
                      <div className="border-t border-slate-200 pt-3 mt-2">
                        <div className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-4 text-sm font-medium text-slate-700">Fundação</div>
                            <div className="col-span-4 text-xs text-slate-400 italic">Aplicado no Total</div>
                            <div className="col-span-4"><InputField label="R$/m² (Total)" prefix="R$" value={data.segmentedCosts.foundation.pricePerSqm} onChange={(v) => updateSegmentedCost('foundation', 'pricePerSqm', v)} /></div>
                        </div>
                      </div>

                      <div className="bg-slate-100 p-3 rounded-lg flex justify-between items-center text-sm font-bold text-slate-700">
                          <span>Área Construída Total:</span>
                          <span>{(data.segmentedCosts.garage.area + data.segmentedCosts.leisure.area + data.segmentedCosts.standard.area + data.segmentedCosts.penthouse.area).toLocaleString()} m²</span>
                      </div>
                   </div>
                ) : (
                   // --- MODO SIMPLES/MATERIAIS ---
                   <>
                    {data.useDetailedCosts ? (
                      <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                        <InputField label="Estrutura" value={data.detailedCosts.structure} onChange={(v) => updateDetailedCost('structure', v)} prefix="R$" />
                        <InputField label="Alvenaria" value={data.detailedCosts.masonry} onChange={(v) => updateDetailedCost('masonry', v)} prefix="R$" />
                        <InputField label="Elétrica" value={data.detailedCosts.electrical} onChange={(v) => updateDetailedCost('electrical', v)} prefix="R$" />
                        <InputField label="Hidráulica" value={data.detailedCosts.plumbing} onChange={(v) => updateDetailedCost('plumbing', v)} prefix="R$" />
                        <InputField label="Acabamento" value={data.detailedCosts.finishing} onChange={(v) => updateDetailedCost('finishing', v)} prefix="R$" />
                        <InputField label="Cobertura" value={data.detailedCosts.roofing} onChange={(v) => updateDetailedCost('roofing', v)} prefix="R$" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                         <InputField label="Área Construída Total (m²)" value={data.area} onChange={(v) => setData({...data, area: v})} />
                         <InputField label="CUB Médio (R$/m²)" value={data.cubValue} onChange={(v) => setData({...data, cubValue: v})} prefix="R$" step="0.01" />
                      </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                       <InputField label="Custo Fundação (Total)" value={data.foundationCost} onChange={(v) => setData({...data, foundationCost: v})} prefix="R$" />
                    </div>
                   </>
                )}
                
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                   <InputField label="Valor Terreno" value={data.landValue} onChange={(v) => setData({...data, landValue: v})} prefix="R$" />
                   <InputField label="Projetos/Doc" value={data.documentationCost} onChange={(v) => setData({...data, documentationCost: v})} prefix="R$" />
                   <InputField label="Marketing" value={data.marketingCost} onChange={(v) => setData({...data, marketingCost: v})} prefix="R$" />
                   <InputField label="Outros Custos" value={data.otherCosts} onChange={(v) => setData({...data, otherCosts: v})} prefix="R$" />
                </div>
              </section>

               {/* Mídia e Arquivos */}
               <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-orange-400 rounded-full"></span>Mídia e Documentos</h2>
                <div className="space-y-4">
                   <InputField label="Link da Localização (Google Maps)" type="text" value={data.media?.locationLink || ''} onChange={(v) => setData({...data, media: {...data.media, locationLink: v}})} />
                   <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-bold text-slate-500 mb-2">GALERIA DE IMAGENS (URLs)</p>
                      <div className="space-y-2">
                         {data.media?.imageUrls?.map((url, idx) => (
                             <div key={idx} className="flex gap-2"><input className="flex-1 text-xs p-1 border rounded bg-white" value={url} readOnly /><button onClick={() => { const newUrls = data.media.imageUrls.filter((_, i) => i !== idx); setData({...data, media: {...data.media, imageUrls: newUrls}}); }} className="text-red-500 font-bold">×</button></div>
                         ))}
                         <div className="flex gap-2"><input id="newImgUrl" placeholder="https://..." className="flex-1 text-xs p-1.5 border rounded" /><button onClick={() => { const el = document.getElementById('newImgUrl') as HTMLInputElement; if(el.value) { setData({...data, media: {...data.media, imageUrls: [...(data.media.imageUrls || []), el.value]}}); el.value = ''; } }} className="bg-blue-600 text-white text-xs px-2 rounded">Adicionar</button></div>
                      </div>
                   </div>
                </div>
              </section>

              {/* Corretor */}
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-purple-600 rounded-full"></span>Corretor</h2>
                <div className="space-y-4">
                  <InputField label="Nome" type="text" value={data.brokerName || ''} onChange={(v) => setData({...data, brokerName: v})} />
                  <InputField label="Telefone" type="text" value={data.brokerPhone || ''} onChange={(v) => setData({...data, brokerPhone: v})} />
                  <textarea className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm h-20 outline-none focus:ring-2 focus:ring-blue-500" value={data.observations || ''} onChange={(e) => setData({...data, observations: e.target.value})} placeholder="Observações..." />
                </div>
              </section>
            </div>

            {/* --- Right Column --- */}
            <div className="lg:col-span-7 space-y-6">
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-emerald-600 rounded-full"></span>Mix de Apartamentos</h2>
                    <button onClick={addUnit} className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-200 transition-colors">+ Adicionar Tipo</button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                          <thead>
                              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wider">
                                  <th className="pb-3 pl-2 w-32">Nome</th>
                                  <th className="pb-3 w-16">Qtd</th>
                                  <th className="pb-3 w-20">Área</th>
                                  <th className="pb-3 w-28">R$/m²</th>
                                  <th className="pb-3 w-32">Unitário (R$)</th>
                                  <th className="pb-3 w-32 text-right">Total (VGV)</th>
                                  <th className="pb-3 w-10"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {data.units?.map((unit) => (
                                  <tr key={unit.id} className="group hover:bg-slate-50 transition-colors">
                                      <td className="py-2"><input className="w-full bg-transparent font-medium text-slate-700 focus:bg-white rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300" value={unit.name} onChange={(e) => updateUnit(unit.id, 'name', e.target.value)} /></td>
                                      <td className="py-2"><input type="number" className="w-full bg-transparent text-slate-600 focus:bg-white rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300" value={unit.quantity} onChange={(e) => updateUnit(unit.id, 'quantity', parseInt(e.target.value) || 0)} /></td>
                                      <td className="py-2"><input type="number" className="w-full bg-transparent text-slate-600 focus:bg-white rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300" value={unit.area} onChange={(e) => updateUnit(unit.id, 'area', parseFloat(e.target.value) || 0)} /></td>
                                      <td className="py-2"><input type="number" className="w-full bg-transparent text-slate-600 focus:bg-white rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-300" value={unit.pricePerSqm} onChange={(e) => updateUnit(unit.id, 'pricePerSqm', parseFloat(e.target.value) || 0)} /></td>
                                      <td className="py-2"><input type="text" className="w-full bg-transparent text-emerald-600 font-bold focus:bg-white rounded px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-300" value={Math.round(unit.pricePerSqm * unit.area)} onChange={(e) => updateUnitTotalPrice(unit.id, parseFloat(e.target.value) || 0)} /></td>
                                      <td className="py-2 text-right font-bold text-slate-700">{(unit.quantity * unit.area * unit.pricePerSqm).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</td>
                                      <td className="py-2 text-center"><button onClick={() => removeUnit(unit.id)} className="text-slate-300 hover:text-red-500 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></td>
                                  </tr>
                              ))}
                          </tbody>
                          <tfoot>
                             <tr className="bg-slate-50 font-bold text-slate-800">
                                <td className="py-3 px-2">TOTAL</td>
                                <td className="py-3 px-2">{data.units?.reduce((a, b) => a + b.quantity, 0)} un</td>
                                <td className="py-3 px-2">{data.units?.reduce((a, b) => a + (b.area * b.quantity), 0).toLocaleString()} m²</td>
                                <td></td>
                                <td></td>
                                <td className="py-3 text-right text-emerald-600">{formatCurrency(results.vgv)}</td>
                                <td></td>
                             </tr>
                          </tfoot>
                      </table>
                  </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Custo Total</p><h3 className="text-2xl font-bold text-slate-900">{formatCurrency(results.totalCost)}</h3></div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">VGV Total</p><h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(results.vgv)}</h3></div>
                <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 text-white"><p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">Lucro Líquido</p><h3 className="text-2xl font-black">{formatCurrency(results.profit)}</h3><div className="flex justify-between items-center mt-2 text-xs"><span>ROI: <span className={results.roi > 20 ? 'text-green-400' : 'text-amber-400'}>{results.roi.toFixed(1)}%</span></span><span>Prazo: {results.constructionTime} meses</span></div></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]"><h3 className="text-sm font-bold text-slate-700 mb-4">Composição de Custos</h3><Suspense fallback={<div className="h-40 flex items-center justify-center">Carregando...</div>}><CostBreakdownChart results={results} /></Suspense></div>
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]"><h3 className="text-sm font-bold text-slate-700 mb-4">Fluxo de Caixa (Previsão)</h3><Suspense fallback={<div className="h-40 flex items-center justify-center">Carregando...</div>}><CashFlowChart results={results} /></Suspense></div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-xl text-slate-900 border border-slate-200 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10"></div>
                 <div className="relative z-10">
                   <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><span className="text-2xl">✨</span> Análise IA</h2><button onClick={handleAiAnalysis} disabled={isAnalyzing} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 disabled:opacity-50">{isAnalyzing ? 'Processando...' : 'Gerar Análise'}</button></div>
                   {aiAnalysis ? <div className="prose prose-sm text-slate-600 bg-slate-50 p-6 rounded-xl border border-slate-100" dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>') }} /> : <p className="text-slate-400 text-sm text-center py-8">Solicite uma análise inteligente do seu projeto.</p>}
                 </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
