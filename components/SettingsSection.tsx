
import React, { useState, useEffect } from 'react';
import { updateSupabaseConfig, getStoredConfig, testConnection, getSupabase } from '../services/supabaseClient';

const SQL_SCHEMA = `-- SCRIPT DE CORREÇÃO (Rode no Supabase SQL Editor)

-- 1. Cria a tabela base se não existir
create table if not exists public.projects (
  "id" uuid primary key default gen_random_uuid(),
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null,
  "name" text not null,
  "type" text not null,
  "standard" text not null
);

-- 2. Adiciona colunas que podem estar faltando (ALTER TABLE)
alter table public.projects add column if not exists "area" numeric default 0;
alter table public.projects add column if not exists "cubValue" numeric default 0;
alter table public.projects add column if not exists "landValue" numeric default 0;
alter table public.projects add column if not exists "foundationCost" numeric default 0;
alter table public.projects add column if not exists "documentationCost" numeric default 0;
alter table public.projects add column if not exists "marketingCost" numeric default 0;
alter table public.projects add column if not exists "otherCosts" numeric default 0;
alter table public.projects add column if not exists "unitPrice" numeric default 0;
alter table public.projects add column if not exists "totalUnits" numeric default 0;
alter table public.projects add column if not exists "brokerName" text;
alter table public.projects add column if not exists "brokerPhone" text;
alter table public.projects add column if not exists "observations" text;
alter table public.projects add column if not exists "useDetailedCosts" boolean default false;

-- 3. COLUNAS NOVAS (JSONB) - O erro de salvamento geralmente é aqui
alter table public.projects add column if not exists "detailedCosts" jsonb;
alter table public.projects add column if not exists "units" jsonb;
alter table public.projects add column if not exists "zoning" jsonb;
alter table public.projects add column if not exists "media" jsonb;
alter table public.projects add column if not exists "segmentedCosts" jsonb;
alter table public.projects add column if not exists "quickFeasibility" jsonb;
alter table public.projects add column if not exists "financials" jsonb;

-- 4. Permissões
alter table public.projects enable row level security;
drop policy if exists "Public Access Policy" on public.projects;
create policy "Public Access Policy" on public.projects for all using (true) with check (true);
`;

interface SettingsProps {
  onConfigUpdate?: () => void;
}

export const SettingsSection: React.FC<SettingsProps> = ({ onConfigUpdate }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [verificationMsg, setVerificationMsg] = useState('');

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
    setTimeout(async () => {
      const isConnected = await testConnection();
      setStatus(isConnected ? 'success' : 'error');
      if (isConnected) alert("Conexão atualizada!");
      else alert("Falha na conexão.");
      if (onConfigUpdate) onConfigUpdate();
    }, 500);
  };

  const handleDisconnect = () => {
    if(confirm("Desconectar?")) {
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

    // Verifica se consegue selecionar a coluna 'financials' que é nova
    const { error } = await client.from('projects').select('financials').limit(1);
    
    if (!error) {
      setVerificationMsg("✅ Tabela atualizada com sucesso!");
    } else if (error.code === '42703') { // Undefined column
      setVerificationMsg("⚠️ Colunas faltando! Rode o SQL abaixo.");
    } else if (error.code === '42P01') { // Undefined table
      setVerificationMsg("⚠️ Tabela não existe. Rode o SQL abaixo.");
    } else {
      setVerificationMsg(`❌ Erro: ${error.message}`);
    }
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SQL_SCHEMA);
    alert("SQL Copiado! Cole no 'SQL Editor' do Supabase.");
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-slate-200">
         <h2 className="text-xl font-bold text-slate-800">Configurações</h2>
         <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 ${status === 'success' ? 'bg-green-100 text-green-700' : status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            <span className={`w-2 h-2 rounded-full ${status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-slate-400'}`}></span>
            {status === 'success' ? 'CONECTADO' : 'OFFLINE'}
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Supabase URL</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm" />
           </div>
           <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Anon Key</label>
              <input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm" />
           </div>
           <div className="flex gap-4 pt-2">
              <button onClick={handleSave} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg text-sm">Atualizar</button>
              {url && <button onClick={handleDisconnect} className="text-red-500 text-sm">Desconectar</button>}
           </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="bg-white p-6 rounded-2xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-2">Diagnóstico de Banco de Dados</h3>
            <p className="text-xs text-slate-500 mb-4">Se não estiver salvando, provavelmente faltam colunas no banco.</p>
            {verificationMsg && <div className="mb-4 text-xs bg-slate-50 p-2 rounded font-mono border border-slate-200">{verificationMsg}</div>}
            <button onClick={verifyTables} className="w-full bg-slate-100 text-slate-700 font-bold py-2 rounded-lg text-sm hover:bg-slate-200">Verificar Tabela</button>
         </div>

         <div className="bg-blue-600 p-6 rounded-2xl text-white">
            <h3 className="font-bold mb-2">Script de Correção (SQL)</h3>
            <p className="text-xs text-blue-100 mb-4">Copie este código e execute no <b>SQL Editor</b> do Supabase para adicionar as colunas faltantes.</p>
            <button onClick={copySQL} className="w-full bg-white text-blue-700 font-bold py-2 rounded-lg text-sm hover:bg-blue-50">Copiar SQL de Correção</button>
         </div>
      </div>

      <div className="bg-slate-900 rounded-2xl p-6 overflow-x-auto border border-slate-800">
         <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap">{SQL_SCHEMA}</pre>
      </div>
    </div>
  );
};
