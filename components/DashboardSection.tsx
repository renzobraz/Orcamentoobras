
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
    <div className="space-y-8 animate-fadeIn">
      
      {/* 1. Resultado Sintético */}
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

      {/* 2. Resultado Analítico */}
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

      {/* 3. KPIs Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Premissas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-3 border-b pb-2">Premissas Financeiras</h4>
              <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                      <span className="text-slate-500">Taxa VP</span>
                      <span className="font-medium">10,00%</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Imposto (Est.)</span>
                      <span className="font-medium">{(synthetic.taxes / synthetic.revenue * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Permuta</span>
                      <span className="font-medium">N/A</span>
                  </div>
              </div>
          </div>

          {/* VGV e Obra */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-3 border-b pb-2">VGV e Obra</h4>
              <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                      <span className="text-slate-500">VGV Bruto</span>
                      <span className="font-medium">{formatCurrency(synthetic.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Custo Obra</span>
                      <span className="font-medium">{formatCurrency(synthetic.constructionCost)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-slate-500">Custo/m² Priv.</span>
                      <span className="font-medium">{(synthetic.constructionCost / (kpis.privateArea || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
              </div>
          </div>

          {/* Áreas */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-3 border-b pb-2">Áreas</h4>
              <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                      <span className="text-slate-500">Área Terreno</span>
                      <span className="font-medium">{kpis.landArea.toLocaleString()} m²</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Área Construída</span>
                      <span className="font-medium">{kpis.builtArea.toLocaleString()} m²</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Área Privativa</span>
                      <span className="font-medium">{kpis.privateArea.toLocaleString()} m²</span>
                  </div>
              </div>
          </div>

          {/* Coeficientes */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h4 className="font-bold text-sm text-slate-800 mb-3 border-b pb-2">Coeficientes</h4>
              <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                      <span className="text-slate-500">Eficiência (Priv/Tot)</span>
                      <span className="font-medium">{kpis.efficiency.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">C.A. (Aprov.)</span>
                      <span className="font-medium">{kpis.utilization.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-slate-500">Privativa / Terreno</span>
                      <span className="font-medium">{(kpis.privateArea / (kpis.landArea || 1)).toFixed(2)}</span>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};
