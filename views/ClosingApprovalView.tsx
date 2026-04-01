import React, { useState, useMemo } from 'react';
import { ViewState, DailyClosing, ClosingStatus, TeamMember, Installment, Sale, OrderStatus, PaymentMethod, Delivery } from '../types';

interface ClosingApprovalViewProps {
    dailyClosings: DailyClosing[];
    sales: any[]; // Using any temporarily, ideally Sale[]
    team: TeamMember[];
    installments: Installment[];
    deliveries: Delivery[];
    onApproveClosing: (id: string) => void;
    onRejectClosing: (id: string, reason: string) => void;
    onUpdateSalePaymentMethod: (id: string, method: PaymentMethod) => void;
    onUpdateInstallmentPaymentMethod: (id: string, method: PaymentMethod) => void;
    setView: (v: ViewState) => void;
    onSelectAuditSeller?: (sellerId: string) => void;
}

type DateFilterType = 'today' | 'week' | 'month' | 'custom' | 'all';

const ClosingApprovalView: React.FC<ClosingApprovalViewProps> = ({
    dailyClosings,
    sales,
    team,
    installments,
    deliveries,
    onApproveClosing,
    onRejectClosing,
    onUpdateSalePaymentMethod,
    onUpdateInstallmentPaymentMethod,
    setView,
    onSelectAuditSeller,
}) => {
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'not_sent' | 'all'>('pending');
    const [dateFilterType, setDateFilterType] = useState<DateFilterType>('today');
    const [customDate, setCustomDate] = useState<{ start: string, end: string }>({
        start: new Date().toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10)
    });

    const [selectedClosing, setSelectedClosing] = useState<DailyClosing | null>(null);
    const [viewingItemsClosing, setViewingItemsClosing] = useState<DailyClosing | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [sellerSearch, setSellerSearch] = useState('');

    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sellerMatches = (name: string) => !sellerSearch || normalize(name).includes(normalize(sellerSearch));

    // --- Date Logic ---
    const getDateRange = () => {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);

        if (dateFilterType === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (dateFilterType === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (dateFilterType === 'month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
        } else if (dateFilterType === 'custom') {
            const s = new Date(customDate.start);
            s.setHours(0, 0, 0, 0);
            // Fix timezone offset issue by adding time component when parsing string
            start.setTime(s.getTime() + s.getTimezoneOffset() * 60000);

            const e = new Date(customDate.end);
            e.setHours(23, 59, 59, 999);
            end.setTime(e.getTime() + e.getTimezoneOffset() * 60000);

            // Re-apply correct time to start/end objects
            start.setFullYear(parseInt(customDate.start.split('-')[0]), parseInt(customDate.start.split('-')[1]) - 1, parseInt(customDate.start.split('-')[2]));
            start.setHours(0, 0, 0, 0);
            end.setFullYear(parseInt(customDate.end.split('-')[0]), parseInt(customDate.end.split('-')[1]) - 1, parseInt(customDate.end.split('-')[2]));
            end.setHours(23, 59, 59, 999);
        } else {
            // All time
            return { start: null, end: null };
        }

        return { start, end };
    };

    const { start: dateStart, end: dateEnd } = getDateRange();

    const isDateInRange = (dateMs: number) => {
        if (dateFilterType === 'all') return true;
        if (!dateStart || !dateEnd) return true;
        return dateMs >= dateStart.getTime() && dateMs <= dateEnd.getTime();
    };

    const formatDateRangeText = () => {
        if (dateFilterType === 'all') return 'Todo o período';
        if (dateFilterType === 'today') return 'Hoje';
        if (!dateStart || !dateEnd) return '';
        return `${dateStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} - ${dateEnd.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`;
    };

    // --- Filter Data & Calculate Metrics ---

    // 1. Filtered Closings (for list & main metrics)
    const filteredClosingsByDate = useMemo(() =>
        dailyClosings.filter(c => isDateInRange(c.closingDate)),
        [dailyClosings, dateFilterType, customDate]);

    const filteredClosingsList = useMemo(() =>
        filteredClosingsByDate
            .filter(c => {
                if (filter === 'all') return true;
                if (filter === 'pending') return c.status === ClosingStatus.PENDING;
                if (filter === 'approved') return c.status === ClosingStatus.APPROVED;
                if (filter === 'rejected') return c.status === ClosingStatus.REJECTED;
                if (filter === 'not_sent') return false;
                return true;
            })
            .sort((a, b) => b.closingDate - a.closingDate),
        [filteredClosingsByDate, filter]);

    // 2. Metrics Calculation (Based on Date Range)
    const totalSold = useMemo(() => sales
        ? sales
            .filter(s => s.status !== OrderStatus.CANCELLED && isDateInRange(s.createdAt) && sellerMatches(s.sellerName || ''))
            .reduce((acc, s) => acc + s.total, 0)
        : 0, [sales, dateFilterType, customDate, sellerSearch]);

    const totalTermSales = useMemo(() => sales
        ? sales
            .filter(s => s.status !== OrderStatus.CANCELLED && s.paymentMethod === PaymentMethod.TERM && isDateInRange(s.createdAt) && sellerMatches(s.sellerName || ''))
            .reduce((acc, s) => acc + s.total, 0)
        : 0, [sales, dateFilterType, customDate, sellerSearch]);

    const totalApproved = useMemo(() => filteredClosingsByDate
        .filter(c => c.status === ClosingStatus.APPROVED && sellerMatches(c.sellerName || ''))
        .reduce((acc, c) => acc + (c.cashAmount || 0) + (c.cardAmount || 0) + (c.pixAmount || 0), 0),
        [filteredClosingsByDate, sellerSearch]);

    const totalPending = useMemo(() => filteredClosingsByDate
        .filter(c => c.status === ClosingStatus.PENDING && sellerMatches(c.sellerName || ''))
        .reduce((acc, c) => acc + (c.cashAmount || 0) + (c.cardAmount || 0) + (c.pixAmount || 0), 0),
        [filteredClosingsByDate, sellerSearch]);

    const totalAccounted = totalApproved + totalPending;

    // IDs of installments already accounted for in ANY closing (regardless of date filter)
    // Once accounted for, they should NEVER reappear as "A Prestar Contas"
    const closedInstIds = useMemo(() => {
        const ids = new Set<string>();
        dailyClosings.forEach(c => {
            (c.installmentIds || []).forEach((id: string) => ids.add(id));
        });
        return ids;
    }, [dailyClosings]);

    const paidInstNotInClosings = useMemo(() => {
        const periodSaleIds = new Set(
            sales
                .filter(s => s.status !== OrderStatus.CANCELLED && isDateInRange(s.createdAt))
                .map(s => s.id)
        );
        return installments
            .filter(i => 
                i.status === 'Pago' &&
                periodSaleIds.has(i.saleId) &&
                !closedInstIds.has(i.id)
            )
            .reduce((acc, i) => acc + (i.amount || 0), 0);
    }, [installments, sales, closedInstIds, dateFilterType, customDate]);

    // unaccounted will be derived from notSentData (sum of per-seller unaccountedBalance)
    // This is more accurate than the top-down formula because closings can include
    // both cash sales AND installment payments, making a simple subtraction unreliable.
    let unaccounted = 0; // Will be set after notSentData is computed
    const pendingCount = dailyClosings.filter(c => c.status === ClosingStatus.PENDING).length; // Global pending count for badge

    // --- "Not Sent" Logic ---
    // Sellers who are ACTIVE but have NO closing in the selected date range
    // AND have sales in that range (optional, but good to filter noise) OR just active.
    // User requested detailed breakdown.

    const notSentData = useMemo(() => {
        // 1. Helper to find who is responsible for a sale
        const getResponsibleSellerId = (s: Sale) => {
            if (s.sellerId) return s.sellerId;
            // If online, check delivery assignment
            const delivery = deliveries.find(d => d.saleId === s.id);
            return delivery?.driverId || null;
        };

        // 2. Map all sales in period to their responsible seller
        const responsibleSellersMap = new Map<string, Sale[]>();
        sales
            .filter(s => s.status !== OrderStatus.CANCELLED && isDateInRange(s.createdAt))
            .forEach(s => {
                const sellerId = getResponsibleSellerId(s);
                if (sellerId) {
                    const existing = responsibleSellersMap.get(sellerId) || [];
                    responsibleSellersMap.set(sellerId, [...existing, s]);
                }
            });

        // 3. Get unique sellers (from sales + active team)
        const teamSellerIds = team.filter(m => m.role === 'vendedor' && m.status === 'ativo').map(m => m.id);
        const allRelevantSellerIds = Array.from(new Set([...responsibleSellersMap.keys(), ...teamSellerIds]));

        return allRelevantSellerIds.map(sellerId => {
            const teamMember = team.find(m => m.id === sellerId);
            const sellerSalesInRange = responsibleSellersMap.get(sellerId) || [];

            // Fallback for name
            const sellerName = teamMember?.name || sellerSalesInRange[0]?.sellerName || 'Vendedor Desconhecido';
            const sellerAvatar = teamMember?.avatar;

            const total = sellerSalesInRange.reduce((acc, s) => acc + s.total, 0);

            // Cash sales NOT in any closing (money in seller's hands)
            // Uses ALL closings, not just date-filtered ones
            const closedSaleIdsAll = new Set<string>();
            dailyClosings.forEach(c => {
                (c.salesIds || []).forEach((id: string) => closedSaleIdsAll.add(id));
            });

            const unclosedCashAmount = sellerSalesInRange
                .filter(s => s.paymentMethod !== PaymentMethod.TERM && !closedSaleIdsAll.has(s.id))
                .reduce((acc, s) => acc + s.total, 0);

            // Paid installments from A Prazo sales NOT in any closing
            const termSaleIds = new Set(sellerSalesInRange.filter(s => s.paymentMethod === PaymentMethod.TERM).map(s => s.id));
            const unclosedPaidInstAmount = (installments || [])
                .filter(i => i.status === 'Pago' && termSaleIds.has(i.saleId) && !closedInstIds.has(i.id))
                .reduce((acc, i) => acc + (i.amount || 0), 0);

            const salesToAccount = unclosedCashAmount + unclosedPaidInstAmount;

            // Installments (Future) — only PENDING installments
            const future = (installments || [])
                .filter(i => i.status === 'Pendente' && termSaleIds.has(i.saleId))
                .reduce((acc, i) => acc + (i.amount || 0), 0);

            // Unaccounted Balance = money in seller's hands not yet in a closing
            const unaccountedBalance = salesToAccount;

            // Overdue (Corrected mapping)
            const overdueAmount = (installments || [])
                .filter(i => {
                    const sale = sales.find(s => s.id === i.saleId);
                    if (!sale) return false;
                    const respId = getResponsibleSellerId(sale);
                    return respId === sellerId && (i.status === 'Atrasado' || (i.status === 'Pendente' && i.dueDate < new Date().getTime()));
                })
                .reduce((acc, i) => acc + i.amount, 0);

            return {
                seller: {
                    id: sellerId,
                    name: sellerName,
                    avatar: sellerAvatar,
                    role: teamMember?.role || 'vendedor',
                    status: teamMember?.status || 'ativo'
                },
                total,
                received: salesToAccount,
                future,
                overdueAmount,
                unaccountedBalance,
                hasClosings: filteredClosingsByDate.some(c => c.sellerId === sellerId)
            };
        }).filter(data => data.unaccountedBalance > 0.1);
    }, [team, filteredClosingsByDate, sales, installments, deliveries, dateFilterType, customDate]);

    // Derive unaccounted from per-seller data (source of truth), filtered by search
    unaccounted = notSentData.filter(d => sellerMatches(d.seller.name)).reduce((acc, d) => acc + d.unaccountedBalance, 0);

    const getStatusConfig = (status: ClosingStatus) => {
        switch (status) {
            case ClosingStatus.PENDING:
                return { color: 'bg-yellow-500', text: 'text-yellow-600', label: 'Pendente' };
            case ClosingStatus.APPROVED:
                return { color: 'bg-success', text: 'text-success', label: 'Aprovado' };
            case ClosingStatus.REJECTED:
                return { color: 'bg-danger', text: 'text-danger', label: 'Rejeitado' };
            default:
                return { color: 'bg-slate-500', text: 'text-slate-500', label: 'Desconhecido' };
        }
    };

    const handleApprove = (id: string) => {
        onApproveClosing(id);
        setSelectedClosing(null);
    };

    const handleReject = (id: string) => {
        if (!rejectReason.trim()) return;
        onRejectClosing(id, rejectReason);
        setSelectedClosing(null);
        setRejectReason('');
    };

    const cyclePaymentMethod = (current: PaymentMethod): PaymentMethod => {
        if (current === PaymentMethod.PIX) return PaymentMethod.CASH;
        if (current === PaymentMethod.CASH) return PaymentMethod.CARD;
        return PaymentMethod.PIX;
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2 shrink-0 bg-white dark:bg-slate-900 z-20">
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h3 className="text-lg font-bold leading-tight">Fechar Caixa</h3>
                        <p className="text-xs text-gray-500 font-medium">
                            {formatDateRangeText()}
                        </p>
                    </div>
                </div>

                {/* Date Filters */}
                <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { id: 'today', label: 'Hoje' },
                        { id: 'week', label: 'Semana' },
                        { id: 'month', label: 'Mês' },
                        { id: 'all', label: 'Tudo' },
                        { id: 'custom', label: 'Personalizado' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setDateFilterType(f.id as DateFilterType)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${dateFilterType === f.id
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Custom Date Inputs */}
                {dateFilterType === 'custom' && (
                    <div className="flex gap-2 mb-2 animate-in slide-in-from-top-2">
                        <input
                            type="date"
                            value={customDate.start}
                            onChange={(e) => setCustomDate(p => ({ ...p, start: e.target.value }))}
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200 dark:border-slate-700"
                        />
                        <input
                            type="date"
                            value={customDate.end}
                            onChange={(e) => setCustomDate(p => ({ ...p, end: e.target.value }))}
                            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs border border-slate-200 dark:border-slate-700"
                        />
                    </div>
                )}
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {/* Search Input */}
                <div className="px-4 mt-2 mb-3">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                        <input
                            type="text"
                            value={sellerSearch}
                            onChange={(e) => setSellerSearch(e.target.value)}
                            placeholder="Buscar vendedor..."
                            className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                        {sellerSearch && (
                            <button
                                onClick={() => setSellerSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Summary Card */}
                <div className="px-4 mt-2 mb-4">
                    <div className="bg-gradient-to-br from-[#0a4da3] to-blue-600 p-4 rounded-[24px] text-white shadow-lg shadow-blue-900/20">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2">
                                <div className="size-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <span className="material-symbols-outlined text-white text-sm">savings</span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Resumo do Período</p>
                                    <p className="text-2xl font-black tracking-tight leading-none mt-0.5">
                                        R$ {totalSold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined opacity-50">calendar_today</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className="bg-black/20 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-[9px] uppercase font-bold opacity-70 mb-0.5">Confirmado</p>
                                <p className="text-sm font-black text-green-300">
                                    R$ {totalApproved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 backdrop-blur-sm">
                                <p className="text-[9px] uppercase font-bold opacity-70 mb-0.5">A Prestar Contas</p>
                                <p className={`text-sm font-black ${unaccounted > 0 ? 'text-red-300' : 'text-white/60'}`}>
                                    R$ {unaccounted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-3 backdrop-blur-sm text-right">
                                <p className="text-[9px] uppercase font-bold opacity-70 mb-0.5">A Receber</p>
                                <p className="text-sm font-black text-blue-300">
                                    R$ {Math.max(0, totalSold - totalApproved - unaccounted).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {totalPending > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center">
                                <p className="text-[10px] uppercase font-bold opacity-80">Aguardando Confirmação</p>
                                <p className="text-lg font-black text-yellow-300">
                                    R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sticky Filter Tabs */}
                <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {[
                            { id: 'not_sent', label: `Não Enviado (${notSentData.filter(d => sellerMatches(d.seller.name)).length})` },
                            { id: 'pending', label: `Pendentes (${filteredClosingsByDate.filter(c => c.status === ClosingStatus.PENDING && sellerMatches(c.sellerName || '')).length})` },
                            { id: 'approved', label: 'Aprovados' },
                            { id: 'rejected', label: 'Rejeitados' },
                            { id: 'all', label: 'Todos' },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id as typeof filter)}
                                className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all shadow-sm ${filter === f.id
                                    ? 'bg-primary text-white shadow-primary/20'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>



                {/* Closings List */}
                <div className="px-4 pb-32 space-y-3">
                    {filter === 'not_sent' ? (
                        notSentData.filter(d => sellerMatches(d.seller.name)).length === 0 ? (
                            <div className="text-center py-10">
                                <span className="material-symbols-outlined text-4xl text-green-300 mb-2">check_circle</span>
                                <p className="text-slate-500">Todos os vendedores enviaram o fechamento no período!</p>
                            </div>
                        ) : (
                            notSentData.filter(d => sellerMatches(d.seller.name)).map(data => (
                                <div key={data.seller.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 p-4 border-l-4 border-l-red-400 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                {data.seller.avatar ? (
                                                    <img src={data.seller.avatar} alt={data.seller.name} className="w-full h-full rounded-full object-cover" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-slate-400">person_off</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-slate-200">{data.seller.name}</p>
                                                    <p className="text-xs text-red-500 font-bold uppercase tracking-wide">Fechamento Pendente</p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (onSelectAuditSeller) {
                                                            onSelectAuditSeller(data.seller.id);
                                                            setView('seller-audit');
                                                        }
                                                    }}
                                                    className="size-8 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors ml-2"
                                                    title="Ver Extrato"
                                                >
                                                    <span className="material-symbols-outlined text-lg">receipt_long</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Total Vendido</p>
                                            <p className="text-lg font-black text-slate-800 dark:text-white">
                                                R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Financial Breakdown */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800">
                                            <p className="text-[9px] text-green-600 dark:text-green-400 uppercase font-black mb-0.5">Recebido</p>
                                            <p className="font-bold text-sm text-green-700 dark:text-green-300">
                                                R$ {data.received.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
                                            <p className="text-[9px] text-blue-600 dark:text-blue-400 uppercase font-black mb-0.5">A Receber</p>
                                            <p className="font-bold text-sm text-blue-700 dark:text-blue-300">
                                                R$ {data.future.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                        <div className={`p-2 rounded-lg border ${data.overdueAmount > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                                            <p className={`text-[9px] uppercase font-black mb-0.5 ${data.overdueAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>Em Atraso</p>
                                            <p className={`font-bold text-sm ${data.overdueAmount > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-400'}`}>
                                                R$ {data.overdueAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        filteredClosingsList.filter(c => sellerMatches(c.sellerName || '')).length === 0 ? (
                            <div className="text-center py-10">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">receipt_long</span>
                                <p className="text-slate-500">Nenhum fechamento encontrado no período</p>
                            </div>
                        ) : (
                            filteredClosingsList.filter(c => sellerMatches(c.sellerName || '')).map((closing) => {
                                const statusConfig = getStatusConfig(closing.status);
                                const total = closing.pixAmount + closing.cardAmount + closing.installmentAmount + closing.cashAmount;

                                return (
                                    <div
                                        key={closing.id}
                                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm"
                                    >
                                        <div className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-slate-800 dark:text-white">{closing.sellerName}</p>
                                                        <button
                                                            onClick={() => {
                                                                if (onSelectAuditSeller) {
                                                                    onSelectAuditSeller(closing.sellerId);
                                                                    setView('seller-audit');
                                                                }
                                                            }}
                                                            className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
                                                            title="Ver Extrato"
                                                        >
                                                            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[10px]">calendar_today</span>
                                                        {new Date(closing.closingDate).toLocaleDateString('pt-BR', {
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                        })}
                                                    </p>
                                                </div>
                                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase text-white ${statusConfig.color}`}>
                                                    {statusConfig.label}
                                                </span>
                                            </div>

                                            {/* Breakdown */}
                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">DINHEIRO / OUTROS</p>
                                                    <p className="font-black text-sm">R$ {(closing.cashAmount || 0).toFixed(2)}</p>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">PIX</p>
                                                    <p className="font-black text-sm">R$ {closing.pixAmount.toFixed(2)}</p>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Cartão</p>
                                                    <p className="font-black text-sm">R$ {closing.cardAmount.toFixed(2)}</p>
                                                </div>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
                                                    <p className="text-[10px] text-blue-400 uppercase font-bold">Parcelado</p>
                                                    <p className="font-black text-sm text-blue-600 dark:text-blue-400">R$ {closing.installmentAmount.toFixed(2)}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-3">
                                                <span className="text-xs text-slate-500 font-bold">
                                                    {(closing.salesIds?.length || 0) + (closing.installmentIds?.length || 0)} itens de caixa
                                                </span>
                                                <p className="text-xl font-black text-primary">R$ {total.toFixed(2)}</p>
                                            </div>

                                            {closing.notes && (
                                                <div className="mt-2 text-xs text-slate-500 italic bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-100 dark:border-amber-800">
                                                    "{closing.notes}"
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        {closing.status === ClosingStatus.PENDING && (
                                            <div className="flex border-t border-slate-100 dark:border-slate-700">
                                                <button
                                                    onClick={() => setViewingItemsClosing(closing)}
                                                    className="flex-1 py-3 text-primary font-medium text-sm flex items-center justify-center gap-1 border-r border-slate-100 dark:border-slate-700 hover:bg-primary/5 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">list_alt</span>
                                                    Ver Detalhes
                                                </button>
                                                <button
                                                    onClick={() => setSelectedClosing(closing)}
                                                    className="flex-1 py-3 text-danger font-medium text-sm flex items-center justify-center gap-1 border-r border-slate-100 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">close</span>
                                                    Rejeitar
                                                </button>
                                                <button
                                                    onClick={() => handleApprove(closing.id)}
                                                    className="flex-1 py-3 text-success font-medium text-sm flex items-center justify-center gap-1 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">check</span>
                                                    Aprovar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )
                    )}
                </div>
            </div>

            {/* Reject Modal */}
            {selectedClosing && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Motivo da Rejeição</h3>
                            <button onClick={() => setSelectedClosing(null)} className="text-slate-400 hover:text-slate-600">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent resize-none outline-none"
                            placeholder="Descreva o motivo da rejeição..."
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setSelectedClosing(null);
                                    setRejectReason('');
                                }}
                                className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleReject(selectedClosing.id)}
                                disabled={!rejectReason.trim()}
                                className={`flex-1 py-3 rounded-xl font-bold transition-colors shadow-lg ${rejectReason.trim()
                                    ? 'bg-danger text-white hover:bg-red-600 shadow-red-500/20'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                            >
                                Confirmar Rejeição
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Items Modal */}
            {viewingItemsClosing && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold">Detalhes do Caixa</h3>
                                <p className="text-xs text-slate-500 font-medium">Vendedor: {viewingItemsClosing.sellerName}</p>
                            </div>
                            <button onClick={() => setViewingItemsClosing(null)} className="size-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Sales */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Vendas do Período</h4>
                                {viewingItemsClosing.salesIds?.filter(id => {
                                    const sale = sales.find(s => s.id === id);
                                    return sale && sale.paymentMethod !== PaymentMethod.TERM;
                                }).map(id => {
                                    const sale = sales.find(s => s.id === id);
                                    if (!sale) return null;
                                    return (
                                        <div key={id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-bold truncate max-w-[200px]">{sale.customerName}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <button 
                                                        onClick={() => onUpdateSalePaymentMethod(sale.id, cyclePaymentMethod(sale.paymentMethod))}
                                                        className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-black uppercase flex items-center gap-1 hover:bg-primary/20 transition-colors"
                                                    >
                                                        {sale.paymentMethod}
                                                        <span className="material-symbols-outlined text-[10px]">sync</span>
                                                    </button>
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        {new Date(sale.createdAt).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="font-black text-sm text-slate-700 dark:text-slate-300">
                                                R$ {sale.total.toFixed(2)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Installments */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Parcelas Recebidas</h4>
                                {viewingItemsClosing.installmentIds?.map(id => {
                                    const inst = installments.find(i => i.id === id);
                                    if (!inst) return null;
                                    const sale = sales.find(s => s.id === inst.saleId);
                                    return (
                                        <div key={id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex justify-between items-center border-l-4 border-l-success">
                                            <div>
                                                <p className="text-sm font-bold truncate max-w-[200px]">{sale?.customerName || 'Cliente'}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <button 
                                                        onClick={() => onUpdateInstallmentPaymentMethod(inst.id, cyclePaymentMethod((inst.paymentMethod || PaymentMethod.ON_DELIVERY) as PaymentMethod))}
                                                        className="px-2 py-0.5 rounded bg-success/10 text-success text-[9px] font-black uppercase flex items-center gap-1 hover:bg-success/20 transition-colors"
                                                    >
                                                        {inst.paymentMethod || 'Dinheiro'}
                                                        <span className="material-symbols-outlined text-[10px]">sync</span>
                                                    </button>
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        Recebido em {inst.paidAt ? new Date(inst.paidAt).toLocaleDateString('pt-BR') : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="font-black text-sm text-success">
                                                R$ {inst.amount.toFixed(2)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex gap-3">
                            <button
                                onClick={() => handleApprove(viewingItemsClosing.id)}
                                className="flex-1 py-3.5 bg-success text-white rounded-2xl font-black text-sm shadow-lg shadow-success/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">check</span>
                                Aprovar Caixa Agora
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClosingApprovalView;
