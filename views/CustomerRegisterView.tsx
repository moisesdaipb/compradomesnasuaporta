import React, { useState } from 'react';
import { ViewState, Customer, CustomerTag, Sale, Installment } from '../types';

interface CustomerRegisterViewProps {
    customers: Customer[];
    sales?: Sale[];
    installments?: Installment[];
    onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => Promise<Customer>;
    onUpdateCustomer?: (customer: Partial<Customer>) => Promise<void>;
    onSelectCustomer: (customer: Customer) => void;
    setView: (v: ViewState) => void;
    isReadOnly?: boolean;
}

const PREDEFINED_TAGS: CustomerTag[] = [
    { type: 'bom_pagador', customLabel: 'Bom pagador', customIcon: 'thumb_up' },
    { type: 'mau_pagador', customLabel: 'Mau pagador', customIcon: 'warning' },
    { type: 'recorrente', customLabel: 'Venda recorrente', customIcon: 'autorenew' }
];

const AVAILABLE_ICONS = ['sell', 'star', 'favorite', 'verified', 'local_shipping', 'storefront', 'workspace_premium'];

const CustomerRegisterView: React.FC<CustomerRegisterViewProps> = ({
    customers,
    sales = [],
    installments = [],
    onAddCustomer,
    onUpdateCustomer,
    onSelectCustomer,
    setView,
    isReadOnly = false,
}) => {
    const [mode, setMode] = useState<'search' | 'register' | 'edit' | 'dossier'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [dossierCustomer, setDossierCustomer] = useState<Customer | null>(null);
    const [dossierDetailsMode, setDossierDetailsMode] = useState<'aVencer' | 'vencidas' | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        cpf: '',
        phone: '',
        address: '',
        addressNumber: '',
        neighborhood: '',
        city: '',
        zipCode: '',
        state: '',
        complement: '',
        email: '',
        tags: [] as CustomerTag[],
    });

    const [isSearching, setIsSearching] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [cpfError, setCpfError] = useState<string | null>(null);
    
    // Tag builder state for 'outros'
    const [showTagBuilder, setShowTagBuilder] = useState(false);
    const [customTagLabel, setCustomTagLabel] = useState('');
    const [customTagIcon, setCustomTagIcon] = useState('sell');

    // CEP Lookup (BrasilAPI)
    React.useEffect(() => {
        const cleanCEP = formData.zipCode?.replace(/\D/g, '');
        if (cleanCEP?.length === 8) {
            const fetchCEP = async () => {
                setIsSearching(true);
                try {
                    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCEP}`);
                    if (!response.ok) throw new Error('CEP não encontrado');
                    const data = await response.json();
                    setFormData(prev => ({
                        ...prev,
                        address: data.street || prev.address,
                        neighborhood: data.neighborhood || prev.neighborhood,
                        city: data.city || prev.city,
                        state: data.state || prev.state,
                        zipCode: data.cep || prev.zipCode,
                    }));
                } catch (error) {
                    console.error('CEP lookup error:', error);
                } finally {
                    setIsSearching(false);
                }
            };
            fetchCEP();
        }
    }, [formData.zipCode]);

    const validateCPF = (cpf: string) => {
        const cleanCPF = cpf.replace(/\D/g, '');
        if (cleanCPF.length === 0) return true;
        if (cleanCPF.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

        let sum = 0;
        let rev;
        for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cleanCPF.charAt(9))) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cleanCPF.charAt(10))) return false;

        return true;
    };

    const filteredCustomers = customers.filter(c => {
        const query = searchQuery.toLowerCase();
        const cleanQuery = searchQuery.replace(/\D/g, '');
        const cleanCpf = (c.cpf || '').replace(/\D/g, '');
        
        return (
            (c.name || '').toLowerCase().includes(query) ||
            (cleanCpf && cleanQuery && cleanCpf.includes(cleanQuery)) ||
            (c.cpf || '').includes(searchQuery) ||
            (c.phone || '').includes(searchQuery) ||
            (c.phone || '').replace(/\D/g, '').includes(cleanQuery) ||
            (c.email || '').toLowerCase().includes(query) ||
            (c.tags || []).some(t => t.customLabel?.toLowerCase().includes(query))
        );
    });

    const formatCPF = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
    };

    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').slice(0, 15);
    };

    const handleRegisterOrUpdate = async () => {
        if (!formData.name || !formData.cpf || !formData.phone || !formData.address || !formData.addressNumber || isRegistering) return;

        if (!validateCPF(formData.cpf)) {
            setCpfError('CPF inválido');
            return;
        }
        setCpfError(null);
        setIsRegistering(true);

        try {
            if (mode === 'edit' && editingCustomer && onUpdateCustomer) {
                await onUpdateCustomer({
                    id: editingCustomer.id,
                    name: formData.name,
                    cpf: formData.cpf,
                    phone: formData.phone,
                    address: formData.address,
                    addressNumber: formData.addressNumber,
                    neighborhood: formData.neighborhood,
                    city: formData.city,
                    zipCode: formData.zipCode || undefined,
                    state: formData.state || undefined,
                    complement: formData.complement || undefined,
                    email: formData.email || undefined,
                    tags: formData.tags,
                });
                setMode('search');
                setEditingCustomer(null);
            } else {
                const newCustomer = await onAddCustomer({
                    name: formData.name,
                    cpf: formData.cpf,
                    phone: formData.phone,
                    address: formData.address,
                    addressNumber: formData.addressNumber,
                    neighborhood: formData.neighborhood,
                    city: formData.city,
                    zipCode: formData.zipCode || undefined,
                    state: formData.state || undefined,
                    complement: formData.complement || undefined,
                    email: formData.email || undefined,
                    tags: formData.tags,
                });
                onSelectCustomer(newCustomer);
                setView('presential-sale');
            }
        } catch (error: any) {
            console.error('Operation failed:', error);
            if (error.message === 'CPF_ALREADY_EXISTS') {
                alert('Este CPF já está cadastrado para outro cliente.');
            } else {
                alert('Falha ao processar operação. Verifique sua conexão.');
            }
        } finally {
            setIsRegistering(false);
        }
    };

    const handleEditCustomerClick = (e: React.MouseEvent, customer: Customer) => {
        e.stopPropagation();
        setEditingCustomer(customer);
        setFormData({
            name: customer.name || '',
            cpf: customer.cpf || '',
            phone: customer.phone || '',
            address: customer.address || '',
            addressNumber: customer.addressNumber || '',
            neighborhood: customer.neighborhood || '',
            city: customer.city || '',
            zipCode: customer.zipCode || '',
            state: customer.state || '',
            complement: customer.complement || '',
            email: customer.email || '',
            tags: customer.tags || [],
        });
        setMode('edit');
        setShowTagBuilder(false);
        setDossierDetailsMode(null);
    };

    const handleViewDossierClick = (e: React.MouseEvent, customer: Customer) => {
        e.stopPropagation();
        setDossierCustomer(customer);
        setDossierDetailsMode(null);
        setMode('dossier');
    };

    const toggleTag = (tag: CustomerTag) => {
        setFormData(prev => {
            const hasTag = prev.tags.find(t => t.type === tag.type && (tag.type !== 'outros' || t.customLabel === tag.customLabel));
            if (hasTag) {
                return { ...prev, tags: prev.tags.filter(t => !(t.type === tag.type && (tag.type !== 'outros' || t.customLabel === tag.customLabel))) };
            }
            return { ...prev, tags: [...prev.tags, tag] };
        });
    };

    const handleAddCustomTag = () => {
        if (!customTagLabel.trim()) return;
        const newTag: CustomerTag = {
            type: 'outros',
            customLabel: customTagLabel.trim(),
            customIcon: customTagIcon,
        };
        toggleTag(newTag);
        setCustomTagLabel('');
        setShowTagBuilder(false);
    };
    
    const getTagColor = (type: string) => {
        switch (type) {
            case 'bom_pagador': return 'bg-success text-white border-success';
            case 'mau_pagador': return 'bg-danger text-white border-danger';
            case 'recorrente': return 'bg-blue-500 text-white border-blue-500';
            default: return 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900';
        }
    };

    const resetForm = () => {
        setFormData({
            name: '', cpf: '', phone: '', address: '', addressNumber: '', neighborhood: '',
            city: '', zipCode: '', state: '', complement: '', email: '', tags: []
        });
        setCpfError(null);
    };

    // --- DOSSIER CALCULATIONS ---
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
                    const dueStr = typeof inst.dueDate === 'string' ? inst.dueDate : new Date(inst.dueDate).toISOString().split('T')[0];
                    const paidStr = typeof inst.paidAt === 'number' ? new Date(inst.paidAt).toISOString().split('T')[0] : new Date(inst.paidAt).toISOString().split('T')[0];
                    if (paidStr > dueStr) {
                        pagasAtrasadas++;
                    }
                }
            } else if (inst.status === 'Pendente' || inst.status === 'Atrasado') {
                if (inst.dueDate) {
                    const dueStr = typeof inst.dueDate === 'string' ? inst.dueDate : new Date(inst.dueDate).toISOString().split('T')[0];
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
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (dossierDetailsMode !== null) {
                                    setDossierDetailsMode(null);
                                } else if (mode === 'edit' || mode === 'dossier') {
                                    setMode('search');
                                    setEditingCustomer(null);
                                    setDossierCustomer(null);
                                } else if (mode === 'register') {
                                    setMode('search');
                                } else {
                                    setView('presential-sale');
                                }
                            }}
                            className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h3 className="text-lg font-bold leading-tight">Clientes</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {dossierDetailsMode ? 'Detalhes de Parcelas' : mode === 'search' ? 'Buscar ou cadastrar' : mode === 'edit' ? 'Editar cliente' : mode === 'dossier' ? 'Dossiê do cliente' : 'Novo cadastro'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mode Tabs */}
            {(mode === 'search' || mode === 'register') && (
                <div className="px-4 mt-2">
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                        <button
                            onClick={() => setMode('search')}
                            className={`flex-1 py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all ${mode === 'search'
                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                : 'text-slate-500'
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm">search</span>
                            Buscar
                        </button>
                        {!isReadOnly && (
                            <button
                                onClick={() => {
                                    setMode('register');
                                    setEditingCustomer(null);
                                    setFormData({
                                        name: '', cpf: '', phone: '', address: '', addressNumber: '',
                                        complement: '', neighborhood: '', city: '', email: '', tags: []
                                    });
                                }}
                                className={`flex-1 py-1.5 rounded-lg font-medium text-xs flex items-center justify-center gap-2 transition-all ${mode === 'register'
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-slate-500'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-sm">person_add</span>
                                Cadastrar
                            </button>
                        )}
                    </div>
                </div>
            )}

            {mode === 'search' ? (
                <>
                    {/* Search Input */}
                    <div className="px-4 mt-4">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Nome, CPF ou etiqueta..."
                            />
                        </div>
                    </div>

                    {/* Results */}
                    <div className="flex-1 p-4 space-y-2 overflow-y-auto pb-32">
                        {filteredCustomers.length === 0 ? (
                            <div className="text-center py-10">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">person_search</span>
                                <p className="text-slate-500">Nenhum cliente encontrado</p>
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setMode('register');
                                    }}
                                    className="mt-4 text-primary font-medium"
                                >
                                    Cadastrar novo cliente
                                </button>
                            </div>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <div
                                    key={customer.id}
                                    onClick={(e) => handleViewDossierClick(e, customer)}
                                    className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-transform cursor-pointer group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-primary">person</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold truncate">{customer.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{customer.cpf} • {customer.phone}</p>
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
                                        {/* Actions */}
                                        <div className="flex flex-col items-center gap-1 shrink-0">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => handleViewDossierClick(e, customer)}
                                                    className="p-1.5 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                                                    title="Dossiê do Cliente"
                                                >
                                                    <span className="material-symbols-outlined text-xl">query_stats</span>
                                                </button>
                                                {onUpdateCustomer && (
                                                    <button
                                                        onClick={(e) => handleEditCustomerClick(e, customer)}
                                                        className="p-1.5 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                                                        title="Editar Cliente"
                                                    >
                                                        <span className="material-symbols-outlined text-xl">edit</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            ) : mode === 'dossier' && dossierCustomer ? (
                <div className="flex-1 overflow-y-auto pb-24 bg-slate-50 dark:bg-slate-900/50 no-scrollbar">
                    {(() => {
                        const stats = getDossierStats(dossierCustomer.id);
                        
                        // Render Dossier Detailed Mode (A Vencer / Vencidas)
                        if (dossierDetailsMode) {
                            const list = dossierDetailsMode === 'aVencer' ? stats.parcelasAVencerList : stats.parcelasVencidasList;
                            const title = dossierDetailsMode === 'aVencer' ? 'Parcelas a Vencer / Ativas' : 'Parcelas Vencidas (Em Atraso)';
                            const icon = dossierDetailsMode === 'aVencer' ? 'event' : 'warning';
                            const colorClass = dossierDetailsMode === 'aVencer' ? 'text-blue-500' : 'text-danger';

                            return (
                                <div className="p-4 space-y-4 animate-in fade-in slide-in-from-right-2">
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className={`material-symbols-outlined text-3xl ${colorClass}`}>{icon}</span>
                                            <div>
                                                <h3 className="font-bold text-lg leading-tight">{title}</h3>
                                                <p className="text-xs text-slate-500">{list.length} parcelas encontradas</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
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

                                    {/* Action Button inside detailed views */}
                                    {!isReadOnly && (
                                        <div className="pt-2 pb-6">
                                            <button 
                                                onClick={() => {
                                                    onSelectCustomer(dossierCustomer);
                                                    setView('presential-sale');
                                                }}
                                                className="w-full h-14 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-transform active:scale-95 shadow-xl shadow-primary/30"
                                            >
                                                <span className="material-symbols-outlined">shopping_cart</span>
                                                Iniciar Nova Venda
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Render Main Dossier Overview
                        return (
                            <div className="p-4 space-y-4 animate-in fade-in">
                                {/* Header Card */}
                                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden">
                                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                                    <div className="flex items-center gap-4 mb-3 relative z-10">
                                        <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-primary text-2xl">person</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold leading-tight">{dossierCustomer.name}</h2>
                                            <p className="text-sm text-slate-500 mt-1">{dossierCustomer.cpf} • {dossierCustomer.phone}</p>
                                        </div>
                                    </div>
                                    {dossierCustomer.tags && dossierCustomer.tags.length > 0 && (
                                        <div className="flex gap-2 flex-wrap pt-3 border-t border-slate-100 dark:border-slate-700 relative z-10">
                                            {dossierCustomer.tags.map((t, idx) => (
                                                <span key={idx} className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${getTagColor(t.type)} bg-opacity-10 text-opacity-100 dark:bg-opacity-20`}>
                                                    <span className="material-symbols-outlined text-[14px]">{t.customIcon || 'sell'}</span>
                                                    <span className={`${getTagColor(t.type).includes('success') ? 'text-success' : getTagColor(t.type).includes('danger') ? 'text-danger' : getTagColor(t.type).includes('blue') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {t.customLabel}
                                                    </span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* KPI Metrics */}
                                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1 pt-2">VISÃO GERAL DO CLIENTE</h3>
                                
                                <div className="grid grid-cols-2 gap-3 relative z-10">
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-primary">shopping_bag</span>
                                            <span className="text-xs font-medium text-slate-500">Total Compras</span>
                                        </div>
                                        <p className="text-2xl font-black">{stats.totalCompras}</p>
                                    </div>
                                    
                                     <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-primary">payments</span>
                                            <span className="text-xs font-medium text-slate-500">Valor Comprado</span>
                                        </div>
                                        <p className="text-xl font-black text-primary truncate">R$ {stats.valorTotalComprado.toFixed(2)}</p>
                                    </div>

                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-success">check_circle</span>
                                            <span className="text-xs font-medium text-slate-500">Parcelas Pagas</span>
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.parcelasPagas}</p>
                                    </div>
                                    
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                        <div className="flex items-center gap-2 mb-2 truncate">
                                            <span className="material-symbols-outlined text-orange-500">history_toggle_off</span>
                                            <span className="text-xs font-medium text-slate-500 truncate">Pagas c/ Atraso</span>
                                        </div>
                                        <p className="text-2xl font-black">{stats.pagasAtrasadas}</p>
                                    </div>
                                    
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
                                    </button>

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
                                    </button>
                                </div>

                                {/* Full Sales History */}
                                {stats.historySales.length > 0 && (
                                    <>
                                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-1 pt-4 uppercase tracking-widest">Histórico Completo de Compras</h3>
                                        <div className="space-y-2 pb-6">
                                            {stats.historySales.map(sale => (
                                                <div key={sale.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between shadow-sm">
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
                                
                                    {!isReadOnly && (
                                        <div className="pt-2 pb-10">
                                            <button 
                                                onClick={() => {
                                                    onSelectCustomer(dossierCustomer);
                                                    setView('presential-sale');
                                                }}
                                                className="w-full h-14 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-transform active:scale-95 shadow-xl shadow-primary/30"
                                            >
                                                <span className="material-symbols-outlined">shopping_cart</span>
                                                Iniciar Nova Venda
                                            </button>
                                        </div>
                                    )}
                            </div>
                        );
                    })()}
                </div>
            ) : (
                <form className="flex-1 p-4 space-y-4 overflow-y-auto pb-40">
                    {/* Name */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            Nome Completo *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Nome do cliente"
                        />
                    </div>

                    {/* CPF and Phone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                CPF * {mode === 'edit' && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded ml-2 font-normal">(Não editável)</span>}
                            </label>
                            <input
                                type="text"
                                value={formData.cpf}
                                disabled={mode === 'edit'}
                                onChange={(e) => {
                                    setFormData({ ...formData, cpf: formatCPF(e.target.value) });
                                    if (cpfError) setCpfError(null);
                                }}
                                className={`w-full h-12 px-4 rounded-xl border ${mode === 'edit' ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-700'} focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${cpfError ? 'border-danger ring-1 ring-danger' : 'border-slate-200 dark:border-slate-600'}`}
                                placeholder="000.000.000-00"
                            />
                            {cpfError && <p className="text-[10px] text-danger font-bold mt-1 ml-1">{cpfError}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Telefone *
                            </label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    {/* CEP */}
                    <div className="relative">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            CEP (preenche endereço)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formData.zipCode}
                                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="00000-000"
                            />
                            {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 ml-1 group">Se não souber o CEP, pode preencher abaixo manualmente.</p>
                    </div>

                    {/* Address and Number */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-3">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Endereço *
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Rua, Avenida..."
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Nº *
                            </label>
                            <input
                                type="text"
                                value={formData.addressNumber}
                                onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent text-center"
                                placeholder="123"
                            />
                        </div>
                    </div>

                    {/* Complement */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            Complemento
                        </label>
                        <input
                            type="text"
                            value={formData.complement}
                            onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Apt, Bloco, etc."
                        />
                    </div>

                    {/* Neighborhood and City */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Bairro *
                            </label>
                            <input
                                type="text"
                                value={formData.neighborhood}
                                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Bairro"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Cidade *
                            </label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Cidade"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            Email (opcional)
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="email@exemplo.com"
                        />
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                        <label className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 block flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">label</span>
                            Etiquetas do Cliente
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {PREDEFINED_TAGS.map((tag) => {
                                const isActive = formData.tags.some(t => t.type === tag.type);
                                return (
                                    <button
                                        key={tag.type}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                                            isActive 
                                            ? getTagColor(tag.type)
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        <span className={`material-symbols-outlined text-[16px]`}>{tag.customIcon}</span>
                                        {tag.customLabel}
                                    </button>
                                );
                            })}
                            
                            {/* Render custom tags that are active */}
                            {formData.tags.filter(t => t.type === 'outros').map((customTag, idx) => (
                                <button
                                    key={`custom-${idx}`}
                                    type="button"
                                    onClick={() => toggleTag(customTag)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900"
                                >
                                    <span className={`material-symbols-outlined text-[16px]`}>{customTag.customIcon}</span>
                                    {customTag.customLabel}
                                    <span className="material-symbols-outlined text-[14px] ml-1 opacity-60">close</span>
                                </button>
                            ))}

                            <button
                                type="button"
                                onClick={() => setShowTagBuilder(!showTagBuilder)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed text-sm font-medium transition-colors ${showTagBuilder ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                Adicionar outra
                            </button>
                        </div>

                        {showTagBuilder && (
                            <div className="mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Nome da Etiqueta</label>
                                    <input 
                                        type="text" 
                                        maxLength={30}
                                        value={customTagLabel}
                                        onChange={e => setCustomTagLabel(e.target.value)}
                                        placeholder="Ex: Cliente Premium"
                                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Escolha um Ícone</label>
                                    <div className="flex flex-wrap gap-2">
                                        {AVAILABLE_ICONS.map(icon => (
                                            <button
                                                key={icon}
                                                type="button"
                                                onClick={() => setCustomTagIcon(icon)}
                                                className={`size-10 rounded-lg flex items-center justify-center transition-colors ${customTagIcon === icon ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                                            >
                                                <span className="material-symbols-outlined">{icon}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddCustomTag}
                                    disabled={!customTagLabel.trim()}
                                    className="w-full h-10 mt-2 bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-bold rounded-lg disabled:opacity-50 transition-colors"
                                >
                                    Criar Etiqueta
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            )}

            {/* Register Action / Edit Button */}
            {(mode === 'register' || mode === 'edit') && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
                    <button
                        onClick={handleRegisterOrUpdate}
                        disabled={!formData.name || !formData.cpf || !formData.phone || !formData.address || !formData.addressNumber || isRegistering || isReadOnly}
                        className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${formData.name && formData.cpf && formData.phone && formData.address && formData.addressNumber && !isRegistering && !isReadOnly
                            ? 'bg-success text-white shadow-lg active:scale-[0.98]'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                            }`}
                    >
                        {isRegistering ? (
                            <div className="size-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : isReadOnly ? (
                            <>
                                <span className="material-symbols-outlined">visibility</span>
                                Modo de Visualização
                            </>
                        ) : mode === 'edit' ? (
                            <>
                                <span className="material-symbols-outlined">save</span>
                                Salvar Alterações
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">person_add</span>
                                Cadastrar e Selecionar
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default CustomerRegisterView;
