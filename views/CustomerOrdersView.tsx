import React, { useState } from 'react';
import { ViewState, Sale, Delivery, OrderStatus, DeliveryStatus, BasketModel } from '../types';

interface CustomerOrdersViewProps {
    sales: Sale[];
    deliveries: Delivery[];
    basketModels: BasketModel[];
    customerId: string;
    onCancelOrder: (saleId: string, status: OrderStatus) => Promise<void>;
    setView: (v: ViewState) => void;
}

const CustomerOrdersView: React.FC<CustomerOrdersViewProps> = ({
    sales,
    deliveries,
    basketModels,
    customerId,
    onCancelOrder,
    setView,
}) => {
    const [filterRange, setFilterRange] = React.useState<'30' | '90' | 'all' | 'custom'>('all');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'completed' | 'cancelled'>('all');
    const [customDates, setCustomDates] = React.useState({ start: '', end: '' });
    const [showCustomPicker, setShowCustomPicker] = React.useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

    const filteredSales = sales
        .filter(s => {
            if (s.customerId !== customerId) return false;

            // 1. Date Filter
            const saleDate = s.createdAt;
            const now = Date.now();
            let dateMatch = true;

            if (filterRange === '30') {
                dateMatch = (now - saleDate) <= 30 * 24 * 60 * 60 * 1000;
            } else if (filterRange === '90') {
                dateMatch = (now - saleDate) <= 90 * 24 * 60 * 60 * 1000;
            } else if (filterRange === 'custom' && customDates.start && customDates.end) {
                const start = new Date(customDates.start).getTime();
                const end = new Date(customDates.end).getTime() + (24 * 60 * 60 * 1000 - 1);
                dateMatch = saleDate >= start && saleDate <= end;
            }

            if (!dateMatch) return false;

            // 2. Status Filter
            if (statusFilter === 'all') return true;
            if (statusFilter === 'pending') {
                return [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.IN_DELIVERY, OrderStatus.CANCELLATION_REQUESTED].includes(s.status);
            }
            if (statusFilter === 'completed') {
                return s.status === OrderStatus.DELIVERED;
            }
            if (statusFilter === 'cancelled') {
                return s.status === OrderStatus.CANCELLED;
            }

            return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt);

    const getDelivery = (saleId: string) => deliveries.find(d => d.saleId === saleId);

    const getStatusConfig = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.PENDING:
                return { color: 'bg-yellow-500', icon: 'schedule', label: 'Aguardando' };
            case OrderStatus.CONFIRMED:
                return { color: 'bg-blue-500', icon: 'check_circle', label: 'Confirmado' };
            case OrderStatus.IN_DELIVERY:
                return { color: 'bg-primary', icon: 'local_shipping', label: 'Em Entrega' };
            case OrderStatus.DELIVERED:
                return { color: 'bg-success', icon: 'done_all', label: 'Entregue' };
            case OrderStatus.CANCELLED:
                return { color: 'bg-danger', icon: 'cancel', label: 'Cancelado' };
            case OrderStatus.CANCELLATION_REQUESTED:
                return { color: 'bg-orange-500', icon: 'pending_actions', label: 'Cancelamento Solicitado' };
            default:
                return { color: 'bg-slate-500', icon: 'help', label: 'Desconhecido' };
        }
    };

    const getDeliveryStep = (delivery: Delivery | undefined) => {
        if (!delivery) return 0;
        switch (delivery.status) {
            case DeliveryStatus.PENDING: return 1;
            case DeliveryStatus.ASSIGNED: return 2;
            case DeliveryStatus.IN_ROUTE: return 3;
            case DeliveryStatus.DELIVERED: return 4;
            default: return 0;
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black">Meus Pedidos</h3>
                        <p className="text-xs text-slate-500 font-medium">{filteredSales.length} pedido(s) encontrados</p>
                    </div>
                    <div className="size-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-400">filter_list</span>
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="space-y-3">
                    {/* Period Row */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {[
                            { id: 'all', label: 'Todo Período' },
                            { id: '30', label: '30 dias' },
                            { id: '90', label: '90 dias' },
                            { id: 'custom', label: 'Personalizado' },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    setFilterRange(f.id as any);
                                    if (f.id === 'custom') setShowCustomPicker(!showCustomPicker);
                                    else setShowCustomPicker(false);
                                }}
                                className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-2 ${filterRange === f.id
                                    ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Status Row */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {[
                            { id: 'all', label: 'Todos Status' },
                            { id: 'pending', label: 'Aguardando' },
                            { id: 'completed', label: 'Concluídos' },
                            { id: 'cancelled', label: 'Cancelado' },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setStatusFilter(f.id as any)}
                                className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-2 ${statusFilter === f.id
                                    ? 'bg-slate-800 dark:bg-slate-100 border-slate-800 dark:border-slate-100 text-white dark:text-slate-900 shadow-lg'
                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Date Picker */}
                {showCustomPicker && filterRange === 'custom' && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-primary/20 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Início</label>
                                <input
                                    type="date"
                                    value={customDates.start}
                                    onChange={(e) => setCustomDates({ ...customDates, start: e.target.value })}
                                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-bold mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Fim</label>
                                <input
                                    type="date"
                                    value={customDates.end}
                                    onChange={(e) => setCustomDates({ ...customDates, end: e.target.value })}
                                    className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-bold mt-1"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {filteredSales.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                    <div className="size-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-5xl text-slate-400">receipt_long</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Nenhum Pedido</h3>
                    <p className="text-slate-500 mb-6">Você ainda não fez nenhuma compra.</p>
                    <button
                        onClick={() => setView('customer-store')}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-xl"
                    >
                        Fazer Pedido
                    </button>
                </div>
            ) : (
                <div className="flex-1 p-4 space-y-4 pb-32 overflow-y-auto pt-0">
                    {filteredSales.map((sale) => {
                        const statusConfig = getStatusConfig(sale.status);
                        const delivery = getDelivery(sale.id);
                        const deliveryStep = getDeliveryStep(delivery);

                        return (
                            <div
                                key={sale.id}
                                onClick={() => setSelectedSale(sale)}
                                className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer hover:border-primary/30"
                            >
                                {/* Summarized Info */}
                                <div className="size-14 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-slate-400">shopping_basket</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">#{sale.id.slice(0, 6)}</p>
                                        <div className={`${statusConfig.color} size-2 rounded-full`} />
                                    </div>
                                    <h4 className="font-bold text-sm truncate">
                                        {sale.items.length === 1
                                            ? sale.items[0].basketName
                                            : `${sale.items[0].basketName} + ${sale.items.length - 1} itens`}
                                    </h4>
                                    <p className="text-[11px] text-slate-500">
                                        {new Date(sale.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>

                                <div className="text-right">
                                    <p className="font-black text-primary text-sm">R$ {sale.total.toFixed(2)}</p>
                                    <p className={`text-[10px] font-bold ${statusConfig.color.replace('bg-', 'text-')}`}>
                                        {statusConfig.label}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detailed Modal */}
            {selectedSale && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSale(null)} />

                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 duration-500">
                        {/* Modal Header */}
                        <div className="p-6 pb-2 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black">Detalhes do Pedido</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">#{selectedSale.id.slice(0, 10)}</p>
                            </div>
                            <button
                                onClick={() => setSelectedSale(null)}
                                className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all text-slate-500"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
                            {/* Products */}
                            <div className="space-y-4">
                                {selectedSale.items.map((item, idx) => {
                                    const model = basketModels.find(m => m.id === item.basketModelId);
                                    return (
                                        <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 flex gap-4">
                                            {model?.image ? (
                                                <img src={model.image} alt={item.basketName} className="size-20 rounded-xl object-cover shadow-sm bg-white" />
                                            ) : (
                                                <div className="size-20 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-slate-400 text-3xl">shopping_basket</span>
                                                </div>
                                            )}
                                            <div className="flex-1 py-1">
                                                <p className="text-xs font-black text-primary uppercase tracking-widest mb-1">{item.quantity}x Unidade(s)</p>
                                                <h5 className="font-black text-slate-900 dark:text-white leading-tight mb-1">{item.basketName}</h5>
                                                {model?.description && (
                                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                                        {model.description}
                                                    </p>
                                                )}
                                                <p className="mt-2 font-bold text-sm text-slate-700 dark:text-slate-300">R$ {item.unitPrice.toFixed(2)} / cada</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Payment & Delivery Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pagamento</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-primary">payments</span>
                                        <p className="text-sm font-bold">{selectedSale.paymentMethod}</p>
                                    </div>
                                    <p className="text-xs font-black text-primary mt-1">Total R$ {selectedSale.total.toFixed(2)}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Canal</p>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-primary">{selectedSale.channel === 'online' ? 'language' : 'person'}</span>
                                        <p className="text-sm font-bold capitalize">{selectedSale.channel}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Local de Entrega</p>
                                <div className="flex items-start gap-2">
                                    <span className="material-symbols-outlined text-sm text-primary mt-0.5">location_on</span>
                                    <div>
                                        <p className="text-sm font-bold">{selectedSale.deliveryAddress || 'Retirada no Local'}, {selectedSale.deliveryNumber}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">Falar com: {selectedSale.deliveryContact || selectedSale.customerName}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tracking (if online) */}
                            {selectedSale.channel === 'online' && (
                                <div className="bg-primary/5 p-5 rounded-[24px] border border-primary/10">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-4">Acompanhamento em Tempo Real</p>
                                    <div className="flex items-center justify-between">
                                        {[
                                            { step: 1, icon: 'receipt', label: 'Pedido' },
                                            { step: 2, icon: 'inventory', label: 'Preparando' },
                                            { step: 3, icon: 'local_shipping', label: 'Caminho' },
                                            { step: 4, icon: 'home', label: 'Entregue' },
                                        ].map((s, idx) => {
                                            const delivery = getDelivery(selectedSale.id);
                                            const deliveryStep = getDeliveryStep(delivery);
                                            return (
                                                <React.Fragment key={s.step}>
                                                    <div className="flex flex-col items-center">
                                                        <div className={`size-10 rounded-full flex items-center justify-center mb-1.5 transition-all ${deliveryStep >= s.step
                                                            ? 'bg-success text-white shadow-lg shadow-success/20 scale-110'
                                                            : 'bg-white dark:bg-slate-700 text-slate-300'
                                                            }`}>
                                                            <span className="material-symbols-outlined text-lg">{s.icon}</span>
                                                        </div>
                                                        <span className={`text-[9px] font-black uppercase tracking-tighter ${deliveryStep >= s.step ? 'text-success' : 'text-slate-400'}`}>{s.label}</span>
                                                    </div>
                                                    {idx < 3 && (
                                                        <div className={`flex-1 h-1 mx-1 rounded-full ${deliveryStep > s.step ? 'bg-success' : 'bg-slate-100 dark:bg-slate-700'}`} />
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Cancel Button */}
                            {(selectedSale.status === OrderStatus.PENDING || selectedSale.status === OrderStatus.CONFIRMED) && (
                                <button
                                    onClick={async (e) => {
                                        const now = Date.now();
                                        const tenMinutes = 10 * 60 * 1000;
                                        const isWithinWindow = (now - selectedSale.createdAt) < tenMinutes;
                                        const isDirectCancel = selectedSale.status === OrderStatus.PENDING && isWithinWindow;

                                        const confirmMsg = isDirectCancel
                                            ? 'Deseja realmente cancelar este pedido agora?'
                                            : 'Este pedido já está sendo processado. Deseja enviar uma solicitação de cancelamento para o gerente?';

                                        if (confirm(confirmMsg)) {
                                            await onCancelOrder(
                                                selectedSale.id,
                                                isDirectCancel ? OrderStatus.CANCELLED : OrderStatus.CANCELLATION_REQUESTED
                                            );
                                            setSelectedSale(null);
                                        }
                                    }}
                                    className={`w-full py-4 border-2 font-black rounded-2xl transition-all flex items-center justify-center gap-2 ${(selectedSale.status === OrderStatus.PENDING && (Date.now() - selectedSale.createdAt) < 10 * 60 * 1000)
                                        ? 'border-danger/20 text-danger bg-danger/5 hover:bg-danger text-sm uppercase'
                                        : 'border-orange-500/20 text-orange-600 bg-orange-50/50 text-sm uppercase'
                                        }`}
                                >
                                    <span className="material-symbols-outlined">
                                        {(selectedSale.status === OrderStatus.PENDING && (Date.now() - selectedSale.createdAt) < 10 * 60 * 1000) ? 'cancel' : 'history_toggle_off'}
                                    </span>
                                    {(selectedSale.status === OrderStatus.PENDING && (Date.now() - selectedSale.createdAt) < 10 * 60 * 1000) ? 'Cancelar este Pedido' : 'Solicitar Cancelamento'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerOrdersView;
