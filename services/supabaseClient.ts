
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
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

// --- AUTH OPERATIONS ---

export const signIn = async (email: string, password: string) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado.");
  
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

export const signUp = async (email: string, password: string) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado.");
  
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
};

export const createSecondaryUser = async (email: string, password: string) => {
  // Truque: Cria uma instância TEMPORÁRIA para não deslogar o usuário atual
  // ao criar um novo usuário.
  const config = getStoredConfig();
  if (!config.url || !config.key) throw new Error("Supabase não configurado");

  // IMPORTANTE: Configura persistSession = false para não sobrescrever 
  // o localStorage do usuário admin logado atualmente.
  const tempClient = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  
  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

export const updatePassword = async (newPassword: string) => {
    const client = getSupabase();
    if (!client) throw new Error("Supabase não configurado.");

    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw error;
};

export const deleteUser = async (userId: string) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase não configurado.");
  
  // Chama a RPC criada no SQL (Remote Procedure Call)
  // Isso requer que o script SQL com a função 'delete_user_by_id' tenha sido rodado
  const { error } = await client.rpc('delete_user_by_id', { user_id: userId });
  
  if (error) throw error;
};

export const signOut = async () => {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
};

export const getSession = async () => {
  const client = getSupabase();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
};

export const fetchProfiles = async () => {
    const client = getSupabase();
    if (!client) return [];
    
    // Busca perfis. Requer que a tabela 'profiles' tenha sido criada pelo script SQL
    const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
        console.warn("Erro ao buscar perfis (Tabela profiles pode não existir):", error.message);
        return [];
    }
    return data;
};

// --- DATA OPERATIONS ---

export const testConnection = async (): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.from('projects').select('count', { count: 'exact', head: true });
    if (!error) return true;
    if (error.code === '42P01') return true; 
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
      // UPDATE
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
      // INSERT
      if (payload.id) delete payload.id; 

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
