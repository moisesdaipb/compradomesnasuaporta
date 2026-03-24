import React, { useState, useMemo } from 'react';
import { ViewState, Installment, InstallmentStatus, Sale, OrderStatus, Customer, PaymentMethod } from '../types';
import { formatCurrency } from '../utils';

interface ReceivablesViewProps {
    installments: Installment[];
    sales: Sale[];
    customers: Customer[];
    userRole: string;
    userId: string;
    onRefresh?: () => void;
    setView: (v: ViewState) => void;
}

const ReceivablesView: React.FC<ReceivablesViewProps> = ({
    installments,
    sales,
    customers,
    userRole,
    userId,
    onRefresh,
    setView,
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<number | null>(today.getTime());
    const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);

    // Filter relevant installments
    const relevantInstallments = useMemo(() => {
        return installments.filter(i => {
            const sale = sales.find(s => s.id === i.saleId);
            if (!sale || sale.status === OrderStatus.CANCELLED) return false;
            if (userRole === 'gerente') return true;
            return sale.sellerId === userId;
        });
    }, [installments, sales, userRole, userId]);

    // Calendar generation
    const calendarData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        
        // Previous month days fill
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            days.push({
                day: prevMonthLastDay - i,
                month: month - 1,
                year,
                isCurrentMonth: false,
                timestamp: new Date(year, month - 1, prevMonthLastDay - i, 0, 0, 0, 0).getTime()
            });
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({
                day: i,
                month,
                year,
                isCurrentMonth: true,
                timestamp: new Date(year, month, i, 0, 0, 0, 0).getTime()
            });
        }
        
        // Next month days fill
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({
                day: i,
                month: month + 1,
                year,
                isCurrentMonth: false,
                timestamp: new Date(year, month + 1, i, 0, 0, 0, 0).getTime()
            });
        }
        
        return days.map(d => {
            const dayInstallments = relevantInstallments.filter(inst => {
                const due = new Date(inst.dueDate);
                due.setHours(0, 0, 0, 0);
                return due.getTime() === d.timestamp && inst.status !== InstallmentStatus.PAID;
            });
            const total = dayInstallments.reduce((acc, i) => acc + i.amount, 0);
            const isLate = d.timestamp < today.getTime() && total > 0;
            
            return { ...d, total, isLate, count: dayInstallments.length };
        });
    }, [currentDate, relevantInstallments, today]);

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    const selectedDayInstallments = useMemo(() => {
        if (!selectedDate) return [];
        return relevantInstallments.filter(inst => {
            const due = new Date(inst.dueDate);
            due.setHours(0, 0, 0, 0);
            return due.getTime() === selectedDate;
        }).sort((a, b) => a.status === InstallmentStatus.PAID ? 1 : -1);
    }, [relevantInstallments, selectedDate]);

    const handleWhatsApp = (customer: Customer, inst: Installment) => {
        if (!customer.phone) {
            alert('Cliente sem telefone.');
            return;
        }
        const cleanPhone = customer.phone.replace(/\D/g, '');
        const dateStr = new Date(inst.dueDate).toLocaleDateString('pt-BR');
        const message = `Olá ${customer.name}, tudo bem? Sou o seu vendedor da Cesta Básica. Gostaria de lembrar que a parcela de R$ ${inst.amount.toFixed(2)} tem vencimento para ${dateStr}. Podemos agendar o recebimento?`;
        window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex-1">
                        <h2 className="text-xl font-black">Gestão de Recebíveis</h2>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Calendário de Cobrança</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* Calendar Grid */}
                <div className="p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-slate-50 dark:border-slate-700">
                            <button onClick={prevMonth} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-slate-400">chevron_left</span>
                            </button>
                            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-sm">
                                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                            </h3>
                            <button onClick={nextMonth} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-700">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                <div key={d} className="bg-white dark:bg-slate-800 py-2 text-center">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{d}</span>
                                </div>
                            ))}
                            {calendarData.map((d, index) => (
                                <div
                                    key={index}
                                    onClick={() => setSelectedDate(d.timestamp)}
                                    className={`relative bg-white dark:bg-slate-800 aspect-square flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                                        selectedDate === d.timestamp ? 'ring-2 ring-inset ring-primary z-10' : ''
                                    } ${!d.isCurrentMonth ? 'opacity-30' : ''}`}
                                >
                                    <span className={`text-[11px] font-bold ${d.isLate ? 'text-danger' : 'text-slate-600 dark:text-slate-300'}`}>
                                        {d.day}
                                    </span>
                                    {d.total > 0 && (
                                        <div className={`mt-1 text-[8px] font-black ${d.isLate ? 'text-danger' : 'text-primary'}`}>
                                            R$ {d.total.toFixed(0)}
                                        </div>
                                    )}
                                    {d.timestamp === today.getTime() && (
                                        <div className="absolute top-1 right-1 size-1 bg-primary rounded-full" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Selected Day List */}
                <div className="px-5 pb-32">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">
                        {selectedDate ? `Parcelas para ${new Date(selectedDate).toLocaleDateString('pt-BR')}` : 'Selecione um dia'}
                    </h4>
                    
                    <div className="space-y-3">
                        {selectedDayInstallments.length === 0 ? (
                            <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-slate-400 font-bold text-sm">Nada para receber neste dia</p>
                            </div>
                        ) : (
                            selectedDayInstallments.map(inst => (
                                <div 
                                    key={inst.id}
                                    onClick={() => {
                                        const sale = sales.find(s => s.id === inst.saleId);
                                        if (sale) setSelectedSaleDetail(sale);
                                    }}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between active:scale-[0.98] transition-all"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-white truncate pr-2">{inst.customerName}</p>
                                        <p className="text-[10px] font-bold text-slate-400">Parcela {inst.number}/{inst.totalInstallments}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-md font-black text-primary">{formatCurrency(inst.amount)}</p>
                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            inst.status === InstallmentStatus.PAID ? 'bg-success/10 text-success' : 
                                            inst.dueDate < today.getTime() ? 'bg-danger/10 text-danger' : 'bg-yellow-500/10 text-yellow-600'
                                        }`}>
                                            {inst.status === InstallmentStatus.PAID ? 'Pago' : inst.dueDate < today.getTime() ? 'Atrasado' : 'Pendente'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Sale Details Modal */}
            {selectedSaleDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-50 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-white">Detalhes do Recebimento</h3>
                                <p className="text-xs text-slate-500 font-bold">Venda #{selectedSaleDetail.id.slice(-6)}</p>
                            </div>
                            <button onClick={() => setSelectedSaleDetail(null)} className="size-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Data da Venda</p>
                                    <p className="font-bold">{new Date(selectedSaleDetail.createdAt).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Valor Venda</p>
                                    <p className="font-bold text-primary">{formatCurrency(selectedSaleDetail.total)}</p>
                                </div>
                            </div>
                            
                            <div>
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3">Parcelas Geradas</h4>
                                <div className="space-y-2">
                                    {relevantInstallments.filter(i => i.saleId === selectedSaleDetail.id).sort((a,b) => a.number - b.number).map(i => (
                                        <div key={i.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                                            <div>
                                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{i.number}ª Parcela</span>
                                                <p className="text-[10px] text-slate-400 font-bold">{new Date(i.dueDate).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-slate-700 dark:text-slate-200">{formatCurrency(i.amount)}</span>
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                    i.status === InstallmentStatus.PAID ? 'bg-success/10 text-success' : 'bg-slate-200 text-slate-500'
                                                }`}>
                                                    {i.status === InstallmentStatus.PAID ? 'Pago' : 'Pendente'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    const customer = customers.find(c => c.id === selectedSaleDetail.customerId);
                                    if (customer) {
                                        // Pick current installment if possible or just first pending
                                        const inst = relevantInstallments.find(i => i.saleId === selectedSaleDetail.id && i.status !== InstallmentStatus.PAID);
                                        if (inst) handleWhatsApp(customer, inst);
                                        else alert('Todas as parcelas desta venda estão pagas.');
                                    }
                                }}
                                className="w-full h-14 bg-success text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg shadow-success/20 active:scale-[0.98] transition-all"
                            >
                                <span className="material-symbols-outlined">chat</span>
                                Entrar em contato via WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReceivablesView;
