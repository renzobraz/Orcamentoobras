
import React from 'react';
import { DashboardData } from '../types';

interface DashboardProps {
  data: DashboardData;
}

const formatCurrency = (val: number) => 
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const formatPercent = (val: number, total: number) => {
  if (total === 0) return '0,00%';
  return ((val / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
};

const TableRow: React.FC<{ 
  label: string; 
  value: number; 
  totalBase: number; 
  isHeader?: boolean; 
  isSubItem?: boolean;
  isNegative?: boolean; 
}> = ({ label, value, totalBase, isHeader, isSubItem, isNegative }) => {
  const displayValue = isNegative ? -Math.abs(value) : value;
  const textColor = isHeader ? 'text-white' : (isNegative ? 'text-red-400' : 'text-slate-600');
  const bgClass = isHeader ? 'bg-blue-500' : (isSubItem ? 'bg-white' : 'bg-slate-200');
  const labelClass = isHeader ? 'font-bold' : (isSubItem ? 'pl-8' : 'font-bold text-slate-800');

  return (
    <div className={`flex justify-between items-center py-2 px-4 border-b border-slate-100 ${bgClass}`}>
      <span className={`text-sm ${labelClass}`}>{label}</span>
      <div className="flex gap-4 items-center">
        <span className={`text-sm font-medium ${textColor}`}>
           {formatCurrency(displayValue)}
        </span>
        <span className={`text-xs w-16 text-right ${isHeader ? 'text-white/80' : 'text-slate-400'}`}>
           {formatPercent(value, totalBase)}
        </span>
      </div>
    </div>
  );
};

export const DashboardSection: React.FC<DashboardProps> = ({ data }) => {
  const { synthetic, analytical, kpis } = data;
  const vgv = synthetic.revenue;

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      
      {/* 0. PAINEL DE DECISÃO (MIGRADO DA ABA RÁPIDA) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Motor de Cálculo Visual */}
           <section className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
               <div className="flex justify-between items-start z-10 relative">
                   <div>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">VGV Total (Valor Geral de Vendas)</p>
                       <h3 className="text-3xl font-bold text-white mb-1">{formatCurrency(vgv)}</h3>
                       <p className="text-xs text-slate-500">Área Privativa: {kpis.privateArea.toLocaleString()} m² ({kpis.efficiency.toFixed(0)}% Efic.)</p>
                   </div>
                   <div className="text-right">
                       <div className="bg-slate-800 px-3 py-1 rounded-lg inline-block">
                            <p className="text-slate-400 text-[10px] font-bold uppercase">Área Construída</p>
                            <p className="text-lg font-bold">{kpis.builtArea.toLocaleString()} m²</p>
                       </div>
                   </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4 mt-6 z-10 relative">
                   <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                       <p className="text-red-300 text-xs mb-1">Custo Obra (Total)</p>
                       <p className="font-bold">{formatCurrency(synthetic.constructionCost)}</p>
                   </div>
                   <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                       <p className="text-red-300 text-xs mb-1">Despesas & Taxas</p>
                       <p className="font-bold">{formatCurrency(synthetic.expenses + synthetic.taxes)}</p>
                   </div>
               </div>
           </section>

           {/* Painel de Decisão (Lucro e Margem) */}
           <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
               <div>
                   <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                       <span className="w-1 h-6 bg-emerald-500 rounded-full"></span>
                       Painel de Decisão
                   </h2>
                   
                   <div className="flex justify-between items-end border-b border-slate-100 pb-4 mb-4">
                       <div>
                           <p className="text-xs text-slate-500 font-bold uppercase mb-1">Resultado Líquido (Lucro)</p>
                           <h3 className={`text-2xl font-black ${synthetic.result > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                               {formatCurrency(synthetic.result)}
                           </h3>
                       </div>
                       <div className="text-right">
                           <p className="text-xs text-slate-500 font-bold uppercase mb-1">Margem Líquida</p>
                           <h3 className={`text-2xl font-bold ${synthetic.margin > 15 ? 'text-emerald-600' : 'text-amber-500'}`}>
                               {synthetic.margin.toFixed(1)}%
                           </h3>
                       </div>
                   </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                       <p className="text-orange-800 text-xs font-bold uppercase mb-1">Exposição (Est.)</p>
                       <p className="text-lg font-bold text-orange-900">{formatCurrency(kpis.cashExposure)}</p>
                   </div>
                   <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                       <p className="text-blue-800 text-xs font-bold uppercase mb-1">Teto Terreno (Est.)</p>
                       <p className="text-lg font-bold text-blue-900">{formatCurrency(kpis.maxLandValue)}</p>
                   </div>
               </div>
           </section>
      </div>

      {/* 1. Resultado Sintético (Mantido) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
           <h3 className="font-bold text-lg text-slate-800">Resultado Sintético</h3>
        </div>
        <div>
           <TableRow label="Receitas" value={synthetic.revenue} totalBase={vgv} />
           <TableRow label="Custo de Terreno" value={synthetic.landCost} totalBase={vgv} isNegative />
           <TableRow label="Custo de Obra" value={synthetic.constructionCost} totalBase={vgv} isNegative />
           <TableRow label="Despesas" value={synthetic.expenses} totalBase={vgv} isNegative />
           <TableRow label="Impostos" value={synthetic.taxes} totalBase={vgv} isNegative />
           <div className="flex justify-between items-center py-3 px-4 bg-emerald-50 border-t-2 border-emerald-100">
              <span className="font-bold text-slate-800">Resultado Líquido</span>
              <span className="font-bold text-lg text-emerald-700">{formatCurrency(synthetic.result)}</span>
           </div>
        </div>
      </div>

      {/* 2. Resultado Analítico (Atualizado) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
           <h3 className="font-bold text-lg text-slate-800">Resultado Analítico</h3>
           <button className="text-xs bg-emerald-500 text-white px-3 py-1 rounded hover:bg-emerald-600 transition">Exportar</button>
        </div>
        
        {/* Receitas */}
        <TableRow label="Receitas" value={analytical.revenue.total} totalBase={vgv} isHeader />
        <TableRow label="Receitas de Vendas" value={analytical.revenue.total} totalBase={vgv} isSubItem />

        {/* Terreno */}
        <TableRow label="Terreno" value={analytical.land.total} totalBase={vgv} isNegative />
        <TableRow label="Aquisição Terreno" value={analytical.land.acquisition} totalBase={vgv} isSubItem isNegative />
        <TableRow label="Comissões Compra" value={analytical.land.commission} totalBase={vgv} isSubItem isNegative />
        <TableRow label="ITBI e Registro" value={analytical.land.taxes} totalBase={vgv} isSubItem isNegative />

        {/* Obra */}
        <TableRow label="Obra" value={analytical.construction.total} totalBase={vgv} isNegative />
        <TableRow label="Custo Direto (Mat/Mão de Obra)" value={analytical.construction.direct} totalBase={vgv} isSubItem isNegative />
        <TableRow label="Custo Indireto / Projetos" value={analytical.construction.indirect} totalBase={vgv} isSubItem isNegative />

        {/* Despesas */}
        <TableRow label="Despesas" value={analytical.expenses.total} totalBase={vgv} isNegative />
        <TableRow label="Marketing (Lançamento)" value={analytical.expenses.marketingLaunch} totalBase={vgv} isSubItem isNegative />
        <TableRow label="Marketing (Manutenção)" value={analytical.expenses.marketingMaintenance} totalBase={vgv} isSubItem isNegative />
        <TableRow label="Comissões Venda (Stand/Corretor)" value={analytical.expenses.sales} totalBase={vgv} isSubItem isNegative />
        <TableRow label="Administrativo / Outros" value={analytical.expenses.admin} totalBase={vgv} isSubItem isNegative />

        {/* Impostos */}
        <TableRow label="Impostos" value={analytical.taxes.total} totalBase={vgv} isNegative />
        <TableRow label="Impostos sobre Venda (RET/PIS/COFINS)" value={analytical.taxes.total} totalBase={vgv} isSubItem isNegative />

        {/* Total */}
        <div className="flex justify-between items-center py-4 px-4 bg-blue-600 text-white">
           <span className="font-bold">Resultado do Exercício</span>
           <span className="font-bold text-xl">{formatCurrency(synthetic.result)}</span>
        </div>
      </div>
    </div>
  );
};
