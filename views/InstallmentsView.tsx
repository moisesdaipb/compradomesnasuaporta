import React, { useState } from 'react';
import { ViewState, Installment, InstallmentStatus, PaymentMethod, Sale, OrderStatus, Customer, DailyClosing, BasketModel } from '../types';
import PartialPaymentModal from '../components/PartialPaymentModal';
import { normalizeText } from '../utils';

interface InstallmentsViewProps {
    basketModels: BasketModel[];
    installments: Installment[];
    sales: Sale[];
    userRole: string;
    userId: string;
    sellerId: string;
    customers: Customer[];
    dailyClosings: DailyClosing[];
    onPayInstallment: (id: string, paymentMethod: PaymentMethod) => void;
    onUndoPayInstallment: (id: string) => void;
    onUpdateInstallments: (saleId: string, updatedInstallments: any[]) => Promise<void>;
    onRefresh?: () => void;
    setView: (v: ViewState) => void;
    isReadOnly?: boolean;
}

const InstallmentsView: React.FC<InstallmentsViewProps> = ({
    basketModels,
    installments,
    sales,
    userRole,
    userId,
    sellerId,
    customers,
    dailyClosings,
    onPayInstallment,
    onUndoPayInstallment,
    onUpdateInstallments,
    onRefresh,
    setView,
    isReadOnly = false,
}) => {
    const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [payingId, setPayingId] = useState<string | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [partialPaymentInst, setPartialPaymentInst] = useState<Installment | null>(null);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

    // Update overdue status
    const today = Date.now();
    
    // 1. Process and Filter in a single pass for maximum reliability
    // 0. Deduplicate installments by ID (keep last occurrence which is freshest)
    const deduped = new Map<string, Installment>();
    installments.forEach(i => deduped.set(i.id, i));
    const uniqueInstallments = Array.from(deduped.values());


    const allProcessed: (Installment & { status: InstallmentStatus })[] = [];
    const filtered: (Installment & { status: InstallmentStatus })[] = [];

    // Search query normalization
    const query = normalizeText(searchQuery);
    const cleanQuery = searchQuery.replace(/\D/g, '');

    uniqueInstallments.forEach(i => {
        // A. Basic Permissions & Sale Status
        const sale = sales.find(s => s.id === i.saleId);
        if (!sale || sale.status === OrderStatus.CANCELLED) return;
        if (userRole !== 'gerente' && sale.sellerId !== userId) return;

        // B. Calculate Status (Handle Overdue locally and normalize strings)
        let currentStatus = i.status;
        
        // Ensure status matches Enum case exactly even if source is different (e.g. 'paid' vs 'Pago')
        if (typeof currentStatus === 'string') {
            const s = currentStatus.toLowerCase().trim();
            if (s === 'pago' || s === 'paid') currentStatus = InstallmentStatus.PAID;
            else if (s === 'atrasado' || s === 'overdue') currentStatus = InstallmentStatus.OVERDUE;
            else if (s === 'pendente' || s === 'pending') currentStatus = InstallmentStatus.PENDING;
            else if (s === 'cancelado' || s === 'cancelled') currentStatus = InstallmentStatus.CANCELLED;
        }

        if (currentStatus === InstallmentStatus.PENDING && i.dueDate < today) {
            currentStatus = InstallmentStatus.OVERDUE;
        }

        const processedItem = { ...i, status: currentStatus };
        allProcessed.push(processedItem);

        // C. Apply Tab Filter
        let matchesTab = false;
        if (filter === 'all') {
            matchesTab = true;
        } else if (filter === 'pending') {
            matchesTab = currentStatus === InstallmentStatus.PENDING;
        } else if (filter === 'paid') {
            matchesTab = currentStatus === InstallmentStatus.PAID;
        } else if (filter === 'overdue') {
            matchesTab = currentStatus === InstallmentStatus.OVERDUE;
        }

        if (!matchesTab) return;

        // D. Apply Search Filter
        if (query) {
            let matchesSearch = false;
            
            // Check direct name
            if (normalizeText(i.customerName || '').includes(query)) matchesSearch = true;
            
            // Check customer object name/cpf/phone
            if (!matchesSearch) {
                const customer = customers.find(c => c.id === i.customerId);
                if (customer) {
                    if (normalizeText(customer.name).includes(query)) matchesSearch = true;
                    if (cleanQuery) {
                        const cleanCpf = (customer.cpf || '').replace(/\D/g, '');
                        const cleanPhone = (customer.phone || '').replace(/\D/g, '');
                        if (cleanCpf.includes(cleanQuery) || cleanPhone.includes(cleanQuery)) matchesSearch = true;
                    }
                }
            }

            if (!matchesSearch) return;
        }

        filtered.push(processedItem);
    });

    const filteredInstallments = filtered.sort((a, b) => a.dueDate - b.dueDate);

    // Stats based on all processed installments
    const pendingCount = allProcessed.filter(i => i.status === InstallmentStatus.PENDING).length;
    const overdueCount = allProcessed.filter(i => i.status === InstallmentStatus.OVERDUE).length;
    const totalPending = allProcessed
        .filter(i => i.status !== InstallmentStatus.PAID && i.status !== InstallmentStatus.CANCELLED)
        .reduce((acc, i) => acc + i.amount, 0);

    const getStatusConfig = (status: InstallmentStatus) => {
        switch (status) {
            case InstallmentStatus.PENDING:
                return { color: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pendente' };
            case InstallmentStatus.PAID:
                return { color: 'bg-success', text: 'text-success', bg: 'bg-success/10', label: 'Pago' };
            case InstallmentStatus.OVERDUE:
                return { color: 'bg-danger', text: 'text-danger', bg: 'bg-danger/10', label: 'Atrasado' };
            default:
                return { color: 'bg-slate-500', text: 'text-slate-500', bg: 'bg-slate-50', label: 'Desconhecido' };
        }
    };

    const getOrderConfig = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.PENDING: return { color: 'bg-yellow-500', label: 'Pendente' };
            case OrderStatus.IN_DELIVERY: return { color: 'bg-blue-500', label: 'Em Entrega' };
            case OrderStatus.DELIVERED: return { color: 'bg-success', label: 'Entregue' };
            case OrderStatus.CANCELLED: return { color: 'bg-danger', label: 'Cancelado' };
            default: return { color: 'bg-slate-500', label: 'Desconhecido' };
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold leading-tight">Parcelado</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Contas Parceladas</p>
                    </div>
                    {onRefresh && (
                        <button
                            onClick={() => onRefresh()}
                            className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 active:scale-95 transition-all text-primary"
                            title="Atualizar Dados"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="px-4 mt-4 grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Pendentes</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-2xl font-bold text-danger">{overdueCount}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Atrasadas</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-lg font-bold text-primary">R$ {totalPending.toFixed(0)}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Parcelado</p>
                </div>
            </div>

            {/* Search */}
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
                        placeholder="Buscar por cliente..."
                    />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 mt-4">
                <div className="flex gap-2 overflow-x-auto">
                    {[
                        { id: 'pending', label: 'Pendentes' },
                        { id: 'overdue', label: 'Atrasadas' },
                        { id: 'paid', label: 'Pagas' },
                        { id: 'all', label: 'Todas' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as typeof filter)}
                            className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${filter === f.id
                                ? 'bg-primary text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Installments List */}
            <div className="flex-1 p-4 space-y-3 pb-32 overflow-y-auto">
                {filteredInstallments.length === 0 ? (
                    <div className="text-center py-10">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">payments</span>
                        <p className="text-slate-500">Nenhuma parcela encontrada</p>
                    </div>
                ) : (
                    filteredInstallments.map((installment, idx) => {
                        const statusConfig = getStatusConfig(installment.status);
                        const isPast = installment.dueDate < today;

                        return (
                            <div
                                key={`${installment.id}-${idx}`}
                                onClick={() => setSelectedSale(sales.find(s => s.id === installment.saleId) || null)}
                                className={`bg-white dark:bg-slate-800 p-4 rounded-xl border transition-all cursor-pointer hover:border-primary/30 active:scale-[0.98] ${installment.status === InstallmentStatus.OVERDUE
                                    ? 'border-danger/30'
                                    : 'border-slate-100 dark:border-slate-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-bold">{installment.customerName}</p>
                                        <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
                                            {customers.find(c => c.id === installment.customerId)?.address || ''}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Parcela {installment.number}/{installment.totalInstallments}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase shrink-0 ${statusConfig.bg} ${statusConfig.text}`}>
                                        {statusConfig.label}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-slate-400">
                                            {isPast && installment.status !== InstallmentStatus.PAID ? 'Venceu em' : 'Vence em'}
                                        </p>
                                        <p className={`font-medium ${isPast && installment.status !== InstallmentStatus.PAID ? 'text-danger' : ''}`}>
                                            {new Date(installment.dueDate).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <p className="text-xl font-black text-primary">
                                        R$ {installment.amount.toFixed(2)}
                                    </p>
                                </div>

                                {installment.status !== InstallmentStatus.PAID && (
                                    <div className="mt-3 space-y-2">
                                        {payingId === installment.id ? (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                {selectedMethod ? (
                                                    <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-2xl border-2 border-primary/20 animate-in zoom-in-95 duration-200">
                                                        <p className="text-[10px] font-black uppercase text-primary text-center mb-2 tracking-widest">Confirmar Recebimento</p>
                                                        <div className="flex items-center justify-center gap-2 mb-4 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm">
                                                            <span className="material-symbols-outlined text-primary">
                                                                {selectedMethod === PaymentMethod.PIX ? 'qr_code_2' : selectedMethod === PaymentMethod.CARD ? 'credit_card' : 'payments'}
                                                            </span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                {selectedMethod === PaymentMethod.PIX ? 'Pix' : selectedMethod === PaymentMethod.CARD ? 'Cartão' : 'Dinheiro'}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setSelectedMethod(null)}
                                                                className="flex-1 h-12 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold rounded-xl active:scale-95 transition-all text-xs"
                                                            >
                                                                Voltar
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    onPayInstallment(installment.id, selectedMethod);
                                                                    setPayingId(null);
                                                                    setSelectedMethod(null);
                                                                }}
                                                                className="flex-[2] h-12 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-primary/20 text-xs"
                                                            >
                                                                Confirmar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl animate-in zoom-in-95 duration-200">
                                                        {[
                                                            { id: PaymentMethod.PIX, icon: 'qr_code_2', label: 'Pix' },
                                                            { id: PaymentMethod.CARD, icon: 'credit_card', label: 'Cartão' },
                                                            { id: PaymentMethod.ON_DELIVERY, icon: 'payments', label: 'Dinheiro' },
                                                        ].map(method => (
                                                            <button
                                                                key={method.id}
                                                                onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                                                                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-600 active:scale-95 transition-all shadow-sm"
                                                            >
                                                                <span className="material-symbols-outlined text-lg text-primary">{method.icon}</span>
                                                                <span className="text-[10px] font-bold text-slate-500 mt-1">{method.label}</span>
                                                            </button>
                                                        ))}
                                                            <button
                                                                onClick={() => setPayingId(null)}
                                                                className="col-span-2 text-[10px] font-bold text-slate-400 py-1"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setPartialPaymentInst(installment);
                                                                    setPayingId(null);
                                                                }}
                                                                className="col-span-1 text-[10px] font-bold text-blue-500 py-1 flex items-center justify-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-xs">edit_note</span>
                                                                Valor Diferente
                                                            </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPayingId(installment.id);
                                                    setSelectedMethod(null);
                                                }}
                                                className="w-full py-2.5 bg-success text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98]"
                                            >
                                                <span className="material-symbols-outlined text-lg">check</span>
                                                Registrar Pagamento
                                            </button>
                                        )}
                                    </div>
                                )}

                                {installment.status === InstallmentStatus.PAID && installment.paidAt && (
                                    <div className="mt-3 flex flex-col items-center">
                                        <p className="text-xs text-success text-center">
                                            Pago em {new Date(installment.paidAt).toLocaleDateString('pt-BR')}
                                        </p>
                                        {!isReadOnly && !dailyClosings.some(c => c.installmentIds?.includes(installment.id) && (c.status === 'Pendente' || c.status === 'Aprovado')) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('Tem certeza que deseja estornar este pagamento? A parcela voltará ao status pendente.')) {
                                                        onUndoPayInstallment(installment.id);
                                                    }
                                                }}
                                                className="mt-2 text-[10px] font-black uppercase text-slate-400 hover:text-danger transition-colors flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">undo</span>
                                                Estornar Recebimento
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Partial Payment Modal */}
            {partialPaymentInst && (
                <div onClick={(e) => e.stopPropagation()}>
                    <PartialPaymentModal
                        sale={sales.find(s => s.id === partialPaymentInst.saleId)!}
                        installment={partialPaymentInst}
                        allInstallments={installments}
                        paymentMethod={selectedMethod}
                        sellerId={sellerId}
                        onClose={() => setPartialPaymentInst(null)}
                        onSave={onUpdateInstallments}
                    />
                </div>
            )}

            {/* Detailed Order Modal */}
            {selectedSale && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSale(null)} />

                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-10 duration-500">
                        <div className="p-8 pb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Detalhes do Pedido</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">#{selectedSale.id.slice(0, 12)}</p>
                                    <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-white ${getOrderConfig(selectedSale.status).color}`}>
                                        {getOrderConfig(selectedSale.status).label}
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                        <span className="material-symbols-outlined text-xs">schedule</span>
                                        {new Date(selectedSale.createdAt).toLocaleString('pt-BR')}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedSale(null)}
                                className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all text-slate-500"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-8 scrollbar-hide no-scrollbar">
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Itens do Pedido</h4>
                                <div className="space-y-4">
                                    {selectedSale.items.map((item, idx) => {
                                        const model = basketModels.find(m => m.id === item.basketModelId);
                                        return (
                                            <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50 flex gap-5">
                                                {model?.image ? (
                                                    <img src={model.image} alt={item.basketName} className="size-24 rounded-2xl object-cover shadow-md bg-white border-2 border-white dark:border-slate-700" />
                                                ) : (
                                                    <div className="size-24 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                                        <span className="material-symbols-outlined text-slate-400 text-3xl">shopping_basket</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 py-1">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h5 className="font-black text-slate-900 dark:text-white leading-tight">{item.basketName}</h5>
                                                        <p className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">x{item.quantity}</p>
                                                    </div>
                                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">R$ {item.unitPrice.toFixed(2)} unit.</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Venda Realizada Por</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                                        {selectedSale.sellerName ? (
                                            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                {selectedSale.sellerName}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 text-success">
                                                <span className="material-symbols-outlined text-sm">shopping_cart</span>
                                                Loja Online
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-500 mt-2 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">groups</span>
                                        {selectedSale.customerName}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                                        {customers.find(c => c.id === selectedSale.customerId)?.address || 'Endereço não cadastrado'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pagamento</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-primary">payments</span>
                                        <p className="text-sm font-black text-slate-900 dark:text-white">{selectedSale.paymentMethod}</p>
                                    </div>
                                    <p className="text-xs font-black text-primary mt-1">Total R$ {selectedSale.total.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Installments Breakdown */}
                            {selectedSale.paymentMethod === PaymentMethod.TERM && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Parcelas e Vencimentos</h4>
                                    <div className="space-y-2">
                                        {installments
                                            .filter(i => i.saleId === selectedSale.id)
                                            .sort((a, b) => a.number - b.number)
                                            .map((inst, idx) => {
                                                let st = inst.status;
                                                if (typeof st === 'string') {
                                                    const s = st.toLowerCase().trim();
                                                    if (s === 'pago' || s === 'paid') st = InstallmentStatus.PAID;
                                                    else if (s === 'atrasado' || s === 'overdue') st = InstallmentStatus.OVERDUE;
                                                    else if (s === 'pendente' || s === 'pending') st = InstallmentStatus.PENDING;
                                                    else if (s === 'cancelado' || s === 'cancelled') st = InstallmentStatus.CANCELLED;
                                                }
                                                const isOverdue = st === InstallmentStatus.PENDING && inst.dueDate < Date.now();
                                                const finalStatus = isOverdue ? InstallmentStatus.OVERDUE : st;

                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                                        <div>
                                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{inst.number}ª Parcela</p>
                                                            <p className={`text-xs font-bold ${isOverdue ? 'text-danger' : 'text-slate-500'}`}>
                                                                {new Date(inst.dueDate).toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-black text-primary">R$ {inst.amount.toFixed(2)}</p>
                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                                                finalStatus === InstallmentStatus.PAID ? 'bg-success/10 text-success' :
                                                                finalStatus === InstallmentStatus.OVERDUE ? 'bg-danger/10 text-danger' :
                                                                finalStatus === InstallmentStatus.CANCELLED ? 'bg-slate-500/10 text-slate-500' :
                                                                'bg-yellow-500/10 text-yellow-600'
                                                            }`}>
                                                                {finalStatus === InstallmentStatus.PAID ? 'Pago' :
                                                                 finalStatus === InstallmentStatus.OVERDUE ? 'Atrasada' : 
                                                                 finalStatus === InstallmentStatus.CANCELLED ? 'Cancelada' : 'Pendente'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstallmentsView;
