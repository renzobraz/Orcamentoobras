
import React, { useState, useEffect } from 'react';
import { updatePassword, fetchProfiles, createSecondaryUser, getSession } from '../services/supabaseClient';
import { SettingsSection } from './SettingsSection';

export const ProfileSection: React.FC = () => {
  // Password State
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  // Users State
  const [profiles, setProfiles] = useState<any[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  
  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Config Toggle
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const session = await getSession();
    if (session?.user) {
        setCurrentUserEmail(session.user.email || '');
    }
    
    const profs = await fetchProfiles();
    // Se a tabela de profiles ainda não existe ou está vazia, mostra pelo menos o atual
    if (profs.length === 0 && session?.user) {
        setProfiles([{
            id: session.user.id,
            email: session.user.email,
            created_at: new Date().toISOString()
        }]);
    } else {
        setProfiles(profs);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirmPass) {
        alert("As senhas não coincidem.");
        return;
    }
    if (newPass.length < 6) {
        alert("A senha deve ter no mínimo 6 caracteres.");
        return;
    }
    
    setPassLoading(true);
    try {
        await updatePassword(newPass);
        alert("Senha alterada com sucesso!");
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
    } catch (error: any) {
        alert("Erro ao alterar senha: " + error.message);
    } finally {
        setPassLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsAddingUser(true);
      try {
          await createSecondaryUser(newUserEmail, newUserPass);
          alert(`Usuário ${newUserEmail} criado com sucesso!`);
          setShowAddModal(false);
          setNewUserEmail('');
          setNewUserPass('');
          loadData(); // Reload profiles
      } catch (error: any) {
          alert("Erro ao criar usuário: " + error.message);
      } finally {
          setIsAddingUser(false);
      }
  };

  const formatDate = (dateString: string) => {
      if(!dateString) return '-';
      return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Perfil e Conta</h2>
        <p className="text-slate-500 text-sm">Gerencie sua segurança e equipe de vendas.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Segurança da Conta */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-fit">
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-orange-100 p-2 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">Segurança da Conta</h3>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Senha Atual</label>
                    <input 
                        type="password" 
                        className="w-full border border-slate-200 rounded-lg px-4 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={currentPass}
                        onChange={(e) => setCurrentPass(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Nova Senha</label>
                        <input 
                            type="password" 
                            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Confirmar Nova Senha</label>
                        <input 
                            type="password" 
                            className="w-full border border-slate-200 rounded-lg px-4 py-2.5 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={confirmPass}
                            onChange={(e) => setConfirmPass(e.target.value)}
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={passLoading}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow transition-colors mt-2"
                >
                    {passLoading ? 'Atualizando...' : 'Alterar Minha Senha'}
                </button>
            </form>
        </div>

        {/* Equipe de Administradores */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 h-fit">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Equipe de Administradores</h3>
                </div>
                <button 
                    onClick={() => setShowAddModal(true)}
                    className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                    title="Adicionar Administrador"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-100">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                        <tr>
                            <th className="px-4 py-3">USUÁRIO</th>
                            <th className="px-4 py-3 text-right">AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {profiles.map((profile, idx) => {
                            const isMe = profile.email === currentUserEmail;
                            const username = profile.email ? profile.email.split('@')[0] : 'user';
                            
                            return (
                                <tr key={profile.id || idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{username}</span>
                                            {isMe && <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">você</span>}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">Criado em {formatDate(profile.created_at)}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {!isMe && (
                                            <button 
                                                className="text-slate-300 hover:text-red-500 transition-colors"
                                                onClick={() => alert("Para excluir usuários, utilize o painel do Supabase (Authentication > Users) por segurança.")}
                                                title="Excluir Usuário"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {profiles.length === 0 && (
                     <div className="p-4 text-center text-xs text-slate-400">
                         Nenhum perfil encontrado. Verifique se o Script SQL foi executado.
                     </div>
                )}
            </div>
        </div>
      </div>

      {/* Toggle Configurações Avançadas */}
      <div className="pt-8 border-t border-slate-200 mt-8">
          <button 
             onClick={() => setShowConfig(!showConfig)}
             className="text-slate-400 text-xs font-bold hover:text-slate-600 flex items-center gap-2 mb-4"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showConfig ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              CONFIGURAÇÕES DE CONEXÃO (BANCO DE DADOS)
          </button>
          
          {showConfig && <SettingsSection />}
      </div>

      {/* Modal Adicionar Usuário */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fadeIn">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Adicionar Administrador</h3>
                <form onSubmit={handleAddUser} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                        <input 
                            type="email" 
                            required
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Senha Provisória</label>
                        <input 
                            type="password" 
                            required
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            value={newUserPass}
                            onChange={(e) => setNewUserPass(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setShowAddModal(false)}
                            className="flex-1 bg-slate-100 text-slate-600 font-bold py-2 rounded-lg text-sm hover:bg-slate-200"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isAddingUser}
                            className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-blue-700"
                        >
                            {isAddingUser ? 'Criando...' : 'Criar Usuário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
