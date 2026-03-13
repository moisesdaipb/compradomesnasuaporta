import React, { useMemo } from 'react';
// Date utilities to avoid external dependency issues
const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

import {
    Sale,
    Installment,
    BasketModel,
    StockItem,
    TeamMember,
    LoginLog,
    OrderStatus,
    InstallmentStatus,
    SaleGoal,
    AppSettings,
    Delivery,
    PaymentMethod,
    DeliveryStatus,
    Customer
} from '../types';

interface FilterState {
    dateRange: 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';
    startDate?: string;
    endDate?: string;
    sellerId: string;
    basketModelId: string;
    paymentMethod: string;
    channel: 'all' | 'online' | 'presencial';
    driverId: string;
    deliveryStatus: string;
    customerRecurrence: 'all' | '1-purchase' | '2-purchases' | '3-more';
    pendingDeliveriesOnly: boolean;
    overdueInstallmentsOnly: 'all' | 'yes' | 'no';
    installmentFilter: 'all' | 'yes' | 'no';
}

interface AnalyticsViewProps {
    sales: Sale[];
    installments: Installment[];
    deliveries: Delivery[];
    baskets: BasketModel[];
    stock: StockItem[];
    team: TeamMember[];
    goals: SaleGoal[];
    settings: AppSettings;
    loginLogs: LoginLog[];
    customers: Customer[];
    setView: (v: any) => void;
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({
    sales,
    installments,
    deliveries,
    baskets,
    stock,
    team,
    goals,
    settings,
    loginLogs,
    customers,
    setView
}) => {
    // --- State ---
    const [filters, setFilters] = React.useState<FilterState>({
        dateRange: 'custom',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        sellerId: 'all',
        basketModelId: 'all',
        paymentMethod: 'all',
        channel: 'all',
        driverId: 'all',
        deliveryStatus: 'all',
        customerRecurrence: 'all',
        pendingDeliveriesOnly: false,
        overdueInstallmentsOnly: 'all',
        installmentFilter: 'all'
    });

    const [isFilterVisible, setIsFilterVisible] = React.useState(false);
    const [geoDrilldown, setGeoDrilldown] = React.useState<{ level: 'city' | 'neighborhood', selectedCity: string | null }>({
        level: 'city',
        selectedCity: null
    });

    // --- Filtering Logic ---
    const filteredSales = useMemo(() => {
        return sales.filter(sale => {
            // Date Filter
            if (filters.dateRange !== 'all' && filters.startDate && filters.endDate) {
                const startTs = new Date(filters.startDate + 'T00:00:00').getTime();
                const endTs = new Date(filters.endDate + 'T23:59:59').getTime();
                if (sale.createdAt < startTs || sale.createdAt > endTs) return false;
            }

            // Other Filters
            if (filters.sellerId !== 'all' && sale.sellerId !== filters.sellerId) return false;
            if (filters.basketModelId !== 'all' && !sale.items.some(i => i.basketModelId === filters.basketModelId)) return false;
            if (filters.paymentMethod !== 'all' && sale.paymentMethod !== filters.paymentMethod) return false;
            if (filters.channel !== 'all' && sale.channel !== filters.channel) return false;
            
            // Recurrence (Granular)
            if (filters.customerRecurrence !== 'all') {
                const customerSalesCount = sales.filter(s => s.customerId === sale.customerId).length;
                if (filters.customerRecurrence === '1-purchase' && customerSalesCount !== 1) return false;
                if (filters.customerRecurrence === '2-purchases' && customerSalesCount !== 2) return false;
                if (filters.customerRecurrence === '3-more' && customerSalesCount < 3) return false;
            }

            // Toggles
            if (filters.pendingDeliveriesOnly) {
                if (sale.status === OrderStatus.DELIVERED || sale.status === OrderStatus.CANCELLED) return false;
            }

            if (filters.overdueInstallmentsOnly !== 'all') {
                const saleInstallments = installments.filter(i => i.saleId === sale.id);
                const hasOverdue = saleInstallments.some(i => i.status === InstallmentStatus.PENDING && i.dueDate < Date.now());
                if (filters.overdueInstallmentsOnly === 'yes' && !hasOverdue) return false;
                if (filters.overdueInstallmentsOnly === 'no' && hasOverdue) return false;
            }

            if (filters.installmentFilter !== 'all') {
                const isInstallment = sale.paymentMethod === PaymentMethod.TERM || (sale.installmentsCount || 0) > 0;
                if (filters.installmentFilter === 'yes' && !isInstallment) return false;
                if (filters.installmentFilter === 'no' && isInstallment) return false;
            }

            // Logistics filters
            if (filters.driverId !== 'all' || filters.deliveryStatus !== 'all') {
                const del = deliveries.find(d => d.saleId === sale.id);
                if (!del) return false;
                if (filters.driverId !== 'all' && del.driverId !== filters.driverId) return false;
                if (filters.deliveryStatus !== 'all' && del.status !== filters.deliveryStatus) return false;
            }

            return true;
        });
    }, [sales, filters, deliveries, installments]);

    const filteredInstallments = useMemo(() => {
        return installments.filter(inst => filteredSales.some(s => s.id === inst.saleId));
    }, [installments, filteredSales]);

    // --- Data Processing ---
    const stats = useMemo(() => {
        const activeSales = filteredSales.filter(s => s.status !== OrderStatus.CANCELLED);

        // Faturamento Total
        const totalRevenue = activeSales.reduce((acc, s) => acc + s.total, 0);

        // Online vs Presencial
        const onlineSales = activeSales.filter(s => s.channel === 'online').reduce((acc, s) => acc + s.total, 0);
        const presencialSales = activeSales.filter(s => s.channel === 'presencial').reduce((acc, s) => acc + s.total, 0);

        // Contas a Receber & Atrasos
        const pendingInstallments = filteredInstallments.filter(i => i.status === InstallmentStatus.PENDING);
        const outstanding = pendingInstallments.reduce((acc, i) => acc + i.amount, 0);
        const overdue = pendingInstallments
            .filter(i => i.dueDate < Date.now())
            .reduce((acc, i) => acc + i.amount, 0);

        // Distribuição Financeira
        // O valor recebido inclui vendas à vista (não a prazo) e parcelas já pagas
        const cashSalesRevenue = activeSales
            .filter(s => s.paymentMethod !== PaymentMethod.TERM)
            .reduce((acc, s) => acc + s.total, 0);
            
        const paidAmount = cashSalesRevenue + filteredInstallments
            .filter(i => i.status === InstallmentStatus.PAID)
            .reduce((acc, i) => acc + i.amount, 0);
            
        const overdueAmount = overdue;
        const pendingFutureAmount = outstanding - overdue;

        // Ranking de Vendedores
        const sellerRevenue: Record<string, number> = {};
        activeSales.forEach(s => {
            sellerRevenue[s.sellerId] = (sellerRevenue[s.sellerId] || 0) + s.total;
        });
        const sellerStats = Object.entries(sellerRevenue)
            .map(([id, total]) => ({
                id,
                name: team.find(t => t.id === id)?.name || 'Desconhecido',
                total
            }))
            .sort((a, b) => b.total - a.total);

        // Top Clientes
        const customerRevenue: Record<string, number> = {};
        activeSales.forEach(s => {
            customerRevenue[s.customerId] = (customerRevenue[s.customerId] || 0) + s.total;
        });
        const topCustomers = Object.entries(customerRevenue)
            .map(([id, total]) => ({
                id,
                name: customers.find(c => c.id === id)?.name || 'Cliente Mistério',
                total,
                salesCount: activeSales.filter(s => s.customerId === id).length
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // Metas
        const generalGoal = goals.find(g => g.type === 'geral' && g.period === 'mensal' && !g.isCancelled);
        const goalValue = generalGoal?.amount || 50000;
        const goalPct = Math.min((totalRevenue / goalValue) * 100, 100);

        // Estoque
        const lowStockThreshold = 10;
        const items = Array.isArray(stock) ? stock : [];
        const lowStockCount = items.filter(s => Number(s.quantity || 0) <= lowStockThreshold).length;
        const criticalStockCount = items.filter(s => Number(s.quantity || 0) <= 5).length;

        // Inteligência Geográfica
        const cityMap: Record<string, { count: number; total: number; neighborhoods: Record<string, { count: number; total: number }> }> = {};
        activeSales.forEach(s => {
            const customer = customers.find(c => c.id === s.customerId);
            let neighborhood = customer?.neighborhood || 'Não Informado';
            let city = customer?.city || 'Não Informada';
            
            if (!cityMap[city]) { cityMap[city] = { count: 0, total: 0, neighborhoods: {} }; }
            cityMap[city].count++; cityMap[city].total += s.total;
            if (!cityMap[city].neighborhoods[neighborhood]) { cityMap[city].neighborhoods[neighborhood] = { count: 0, total: 0 }; }
            cityMap[city].neighborhoods[neighborhood].count++; cityMap[city].neighborhoods[neighborhood].total += s.total;
        });

        const cityStats = Object.entries(cityMap)
            .map(([name, data]) => ({ 
                name, 
                ...data,
                neighborhoods: Object.entries(data.neighborhoods)
                    .map(([nName, nData]) => ({ name: nName, ...nData }))
                    .sort((a, b) => b.total - a.total)
            }))
            .sort((a, b) => b.total - a.total);

        return {
            totalRevenue, onlineSales, presencialSales, outstanding, overdue,
            paidAmount, overdueAmount, pendingFutureAmount, goalValue, goalPct,
            lowStockCount, criticalStockCount, cityStats, sellerStats, topCustomers
        };
    }, [filteredSales, filteredInstallments, goals, stock, team, customers]);

    const latestSales = useMemo(() => {
        return [...filteredSales].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
    }, [filteredSales]);

    const latestLogins = useMemo(() => {
        return [...loginLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    }, [loginLogs]);

    const dailyMonthTrend = useMemo(() => {
        const d = new Date(filters.startDate + 'T00:00:00');
        const month = d.getMonth();
        const year = d.getFullYear();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        return Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const daySales = filteredSales.filter(s => {
                const sd = new Date(s.createdAt);
                return sd.getDate() === dayNum && sd.getMonth() === month && sd.getFullYear() === year && s.status !== OrderStatus.CANCELLED;
            });
            return { label: dayNum.toString(), value: daySales.reduce((acc, s) => acc + s.total, 0) };
        });
    }, [filteredSales, filters.startDate]);

    const maxTrend = Math.max(...dailyMonthTrend.map(d => d.value), 1000);

    return (
        <div className="min-h-screen bg-[#94A3B8] dark:bg-[#020617] px-4 md:px-8 py-8 pb-24 no-scrollbar overflow-x-hidden selection:bg-primary/20">
            <div className="max-w-[1400px] mx-auto space-y-8">
                
                {/* --- PREMIUM HEADER --- */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setView('dashboard')} className="size-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-105 active:scale-95 transition-all text-slate-400 group">
                            <span className="material-symbols-outlined text-2xl group-hover:text-primary transition-colors">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 leading-none">
                                Business Intelligence <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded-lg uppercase tracking-widest ml-2">v2 PRO</span>
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Dashboard de Gestão Estratégica</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsFilterVisible(!isFilterVisible)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${isFilterVisible ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}
                        >
                            <span className="material-symbols-outlined text-lg">tune</span>
                            {isFilterVisible ? 'Ocultar Filtros' : 'Filtrar Dados'}
                        </button>
                    </div>
                </header>

                {/* --- QUICK STATS SECTION --- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Faturamento */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.07] scale-[2.5] group-hover:scale-[3] transition-transform duration-700 pointer-events-none">
                            <span className="material-symbols-outlined text-primary text-9xl">payments</span>
                        </div>
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-4">
                                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">account_balance_wallet</span>
                                </div>
                                <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-lg uppercase tracking-widest">Live</span>
                            </div>
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Faturamento Bruto</p>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">R$ {stats.totalRevenue.toLocaleString()}</h2>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 relative group hover:scale-[1.02] transition-all duration-300">
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="size-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                </div>
                                <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${stats.goalPct >= 80 ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                                    {stats.goalPct.toFixed(0)}%
                                </span>
                            </div>
                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Progresso da Meta</p>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">R$ {stats.totalRevenue.toLocaleString()}</h2>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-secondary rounded-full shadow-[0_0_10px_rgba(var(--secondary-rgb),0.5)] transition-all duration-1000" style={{ width: `${stats.goalPct}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Recebíveis */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 hover:scale-[1.02] transition-all duration-300 group">
                        <div className="flex items-center justify-between mb-4">
                            <div className="size-10 bg-danger/10 rounded-xl flex items-center justify-center text-danger">
                                <span className="material-symbols-outlined">receipt_long</span>
                            </div>
                        </div>
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Contas a Receber</p>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">R$ {stats.outstanding.toLocaleString()}</h2>
                        {stats.overdue > 0 && (
                            <p className="text-[10px] font-bold text-danger flex items-center gap-1">
                                <span className="size-1 bg-danger rounded-full animate-ping" />
                                R$ {stats.overdue.toLocaleString()} em atraso
                            </p>
                        )}
                    </div>

                    {/* Canais */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 hover:scale-[1.02] transition-all duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <div className="size-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500">
                                <span className="material-symbols-outlined">hub</span>
                            </div>
                        </div>
                        <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Distribuição por Canal</p>
                        <div className="flex items-center justify-between gap-4 mt-2">
                            <div className="flex-1">
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Online</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white">R$ {stats.onlineSales.toLocaleString()}</p>
                            </div>
                            <div className="w-[1px] h-8 bg-slate-100 dark:bg-slate-700" />
                            <div className="flex-1 text-right">
                                <p className="text-[8px] font-bold text-slate-400 uppercase">Presencial</p>
                                <p className="text-sm font-black text-slate-900 dark:text-white">R$ {stats.presencialSales.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- FILTERS PANEL --- */}
                {isFilterVisible && (
                    <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-2xl animate-in slide-in-from-top-4 duration-500 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Período</label>
                                <select 
                                    value={filters.dateRange} 
                                    onChange={(e) => {
                                        const dr = e.target.value as any;
                                        const now = new Date();
                                        let start = filters.startDate;
                                        let end = filters.endDate;

                                        if (dr === 'today') {
                                            start = formatDate(now);
                                            end = formatDate(now);
                                        } else if (dr === 'week') {
                                            const weekAgo = new Date();
                                            weekAgo.setDate(now.getDate() - 7);
                                            start = formatDate(weekAgo);
                                            end = formatDate(now);
                                        } else if (dr === 'month') {
                                            start = formatDate(startOfMonth(now));
                                            end = formatDate(endOfMonth(now));
                                        } else if (dr === 'year') {
                                            start = formatDate(new Date(now.getFullYear(), 0, 1));
                                            end = formatDate(new Date(now.getFullYear(), 11, 31));
                                        }

                                        setFilters(p => ({ ...p, dateRange: dr, startDate: start, endDate: end }));
                                    }} 
                                    className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm font-bold shadow-inner"
                                >
                                    <option value="today">Hoje</option><option value="week">Últimos 7 Dias</option><option value="month">Mês Atual</option><option value="year">Ano Atual</option><option value="custom">Personalizado</option><option value="all">Todo Histórico</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Vendedor</label>
                                <select value={filters.sellerId} onChange={(e) => setFilters(p => ({ ...p, sellerId: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm font-bold shadow-inner text-slate-600 dark:text-slate-300">
                                    <option value="all">Todos</option>
                                    {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Canal de Venda</label>
                                <select value={filters.channel} onChange={(e) => setFilters(p => ({ ...p, channel: e.target.value as any }))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm font-bold shadow-inner text-slate-600 dark:text-slate-300">
                                    <option value="all">Todos</option>
                                    <option value="online">Online</option>
                                    <option value="presencial">Presencial</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Em Atraso</label>
                                <select value={filters.overdueInstallmentsOnly} onChange={(e) => setFilters(p => ({ ...p, overdueInstallmentsOnly: e.target.value as any }))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm font-bold shadow-inner text-slate-600 dark:text-slate-300">
                                    <option value="all">Sim ou Não</option>
                                    <option value="yes">Sim</option>
                                    <option value="no">Não</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Parcelado</label>
                                <select value={filters.installmentFilter} onChange={(e) => setFilters(p => ({ ...p, installmentFilter: e.target.value as any }))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl px-5 py-4 text-sm font-bold shadow-inner text-slate-600 dark:text-slate-300">
                                    <option value="all">Sim ou Não</option>
                                    <option value="yes">Sim</option>
                                    <option value="no">Não</option>
                                </select>
                            </div>
                            {filters.dateRange === 'custom' && (
                                <div className="col-span-1 lg:col-span-2 grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Início</label><input type="date" value={filters.startDate} onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-xs font-bold" /></div>
                                    <div className="space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fim</label><input type="date" value={filters.endDate} onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-xs font-bold" /></div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                            <button 
                                onClick={() => setFilters({
                                    dateRange: 'custom',
                                    startDate: '2026-03-01',
                                    endDate: '2026-03-31',
                                    sellerId: 'all',
                                    basketModelId: 'all',
                                    paymentMethod: 'all',
                                    channel: 'all',
                                    driverId: 'all',
                                    deliveryStatus: 'all',
                                    customerRecurrence: 'all',
                                    pendingDeliveriesOnly: false,
                                    overdueInstallmentsOnly: 'all',
                                    installmentFilter: 'all'
                                })}
                                className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-danger/10 hover:text-danger text-slate-600 dark:text-slate-300 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                            >
                                <span className="material-symbols-outlined text-lg">filter_alt_off</span>
                                Limpar Todos os Filtros
                            </button>
                        </div>
                    </div>
                )}

                {/* --- MAIN INSIGHTS GRID --- */}
                <div className="grid grid-cols-12 gap-8">
                    {/* DAILY TREND */}
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 flex flex-col min-h-[450px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                                        <span className="material-symbols-outlined text-primary">analytics</span> Tendência de Venda Diária
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest pl-8">Volume processado dia a dia</p>
                                </div>

                                <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <select 
                                        value={new Date(filters.startDate + 'T00:00:00').getMonth()}
                                        onChange={(e) => {
                                            const m = parseInt(e.target.value);
                                            const d = new Date(filters.startDate + 'T00:00:00');
                                            const newStart = startOfMonth(new Date(d.getFullYear(), m, 1));
                                            const newEnd = endOfMonth(newStart);
                                            setFilters(prev => ({
                                                ...prev,
                                                startDate: formatDate(newStart),
                                                endDate: formatDate(newEnd),
                                                dateRange: 'custom'
                                            }));
                                        }}
                                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest px-3 py-2 outline-none cursor-pointer text-slate-600 dark:text-slate-300"
                                    >
                                        {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                                            <option key={i} value={i}>{m}</option>
                                        ))}
                                    </select>
                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                                    <select 
                                        value={new Date(filters.startDate + 'T00:00:00').getFullYear()}
                                        onChange={(e) => {
                                            const y = parseInt(e.target.value);
                                            const d = new Date(filters.startDate + 'T00:00:00');
                                            const newStart = startOfMonth(new Date(y, d.getMonth(), 1));
                                            const newEnd = endOfMonth(newStart);
                                            setFilters(prev => ({
                                                ...prev,
                                                startDate: formatDate(newStart),
                                                endDate: formatDate(newEnd),
                                                dateRange: 'custom'
                                            }));
                                        }}
                                        className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest px-3 py-2 outline-none cursor-pointer text-slate-600 dark:text-slate-300"
                                    >
                                        {[2024, 2025, 2026, 2027].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 flex gap-4 pr-4">
                                {/* Y-AXIS LABELS */}
                                <div className="flex flex-col justify-between pt-4 pb-14 text-[9px] font-black text-slate-400 text-right w-12 tracking-tighter uppercase">
                                    <span>R${(maxTrend).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    <span>R${(maxTrend * 0.75).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    <span>R${(maxTrend * 0.5).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    <span>R${(maxTrend * 0.25).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    <span>R$0</span>
                                </div>

                                <div className="flex-1 relative pt-4 pb-8">
                                    {/* GRID LINES */}
                                    <div className="absolute inset-x-0 top-4 bottom-8 border-l-2 border-b-2 border-slate-200 dark:border-slate-700 z-0" />
                                    <div className="absolute inset-x-0 top-4 h-px bg-slate-100 dark:bg-slate-700/30 z-0" />
                                    <div className="absolute inset-x-0 top-1/4 h-px bg-slate-100 dark:bg-slate-700/30 z-0" />
                                    <div className="absolute inset-x-0 top-1/2 h-px bg-slate-100 dark:bg-slate-700/30 z-0" />
                                    <div className="absolute inset-x-0 top-3/4 h-px bg-slate-100 dark:bg-slate-700/30 z-0" />

                                    {/* COLUMNS */}
                                    <div className="flex items-end gap-[2px] h-full relative z-10 px-1" style={{ paddingBottom: '32px', paddingTop: '0' }}>
                                        {dailyMonthTrend.map((m, i) => {
                                            const heightPct = maxTrend > 0 ? Math.max(m.value > 0 ? 2 : 0, (m.value / maxTrend) * 100) : 0;
                                            const formatVal = (v: number) => {
                                                if (v === 0) return '';
                                                if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')}k`;
                                                return v.toFixed(0);
                                            };
                                            return (
                                                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group/bar relative">
                                                    {/* Value label */}
                                                    {m.value > 0 && (
                                                        <span className="text-[7px] font-black text-primary mb-0.5 opacity-80 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap">
                                                            {formatVal(m.value)}
                                                        </span>
                                                    )}
                                                    {/* Tooltip on hover */}
                                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-all duration-200 z-30 bg-slate-900 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                                                        Dia {m.label}: R$ {m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </div>
                                                    {/* Bar */}
                                                    <div
                                                        className={`w-full rounded-t-sm transition-all duration-700 ease-out cursor-pointer ${
                                                            m.value > 0
                                                                ? 'bg-gradient-to-t from-primary to-blue-400 group-hover/bar:from-primary group-hover/bar:to-blue-300 shadow-sm shadow-primary/20'
                                                                : 'bg-slate-100 dark:bg-slate-700/30'
                                                        }`}
                                                        style={{ height: `${heightPct}%`, minHeight: m.value > 0 ? '4px' : '1px' }}
                                                    />
                                                    {/* Day label */}
                                                    <div className="absolute bottom-0 w-full text-center translate-y-6">
                                                        <span className={`text-[8px] font-black transition-colors ${m.value > 0 ? 'text-slate-500 group-hover/bar:text-primary' : 'text-slate-300 dark:text-slate-600'}`}>
                                                            {m.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* GEO INTELLIGENCE */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 min-h-[400px]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                                        <span className="material-symbols-outlined text-indigo-500">location_on</span> Presença Geográfica ({geoDrilldown.level === 'city' ? 'Cidades' : geoDrilldown.selectedCity})
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest pl-8">Distribuição por localidade</p>
                                </div>
                                {geoDrilldown.level === 'neighborhood' && <button onClick={() => setGeoDrilldown({ level: 'city', selectedCity: null })} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 hover:bg-primary hover:text-white transition-all">Voltar</button>}
                            </div>
                            <div className="space-y-4">
                                {(geoDrilldown.level === 'city' ? stats.cityStats : stats.cityStats.find(c => c.name === geoDrilldown.selectedCity)?.neighborhoods || []).map((item, i) => (
                                    <div key={i} onClick={() => geoDrilldown.level === 'city' && setGeoDrilldown({ level: 'neighborhood', selectedCity: item.name })} className="group cursor-pointer">
                                        <div className="flex justify-between items-end mb-2 px-1"><span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wide group-hover:text-primary transition-colors">{item.name}</span><div className="flex items-center gap-3"><span className="text-[10px] font-bold text-slate-400">{item.count} Vendas</span><span className="text-xs font-black text-slate-900 dark:text-white">R$ {item.total.toLocaleString()}</span></div></div>
                                        <div className="h-2 w-full bg-slate-50 dark:bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-primary rounded-full group-hover:brightness-110 transition-all duration-1000" style={{ width: `${(item.total / (geoDrilldown.level === 'city' ? stats.totalRevenue : (stats.cityStats.find(c => c.name === geoDrilldown.selectedCity)?.total || 1))) * 100}%` }} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* SIDEBAR */}
                    <div className="col-span-12 lg:col-span-4 space-y-8">
                        {/* RANKING */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-secondary">emoji_events</span> Ranking de Equipe</h3>
                            <div className="space-y-6">
                                {stats.sellerStats.map((s, i) => (
                                    <div key={s.id} className="flex items-center gap-4 group">
                                        <div className={`size-8 rounded-xl flex items-center justify-center text-sm font-black shadow-sm ${i === 0 ? 'bg-secondary text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>{i+1}</div>
                                        <div className="flex-1 min-w-0"><p className="text-[11px] font-black text-slate-900 dark:text-white truncate uppercase">{s.name}</p><p className="text-[10px] font-bold text-slate-400">R$ {s.total.toLocaleString()}</p></div>
                                        <div className="w-16 h-1.5 bg-slate-50 dark:bg-slate-900 rounded-full overflow-hidden"><div className="h-full bg-secondary transition-all duration-1000" style={{ width: `${(s.total / (stats.sellerStats[0].total || 1)) * 100}%` }} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* FINANCEIRO */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500">payments</span> Fluxo de Caixa</h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100 dark:border-emerald-500/10"><p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Recebido</p><p className="text-lg font-black text-slate-900 dark:text-white">R$ {stats.paidAmount.toLocaleString()}</p></div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendente</p><p className="text-lg font-black text-slate-900 dark:text-white">R$ {stats.pendingFutureAmount.toLocaleString()}</p></div>
                                <div className={`p-4 rounded-2xl border ${stats.overdueAmount > 0 ? 'bg-danger/5 border-danger/20' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700'}`}><p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stats.overdueAmount > 0 ? 'text-danger' : 'text-slate-400'}`}>Atrasado</p><p className="text-lg font-black text-slate-900 dark:text-white">R$ {stats.overdueAmount.toLocaleString()}</p></div>
                            </div>
                        </div>

                        {/* ESTOQUE */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-warning">inventory_2</span> Status de Estoque</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl"><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.lowStockCount}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Nível Baixo</p></div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl"><p className="text-2xl font-black text-danger">{stats.criticalStockCount}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Crítico</p></div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* --- DETAILED SALES TABLE --- */}
                <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 overflow-hidden">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
                                <span className="material-symbols-outlined text-primary">list_alt</span> Detalhamento de Vendas
                            </h3>
                            <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest pl-8">Lista completa filtrada</p>
                        </div>
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl text-[10px] font-black uppercase text-slate-400">
                            {filteredSales.length} Registros Encontrados
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Data</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Cliente</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Bairro</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Vendedor</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Valor</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Condição</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">Canal</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {filteredSales.slice(0, 50).map((sale) => {
                                    const customer = customers.find(c => c.id === sale.customerId);
                                    const isInstallment = sale.paymentMethod === PaymentMethod.TERM || (sale.installmentsCount || 0) > 1;
                                    return (
                                        <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group">
                                            <td className="px-8 py-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">{new Date(sale.createdAt).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-8 py-4 text-[11px] font-black text-slate-900 dark:text-white uppercase truncate max-w-[150px]">{sale.customerName}</td>
                                            <td className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase">{customer?.neighborhood || 'N/I'}</td>
                                            <td className="px-8 py-4 text-[10px] font-bold text-slate-500 uppercase truncate max-w-[120px]">{sale.sellerName || '-'}</td>
                                            <td className="px-8 py-4 text-[12px] font-black text-slate-900 dark:text-white">R$ {sale.total.toLocaleString()}</td>
                                            <td className="px-8 py-4">
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${isInstallment ? 'bg-indigo-50 text-indigo-500 border border-indigo-100' : 'bg-emerald-50 text-emerald-500 border border-emerald-100'}`}>
                                                    {isInstallment ? `Parcelado (${sale.installmentsCount}x)` : 'À Vista'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-wider ${sale.channel === 'online' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                                    {sale.channel}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <span className={`inline-flex items-center justify-center min-w-[90px] text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-tighter shadow-sm transition-all ${
                                                    sale.status === OrderStatus.DELIVERED ? 'bg-emerald-500 text-white shadow-emerald-200' :
                                                    sale.status === OrderStatus.CANCELLED || sale.status === OrderStatus.CANCELLATION_REQUESTED ? 'bg-danger text-white shadow-danger-200' :
                                                    sale.status === OrderStatus.IN_DELIVERY || sale.status === OrderStatus.CONFIRMED ? 'bg-primary text-white shadow-primary-200' :
                                                    'bg-amber-400 text-white shadow-amber-200'
                                                }`}>
                                                    {sale.status || 'Pendente'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredSales.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-8 py-20 text-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-200 mb-4">search_off</span>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhuma venda encontrada para os filtros aplicados</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="pt-12" />
            </div>
        </div>
    );
};

export default AnalyticsView;
