
import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { ProjectData, ProjectType, StandardType, CalculationResults, DetailedCosts, ApartmentUnit, SegmentedCosts, QuickFeasibilityData, DashboardData, FinancialAssumptions, Land } from './types';
import { DEFAULT_CUB, INITIAL_DATA, SQL_FIX_SCRIPT } from './constants';
import { InputField } from './components/InputSection';
import { analyzeFeasibility } from './services/geminiService';
import { saveProject, fetchProjects, deleteProject, testConnection, getSupabase, signOut } from './services/supabaseClient';
import { DashboardSection } from './components/DashboardSection';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';

// Lazy load heavy components
const CostBreakdownChart = React.lazy(() => import('./components/ChartSection').then(module => ({ default: module.CostBreakdownChart })));
const CashFlowChart = React.lazy(() => import('./components/ChartSection').then(module => ({ default: module.CashFlowChart })));
const SettingsSection = React.lazy(() => import('./components/SettingsSection').then(module => ({ default: module.SettingsSection })));
const ProfileSection = React.lazy(() => import('./components/ProfileSection').then(module => ({ default: module.ProfileSection })));
const LandRegistry = React.lazy(() => import('./components/LandRegistry').then(module => ({ default: module.LandRegistry })));

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [data, setData] = useState<ProjectData>(JSON.parse(JSON.stringify(INITIAL_DATA)));
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'inputs' | 'dashboard' | 'history' | 'lands' | 'profile'>('inputs');
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [dashboardSelectionMode, setDashboardSelectionMode] = useState(true);
  
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showLandSelectModal, setShowLandSelectModal] = useState(false);

  // --- AUTH EFFECT ---
  useEffect(() => {
      const client = getSupabase();
      if (!client) {
          setAuthLoading(false);
          return;
      }

      // Check active session
      client.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setAuthLoading(false);
      });

      // Listen for changes
      const {
          data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
          setSession(session);
      });

      return () => subscription.unsubscribe();
  }, []);

  // --- DATA LOADING EFFECTS ---
  useEffect(() => {
    if (session) {
        checkDbConnection();
        if (activeTab === 'history' || activeTab === 'dashboard') {
            loadProjects();
        }
    }
  }, [activeTab, session]);

  const checkDbConnection = async () => {
    const connected = await testConnection();
    setIsDbConnected(connected);
  };

  const loadProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const list = await fetchProjects();
      const mergedList = list.map(p => ({
        ...JSON.parse(JSON.stringify(INITIAL_DATA)),
        ...p,
        units: p.units || [],
        zoning: { ...INITIAL_DATA.zoning, ...(p.zoning || {}) },
        media: p.media || INITIAL_DATA.media,
        segmentedCosts: p.segmentedCosts || INITIAL_DATA.segmentedCosts,
        quickFeasibility: p.quickFeasibility || INITIAL_DATA.quickFeasibility,
        financials: { ...INITIAL_DATA.financials, ...(p.financials || {}) }
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

  // --- ACTIONS ---
  const handleNewProject = (e?: React.MouseEvent) => {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    setShowNewProjectModal(true);
  };

  const confirmNewProject = () => {
    const newData = JSON.parse(JSON.stringify(INITIAL_DATA));
    delete newData.id;
    setData(newData);
    setAiAnalysis('');
    setDashboardSelectionMode(true);
    setActiveTab('inputs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setShowNewProjectModal(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const projectToSave = { ...data };
      if (!projectToSave.id || projectToSave.id.length < 5) {
          delete projectToSave.id;
      }
      
      const savedProject = await saveProject(projectToSave);
      
      if (savedProject) {
        setData(savedProject);
        alert(`Sucesso! Projeto "${savedProject.name}" salvo.`);
      } else {
        alert("Projeto salvo, mas sem confirmação do banco.");
      }
      loadProjects();
    } catch (e: any) {
      console.error("Erro no handleSave:", e);
      const errorMsg = e.message || '';
      if (errorMsg.includes('financials') || errorMsg.includes('column') || errorMsg.includes('does not exist') || errorMsg.includes('lands')) {
         setShowSqlModal(true); 
      } else {
         const newId = data.id || crypto.randomUUID();
         const projectToSave = { ...data, id: newId };
         let localProjects = [];
         try { localProjects = JSON.parse(localStorage.getItem('calcconstru_projects') || '[]'); } catch {}
         const newList = [projectToSave, ...localProjects.filter((p: any) => p.id !== newId)];
         localStorage.setItem('calcconstru_projects', JSON.stringify(newList));
         setProjects(newList);
         setData(projectToSave);
         alert("ERRO DE CONEXÃO: Salvo apenas LOCALMENTE no navegador.");
      }
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

  const handleLandSelect = (land: Land) => {
      setData(prev => ({
          ...prev,
          landId: land.id,
          landArea: land.area,
          landValue: land.price,
          quickFeasibility: {
              ...(prev.quickFeasibility || INITIAL_DATA.quickFeasibility),
              landArea: land.area,
              askingPrice: land.price
          },
          media: {
              ...(prev.media),
              locationLink: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${land.address}, ${land.number} - ${land.city}, ${land.state}`)}`
          },
          observations: (prev.observations || '') + `\n[Terreno Vinculado: ${land.description}]`
      }));
      setShowLandSelectModal(false);
  };

  const handleLogout = async () => {
      await signOut();
      setSession(null);
  };

  // --- Handlers Detalhados (Updates) ---
  const addUnit = () => {
    const newUnit: ApartmentUnit = { id: crypto.randomUUID(), name: 'Novo Tipo', quantity: 1, area: 50, pricePerSqm: 5000 };
    setData(prev => ({ ...prev, units: [...prev.units, newUnit] }));
  };
  const updateUnit = (id: string, field: keyof ApartmentUnit, value: any) => {
    setData(prev => ({ ...prev, units: prev.units.map(u => u.id === id ? { ...u, [field]: value } : u) }));
  };
  const updateUnitTotalPrice = (id: string, totalPrice: number) => {
    setData(prev => ({ ...prev, units: prev.units.map(u => { if (u.id === id) { const area = u.area || 1; return { ...u, pricePerSqm: totalPrice / area }; } return u; }) }));
  };
  const removeUnit = (id: string) => { setData(prev => ({ ...prev, units: prev.units.filter(u => u.id !== id) })); };
  const updateSegmentedCost = (type: keyof SegmentedCosts, field: 'area' | 'pricePerSqm', value: number) => {
    setData(prev => ({ ...prev, segmentedCosts: { ...prev.segmentedCosts, [type]: { ...prev.segmentedCosts[type], [field]: value } } }));
  };
  const updateDetailedCost = (key: keyof DetailedCosts, val: number) => { setData(prev => ({ ...prev, detailedCosts: { ...prev.detailedCosts, [key]: val } })); };
  const updateFinancials = (key: keyof FinancialAssumptions, val: number) => { setData(prev => ({ ...prev, financials: { ...(prev.financials || INITIAL_DATA.financials), [key]: val } })); };
  const updateQuick = (key: keyof QuickFeasibilityData, val: number) => { setData(prev => ({ ...prev, quickFeasibility: { ...(prev.quickFeasibility || INITIAL_DATA.quickFeasibility), [key]: val } })); };

  // --- Cálculos ---
  const results = useMemo<CalculationResults>(() => {
    let constructionCost = 0;
    let foundationCostFinal = 0;
    let currentArea = data.area;

    if (data.useSegmentedCosts) {
       const sc = data.segmentedCosts;
       currentArea = sc.garage.area + sc.leisure.area + sc.standard.area + sc.penthouse.area;
       foundationCostFinal = currentArea * sc.foundation.pricePerSqm;
       constructionCost = (sc.garage.area * sc.garage.pricePerSqm) + (sc.leisure.area * sc.leisure.pricePerSqm) + (sc.standard.area * sc.standard.pricePerSqm) + (sc.penthouse.area * sc.penthouse.pricePerSqm);
    } else if (data.useDetailedCosts) {
      const d = data.detailedCosts;
      const m2Cost = d.structure + d.masonry + d.electrical + d.plumbing + d.finishing + d.roofing;
      constructionCost = data.area * m2Cost;
      foundationCostFinal = data.foundationCost;
    } else {
      if (currentArea === 0 && data.quickFeasibility) {
          const pot = data.quickFeasibility.constructionPotential || data.zoning.utilizationCoefficient;
          currentArea = data.landArea * pot;
      }
      const macroCost = data.quickFeasibility?.constructionCostPerSqm || 0;
      const finalM2Cost = macroCost > 0 ? macroCost : data.cubValue;
      constructionCost = currentArea * finalM2Cost;
      foundationCostFinal = data.foundationCost;
    }

    const permittedArea = data.landArea * data.zoning.utilizationCoefficient;

    let vgv = 0;
    let totalPrivateArea = 0;
    let efficiency = 0;

    if (data.units && data.units.length > 0) {
        vgv = data.units.reduce((acc, unit) => acc + (unit.quantity * unit.area * unit.pricePerSqm), 0);
        totalPrivateArea = data.units.reduce((acc, unit) => acc + (unit.quantity * unit.area), 0);
        efficiency = currentArea > 0 ? (totalPrivateArea / currentArea) * 100 : 0;
    } else {
        const q = data.quickFeasibility || INITIAL_DATA.quickFeasibility;
        const potential = q.constructionPotential || data.zoning.utilizationCoefficient;
        const eff = q.efficiency || 70;
        const avgPrice = q.salePricePerSqm || 0;
        const built = data.landArea * potential;
        totalPrivateArea = built * (eff / 100);
        vgv = totalPrivateArea * avgPrice;
        efficiency = eff;
        if (currentArea === 0) currentArea = built;
    }

    const financials = data.financials || INITIAL_DATA.financials;
    const landValue = data.landValue || (data.quickFeasibility?.askingPrice || 0);
    const landCommission = landValue * (financials.landCommissionPct / 100);
    const landTaxes = landValue * (financials.landRegistryPct / 100);
    const landTotalCost = landValue + landCommission + landTaxes;
    const totalConstruction = constructionCost + foundationCostFinal;
    const indirectConstruction = totalConstruction * ((financials.indirectCostsPct || 0) / 100);
    const directConstruction = totalConstruction - indirectConstruction;
    const taxesValue = vgv * (financials.taxesPct / 100);
    const salesCommission = vgv * (financials.saleCommissionPct / 100);
    const totalExpenses = data.marketingCost + data.otherCosts + data.documentationCost;
    const totalCost = totalConstruction + landTotalCost + totalExpenses; // Used for ROI calc base
    const finalResult = vgv - landTotalCost - totalConstruction - totalExpenses - taxesValue - salesCommission;
    const profit = finalResult;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const margin = vgv > 0 ? (finalResult / vgv) * 100 : 0;
    const breakdown = [
      { category: 'Construção', value: totalConstruction, percentage: (totalConstruction / (totalCost + taxesValue + salesCommission)) * 100 },
      { category: 'Terreno', value: landValue, percentage: (landValue / (totalCost + taxesValue + salesCommission)) * 100 },
      { category: 'Impostos/Taxas', value: taxesValue + landTaxes, percentage: ((taxesValue + landTaxes) / (totalCost + taxesValue + salesCommission)) * 100 },
      { category: 'Despesas/Mkt', value: totalExpenses + salesCommission, percentage: ((totalExpenses + salesCommission) / (totalCost + taxesValue + salesCommission)) * 100 },
    ];
    let timeEstimate = data.type === ProjectType.HOUSE ? 5 + (currentArea / 40) : 12 + (currentArea / 60);
    if (data.type !== ProjectType.HOUSE && (data.zoning?.standardFloors || 0) > 0) {
        timeEstimate = 4 + ((data.zoning?.garageFloors||0)*1.5) + ((data.zoning?.standardFloors||0)*1) + ((data.zoning?.leisureFloors||0)*2) + ((data.zoning?.penthouseFloors||0)*1.5);
    }
    const constructionTime = Math.max(3, Math.ceil(timeEstimate));
    const costToDistribute = totalConstruction;
    const cashFlow = [];
    const initialPhase = Math.ceil(constructionTime * 0.2);
    const middlePhase = Math.ceil(constructionTime * 0.6);
    const finalPhase = constructionTime - initialPhase - middlePhase;
    for (let i = 1; i <= constructionTime; i++) {
        let val = 0;
        if (i <= initialPhase) val = (costToDistribute * 0.20) / initialPhase;
        else if (i <= initialPhase + middlePhase) val = (costToDistribute * 0.60) / middlePhase;
        else val = (costToDistribute * 0.20) / finalPhase;
        if (i === 1) val += landTotalCost + data.documentationCost + data.otherCosts;
        val += (data.marketingCost / constructionTime);
        cashFlow.push({ month: i, value: val });
    }
    const marketingLaunch = data.marketingCost * (financials.marketingSplitLaunch / 100);
    const marketingMaintenance = data.marketingCost * ((100 - financials.marketingSplitLaunch) / 100);
    const cashExposure = landTotalCost + (totalConstruction * 0.2);
    const maxLandValue = vgv * 0.85 - totalConstruction - totalExpenses - taxesValue - salesCommission;
    const dashboard: DashboardData = {
        synthetic: { revenue: vgv, landCost: landTotalCost, constructionCost: totalConstruction, expenses: totalExpenses + salesCommission, taxes: taxesValue, result: finalResult, margin: margin },
        analytical: { revenue: { total: vgv }, land: { total: landTotalCost, acquisition: landValue, commission: landCommission, taxes: landTaxes }, construction: { total: totalConstruction, direct: directConstruction, indirect: indirectConstruction }, expenses: { total: totalExpenses + salesCommission, marketingLaunch, marketingMaintenance, admin: data.otherCosts + data.documentationCost, sales: salesCommission }, taxes: { total: taxesValue } },
        kpis: { landArea: data.landArea, builtArea: currentArea, privateArea: totalPrivateArea, efficiency, occupancy: data.zoning.occupancyRate, utilization: data.landArea > 0 ? currentArea / data.landArea : 0, vgvPerSqmPrivate: totalPrivateArea > 0 ? vgv / totalPrivateArea : 0, costPerSqmBuilt: currentArea > 0 ? totalConstruction / currentArea : 0, maxLandValue, cashExposure }
    };
    return { constructionCost, totalCost: totalCost + taxesValue + salesCommission, vgv, profit, roi, breakdown, constructionTime, cashFlow, permittedArea, dashboard };
  }, [data]);

  const handleStandardChange = (std: StandardType) => {
    const newCub = DEFAULT_CUB[std];
    setData(prev => ({ ...prev, standard: std, cubValue: newCub, segmentedCosts: { ...prev.segmentedCosts, standard: { ...prev.segmentedCosts.standard, pricePerSqm: newCub }, garage: { ...prev.segmentedCosts.garage, pricePerSqm: newCub * 0.7 }, leisure: { ...prev.segmentedCosts.leisure, pricePerSqm: newCub * 1.2 }, penthouse: { ...prev.segmentedCosts.penthouse, pricePerSqm: newCub * 1.1 }, foundation: { ...prev.segmentedCosts.foundation, pricePerSqm: newCub * 0.15 } } }));
  };
  const handleAiAnalysis = async () => { setIsAnalyzing(true); const result = await analyzeFeasibility(data, results); setAiAnalysis(result || ''); setIsAnalyzing(false); };
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  // --- RENDERING ---
  
  if (authLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">Carregando aplicação...</div>;
  }

  if (!session) {
      return <Auth />;
  }

  // Componente de Barra de Ação Flutuante
  const ActionBar = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-2xl z-40 flex justify-center">
        <div className="max-w-7xl w-full flex justify-between items-center px-4">
            <button type="button" onClick={handleNewProject} className="text-slate-600 font-bold text-sm hover:text-slate-900 hover:bg-slate-100 transition py-2 px-4 rounded border border-transparent hover:border-slate-200">+ Novo (Limpar)</button>
            <div className="flex gap-4">
                 <div className="hidden md:block text-right">
                     <p className="text-[10px] text-slate-400 font-bold uppercase">Resultado Líquido</p>
                     <p className={`font-bold ${results.profit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(results.profit)}</p>
                 </div>
                 <button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-8 rounded-xl shadow-lg shadow-emerald-200 transition-all transform active:scale-95 disabled:opacity-50 flex items-center gap-2">
                    {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                 </button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* --- MODAIS --- */}
      {showNewProjectModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-800 mb-2">Novo Empreendimento</h2>
                <p className="text-slate-600 mb-6 text-sm">Deseja iniciar um novo projeto do zero?<br/><br/><span className="font-bold text-red-500">Atenção:</span> Todos os dados não salvos da tela atual serão perdidos.</p>
                <div className="flex gap-3 justify-end"><button onClick={() => setShowNewProjectModal(false)} className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg">Cancelar</button><button onClick={confirmNewProject} className="px-6 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-lg">Confirmar e Limpar</button></div>
            </div>
        </div>
      )}

      {showLandSelectModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fadeIn">
                   <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-slate-800">Vincular Terreno ao Projeto</h2><button onClick={() => setShowLandSelectModal(false)} className="text-slate-400 hover:text-slate-600">✕</button></div>
                   <Suspense fallback={<div>Carregando terrenos...</div>}><LandRegistry onSelectForProject={handleLandSelect} /></Suspense>
               </div>
          </div>
      )}

      {showSqlModal && (
          <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-fadeIn">
                  <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-red-600 flex items-center gap-2">⚠️ Banco de Dados Desatualizado</h2><button onClick={() => setShowSqlModal(false)} className="text-slate-400 hover:text-slate-600">✕</button></div>
                  <p className="text-slate-600 mb-4 text-sm">Identificamos que seu banco de dados Supabase não possui as colunas necessárias para salvar este projeto. Por favor, copie o código abaixo e execute no <b>SQL Editor</b> do seu painel Supabase.</p>
                  <div className="bg-slate-900 rounded-lg p-4 mb-4 overflow-auto max-h-60 border border-slate-700"><pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">{SQL_FIX_SCRIPT}</pre></div>
                  <div className="flex gap-3 justify-end"><button onClick={() => setShowSqlModal(false)} className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-100 rounded-lg">Fechar</button><button onClick={() => { navigator.clipboard.writeText(SQL_FIX_SCRIPT); alert('Copiado para a área de transferência!'); }} className="px-6 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-lg">Copiar Código SQL</button></div>
              </div>
          </div>
      )}

      <header className="bg-slate-900 text-white py-4 px-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('inputs')}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">CalcConstru Pro</h1>
              <p className="text-slate-400 text-xs font-medium">Viabilidade & Gestão Supabase</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Main Tabs */}
             <div className="flex bg-slate-800 rounded-lg p-1 overflow-x-auto">
                <button onClick={() => setActiveTab('inputs')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'inputs' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>🛠️ Edição</button>
                <button onClick={() => { setActiveTab('dashboard'); setDashboardSelectionMode(true); }} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>📊 Dashboard</button>
                <button onClick={() => setActiveTab('history')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>📚 Projetos</button>
                <button onClick={() => setActiveTab('lands')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'lands' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>📍 Terrenos</button>
             </div>
             
             <div className="flex items-center gap-2 border-l border-slate-700 pl-4 ml-2">
                 <button onClick={() => setActiveTab('profile')} className={`p-2 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`} title="Perfil e Conta">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                 </button>
                 <button onClick={handleLogout} className="text-slate-400 hover:text-white font-bold text-xs p-2 uppercase tracking-wider" title="Sair">
                    Sair
                 </button>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-24">
        
        {activeTab === 'profile' && (
            <div className="max-w-6xl mx-auto"><Suspense fallback={<div className="flex justify-center py-20">Carregando Perfil...</div>}><ProfileSection /></Suspense></div>
        )}

        {activeTab === 'lands' && (
            <div className="max-w-6xl mx-auto"><Suspense fallback={<div className="flex justify-center py-20">Carregando Terrenos...</div>}><LandRegistry /></Suspense></div>
        )}

        {/* --- LISTA DE EMPREENDIMENTOS (ANTIGO HISTÓRICO) --- */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 animate-fadeIn">
             <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold flex items-center gap-3">Meus Empreendimentos</h2><button onClick={handleNewProject} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 shadow-md transition-all"><span>+ Novo Empreendimento</span></button></div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div onClick={handleNewProject} className="cursor-pointer bg-white border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 p-6 rounded-2xl transition-all flex flex-col items-center justify-center min-h-[160px] group">
                    <div className="bg-blue-100 p-3 rounded-full mb-3 group-hover:bg-blue-200 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg></div>
                    <span className="font-bold text-blue-600 group-hover:text-blue-800">Criar Novo Empreendimento</span>
                 </div>
                 {projects.map((p) => {
                   let vgv = 0;
                   if (p.units && p.units.length > 0) { vgv = p.units.reduce((acc: any, u: any) => acc + (u.quantity * u.area * u.pricePerSqm), 0); } else if (p.quickFeasibility) { const built = p.quickFeasibility.landArea * (p.quickFeasibility.constructionPotential || p.zoning?.utilizationCoefficient || 1); const priv = built * (p.quickFeasibility.efficiency / 100); vgv = priv * p.quickFeasibility.salePricePerSqm; }
                   return (
                     <div key={p.id} onClick={() => { setData(p); setActiveTab('inputs'); }} className="group cursor-pointer bg-slate-50 hover:bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10"><button onClick={(e) => handleDelete(p.id!, e)} className="text-red-500 hover:text-red-700 font-bold px-2">✕</button></div>
                       <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{p.type} • {p.standard}</span>
                       <h3 className="font-bold text-slate-900 text-lg mb-2 truncate pr-6">{p.name}</h3>
                       <p className="text-emerald-600 font-bold">{formatCurrency(vgv)}</p>
                       <p className="text-xs text-slate-500 mt-1">{p.units && p.units.length > 0 ? 'Viabilidade Detalhada' : 'Viabilidade Macro'}</p>
                     </div>
                   );
                 })}
             </div>
          </div>
        )}

        {/* --- DASHBOARD ANALÍTICO --- */}
        {activeTab === 'dashboard' && (
            <div className="max-w-6xl mx-auto">
               {dashboardSelectionMode ? (
                   <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 animate-fadeIn">
                      <div className="text-center mb-10"><h2 className="text-2xl font-bold mb-2">Selecione um Empreendimento</h2><p className="text-slate-500">Escolha um projeto para visualizar os indicadores de desempenho e custos detalhados.</p></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div onClick={handleNewProject} className="cursor-pointer bg-white border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 p-6 rounded-2xl transition-all flex flex-col items-center justify-center min-h-[140px] group"><span className="font-bold text-slate-400 group-hover:text-indigo-600">+ Novo Projeto</span></div>
                        {projects.map((p) => {
                            let vgv = 0;
                            if (p.units && p.units.length > 0) { vgv = p.units.reduce((acc: any, u: any) => acc + (u.quantity * u.area * u.pricePerSqm), 0); } else if (p.quickFeasibility) { const built = p.quickFeasibility.landArea * (p.quickFeasibility.constructionPotential || p.zoning?.utilizationCoefficient || 1); const priv = built * (p.quickFeasibility.efficiency / 100); vgv = priv * p.quickFeasibility.salePricePerSqm; }
                            return (
                                <div key={p.id} onClick={() => { setData(p); setDashboardSelectionMode(false); }} className="cursor-pointer bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 p-6 rounded-2xl transition-all shadow-sm hover:shadow-md">
                                    <h3 className="font-bold text-slate-800 mb-1">{p.name}</h3>
                                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">{p.type} • {p.standard}</p>
                                    <div className="flex justify-between items-center border-t border-slate-200 pt-3"><span className="text-xs font-bold text-slate-400">VGV Estimado</span><span className="text-sm font-bold text-indigo-700">{formatCurrency(vgv)}</span></div>
                                </div>
                            );
                        })}
                      </div>
                   </div>
               ) : (
                   <div className="space-y-6">
                       <div className="flex items-center justify-between"><h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded">DASHBOARD</span> {data.name}</h2><button onClick={() => setDashboardSelectionMode(true)} className="text-sm text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1">← Trocar Empreendimento</button></div>
                       <DashboardSection data={results.dashboard} />
                   </div>
               )}
            </div>
        )}

        {/* --- VIABILIDADE DETALHADA (AGORA "EDIÇÃO") --- */}
        {activeTab === 'inputs' && (
          <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            {/* Colunas e Seções de Input (Omitidos para brevidade, mas o conteúdo é o mesmo) */}
            <div className="lg:col-span-5 space-y-6">
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-blue-600 rounded-full"></span>Dados do Projeto</h2>
                <div className="space-y-4">
                  <InputField label="Nome do Empreendimento" type="text" value={data.name} onChange={(v) => setData(prev => ({...prev, name: v}))} />
                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500 uppercase">Tipo</label><select className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={data.type} onChange={(e) => setData(prev => ({...prev, type: e.target.value as ProjectType}))}>{Object.values(ProjectType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                     <div className="flex flex-col gap-1.5"><label className="text-xs font-semibold text-slate-500 uppercase">Padrão</label><select className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={data.standard} onChange={(e) => handleStandardChange(e.target.value as StandardType)}>{Object.values(StandardType).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                  </div>
                  <InputField label="Eficiência de Projeto (%)" value={data.quickFeasibility?.efficiency || 70} onChange={(v) => updateQuick('efficiency', v)} />
                </div>
              </section>

              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative">
                <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-teal-500 rounded-full"></span>Zoneamento & Terreno</h2><button onClick={() => setShowLandSelectModal(true)} className="text-xs bg-teal-100 text-teal-700 px-3 py-1.5 rounded-lg font-bold hover:bg-teal-200 transition-colors">📍 Importar de Cadastro</button></div>
                <div className="grid grid-cols-2 gap-4 mb-6"><InputField label="Área Terreno (m²)" value={data.landArea} onChange={(v) => setData(prev => ({...prev, landArea: v}))} /><InputField label="Valor Terreno (R$)" prefix="R$" value={data.landValue} onChange={(v) => { setData(prev => ({ ...prev, landValue: v, quickFeasibility: { ...(prev.quickFeasibility || INITIAL_DATA.quickFeasibility), askingPrice: v } })); }} /></div>
                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200"><InputField label="% Permuta Física" value={data.quickFeasibility?.physicalSwap || 0} onChange={(v) => updateQuick('physicalSwap', v)} /><InputField label="% Permuta Financeira" value={data.quickFeasibility?.financialSwap || 0} onChange={(v) => updateQuick('financialSwap', v)} /></div>
                <div className="grid grid-cols-2 gap-3 mb-6"><InputField label="Altura Máx. (m)" value={data.zoning.maxHeight} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, maxHeight: v}}))} /><div className="bg-teal-50 p-3 rounded-xl border border-teal-100 flex flex-col justify-center"><span className="text-xs font-bold text-teal-700 uppercase">Potencial Construtivo</span><span className="text-lg font-bold text-teal-900">{results.permittedArea.toLocaleString()} m²</span></div></div>
                <div className="grid grid-cols-3 gap-3 mb-6"><InputField label="T. Ocupação (%)" value={data.zoning?.occupancyRate || 0} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, occupancyRate: v}}))} /><InputField label="Coef. Aprov." value={data.zoning?.utilizationCoefficient || 0} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, utilizationCoefficient: v}}))} step="0.1" /><InputField label="Afastamento (m)" value={data.zoning?.minSetback || 0} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, minSetback: v}}))} /></div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200"><p className="text-xs font-bold text-slate-500 uppercase mb-3">Pavimentos</p><div className="grid grid-cols-2 gap-3"><InputField label="Garagem" value={data.zoning?.garageFloors || 0} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, garageFloors: v}}))} /><InputField label="Tipo (Padrão)" value={data.zoning?.standardFloors || 0} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, standardFloors: v}}))} /><InputField label="Lazer/Comum" value={data.zoning?.leisureFloors || 0} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, leisureFloors: v}}))} /><InputField label="Cobertura" value={data.zoning?.penthouseFloors || 0} onChange={(v) => setData(prev => ({...prev, zoning: {...prev.zoning, penthouseFloors: v}}))} /></div></div>
              </section>

               <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-orange-400 rounded-full"></span>Mídia e Documentos</h2>
                <div className="space-y-4">
                   <div className="relative"><InputField label="Link da Localização (Google Maps)" type="text" value={data.media?.locationLink || ''} onChange={(v) => setData(prev => ({...prev, media: {...prev.media, locationLink: v}}))} />{data.media?.locationLink && (<a href={data.media.locationLink} target="_blank" rel="noopener noreferrer" className="absolute top-0 right-0 text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>Abrir Link</a>)}</div>
                   <div className="p-3 bg-slate-50 rounded-lg border border-slate-200"><p className="text-xs font-bold text-slate-500 mb-2">GALERIA DE IMAGENS (URLs)</p><div className="space-y-2">{data.media?.imageUrls?.map((url, idx) => (<div key={idx} className="flex gap-2"><input className="flex-1 text-xs p-1 border rounded bg-white" value={url} readOnly /><button onClick={() => { const newUrls = data.media.imageUrls.filter((_, i) => i !== idx); setData(prev => ({...prev, media: {...prev.media, imageUrls: newUrls}})); }} className="text-red-500 font-bold">×</button></div>))}<div className="flex gap-2"><input id="newImgUrl" placeholder="https://..." className="flex-1 text-xs p-1.5 border rounded" /><button onClick={() => { const el = document.getElementById('newImgUrl') as HTMLInputElement; if(el.value) { setData(prev => ({...prev, media: {...prev.media, imageUrls: [...(prev.media.imageUrls || []), el.value]}})); el.value = ''; } }} className="bg-blue-600 text-white text-xs px-2 rounded">Adicionar</button></div></div></div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-7 space-y-6">
              
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-red-500 rounded-full"></span>Premissas Financeiras & Taxas</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4"><InputField label="% Comissão Compra (Terr.)" value={data.financials?.landCommissionPct || 0} onChange={(v) => updateFinancials('landCommissionPct', v)} /><InputField label="% ITBI e Registro (Terr.)" value={data.financials?.landRegistryPct || 0} onChange={(v) => updateFinancials('landRegistryPct', v)} /><InputField label="% Impostos Venda (RET)" value={data.financials?.taxesPct || 0} step="0.01" onChange={(v) => updateFinancials('taxesPct', v)} /><InputField label="% Comissão Venda" value={data.financials?.saleCommissionPct || 0} onChange={(v) => updateFinancials('saleCommissionPct', v)} /><InputField label="% Marketing no Lançamento" value={data.financials?.marketingSplitLaunch || 0} onChange={(v) => updateFinancials('marketingSplitLaunch', v)} /><InputField label="% Custo Indireto (Obra)" value={data.financials?.indirectCostsPct || 0} onChange={(v) => updateFinancials('indirectCostsPct', v)} /></div>
              </section>

              <section className="bg-indigo-50 p-6 rounded-2xl shadow-sm border border-indigo-100">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900"><span className="w-1 h-6 bg-indigo-600 rounded-full"></span>Estimativas Macro (Referências)</h2>
                  <p className="text-xs text-indigo-700 mb-4">Estes valores serão usados para cálculo preliminar caso você não cadastre unidades específicas abaixo.</p>
                  <div className="grid grid-cols-2 gap-4"><InputField label="Preço Médio Venda (R$/m²)" prefix="R$" value={data.quickFeasibility?.salePricePerSqm || 0} onChange={(v) => updateQuick('salePricePerSqm', v)} /><InputField label="Custo Obra (R$/m²)" prefix="R$" value={data.quickFeasibility?.constructionCostPerSqm || 0} onChange={(v) => updateQuick('constructionCostPerSqm', v)} /></div>
              </section>

              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-indigo-600 rounded-full"></span>Custos da Obra</h2><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-slate-400 uppercase">CUB Detalhado</span><button onClick={() => setData(prev => ({...prev, useSegmentedCosts: !prev.useSegmentedCosts, useDetailedCosts: false}))} className={`w-10 h-5 rounded-full relative transition-all ${data.useSegmentedCosts ? 'bg-indigo-600' : 'bg-slate-200'}`}><div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${data.useSegmentedCosts ? 'left-6' : 'left-1'}`}></div></button></div></div>

                {data.useSegmentedCosts ? (
                   <div className="space-y-4 animate-fadeIn">
                      <div className="text-xs text-slate-500 font-medium mb-2 bg-indigo-50 p-2 rounded border border-indigo-100">Insira a Área (m²) e o custo CUB Unitário (R$/m²) para cada setor.</div>
                      <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-500 uppercase mb-1"><div className="col-span-4">Setor</div><div className="col-span-4">Área m²</div><div className="col-span-4">R$/m²</div></div>
                      <div className="grid grid-cols-12 gap-2 items-center"><div className="col-span-4 text-sm font-medium text-slate-700">Garagem</div><div className="col-span-4"><InputField label="" value={data.segmentedCosts.garage.area} onChange={(v) => updateSegmentedCost('garage', 'area', v)} /></div><div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.garage.pricePerSqm} onChange={(v) => updateSegmentedCost('garage', 'pricePerSqm', v)} /></div></div>
                      <div className="grid grid-cols-12 gap-2 items-center"><div className="col-span-4 text-sm font-medium text-slate-700">Lazer/Comum</div><div className="col-span-4"><InputField label="" value={data.segmentedCosts.leisure.area} onChange={(v) => updateSegmentedCost('leisure', 'area', v)} /></div><div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.leisure.pricePerSqm} onChange={(v) => updateSegmentedCost('leisure', 'pricePerSqm', v)} /></div></div>
                      <div className="grid grid-cols-12 gap-2 items-center"><div className="col-span-4 text-sm font-medium text-slate-700">Apt. Tipo</div><div className="col-span-4"><InputField label="" value={data.segmentedCosts.standard.area} onChange={(v) => updateSegmentedCost('standard', 'area', v)} /></div><div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.standard.pricePerSqm} onChange={(v) => updateSegmentedCost('standard', 'pricePerSqm', v)} /></div></div>
                      <div className="grid grid-cols-12 gap-2 items-center"><div className="col-span-4 text-sm font-medium text-slate-700">Cobertura</div><div className="col-span-4"><InputField label="" value={data.segmentedCosts.penthouse.area} onChange={(v) => updateSegmentedCost('penthouse', 'area', v)} /></div><div className="col-span-4"><InputField label="" prefix="R$" value={data.segmentedCosts.penthouse.pricePerSqm} onChange={(v) => updateSegmentedCost('penthouse', 'pricePerSqm', v)} /></div></div>
                      <div className="border-t border-slate-200 pt-3 mt-2"><div className="grid grid-cols-12 gap-2 items-center"><div className="col-span-4 text-sm font-medium text-slate-700">Fundação</div><div className="col-span-4 text-xs text-slate-400 italic">Aplicado no Total</div><div className="col-span-4"><InputField label="R$/m² (Total)" prefix="R$" value={data.segmentedCosts.foundation.pricePerSqm} onChange={(v) => updateSegmentedCost('foundation', 'pricePerSqm', v)} /></div></div></div>
                      <div className="bg-slate-100 p-3 rounded-lg flex justify-between items-center text-sm font-bold text-slate-700"><span>Área Construída Total:</span><span>{(data.segmentedCosts.garage.area + data.segmentedCosts.leisure.area + data.segmentedCosts.standard.area + data.segmentedCosts.penthouse.area).toLocaleString()} m²</span></div>
                   </div>
                ) : (
                   <>
                    {data.useDetailedCosts ? (
                      <div className="grid grid-cols-2 gap-4 animate-fadeIn"><InputField label="Estrutura" value={data.detailedCosts.structure} onChange={(v) => updateDetailedCost('structure', v)} prefix="R$" /><InputField label="Alvenaria" value={data.detailedCosts.masonry} onChange={(v) => updateDetailedCost('masonry', v)} prefix="R$" /><InputField label="Elétrica" value={data.detailedCosts.electrical} onChange={(v) => updateDetailedCost('electrical', v)} prefix="R$" /><InputField label="Hidráulica" value={data.detailedCosts.plumbing} onChange={(v) => updateDetailedCost('plumbing', v)} prefix="R$" /><InputField label="Acabamento" value={data.detailedCosts.finishing} onChange={(v) => updateDetailedCost('finishing', v)} prefix="R$" /><InputField label="Cobertura" value={data.detailedCosts.roofing} onChange={(v) => updateDetailedCost('roofing', v)} prefix="R$" /></div>
                    ) : (
                      <div className="space-y-4"><InputField label="Área Construída Total (m²)" value={data.area} onChange={(v) => setData(prev => ({...prev, area: v}))} /><InputField label="CUB Médio (R$/m²)" value={data.cubValue} onChange={(v) => setData(prev => ({...prev, cubValue: v}))} prefix="R$" step="0.01" /></div>
                    )}
                    <div className="mt-4 pt-4 border-t border-slate-100"><InputField label="Custo Fundação (Total)" value={data.foundationCost} onChange={(v) => setData(prev => ({...prev, foundationCost: v}))} prefix="R$" /></div>
                   </>
                )}
                
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4"><InputField label="Projetos/Doc" value={data.documentationCost} onChange={(v) => setData(prev => ({...prev, documentationCost: v}))} prefix="R$" /><InputField label="Marketing" value={data.marketingCost} onChange={(v) => setData(prev => ({...prev, marketingCost: v}))} prefix="R$" /><InputField label="Outros Custos" value={data.otherCosts} onChange={(v) => setData(prev => ({...prev, otherCosts: v}))} prefix="R$" /></div>
              </section>

              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-6"><h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><span className="w-1 h-6 bg-emerald-600 rounded-full"></span>Mix de Apartamentos (Detalhado)</h2><button onClick={addUnit} className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-200 transition-colors">+ Adicionar Tipo</button></div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                          <thead><tr className="border-b border-slate-100 text-left text-xs text-slate-400 uppercase tracking-wider"><th className="pb-3 pl-2 w-32">Nome</th><th className="pb-3 w-16">Qtd</th><th className="pb-3 w-20">Área</th><th className="pb-3 w-28">R$/m²</th><th className="pb-3 w-32">Unitário (R$)</th><th className="pb-3 w-32 text-right">Total (VGV)</th><th className="pb-3 w-10"></th></tr></thead>
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
                          <tfoot><tr className="bg-slate-50 font-bold text-slate-800"><td className="py-3 px-2">TOTAL</td><td className="py-3 px-2">{data.units?.reduce((a, b) => a + b.quantity, 0)} un</td><td className="py-3 px-2">{data.units?.reduce((a, b) => a + (b.area * b.quantity), 0).toLocaleString()} m²</td><td></td><td></td><td className="py-3 text-right text-emerald-600">{formatCurrency(results.vgv)}</td><td></td></tr></tfoot>
                      </table>
                  </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Custo Total</p><h3 className="text-2xl font-bold text-slate-900">{formatCurrency(results.totalCost)}</h3></div><div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">VGV Total</p><h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(results.vgv)}</h3></div><div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800 text-white"><p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">Lucro Líquido</p><h3 className="text-2xl font-black">{formatCurrency(results.profit)}</h3><div className="flex justify-between items-center mt-2 text-xs"><span>ROI: <span className={results.roi > 20 ? 'text-green-400' : 'text-amber-400'}>{results.roi.toFixed(1)}%</span></span><span>Prazo: {results.constructionTime} meses</span></div></div></div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]"><h3 className="text-sm font-bold text-slate-700 mb-4">Composição de Custos</h3><Suspense fallback={<div className="h-40 flex items-center justify-center">Carregando...</div>}><CostBreakdownChart results={results} /></Suspense></div><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[300px]"><h3 className="text-sm font-bold text-slate-700 mb-4">Fluxo de Caixa (Previsão)</h3><Suspense fallback={<div className="h-40 flex items-center justify-center">Carregando...</div>}><CashFlowChart results={results} /></Suspense></div></div>

              <div className="bg-white p-8 rounded-3xl shadow-xl text-slate-900 border border-slate-200 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10"></div>
                 <div className="relative z-10"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><span className="text-2xl">✨</span> Análise IA</h2><button onClick={handleAiAnalysis} disabled={isAnalyzing} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 disabled:opacity-50">{isAnalyzing ? 'Processando...' : 'Gerar Análise'}</button></div>{aiAnalysis ? <div className="prose prose-sm text-slate-600 bg-slate-50 p-6 rounded-xl border border-slate-100" dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>') }} /> : <p className="text-slate-400 text-sm text-center py-8">Solicite uma análise inteligente do seu projeto.</p>}</div>
              </div>
            </div>
          </div>
          <ActionBar />
          </>
        )}
      </main>
    </div>
  );
};

export default App;
