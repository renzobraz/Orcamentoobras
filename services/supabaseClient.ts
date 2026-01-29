
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProjectData } from '../types';

const STORAGE_KEY_URL = 'calcconstru_sb_url';
const STORAGE_KEY_KEY = 'calcconstru_sb_key';

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const url = localStorage.getItem(STORAGE_KEY_URL) || (process.env as any).SUPABASE_URL;
  const key = localStorage.getItem(STORAGE_KEY_KEY) || (process.env as any).SUPABASE_ANON_KEY;

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
    url: localStorage.getItem(STORAGE_KEY_URL) || '',
    key: localStorage.getItem(STORAGE_KEY_KEY) || ''
  };
};

// --- Operations ---

export const testConnection = async (): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  try {
    // Tenta uma query leve que não precisa de tabela específica, ou checa a tabela projects
    const { error } = await client.from('projects').select('count', { count: 'exact', head: true });
    // Se o erro for de tabela inexistente (42P01), a conexão funcionou, mas a tabela falta.
    // Se não houver erro, conexão ok.
    if (!error) return true;
    // Se o erro for de autenticação, falhou.
    if (error.code === 'PGRST301' || error.message.includes('JWT')) return false;
    
    // Consideramos sucesso se conectou, mesmo que a tabela não exista ainda (para permitir setup)
    return true; 
  } catch (e) {
    return false;
  }
};

export const saveProject = async (project: ProjectData) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado.");
  
  const { data, error } = await client
    .from('projects')
    .upsert([project], { onConflict: 'id' })
    .select();
  
  if (error) throw error;
  return data?.[0];
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
