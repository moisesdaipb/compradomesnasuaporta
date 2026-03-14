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

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

    // --- CORE DATA ---
    const activeSales = useMemo(() => sales.filter(s => s.status !== OrderStatus.CANCELLED), [sales]);
    const totalRevenue = useMemo(() => activeSales.reduce((a, s) => a + s.total, 0), [activeSales]);
    const onlineRevenue = useMemo(() => activeSales.filter(s => s.channel === 'online').reduce((a, s) => a + s.total, 0), [activeSales]);
    const presencialRevenue = useMemo(() => activeSales.filter(s => s.channel === 'presencial').reduce((a, s) => a + s.total, 0), [activeSales]);
    const cashRevenue = useMemo(() => activeSales.filter(s => s.paymentMethod !== PaymentMethod.TERM).reduce((a, s) => a + s.total, 0), [activeSales]);
    const termRevenue = useMemo(() => activeSales.filter(s => s.paymentMethod === PaymentMethod.TERM).reduce((a, s) => a + s.total, 0), [activeSales]);

    // Installments
    const pendingInstallments = useMemo(() => installments.filter(i => i.status === InstallmentStatus.PENDING), [installments]);
    const pendingInstTotal = useMemo(() => pendingInstallments.reduce((a, i) => a + i.amount, 0), [pendingInstallments]);
    const overdueInstallments = useMemo(() => pendingInstallments.filter(i => i.dueDate < Date.now()), [pendingInstallments]);
    const overdueTotal = useMemo(() => overdueInstallments.reduce((a, i) => a + i.amount, 0), [overdueInstallments]);
    const paidInstTotal = useMemo(() => installments.filter(i => i.status === InstallmentStatus.PAID).reduce((a, i) => a + i.amount, 0), [installments]);

    // Closing
    const closedSaleIds = useMemo(() => {
        const ids = new Set<string>();
        dailyClosings.filter(c => c.status === ClosingStatus.APPROVED || c.status === ClosingStatus.PENDING).forEach(c => (c.salesIds || []).forEach(id => ids.add(id)));
        return ids;
    }, [dailyClosings]);
    const closedAmount = useMemo(() => activeSales.filter(s => s.paymentMethod !== PaymentMethod.TERM && closedSaleIds.has(s.id)).reduce((a, s) => a + s.total, 0), [activeSales, closedSaleIds]);
    const unclosedAmount = useMemo(() => cashRevenue - closedAmount, [cashRevenue, closedAmount]);

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
    const KpiCard: React.FC<{ icon: string; label: string; value: string; sub?: string; gradient: string; onClick?: () => void; badge?: string }> = ({ icon, label, value, sub, gradient, onClick, badge }) => (
        <div onClick={onClick} className={`relative p-5 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 cursor-pointer hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] bg-gradient-to-br ${gradient}`}>
            <div className="absolute top-0 right-0 p-4 opacity-[0.08] scale-[2] pointer-events-none"><span className="material-symbols-outlined text-white text-6xl">{icon}</span></div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="size-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm"><span className="material-symbols-outlined text-white text-lg">{icon}</span></div>
                    {badge && <span className="text-[9px] font-black text-white/80 bg-white/15 px-2 py-0.5 rounded-lg uppercase tracking-widest backdrop-blur-sm">{badge}</span>}
                </div>
                <p className="text-[9px] font-black text-white/70 uppercase tracking-[0.15em] mb-0.5">{label}</p>
                <h2 className="text-xl font-black text-white leading-tight">{value}</h2>
                {sub && <p className="text-[10px] font-medium text-white/60 mt-1">{sub}</p>}
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
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] px-4 md:px-6 py-6 pb-24 no-scrollbar overflow-x-hidden">
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

                {/* ROW 1 - KPI CARDS */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard icon="payments" label="Faturamento Total" value={fmt(totalRevenue)} sub={`Online ${fmt(onlineRevenue)} · Presencial ${fmt(presencialRevenue)}`} gradient="from-slate-700 to-slate-900" onClick={() => setActiveModal('faturamento')} badge="Live" />
                    <KpiCard icon="account_balance" label="À Vista vs A Prazo" value={fmt(cashRevenue)} sub={`A Prazo: ${fmt(termRevenue)}`} gradient="from-blue-500 to-blue-700" onClick={() => setActiveModal('avista')} />
                    <KpiCard icon="credit_score" label="Parcelas Pendentes" value={fmt(pendingInstTotal)} sub={overdueTotal > 0 ? `⚠ ${fmt(overdueTotal)} em atraso` : 'Nenhuma em atraso'} gradient="from-amber-500 to-orange-600" onClick={() => setActiveModal('parcelas')} />
                    <KpiCard icon="savings" label="Fechamento Caixa" value={fmt(closedAmount)} sub={`Falta prestar contas: ${fmt(unclosedAmount)}`} gradient={unclosedAmount > 0 ? 'from-red-500 to-rose-700' : 'from-emerald-500 to-teal-700'} onClick={() => setActiveModal('fechamento')} />
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
                                        <td className="px-5 py-3"><span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase ${s.channel === 'online' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>{s.channel}</span></td>
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
                            <div className="border-t pt-3"><p className="text-[10px] text-slate-400 mb-2">Total de vendas: {activeSales.length}</p></div>
                        </div>
                    </Modal>
                )}
                {activeModal === 'avista' && (
                    <Modal title="À Vista vs A Prazo" icon="account_balance" color="from-blue-500 to-blue-700" onClose={() => setActiveModal(null)}>
                        <div className="space-y-4">
                            <div className="flex justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl"><span className="text-sm font-bold text-emerald-600">À Vista</span><span className="text-sm font-black">{fmt(cashRevenue)}</span></div>
                            <div className="flex justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl"><span className="text-sm font-bold text-indigo-600">A Prazo</span><span className="text-sm font-black">{fmt(termRevenue)}</span></div>
                            <div className="border-t pt-3">
                                <p className="text-[10px] text-slate-400 mb-1">Do valor a prazo:</p>
                                <div className="flex justify-between p-2 rounded-lg"><span className="text-xs text-emerald-600">Já recebido (parcelas pagas)</span><span className="text-xs font-black">{fmt(paidInstTotal)}</span></div>
                                <div className="flex justify-between p-2 rounded-lg"><span className="text-xs text-amber-600">Falta receber</span><span className="text-xs font-black">{fmt(pendingInstTotal)}</span></div>
                            </div>
                        </div>
                    </Modal>
                )}
                {activeModal === 'parcelas' && (
                    <Modal title="Parcelas Pendentes" icon="credit_score" color="from-amber-500 to-orange-600" onClose={() => setActiveModal(null)}>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-center"><p className="text-lg font-black text-amber-600">{pendingInstallments.length}</p><p className="text-[9px] text-slate-400">Pendentes</p></div>
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-center"><p className="text-lg font-black text-red-600">{overdueInstallments.length}</p><p className="text-[9px] text-slate-400">Em Atraso</p></div>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {installmentDetails.slice(0, 20).map(inst => (
                                    <div key={inst.id} className={`flex items-center justify-between p-3 rounded-xl ${inst.dueDate < Date.now() ? 'bg-red-50 dark:bg-red-900/10' : 'bg-slate-50 dark:bg-slate-900'}`}>
                                        <div><p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{inst.customerName}</p><p className="text-[9px] text-slate-400">Vendedor: {inst.sellerName} · {new Date(inst.dueDate).toLocaleDateString('pt-BR')}</p></div>
                                        <span className="text-[11px] font-black text-slate-900 dark:text-white">{fmt(inst.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Modal>
                )}
                {activeModal === 'fechamento' && (
                    <Modal title="Fechamento de Caixa" icon="savings" color={unclosedAmount > 0 ? 'from-red-500 to-rose-700' : 'from-emerald-500 to-teal-700'} onClose={() => setActiveModal(null)}>
                        <div className="space-y-4">
                            <div className="flex justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl"><span className="text-sm font-bold text-emerald-600">Caixa Fechado</span><span className="text-sm font-black">{fmt(closedAmount)}</span></div>
                            <div className="flex justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-xl"><span className="text-sm font-bold text-red-600">Falta Prestar Contas</span><span className="text-sm font-black">{fmt(unclosedAmount)}</span></div>
                            <div className="border-t pt-3"><p className="text-[10px] text-slate-400 mb-1">Total à vista: {fmt(cashRevenue)}</p></div>
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

                <div className="h-8" />
            </div>
        </div>
    );
};

export default AnalyticsView;
