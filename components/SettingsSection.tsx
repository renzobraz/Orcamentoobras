
import React, { useState, useEffect } from 'react';
import { updateSupabaseConfig, getStoredConfig, testConnection, getSupabase } from '../services/supabaseClient';

const SQL_SCHEMA = `-- Criação da tabela de projetos
create table if not exists public.projects (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Dados Básicos
  "name" text not null,
  "type" text not null,
  "standard" text not null,
  "area" numeric not null default 0,
  
  -- Custos e Valores
  "cubValue" numeric not null default 0,
  "landValue" numeric not null default 0,
  "foundationCost" numeric not null default 0,
  "documentationCost" numeric not null default 0,
  "marketingCost" numeric not null default 0,
  "otherCosts" numeric not null default 0,
  
  -- Premissas de Venda
  "unitPrice" numeric not null default 0,
  "totalUnits" numeric not null default 0,
  
  -- Dados do Corretor e Observações (Novos)
  "brokerName" text,
  "brokerPhone" text,
  "observations" text,
  
  -- Custos Detalhados (JSONB para flexibilidade)
  "useDetailedCosts" boolean not null default false,
  "detailedCosts" jsonb
);

-- Habilitar Row Level Security
alter table public.projects enable row level security;

-- Política de Acesso Público (Ajuste conforme necessidade)
create policy "Public Access Policy"
on public.projects
for all
using (true)
with check (true);

-- Se a tabela já existir e você precisar adicionar as colunas, execute:
-- alter table public.projects add column if not exists "brokerName" text;
-- alter table public.projects add column if not exists "brokerPhone" text;
-- alter table public.projects add column if not exists "observations" text;
`;

interface SettingsProps {
  onConfigUpdate?: () => void;
}

export const SettingsSection: React.FC<SettingsProps> = ({ onConfigUpdate }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [verificationMsg, setVerificationMsg] = useState('');
  const [showSql, setShowSql] = useState(true);

  useEffect(() => {
    const config = getStoredConfig();
    setUrl(config.url);
    setKey(config.key);
    if (config.url && config.key) {
      checkConnectionOnLoad();
    }
  }, []);

  const checkConnectionOnLoad = async () => {
    const isConnected = await testConnection();
    setStatus(isConnected ? 'success' : 'error');
  };

  const handleSave = async () => {
    setStatus('checking');
    updateSupabaseConfig(url, key);
    
    // Pequeno delay para garantir que o cliente atualizou
    setTimeout(async () => {
      const isConnected = await testConnection();
      setStatus(isConnected ? 'success' : 'error');
      if (isConnected) {
        alert("Conexão atualizada com sucesso!");
      } else {
        alert("Não foi possível conectar. Verifique a URL e a API KEY.");
      }
      // Notifica o componente pai (App) para atualizar o header
      if (onConfigUpdate) onConfigUpdate();
    }, 500);
  };

  const handleDisconnect = () => {
    if(confirm("Deseja realmente remover as configurações de conexão?")) {
        updateSupabaseConfig('', '');
        setUrl('');
        setKey('');
        setStatus('idle');
        if (onConfigUpdate) onConfigUpdate();
    }
  };

  const verifyTables = async () => {
    setVerificationMsg("Verificando...");
    const client = getSupabase();
    if (!client) {
      setVerificationMsg("Erro: Cliente não inicializado.");
      return;
    }

    const { error } = await client.from('projects').select('count', { count: 'exact', head: true });
    
    if (!error) {
      setVerificationMsg("✅ Tabela 'projects' encontrada e acessível!");
    } else if (error.code === '42P01') {
      setVerificationMsg("⚠️ Conectado, mas a tabela 'projects' não existe. Copie o SQL abaixo e execute no Supabase.");
    } else {
      setVerificationMsg(`❌ Erro: ${error.message}`);
    }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    alert("Código SQL copiado para a área de transferência!");
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header da Seção */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <h2 className="text-xl font-bold text-slate-800">Configurações</h2>
         <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${status === 'success' ? 'bg-green-100 text-green-700' : status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            <span className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`}></span>
            {status === 'success' ? 'SUPABASE CONECTADO' : status === 'error' ? 'FALHA NA CONEXÃO' : 'NÃO CONECTADO'}
         </div>
      </div>

      {/* Cartão de Conexão */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
           <div className="flex items-start gap-4">
              <div className="bg-blue-600 p-3 rounded-xl shadow-md">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                 </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Conexão com Banco de Dados</h3>
                <p className="text-sm text-slate-500 mt-1">Conecte sua conta do Supabase para salvar os dados na nuvem.</p>
              </div>
           </div>
        </div>
        
        <div className="p-6 space-y-6">
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supabase URL</label>
              <input 
                 type="text" 
                 value={url}
                 onChange={(e) => setUrl(e.target.value)}
                 placeholder="https://sua-id-projeto.supabase.co"
                 className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
              />
           </div>
           
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anon Key (API Key)</label>
              <input 
                 type="password" 
                 value={key}
                 onChange={(e) => setKey(e.target.value)}
                 placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                 className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
              />
           </div>

           <div className="flex items-center gap-4 pt-2">
              <button 
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-md shadow-blue-200 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v3.25a1 1 0 11-2 0V13.003a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Atualizar Conexão
              </button>
              
              {url && (
                  <button 
                    onClick={handleDisconnect}
                    className="text-slate-400 hover:text-red-500 font-medium text-sm transition-colors flex items-center gap-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    Desconectar
                  </button>
              )}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Verificador de Tabelas */}
         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
               <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
               </div>
               <h3 className="font-bold text-slate-800">Verificador de Tabelas</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6 min-h-[40px]">
               Verifique se o seu projeto Supabase já possui as tabelas necessárias criadas.
            </p>
            
            {verificationMsg && (
                <div className={`mb-4 p-3 rounded-lg text-xs font-medium ${verificationMsg.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-100 text-slate-700'}`}>
                    {verificationMsg}
                </div>
            )}

            <button 
              onClick={verifyTables}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-colors text-sm"
            >
              Executar Verificação
            </button>
         </div>

         {/* Configuração Inicial */}
         <div className="bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
               <div className="bg-white/20 p-2 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
               </div>
               <h3 className="font-bold">Configuração Inicial</h3>
            </div>
            <p className="text-blue-100 text-sm mb-6 min-h-[40px]">
               Se as tabelas ainda não existem, copie o código SQL e cole no seu <strong>SQL Editor</strong> do Supabase.
            </p>

            <button 
              onClick={copySQL}
              className="w-full bg-white text-blue-700 hover:bg-blue-50 font-bold py-3 rounded-lg transition-colors text-sm flex justify-center items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar Código SQL
            </button>
         </div>
      </div>

      {/* SQL Explorer */}
      <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
         <div className="bg-slate-800 px-6 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
               <div className="w-3 h-3 rounded-full bg-red-500"></div>
               <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
               <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="ml-4 text-xs font-mono text-slate-400 font-bold uppercase tracking-wider">SQL Schema Explorer</span>
         </div>
         <div className="p-6 overflow-x-auto">
            <pre className="text-xs md:text-sm font-mono text-slate-300 leading-relaxed">
               {SQL_SCHEMA}
            </pre>
         </div>
      </div>
    </div>
  );
};
