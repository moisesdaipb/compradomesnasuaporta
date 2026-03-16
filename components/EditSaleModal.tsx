import React, { useState, useEffect } from 'react';
import { Sale, Customer, PaymentMethod, BasketModel, Installment, OrderStatus } from '../types';
import { formatCurrency } from '../utils';

interface EditSaleModalProps {
    sale: Sale;
    customers: Customer[];
    basketModels: BasketModel[];
    installments: Installment[];
    onClose: () => void;
    onSave: (saleId: string, saleData: Partial<Sale>, items: any[], installments: any[]) => void;
}

const EditSaleModal: React.FC<EditSaleModalProps> = ({
    sale,
    customers,
    basketModels,
    installments,
    onClose,
    onSave,
}) => {
    const [customerId, setCustomerId] = useState(sale.customerId);
    const [total, setTotal] = useState(sale.total.toString());
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(sale.paymentMethod);
    const [notes, setNotes] = useState(sale.notes || '');
    
    // Installments editing
    const saleInstallments = installments
        .filter(i => i.saleId === sale.id)
        .sort((a, b) => a.number - b.number);
    
    const [instDates, setInstDates] = useState<number[]>(
        saleInstallments.map(i => i.dueDate)
    );

    const handleDateChange = (index: number, dateStr: string) => {
        const newDates = [...instDates];
        newDates[index] = new Date(dateStr).getTime();
        setInstDates(newDates);
    };

    const handleSave = () => {
        const updatedSaleData: Partial<Sale> = {
            customerId,
            customerName: customers.find(c => c.id === customerId)?.name || sale.customerName,
            total: parseFloat(total),
            paymentMethod,
            notes,
        };

        const updatedInstallments = saleInstallments.map((inst, index) => ({
            ...inst,
            dueDate: instDates[index],
            amount: updatedSaleData.total! / saleInstallments.length // Recalculate if total changed
        }));

        onSave(sale.id, updatedSaleData, sale.items, updatedInstallments);
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-xl font-black">Editar Venda</h3>
                    <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                    {/* Customer */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Cliente</label>
                        <select
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                        >
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Total & Payment Method */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Valor Total</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                                <input
                                    type="number"
                                    value={total}
                                    onChange={(e) => setTotal(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Pagamento</label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                            >
                                <option value={PaymentMethod.PIX}>Pix</option>
                                <option value={PaymentMethod.CARD}>Cartão</option>
                                <option value={PaymentMethod.TERM}>A Prazo</option>
                                <option value={PaymentMethod.ON_DELIVERY}>Na Entrega</option>
                            </select>
                        </div>
                    </div>

                    {/* Installments Dates */}
                    {paymentMethod === PaymentMethod.TERM && instDates.length > 0 && (
                        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Datas das Parcelas</p>
                            {instDates.map((date, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4">
                                    <span className="text-xs font-bold text-slate-500">Parcela {idx + 1}</span>
                                    <input
                                        type="date"
                                        value={new Date(date).toISOString().split('T')[0]}
                                        onChange={(e) => handleDateChange(idx, e.target.value)}
                                        className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Observações</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-sm min-h-[80px]"
                            placeholder="Adicione observações aqui..."
                        />
                    </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/30 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 h-12 rounded-xl font-bold text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-[2] h-12 rounded-xl font-bold text-white bg-primary shadow-lg shadow-primary/20 active:scale-95 transition-all"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditSaleModal;
