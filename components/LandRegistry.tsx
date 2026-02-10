
import React, { useState, useEffect } from 'react';
import { Land } from '../types';
import { fetchLands, saveLand, deleteLand } from '../services/supabaseClient';
import { InputField } from './InputSection';

interface LandRegistryProps {
    onSelectForProject?: (land: Land) => void;
}

const INITIAL_LAND: Land = {
    description: '',
    zipCode: '',
    address: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    area: 0,
    price: 0,
    status: 'Em Análise',
    notes: '',
    code: '',
    ownerName: '',
    ownerContact: ''
};

export const LandRegistry: React.FC<LandRegistryProps> = ({ onSelectForProject }) => {
    const [lands, setLands] = useState<Land[]>([]);
    const [currentLand, setCurrentLand] = useState<Land | null>(null); // Se null, mostra lista. Se obj, mostra form.
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadLands();
    }, []);

    const loadLands = async () => {
        setIsLoading(true);
        try {
            const data = await fetchLands();
            setLands(data);
        } catch (error) {
            console.error(error);
            // Fallback localStorage
            const local = localStorage.getItem('calcconstru_lands');
            if(local) setLands(JSON.parse(local));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if(!currentLand) return;
        setIsSaving(true);
        try {
            const saved = await saveLand(currentLand);
            if(saved) {
                alert('Terreno salvo com sucesso!');
                setCurrentLand(null);
                loadLands();
            }
        } catch (e) {
            console.error(e);
             // Fallback
             const newId = currentLand.id || crypto.randomUUID();
             const landToSave = { ...currentLand, id: newId };
             const newList = [landToSave, ...lands.filter(l => l.id !== newId)];
             localStorage.setItem('calcconstru_lands', JSON.stringify(newList));
             setLands(newList);
             setCurrentLand(null);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(!confirm('Deseja excluir este terreno?')) return;
        try {
            await deleteLand(id);
            loadLands();
        } catch (e) {
             const newList = lands.filter(l => l.id !== id);
             localStorage.setItem('calcconstru_lands', JSON.stringify(newList));
             setLands(newList);
        }
    };

    // --- FORM VIEW ---
    if (currentLand) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fadeIn">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <button onClick={() => setCurrentLand(null)} className="p-1 rounded-full hover:bg-slate-100 text-slate-500 mr-2">
                             ←
                        </button>
                        {currentLand.id ? 'Editar Terreno' : 'Novo Terreno'}
                    </h2>
                    <div className="flex gap-3">
                         <button onClick={() => setCurrentLand(null)} className="px-4 py-2 text-slate-600 font-bold text-sm">Cancelar</button>
                         <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white font-bold text-sm rounded-lg hover:bg-blue-700 shadow-md">
                             {isSaving ? 'Salvando...' : 'Salvar Terreno'}
                         </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Coluna Esquerda: Dados Principais */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-2">
                                <InputField label="Código" type="text" value={currentLand.code || ''} onChange={(v) => setCurrentLand({...currentLand, code: v})} />
                            </div>
                            <div className="col-span-8">
                                <InputField label="Descrição / Nome *" type="text" value={currentLand.description} onChange={(v) => setCurrentLand({...currentLand, description: v})} />
                            </div>
                            <div className="col-span-2">
                                <InputField label="CEP" type="text" value={currentLand.zipCode} onChange={(v) => setCurrentLand({...currentLand, zipCode: v})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                            <div className="col-span-10">
                                <InputField label="Endereço (Rua/Av)" type="text" value={currentLand.address} onChange={(v) => setCurrentLand({...currentLand, address: v})} />
                            </div>
                            <div className="col-span-2">
                                <InputField label="Número" type="text" value={currentLand.number} onChange={(v) => setCurrentLand({...currentLand, number: v})} />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                             <InputField label="Bairro" type="text" value={currentLand.neighborhood} onChange={(v) => setCurrentLand({...currentLand, neighborhood: v})} />
                             <InputField label="Cidade" type="text" value={currentLand.city} onChange={(v) => setCurrentLand({...currentLand, city: v})} />
                             <InputField label="Estado" type="text" value={currentLand.state} onChange={(v) => setCurrentLand({...currentLand, state: v})} />
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">Informações de Negócio</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Área Total (m²)" value={currentLand.area} onChange={(v) => setCurrentLand({...currentLand, area: v})} />
                                <InputField label="Valor Pedido (R$)" prefix="R$" value={currentLand.price} onChange={(v) => setCurrentLand({...currentLand, price: v})} />
                            </div>
                            <div className="mt-4">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Status</label>
                                <select 
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm"
                                    value={currentLand.status}
                                    onChange={(e) => setCurrentLand({...currentLand, status: e.target.value as any})}
                                >
                                    <option>Em Análise</option>
                                    <option>Em Negociação</option>
                                    <option>Comprado</option>
                                    <option>Descartado</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Anotações Gerais</label>
                            <textarea 
                                className="w-full h-32 bg-white border border-slate-200 rounded-lg px-3 py-2 mt-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                value={currentLand.notes}
                                onChange={(e) => setCurrentLand({...currentLand, notes: e.target.value})}
                                placeholder="Detalhes sobre a topografia, proprietários, zoneamento, etc..."
                            />
                        </div>
                    </div>

                    {/* Coluna Direita: Mapa e Proprietários */}
                    <div className="space-y-6">
                         <div className="bg-slate-100 h-64 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-slate-200">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                             <span className="text-xs font-bold uppercase">Visualização de Mapa</span>
                             <span className="text-[10px] mt-1">(Em breve: Google Maps API)</span>
                         </div>
                         
                         <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                             <h3 className="text-sm font-bold text-slate-700 mb-3">Dados do Proprietário</h3>
                             <div className="space-y-3">
                                 <InputField label="Nome Proprietário" type="text" value={currentLand.ownerName || ''} onChange={(v) => setCurrentLand({...currentLand, ownerName: v})} />
                                 <InputField label="Contato / Tel" type="text" value={currentLand.ownerContact || ''} onChange={(v) => setCurrentLand({...currentLand, ownerContact: v})} />
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- LIST VIEW ---
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-fadeIn min-h-[500px]">
             <div className="flex justify-between items-center mb-8">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800">Cadastro de Terrenos</h2>
                    <p className="text-slate-500 text-sm">Gerencie seu banco de terrenos (Landbank) e vincule aos estudos.</p>
                 </div>
                 <button 
                    onClick={() => setCurrentLand(INITIAL_LAND)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md flex items-center gap-2 text-sm"
                 >
                    <span>+ Adicionar Terreno</span>
                 </button>
             </div>

             {isLoading ? (
                 <div className="text-center py-20 text-slate-400">Carregando terrenos...</div>
             ) : lands.length === 0 ? (
                 <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                     <p className="text-slate-500 font-medium">Nenhum terreno cadastrado.</p>
                     <button onClick={() => setCurrentLand(INITIAL_LAND)} className="text-blue-600 font-bold text-sm mt-2 hover:underline">Cadastrar o primeiro</button>
                 </div>
             ) : (
                 <div className="overflow-x-auto">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                             <tr>
                                 <th className="px-4 py-3 rounded-tl-lg">Código</th>
                                 <th className="px-4 py-3">Descrição</th>
                                 <th className="px-4 py-3">Localização</th>
                                 <th className="px-4 py-3">Área (m²)</th>
                                 <th className="px-4 py-3">Valor (R$)</th>
                                 <th className="px-4 py-3">Status</th>
                                 <th className="px-4 py-3 rounded-tr-lg text-right">Ações</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {lands.map((land) => (
                                 <tr key={land.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onSelectForProject ? onSelectForProject(land) : setCurrentLand(land)}>
                                     <td className="px-4 py-3 font-medium text-slate-600">{land.code || '-'}</td>
                                     <td className="px-4 py-3 font-bold text-slate-800">{land.description}</td>
                                     <td className="px-4 py-3 text-slate-600">{land.address}, {land.neighborhood}</td>
                                     <td className="px-4 py-3 text-slate-600">{land.area.toLocaleString()} m²</td>
                                     <td className="px-4 py-3 font-medium text-emerald-600">R$ {land.price.toLocaleString()}</td>
                                     <td className="px-4 py-3">
                                         <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase
                                            ${land.status === 'Comprado' ? 'bg-green-100 text-green-700' : 
                                              land.status === 'Descartado' ? 'bg-red-100 text-red-700' : 
                                              'bg-blue-100 text-blue-700'}`}>
                                             {land.status}
                                         </span>
                                     </td>
                                     <td className="px-4 py-3 text-right">
                                         {onSelectForProject ? (
                                             <button className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded font-bold text-xs hover:bg-indigo-200">Selecionar</button>
                                         ) : (
                                             <button onClick={(e) => handleDelete(land.id!, e)} className="text-slate-400 hover:text-red-500 p-1">
                                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                             </button>
                                         )}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
             )}
        </div>
    );
};
