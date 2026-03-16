import React, { useState } from 'react';
import { Customer, TeamMember, ViewState } from '../types';

interface ManagerCustomersViewProps {
    customers: Customer[];
    team: TeamMember[];
    setView: (v: ViewState) => void;
    onUpdateCustomer: (c: Partial<Customer>) => Promise<void>;
}

const ManagerCustomersView: React.FC<ManagerCustomersViewProps> = ({
    customers,
    team,
    setView,
    onUpdateCustomer,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Customer>>({});
    const [isSaving, setIsSaving] = useState(false);

    const activeSellers = team.filter(t => t.role === 'vendedor' && t.status === 'ativo');

    const filteredCustomers = customers
        .filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone.includes(searchQuery) ||
            (c.cpf && c.cpf.includes(searchQuery))
        )
        .sort((a, b) => b.createdAt - a.createdAt);

    const getCreatorName = (createdBy?: string) => {
        if (!createdBy) return 'Online (Site/App)';
        const member = team.find(t => t.id === createdBy);
        return member ? `Vendedor: ${member.name}` : 'Origem Desconhecida';
    };

    const handleOpenDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
        setEditData({ ...customer });
        setIsEditing(false);
    };

    const handleSave = async () => {
        if (!selectedCustomer) return;
        setIsSaving(true);
        try {
            await onUpdateCustomer(editData);
            setSelectedCustomer({ ...selectedCustomer, ...editData } as Customer);
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving customer:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300 bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-xl font-black">Base de Clientes</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestão e Origem de Cadastros</p>
                    </div>
                </div>
            </div>

            {/* Stats & Search */}
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <p className="text-2xl font-black text-primary">{customers.length}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total de Clientes</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <p className="text-2xl font-black text-success">
                            {customers.filter(c => !c.createdBy).length}
                        </p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Auto-Cadastros</p>
                    </div>
                </div>

                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou telefone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl border border-white dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm font-bold focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* Customers List */}
            <div className="flex-1 px-6 pb-32 overflow-y-auto space-y-3 no-scrollbar">
                {filteredCustomers.map(customer => (
                    <div 
                        key={customer.id} 
                        onClick={() => handleOpenDetails(customer)}
                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-2xl">person</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">{customer.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400">{customer.phone}</span>
                                    <span className="size-1 rounded-full bg-slate-300"></span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${!customer.createdBy ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {getCreatorName(customer.createdBy)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Cadastrado em</p>
                            <p className="text-xs font-bold">{new Date(customer.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                ))}

                {filteredCustomers.length === 0 && (
                    <div className="py-20 text-center">
                        <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">search_off</span>
                        <p className="text-slate-400 font-bold">Nenhum cliente encontrado</p>
                    </div>
                )}
            </div>

            {/* Details/Edit Modal */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                    <span className="material-symbols-outlined">person</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-white">Detalhes do Cliente</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visualização e Edição</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCustomer(null)}
                                className="size-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[70vh] no-scrollbar">
                            <div className="space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Nome Completo</label>
                                        <input
                                            type="text"
                                            value={editData.name || ''}
                                            onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                            disabled={!isEditing}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">CPF (Não editável)</label>
                                        <input
                                            type="text"
                                            value={selectedCustomer.cpf || ''}
                                            disabled={true}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold text-slate-400"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Telefone/WhatsApp</label>
                                        <input
                                            type="text"
                                            value={editData.phone || ''}
                                            onChange={e => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                                            disabled={!isEditing}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Vendedor Responsável (Dono)</label>
                                        <select
                                            value={editData.createdBy || ''}
                                            onChange={e => setEditData(prev => ({ ...prev, createdBy: e.target.value || undefined }))}
                                            disabled={!isEditing}
                                            className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                        >
                                            <option value="">Online (Site/App)</option>
                                            {activeSellers.map(seller => (
                                                <option key={seller.id} value={seller.id}>{seller.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Address Section */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-700 pb-2">Endereço de Entrega</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="sm:col-span-2 space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Rua/Logradouro</label>
                                            <input
                                                type="text"
                                                value={editData.address || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, address: e.target.value }))}
                                                disabled={!isEditing}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Número</label>
                                            <input
                                                type="text"
                                                value={editData.addressNumber || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, addressNumber: e.target.value }))}
                                                disabled={!isEditing}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Bairro</label>
                                            <input
                                                type="text"
                                                value={editData.neighborhood || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, neighborhood: e.target.value }))}
                                                disabled={!isEditing}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Cidade</label>
                                            <input
                                                type="text"
                                                value={editData.city || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, city: e.target.value }))}
                                                disabled={!isEditing}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Complemento</label>
                                            <input
                                                type="text"
                                                value={editData.complement || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, complement: e.target.value }))}
                                                disabled={!isEditing}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
                            {!isEditing ? (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex-1 h-14 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined">edit</span>
                                    Editar Informações
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditData({ ...selectedCustomer });
                                        }}
                                        disabled={isSaving}
                                        className="flex-1 h-14 bg-white dark:bg-slate-800 text-slate-500 font-black uppercase tracking-widest rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="flex-[2] h-14 bg-success text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-success/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <span className="animate-spin material-symbols-outlined">sync</span>
                                        ) : (
                                            <span className="material-symbols-outlined">check_circle</span>
                                        )}
                                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerCustomersView;
