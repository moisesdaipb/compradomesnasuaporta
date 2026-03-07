import React from 'react';
import { Delivery, DeliveryStatus, Sale, Customer, BasketModel, OrderStatus } from '../types';

interface DeliveryDetailsModalProps {
    delivery: Delivery;
    sale?: Sale;
    customer?: Customer;
    basket?: BasketModel;
    onClose: () => void;
    onUpdateStatus: (id: string, status: DeliveryStatus, notes?: string) => void;
    userRole: 'gerente' | 'vendedor' | 'entregador' | 'cliente';
}

const DeliveryDetailsModal: React.FC<DeliveryDetailsModalProps> = ({
    delivery,
    sale,
    customer,
    basket,
    onClose,
    onUpdateStatus,
    userRole
}) => {
    if (!delivery || !sale) return null;

    const isDriver = userRole === 'entregador' || userRole === 'vendedor';
    const canInteract = isDriver && delivery.driverId; // Check if user is the assigned driver

    const handleProblem = () => {
        if (window.confirm('Tem certeza que deseja reportar um problema/cancelar esta entrega?')) {
            onUpdateStatus(delivery.id, DeliveryStatus.PROBLEM);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto p-6 animate-in zoom-in-95 duration-200 shadow-2xl">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold">Detalhes da Entrega</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Problem Alert */}
                {delivery.status === DeliveryStatus.PROBLEM && delivery.notes && (
                    <div className="mb-6 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-danger mt-0.5">report_problem</span>
                            <div>
                                <p className="text-xs font-bold text-danger uppercase tracking-wider mb-1">Motivo do Problema</p>
                                <p className="font-medium text-slate-900 dark:text-white leading-snug">
                                    {delivery.notes}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Customer Info */}
                <div className="mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cliente</p>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-500">person</span>
                        </div>
                        <div>
                            <p className="font-bold text-lg leading-tight">{delivery.customerName}</p>
                            {customer?.phone && <p className="text-sm text-slate-500">{customer.phone}</p>}
                        </div>
                    </div>
                </div>

                {/* Address Info */}
                <div className="mb-6 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary mt-0.5">location_on</span>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Endereço de Entrega</p>
                            <p className="font-medium text-slate-900 dark:text-white leading-snug">
                                {delivery.address}, {sale.deliveryNumber || customer?.addressNumber || 'S/N'}
                            </p>
                            {sale.deliveryNotes && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 bg-orange-50 dark:bg-orange-900/20 p-2 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                    <span className="font-bold">Obs:</span> {sale.deliveryNotes}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Payment Info */}
                <div className="mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pagamento</p>
                    <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
                        <div>
                            <p className="font-bold text-green-700 dark:text-green-400">{sale.paymentMethod}</p>
                            {sale.changeAmount && sale.changeAmount > 0 && (
                                <p className="text-xs text-green-600 dark:text-green-300 mt-0.5">
                                    Troco para: <strong>R$ {(sale.total + sale.changeAmount).toFixed(2)}</strong>
                                </p>
                            )}
                        </div>
                        <p className="text-xl font-black text-green-700 dark:text-green-400">
                            R$ {sale.total.toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* Order Items */}
                <div className="mb-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Itens do Pedido</p>
                    <div className="space-y-2">
                        {sale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span>{item.quantity}x {item.basketName}</span>
                                <span className="font-medium">R$ {(item.unitPrice * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions Grid for Communication/Navigation */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <button
                        onClick={() => {
                            const fullAddress = `${delivery.address}, ${sale.deliveryNumber || customer?.addressNumber || ''} - ${customer?.city || ''}`;
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`, '_blank');
                        }}
                        className="py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                    >
                        <span className="material-symbols-outlined">map</span>
                        <span className="text-[10px]">Maps</span>
                    </button>

                    <button
                        onClick={() => {
                            const phone = customer?.phone?.replace(/\D/g, '');
                            if (phone) window.open(`https://wa.me/55${phone}`, '_blank');
                            else alert('Telefone não disponível');
                        }}
                        className="py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-bold rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all"
                    >
                        <span className="material-symbols-outlined">chat</span>
                        <span className="text-[10px]">WhatsApp</span>
                    </button>

                    <button
                        onClick={() => {
                            if (customer?.phone) window.open(`tel:${customer.phone}`, '_self');
                        }}
                        className="py-3 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl flex flex-col items-center justify-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all"
                    >
                        <span className="material-symbols-outlined">call</span>
                        <span className="text-[10px]">Ligar</span>
                    </button>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-2">
                    {/* Only for In-Route: Undo Start or Report Problem */}
                    {canInteract && delivery.status === DeliveryStatus.IN_ROUTE && (
                        <>
                            <button
                                onClick={() => {
                                    if (window.confirm('Deseja realmente desfazer o início da entrega? Ela voltará para "Atribuída".')) {
                                        onUpdateStatus(delivery.id, DeliveryStatus.ASSIGNED);
                                        onClose();
                                    }
                                }}
                                className="w-full py-3 rounded-xl border-2 border-yellow-500 text-yellow-600 font-bold hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">undo</span>
                                Desfazer Início de Entrega
                            </button>

                            <button
                                onClick={() => {
                                    const reason = window.prompt('Qual o problema com esta entrega? (Ex: Endereço não encontrado, Cliente ausente)');
                                    if (reason) {
                                        onUpdateStatus(delivery.id, DeliveryStatus.PROBLEM, reason);
                                        onClose();
                                    }
                                }}
                                className="w-full py-3 rounded-xl border-2 border-danger text-danger font-bold hover:bg-danger hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">report_problem</span>
                                Reportar Problema
                            </button>
                        </>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-100 dark:bg-slate-700 font-bold rounded-xl text-slate-600 dark:text-slate-300"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeliveryDetailsModal;
