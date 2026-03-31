import React, { useState, useEffect, useMemo } from 'react';
import {
  Sale,
  BasketModel,
  StockItem,
  TeamMember,
  Delivery,
  Installment,
  DailyClosing,
  ViewState,
  DeliveryStatus,
  InstallmentStatus,
  ClosingStatus,
  UserRole,
  OrderStatus,
  SaleGoal,
  PaymentMethod,
} from '../types';
import { getStockQuantity } from '../store';
import { DAILY_GOAL } from '../constants';
import { formatCurrency } from '../utils';

interface DashboardProps {
  sales: Sale[];
  baskets: BasketModel[];
  stock: StockItem[];
  team: TeamMember[];
  deliveries: Delivery[];
  installments: Installment[];
  dailyClosings: DailyClosing[];
  goals: SaleGoal[];
  userRole: UserRole;
  userId: string;
  setView: (v: ViewState) => void;
  onSelectAuditSeller?: (sellerId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  sales,
  baskets,
  stock,
  team,
  deliveries,
  installments,
  dailyClosings,
  goals = [],
  userRole,
  userId,
  setView,
  onSelectAuditSeller,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  // Today's active sales (excluding cancelled)
  const todaySales = useMemo(() =>
    sales.filter(s =>
      s.createdAt >= todayTimestamp &&
      s.status !== OrderStatus.CANCELLED &&
      (userRole === 'gerente' || s.sellerId === userId)
    ),
    [sales, todayTimestamp, userRole, userId]
  );

  // Determine effective period: Active Goal OR Current Month
  const { dateRange, goalName, goalAmount, isGoalActive } = useMemo(() => {
    const now = Date.now();

    // 1. Try to find an active goal for the seller
    const individual = goals.find(g =>
      g.type === 'vendedor' &&
      g.sellerId === userId &&
      !g.isCancelled &&
      now >= g.startDate &&
      now <= g.endDate
    );

    // 2. Try to find a general active goal
    const general = goals.find(g =>
      g.type === 'geral' &&
      !g.isCancelled &&
      now >= g.startDate &&
      now <= g.endDate
    );

    const active = individual || general;

    if (active) {
      return {
        dateRange: { start: active.startDate, end: active.endDate },
        goalName: active.name || (active.type === 'vendedor' ? 'Meta Individual' : 'Meta Geral'),
        goalAmount: active.amount,
        isGoalActive: true
      };
    }

    // 3. Fallback: Current Month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    return {
      dateRange: { start: startOfMonth.getTime(), end: endOfMonth.getTime() },
      goalName: 'Sem Meta Ativa',
      goalAmount: 0, // No target
      isGoalActive: false
    };
  }, [goals, userId]);

  const goalPeriodLabel = `${new Date(dateRange.start).toLocaleDateString('pt-BR')} até ${new Date(dateRange.end).toLocaleDateString('pt-BR')}`;

  const periodSales = useMemo(() => {
    return sales.filter(s =>
      s.createdAt >= dateRange.start &&
      s.createdAt <= dateRange.end &&
      s.status !== OrderStatus.CANCELLED &&
      (userRole === 'gerente' || s.sellerId === userId)
    );
  }, [dateRange, sales, userId, userRole]);

  const totalSold = periodSales.reduce((acc, s) => acc + s.total, 0);
  const remainingAmount = isGoalActive ? Math.max(0, goalAmount - totalSold) : 0;

  // Calculate percentage
  const percentage = isGoalActive
    ? Math.min(100, Math.round((totalSold / goalAmount) * 100))
    : 0;

  // Breakdown by channel (for stats, if needed)
  const onlineSold = periodSales.filter(s => s.channel === 'online').reduce((acc, s) => acc + s.total, 0);
  const offlineSold = periodSales.filter(s => s.channel === 'presencial').reduce((acc, s) => acc + s.total, 0);

  // Unused but kept for structure compatibility if needed down the line
  // Calculate stats for display if needed involves more logic, but for now we focus on the main card.
  // The 'statusMeta', 'onlineStatus', 'presentialStatus' were used in the old sales card.
  // Since we replaced the sales card, we can remove or simplify these.
  const statusMeta = percentage;

  // Note: These detailed breakdowns by channel vs meta are not currently displayed in the new design
  // but we keep the variables to avoid breaking other parts if they are used elsewhere (they seem unused based on previous read).
  const onlineStatus = 0;
  const presentialStatus = 0;

  // Pending counts
  const pendingDeliveries = deliveries.filter(d =>
    d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.ASSIGNED
  ).length;

  const overdueInstallments = installments.filter(i => {
    const sale = sales.find(s => s.id === i.saleId);
    return i.status === InstallmentStatus.PENDING && 
           i.dueDate < Date.now() && 
           sale?.status !== OrderStatus.CANCELLED;
  }).length;

  const pendingClosings = dailyClosings.filter(c => c.status === ClosingStatus.PENDING).length;

  const cancellationRequests = sales.filter(s => s.status === OrderStatus.CANCELLATION_REQUESTED).length;

  // ==========================================
  // FINANCIAL OVERVIEW (Manager only)
  // ==========================================
  const financialOverview = useMemo(() => {
    if (userRole !== 'gerente') return null;

    // -------------------------------------------------------------------
    // FINANCIAL CALCULATIONS (Managerial View: Matching BI Logic)
    // -------------------------------------------------------------------
    
    // 1. Identify all sales accounted for in validated closings (Approved or Pending)
    const validClosings = dailyClosings.filter(c => c.status === ClosingStatus.APPROVED || c.status === ClosingStatus.PENDING);
    const closedSaleIds = new Set<string>();
    const closedInstIds = new Set<string>();
    validClosings.forEach(c => {
      (c.salesIds || []).forEach(id => closedSaleIds.add(id));
      (c.installmentIds || []).forEach(id => closedInstIds.add(id));
    });

    // 2. Identify all active sales (excluding cancelled)
    const activeSalesInternal = sales.filter(s => s.status !== OrderStatus.CANCELLED);
    const totalSoldAll = activeSalesInternal.reduce((acc, s) => acc + (s.total || 0), 0);

    // 3. To Receive = (Cash Sales not in Closings) + (Unpaid installments for active sales)
    const unclosedCashSales = activeSalesInternal.filter(s => 
      s.paymentMethod !== PaymentMethod.TERM && !closedSaleIds.has(s.id)
    );
    const totalUnclosedCash = unclosedCashSales.reduce((acc, s) => acc + (s.total || 0), 0);

    const activeSaleIds = new Set(activeSalesInternal.map(s => s.id));
    const pendingInstallmentsArr = installments.filter(i => 
      i.status === InstallmentStatus.PENDING && activeSaleIds.has(i.saleId)
    );
    const totalInstallmentsPending = pendingInstallmentsArr.reduce((acc, i) => acc + (i.amount || 0), 0);

    // 4. Detailed Breakdown (Fixing duplication)
    
    // Settled at headquarters (Approved/Pending accountings)
    // This value already includes any installments that were part of these closings.
    const recebidoCentral = validClosings.reduce((acc, c) => acc + (c.cashAmount || 0) + (c.cardAmount || 0) + (c.pixAmount || 0), 0);
    const closedAmount = recebidoCentral; 

    // With Sellers (Money received from customers but NOT yet in an HQ accounting)
    const unclosedCashSalesAmount = activeSalesInternal.filter(s => 
      s.paymentMethod !== PaymentMethod.TERM && !closedSaleIds.has(s.id)
    ).reduce((acc, s) => acc + (s.total || 0), 0);

    const unclosedPaidInstallmentsAmount = installments.filter(i => 
      i.status === InstallmentStatus.PAID && activeSaleIds.has(i.saleId) && !closedInstIds.has(i.id)
    ).reduce((acc, i) => acc + (i.amount || 0), 0);

    const dinheiroEmMaos = unclosedCashSalesAmount + unclosedPaidInstallmentsAmount;

    // Remaining with Customers (Debt)
    const pendingInstallmentsAmount = installments.filter(i => 
      i.status === InstallmentStatus.PENDING && activeSaleIds.has(i.saleId)
    ).reduce((acc, i) => acc + (i.amount || 0), 0);

    // Final Top-Level Indicators
    const saldoAReceber = dinheiroEmMaos + pendingInstallmentsAmount;
    
    // Balanced Total (Should match sum(activeSalesInternal.total))
    const balancedTotal = recebidoCentral + saldoAReceber;

    // 5. Overdue Installments
    const overdueInstallmentsArr = pendingInstallmentsArr.filter(i => i.dueDate < Date.now());
    const totalOverdue = overdueInstallmentsArr.reduce((acc, i) => acc + (i.amount || 0), 0);
    const countOverdue = overdueInstallmentsArr.length;

    // Per-seller accountability
    const sellerMap = new Map<string, { name: string; unclosedTotal: number; unclosedCount: number }>();
    const saleInfoMap = new Map<string, { sellerId?: string, sellerName?: string }>(
      activeSalesInternal.map(s => [s.id, { sellerId: s.sellerId, sellerName: s.sellerName }])
    );

    // 1. Unclosed Cash Sales
    activeSalesInternal.forEach(sale => {
      if (!sale.sellerId || sale.paymentMethod === PaymentMethod.TERM || closedSaleIds.has(sale.id)) return;
      
      const existing = sellerMap.get(sale.sellerId);
      if (existing) {
        existing.unclosedTotal += sale.total;
        existing.unclosedCount += 1;
      } else {
        sellerMap.set(sale.sellerId, {
          name: sale.sellerName || 'Vendedor',
          unclosedTotal: sale.total,
          unclosedCount: 1,
        });
      }
    });

    // 2. Unclosed Paid Installments
    installments.forEach(i => {
      if (i.status === InstallmentStatus.PAID && activeSaleIds.has(i.saleId) && !closedInstIds.has(i.id)) {
        const saleInfo = saleInfoMap.get(i.saleId);
        if (!saleInfo || !saleInfo.sellerId) return;

        const existing = sellerMap.get(saleInfo.sellerId);
        if (existing) {
          existing.unclosedTotal += i.amount;
          existing.unclosedCount += 1;
        } else {
          sellerMap.set(saleInfo.sellerId, {
            name: saleInfo.sellerName || 'Vendedor',
            unclosedTotal: i.amount,
            unclosedCount: 1,
          });
        }
      }
    });

    const sellerAccountability = Array.from(sellerMap.values())
      .filter(s => s.unclosedTotal > 0)
      .sort((a, b) => b.unclosedTotal - a.unclosedTotal);

    return {
      totalSoldAll,
      recebidoCentral,
      saldoAReceber: totalSoldAll - recebidoCentral,
      closedAmount,
      totalUnclosedCash: dinheiroEmMaos,
      totalInstallmentsPending: pendingInstallmentsAmount,
      totalOverdue,
      countOverdue,
      receivedPercent: totalSoldAll > 0 ? Math.min(100, Math.round((recebidoCentral / totalSoldAll) * 100)) : 0,
      sellerAccountability,
    };
  }, [sales, dailyClosings, installments, userRole]);

  // Low stock items
  const lowStockItems = baskets.filter(b => {
    const qty = getStockQuantity(stock, b.id);
    return b.active && qty < 50;
  });

  // Active team members
  const activeVendedores = team.filter(t => t.role === 'vendedor' && t.status === 'ativo').length;
  const activeEntregadores = team.filter(t => t.role === 'entregador' && t.status === 'ativo').length;

  // Carousel State for featured products
  const [currentSlide, setCurrentSlide] = useState(0);
  const featuredBaskets = baskets.filter(b => b.active).slice(0, 4);

  useEffect(() => {
    if (featuredBaskets.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % featuredBaskets.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [featuredBaskets.length]);

  // Modal state
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.PENDING: return { label: 'Pendente', color: 'bg-yellow-500', text: 'text-yellow-600' };
      case OrderStatus.CONFIRMED: return { label: 'Confirmado', color: 'bg-blue-500', text: 'text-blue-600' };
      case OrderStatus.DELIVERED: return { label: 'Entregue', color: 'bg-success', text: 'text-success' };
      case OrderStatus.CANCELLED: return { label: 'Cancelado', color: 'bg-danger', text: 'text-danger' };
      case OrderStatus.CANCELLATION_REQUESTED: return { label: 'Solicit. Cancel.', color: 'bg-orange-500', text: 'text-orange-600' };
      default: return { label: status, color: 'bg-slate-400', text: 'text-slate-500' };
    }
  };

  // Render based on role
  if (userRole === 'cliente') {
    return (
      <div className="p-4 space-y-6">
        <div className="text-center py-8">
          <span className="material-symbols-outlined text-6xl text-primary mb-4">waving_hand</span>
          <h2 className="text-2xl font-black">Bem-vindo!</h2>
          <p className="text-slate-500 mt-2">Explore nossas cestas básicas</p>
          <button
            onClick={() => setView('customer-store')}
            className="mt-6 px-8 py-4 bg-primary text-white font-bold rounded-xl"
          >
            Ver Produtos
          </button>
        </div>
      </div>
    );
  }

  if (userRole === 'entregador') {
    const myDeliveries = deliveries.filter(d =>
      d.status === DeliveryStatus.ASSIGNED || d.status === DeliveryStatus.IN_ROUTE
    );

    return (
      <div className="p-4 space-y-6">
        <h2 className="text-xl font-bold">Minhas Entregas</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-yellow-500 text-white p-4 rounded-2xl">
            <p className="text-3xl font-black">{myDeliveries.length}</p>
            <p className="text-sm opacity-80">Pendentes</p>
          </div>
          <div className="bg-success text-white p-4 rounded-2xl">
            <p className="text-3xl font-black">
              {deliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length}
            </p>
            <p className="text-sm opacity-80">Entregues Hoje</p>
          </div>
        </div>

        <button
          onClick={() => setView('deliveries')}
          className="w-full py-4 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">local_shipping</span>
          Ver Entregas
        </button>
      </div>
    );
  }

  // Gerente or Vendedor Dashboard
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-32">
      {/* Featured Products Carousel */}
      {userRole === 'gerente' && featuredBaskets.length > 0 && (
        <section className="px-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 dark:text-white text-lg font-bold">Destaques</h3>
            <button
              onClick={() => setView('stock')}
              className="text-xs font-semibold text-primary dark:text-blue-400 cursor-pointer hover:underline"
            >
              Ver estoque
            </button>
          </div>

          <div className="relative overflow-hidden rounded-3xl shadow-xl">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {featuredBaskets.map((basket) => (
                <div key={basket.id} className="flex-none w-full relative">
                  <div className="relative h-40 w-full">
                    <img src={basket.image} alt={basket.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute inset-0 flex flex-col justify-end p-6">
                      <div className={`self-start px-3 py-1 rounded-full text-xs font-bold mb-3 ${getStockQuantity(stock, basket.id) > 50 ? 'bg-success/90 text-white' : 'bg-danger/90 text-white'
                        }`}>
                        {getStockQuantity(stock, basket.id)} em estoque
                      </div>
                      <h4 className="text-white text-xl font-extrabold">{basket.name}</h4>
                      <p className="text-secondary text-xl font-black mt-2">
                        {formatCurrency(basket.price)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {featuredBaskets.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`transition-all duration-300 rounded-full ${idx === currentSlide ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/50'
                    }`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sales Summary Frame */}
      <section className="px-4">
        <div className="bg-gradient-to-br from-primary to-blue-600 text-white p-5 rounded-3xl shadow-xl shadow-primary/20">

          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="material-symbols-outlined text-white/80 text-sm">
                  {isGoalActive ? 'flag' : 'calendar_today'}
                </span>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">{goalName}</p>
              </div>
              <p className="text-[9px] opacity-70 font-medium bg-black/10 px-2 py-0.5 rounded-lg inline-block">
                {goalPeriodLabel}
              </p>
            </div>
            {isGoalActive && (
              <div className="size-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <span className="font-black text-sm">{percentage}%</span>
              </div>
            )}
          </div>

          {/* Main Number */}
          <div className="mb-4">
            <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-0.5">Vendido</p>
            <p className="text-3xl font-black tracking-tight">
              {formatCurrency(totalSold)}
            </p>
          </div>

          {/* Progress Bar */}
          {isGoalActive && (
            <div className="mb-4">
              <div className="h-2 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${percentage}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-y-3 pt-3 border-t border-white/10">
            {/* Breakdown Row */}
            <div>
              <div className="flex items-center gap-1.5 opacity-60 mb-0.5">
                <p className="text-[9px] font-bold uppercase">Online</p>
                {isGoalActive && <span className="text-[9px] font-black bg-white/20 px-1 rounded">{((onlineSold / goalAmount) * 100).toFixed(1)}%</span>}
              </div>
              <p className="text-sm font-black">
                R$ {onlineSold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 opacity-60 mb-0.5">
                {isGoalActive && <span className="text-[9px] font-black bg-white/20 px-1 rounded">{((offlineSold / goalAmount) * 100).toFixed(1)}%</span>}
                <p className="text-[9px] font-bold uppercase">Presencial</p>
              </div>
              <p className="text-sm font-black">
                R$ {offlineSold.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {isGoalActive && (
              <div className="col-span-2 border-t border-white/10 pt-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase opacity-60 mb-0.5">Meta Total</p>
                    <p className="text-md font-black">
                      {formatCurrency(goalAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase opacity-60 mb-0.5">Falta</p>
                    <p className="text-md font-black text-white">
                      {formatCurrency(remainingAmount)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Quick Actions for Vendedor */}
      {userRole === 'vendedor' && (
        <section className="px-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setView('presential-sale')}
              className="p-4 bg-success text-white rounded-2xl flex flex-col items-center gap-2"
            >
              <span className="material-symbols-outlined text-3xl">point_of_sale</span>
              <span className="font-bold text-sm">Nova Venda</span>
            </button>
            <button
              onClick={() => setView('installments')}
              className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2"
            >
              <span className="material-symbols-outlined text-3xl text-primary">credit_score</span>
              <span className="font-bold text-sm">Parcelas</span>
            </button>
            <button
              onClick={() => setView('receivables')}
              className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-2"
            >
              <span className="material-symbols-outlined text-3xl text-warning">calendar_month</span>
              <span className="font-bold text-sm">Gestão de Cobrança</span>
            </button>
          </div>

          {/* New: Seller Deliveries summary */}
          {deliveries.filter(d => d.driverId === userId && (d.status === DeliveryStatus.ASSIGNED || d.status === DeliveryStatus.IN_ROUTE)).length > 0 && (
            <button
              onClick={() => setView('deliveries')}
              className="w-full bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 bg-yellow-500/10 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-yellow-600">local_shipping</span>
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm">Minhas Entregas</p>
                  <p className="text-xs text-slate-500">{deliveries.filter(d => d.driverId === userId && (d.status === DeliveryStatus.ASSIGNED || d.status === DeliveryStatus.IN_ROUTE)).length} pendente(s)</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
            </button>
          )}
        </section>
      )}

      {/* Stats Grid for Gerente */}
      {userRole === 'gerente' && (
        <section className="px-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('deliveries')}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-yellow-500">local_shipping</span>
                {pendingDeliveries > 0 && (
                  <span className="size-6 bg-yellow-500 text-white text-[10px] font-black rounded-lg flex items-center justify-center animate-bounce">
                    {pendingDeliveries}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black">{pendingDeliveries}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Entregas Pendentes</p>
            </button>

            <button
              onClick={() => setView('closing-approval')}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
                {pendingClosings > 0 && (
                  <span className="size-6 bg-primary text-white text-[10px] font-black rounded-lg flex items-center justify-center animate-pulse">
                    {pendingClosings}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black">{pendingClosings}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Caixas Pendentes</p>
            </button>

            <button
              onClick={() => setView('receivables')}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-danger">warning</span>
                {overdueInstallments > 0 && (
                  <span className="size-6 bg-danger text-white text-[10px] font-black rounded-lg flex items-center justify-center">
                    {overdueInstallments}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black">{overdueInstallments}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Parcelas Atrasadas</p>
            </button>

            <button
              onClick={() => setView('installments')}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-primary">credit_score</span>
              </div>
              <p className="text-2xl font-black">{installments.filter(i => i.status === InstallmentStatus.PENDING).length}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Parcelas Pendentes</p>
            </button>

            <button
              onClick={() => setView('sales-list')}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-orange-500">pending_actions</span>
                {cancellationRequests > 0 && (
                  <span className="size-6 bg-orange-500 text-white text-[10px] font-black rounded-lg flex items-center justify-center animate-bounce">
                    {cancellationRequests}
                  </span>
                )}
              </div>
              <p className="text-2xl font-black">{cancellationRequests}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Solicit. Cancelamento</p>
            </button>

            <button
              onClick={() => setView('team')}
              className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-success">group</span>
              </div>
              <p className="text-2xl font-black">{activeVendedores + activeEntregadores}</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">Equipe Ativa</p>
            </button>

            <button
              onClick={() => setView('users-management')}
              className="bg-slate-900 dark:bg-white p-4 rounded-2xl border border-transparent text-left active:scale-[0.98] transition-all shadow-lg"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-white dark:text-slate-900">manage_accounts</span>
              </div>
              <p className="text-2xl font-black text-white dark:text-slate-900">Controle</p>
              <p className="text-[10px] font-bold text-white/60 dark:text-slate-400 mt-0.5 uppercase tracking-tighter">Acessos e Cargos</p>
            </button>
          </div>
        </section>
      )}

      {/* ==========================================
          FINANCIAL OVERVIEW SECTION (Gerente only)
         ========================================== */}
      {userRole === 'gerente' && financialOverview && (
        <section className="px-4 space-y-4">
          {/* Financial Summary Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-xl shadow-emerald-600/20">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <div className="size-9 bg-white/15 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold">Resumo Financeiro</h3>
                <p className="text-[9px] opacity-70 font-medium uppercase tracking-widest">Visão geral de recebimentos</p>
              </div>
            </div>

            {/* Main Numbers */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mb-0.5">Recebido (Central)</p>
                <p className="text-xl font-black tracking-tight">
                  {formatCurrency(financialOverview.recebidoCentral)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mb-0.5">Saldo a Receber</p>
                <p className="text-xl font-black tracking-tight text-yellow-300">
                  {formatCurrency(financialOverview.saldoAReceber)}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-[9px] font-bold opacity-70 mb-1">
                <span>{financialOverview.receivedPercent}% recebido</span>
                <span>Total: {formatCurrency(financialOverview.totalSoldAll)}</span>
              </div>
              <div className="h-2.5 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${financialOverview.receivedPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Pillars Grid */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
              {/* Pillar 1: Installments */}
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-[14px] opacity-70">calendar_month</span>
                  <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Vendas Parceladas</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-end">
                    <p className="text-[8px] font-medium opacity-60">A Receber</p>
                    <p className="text-xs font-black">{formatCurrency(financialOverview.totalInstallmentsPending)}</p>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/5 pt-1">
                    <p className="text-[8px] font-bold text-red-300 uppercase">Em Atraso</p>
                    <p className="text-xs font-black text-red-300">{formatCurrency(financialOverview.totalOverdue)}</p>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Accounts (Sellers) */}
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-[14px] opacity-70">person_check</span>
                  <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Contas Vendedores</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-end">
                    <p className="text-[8px] font-medium opacity-60">Pagas (Central)</p>
                    <p className="text-xs font-black text-emerald-300">{formatCurrency(financialOverview.closedAmount)}</p>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/5 pt-1">
                    <p className="text-[8px] font-bold text-yellow-300 uppercase">Em Mãos</p>
                    <p className="text-xs font-black text-yellow-300">{formatCurrency(financialOverview.totalUnclosedCash)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seller Accountability List */}
          {financialOverview.sellerAccountability.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-8 bg-orange-500/10 rounded-xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-600 text-lg">assignment_ind</span>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Prestação de Contas</h4>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Vendas sem fechamento</p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {financialOverview.sellerAccountability.slice(0, 5).map((seller, idx) => (
                  <div
                    key={idx}
                    className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-9 bg-primary/10 rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-base">person</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{seller.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">
                          {seller.unclosedCount} venda{seller.unclosedCount !== 1 ? 's' : ''} pendente{seller.unclosedCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-sm text-orange-600">
                        {formatCurrency(seller.unclosedTotal)}
                      </p>
                      <button
                        onClick={() => {
                           if (onSelectAuditSeller) {
                             onSelectAuditSeller(seller.id);
                             setView('seller-audit');
                           }
                        }}
                        className="size-8 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Ver Extrato"
                      >
                        <span className="material-symbols-outlined text-lg">receipt_long</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 pb-4 pt-2">
                <button
                  onClick={() => setView('closing-approval')}
                  className="w-full py-3 bg-orange-500/10 text-orange-600 font-bold rounded-2xl text-xs uppercase tracking-widest active:scale-95 transition-all"
                >
                  Ver Fechamentos
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Low Stock Alert */}
      {userRole === 'gerente' && lowStockItems.length > 0 && (
        <section className="px-4">
          <div className="bg-danger/10 border border-danger/20 rounded-[24px] p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 bg-danger text-white rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">inventory_2</span>
              </div>
              <h4 className="font-extrabold text-danger text-lg">Estoque Baixo</h4>
            </div>
            <div className="space-y-3 mb-4">
              {lowStockItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm py-2 border-b border-danger/10 last:border-0">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                  <span className="font-black text-danger bg-danger/10 px-2 py-0.5 rounded-md">{getStockQuantity(stock, item.id)} un.</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setView('stock-entry')}
              className="w-full py-4 bg-danger text-white font-black rounded-2xl shadow-lg shadow-danger/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
            >
              Adicionar Estoque
            </button>
          </div>
        </section>
      )}


      {/* Recent Sales */}
      <section className="px-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Vendas Recentes</h3>
          <button
            onClick={() => setView('sales-list')}
            className="text-xs font-semibold text-primary"
          >
            Ver todas
          </button>
        </div>
        {todaySales.length === 0 ? (
          <p className="text-center text-slate-500 py-6">Nenhuma venda hoje</p>
        ) : (
          <div className="space-y-3">
            {todaySales.slice(0, 3).map(sale => (
              <div
                key={sale.id}
                onClick={() => setSelectedSale(sale)}
                className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <span className={`material-symbols-outlined text-lg ${getStatusConfig(sale.status).text}`}>
                      {sale.status === OrderStatus.CANCELLATION_REQUESTED ? 'warning' : 'receipt'}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 dark:text-white leading-tight">{sale.customerName}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                      {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      {' • '}{sale.channel}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-primary text-sm">{formatCurrency(sale.total)}</p>
                  <p className={`text-[9px] font-black uppercase tracking-tighter ${getStatusConfig(sale.status).text}`}>
                    {getStatusConfig(sale.status).label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Detailed Order Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSale(null)} />

          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-10 duration-500">
            {/* Modal Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Detalhes do Pedido</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">#{selectedSale.id.slice(0, 12)}</p>
                  <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase text-white ${getStatusConfig(selectedSale.status).color}`}>
                    {getStatusConfig(selectedSale.status).label}
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

            <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-8 no-scrollbar scrollbar-hide">
              {/* Products Section */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Itens do Pedido</h4>
                <div className="space-y-4">
                  {selectedSale.items.map((item, idx) => {
                    const model = baskets.find(m => m.id === item.basketModelId);
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
                          {model?.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                              {model.description}
                            </p>
                          )}
                          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">{formatCurrency(item.unitPrice)} unit.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Customer & Payment Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cliente</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">{selectedSale.customerName}</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">{selectedSale.channel.toUpperCase()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pagamento</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">payments</span>
                    <p className="text-sm font-black text-slate-900 dark:text-white">{selectedSale.paymentMethod}</p>
                  </div>
                  <p className="text-xs font-black text-primary mt-1">Total {formatCurrency(selectedSale.total)}</p>
                </div>
              </div>
            </div>

            <div className="p-8 pb-10 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setView('sales-list')}
                className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-black rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest"
              >
                Ver Histórico Completo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
