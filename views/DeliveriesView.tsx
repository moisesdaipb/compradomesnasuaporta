import React, { useState, useMemo } from 'react';
import { ViewState, Delivery, DeliveryStatus, TeamMember, Customer, Sale, BasketModel, OrderStatus } from '../types';
import InvoiceModal from '../components/InvoiceModal';
import DeliveryDetailsModal from '../components/DeliveryDetailsModal';

interface DeliveriesViewProps {
    deliveries: Delivery[];
    team: TeamMember[];
    userRole: 'gerente' | 'vendedor' | 'entregador' | 'cliente';
    userId: string;
    onAssignDelivery: (deliveryId: string, driverId: string) => void;
    onUpdateStatus: (id: string, status: DeliveryStatus, notes?: string) => void;
    onCancelSale?: (saleId: string) => void;
    setView: (v: ViewState) => void;
    customers: Customer[];
    sales: Sale[];
    baskets: BasketModel[];
}

const DeliveriesView: React.FC<DeliveriesViewProps> = ({
    deliveries,
    team,
    userRole,
    userId,
    onAssignDelivery,
    onUpdateStatus,
    onCancelSale,
    setView,
    customers,
    sales,
    baskets,
}) => {
    const [filter, setFilter] = useState<'pending' | 'in_route' | 'delivered' | 'problem' | 'all'>('pending');
    const [dateRange, setDateRange] = useState<'all' | '30' | '60' | 'custom'>('all');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [showCustomPicker, setShowCustomPicker] = useState(false);

    const [assigningDelivery, setAssigningDelivery] = useState<string | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<{ customer: Customer; sale: Sale; basket: BasketModel } | null>(null);
    const [viewingDelivery, setViewingDelivery] = useState<Delivery | null>(null);

    const drivers = team.filter(t => (t.role === 'entregador' || t.role === 'vendedor') && t.status === 'ativo');

    // 1. Filter by User Role
    const roleFilteredDeliveries = useMemo(() => {
        return deliveries.filter(d => {
            const sale = sales.find(s => s.id === d.saleId);
            // Exclude if sale or delivery is cancelled (EXCEPT if delivery just has Problem status, we want to show it)
            if (d.status === DeliveryStatus.CANCELLED || sale?.status === OrderStatus.CANCELLED) return false;

            if (userRole === 'gerente') return true;
            if (userRole === 'entregador') return d.driverId === userId;
            if (userRole === 'vendedor') {
                return d.driverId === userId || sale?.sellerId === userId;
            }
            return d.driverId === userId;
        });
    }, [deliveries, sales, userRole, userId]);

    // 2. Filter by Date
    const dateFilteredDeliveries = useMemo(() => {
        return roleFilteredDeliveries.filter(d => {
            const date = d.createdAt;
            const now = Date.now();
            if (dateRange === '30') return (now - date) <= 30 * 24 * 60 * 60 * 1000;
            if (dateRange === '60') return (now - date) <= 60 * 24 * 60 * 60 * 1000;
            if (dateRange === 'custom' && customDates.start && customDates.end) {
                const start = new Date(customDates.start).getTime();
                const end = new Date(customDates.end).getTime() + 86400000; // Add 24 hours to include the end day
                return date >= start && date <= end;
            }
            return true;
        });
    }, [roleFilteredDeliveries, dateRange, customDates]);

    // 3. Filter by Tab (Status)
    const filteredDeliveries = useMemo(() => {
        return dateFilteredDeliveries
            .filter(d => {
                if (filter === 'all') return true;
                if (filter === 'pending') return d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.ASSIGNED;
                if (filter === 'in_route') return d.status === DeliveryStatus.IN_ROUTE;
                if (filter === 'delivered') return d.status === DeliveryStatus.DELIVERED;
                if (filter === 'problem') return d.status === DeliveryStatus.PROBLEM;
                return true;
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [dateFilteredDeliveries, filter]);


    const getStatusConfig = (status: DeliveryStatus) => {
        switch (status) {
            case DeliveryStatus.PENDING:
                return { color: 'bg-yellow-500', icon: 'schedule', label: 'Aguardando' };
            case DeliveryStatus.ASSIGNED:
                return { color: 'bg-blue-500', icon: 'person', label: 'Atribuída' };
            case DeliveryStatus.IN_ROUTE:
                return { color: 'bg-primary', icon: 'local_shipping', label: 'Em Rota' };
            case DeliveryStatus.DELIVERED:
                return { color: 'bg-success', icon: 'check_circle', label: 'Entregue' };
            case DeliveryStatus.PROBLEM:
                return { color: 'bg-danger', icon: 'error', label: 'Problema' };
            default:
                return { color: 'bg-slate-500', icon: 'help', label: 'Desconhecido' };
        }
    };

    const getNextStatus = (current: DeliveryStatus): DeliveryStatus | null => {
        switch (current) {
            case DeliveryStatus.ASSIGNED:
                return DeliveryStatus.IN_ROUTE;
            case DeliveryStatus.IN_ROUTE:
                return DeliveryStatus.DELIVERED;
            default:
                return null;
        }
    };

    const getNextStatusLabel = (current: DeliveryStatus): string => {
        switch (current) {
            case DeliveryStatus.ASSIGNED:
                return 'Iniciar Entrega';
            case DeliveryStatus.IN_ROUTE:
                return 'Confirmar Entrega';
            default:
                return '';
        }
    };

    const handleShowInvoice = (delivery: Delivery) => {
        const sale = sales.find(s => s.id === delivery.saleId);
        const customer = customers.find(c => c.id === delivery.customerId);
        const basket = baskets.find(b => b.id === sale?.basketModelId);

        if (sale && customer && basket) {
            setSelectedInvoice({ sale, customer, basket });
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Fixed Header Section */}
            <div className="flex-none bg-slate-50 dark:bg-slate-950 z-30 shadow-sm relative">
                {/* Header Title & Date Filters */}
                <header className="bg-white dark:bg-slate-900 px-4 py-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-4">
                        <button onClick={() => setView('dashboard')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Entregas</h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                {filteredDeliveries.length > 0
                                    ? `${filteredDeliveries.length} entregas listadas`
                                    : 'Nenhuma pendente'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Date Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide no-scrollbar">
                        {[
                            { id: 'all', label: 'Geral' },
                            { id: '30', label: '30 dias' },
                            { id: '60', label: '60 dias' },
                            { id: 'custom', label: 'Personalizado' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    setDateRange(f.id as any);
                                    if (f.id === 'custom') setShowCustomPicker(true);
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${dateRange === f.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </header>

                {/* Stats Cards */}
                <div className="px-4 mt-2 grid grid-cols-4 gap-2">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xl font-bold text-yellow-500">
                            {dateFilteredDeliveries.filter(d => d.status === DeliveryStatus.PENDING || d.status === DeliveryStatus.ASSIGNED).length}
                        </p>
                        <p className="text-[9px] uppercase text-slate-400 font-bold">Aguardando</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xl font-bold text-primary">
                            {dateFilteredDeliveries.filter(d => d.status === DeliveryStatus.IN_ROUTE).length}
                        </p>
                        <p className="text-[9px] uppercase text-slate-400 font-bold">Em Rota</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xl font-bold text-success">
                            {dateFilteredDeliveries.filter(d => d.status === DeliveryStatus.DELIVERED).length}
                        </p>
                        <p className="text-[9px] uppercase text-slate-400 font-bold">Entregues</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                        <p className="text-xl font-bold text-danger">
                            {dateFilteredDeliveries.filter(d => d.status === DeliveryStatus.PROBLEM).length}
                        </p>
                        <p className="text-[9px] uppercase text-slate-400 font-bold">Problemas</p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="px-4 mt-3 mb-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {[
                            { id: 'pending', label: 'Pendentes' },
                            { id: 'in_route', label: 'Em Rota' },
                            { id: 'delivered', label: 'Entregues' },
                            { id: 'problem', label: 'Problemas' },
                            { id: 'all', label: 'Todas' },
                        ].map((f) => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id as typeof filter)}
                                className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${filter === f.id
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable Deliveries List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
                {filteredDeliveries.length === 0 ? (
                    <div className="text-center py-10">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">local_shipping</span>
                        <p className="text-slate-500">Nenhuma entrega encontrada</p>
                    </div>
                ) : (
                    filteredDeliveries.map((delivery) => {
                        const statusConfig = getStatusConfig(delivery.status);
                        const nextStatus = getNextStatus(delivery.status);

                        return (
                            <div
                                key={delivery.id}
                                className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden shadow-sm ${sales.find(s => s.id === delivery.saleId)?.status === OrderStatus.CANCELLATION_REQUESTED
                                    ? 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.1)]'
                                    : 'border-slate-100 dark:border-slate-700'
                                    }`}
                            >
                                <div className="p-4">
                                    {sales.find(s => s.id === delivery.saleId)?.status === OrderStatus.CANCELLATION_REQUESTED && (
                                        <div className="mb-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                            <span className="material-symbols-outlined text-sm">warning</span>
                                            <span className="text-[10px] font-black uppercase">Cancelamento Solicitado - Não Entregar</span>
                                        </div>
                                    )}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="font-bold">{delivery.customerName}</p>
                                            <p className="text-xs text-slate-500">{delivery.address}</p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase text-white ${statusConfig.color} flex items-center gap-1`}>
                                            <span className="material-symbols-outlined text-xs">{statusConfig.icon}</span>
                                            {statusConfig.label}
                                        </span>
                                    </div>

                                    {(delivery.driverName || delivery.driverId) && (
                                        <div className="flex items-center gap-2 mb-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                            <span className="material-symbols-outlined text-sm">person</span>
                                            <span>
                                                Entregador: <strong>{delivery.driverName || team.find(m => m.id === delivery.driverId)?.name || 'Não identificado'}</strong>
                                            </span>
                                        </div>
                                    )}

                                    <p className="text-xs text-slate-400">
                                        Pedido: {new Date(delivery.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="border-t border-slate-100 dark:border-slate-700">
                                    {/* View Details Button - Always Visible */}
                                    <button
                                        onClick={() => setViewingDelivery(delivery)}
                                        className="w-full py-3 text-slate-600 dark:text-slate-300 font-medium text-sm flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                        Ver Detalhes
                                    </button>
                                    {/* Manager: Assign Driver */}
                                    {userRole === 'gerente' && delivery.status === DeliveryStatus.PENDING && (
                                        <button
                                            onClick={() => setAssigningDelivery(delivery.id)}
                                            className="w-full py-3 text-primary font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">person_add</span>
                                            Atribuir Entregador
                                        </button>
                                    )}

                                    {/* Seller/Driver: Self-Assign (Take Delivery) */}
                                    {(userRole === 'vendedor' || userRole === 'entregador') && delivery.status === DeliveryStatus.PENDING && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Deseja realizar esta entrega? Ela será atribuída a você.')) {
                                                    onAssignDelivery(delivery.id, userId);
                                                }
                                            }}
                                            className="w-full py-3 bg-primary text-white font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">local_shipping</span>
                                            Entregar
                                        </button>
                                    )}

                                    {/* Actor: Update Status (Driver or Seller assigned to it) */}
                                    {(userRole === 'entregador' || userRole === 'vendedor') && delivery.driverId === userId && nextStatus && (
                                        <button
                                            onClick={() => onUpdateStatus(delivery.id, nextStatus)}
                                            className="w-full py-3 bg-success text-white font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">
                                                {nextStatus === DeliveryStatus.IN_ROUTE ? 'play_arrow' : 'check'}
                                            </span>
                                            {getNextStatusLabel(delivery.status)}
                                        </button>
                                    )}

                                    {/* Manager: Problem Resolution */}
                                    {userRole === 'gerente' && delivery.status === DeliveryStatus.PROBLEM && (
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Deseja reiniciar esta entrega? Ela voltará para "Pendente" para ser atribuída novamente.')) {
                                                        onUpdateStatus(delivery.id, DeliveryStatus.PENDING);
                                                    }
                                                }}
                                                className="w-full py-3 border-2 border-primary text-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all"
                                            >
                                                <span className="material-symbols-outlined">restart_alt</span>
                                                Reiniciar Entrega (Tentar Novamente)
                                            </button>

                                            {onCancelSale && (
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('ATENÇÃO: Deseja cancelar a VENDA completa? O valor será estornado e os itens devolvidos ao estoque.')) {
                                                            onCancelSale(delivery.saleId);
                                                        }
                                                    }}
                                                    className="w-full py-3 bg-danger text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-danger/20 hover:bg-red-600 transition-all"
                                                >
                                                    <span className="material-symbols-outlined">cancel</span>
                                                    Cancelar Venda (Estornar)
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {delivery.status === DeliveryStatus.DELIVERED && (
                                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 flex flex-col gap-3">
                                            {delivery.deliveredAt && (
                                                <p className="text-center text-xs text-success font-medium">
                                                    Entregue em {new Date(delivery.deliveredAt).toLocaleString('pt-BR')}
                                                </p>
                                            )}
                                            <button
                                                onClick={() => handleShowInvoice(delivery)}
                                                className="w-full py-3 bg-white dark:bg-slate-800 border-2 border-primary text-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all shadow-sm"
                                            >
                                                <span className="material-symbols-outlined text-lg">receipt_long</span>
                                                Emitir Nota Fiscal (NFC-e)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Assign Driver Modal */}
            {assigningDelivery && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold mb-4">Selecionar Entregador</h3>

                        {drivers.length === 0 ? (
                            <p className="text-slate-500 text-center py-4">Nenhum entregador ativo</p>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {drivers.map(driver => (
                                    <button
                                        key={driver.id}
                                        onClick={() => {
                                            onAssignDelivery(assigningDelivery, driver.id);
                                            setAssigningDelivery(null);
                                        }}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                                    >
                                        {driver.avatar ? (
                                            <img src={driver.avatar} alt="" className="size-10 rounded-xl object-cover" />
                                        ) : (
                                            <div className="size-10 rounded-xl bg-secondary/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-secondary">local_shipping</span>
                                            </div>
                                        )}
                                        <div className="flex-1 text-left">
                                            <p className="font-medium">{driver.name}</p>
                                            <p className="text-xs text-slate-500">{driver.deliveriesCount} entregas</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setAssigningDelivery(null)}
                            className="w-full mt-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 font-medium"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Delivery Details Modal */}
            {viewingDelivery && (
                <DeliveryDetailsModal
                    delivery={viewingDelivery}
                    sale={sales.find(s => s.id === viewingDelivery.saleId)}
                    customer={customers.find(c => c.id === viewingDelivery.customerId)}
                    basket={baskets.find(b => b.id === sales.find(s => s.id === viewingDelivery.saleId)?.basketModelId)}
                    onClose={() => setViewingDelivery(null)}
                    onUpdateStatus={onUpdateStatus}
                    userRole={userRole}
                />
            )}

            {/* Invoice Modal */}
            {selectedInvoice && (
                <InvoiceModal
                    customer={selectedInvoice.customer}
                    sale={selectedInvoice.sale}
                    basket={selectedInvoice.basket}
                    onClose={() => setSelectedInvoice(null)}
                />
            )}

            {/* Custom Date Picker Modal */}
            {showCustomPicker && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCustomPicker(false)} />
                    <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl">
                        <h3 className="text-xl font-black mb-6">Período Personalizado</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Data Início</label>
                                <input
                                    type="date"
                                    value={customDates.start}
                                    onChange={(e) => setCustomDates(prev => ({ ...prev, start: e.target.value }))}
                                    className="w-full h-14 px-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Data Fim</label>
                                <input
                                    type="date"
                                    value={customDates.end}
                                    onChange={(e) => setCustomDates(prev => ({ ...prev, end: e.target.value }))}
                                    className="w-full h-14 px-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl font-bold"
                                />
                            </div>
                        </div>
                        <button
                            onClick={() => setShowCustomPicker(false)}
                            className="w-full mt-8 h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                            Aplicar Filtro
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeliveriesView;
