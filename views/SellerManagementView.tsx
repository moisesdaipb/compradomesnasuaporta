import React, { useState, useMemo } from 'react';
import { ViewState, Sale, Installment, DailyClosing, SaleGoal, TeamMember, PaymentMethod, InstallmentStatus, ClosingStatus, OrderStatus, Delivery } from '../types';

interface SellerManagementViewProps {
    sales: Sale[];
    installments: Installment[];
    deliveries: Delivery[];
    dailyClosings: DailyClosing[];
    goals: SaleGoal[];
    sellerId: string;
    sellerName: string;
    team: TeamMember[];
    setView: (v: ViewState) => void;
}

const SellerManagementView: React.FC<SellerManagementViewProps> = ({
    sales,
    installments,
    deliveries,
    dailyClosings,
    goals,
    sellerId,
    sellerName,
    team,
    setView,
}) => {
    const currentSeller = team.find(t => t.id === sellerId);

    // Find active goal for the seller
    const activeGoal = useMemo(() => goals.find(g =>
        g.sellerId === sellerId &&
        !g.isCancelled &&
        Date.now() >= g.startDate &&
        Date.now() <= g.endDate
    ), [goals, sellerId]);

    // Determine date range: Active Goal OR Current Month (if no goal)
    const dateRange = useMemo(() => {
        if (activeGoal) {
            return {
                start: activeGoal.startDate,
                end: activeGoal.endDate
            };
        }
        // Fallback: Current Month
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = now.getTime();
        return { start, end };
    }, [activeGoal]);

    const metrics = useMemo(() => {
        // ownSales: Only sales where the seller is the direct creator (for goals/performance)
        const ownSales = sales.filter(s => s.sellerId === sellerId);

        // sellerSales: All sales the seller handles (direct + assigned deliveries) for FINANCIAL accountability
        const sellerSales = sales.filter(s => {
            if (s.sellerId === sellerId) return true;
            const delivery = deliveries.find(d => d.saleId === s.id);
            return delivery?.driverId === sellerId;
        });

        const sellerInstallments = installments.filter(i => {
            const sale = sales.find(s => s.id === i.saleId);
            if (!sale || sale.status === OrderStatus.CANCELLED) return false;
            // Includes installments for their own sales AND for deliveries they performed
            if (sale.sellerId === sellerId) return true;
            const delivery = deliveries.find(d => d.saleId === i.saleId);
            return delivery?.driverId === sellerId;
        });

        const sellerClosings = dailyClosings.filter(c => c.sellerId === sellerId);

        // Period Filtering (for Goals we only use OWN sales)
        const filteredOwnSales = ownSales.filter(s => s.createdAt >= dateRange.start && s.createdAt <= dateRange.end);

        // Total Vendido (Period) - PERSONAL PERFORMANCE ONLY
        const totalSold = filteredOwnSales
            .filter(s => s.status !== OrderStatus.CANCELLED)
            .reduce((acc, s) => acc + s.total, 0);

        // Entregue ao Gerente (Period Approval)
        const totalDelivered = sellerClosings
            .filter(c => c.status === ClosingStatus.APPROVED && c.closingDate >= dateRange.start && c.closingDate <= dateRange.end)
            .reduce((acc, c) => acc + (c.cashAmount || 0) + (c.cardAmount || 0) + (c.pixAmount || 0), 0);

        // Pendente de Entrega (Current "In Hand" - Financial accountability includes DELIVERIES)
        const totalReceived = sellerSales
            .filter(s => s.paymentMethod !== PaymentMethod.TERM && s.status !== OrderStatus.CANCELLED)
            .reduce((acc, s) => acc + s.total, 0) +
            sellerInstallments
                .filter(i => i.status === InstallmentStatus.PAID)
                .reduce((acc, i) => acc + i.amount, 0);

        const totalSubmitted = sellerClosings
            .filter(c => c.status !== ClosingStatus.REJECTED)
            .reduce((acc, c) => acc + (c.cashAmount || 0) + (c.cardAmount || 0) + (c.pixAmount || 0), 0);

        const inHand = Math.max(0, totalReceived - totalSubmitted);

        // Installment metrics (All time pending)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const futureInstallments = sellerInstallments
            .filter(i => i.status === InstallmentStatus.PENDING && i.dueDate >= today.getTime())
            .reduce((acc, i) => acc + i.amount, 0);

        const overdueInstallments = sellerInstallments
            .filter(i => i.status === InstallmentStatus.PENDING && i.dueDate < today.getTime())
            .reduce((acc, i) => acc + i.amount, 0);

        // Week Installments
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekInstallments = sellerInstallments
            .filter(i => i.status === InstallmentStatus.PENDING && i.dueDate >= today.getTime() && i.dueDate <= weekEnd.getTime())
            .sort((a, b) => a.dueDate - b.dueDate);

        // Goal Calculation
        const percentage = activeGoal
            ? Math.min(100, Math.round((totalSold / activeGoal.amount) * 100))
            : 0;

        const remaining = activeGoal
            ? Math.max(0, activeGoal.amount - totalSold)
            : 0;

        return {
            totalSold,
            totalDelivered,
            inHand,
            futureInstallments,
            overdueInstallments,
            weekInstallments,
            percentage,
            remaining
        };
    }, [sales, installments, dailyClosings, sellerId, dateRange, activeGoal]);

    const periodLabel = activeGoal
        ? `${new Date(activeGoal.startDate).toLocaleDateString()} até ${new Date(activeGoal.endDate).toLocaleDateString()}`
        : 'Mês Atual';

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300 bg-slate-50 dark:bg-slate-900">
            {/* Top Bar */}
            <div className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">Minha Gestão</h2>
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-[0.15em]">{sellerName}</p>
                    </div>
                    <button
                        onClick={() => setView('profile')}
                        className="size-10 rounded-xl bg-white dark:bg-slate-800 text-slate-400 flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm hover:text-primary transition-colors active:scale-95"
                    >
                        <span className="material-symbols-outlined text-xl">settings</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 px-6 pb-32 overflow-y-auto space-y-6 no-scrollbar">
                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 bg-gradient-to-br from-primary to-blue-600 p-6 rounded-[32px] text-white shadow-xl shadow-primary/20">
                        {/* Header with Goal Context */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-white/80">
                                        {activeGoal ? 'flag' : 'calendar_month'}
                                    </span>
                                    <p className="text-sm font-bold uppercase tracking-wider opacity-90">
                                        {activeGoal ? activeGoal.name || 'Meta Ativa' : 'Sem Meta Ativa'}
                                    </p>
                                </div>
                                <p className="text-[10px] opacity-70 font-medium bg-black/10 px-2 py-0.5 rounded-lg inline-block">
                                    {periodLabel}
                                </p>
                            </div>
                            {activeGoal && (
                                <div className="size-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <span className="font-black text-lg">{metrics.percentage}%</span>
                                </div>
                            )}
                        </div>

                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Total Vendido</p>
                        <p className="text-4xl font-black mb-4">R$ {metrics.totalSold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>

                        {/* Progress Bar for Goal */}
                        {activeGoal && (
                            <div className="mb-6">
                                <div className="h-2 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                                    <div
                                        className="h-full bg-white rounded-full transition-all duration-1000 ease-out relative"
                                        style={{ width: `${metrics.percentage}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/30 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t border-white/20 flex justify-between items-end">
                            {activeGoal ? (
                                <>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Meta Total</p>
                                        <p className="text-xl font-black">
                                            R$ {activeGoal.amount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Falta</p>
                                        <p className="text-xl font-black">
                                            R$ {metrics.remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Entregue</p>
                                    <p className="text-xl font-black">R$ {metrics.totalDelivered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-[28px] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-3xl text-success">account_balance_wallet</span>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">Pendente Entrega</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white">R$ {metrics.inHand.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[8px] font-bold text-slate-400 mt-2">Valor atual na mão</p>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-5 rounded-[28px] border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-3xl text-danger">event_busy</span>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">Em Atraso</p>
                        <p className="text-xl font-black text-danger">R$ {metrics.overdueInstallments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[8px] font-bold text-danger mt-2 font-black uppercase">Cobrança Urgente</p>
                    </div>

                    <div className="col-span-2 bg-white dark:bg-slate-800 p-5 rounded-[28px] border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-tighter text-slate-400 mb-1">A Vencer (Parcelas)</p>
                            <p className="text-xl font-black text-slate-800 dark:text-white">R$ {metrics.futureInstallments.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-800">
                            <span className="material-symbols-outlined text-blue-500 text-sm">schedule</span>
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase">Futuro</span>
                        </div>
                    </div>
                </div>

                {/* Week Installments */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm">calendar_view_week</span>
                            Para Receber na Semana
                        </h4>
                        <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg uppercase tracking-tighter">{metrics.weekInstallments.length} hoje/vencer</span>
                    </div>

                    {metrics.weekInstallments.length === 0 ? (
                        <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-[32px] border border-dashed border-slate-200 dark:border-slate-700">
                            <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">check_circle</span>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Tudo em dia para esta semana</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {metrics.weekInstallments.slice(0, 5).map(inst => {
                                const sale = sales.find(s => s.id === inst.saleId);
                                const isToday = new Date(inst.dueDate).toDateString() === new Date().toDateString();
                                return (
                                    <div key={inst.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-10 rounded-xl flex items-center justify-center ${isToday ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                                                <span className="text-xs font-black">{new Date(inst.dueDate).getDate()}</span>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-700 dark:text-slate-200">{sale?.customerName || 'Cliente'}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Parcela {inst.number}/{inst.totalInstallments}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-slate-900 dark:text-white">R$ {inst.amount.toFixed(2)}</p>
                                            {isToday && <span className="text-[8px] font-black text-amber-500 uppercase">Hoje!</span>}
                                        </div>
                                    </div>
                                );
                            })}
                            {metrics.weekInstallments.length > 5 && (
                                <button
                                    onClick={() => setView('installments')}
                                    className="w-full py-3 text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                                >
                                    Ver todas as {metrics.weekInstallments.length} parcelas
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Fast Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => setView('presential-sale')}
                        className="p-4 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 flex flex-col items-center gap-2 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined">add_shopping_cart</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">Nova Venda</span>
                    </button>
                    <button
                        onClick={() => setView('daily-closing')}
                        className="p-4 bg-slate-800 text-white rounded-2xl shadow-lg shadow-black/20 flex flex-col items-center gap-2 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined">account_balance</span>
                        <span className="text-[10px] font-black uppercase tracking-wider">Fechar Caixa</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SellerManagementView;
