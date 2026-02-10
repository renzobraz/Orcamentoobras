
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectData, Land } from '../types';

const STORAGE_KEY_URL = 'calcconstru_sb_url';
const STORAGE_KEY_KEY = 'calcconstru_sb_key';

// Credenciais fixas para garantir conexão no preview
const DEFAULT_URL = 'https://xlujevbbmezemsprhola.supabase.co';
const DEFAULT_KEY = 'sb_publishable_4-QnHcuEb76_PferVmOBbQ_e22Eybu-';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  // Ordem de prioridade: LocalStorage > Constantes Fixas > Variáveis de Ambiente
  const url = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL || (process.env as any).SUPABASE_URL;
  const key = localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY || (process.env as any).SUPABASE_ANON_KEY;

  if (url && key && url.startsWith('http')) {
    try {
      supabaseInstance = createClient(url, key);
      return supabaseInstance;
    } catch (e) {
      console.error("Failed to initialize Supabase", e);
      return null;
    }
  }
  return null;
};

export const updateSupabaseConfig = (url: string, key: string) => {
  localStorage.setItem(STORAGE_KEY_URL, url);
  localStorage.setItem(STORAGE_KEY_KEY, key);
  supabaseInstance = null; // Reset instance to force recreation
  getSupabase(); // Re-initialize
};

export const getStoredConfig = () => {
  return {
    url: localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_URL,
    key: localStorage.getItem(STORAGE_KEY_KEY) || DEFAULT_KEY
  };
};

// --- Operations ---

export const testConnection = async (): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  try {
    // Tenta um select simples na tabela projects
    const { error } = await client.from('projects').select('count', { count: 'exact', head: true });
    
    // Se não der erro de rede/autenticação, consideramos conectado
    if (!error) return true;
    
    // Erros aceitáveis que indicam que a conexão existe, mas talvez a tabela não
    if (error.code === '42P01') return true; // Undefined table
    
    // Se o erro for de token inválido, retornamos false
    if (error.code === 'PGRST301' || error.message.includes('JWT')) return false;

    return true; 
  } catch (e) {
    return false;
  }
};

export const saveProject = async (project: ProjectData) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado.");
  
  const payload = { ...project };

  if (payload.id && payload.id.length > 10) { 
      // UPDATE: Se existe ID válido, atualiza
      const { data, error } = await client
        .from('projects')
        .update(payload)
        .eq('id', payload.id)
        .select();
      
      if (error) {
        console.error("Erro no UPDATE:", error);
        throw error;
      }
      return data?.[0];
  } else {
      // INSERT: Se não existe ID, cria novo
      if (payload.id) delete payload.id; // Garante que não envia ID vazio/invalido

      const { data, error } = await client
        .from('projects')
        .insert(payload)
        .select();
      
      if (error) {
        console.error("Erro no INSERT:", error);
        throw error;
      }
      return data?.[0];
  }
};

export const fetchProjects = async () => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado.");

  const { data, error } = await client
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as ProjectData[];
};

export const deleteProject = async (id: string) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado.");

  const { error } = await client
    .from('projects')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// --- LANDS OPERATIONS (TERRENOS) ---

export const saveLand = async (land: Land) => {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
    
    const payload = { ...land };
  
    if (payload.id && payload.id.length > 10) { 
        const { data, error } = await client
          .from('lands')
          .update(payload)
          .eq('id', payload.id)
          .select();
        if (error) throw error;
        return data?.[0];
    } else {
        if (payload.id) delete payload.id;
        const { data, error } = await client
          .from('lands')
          .insert(payload)
          .select();
        if (error) throw error;
        return data?.[0];
    }
};

export const fetchLands = async () => {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
  
    const { data, error } = await client
      .from('lands')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Land[];
};

export const deleteLand = async (id: string) => {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");
  
    const { error } = await client
      .from('lands')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
};
