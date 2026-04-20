import React, { useMemo } from 'react';
import { DailyClosing, ClosingStatus } from '../types';
const formatDate = (date: Date) => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; };
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

import { Sale, Installment, BasketModel, StockItem, TeamMember, LoginLog, OrderStatus, InstallmentStatus, SaleGoal, AppSettings, Delivery, PaymentMethod, DeliveryStatus, Customer } from '../types';

interface AnalyticsViewProps {
    sales: Sale[]; installments: Installment[]; deliveries: Delivery[]; dailyClosings: DailyClosing[];
    baskets: BasketModel[]; stock: StockItem[]; team: TeamMember[]; goals: SaleGoal[];
    settings: AppSettings; loginLogs: LoginLog[]; customers: Customer[]; setView: (v: any) => void;
}

import { formatCurrency } from '../utils';
const fmt = (v: number) => formatCurrency(v);

// --- MODAL COMPONENT ---
const Modal: React.FC<{ title: string; icon: string; color: string; onClose: () => void; children: React.ReactNode }> = ({ title, icon, color, onClose, children }) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r ${color}`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-white text-xl">{icon}</span>
                    <h3 className="text-base font-black text-white tracking-tight">{title}</h3>
                </div>
                <button onClick={onClose} className="size-8 rounded-xl bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-64px)] no-scrollbar">{children}</div>
        </div>
    </div>
);

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ sales, installments, deliveries, dailyClosings, baskets, stock, team, goals, settings, loginLogs, customers, setView }) => {
    const [activeModal, setActiveModal] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState<'vendas' | 'parcelas'>('vendas');
    const [geoDrill, setGeoDrill] = React.useState<{ level: 'city' | 'neighborhood' | 'client'; city: string | null; neighborhood: string | null }>({ level: 'city', city: null, neighborhood: null });
    const [chartMonth, setChartMonth] = React.useState(new Date().getMonth());
    const [chartYear, setChartYear] = React.useState(new Date().getFullYear());
    const [instDrill, setInstDrill] = React.useState<{ level: 'month' | 'day'; month: number | null; year: number | null }>({ level: 'month', month: null, year: null });
    const [showFilters, setShowFilters] = React.useState(false);
    const [selectedSaleId, setSelectedSaleId] = React.useState<string | null>(null);
    const [instTab, setInstTab] = React.useState<'all' | 'pending' | 'overdue'>('all');
    const [showEmptyDays, setShowEmptyDays] = React.useState(false);
    const [chartViewMode, setChartViewMode] = React.useState<'daily' | 'monthly'>('daily');
    const [datePreset, setDatePreset] = React.useState<'mes' | '60' | '90' | 'tudo' | 'custom'>('tudo');
    const [filters, setFilters] = React.useState<{
        dateFrom: string; dateTo: string; seller: string; channel: string;
        city: string; neighborhood: string; customer: string; payCategory: string; payMethod: string; overdue: string;
    }>({ dateFrom: '', dateTo: '', seller: '', channel: '', city: '', neighborhood: '', customer: '', payCategory: '', payMethod: '', overdue: '' });
    
    // Auto-fill dates based on preset
    React.useEffect(() => {
        const now = new Date();
        const fmtDate = (d: Date) => d.toISOString().split('T')[0];
        
        const updateRange = (from: string, to: string) => {
            setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }));
        };

        if (datePreset === 'mes') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            updateRange(fmtDate(start), fmtDate(now));
        } else if (datePreset === '60') {
            const start = new Date();
            start.setDate(now.getDate() - 60);
            updateRange(fmtDate(start), fmtDate(now));
        } else if (datePreset === '90') {
            const start = new Date();
            start.setDate(now.getDate() - 90);
            updateRange(fmtDate(start), fmtDate(now));
        } else if (datePreset === 'tudo') {
            updateRange('', '');
        }
    }, [datePreset]);

    const clearFilters = () => {
        setDatePreset('tudo');
        setFilters({ dateFrom: '', dateTo: '', seller: '', channel: '', city: '', neighborhood: '', customer: '', payCategory: '', payMethod: '', overdue: '' });
    };
    const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

    // --- CORE DATA (with filters applied) ---
    const activeSales = useMemo(() => {
        return sales.filter(s => s.status !== OrderStatus.CANCELLED).filter(s => {
            if (filters.dateFrom) { const from = new Date(filters.dateFrom + 'T00:00:00').getTime(); if (s.createdAt < from) return false; }
            if (filters.dateTo) { const to = new Date(filters.dateTo + 'T23:59:59').getTime(); if (s.createdAt > to) return false; }
            if (filters.seller && s.sellerId !== filters.seller) return false;
            if (filters.channel && s.channel !== filters.channel) return false;
            if (filters.city) { const c = customers.find(cu => cu.id === s.customerId); if ((c?.city || '') !== filters.city) return false; }
            if (filters.neighborhood) { const c = customers.find(cu => cu.id === s.customerId); if ((c?.neighborhood || '') !== filters.neighborhood) return false; }
            if (filters.customer && s.customerId !== filters.customer) return false;
            if (filters.payCategory === 'avista' && s.paymentMethod === PaymentMethod.TERM) return false;
            if (filters.payCategory === 'prazo' && s.paymentMethod !== PaymentMethod.TERM) return false;
            if (filters.payMethod && s.paymentMethod !== filters.payMethod && (s.paymentSubMethod || '') !== filters.payMethod) return false;
            if (filters.overdue === 'sim') {
                const hasOverdue = installments.some(i => i.saleId === s.id && i.status === InstallmentStatus.PENDING && i.dueDate < Date.now());
                if (!hasOverdue) return false;
            }
            return true;
        });
    }, [sales, filters, customers, installments]);
    const totalRevenue = useMemo(() => activeSales.reduce((a, s) => a + s.total, 0), [activeSales]);
    const onlineRevenue = useMemo(() => activeSales.filter(s => s.channel === 'online').reduce((a, s) => a + s.total, 0), [activeSales]);
    const presencialRevenue = useMemo(() => activeSales.filter(s => s.channel === 'presencial').reduce((a, s) => a + s.total, 0), [activeSales]);
    const corporateRevenue = useMemo(() => activeSales.filter(s => s.channel === 'empresarial').reduce((a, s) => a + s.total, 0), [activeSales]);
    const cashRevenue = useMemo(() => activeSales.filter(s => s.paymentMethod !== PaymentMethod.TERM).reduce((a, s) => a + s.total, 0), [activeSales]);
    const termRevenue = useMemo(() => activeSales.filter(s => s.paymentMethod === PaymentMethod.TERM).reduce((a, s) => a + s.total, 0), [activeSales]);

    // Installments (Only from active/filtered sales)
    const activeSaleIds = useMemo(() => new Set(activeSales.map(s => s.id)), [activeSales]);
    const activeInstallments = useMemo(() => installments.filter(i => activeSaleIds.has(i.saleId)), [installments, activeSaleIds]);

    const pendingInstallments = useMemo(() => activeInstallments.filter(i => i.status === InstallmentStatus.PENDING), [activeInstallments]);
    const pendingInstTotal = useMemo(() => pendingInstallments.reduce((a, i) => a + i.amount, 0), [pendingInstallments]);
    const overdueInstallments = useMemo(() => pendingInstallments.filter(i => i.dueDate < Date.now()), [pendingInstallments]);
    const overdueTotal = useMemo(() => overdueInstallments.reduce((a, i) => a + i.amount, 0), [overdueInstallments]);
    const paidInstTotal = useMemo(() => activeInstallments.filter(i => i.status === InstallmentStatus.PAID).reduce((a, i) => a + i.amount, 0), [activeInstallments]);
    const totalReceived = useMemo(() => cashRevenue + paidInstTotal, [cashRevenue, paidInstTotal]);

    const validClosings = useMemo(() => dailyClosings.filter(c => c.status === ClosingStatus.APPROVED || c.status === ClosingStatus.PENDING), [dailyClosings]);
    const closedSaleIds = useMemo(() => new Set(validClosings.flatMap(c => c.salesIds || [])), [validClosings]);
    const closedInstIds = useMemo(() => new Set(validClosings.flatMap(c => c.installmentIds || [])), [validClosings]);

    const activeClosings = useMemo(() => {
        return dailyClosings.filter(c => {
            if (filters.dateFrom) { const from = new Date(filters.dateFrom + 'T00:00:00').getTime(); if (c.closingDate < from) return false; }
            if (filters.dateTo) { const to = new Date(filters.dateTo + 'T23:59:59').getTime(); if (c.closingDate > to) return false; }
            if (filters.seller && c.sellerId !== filters.seller) return false;
            return true;
        });
    }, [dailyClosings, filters]);

    const closedAmount = useMemo(() => {
        return activeClosings
            .filter(c => c.status === ClosingStatus.APPROVED || c.status === ClosingStatus.PENDING)
            .reduce((a, c) => a + (c.cashAmount || 0) + (c.cardAmount || 0) + (c.pixAmount || 0), 0);
    }, [activeClosings]);

    const unclosedAmount = useMemo(() => {
        const unclosedCashSales = activeSales.filter(s => s.paymentMethod !== PaymentMethod.TERM && !closedSaleIds.has(s.id)).reduce((acc, s) => acc + s.total, 0);
        const unclosedInstallments = activeInstallments.filter(i => i.status === InstallmentStatus.PAID && !closedInstIds.has(i.id)).reduce((acc, i) => acc + i.amount, 0);
        return unclosedCashSales + unclosedInstallments;
    }, [activeSales, activeInstallments, closedSaleIds, closedInstIds]);

    // Payment methods
    const paymentBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        activeSales.forEach(s => { const key = s.paymentMethod === PaymentMethod.TERM ? 'A Prazo' : (s.paymentSubMethod || s.paymentMethod); map[key] = (map[key] || 0) + s.total; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [activeSales]);

    // Seller ranking (presencial only, exclude unknown)
    const sellerRanking = useMemo(() => {
        const map: Record<string, number> = {};
        activeSales.filter(s => s.channel === 'presencial' && s.sellerId).forEach(s => { map[s.sellerId!] = (map[s.sellerId!] || 0) + s.total; });
        return Object.entries(map).map(([id, total]) => ({ id, name: team.find(t => t.id === id)?.name || '', total })).filter(s => s.name).sort((a, b) => b.total - a.total);
    }, [activeSales, team]);

    // Driver ranking
    const driverRanking = useMemo(() => {
        const delivered = deliveries.filter(d => d.status === DeliveryStatus.DELIVERED && d.driverId);
        const map: Record<string, number> = {};
        delivered.forEach(d => { map[d.driverId!] = (map[d.driverId!] || 0) + 1; });
        return Object.entries(map).map(([id, count]) => ({ id, name: team.find(t => t.id === id)?.name || delivered.find(d => d.driverId === id)?.driverName || '', count })).filter(d => d.name).sort((a, b) => b.count - a.count);
    }, [deliveries, team]);

    // Customer ranking
    const customerRanking = useMemo(() => {
        const map: Record<string, { total: number; count: number }> = {};
        activeSales.forEach(s => { if (!map[s.customerId]) map[s.customerId] = { total: 0, count: 0 }; map[s.customerId].total += s.total; map[s.customerId].count++; });
        return Object.entries(map).map(([id, d]) => ({ id, name: customers.find(c => c.id === id)?.name || 'Cliente', ...d })).sort((a, b) => b.total - a.total).slice(0, 10);
    }, [activeSales, customers]);

    // Pending deliveries
    const pendingDeliveries = useMemo(() => deliveries.filter(d => d.status !== DeliveryStatus.DELIVERED && d.status !== DeliveryStatus.CANCELLED), [deliveries]);

    // Stock
    const stockItems = useMemo(() => Array.isArray(stock) ? stock : [], [stock]);
    const lowStock = useMemo(() => stockItems.filter(s => Number(s.quantity || 0) <= 10), [stockItems]);
    const criticalStock = useMemo(() => stockItems.filter(s => Number(s.quantity || 0) <= 5), [stockItems]);

    // Goal
    const goal = useMemo(() => goals.find(g => g.type === 'geral' && g.period === 'mensal' && !g.isCancelled), [goals]);
    const goalPct = useMemo(() => Math.min(((totalRevenue / (goal?.amount || 50000)) * 100), 100), [totalRevenue, goal]);

    // Sales trend (daily or monthly)
    const salesTrend = useMemo(() => {
        if (chartViewMode === 'monthly') {
            const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
            return Array.from({ length: 12 }, (_, i) => {
                const monthSales = activeSales.filter(s => {
                    const d = new Date(s.createdAt);
                    return d.getMonth() === i && d.getFullYear() === chartYear;
                });
                return { label: monthNames[i], value: monthSales.reduce((a, s) => a + s.total, 0) };
            });
        }
        const daysInMonth = new Date(chartYear, chartMonth + 1, 0).getDate();
        return Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const daySales = activeSales.filter(s => { const d = new Date(s.createdAt); return d.getDate() === dayNum && d.getMonth() === chartMonth && d.getFullYear() === chartYear; });
            return { label: dayNum.toString(), value: daySales.reduce((a, s) => a + s.total, 0) };
        });
    }, [activeSales, chartMonth, chartYear, chartViewMode]);
    const maxSalesTrend = Math.max(...salesTrend.map(d => d.value), 100);

    // Installment receivables trend
    const instTrend = useMemo(() => {
        const pending = installments.filter(i => i.status === InstallmentStatus.PENDING);
        if (instDrill.level === 'month') {
            const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
            const map: Record<string, { label: string; month: number; year: number; value: number; sortKey: number }> = {};
            pending.forEach(i => {
                const d = new Date(i.dueDate);
                const m = d.getMonth(); const y = d.getFullYear();
                const key = `${y}-${m}`;
                if (!map[key]) map[key] = { label: `${monthNames[m]}/${String(y).slice(2)}`, month: m, year: y, value: 0, sortKey: y * 100 + m };
                map[key].value += i.amount || 0;
            });
            if (Object.keys(map).length === 0) {
                const now = new Date();
                return [{ label: `${monthNames[now.getMonth()]}/${String(now.getFullYear()).slice(2)}`, month: now.getMonth(), year: now.getFullYear(), value: 0 }];
            }
            return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
        }
        const m = instDrill.month!; const y = instDrill.year!;
        const map: Record<string, { label: string; month: number; year: number; value: number }> = {};
        const startOfMonth = new Date(y, m, 1).getTime();
        const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59).getTime();
        pending.filter(i => i.dueDate >= startOfMonth && i.dueDate <= endOfMonth).forEach(i => {
            const d = new Date(i.dueDate);
            const day = d.getDate();
            if (!map[day]) map[day] = { label: String(day), month: m, year: y, value: 0 };
            map[day].value += i.amount || 0;
        });
        if (Object.keys(map).length === 0) return [{ label: "1", month: m, year: y, value: 0 }];
        return Object.values(map).sort((a, b) => Number(a.label) - Number(b.label));
    }, [installments, instDrill]);
    const maxInstTrend = Math.max(...instTrend.map(d => d.value), 100);

    // Geo data with 3-level drill
    const geoData = useMemo(() => {
        const cityMap: Record<string, { total: number; count: number; neighborhoods: Record<string, { total: number; count: number; clients: Record<string, { name: string; total: number; count: number }> }> }> = {};
        activeSales.forEach(s => {
            const c = customers.find(cu => cu.id === s.customerId);
            const city = c?.city || 'Não Informada';
            const nb = c?.neighborhood || 'Não Informado';
            if (!cityMap[city]) cityMap[city] = { total: 0, count: 0, neighborhoods: {} };
            cityMap[city].total += s.total; cityMap[city].count++;
            if (!cityMap[city].neighborhoods[nb]) cityMap[city].neighborhoods[nb] = { total: 0, count: 0, clients: {} };
            cityMap[city].neighborhoods[nb].total += s.total; cityMap[city].neighborhoods[nb].count++;
            const cid = s.customerId;
            if (!cityMap[city].neighborhoods[nb].clients[cid]) cityMap[city].neighborhoods[nb].clients[cid] = { name: s.customerName, total: 0, count: 0 };
            cityMap[city].neighborhoods[nb].clients[cid].total += s.total; cityMap[city].neighborhoods[nb].clients[cid].count++;
        });
        return Object.entries(cityMap).map(([name, d]) => ({
            name, ...d,
            neighborhoods: Object.entries(d.neighborhoods).map(([n, nd]) => ({
                name: n, ...nd,
                clients: Object.entries(nd.clients).map(([, cd]) => cd).sort((a, b) => b.total - a.total)
            })).sort((a, b) => b.total - a.total)
        })).sort((a, b) => b.total - a.total);
    }, [activeSales, customers]);

    // Installment detail for popup
    const installmentDetails = useMemo(() => {
        return pendingInstallments.map(i => {
            const sale = sales.find(s => s.id === i.saleId);
            return { ...i, sellerName: sale?.sellerName || '-', customerName: i.customerName };
        }).sort((a, b) => a.dueDate - b.dueDate);
    }, [pendingInstallments, sales]);

    // Geo max for chart
    const geoItems = useMemo(() => {
        if (geoDrill.level === 'city') return geoData.map(c => ({ name: c.name, total: c.total, count: c.count }));
        if (geoDrill.level === 'neighborhood') {
            const city = geoData.find(c => c.name === geoDrill.city);
            return city ? city.neighborhoods.map(n => ({ name: n.name, total: n.total, count: n.count })) : [];
        }
        const city = geoData.find(c => c.name === geoDrill.city);
        const nb = city?.neighborhoods.find(n => n.name === geoDrill.neighborhood);
        return nb ? nb.clients.map(cl => ({ name: cl.name, total: cl.total, count: cl.count })) : [];
    }, [geoData, geoDrill]);
    const geoMax = Math.max(...geoItems.map(g => g.total), 1);

    // --- CARD COMPONENT ---
    const KpiCard: React.FC<{ icon: string; label: string; value: string; sub?: string; gradient: string; onClick?: () => void; badge?: string; pct?: string }> = ({ icon, label, value, sub, gradient, onClick, badge, pct }) => (
        <div onClick={onClick} className={`relative p-5 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]' : ''} bg-gradient-to-br ${gradient}`}>
            <div className="absolute top-0 right-0 p-4 opacity-[0.08] scale-[2] pointer-events-none"><span className="material-symbols-outlined text-white text-6xl">{icon}</span></div>
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                    <div className="size-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm"><span className="material-symbols-outlined text-white text-lg">{icon}</span></div>
                    {badge && <span className="text-[9px] font-black text-white/80 bg-white/15 px-2 py-0.5 rounded-lg uppercase tracking-widest backdrop-blur-sm">{badge}</span>}
                </div>
                <div className="mt-auto">
                    <p className="text-[9px] font-black text-white/70 uppercase tracking-[0.15em] mb-0.5">{label}</p>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-xl font-black text-white leading-tight">{value}</h2>
                        {pct && <span className="text-[10px] font-black text-white bg-black/20 px-1.5 py-0.5 rounded shadow-sm opacity-90">{pct}</span>}
                    </div>
                    {sub && <p className="text-[10px] font-medium text-white/60 mt-1">{sub}</p>}
                </div>
            </div>
        </div>
    );

    const ContasKpiCard: React.FC<{ closedAmt: number, unclosedAmt: number, pct: string, onClick?: () => void }> = ({ closedAmt, unclosedAmt, pct, onClick }) => (
        <div onClick={onClick} className={`relative p-5 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ${onClick ? 'cursor-pointer hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]' : ''} bg-gradient-to-br from-[#1d8268] to-[#125c48]`}>
            <div className="absolute top-0 right-0 p-4 opacity-[0.08] scale-[2] pointer-events-none"><span className="material-symbols-outlined text-white text-6xl">manage_accounts</span></div>
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex items-center gap-2 mb-4">
                    <div className="size-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
                        <span className="material-symbols-outlined text-white text-lg">person_check</span>
                    </div>
                    <p className="text-[10px] font-black leading-tight text-white uppercase tracking-[0.1em]">Contas Vendedores</p>
                </div>
                <div className="space-y-2 w-full mt-auto">
                    <div className="flex items-end justify-between border-b border-emerald-400/30 pb-2">
                        <span className="text-[10px] font-medium text-emerald-100/90 tracking-wide">Pagas (Central)</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-white bg-black/20 px-1.5 py-0.5 rounded shadow-inner">{pct}</span>
                            <span className="text-[15px] leading-none font-black text-[#8be2c7]">{fmt(closedAmt)}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-black text-[#fed858] uppercase tracking-wider">Em mãos</span>
                        <span className="text-[15px] leading-none font-black text-[#fed858]">{fmt(unclosedAmt)}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- RANKING ITEM ---
    const RankItem: React.FC<{ rank: number; name: string; value: string; max: number; current: number; color: string }> = ({ rank, name, value, max, current, color }) => (
        <div className="flex items-center gap-3 group">
            <div className={`size-7 rounded-lg flex items-center justify-center text-xs font-black shadow-sm ${rank === 1 ? `bg-${color} text-white` : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>{rank}</div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{name}</p>
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full mt-1 overflow-hidden"><div className={`h-full bg-${color} rounded-full transition-all duration-700`} style={{ width: `${(current / max) * 100}%` }} /></div>
            </div>
            <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">{value}</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-transparent px-4 md:px-6 py-6 pb-24 no-scrollbar overflow-x-hidden">
            <div className="max-w-[1400px] mx-auto space-y-6">

                {/* HEADER */}
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setView('dashboard')} className="size-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm border border-slate-200 dark:border-slate-700 hover:scale-105 active:scale-95 transition-all text-slate-400"><span className="material-symbols-outlined text-xl">arrow_back</span></button>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">BI Dashboard <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-widest">PRO</span></h1>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><span className="size-1.5 bg-emerald-500 rounded-full animate-pulse" /> Visão Gerencial em Tempo Real</p>
                        </div>
                    </div>
                </header>

                {/* FILTER BAR */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Preset Buttons */}
                        <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                            {[
                                { id: 'mes', label: 'Este Mês' },
                                { id: '60', label: '60 Dias' },
                                { id: '90', label: '90 Dias' },
                                { id: 'tudo', label: 'Tudo' },
                                { id: 'custom', label: 'Personalizado' },
                            ].map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        setDatePreset(p.id as any);
                                        if (p.id === 'custom') setShowFilters(true);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${datePreset === p.id ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${showFilters || activeFilterCount > 0 ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary'}`}>
                            <span className="material-symbols-outlined text-sm">tune</span> Filtros
                            {activeFilterCount > 0 && <span className="size-5 bg-primary rounded-full flex items-center justify-center text-[9px] text-white ml-1">{activeFilterCount}</span>}
                        </button>
                        {activeFilterCount > 0 && <button onClick={clearFilters} className="text-[9px] font-black text-red-500 hover:text-red-600 uppercase tracking-widest px-3 py-2 transition-colors">✕ Limpar Tudo</button>}
                    </div>

                    {showFilters && (
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-[28px] shadow-xl border border-slate-100 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 animate-in slide-in-from-top-4 duration-300">
                            {/* Date Range showing only if Custom or filters are active */}
                            <div className={datePreset !== 'custom' ? 'opacity-50 pointer-events-none' : ''}>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Data Início</label>
                                <input type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                            </div>
                            <div className={datePreset !== 'custom' ? 'opacity-50 pointer-events-none' : ''}>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">Data Fim</label>
                                <input type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))} className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                            </div>
                            {/* Seller */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Vendedor</label><select value={filters.seller} onChange={e => setFilters(p => ({ ...p, seller: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todos</option>{team.filter(t => t.role === 'vendedor').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                            {/* Channel */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Canal</label><select value={filters.channel} onChange={e => setFilters(p => ({ ...p, channel: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todos</option><option value="online">Online</option><option value="presencial">Presencial</option><option value="empresarial">Empresarial</option></select></div>
                            {/* City */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cidade</label><select value={filters.city} onChange={e => setFilters(p => ({ ...p, city: e.target.value, neighborhood: '' }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todas</option>{[...new Set(customers.map(c => c.city).filter(Boolean))].sort().map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                            {/* Neighborhood */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Bairro</label><select value={filters.neighborhood} onChange={e => setFilters(p => ({ ...p, neighborhood: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todos</option>{[...new Set(customers.filter(c => !filters.city || c.city === filters.city).map(c => c.neighborhood).filter(Boolean))].sort().map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                            {/* Customer */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cliente</label><select value={filters.customer} onChange={e => setFilters(p => ({ ...p, customer: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todos</option>{customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            {/* Category */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Tipo Venda</label><select value={filters.payCategory} onChange={e => setFilters(p => ({ ...p, payCategory: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todos</option><option value="avista">À Vista</option><option value="prazo">A Prazo</option></select></div>
                            {/* Payment Method */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Pagamento</label><select value={filters.payMethod} onChange={e => setFilters(p => ({ ...p, payMethod: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todos</option><option value="PIX">PIX</option><option value="Cartão">Cartão</option><option value="Dinheiro">Dinheiro</option></select></div>
                            {/* Overdue */}
                            <div><label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Em Atraso</label><select value={filters.overdue} onChange={e => setFilters(p => ({ ...p, overdue: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-white outline-none focus:border-primary cursor-pointer"><option value="">Todos</option><option value="sim">Apenas em atraso</option></select></div>
                        </div>
                    )}
                </div>

                {/* ROW 1 - KPI CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon="payments" label="Faturamento Total" value={fmt(totalRevenue)} sub={`${activeSales.length} vendas realizadas`} gradient="from-slate-700 to-slate-900" onClick={() => setActiveModal('faturamento')} badge="Live" />
                    <ContasKpiCard closedAmt={closedAmount} unclosedAmt={unclosedAmount} pct={totalRevenue > 0 ? ((closedAmount / totalRevenue) * 100).toFixed(1) + '%' : '0%'} />
                    <KpiCard icon="event_busy" label="Valor em Atraso" value={fmt(overdueTotal)} pct={totalRevenue > 0 ? ((overdueTotal / totalRevenue) * 100).toFixed(1) + '%' : '0%'} sub={`${overdueInstallments.length} parcelas vencidas`} gradient="from-red-500 to-red-700" onClick={() => { setActiveModal('parcelas'); setInstTab('overdue'); }} />
                    <KpiCard icon="credit_score" label="A Receber (Total)" value={fmt(pendingInstTotal)} pct={totalRevenue > 0 ? ((pendingInstTotal / totalRevenue) * 100).toFixed(1) + '%' : '0%'} sub={overdueTotal > 0 ? `Inclui ${fmt(overdueTotal)} em atraso` : 'Nenhum atraso incluído'} gradient="from-violet-500 to-indigo-600" onClick={() => { setActiveModal('parcelas'); setInstTab('all'); }} />
                </div>

                {/* ROW 2 - SECONDARY CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Formas de Pagamento */}
                    <div onClick={() => setActiveModal('pagamento')} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all">
                        <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-indigo-500 text-lg">pie_chart</span><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Formas de Pagamento</p></div>
                        <div className="space-y-2">
                            {paymentBreakdown.slice(0, 3).map(([method, total]) => (
                                <div key={method} className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{method}</span>
                                    <span className="text-[10px] font-black text-slate-900 dark:text-white">{fmt(total)}</span>
                                </div>
                            ))}
                            {paymentBreakdown.length > 3 && <p className="text-[9px] text-slate-400 text-center">+{paymentBreakdown.length - 3} mais...</p>}
                        </div>
                    </div>

                    {/* Pendentes Entrega */}
                    <div onClick={() => setActiveModal('entregas')} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all">
                        <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-amber-500 text-lg">local_shipping</span><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pendentes Entrega</p></div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">{pendingDeliveries.length}</h2>
                        <p className="text-[10px] text-slate-400">pedidos aguardando entrega</p>
                    </div>

                    {/* Estoque */}
                    <div onClick={() => setActiveModal('estoque')} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all">
                        <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-rose-500 text-lg">inventory_2</span><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estoque</p></div>
                        <div className="flex gap-4">
                            <div><p className="text-xl font-black text-amber-500">{lowStock.length}</p><p className="text-[9px] text-slate-400">Baixo</p></div>
                            <div><p className="text-xl font-black text-red-500">{criticalStock.length}</p><p className="text-[9px] text-slate-400">Crítico</p></div>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-3"><span className="material-symbols-outlined text-emerald-500 text-lg">flag</span><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meta Mensal</p></div>
                        <div className="flex items-end gap-2 mb-2">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">{goalPct.toFixed(0)}%</h2>
                            <span className="text-[10px] font-bold text-slate-400 mb-0.5">{fmt(totalRevenue)} / {fmt(goal?.amount || 50000)}</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${goalPct >= 80 ? 'bg-emerald-500' : goalPct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${goalPct}%` }} /></div>
                    </div>
                </div>

                {/* CHARTS ROW */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* DAILY SALES COLUMN CHART */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-primary text-lg">bar_chart</span> Vendas {chartViewMode === 'monthly' ? 'Mensais' : 'Diárias'}</h3>
                            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 rounded-xl p-1">
                                <button onClick={() => setChartViewMode(chartViewMode === 'daily' ? 'monthly' : 'daily')} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ${chartViewMode === 'monthly' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{chartViewMode === 'daily' ? 'Ver Ano' : 'Ver Dia'}</button>
                                <button onClick={() => setShowEmptyDays(!showEmptyDays)} className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all ${showEmptyDays ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>{showEmptyDays ? 'Ocultar Vazios' : 'Vazios'}</button>
                                {chartViewMode === 'daily' && (
                                    <select value={chartMonth} onChange={e => setChartMonth(Number(e.target.value))} className="bg-transparent text-[9px] font-black uppercase tracking-widest px-2 py-1 outline-none cursor-pointer text-slate-600 dark:text-slate-300 border-none">
                                        {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                )}
                                <select value={chartYear} onChange={e => setChartYear(Number(e.target.value))} className="bg-transparent text-[9px] font-black uppercase tracking-widest px-2 py-1 outline-none cursor-pointer text-slate-600 dark:text-slate-300 border-none">
                                    {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="h-[200px] flex items-end gap-[1px] px-1 pb-1">
                            {(() => {
                                const data = showEmptyDays ? salesTrend : salesTrend.filter(d => d.value > 0);
                                const isDense = data.length > 15;
                                return data.map((d, i) => {
                                    const h = maxSalesTrend > 0 ? Math.max(d.value > 0 ? 3 : 0, (d.value / maxSalesTrend) * 100) : 0;
                                    const fmtShort = (v: number) => v >= 1000 ? `${(v/1000).toFixed(1).replace('.0','')}k` : v > 0 ? String(Math.round(v)) : '';
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group/b relative">
                                            {d.value > 0 && <span className={`font-black text-primary opacity-90 group-hover/b:opacity-100 transition-all ${isDense ? 'text-[6px] -rotate-90 origin-bottom translate-y-1 mb-2' : 'text-[9px] mb-1'}`}>{fmtShort(d.value)}</span>}
                                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 opacity-0 group-hover/b:opacity-100 z-30 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none">Dia {d.label}: {fmt(d.value)}</div>
                                            <div className={`w-full rounded-t-sm transition-all duration-500 cursor-pointer ${d.value > 0 ? 'bg-gradient-to-t from-primary to-blue-400 group-hover/b:to-blue-300 shadow-sm shadow-primary/20' : 'bg-slate-100 dark:bg-slate-700/30'}`} style={{ height: `${h}%`, minHeight: d.value > 0 ? '4px' : '2px' }} />
                                            <span className={`font-black mt-1.5 ${isDense ? 'text-[7px]' : 'text-[10px]'} ${d.value > 0 ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>{d.label}</span>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    {/* INSTALLMENT RECEIVABLES LINE CHART */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-blue-500 text-lg">credit_score</span> Parcelas a Receber</h3>
                                <p className="text-[8px] text-slate-400 ml-7">{instDrill.level === 'month' ? 'Clique num mês para ver dias' : 'Visão diária'}</p>
                            </div>
                            {instDrill.level === 'day' && <button onClick={() => setInstDrill({ level: 'month', month: null, year: null })} className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all">← Voltar</button>}
                        </div>
                        <div className="h-[200px] relative">
                            {/* SVG Line */}
                            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                                <defs><linearGradient id="igrd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>
                                {instTrend.length > 1 && <><path d={`M ${instTrend.map((d, i) => `${(i / (instTrend.length - 1)) * 100} ${100 - (d.value / maxInstTrend) * 85}`).join(' L ')} L 100 100 L 0 100 Z`} fill="url(#igrd)" /><path d={`M ${instTrend.map((d, i) => `${(i / (instTrend.length - 1)) * 100} ${100 - (d.value / maxInstTrend) * 85}`).join(' L ')}`} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></>}
                            </svg>
                            {/* Data points */}
                            <div className="flex items-end justify-between h-full relative z-20">
                                {instTrend.map((d, i) => {
                                    const yPct = maxInstTrend > 0 ? 100 - (d.value / maxInstTrend) * 85 : 100;
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center group/d relative h-full cursor-pointer" onClick={() => { if (instDrill.level === 'month' && d.value > 0) setInstDrill({ level: 'day', month: d.month, year: d.year }); }}>
                                            <div className="absolute -translate-x-1/2 opacity-0 group-hover/d:opacity-100 z-30 bg-blue-600 text-white text-[7px] font-black px-2 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none" style={{ left: '50%', top: `${yPct - 5}%`, transform: 'translate(-50%, -100%)' }}>{fmt(d.value)}</div>
                                            <div className={`absolute size-2.5 rounded-full border-2 border-white dark:border-slate-800 z-20 group-hover/d:scale-[2] transition-all ${d.value > 0 ? 'bg-blue-500' : 'bg-slate-200'}`} style={{ top: `${yPct}%`, transform: 'translateY(-50%)' }} />
                                            <div className="absolute bottom-0 w-full text-center translate-y-5"><span className={`text-[7px] font-bold ${d.value > 0 ? 'text-slate-500' : 'text-slate-300'}`}>{d.label}</span></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ROW 3 - CHART + RANKINGS */}
                <div className="grid grid-cols-12 gap-4">
                    {/* GEO CHART */}
                    <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-indigo-500 text-lg">location_on</span> Vendas por {geoDrill.level === 'city' ? 'Cidade' : geoDrill.level === 'neighborhood' ? 'Bairro' : 'Cliente'}</h3>
                                {geoDrill.level !== 'city' && <p className="text-[9px] text-slate-400 ml-7">{geoDrill.city}{geoDrill.neighborhood ? ` → ${geoDrill.neighborhood}` : ''}</p>}
                            </div>
                            {geoDrill.level !== 'city' && <button onClick={() => setGeoDrill(geoDrill.level === 'client' ? { level: 'neighborhood', city: geoDrill.city, neighborhood: null } : { level: 'city', city: null, neighborhood: null })} className="text-[9px] font-black text-primary bg-primary/10 px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all">← Voltar</button>}
                        </div>
                        <div className="space-y-3">
                            {geoItems.slice(0, 10).map((item, i) => (
                                <div key={i} onClick={() => {
                                    if (geoDrill.level === 'city') setGeoDrill({ level: 'neighborhood', city: item.name, neighborhood: null });
                                    else if (geoDrill.level === 'neighborhood') setGeoDrill({ level: 'client', city: geoDrill.city, neighborhood: item.name });
                                }} className={`group ${geoDrill.level !== 'client' ? 'cursor-pointer' : ''}`}>
                                    <div className="flex justify-between items-center mb-1 px-1">
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors truncate">{item.name}</span>
                                        <div className="flex items-center gap-3"><span className="text-[9px] text-slate-400">{item.count}x</span><span className="text-[11px] font-black text-slate-900 dark:text-white">{fmt(item.total)}</span></div>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-indigo-500 to-primary rounded-full group-hover:brightness-110 transition-all duration-500" style={{ width: `${(item.total / geoMax) * 100}%` }} /></div>
                                </div>
                            ))}
                            {geoItems.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Nenhum dado encontrado</p>}
                        </div>
                    </div>

                    {/* RANKINGS SIDEBAR */}
                    <div className="col-span-12 lg:col-span-4 space-y-4">
                        {/* Vendedores */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-amber-500 text-lg">emoji_events</span> Ranking Vendedores</h3>
                            <div className="space-y-3">{sellerRanking.slice(0, 5).map((s, i) => <RankItem key={s.id} rank={i + 1} name={s.name} value={fmt(s.total)} max={sellerRanking[0]?.total || 1} current={s.total} color="amber-500" />)}</div>
                            {sellerRanking.length === 0 && <p className="text-[10px] text-slate-400 text-center py-2">Sem vendas presenciais</p>}
                        </div>
                        {/* Entregadores */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-blue-500 text-lg">directions_bike</span> Ranking Entregadores</h3>
                            <div className="space-y-3">{driverRanking.slice(0, 5).map((d, i) => <RankItem key={d.id} rank={i + 1} name={d.name} value={`${d.count} entregas`} max={driverRanking[0]?.count || 1} current={d.count} color="blue-500" />)}</div>
                            {driverRanking.length === 0 && <p className="text-[10px] text-slate-400 text-center py-2">Sem entregas registradas</p>}
                        </div>
                        {/* Clientes */}
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-emerald-500 text-lg">group</span> Ranking Clientes</h3>
                            <div className="space-y-3">{customerRanking.slice(0, 5).map((c, i) => <RankItem key={c.id} rank={i + 1} name={c.name} value={fmt(c.total)} max={customerRanking[0]?.total || 1} current={c.total} color="emerald-500" />)}</div>
                        </div>
                    </div>
                </div>

                {/* ROW 4 - DATA TABLES (Tabbed) */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                    <div className="flex border-b border-slate-100 dark:border-slate-700">
                        <button onClick={() => setActiveTab('vendas')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'vendas' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-400 hover:text-slate-600'}`}><span className="material-symbols-outlined text-sm align-middle mr-1">receipt_long</span>Todas as Vendas</button>
                        <button onClick={() => setActiveTab('parcelas')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'parcelas' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-400 hover:text-slate-600'}`}><span className="material-symbols-outlined text-sm align-middle mr-1">credit_score</span>Parcelas Pendentes {pendingInstallments.length > 0 && <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full ml-1">{pendingInstallments.length}</span>}</button>
                    </div>
                    <div className="overflow-x-auto">
                        {activeTab === 'vendas' ? (
                            <table className="w-full text-left"><thead><tr className="bg-slate-50/50 dark:bg-slate-900/50">
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Vendedor</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pagamento</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Canal</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                            </tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {[...activeSales].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50).map(s => (
                                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-5 py-3 text-[10px] font-bold text-slate-500 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString('pt-BR')}</td>
                                        <td className="px-5 py-3 text-[10px] font-bold text-slate-700 dark:text-white truncate max-w-[130px]">{s.customerName}</td>
                                        <td className="px-5 py-3 text-[10px] text-slate-500 truncate max-w-[100px]">{s.sellerName || '-'}</td>
                                        <td className="px-5 py-3 text-[11px] font-black text-slate-900 dark:text-white whitespace-nowrap">{fmt(s.total)}</td>
                                        <td className="px-5 py-3"><span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${s.paymentMethod === PaymentMethod.TERM ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>{s.paymentMethod}</span></td>
                                        <td className="px-5 py-3"><span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${s.channel === 'online' ? 'bg-blue-100 text-blue-600' : s.channel === 'empresarial' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>{s.channel}</span></td>
                                        <td className="px-5 py-3 text-right"><span className={`text-[8px] font-black px-2 py-1 rounded-lg inline-block ${s.status === OrderStatus.DELIVERED ? 'bg-emerald-500 text-white' : s.status === OrderStatus.CANCELLED ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>{s.status}</span></td>
                                    </tr>
                                ))}
                            </tbody></table>
                        ) : (
                            <table className="w-full text-left"><thead><tr className="bg-slate-50/50 dark:bg-slate-900/50">
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Parcela</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                                <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                            </tr></thead><tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                {installmentDetails.slice(0, 50).map(inst => {
                                    const isOverdue = inst.dueDate < Date.now();
                                    return (
                                        <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                                            <td className={`px-5 py-3 text-[10px] font-bold whitespace-nowrap ${isOverdue ? 'text-red-500' : 'text-slate-500'}`}>{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-5 py-3 text-[10px] font-bold text-slate-700 dark:text-white truncate max-w-[130px]">{inst.customerName}</td>
                                            <td className="px-5 py-3 text-[10px] text-slate-500">{inst.number}/{inst.totalInstallments}</td>
                                            <td className="px-5 py-3 text-[11px] font-black text-slate-900 dark:text-white">{fmt(inst.amount)}</td>
                                            <td className="px-5 py-3 text-right"><span className={`text-[8px] font-black px-2 py-1 rounded-lg ${isOverdue ? 'bg-red-500 text-white' : 'bg-amber-400 text-white'}`}>{isOverdue ? 'Atrasado' : 'Pendente'}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody></table>
                        )}
                    </div>
                </div>

                {/* MODALS */}
                {activeModal === 'faturamento' && (
                    <Modal title="Faturamento Detalhado" icon="payments" color="from-slate-700 to-slate-900" onClose={() => setActiveModal(null)}>
                        <div className="space-y-4">
                            <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl"><span className="text-sm font-bold text-slate-600">Total Bruto</span><span className="text-sm font-black text-slate-900 dark:text-white">{fmt(totalRevenue)}</span></div>
                            <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl"><span className="text-sm font-bold text-blue-600">Online</span><span className="text-sm font-black">{fmt(onlineRevenue)}</span></div>
                            <div className="flex justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl"><span className="text-sm font-bold text-indigo-600">Presencial</span><span className="text-sm font-black">{fmt(presencialRevenue)}</span></div>
                            <div className="flex justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl"><span className="text-sm font-bold text-purple-600">Empresarial</span><span className="text-sm font-black">{fmt(corporateRevenue)}</span></div>
                            <div className="border-t pt-3"><p className="text-[10px] text-slate-400 mb-2">Total de vendas: {activeSales.length}</p></div>
                        </div>
                    </Modal>
                )}

                {activeModal === 'parcelas' && (
                    <Modal title="Parcelas Pendentes" icon="credit_score" color="from-amber-500 to-orange-600" onClose={() => { setActiveModal(null); setInstTab('all'); }}>
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <button onClick={() => setInstTab('all')} className={`p-3 rounded-xl text-center border-2 transition-all ${instTab === 'all' ? 'bg-slate-100 dark:bg-slate-900 border-primary' : 'bg-transparent border-transparent'}`}>
                                    <p className="text-lg font-black text-slate-700 dark:text-slate-200">{pendingInstallments.length}</p>
                                    <p className="text-[8px] text-slate-400 uppercase font-black">Total</p>
                                </button>
                                <button onClick={() => setInstTab('pending')} className={`p-3 rounded-xl text-center border-2 transition-all ${instTab === 'pending' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-500' : 'bg-transparent border-transparent'}`}>
                                    <p className="text-lg font-black text-amber-600">{(pendingInstallments.length - overdueInstallments.length)}</p>
                                    <p className="text-[8px] text-slate-400 uppercase font-black">No Prazo</p>
                                </button>
                                <button onClick={() => setInstTab('overdue')} className={`p-3 rounded-xl text-center border-2 transition-all ${instTab === 'overdue' ? 'bg-red-50 dark:bg-red-900/20 border-red-500' : 'bg-transparent border-transparent'}`}>
                                    <p className="text-lg font-black text-red-600">{overdueInstallments.length}</p>
                                    <p className="text-[8px] text-slate-400 uppercase font-black">Em Atraso</p>
                                </button>
                            </div>
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                                {installmentDetails
                                    .filter(inst => {
                                        if (instTab === 'pending') return inst.dueDate >= Date.now();
                                        if (instTab === 'overdue') return inst.dueDate < Date.now();
                                        return true;
                                    })
                                    .slice(0, 50).map(inst => {
                                        const isOverdue = inst.dueDate < Date.now();
                                        return (
                                            <div 
                                                key={inst.id} 
                                                onClick={() => setSelectedSaleId(inst.saleId)}
                                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer hover:brightness-95 active:scale-[0.98] transition-all border ${isOverdue ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 truncate">{inst.customerName}</p>
                                                        <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${isOverdue ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-white'}`}>
                                                            {isOverdue ? 'Atrasada' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 font-bold">Vendedor: {inst.sellerName} · <span className={isOverdue ? 'text-red-500' : ''}>{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</span></p>
                                                </div>
                                                <div className="text-right ml-2">
                                                    <span className="text-[11px] font-black text-slate-900 dark:text-white block">{fmt(inst.amount)}</span>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">Ver detalhes</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                {installmentDetails.length === 0 && <p className="text-center py-8 text-slate-400 text-xs">Nenhuma parcela pendente encontrada</p>}
                            </div>
                        </div>
                    </Modal>
                )}

                {activeModal === 'pagamento' && (
                    <Modal title="Formas de Pagamento" icon="pie_chart" color="from-indigo-500 to-purple-700" onClose={() => setActiveModal(null)}>
                        <div className="space-y-3">
                            {paymentBreakdown.map(([method, total]) => {
                                const pct = totalRevenue > 0 ? ((total / totalRevenue) * 100).toFixed(1) : '0';
                                return (
                                    <div key={method} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                        <div className="flex items-center gap-3"><div className="h-2 w-2 rounded-full bg-indigo-500" /><span className="text-sm font-bold text-slate-600 dark:text-slate-300">{method}</span></div>
                                        <div className="text-right"><span className="text-sm font-black text-slate-900 dark:text-white">{fmt(total)}</span><span className="text-[9px] text-slate-400 ml-2">{pct}%</span></div>
                                    </div>
                                );
                            })}
                        </div>
                    </Modal>
                )}
                {activeModal === 'entregas' && (
                    <Modal title="Entregas Pendentes" icon="local_shipping" color="from-amber-500 to-orange-600" onClose={() => setActiveModal(null)}>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {pendingDeliveries.slice(0, 20).map(d => (
                                <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                    <div><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{d.customerName}</p><p className="text-[9px] text-slate-400">{d.driverName || 'Sem motorista'} · {d.status}</p></div>
                                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg ${d.status === DeliveryStatus.IN_ROUTE ? 'bg-blue-500 text-white' : 'bg-amber-400 text-white'}`}>{d.status}</span>
                                </div>
                            ))}
                            {pendingDeliveries.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma entrega pendente 🎉</p>}
                        </div>
                    </Modal>
                )}
                {activeModal === 'estoque' && (
                    <Modal title="Status do Estoque" icon="inventory_2" color="from-rose-500 to-red-700" onClose={() => setActiveModal(null)}>
                        <div className="space-y-2">
                            {stockItems.map(s => {
                                const basket = baskets.find(b => b.id === s.basketModelId);
                                const qty = Number(s.quantity || 0);
                                return (
                                    <div key={s.basketModelId} className={`flex items-center justify-between p-3 rounded-xl ${qty <= 5 ? 'bg-red-50 dark:bg-red-900/10' : qty <= 10 ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-slate-50 dark:bg-slate-900'}`}>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{basket?.name || 'Produto'}</span>
                                        <span className={`text-sm font-black ${qty <= 5 ? 'text-red-500' : qty <= 10 ? 'text-amber-500' : 'text-emerald-500'}`}>{qty} un</span>
                                    </div>
                                );
                            })}
                        </div>
                    </Modal>
                )}

                {/* Sale Detail Modal (Drill-down) */}
                {selectedSaleId && (
                    <Modal 
                        title="Detalhes do Pedido" 
                        icon="receipt_long" 
                        color="from-slate-800 to-slate-950" 
                        onClose={() => setSelectedSaleId(null)}
                    >
                        {(() => {
                            const sale = sales.find(s => s.id === selectedSaleId);
                            if (!sale) return <p className="text-center py-4 text-slate-400">Venda não encontrada</p>;
                            const customer = customers.find(c => c.id === sale.customerId);
                            const saleInsts = installments.filter(i => i.saleId === sale.id).sort((a, b) => a.number - b.number);
                            
                            return (
                                <div className="space-y-5">
                                    {/* Header Info */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-auto">#{sale.id.slice(0, 8).toUpperCase()}</span>
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${sale.status === OrderStatus.DELIVERED ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-white'}`}>
                                            {sale.status}
                                        </span>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[9px] font-bold text-slate-500">
                                            <span className="material-symbols-outlined text-[10px]">schedule</span>
                                            {new Date(sale.createdAt).toLocaleDateString('pt-BR')} {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>

                                    {/* Customer / Products */}
                                    <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                        <div className="mb-4">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p>
                                            <h4 className="text-sm font-black text-slate-900 dark:text-white">{sale.customerName}</h4>
                                            <p className="text-[10px] text-slate-500">{customer?.phone || 'Telefone não informado'}</p>
                                        </div>
                                        <div className="space-y-2 border-t border-slate-50 dark:border-slate-800 pt-3">
                                            {sale.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-primary">x{item.quantity}</span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">{item.basketName}</span>
                                                    </div>
                                                    <span className="font-black text-slate-900 dark:text-white">{fmt(item.unitPrice * item.quantity)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cards Row */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100/50 dark:border-blue-900/20">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-2">Venda Realizada Por</p>
                                            <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                <span className="material-symbols-outlined text-xs">person</span>
                                                {sale.sellerName || 'Venda Online'}
                                            </div>
                                            {sale.driverName && (
                                                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
                                                    <span className="material-symbols-outlined text-xs">local_shipping</span>
                                                    {sale.driverName}
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Pagamento</p>
                                            <div className="flex items-center gap-2 mb-1 text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">
                                                <span className="material-symbols-outlined text-xs">payments</span>
                                                {sale.paymentMethod}
                                            </div>
                                            <p className="text-sm font-black text-primary">Total {fmt(sale.total)}</p>
                                        </div>
                                    </div>

                                    {/* Installments Section */}
                                    {saleInsts.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelas e Vencimentos</p>
                                            <div className="space-y-2">
                                                {saleInsts.map(inst => {
                                                    const isPaid = inst.status === InstallmentStatus.PAID;
                                                    const isOverdue = inst.dueDate < Date.now() && !isPaid;
                                                    return (
                                                        <div key={inst.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl shadow-sm">
                                                            <div>
                                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{inst.number}ª Parcela</p>
                                                                <p className={`text-[11px] font-bold ${isOverdue ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>{new Date(inst.dueDate).toLocaleDateString('pt-BR')}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[11px] font-black text-slate-900 dark:text-white mb-1">{fmt(inst.amount)}</p>
                                                                <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest ${isPaid ? 'bg-emerald-500 text-white' : isOverdue ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-400 text-white'}`}>
                                                                    {isPaid ? 'Pago' : isOverdue ? 'Atrasada' : 'Pendente'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </Modal>
                )}

                <div className="h-8" />
            </div>
        </div>
    );
};

export default AnalyticsView;
