import React, { useState } from 'react';
import { Customer, TeamMember, ViewState, Sale, Installment, CustomerTag } from '../types';

interface ManagerCustomersViewProps {
    customers: Customer[];
    team: TeamMember[];
    sales?: Sale[];
    installments?: Installment[];
    setView: (v: ViewState) => void;
    onUpdateCustomer: (c: Partial<Customer>) => Promise<void>;
}

const ManagerCustomersView: React.FC<ManagerCustomersViewProps> = ({
    customers,
    team,
    sales = [],
    installments = [],
    setView,
    onUpdateCustomer,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [modalTab, setModalTab] = useState<'details' | 'dossier'>('details');
    const [dossierDetailsMode, setDossierDetailsMode] = useState<'aVencer' | 'vencidas' | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<Partial<Customer>>({});
    const [isSaving, setIsSaving] = useState(false);

    const activeSellers = team.filter(t => t.role === 'vendedor' && t.status === 'ativo');

    const filteredCustomers = customers
        .filter(c => {
            const query = searchQuery.toLowerCase();
            return (
                c.name.toLowerCase().includes(query) ||
                (c.phone && c.phone.includes(searchQuery)) ||
                (c.cpf && c.cpf.includes(searchQuery)) ||
                (c.tags || []).some(t => t.customLabel?.toLowerCase().includes(query))
            );
        })
        .sort((a, b) => b.createdAt - a.createdAt);

    const getCreatorName = (createdBy?: string) => {
        if (!createdBy) return 'Online (Site/App)';
        const member = team.find(t => t.id === createdBy);
        return member ? `Vendedor: ${member.name}` : 'Origem Desconhecida';
    };

    const getTagColor = (type: string) => {
        switch (type) {
            case 'bom_pagador': return 'bg-success text-white border-success';
            case 'mau_pagador': return 'bg-danger text-white border-danger';
            case 'recorrente': return 'bg-blue-500 text-white border-blue-500';
            default: return 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900';
        }
    };

    const handleOpenDetails = (customer: Customer, tab: 'details' | 'dossier' = 'details') => {
        setSelectedCustomer(customer);
        setEditData({ ...customer });
        setIsEditing(false);
        setModalTab(tab);
        setDossierDetailsMode(null);
    };

    const handleSave = async () => {
        if (!selectedCustomer) return;
        setIsSaving(true);
        try {
            await onUpdateCustomer({ ...editData, tags: selectedCustomer.tags });
            setSelectedCustomer({ ...selectedCustomer, ...editData } as Customer);
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving customer:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const getDossierStats = (customerId: string) => {
        const customerSales = sales.filter(s => s.customerId === customerId);
        const customerInstallments = installments.filter(i => i.customerId === customerId);

        const totalCompras = customerSales.length;
        const valorTotalComprado = customerSales.reduce((acc, sale) => acc + sale.total, 0);
        
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        let parcelasPagas = 0;
        let pagasAtrasadas = 0;

        let parcelasAVencerList: Installment[] = [];
        let parcelasVencidasList: Installment[] = [];

        customerInstallments.forEach(inst => {
            if (inst.status === 'Pago') {
                parcelasPagas++;
                if (inst.paidAt && inst.dueDate) {
                    const dueStr = new Date(inst.dueDate).toISOString().split('T')[0];
                    const paidStr = new Date(inst.paidAt).toISOString().split('T')[0];
                    if (paidStr > dueStr) {
                        pagasAtrasadas++;
                    }
                }
            } else if (inst.status === 'Pendente' || inst.status === 'Atrasado') {
                if (inst.dueDate) {
                    const dueStr = new Date(inst.dueDate).toISOString().split('T')[0];
                    if (dueStr < todayStr) {
                        parcelasVencidasList.push(inst);
                    } else {
                        parcelasAVencerList.push(inst);
                    }
                }
            }
        });

        // Sort pending installments by due date
        parcelasAVencerList.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        parcelasVencidasList.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        const historySales = customerSales.sort((a, b) => b.createdAt - a.createdAt);

        return { 
            totalCompras, 
            valorTotalComprado, 
            parcelasPagas, 
            pagasAtrasadas, 
            parcelasAVencerList, 
            parcelasVencidasList, 
            historySales 
        };
    };

    const getDaysLate = (dueDate: Date | string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(today.getTime() - due.getTime());
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
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
                        placeholder="Buscar por nome, CPF, telefone ou etiqueta..."
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
                        onClick={() => handleOpenDetails(customer, 'details')}
                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="size-12 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-primary shrink-0">
                                <span className="material-symbols-outlined text-2xl">person</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors truncate">{customer.name}</h4>
                                <div className="flex items-center gap-2 mt-1 truncate">
                                    <span className="text-[10px] font-bold text-slate-400">{customer.phone}</span>
                                    <span className="size-1 rounded-full bg-slate-300"></span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full truncate ${!customer.createdBy ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {getCreatorName(customer.createdBy)}
                                    </span>
                                </div>
                                {customer.tags && customer.tags.length > 0 && (
                                    <div className="flex gap-1.5 mt-2 flex-wrap">
                                        {customer.tags.map((t, idx) => (
                                            <span key={idx} className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${getTagColor(t.type)} bg-opacity-10 text-opacity-100 dark:bg-opacity-20`}>
                                                <span className="material-symbols-outlined text-[10px]">{t.customIcon || 'sell'}</span>
                                                <span className={`${getTagColor(t.type).includes('success') ? 'text-success' : getTagColor(t.type).includes('danger') ? 'text-danger' : getTagColor(t.type).includes('blue') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                    {t.customLabel}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Cadastrado em</p>
                                <p className="text-xs font-bold">{new Date(customer.createdAt).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenDetails(customer, 'dossier'); }}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                                    title="Dossiê do Cliente"
                                >
                                    <span className="material-symbols-outlined text-[20px]">query_stats</span>
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenDetails(customer, 'details'); }}
                                    className="p-1.5 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                    title="Editar Cliente"
                                >
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                </button>
                            </div>
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
                    <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 pt-6 pb-4 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                {dossierDetailsMode ? (
                                    <button
                                        onClick={() => setDossierDetailsMode(null)}
                                        className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500 mr-1"
                                    >
                                        <span className="material-symbols-outlined">arrow_back</span>
                                    </button>
                                ) : (
                                    <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                                        <span className="material-symbols-outlined text-2xl">person</span>
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-white leading-tight">
                                        {dossierDetailsMode ? (dossierDetailsMode === 'aVencer' ? 'Parcelas a Vencer' : 'Parcelas Vencidas') : selectedCustomer.name}
                                    </h3>
                                    {!dossierDetailsMode && <p className="text-xs text-slate-500 font-bold mt-1">{selectedCustomer.cpf} • {selectedCustomer.phone}</p>}
                                    {dossierDetailsMode && <p className="text-xs text-slate-500 font-bold mt-1">{selectedCustomer.name}</p>}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCustomer(null)}
                                className="size-10 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-500 transition-colors shrink-0"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        {!dossierDetailsMode && selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
                            <div className="px-6 pb-2 shrink-0">
                                <div className="flex gap-2 flex-wrap">
                                    {selectedCustomer.tags.map((t, idx) => (
                                        <span key={idx} className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${getTagColor(t.type)} bg-opacity-10 text-opacity-100 dark:bg-opacity-20`}>
                                            <span className="material-symbols-outlined text-[14px]">{t.customIcon || 'sell'}</span>
                                            <span className={`${getTagColor(t.type).includes('success') ? 'text-success' : getTagColor(t.type).includes('danger') ? 'text-danger' : getTagColor(t.type).includes('blue') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {t.customLabel}
                                            </span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Modal Tabs */}
                        {!dossierDetailsMode && (
                        <div className="px-6 pb-4 shrink-0 border-b border-slate-100 dark:border-slate-700">
                            <div className="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
                                <button
                                    onClick={() => setModalTab('details')}
                                    className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${modalTab === 'details' ? 'bg-white dark:bg-slate-800 text-primary shadow-sm' : 'text-slate-500'}`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">edit_document</span>
                                    Ficha Simples
                                </button>
                                <button
                                    onClick={() => setModalTab('dossier')}
                                    className={`flex-1 py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all ${modalTab === 'dossier' ? 'bg-white dark:bg-slate-800 text-blue-500 shadow-sm' : 'text-slate-500'}`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">query_stats</span>
                                    Dossiê (Histórico)
                                </button>
                            </div>
                        </div>
                        )}

                        <div className="p-6 overflow-y-auto no-scrollbar flex-1 bg-slate-50 dark:bg-slate-900/50">
                            {dossierDetailsMode ? (
                                (() => {
                                    const stats = getDossierStats(selectedCustomer.id);
                                    const list = dossierDetailsMode === 'aVencer' ? stats.parcelasAVencerList : stats.parcelasVencidasList;
                                    return (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-right-2 pb-6">
                                            {list.length === 0 ? (
                                                <div className="py-10 text-center">
                                                    <p className="text-slate-400 font-bold">Nenhuma parcela encontrada.</p>
                                                </div>
                                            ) : (
                                                list.map((inst) => {
                                                    const sale = sales.find(s => s.id === inst.saleId);
                                                    const daysLate = dossierDetailsMode === 'vencidas' ? getDaysLate(new Date(inst.dueDate)) : 0;
                                                    return (
                                                        <div key={inst.id} className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm ${dossierDetailsMode === 'vencidas' ? 'border-danger/30' : 'border-slate-100 dark:border-slate-700'}`}>
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div>
                                                                    <p className="font-bold text-slate-800 dark:text-white">R$ {inst.amount.toFixed(2)}</p>
                                                                    <p className="text-xs text-slate-500">Vencimento: {new Date(inst.dueDate).toLocaleDateString('pt-BR')}</p>
                                                                </div>
                                                                {dossierDetailsMode === 'vencidas' && (
                                                                    <div className="bg-danger/10 text-danger px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                                                        <span className="material-symbols-outlined text-[14px]">timer</span>
                                                                        {daysLate} {daysLate === 1 ? 'dia' : 'dias'} de atraso
                                                                    </div>
                                                                )}
                                                                {dossierDetailsMode === 'aVencer' && (
                                                                    <div className="bg-blue-500/10 text-blue-500 px-2 py-1 rounded-lg text-xs font-bold">
                                                                        Pendente
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {sale && (
                                                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                                                                    <span className="text-slate-500">Ref: Venda {new Date(sale.createdAt).toLocaleDateString('pt-BR')}</span>
                                                                    <span className="font-bold text-slate-400">Total: R$ {sale.total.toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    );
                                })()
                            ) : modalTab === 'details' ? (
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
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">CPF (Não editável)</label>
                                            <input
                                                type="text"
                                                value={selectedCustomer.cpf || ''}
                                                disabled={true}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-bold text-slate-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Telefone/WhatsApp</label>
                                            <input
                                                type="text"
                                                value={editData.phone || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                                                disabled={!isEditing}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Vendedor Responsável (Dono)</label>
                                            <select
                                                value={editData.createdBy || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, createdBy: e.target.value || undefined }))}
                                                disabled={!isEditing}
                                                className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
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
                                                    className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Número</label>
                                                <input
                                                    type="text"
                                                    value={editData.addressNumber || ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, addressNumber: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Bairro</label>
                                                <input
                                                    type="text"
                                                    value={editData.neighborhood || ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, neighborhood: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Cidade</label>
                                                <input
                                                    type="text"
                                                    value={editData.city || ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, city: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1 tracking-widest">Complemento</label>
                                                <input
                                                    type="text"
                                                    value={editData.complement || ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, complement: e.target.value }))}
                                                    disabled={!isEditing}
                                                    className="w-full h-12 px-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold focus:ring-2 focus:ring-primary disabled:opacity-70 disabled:bg-slate-50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Dossier View
                                (() => {
                                    const stats = getDossierStats(selectedCustomer.id);
                                    return (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-left-2 pb-6">
                                            <div className="grid grid-cols-2 gap-3">
                                                {/* Compras Realizadas */}
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-primary">shopping_bag</span>
                                                        <span className="text-xs font-medium text-slate-500">Total Compras</span>
                                                    </div>
                                                    <p className="text-2xl font-black">{stats.totalCompras}</p>
                                                </div>
                                                
                                                {/* Valor Total Comprado */}
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-primary">payments</span>
                                                        <span className="text-xs font-medium text-slate-500">Valor Comprado</span>
                                                    </div>
                                                    <p className="text-xl font-black text-primary truncate">R$ {stats.valorTotalComprado.toFixed(2)}</p>
                                                </div>

                                                {/* Parcelas Pagas */}
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-success">check_circle</span>
                                                        <span className="text-xs font-medium text-slate-500">Parcelas Pagas</span>
                                                    </div>
                                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.parcelasPagas}</p>
                                                </div>
                                                
                                                {/* Pagas com Atraso */}
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                    <div className="flex items-center gap-2 mb-2 truncate">
                                                        <span className="material-symbols-outlined text-orange-500">history_toggle_off</span>
                                                        <span className="text-xs font-medium text-slate-500 truncate">Pagas c/ Atraso</span>
                                                    </div>
                                                    <p className="text-2xl font-black">{stats.pagasAtrasadas}</p>
                                                </div>

                                                {/* Parcelas A Vencer */}
                                                <button 
                                                    onClick={() => setDossierDetailsMode('aVencer')}
                                                    className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm text-left hover:border-blue-300 dark:hover:border-blue-700 transition-colors group relative overflow-hidden"
                                                >
                                                    <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="material-symbols-outlined text-blue-500">open_in_new</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-blue-500">event</span>
                                                        <span className="text-xs font-medium text-slate-500 group-hover:text-blue-500 transition-colors">A Vencer</span>
                                                    </div>
                                                    <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.parcelasAVencerList.length}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Ver parcelas</p>
                                                </button>

                                                {/* Em Atraso (Vencidas) */}
                                                <button 
                                                    onClick={() => setDossierDetailsMode('vencidas')}
                                                    className={`p-4 rounded-2xl border shadow-sm text-left relative overflow-hidden transition-colors group ${stats.parcelasVencidasList.length > 0 ? 'bg-danger/10 border-danger/30 hover:border-danger/60' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300'}`}
                                                >
                                                    <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className={`material-symbols-outlined ${stats.parcelasVencidasList.length > 0 ? 'text-danger' : 'text-slate-400'}`}>open_in_new</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className={`material-symbols-outlined ${stats.parcelasVencidasList.length > 0 ? 'text-danger' : 'text-slate-400'}`}>warning</span>
                                                        <span className={`text-xs font-medium ${stats.parcelasVencidasList.length > 0 ? 'text-danger' : 'text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200'}`}>Vencidas</span>
                                                    </div>
                                                    <p className={`text-2xl font-black ${stats.parcelasVencidasList.length > 0 ? 'text-danger' : 'text-slate-400 dark:text-slate-500'}`}>{stats.parcelasVencidasList.length}</p>
                                                    <p className={`text-[10px] mt-1 ${stats.parcelasVencidasList.length > 0 ? 'text-danger opacity-80' : 'text-slate-400'}`}>Ver parcelas</p>
                                                </button>
                                            </div>

                                            {/* Full History Sales */}
                                            {stats.historySales.length > 0 && (
                                                <>
                                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pt-4 pb-1 ml-1 border-b border-slate-100 dark:border-slate-700">Histórico de Compras</h3>
                                                    <div className="space-y-2">
                                                        {stats.historySales.map(sale => (
                                                            <div key={sale.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-sm font-bold">{new Date(sale.createdAt).toLocaleDateString('pt-BR')}</p>
                                                                    <p className="text-xs text-slate-500">{sale.installmentsCount} {sale.installmentsCount > 1 ? 'parcelas' : 'parcela'} • {sale.paymentMethod}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-sm font-bold text-primary">R$ {sale.total.toFixed(2)}</p>
                                                                    <div className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                                                                        sale.status === 'Concluída' ? 'bg-success/10 text-success' :
                                                                        sale.status === 'Cancelada' ? 'bg-danger/10 text-danger' :
                                                                        'bg-orange-500/10 text-orange-500'
                                                                    }`}>
                                                                        {sale.status}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })()
                            )}
                        </div>

                        {/* Modal Footer - Only show actions for details tab and not in sub-detail mode */}
                        {modalTab === 'details' && !dossierDetailsMode && (
                            <div className="p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-3 shrink-0">
                                {!isEditing ? (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex-1 h-14 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">edit</span>
                                        Liberar Edição
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
                                                <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                            )}
                                            {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagerCustomersView;
