import React, { useState } from 'react';
import { ViewState, Installment, InstallmentStatus, PaymentMethod, Sale, OrderStatus } from '../types';
import PartialPaymentModal from '../components/PartialPaymentModal';

interface InstallmentsViewProps {
    installments: Installment[];
    sales: Sale[];
    userRole: string;
    userId: string;
    sellerId: string;
    onPayInstallment: (id: string, paymentMethod: PaymentMethod) => void;
    onUpdateInstallments: (saleId: string, updatedInstallments: any[]) => Promise<void>;
    onRefresh?: () => void;
    setView: (v: ViewState) => void;
}

const InstallmentsView: React.FC<InstallmentsViewProps> = ({
    installments,
    sales,
    userRole,
    userId,
    sellerId,
    onPayInstallment,
    onUpdateInstallments,
    onRefresh,
    setView,
}) => {
    const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [payingId, setPayingId] = useState<string | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [partialPaymentInst, setPartialPaymentInst] = useState<Installment | null>(null);

    // Update overdue status
    const today = Date.now();
    
    // DEBUG: counts per stage
    const debugRawElisabete = installments.filter(i => (i.customerName || '').toLowerCase().includes('elisabe'));
    const debugSalesForElisabete = debugRawElisabete.map(i => {
        const sale = sales.find(s => s.id === i.saleId);
        return { instId: i.id, instNum: i.number, instStatus: i.status, saleFound: !!sale, saleStatus: sale?.status, sellerId: sale?.sellerId };
    });

    const processedInstallments = installments
        .filter(i => {
            const sale = sales.find(s => s.id === i.saleId);
            if (!sale || sale.status === OrderStatus.CANCELLED) return false;
            if (userRole === 'gerente') return true;
            return sale.sellerId === userId;
        })
        .map(i => ({
            ...i,
            status: i.status === InstallmentStatus.PENDING && i.dueDate < today
                ? InstallmentStatus.OVERDUE
                : i.status,
        }));

    const filteredInstallments = processedInstallments
        .filter(i => {
            if (filter === 'all') return true;
            if (filter === 'pending') return i.status === InstallmentStatus.PENDING;
            if (filter === 'paid') return i.status === InstallmentStatus.PAID;
            if (filter === 'overdue') return i.status === InstallmentStatus.OVERDUE;
            return true;
        })
        .filter(i =>
                (i.customerName || '').toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.dueDate - b.dueDate);

    const debugProcessedElisabete = processedInstallments.filter(i => (i.customerName || '').toLowerCase().includes('elisabe'));
    const debugFilteredElisabete = filteredInstallments.filter(i => (i.customerName || '').toLowerCase().includes('elisabe'));

    const pendingCount = processedInstallments.filter(i => i.status === InstallmentStatus.PENDING).length;
    const overdueCount = processedInstallments.filter(i => i.status === InstallmentStatus.OVERDUE).length;
    const totalPending = processedInstallments
        .filter(i => i.status !== InstallmentStatus.PAID)
        .reduce((acc, i) => acc + i.amount, 0);

    const getStatusConfig = (status: InstallmentStatus) => {
        switch (status) {
            case InstallmentStatus.PENDING:
                return { color: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Pendente' };
            case InstallmentStatus.PAID:
                return { color: 'bg-success', text: 'text-success', bg: 'bg-success/10', label: 'Pago' };
            case InstallmentStatus.OVERDUE:
                return { color: 'bg-danger', text: 'text-danger', bg: 'bg-danger/10', label: 'Atrasado' };
            default:
                return { color: 'bg-slate-500', text: 'text-slate-500', bg: 'bg-slate-50', label: 'Desconhecido' };
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* DEBUG BANNER - REMOVER DEPOIS */}
            {searchQuery.toLowerCase().includes('elisab') && (
                <div className="mx-4 mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 text-xs">
                    <p className="font-bold text-red-600 mb-1">🔍 DEBUG Elisabete:</p>
                    <p>Raw (props): <b>{debugRawElisabete.length}</b> parcelas</p>
                    <p>Processed (após filter sale): <b>{debugProcessedElisabete.length}</b></p>
                    <p>Filtered (após filter status + busca): <b>{debugFilteredElisabete.length}</b></p>
                    <p>Total installments (props): <b>{installments.length}</b></p>
                    <p>Total sales (props): <b>{sales.length}</b></p>
                    <p>User role: <b>{userRole}</b> | Filter: <b>{filter}</b></p>
                    {debugSalesForElisabete.map((d, i) => (
                        <p key={i} className="text-[10px] text-slate-500">
                            Parcela #{d.instNum}: status={d.instStatus} | sale found={String(d.saleFound)} | sale status={d.saleStatus}
                        </p>
                    ))}
                </div>
            )}

            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold leading-tight">Parcelado</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Contas Parceladas</p>
                    </div>
                    {onRefresh && (
                        <button
                            onClick={() => onRefresh()}
                            className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 active:scale-95 transition-all text-primary"
                            title="Atualizar Dados"
                        >
                            <span className="material-symbols-outlined">refresh</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="px-4 mt-4 grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Pendentes</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-2xl font-bold text-danger">{overdueCount}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Atrasadas</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-lg font-bold text-primary">R$ {totalPending.toFixed(0)}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Parcelado</p>
                </div>
            </div>

            {/* Search */}
            <div className="px-4 mt-4">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        search
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Buscar por cliente..."
                    />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 mt-4">
                <div className="flex gap-2 overflow-x-auto">
                    {[
                        { id: 'pending', label: 'Pendentes' },
                        { id: 'overdue', label: 'Atrasadas' },
                        { id: 'paid', label: 'Pagas' },
                        { id: 'all', label: 'Todas' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as typeof filter)}
                            className={`px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${filter === f.id
                                ? 'bg-primary text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Installments List */}
            <div className="flex-1 p-4 space-y-3 pb-32 overflow-y-auto">
                {filteredInstallments.length === 0 ? (
                    <div className="text-center py-10">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">payments</span>
                        <p className="text-slate-500">Nenhuma parcela encontrada</p>
                    </div>
                ) : (
                    filteredInstallments.map((installment) => {
                        const statusConfig = getStatusConfig(installment.status);
                        const isPast = installment.dueDate < today;

                        return (
                            <div
                                key={installment.id}
                                className={`bg-white dark:bg-slate-800 p-4 rounded-xl border transition-all ${installment.status === InstallmentStatus.OVERDUE
                                    ? 'border-danger/30'
                                    : 'border-slate-100 dark:border-slate-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <p className="font-bold">{installment.customerName}</p>
                                        <p className="text-xs text-slate-500">
                                            Parcela {installment.number}/{installment.totalInstallments}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${statusConfig.bg} ${statusConfig.text}`}>
                                        {statusConfig.label}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-slate-400">
                                            {isPast && installment.status !== InstallmentStatus.PAID ? 'Venceu em' : 'Vence em'}
                                        </p>
                                        <p className={`font-medium ${isPast && installment.status !== InstallmentStatus.PAID ? 'text-danger' : ''}`}>
                                            {new Date(installment.dueDate).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <p className="text-xl font-black text-primary">
                                        R$ {installment.amount.toFixed(2)}
                                    </p>
                                </div>

                                {installment.status !== InstallmentStatus.PAID && (
                                    <div className="mt-3 space-y-2">
                                        {payingId === installment.id ? (
                                            <>
                                                {selectedMethod ? (
                                                    <div className="p-3 bg-primary/5 dark:bg-primary/10 rounded-2xl border-2 border-primary/20 animate-in zoom-in-95 duration-200">
                                                        <p className="text-[10px] font-black uppercase text-primary text-center mb-2 tracking-widest">Confirmar Recebimento</p>
                                                        <div className="flex items-center justify-center gap-2 mb-4 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm">
                                                            <span className="material-symbols-outlined text-primary">
                                                                {selectedMethod === PaymentMethod.PIX ? 'qr_code_2' : selectedMethod === PaymentMethod.CARD ? 'credit_card' : 'payments'}
                                                            </span>
                                                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                                                {selectedMethod === PaymentMethod.PIX ? 'Pix' : selectedMethod === PaymentMethod.CARD ? 'Cartão' : 'Dinheiro'}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => setSelectedMethod(null)}
                                                                className="flex-1 h-12 bg-slate-100 dark:bg-slate-700 text-slate-500 font-bold rounded-xl active:scale-95 transition-all text-xs"
                                                            >
                                                                Voltar
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    onPayInstallment(installment.id, selectedMethod);
                                                                    setPayingId(null);
                                                                    setSelectedMethod(null);
                                                                }}
                                                                className="flex-[2] h-12 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-primary/20 text-xs"
                                                            >
                                                                Confirmar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl animate-in zoom-in-95 duration-200">
                                                        {[
                                                            { id: PaymentMethod.PIX, icon: 'qr_code_2', label: 'Pix' },
                                                            { id: PaymentMethod.CARD, icon: 'credit_card', label: 'Cartão' },
                                                            { id: PaymentMethod.ON_DELIVERY, icon: 'payments', label: 'Dinheiro' },
                                                        ].map(method => (
                                                            <button
                                                                key={method.id}
                                                                onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                                                                className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-600 active:scale-95 transition-all shadow-sm"
                                                            >
                                                                <span className="material-symbols-outlined text-lg text-primary">{method.icon}</span>
                                                                <span className="text-[10px] font-bold text-slate-500 mt-1">{method.label}</span>
                                                            </button>
                                                        ))}
                                                            <button
                                                                onClick={() => setPayingId(null)}
                                                                className="col-span-2 text-[10px] font-bold text-slate-400 py-1"
                                                            >
                                                                Cancelar
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setPartialPaymentInst(installment);
                                                                    setPayingId(null);
                                                                }}
                                                                className="col-span-1 text-[10px] font-bold text-blue-500 py-1 flex items-center justify-center gap-1"
                                                            >
                                                                <span className="material-symbols-outlined text-xs">edit_note</span>
                                                                Valor Diferente
                                                            </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setPayingId(installment.id);
                                                    setSelectedMethod(null);
                                                }}
                                                className="w-full py-2.5 bg-success text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-[0.98]"
                                            >
                                                <span className="material-symbols-outlined text-lg">check</span>
                                                Registrar Pagamento
                                            </button>
                                        )}
                                    </div>
                                )}

                                {installment.status === InstallmentStatus.PAID && installment.paidAt && (
                                    <p className="text-xs text-success text-center mt-3">
                                        Pago em {new Date(installment.paidAt).toLocaleDateString('pt-BR')}
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Partial Payment Modal */}
            {partialPaymentInst && (
                <PartialPaymentModal
                    sale={sales.find(s => s.id === partialPaymentInst.saleId)!}
                    installment={partialPaymentInst}
                    allInstallments={installments}
                    paymentMethod={selectedMethod}
                    sellerId={sellerId}
                    onClose={() => setPartialPaymentInst(null)}
                    onSave={onUpdateInstallments}
                />
            )}
        </div>
    );
};

export default InstallmentsView;
