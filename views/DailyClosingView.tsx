import React, { useState, useMemo } from 'react';
import { ViewState, Sale, PaymentMethod, DailyClosing, ClosingStatus, Installment, InstallmentStatus, Delivery, OrderStatus } from '../types';
import { generateId } from '../store';
import { formatCurrency } from '../utils';

interface DailyClosingViewProps {
    sales: Sale[];
    installments: Installment[];
    deliveries: Delivery[];
    dailyClosings: DailyClosing[];
    sellerId: string;
    sellerName: string;
    onCreateClosing: (closing: DailyClosing) => void;
    setView: (v: ViewState) => void;
    isReadOnly?: boolean;
}

const DailyClosingView: React.FC<DailyClosingViewProps> = ({
    sales,
    installments,
    deliveries,
    dailyClosings,
    sellerId,
    sellerName,
    onCreateClosing,
    setView,
    isReadOnly = false,
}) => {
    const [selectedSalesIds, setSelectedSalesIds] = useState<Set<string>>(new Set());
    const [selectedInstIds, setSelectedInstIds] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [notes, setNotes] = useState('');
    const [viewingClosing, setViewingClosing] = useState<DailyClosing | null>(null);
    const [activeFilter, setActiveFilter] = useState<'all' | 'received' | 'pending'>('received');

    // Closed IDs (Sales and Installments)
    const closedSalesIds = useMemo(() => {
        const ids = new Set<string>();
        dailyClosings
            .filter(c => c.status !== ClosingStatus.REJECTED)
            .forEach(c => c.salesIds?.forEach(id => ids.add(id)));
        return ids;
    }, [dailyClosings]);

    const closedInstIds = useMemo(() => {
        const ids = new Set<string>();
        dailyClosings
            .filter(c => c.status !== ClosingStatus.REJECTED)
            .forEach(c => c.installmentIds?.forEach(id => ids.add(id)));
        return ids;
    }, [dailyClosings]);

    // Available Sales (made by this seller OR online assigned to this seller, not closed OR term sales with balance)
    const availableSales = useMemo(() =>
        sales.filter(s => {
            // Check for direct attribution (Presencial) or Delivery attribution (Online)
            const isDirectSeller = s.sellerId === sellerId;
            const delivery = deliveries.find(d => d.saleId === s.id);
            const isAssignedDriver = delivery?.driverId === sellerId;

            if (!isDirectSeller && !isAssignedDriver) return false;
            if (s.status === OrderStatus.CANCELLED) return false;

            if (!closedSalesIds.has(s.id)) return true;
            if (s.paymentMethod === PaymentMethod.TERM) {
                // Keep term sales visible if they have any unpaid balance
                const hasUnpaid = installments.some(i => i.saleId === s.id && i.status !== InstallmentStatus.PAID && i.status !== InstallmentStatus.CANCELLED);
                return hasUnpaid;
            }
            return false;
        }).sort((a, b) => b.createdAt - a.createdAt),
        [sales, sellerId, closedSalesIds, installments, deliveries]
    );

    // Available Installments (paid to this seller, not closed)
    const availableInstallments = useMemo(() =>
        installments.filter(i => {
            const sale = sales.find(s => s.id === i.saleId);
            const delivery = deliveries.find(d => d.saleId === i.saleId);

            const isAssignedToMe = sale?.sellerId === sellerId || delivery?.driverId === sellerId;

            return i.status === InstallmentStatus.PAID &&
                isAssignedToMe &&
                !closedInstIds.has(i.id);
        }).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0)),
        [installments, closedInstIds, sales, sellerId, deliveries]
    );

    const pendingInstallments = useMemo(() =>
        installments.filter(i => {
            const sale = sales.find(s => s.id === i.saleId);
            const delivery = deliveries.find(d => d.saleId === i.saleId);
            const isAssignedToMe = sale?.sellerId === sellerId || delivery?.driverId === sellerId;
            return i.status === InstallmentStatus.PENDING && isAssignedToMe;
        }).sort((a, b) => a.dueDate - b.dueDate),
        [installments, sales, sellerId, deliveries]
    );

    const totals = useMemo(() => {
        const result = { total: 0, pix: 0, card: 0, cash: 0, totalPendingTerm: 0, selectedPendingTerm: 0 };

        // 1. Calculate PENDING term debt based on PENDING installments for THIS seller
        installments.forEach(i => {
            if (i.status !== InstallmentStatus.PAID) {
                const sale = sales.find(s => s.id === i.saleId);
                const delivery = deliveries.find(d => d.saleId === i.saleId);
                const isAssignedToMe = sale?.sellerId === sellerId || delivery?.driverId === sellerId;

                if (isAssignedToMe && i.status !== InstallmentStatus.CANCELLED) {
                    // Also check if the parent sale is not cancelled just in case
                    const saleStatus = sales.find(s => s.id === i.saleId)?.status;
                    if (saleStatus !== OrderStatus.CANCELLED) {
                        result.totalPendingTerm += i.amount;
                    }
                }
            }
        });

        // 2. Calculate totals from selected sales
        availableSales.forEach(s => {
            if (selectedSalesIds.has(s.id)) {
                if (s.paymentMethod === PaymentMethod.PIX) {
                    result.pix += s.total;
                    result.total += s.total;
                } else if (s.paymentMethod === PaymentMethod.CARD) {
                    result.card += s.total;
                    result.total += s.total;
                } else if (s.paymentMethod === PaymentMethod.TERM) {
                    result.selectedPendingTerm += s.total;
                } else {
                    result.cash += s.total;
                    result.total += s.total;
                }
            }
        });

        // 3. Calculate totals from selected paid installments
        availableInstallments.forEach(i => {
            if (selectedInstIds.has(i.id)) {
                const method = i.paymentMethod || PaymentMethod.ON_DELIVERY;
                if (method === PaymentMethod.PIX) {
                    result.pix += i.amount;
                } else if (method === PaymentMethod.CARD) {
                    result.card += i.amount;
                } else {
                    result.cash += i.amount;
                }
                result.total += i.amount;
            }
        });

        return result;
    }, [availableSales, availableInstallments, installments, selectedSalesIds, selectedInstIds]);

    const hasTermSaleSelected = useMemo(() => {
        return Array.from(selectedSalesIds).some(id => {
            const sale = sales.find(s => s.id === id);
            return sale?.paymentMethod === PaymentMethod.TERM;
        });
    }, [selectedSalesIds, sales]);

    const pendingApprovalAmount = useMemo(() => {
        return dailyClosings
            .filter(c => c.sellerId === sellerId && c.status === ClosingStatus.PENDING)
            .reduce((acc, c) => acc + (c.pixAmount || 0) + (c.cardAmount || 0) + (c.cashAmount || 0), 0);
    }, [dailyClosings, sellerId]);

    const handleSelectAll = () => {
        if (isReadOnly) return;
        const selectableSales = availableSales.filter(s => !closedSalesIds.has(s.id));
        if (selectedSalesIds.size === selectableSales.length && selectedInstIds.size === availableInstallments.length) {
            setSelectedSalesIds(new Set());
            setSelectedInstIds(new Set());
        } else {
            setSelectedSalesIds(new Set(selectableSales.map(s => s.id)));
            setSelectedInstIds(new Set(availableInstallments.map(i => i.id)));
        }
    };

    const toggleSale = (id: string) => {
        if (isReadOnly) return;
        const newSet = new Set(selectedSalesIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedSalesIds(newSet);
    };

    const toggleInst = (id: string) => {
        if (isReadOnly) return;
        const next = new Set(selectedInstIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedInstIds(next);
    };

    const handleSubmit = async () => {
        if (isReadOnly || (selectedSalesIds.size === 0 && selectedInstIds.size === 0)) return;
        if (hasTermSaleSelected) return;

        setIsSubmitting(true);
        try {
            const closing: DailyClosing = {
                id: '', // Store will generate
                sellerId,
                sellerName,
                closingDate: Date.now(),
                cashAmount: totals.cash,
                cardAmount: totals.card,
                pixAmount: totals.pix,
                installmentAmount: totals.selectedPendingTerm,
                receipts: [],
                salesIds: Array.from(selectedSalesIds).filter(id => !closedSalesIds.has(id)) as string[],
                installmentIds: Array.from(selectedInstIds),
                status: ClosingStatus.PENDING,
                notes: notes.trim() || undefined
            };

            await onCreateClosing(closing);
            setSelectedSalesIds(new Set());
            setSelectedInstIds(new Set());
            setNotes('');
            setIsConfirming(false);
        } catch (error) {
            console.error('Error submitting closing:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Previous closings
    const previousClosings = dailyClosings
        .filter(c => c.sellerId === sellerId)
        .sort((a, b) => b.closingDate - a.closingDate)
        .slice(0, 5);

    const getStatusConfig = (status: ClosingStatus) => {
        switch (status) {
            case ClosingStatus.PENDING:
                return { color: 'bg-yellow-500', label: 'Pendente' };
            case ClosingStatus.APPROVED:
                return { color: 'bg-success', label: 'Aprovado' };
            case ClosingStatus.REJECTED:
                return { color: 'bg-danger', label: 'Rejeitado' };
            default:
                return { color: 'bg-slate-500', label: 'Desconhecido' };
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
                    <div>
                        <h3 className="text-lg font-bold leading-tight">Fechamento de Caixa</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Preste contas do que recebeu hoje
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-4 pb-48 overflow-y-auto space-y-6 no-scrollbar">
                {/* Selection Summary */}
                <div className="bg-gradient-to-br from-primary to-blue-600 text-white p-6 rounded-3xl shadow-xl shadow-primary/20">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm opacity-80 font-bold uppercase tracking-widest">Total Líquido</p>
                            <p className="text-4xl font-black mt-1">{formatCurrency(totals.total)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs opacity-80 font-bold">
                                {selectedSalesIds.size + selectedInstIds.size} itens
                            </p>
                            {pendingApprovalAmount > 0 && (
                                <div className="mt-2 bg-white/20 px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1 inline-flex">
                                    <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
                                    <span className="text-[9px] font-black uppercase tracking-tight">{formatCurrency(pendingApprovalAmount)} Pendente</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-2 gap-y-4">
                        <div className="opacity-90">
                            <p className="text-[10px] opacity-60 uppercase font-black tracking-tighter">DINHEIRO / OUTROS</p>
                            <p className="text-lg font-black tracking-tight">{formatCurrency(totals.cash)}</p>
                        </div>
                        <div className="opacity-90">
                            <p className="text-[10px] opacity-60 uppercase font-black tracking-tighter">PIX</p>
                            <p className="text-lg font-black tracking-tight">{formatCurrency(totals.pix)}</p>
                        </div>
                        <div className="opacity-90">
                            <p className="text-[10px] opacity-60 uppercase font-black tracking-tighter">CARTÃO</p>
                            <p className="text-lg font-black tracking-tight">{formatCurrency(totals.card)}</p>
                        </div>
                        <div className="opacity-90 bg-white/10 p-2 rounded-xl border border-white/5">
                            <p className="text-[10px] opacity-60 uppercase font-black tracking-tighter text-blue-100">A RECEBER (PRAZO)</p>
                            <p className="text-lg font-black tracking-tight text-blue-50">{formatCurrency(totals.totalPendingTerm)}</p>
                        </div>
                    </div>
                </div>

                {/* Sales Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Transações</h4>
                        {!isReadOnly && (
                            <button
                                onClick={handleSelectAll}
                                className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-1 rounded-lg"
                            >
                                {selectedSalesIds.size === availableSales.length ? 'Limpar' : 'Tudo'}
                            </button>
                        )}
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        {[
                            { id: 'all', label: 'Tudo' },
                            { id: 'received', label: 'Recebido' },
                            { id: 'pending', label: 'A Receber' }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFilter(f.id as any)}
                                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                                    activeFilter === f.id
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-100 dark:border-slate-700'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {availableSales.filter(s => {
                        if (activeFilter === 'all') return true;
                        const isTerm = s.paymentMethod === PaymentMethod.TERM;
                        return activeFilter === 'received' ? !isTerm : isTerm;
                    }).length === 0 ? (
                        <p className="text-center py-4 text-xs text-slate-400 italic">Nenhuma venda nesta categoria</p>
                    ) : (
                        <div className="space-y-2">
                            {availableSales.filter(s => {
                                if (activeFilter === 'all') return true;
                                const isTerm = s.paymentMethod === PaymentMethod.TERM;
                                return activeFilter === 'received' ? !isTerm : isTerm;
                            }).map(sale => {
                                const isSelected = selectedSalesIds.has(sale.id);
                                const isTerm = sale.paymentMethod === PaymentMethod.TERM;

                                // Calculate debt details for term sales
                                let receivedAmount = 0;
                                if (isTerm) {
                                    receivedAmount = installments
                                        .filter(i => i.saleId === sale.id && i.status === InstallmentStatus.PAID)
                                        .reduce((acc, i) => acc + i.amount, 0);
                                }
                                const remainingBalance = sale.total - receivedAmount;

                                return (
                                    <button
                                        key={sale.id}
                                        onClick={() => toggleSale(sale.id)}
                                        disabled={isReadOnly}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected
                                            ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                                            } ${closedSalesIds.has(sale.id) ? 'opacity-80' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`size-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary scale-110' : 'border-slate-200 dark:border-slate-700'}`}>
                                                {isSelected && <span className="material-symbols-outlined text-white text-[16px] font-black">check</span>}
                                                {!isSelected && closedSalesIds.has(sale.id) && <span className="material-symbols-outlined text-slate-400 text-[14px]">history</span>}
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-sm font-black ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>{sale.customerName}</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${isTerm ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                                        {sale.paymentMethod}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        {new Date(sale.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {isTerm ? (
                                                <>
                                                    <p className={`font-black text-sm ${isSelected ? 'text-primary' : 'text-blue-600 dark:text-blue-400'}`}>
                                                        {formatCurrency(remainingBalance)}
                                                    </p>
                                                    <div className="flex flex-col items-end">
                                                        <p className="text-[8px] font-black text-blue-500 uppercase">A receber</p>
                                                        <p className="text-[8px] font-bold text-slate-400">Total: {formatCurrency(sale.total)}</p>
                                                        {receivedAmount > 0 && (
                                                            <p className="text-[8px] font-bold text-success">Pago: {formatCurrency(receivedAmount)}</p>
                                                        )}
                                                    </div>
                                                </>
                                            ) : (
                                                <p className={`font-black text-sm ${isSelected ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                                                    {formatCurrency(sale.total)}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Installments Section */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Parcelas Recebidas</h4>
                        <span className="text-[10px] font-bold text-slate-400">{availableInstallments.length} pendentes</span>
                    </div>

                    {availableInstallments.filter(i => {
                        if (activeFilter === 'pending') return false;
                        return true;
                    }).length === 0 && (activeFilter === 'received' || activeFilter === 'all') ? (
                        <p className="text-center py-4 text-xs text-slate-400 italic">Nenhuma parcela recebida pendente</p>
                    ) : (
                        <div className="space-y-2">
                            {availableInstallments.filter(i => {
                                if (activeFilter === 'pending') return false;
                                return true;
                            }).map(inst => {
                                const isSelected = selectedInstIds.has(inst.id);
                                const sale = sales.find(s => s.id === inst.saleId);
                                return (
                                    <button
                                        key={inst.id}
                                        onClick={() => toggleInst(inst.id)}
                                        disabled={isReadOnly}
                                        className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected
                                            ? 'border-success bg-success/5 dark:bg-success/10'
                                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`size-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-success border-success scale-110' : 'border-slate-200 dark:border-slate-700'}`}>
                                                {isSelected && <span className="material-symbols-outlined text-white text-[16px] font-black">check</span>}
                                            </div>
                                            <div className="text-left">
                                                <p className={`text-sm font-black ${isSelected ? 'text-success' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {sale?.customerName || 'Cliente'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-success/10 text-success rounded font-black uppercase tracking-tighter">
                                                        PARCELA PAGA
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        {inst.paidAt ? new Date(inst.paidAt).toLocaleDateString('pt-BR') : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className={`font-black text-sm ${isSelected ? 'text-success' : 'text-slate-900 dark:text-white'}`}>
                                            {formatCurrency(inst.amount)}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Pending Installments (Informational) */}
                    {(activeFilter === 'pending' || activeFilter === 'all') && pendingInstallments.length > 0 && (
                        <div className="space-y-2 mt-4">
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Parcelas a Receber</h5>
                            {pendingInstallments.map(inst => {
                                const sale = sales.find(s => s.id === inst.saleId);
                                const isOverdue = inst.dueDate < Date.now();
                                return (
                                    <div
                                        key={inst.id}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 opacity-70"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="size-6 rounded-lg border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-300">
                                                <span className="material-symbols-outlined text-[14px]">schedule</span>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                                    {sale?.customerName || 'Cliente'}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${isOverdue ? 'bg-danger/10 text-danger' : 'bg-slate-200 text-slate-500'}`}>
                                                        {isOverdue ? 'Atrasado' : 'Pendente'}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        Vence {new Date(inst.dueDate).toLocaleDateString('pt-BR')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="font-black text-sm text-slate-400">
                                            {formatCurrency(inst.amount)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Notes */}
                {(selectedSalesIds.size > 0 || selectedInstIds.size > 0) && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Observações</h4>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isReadOnly}
                            className="w-full h-24 p-4 rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 focus:border-primary focus:ring-0 transition-all resize-none text-sm"
                            placeholder="Algum detalhe importante sobre este acerto?"
                        />
                    </div>
                )}

                {/* Previous Closings */}
                {previousClosings.length > 0 && (
                    <div className="pt-6 space-y-4">
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Últimos Acertos</h4>
                        <div className="space-y-3">
                            {previousClosings.map(closing => {
                                const statusConfig = getStatusConfig(closing.status);
                                const total = (closing.pixAmount || 0) + (closing.cardAmount || 0) + (closing.cashAmount || 0);
                                return (
                                    <button
                                        key={closing.id}
                                        onClick={() => setViewingClosing(closing)}
                                        className="w-full bg-slate-50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between opacity-80 active:scale-[0.98] transition-all text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`size-2 rounded-full ${statusConfig.color} animate-pulse`} />
                                            <div>
                                                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                                    {new Date(closing.closingDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                </p>
                                                <p className="text-[9px] font-black uppercase tracking-tighter text-slate-400">
                                                    {statusConfig.label}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-slate-900 dark:text-white">{formatCurrency(total)}</p>
                                            <span className="material-symbols-outlined text-slate-300 text-sm">chevron_right</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Bar / Submit Button */}
            {(selectedSalesIds.size > 0 || selectedInstIds.size > 0) && !isReadOnly && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 animate-in slide-in-from-bottom-10 duration-500 z-50">
                    {hasTermSaleSelected ? (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border-2 border-amber-500/20 space-y-4 animate-in zoom-in-95">
                            <div className="flex items-center gap-3 text-amber-500">
                                <span className="material-symbols-outlined font-black">warning</span>
                                <p className="text-sm font-black uppercase tracking-tight">Ação Necessária</p>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                Você selecionou uma <span className="font-bold text-slate-900 dark:text-white inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-[10px] uppercase">venda parcelada</span>.
                                <br /><br />
                                Para prestar contas de recebimentos parcelados, você deve primeiro dar baixa no pagamento na tela de <span className="font-bold text-primary">Parcelado</span>.
                            </p>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => setView('installments')}
                                    className="w-full h-12 bg-amber-500 text-white font-black rounded-2xl active:scale-95 shadow-lg shadow-amber-500/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">payments</span>
                                    Ir para Parcelado
                                </button>
                                <button
                                    onClick={() => {
                                        const next = new Set(selectedSalesIds);
                                        availableSales.forEach(s => {
                                            if (s.paymentMethod === PaymentMethod.TERM) next.delete(s.id);
                                        });
                                        setSelectedSalesIds(next);
                                    }}
                                    className="w-full h-12 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold rounded-2xl active:scale-95 border-2 border-slate-100 dark:border-slate-600 text-[10px] uppercase tracking-widest"
                                >
                                    Deselecionar Vendas Parceladas
                                </button>
                            </div>
                            <p className="text-[10px] text-center text-slate-400 font-bold italic">
                                Ou desmarque as vendas parceladas para continuar este acerto.
                            </p>
                        </div>
                    ) : isConfirming ? (
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border-2 border-primary/20 space-y-6 animate-in zoom-in-95">
                            <div className="text-center">
                                <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-1">Confirmar Acerto</p>
                                <p className="text-4xl font-black text-primary">{formatCurrency(totals.total)}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-2">
                                    {selectedSalesIds.size + selectedInstIds.size} itens selecionados
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsConfirming(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 h-14 rounded-2xl border-2 border-slate-100 dark:border-slate-700 font-black text-sm active:scale-95 transition-all text-slate-500"
                                >
                                    VOLTAR
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="flex-1 h-14 bg-success text-white font-black rounded-2xl active:scale-95 shadow-xl shadow-success/20 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <span className="material-symbols-outlined animate-spin">refresh</span>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined">check_circle</span>
                                            CONFIRMAR
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsConfirming(true)}
                            className="w-full h-16 bg-primary text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all"
                        >
                            <span className="material-symbols-outlined">send</span>
                            FECHAR CAIXA ({selectedSalesIds.size + selectedInstIds.size})
                        </button>
                    )}
                </div>
            )}

            {/* Historical Closing Detail Modal */}
            {viewingClosing && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-slate-700">
                        <div className="px-6 py-5 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
                            <h3 className="font-black text-lg">Detalhes do Acerto</h3>
                            <button onClick={() => setViewingClosing(null)} className="size-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Fechamento</p>
                                    <p className="text-xl font-black text-primary">
                                        {new Date(viewingClosing.closingDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-sm ${viewingClosing.status === ClosingStatus.APPROVED ? 'bg-success' :
                                    viewingClosing.status === ClosingStatus.REJECTED ? 'bg-danger' : 'bg-amber-500'
                                    }`}>
                                    {getStatusConfig(viewingClosing.status).label}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Resumo Financeiro</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white dark:bg-slate-700/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Dinheiro</p>
                                        <p className="font-black text-sm">{formatCurrency(viewingClosing.cashAmount || 0)}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-700/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[9px] font-black text-slate-400 uppercase">PIX</p>
                                        <p className="font-black text-sm">{formatCurrency(viewingClosing.pixAmount || 0)}</p>
                                    </div>
                                    <div className="bg-white dark:bg-slate-700/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[9px] font-black text-slate-400 uppercase">Cartão</p>
                                        <p className="font-black text-sm">{formatCurrency(viewingClosing.cardAmount || 0)}</p>
                                    </div>
                                    <div className="bg-primary/5 p-3 rounded-2xl border border-primary/10">
                                        <p className="text-[9px] font-black text-primary uppercase">Total Acertado</p>
                                        <p className="font-black text-sm text-primary">{formatCurrency((viewingClosing.cashAmount || 0) + (viewingClosing.pixAmount || 0) + (viewingClosing.cardAmount || 0))}</p>
                                    </div>
                                </div>
                            </div>

                            {viewingClosing.notes && (
                                <div className={`p-5 rounded-2xl border-l-4 animate-in slide-in-from-left-2 duration-500 ${viewingClosing.status === ClosingStatus.REJECTED
                                    ? 'bg-danger/5 border-danger text-danger'
                                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-300 text-slate-600 dark:text-slate-300'
                                    }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined text-sm">
                                            {viewingClosing.status === ClosingStatus.REJECTED ? 'error' : 'mode_comment'}
                                        </span>
                                        <p className="text-[10px] font-black uppercase tracking-widest">
                                            {viewingClosing.status === ClosingStatus.REJECTED ? 'Motivo da Rejeição' : 'Observações'}
                                        </p>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed italic">
                                        "{viewingClosing.notes}"
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={() => setViewingClosing(null)}
                                className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-widest shadow-xl"
                            >
                                FECHAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyClosingView;
