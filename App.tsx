
import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { ProjectData, ProjectType, StandardType, CalculationResults, DetailedCosts } from './types';
import { DEFAULT_CUB, INITIAL_DATA } from './constants';
import { InputField } from './components/InputSection';
import { analyzeFeasibility } from './services/geminiService';
import { saveProject, fetchProjects, deleteProject, testConnection } from './services/supabaseClient';

// Lazy load heavy components to fix chunk size warning and improve performance
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
  const [activeTab, setActiveTab] = useState<'inputs' | 'history' | 'settings'>('inputs');
  const [isDbConnected, setIsDbConnected] = useState(false);

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
      setProjects(list);
    } catch (e) {
      console.warn("Supabase not configured or table missing, using local storage simulation.");
      const local = localStorage.getItem('calcconstru_projects');
      if (local) setProjects(JSON.parse(local));
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleNewProject = () => {
    if (confirm("Deseja iniciar um novo empreendimento? Os dados não salvos serão perdidos.")) {
      // Create a clean copy of initial data without ID
      const newData = { ...INITIAL_DATA };
      // Ensure we don't carry over any ID from previous state if it was somehow merged differently, 
      // though INITIAL_DATA is clean. 
      // We set state to this clean object.
      setData(newData);
      setAiAnalysis('');
      setActiveTab('inputs');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // If we are editing an existing one (has ID), use it. If not, create new UUID.
      // However, if the user just clicked "New Project", data has no ID, so it creates a new one.
      const projectToSave = { ...data, id: data.id || crypto.randomUUID() };
      await saveProject(projectToSave);
      
      // Update local state with the saved data (which now definitely has an ID)
      setData(projectToSave);
      alert("Projeto salvo com sucesso no Banco de Dados!");
    } catch (e: any) {
      console.error(e);
      // Fallback local storage
      const projectToSave = { ...data, id: data.id || crypto.randomUUID() };
      
      // Try load existing
      let localProjects = [];
      try {
          localProjects = JSON.parse(localStorage.getItem('calcconstru_projects') || '[]');
      } catch {}
      
      const newList = [projectToSave, ...localProjects.filter((p: any) => p.id !== projectToSave.id)];
      localStorage.setItem('calcconstru_projects', JSON.stringify(newList));
      setProjects(newList);
      setData(projectToSave);
      
      if (e.message?.includes('Supabase não configurado') || e.message?.includes('Failed to fetch')) {
         alert("Salvo localmente. Configure o Supabase na aba Configurações para salvar na nuvem.");
      } else {
         alert("Salvo localmente (Erro ao conectar com Supabase).");
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

  const results = useMemo<CalculationResults>(() => {
    let constructionCost = 0;
    if (data.useDetailedCosts) {
      const d = data.detailedCosts;
      const m2Cost = d.structure + d.masonry + d.electrical + d.plumbing + d.finishing + d.roofing;
      constructionCost = data.area * m2Cost;
    } else {
      constructionCost = data.area * data.cubValue;
    }

    const vgv = data.unitPrice * data.totalUnits;
    const totalCost = constructionCost + data.landValue + data.foundationCost + data.documentationCost + data.marketingCost + data.otherCosts;
    const profit = vgv - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    const breakdown = [
      { category: 'Construção', value: constructionCost, percentage: (constructionCost / totalCost) * 100 },
      { category: 'Terreno', value: data.landValue, percentage: (data.landValue / totalCost) * 100 },
      { category: 'Fundação', value: data.foundationCost, percentage: (data.foundationCost / totalCost) * 100 },
      { category: 'Documentação', value: data.documentationCost, percentage: (data.documentationCost / totalCost) * 100 },
      { category: 'Marketing', value: data.marketingCost, percentage: (data.marketingCost / totalCost) * 100 },
      { category: 'Outros', value: data.otherCosts, percentage: (data.otherCosts / totalCost) * 100 },
    ];

    // Estimativa de Prazo (Meses)
    let timeEstimate = 0;
    if (data.type === ProjectType.HOUSE) {
        timeEstimate = 5 + (data.area / 30);
    } else {
        timeEstimate = 12 + (data.area / 50);
    }
    const constructionTime = Math.max(3, Math.ceil(timeEstimate));

    // Fluxo de Caixa Simples (Distribuição Normal/Sino simplificada)
    // Distribuímos apenas o Custo de Construção + Fundação ao longo do tempo
    // Terreno e Documentação geralmente são no início (Mês 1)
    const costToDistribute = constructionCost + data.foundationCost;
    const cashFlow = [];
    
    // Distribuição: 20% inicial (mobilização), 60% meio (obra pesada), 20% final (acabamento)
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
        
        // Adiciona Terreno e Doc no Mês 1
        if (i === 1) val += data.landValue + data.documentationCost + data.otherCosts;

        // Adiciona Marketing distribuído linearmente
        val += (data.marketingCost / constructionTime);

        cashFlow.push({ month: i, value: val });
    }

    return { constructionCost, totalCost, vgv, profit, roi, breakdown, constructionTime, cashFlow };
  }, [data]);

  const handleStandardChange = (std: StandardType) => {
    setData(prev => ({ ...prev, standard: std, cubValue: DEFAULT_CUB[std] }));
  };

  const updateDetailedCost = (key: keyof DetailedCosts, val: number) => {
    setData({
      ...data,
      detailedCosts: { ...data.detailedCosts, [key]: val }
    });
  };

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await analyzeFeasibility(data, results);
    setAiAnalysis(result || '');
    setIsAnalyzing(false);
  };

  const formatCurrency = (val: number) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white py-4 px-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('inputs')}>
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
             {activeTab === 'inputs' && (
               <>
                <button 
                  onClick={handleNewProject}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all border border-slate-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Novo
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
               </>
             )}

             <div className="flex bg-slate-800 rounded-lg p-1">
                <button 
                  onClick={() => setActiveTab('inputs')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'inputs' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Calculadora
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  Histórico
                </button>
             </div>
             
             <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                {/* Status Badge */}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${isDbConnected ? 'bg-green-900/40 text-green-300 border-green-800' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${isDbConnected ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
                    <span className="hidden md:inline">{isDbConnected ? 'Supabase Online' : 'Offline'}</span>
                </div>

                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`p-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Configurações"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-20">
        
        {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto">
                <Suspense fallback={<div className="flex justify-center py-20 text-slate-400">Carregando configurações...</div>}>
                    <SettingsSection onConfigUpdate={checkDbConnection} />
                </Suspense>
            </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 animate-fadeIn">
             <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
               <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
               Histórico de Empreendimentos
             </h2>
             {isLoadingProjects ? (
               <div className="py-12 text-center text-slate-400">Carregando seus projetos...</div>
             ) : projects.length === 0 ? (
               <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                 Nenhum projeto salvo ainda.
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {projects.map((p) => {
                   const detailedCostsSum = p.useDetailedCosts 
                     ? (Object.values(p.detailedCosts) as number[]).reduce((acc: number, val: number) => acc + val, 0) 
                     : p.cubValue;
                   const totalCost = (p.area * detailedCostsSum) + p.landValue + p.foundationCost + p.documentationCost + p.marketingCost + p.otherCosts;
                   const vgv = p.unitPrice * p.totalUnits;
                   const roi = totalCost > 0 ? ((vgv - totalCost) / totalCost) * 100 : 0;

                   return (
                     <div 
                       key={p.id}
                       onClick={() => { setData(p); setActiveTab('inputs'); }}
                       className="group cursor-pointer bg-slate-50 hover:bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all relative overflow-hidden"
                     >
                       <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button 
                            onClick={(e) => handleDelete(p.id!, e)}
                            className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            title="Excluir"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                       </div>
                       <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{p.type} • {p.standard}</span>
                       <h3 className="font-bold text-slate-900 text-lg mb-2 truncate pr-6">{p.name}</h3>
                       
                       {/* Broker Info in Card (Optional, displayed if exists) */}
                       {p.brokerName && (
                          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                             </svg>
                             <span className="truncate">{p.brokerName}</span>
                          </div>
                       )}

                       <div className="flex justify-between items-end mt-4">
                         <div className="text-slate-500 text-xs">
                           <p>{p.area} m²</p>
                           <p>{p.totalUnits} unidades</p>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] text-slate-400 font-medium uppercase">ROI Projetado</p>
                           <p className="text-xl font-black text-slate-900">
                             {roi.toFixed(1)}%
                           </p>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
          </div>
        )}
        
        {activeTab === 'inputs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fadeIn">
            
            {/* Form Side */}
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
                  <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                  Dados Básicos
                </h2>
                <div className="space-y-4">
                  <InputField 
                    label="Nome do Projeto" 
                    type="text" 
                    value={data.name} 
                    onChange={(v) => setData({...data, name: v})} 
                  />
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Obra</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(ProjectType).map(t => (
                        <button
                          key={t}
                          onClick={() => setData({...data, type: t as ProjectType})}
                          className={`py-2 rounded-lg text-sm font-medium transition-all ${data.type === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Padrão Global</label>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.values(StandardType).map(s => (
                        <button
                          key={s}
                          onClick={() => handleStandardChange(s as StandardType)}
                          className={`py-2 rounded-lg text-xs font-medium transition-all ${data.standard === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <InputField 
                    label="Área Total (m²)" 
                    value={data.area} 
                    onChange={(v) => setData({...data, area: v})} 
                  />
                </div>
              </section>

              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <span className="w-1 h-6 bg-indigo-600 rounded-full"></span>
                    Custo Construção
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Detalhamento m²</span>
                    <button 
                      onClick={() => setData({...data, useDetailedCosts: !data.useDetailedCosts})}
                      className={`w-10 h-5 rounded-full relative transition-all ${data.useDetailedCosts ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${data.useDetailedCosts ? 'left-6' : 'left-1'}`}></div>
                    </button>
                  </div>
                </div>

                {data.useDetailedCosts ? (
                  <div className="space-y-4 animate-fadeIn">
                    <InputField label="Estrutura (R$/m²)" value={data.detailedCosts.structure} onChange={(v) => updateDetailedCost('structure', v)} prefix="R$" />
                    <InputField label="Alvenaria (R$/m²)" value={data.detailedCosts.masonry} onChange={(v) => updateDetailedCost('masonry', v)} prefix="R$" />
                    <InputField label="Elétrica (R$/m²)" value={data.detailedCosts.electrical} onChange={(v) => updateDetailedCost('electrical', v)} prefix="R$" />
                    <InputField label="Hidráulica (R$/m²)" value={data.detailedCosts.plumbing} onChange={(v) => updateDetailedCost('plumbing', v)} prefix="R$" />
                    <InputField label="Acabamento (R$/m²)" value={data.detailedCosts.finishing} onChange={(v) => updateDetailedCost('finishing', v)} prefix="R$" />
                    <InputField label="Cobertura (R$/m²)" value={data.detailedCosts.roofing} onChange={(v) => updateDetailedCost('roofing', v)} prefix="R$" />
                  </div>
                ) : (
                  <InputField 
                    label="CUB Sugerido / Atualizado" 
                    value={data.cubValue} 
                    onChange={(v) => setData({...data, cubValue: v})} 
                    prefix="R$"
                    step="0.01"
                  />
                )}
              </section>

              <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
                  <span className="w-1 h-6 bg-purple-600 rounded-full"></span>
                  Corretor & Notas
                </h2>
                <div className="space-y-4">
                  <InputField 
                    label="Nome do Corretor" 
                    type="text" 
                    value={data.brokerName || ''} 
                    onChange={(v) => setData({...data, brokerName: v})} 
                  />
                  <InputField 
                    label="Telefone do Corretor" 
                    type="text" 
                    value={data.brokerPhone || ''} 
                    onChange={(v) => setData({...data, brokerPhone: v})} 
                  />
                   <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Observações</label>
                      <textarea
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none h-24 text-sm"
                        value={data.observations || ''}
                        onChange={(e) => setData({...data, observations: e.target.value})}
                        placeholder="Insira detalhes adicionais sobre o projeto..."
                      />
                   </div>
                </div>
              </section>
            </div>

            {/* Results Side */}
            <div className="lg:col-span-8 space-y-6 lg:space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Investimento Fixo */}
                 <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
                      <span className="w-1 h-6 bg-amber-500 rounded-full"></span>
                      Investimento Fixo
                    </h2>
                    <div className="space-y-4">
                      <InputField label="Terreno" value={data.landValue} onChange={(v) => setData({...data, landValue: v})} prefix="R$" />
                      <InputField label="Fundação" value={data.foundationCost} onChange={(v) => setData({...data, foundationCost: v})} prefix="R$" />
                      <InputField label="Documentação" value={data.documentationCost} onChange={(v) => setData({...data, documentationCost: v})} prefix="R$" />
                      <InputField label="Marketing" value={data.marketingCost} onChange={(v) => setData({...data, marketingCost: v})} prefix="R$" />
                      <InputField label="Outros" value={data.otherCosts} onChange={(v) => setData({...data, otherCosts: v})} prefix="R$" />
                    </div>
                 </section>

                 {/* Premissas de Venda */}
                 <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800">
                      <span className="w-1 h-6 bg-emerald-600 rounded-full"></span>
                      Premissas de Venda (VGV)
                    </h2>
                    <div className="space-y-4">
                      <InputField label="Preço p/ Unidade" value={data.unitPrice} onChange={(v) => setData({...data, unitPrice: v})} prefix="R$" />
                      <InputField label="Total de Unidades" value={data.totalUnits} onChange={(v) => setData({...data, totalUnits: v})} />
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-slate-100">
                       <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Estimativa de Prazo</h3>
                       <div className="flex items-center gap-3">
                         <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                         </div>
                         <div>
                            <span className="text-2xl font-bold text-slate-800">{results.constructionTime}</span>
                            <span className="text-sm text-slate-500 ml-1">Meses de Obra</span>
                         </div>
                       </div>
                    </div>
                 </section>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Custo Total Obra</p>
                  <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(results.totalCost)}</h3>
                  <p className="text-slate-400 text-[10px] mt-2 italic">Inclui Terreno e Documentos</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">VGV (Faturamento)</p>
                  <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(results.vgv)}</h3>
                  <p className="text-slate-400 text-[10px] mt-2 italic">Valor Geral de Vendas</p>
                </div>
                <div className="bg-slate-900 p-5 rounded-2xl shadow-md border border-slate-800">
                  <p className="text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">Lucro Líquido</p>
                  <h3 className="text-2xl font-black text-white">{formatCurrency(results.profit)}</h3>
                  <div className="flex justify-between items-center mt-2">
                     <span className="text-slate-500 text-[10px] italic">Retorno sobre Invest.</span>
                     <span className={`text-xs font-black px-2 py-0.5 rounded ${results.roi > 20 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                      ROI: {results.roi.toFixed(1)}%
                     </span>
                  </div>
                </div>
              </div>

              {/* Charts and Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[350px]">
                   <h2 className="text-lg font-bold mb-4 text-slate-800 flex justify-between items-center">
                     <span>Composição de Custos</span>
                     <span className="text-xs text-slate-400 font-normal">Baseado em {data.area}m²</span>
                   </h2>
                   <Suspense fallback={<div className="h-64 flex items-center justify-center text-slate-300">Carregando gráfico...</div>}>
                      <CostBreakdownChart results={results} />
                   </Suspense>
                 </div>
                 
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[350px]">
                   <h2 className="text-lg font-bold mb-4 text-slate-800 flex justify-between items-center">
                     <span>Fluxo de Caixa (Mensal)</span>
                     <span className="text-xs text-slate-400 font-normal">Estimativa de Desembolso</span>
                   </h2>
                   <Suspense fallback={<div className="h-64 flex items-center justify-center text-slate-300">Carregando fluxo...</div>}>
                      <CashFlowChart results={results} />
                   </Suspense>
                 </div>
              </div>
              
              {/* Detailed Table (Full Width) */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <h2 className="text-lg font-bold mb-4 text-slate-800">Detalhamento dos Valores</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                     {results.breakdown.map((item, i) => (
                       <div key={i} className="flex flex-col gap-1 pb-3 border-b border-slate-50 last:border-0">
                         <div className="flex justify-between text-sm">
                           <span className="text-slate-600 font-medium">{item.category}</span>
                           <span className="text-slate-900 font-bold">{formatCurrency(item.value)}</span>
                         </div>
                         <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-slate-400'}`}
                              style={{ width: `${Math.min(100, item.percentage)}%` }}
                            ></div>
                         </div>
                         <div className="flex justify-between items-center text-[10px]">
                           <span className="text-slate-400">{(item.value / data.area).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} / m²</span>
                           <span className="text-slate-400 font-bold">{item.percentage.toFixed(1)}%</span>
                         </div>
                       </div>
                     ))}
                   </div>
                   <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-4 rounded-xl">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-xs">Custo de Obra por m²:</span>
                          <span className="text-[10px] text-slate-400">Considerando todos os custos</span>
                        </div>
                        <span className="font-black text-lg text-blue-700">{formatCurrency(results.totalCost / data.area)}</span>
                   </div>
              </div>

              {/* AI Analysis Section */}
              <div className="bg-white p-8 rounded-3xl shadow-xl text-slate-900 border border-slate-200 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10"></div>
                 
                 <div className="relative z-10">
                   <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-900 p-2.5 rounded-xl shadow-lg">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                             <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 13.536a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 011.414-1.414l.707.707zM10 8a2 2 0 100 4 2 2 0 000-4z" />
                           </svg>
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Consultoria Estratégica AI</h2>
                          <p className="text-xs text-slate-500 font-medium">Análise preditiva de riscos e oportunidades</p>
                        </div>
                      </div>
                      <button 
                        onClick={handleAiAnalysis}
                        disabled={isAnalyzing}
                        className={`bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-2xl transition-all flex items-center gap-3 shadow-lg shadow-blue-200 active:scale-95`}
                      >
                        {isAnalyzing ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processando Cenários...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Gerar Relatório Técnico
                          </>
                        )}
                      </button>
                   </div>

                   {aiAnalysis ? (
                     <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 shadow-inner">
                        <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: aiAnalysis.replace(/\n/g, '<br/>') }} />
                     </div>
                   ) : (
                     <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <div className="inline-block p-4 bg-white rounded-2xl shadow-sm mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <h3 className="text-slate-900 font-bold mb-1">Aguardando seu Comando</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">Nossa inteligência artificial está pronta para analisar a viabilidade do seu projeto imobiliário baseado nos dados fornecidos.</p>
                     </div>
                   )}
                 </div>
              </div>

            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-6 mt-16 pb-12 text-center">
        <div className="w-12 h-1 bg-slate-200 mx-auto mb-6 rounded-full"></div>
        <p className="text-slate-900 font-bold text-lg mb-2 italic">Construindo com Inteligência.</p>
        <p className="text-slate-400 text-sm">CalcConstru Pro v2.5 • Conectado via Supabase • Suporte a Gemini 3 Flash</p>
      </footer>
    </div>
  );
};

export default App;
