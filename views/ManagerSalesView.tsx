import { ViewState, Sale, Delivery, OrderStatus, DeliveryStatus, BasketModel, Customer, Installment } from '../types';
import EditSaleModal from '../components/EditSaleModal';

interface ManagerSalesViewProps {
    sales: Sale[];
    deliveries: Delivery[];
    basketModels: BasketModel[];
    customers: Customer[];
    installments: Installment[];
    onUpdateStatus: (saleId: string, status: OrderStatus) => Promise<void>;
    onUpdateSale: (saleId: string, saleData: any, items: any[], installments: any[]) => Promise<void>;
    setView: (v: ViewState) => void;
    userRole: string;
    userId: string;
}

const ManagerSalesView: React.FC<ManagerSalesViewProps> = ({
    sales,
    deliveries,
    basketModels,
    customers,
    installments,
    onUpdateStatus,
    onUpdateSale,
    setView,
    userRole,
    userId
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRange, setFilterRange] = useState<'month' | '30' | '60' | 'all' | 'custom'>('month');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled' | 'request'>('all');
    const [customDates, setCustomDates] = useState({ start: '', end: '' });
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const isSameDay = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        return date.getFullYear() === now.getFullYear() &&
               date.getMonth() === now.getMonth() &&
               date.getDate() === now.getDate();
    };

    const filteredSales = useMemo(() => {
        return sales
            .filter(s => {
                // Search filter
                const query = searchQuery.toLowerCase();
                const matchesSearch = s.customerName.toLowerCase().includes(query) ||
                    s.id.toLowerCase().includes(query);
                if (!matchesSearch) return false;

                // Status filter
                if (statusFilter === 'pending' && s.status !== OrderStatus.PENDING && s.status !== OrderStatus.CONFIRMED) return false;
                if (statusFilter === 'completed' && s.status !== OrderStatus.DELIVERED) return false;
                if (statusFilter === 'cancelled' && s.status !== OrderStatus.CANCELLED) return false;
                if (statusFilter === 'request' && s.status !== OrderStatus.CANCELLATION_REQUESTED) return false;

                // Date filter
                const saleDate = s.createdAt;
                const now = Date.now();
                if (filterRange === 'month') {
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);
                    return saleDate >= startOfMonth.getTime();
                }
                if (filterRange === '30') return (now - saleDate) <= 30 * 24 * 60 * 60 * 1000;
                if (filterRange === '60') return (now - saleDate) <= 60 * 24 * 60 * 60 * 1000;
                if (filterRange === 'custom' && customDates.start && customDates.end) {
                    const start = new Date(customDates.start).getTime();
                    const end = new Date(customDates.end).getTime() + 86400000;
                    return saleDate >= start && saleDate <= end;
                }
                return true;
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [sales, searchQuery, statusFilter, filterRange, customDates]);

    const getDelivery = (saleId: string) => deliveries.find(d => d.saleId === saleId);

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

    return (
        <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-950">
            {/* Sticky Container for Header and Stats */}
            {/* Header Container */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                {/* Header */}
                <header className="bg-white dark:bg-slate-900 px-4 py-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => setView('dashboard')} className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">Histórico de Vendas</h2>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{filteredSales.length} registros encontrados</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-6">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por cliente ou ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    {/* Date Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                        {[
                            { id: 'month', label: 'Mês Atual' },
                            { id: '30', label: '30 dias' },
                            { id: '60', label: '60 dias' },
                            { id: 'all', label: 'Tudo' },
                            { id: 'custom', label: 'Período' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    setFilterRange(f.id as any);
                                    if (f.id === 'custom') setShowCustomPicker(true);
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filterRange === f.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Status Filters - Hidden for sellers if they only see completed sales */}
                    {userRole === 'gerente' && (
                        <div className="flex gap-2 overflow-x-auto mt-4 pb-2 scrollbar-hide no-scrollbar">
                            {[
                                { id: 'all', label: 'Todos' },
                                { id: 'request', label: 'Solic. Cancelamento' },
                                { id: 'pending', label: 'Em Aberto' },
                                { id: 'completed', label: 'Concluídos' },
                                { id: 'cancelled', label: 'Cancelados' },
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setStatusFilter(f.id as any)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f.id
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border border-slate-100 dark:border-slate-700'}`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                </header>
            </div>

            {/* Total Sales Card - Now scrollable */}
            <div className="px-4 pt-4 pb-2 animate-in slide-in-from-top-4 duration-500">
                <div className="bg-gradient-to-br from-primary to-blue-600 p-6 rounded-[32px] text-white shadow-xl shadow-primary/20">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <div className="size-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <span className="material-symbols-outlined text-white">calendar_today</span>
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                                {filterRange === 'month' ? 'Mês Atual' :
                                    filterRange === '30' ? 'Últimos 30 dias' :
                                        filterRange === '60' ? 'Últimos 60 dias' :
                                            filterRange === 'all' ? 'Todo o Período' : 'Período Personalizado'}
                            </span>
                        </div>
                        <span className="material-symbols-outlined opacity-50">payments</span>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Total Confirmado</p>
                    <p className="text-4xl font-black tracking-tight mb-6">
                        R$ {filteredSales
                            .filter(s => s.status !== OrderStatus.CANCELLED)
                            .reduce((acc, s) => acc + s.total, 0)
                            .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>

                    <div className="flex gap-4 pt-4 border-t border-white/20">
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Pedidos Válidos</p>
                            <p className="text-xl font-bold">{filteredSales.filter(s => s.status !== OrderStatus.CANCELLED).length}</p>
                        </div>
                        <div className="w-px bg-white/20"></div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Ticket Médio</p>
                            <p className="text-xl font-bold">
                                R$ {(() => {
                                    const validSales = filteredSales.filter(s => s.status !== OrderStatus.CANCELLED);
                                    return validSales.length > 0
                                        ? (validSales.reduce((acc, s) => acc + s.total, 0) / validSales.length).toFixed(2)
                                        : '0,00';
                                })()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sales List */}
            <div className="p-4 space-y-3 pb-32">
                {filteredSales.map(sale => {
                    const statusConfig = getStatusConfig(sale.status);
                    const delivery = getDelivery(sale.id);
                    return (
                        <div
                            key={sale.id}
                            onClick={() => setSelectedSale(sale)}
                            className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-start gap-4 active:scale-[0.98] transition-all cursor-pointer hover:border-primary/30"
                        >
                            <div className="size-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 relative">
                                <span className={`material-symbols-outlined text-xl ${statusConfig.text}`}>
                                    {sale.status === OrderStatus.CANCELLATION_REQUESTED ? 'warning' :
                                        sale.channel === 'online' ? 'public' : 'storefront'}
                                </span>
                                {sale.channel === 'online' && (
                                    <div className="absolute -top-1 -right-1 size-4 bg-primary text-white rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                                        <span className="material-symbols-outlined text-[8px] font-black">globe</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">#{sale.id.slice(0, 8)}</p>
                                    <div className={`${statusConfig.color} size-2 rounded-full shadow-sm`} />
                                </div>
                                <h4 className="font-black text-sm truncate text-slate-900 dark:text-white mb-1">{sale.customerName}</h4>

                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px]">payments</span>
                                        {sale.paymentMethod}
                                    </span>
                                    {delivery?.driverName && (
                                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[10px]">local_shipping</span>
                                            {delivery.driverName.split(' ')[0]}
                                        </span>
                                    )}
                                    <span className="text-[10px] text-slate-400 font-bold">
                                        {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <p className="font-black text-primary text-sm">R$ {sale.total.toFixed(2)}</p>
                                <p className={`text-[9px] font-black uppercase tracking-tighter ${statusConfig.text}`}>
                                    {statusConfig.label}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 shrink-0">
                                {sale.status === OrderStatus.DELIVERED && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedSale(sale);
                                            // Pode-se disparar a emissão de nota daqui também
                                        }}
                                        className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-sm"
                                        title="Ver detalhes / Nota Fiscal"
                                    >
                                        <span className="material-symbols-outlined text-xl">receipt_long</span>
                                    </button>
                                )}
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                            </div>
                        </div>
                    );
                })}

                {filteredSales.length === 0 && (
                    <div className="py-20 text-center">
                        <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">search_off</span>
                        <p className="text-slate-400 font-bold">Nenhum resultado encontrado</p>
                    </div>
                )}
            </div>

            {/* Custom Date Modal */}
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

                        <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-8 scrollbar-hide no-scrollbar">
                            {/* Products Section */}
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
                                                    {model?.description && (
                                                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                                                            {model.description}
                                                        </p>
                                                    )}
                                                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">R$ {item.unitPrice.toFixed(2)} unit.</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Customer & Delivery Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cliente</p>
                                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">{selectedSale.customerAddress ? selectedSale.customerName : 'Venda Presencial'}</p>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">{selectedSale.channel.toUpperCase()}</p>
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

                            {/* Address Info */}
                            {selectedSale.channel === 'online' && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Destino da Entrega</p>
                                    <div className="flex items-start gap-3">
                                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-primary text-xl">location_on</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                                                {selectedSale.deliveryAddress || 'Endereço não informado'}, {selectedSale.deliveryNumber}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1 font-medium italic">Falar com: {selectedSale.deliveryContact || selectedSale.customerName}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Manager Actions for cancellation request */}
                            {selectedSale.status === OrderStatus.CANCELLATION_REQUESTED && (
                                <div className="bg-orange-50 dark:bg-orange-500/10 border-2 border-orange-200 dark:border-orange-500/20 rounded-[32px] p-6 text-center">
                                    <div className="size-16 bg-orange-100 dark:bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-orange-500 text-3xl">warning</span>
                                    </div>
                                    <h4 className="text-lg font-black text-orange-800 dark:text-orange-200 mb-2">Solicitação de Cancelamento</h4>
                                    <p className="text-xs text-orange-700/70 dark:text-orange-300/60 font-medium mb-6 leading-relaxed">
                                        O cliente solicitou o cancelamento deste pedido. Deseja aprovar ou rejeitar esta solicitação?
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            disabled={isUpdating}
                                            onClick={async () => {
                                                if (confirm('Aprovar cancelamento? O pedido será marcado como CANCELADO.')) {
                                                    try {
                                                        setIsUpdating(true);
                                                        await onUpdateStatus(selectedSale.id, OrderStatus.CANCELLED);
                                                        setSelectedSale(null);
                                                    } finally {
                                                        setIsUpdating(false);
                                                    }
                                                }
                                            }}
                                            className="h-14 bg-danger text-white font-black rounded-2xl shadow-lg shadow-danger/20 active:scale-95 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isUpdating ? (
                                                <>
                                                    <span className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full" />
                                                    Processando...
                                                </>
                                            ) : 'Aprovar'}
                                        </button>
                                        <button
                                            disabled={isUpdating}
                                            onClick={async () => {
                                                if (confirm('Rejeitar cancelamento? O pedido voltará para o status anterior.')) {
                                                    try {
                                                        setIsUpdating(true);
                                                        await onUpdateStatus(selectedSale.id, OrderStatus.CONFIRMED);
                                                        setSelectedSale(null);
                                                    } finally {
                                                        setIsUpdating(false);
                                                    }
                                                }
                                            }}
                                            className="h-14 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 font-black rounded-2xl border border-slate-200 dark:border-slate-700 active:scale-95 transition-all text-sm disabled:opacity-50"
                                        >
                                            Rejeitar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Actions for Seller (Same Day) or Manager (Always) */}
                            {selectedSale.status !== OrderStatus.CANCELLED && (
                                <div className="space-y-3">
                                    {(userRole === 'gerente' || (selectedSale.sellerId === userId && isSameDay(selectedSale.createdAt))) && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="h-14 bg-primary/10 text-primary font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
                                            >
                                                <span className="material-symbols-outlined">edit</span>
                                                Editar Venda
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (confirm('Deseja realmente cancelar esta venda?')) {
                                                        try {
                                                            setIsUpdating(true);
                                                            await onUpdateStatus(selectedSale.id, OrderStatus.CANCELLED);
                                                            setSelectedSale(null);
                                                        } finally {
                                                            setIsUpdating(false);
                                                        }
                                                    }
                                                }}
                                                className="h-14 bg-danger/10 text-danger font-black rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-sm"
                                            >
                                                <span className="material-symbols-outlined">cancel</span>
                                                Cancelar Venda
                                            </button>
                                        </div>
                                    )}
                                    
                                    {userRole === 'vendedor' && selectedSale.sellerId === userId && !isSameDay(selectedSale.createdAt) && (
                                        <p className="text-[10px] text-slate-400 font-bold text-center italic">
                                            Vendas de dias anteriores não podem ser editadas ou canceladas por vendedores.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Active Delivery Tracking for Manager */}
                            {selectedSale.channel === 'online' && (
                                <div className="bg-primary/5 p-6 rounded-[32px] border border-primary/10">
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-6 text-center">Rastreio em Tempo Real</p>
                                    <div className="flex items-center justify-between px-2">
                                        {[
                                            { step: 1, icon: 'receipt', label: 'Pedido' },
                                            { step: 2, icon: 'inventory', label: 'Prep.' },
                                            { step: 3, icon: 'local_shipping', label: 'Rota' },
                                            { step: 4, icon: 'home', label: 'Fim' },
                                        ].map((s, idx) => {
                                            const delivery = getDelivery(selectedSale.id);
                                            const deliveryStep = delivery?.status === DeliveryStatus.DELIVERED ? 4 :
                                                delivery?.status === DeliveryStatus.IN_ROUTE ? 3 :
                                                    delivery?.status === DeliveryStatus.ASSIGNED ? 2 : 1;
                                            return (
                                                <React.Fragment key={s.step}>
                                                    <div className="flex flex-col items-center">
                                                        <div className={`size-12 rounded-2xl flex items-center justify-center mb-2 transition-all duration-500 ${deliveryStep >= s.step
                                                            ? 'bg-success text-white shadow-lg shadow-success/20 scale-110'
                                                            : 'bg-white dark:bg-slate-800 text-slate-300'
                                                            }`}>
                                                            <span className="material-symbols-outlined text-xl">{s.icon}</span>
                                                        </div>
                                                        <span className={`text-[9px] font-black uppercase tracking-tighter ${deliveryStep >= s.step ? 'text-success' : 'text-slate-400'}`}>{s.label}</span>
                                                    </div>
                                                    {idx < 3 && (
                                                        <div className={`flex-1 h-1.5 mx-1 rounded-full ${deliveryStep > s.step ? 'bg-success/50' : 'bg-slate-100 dark:bg-slate-800'}`} />
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer / Direct Cancellation for Pending */}
                        {(selectedSale.status === OrderStatus.PENDING || selectedSale.status === OrderStatus.CONFIRMED) && (
                            <div className="p-8 pb-10 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                                <button
                                    onClick={() => {
                                        if (confirm('Tem certeza que deseja cancelar este pedido manualmente?')) {
                                            onUpdateStatus(selectedSale.id, OrderStatus.CANCELLED);
                                            setSelectedSale(null);
                                        }
                                    }}
                                    className="w-full h-14 bg-white dark:bg-slate-900 text-danger border-2 border-danger/10 font-bold rounded-2xl hover:bg-danger hover:text-white transition-all text-xs uppercase tracking-widest"
                                >
                                    Forçar Cancelamento Administrativo
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Edit Sale Modal */}
            {isEditing && selectedSale && (
                <EditSaleModal
                    sale={selectedSale}
                    customers={customers}
                    basketModels={basketModels}
                    installments={installments}
                    onClose={() => setIsEditing(false)}
                    onSave={async (id, data, items, insts) => {
                        try {
                            setIsUpdating(true);
                            await onUpdateSale(id, data, items, insts);
                            setIsEditing(false);
                            setSelectedSale(null);
                        } finally {
                            setIsUpdating(false);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default ManagerSalesView;
