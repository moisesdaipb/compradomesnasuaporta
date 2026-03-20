import React, { useState, useEffect, useMemo } from 'react';
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
    const initialInstallments = installments
        .filter(i => i.saleId === sale.id)
        .sort((a, b) => a.number - b.number);
    
    const [editableInstallments, setEditableInstallments] = useState(
        initialInstallments.map(i => ({ dueDate: i.dueDate, amount: i.amount }))
    );

    const handleNumInstallmentsChange = (count: number) => {
        const newCount = Math.max(1, count);
        let newInsts = [...editableInstallments];
        
        if (newCount > newInsts.length) {
            // Add new installments
            for (let i = newInsts.length; i < newCount; i++) {
                const lastDate = newInsts.length > 0 ? newInsts[newInsts.length - 1].dueDate : Date.now();
                const nextDate = new Date(lastDate);
                nextDate.setMonth(nextDate.getMonth() + 1);
                
                newInsts.push({
                    dueDate: nextDate.getTime(),
                    amount: 0 // New installment defaults to 0
                });
            }
        } else {
            // Remove installments
            newInsts = newInsts.slice(0, newCount);
        }
        setEditableInstallments(newInsts);
    };

    const updateInstallment = (index: number, field: 'dueDate' | 'amount', value: any) => {
        const newInsts = [...editableInstallments];
        if (field === 'dueDate') {
            newInsts[index].dueDate = new Date(value).getTime();
        } else {
            newInsts[index].amount = parseFloat(value) || 0;
        }
        setEditableInstallments(newInsts);
    };

    const redistributeTotal = () => {
        const totalVal = parseFloat(total) || 0;
        if (editableInstallments.length === 0) return;
        
        const partialAmount = Math.floor((totalVal / editableInstallments.length) * 100) / 100;
        const remainder = Math.round((totalVal - (partialAmount * editableInstallments.length)) * 100) / 100;
        
        const newInsts = editableInstallments.map((inst, idx) => ({
            ...inst,
            amount: idx === 0 ? partialAmount + remainder : partialAmount
        }));
        setEditableInstallments(newInsts);
    };

    const totalVal = useMemo(() => {
        const parsed = parseFloat(total.replace(',', '.'));
        return isNaN(parsed) ? 0 : parsed;
    }, [total]);

    const installmentsSum = useMemo(() => {
        if (paymentMethod !== PaymentMethod.TERM) return totalVal;
        const sum = editableInstallments.reduce((acc, inst) => acc + (inst.amount || 0), 0);
        return Math.round(sum * 100) / 100;
    }, [editableInstallments, paymentMethod, totalVal]);

    const difference = useMemo(() => 
        Math.round((totalVal - installmentsSum) * 100) / 100, 
    [totalVal, installmentsSum]);

    const isTotalValid = useMemo(() => 
        paymentMethod !== PaymentMethod.TERM || Math.abs(difference) < 0.01, 
    [paymentMethod, difference]);

    const handleSave = () => {
        // Final sanity check before saving
        const currentSum = paymentMethod === PaymentMethod.TERM 
            ? Math.round(editableInstallments.reduce((acc, inst) => acc + (inst.amount || 0), 0) * 100) / 100
            : totalVal;
            
        if (paymentMethod === PaymentMethod.TERM && Math.abs(totalVal - currentSum) >= 0.01) {
            alert(`Erro: A soma das parcelas (R$ ${currentSum.toFixed(2)}) deve ser exatamente igual ao total (R$ ${totalVal.toFixed(2)})`);
            return;
        }

        const updatedSaleData: Partial<Sale> = {
            customerId,
            customerName: customers.find(c => c.id === customerId)?.name || sale.customerName,
            total: totalVal,
            paymentMethod,
            status: sale.status, // Preserve current status
            notes,
        };

        const updatedInstallments = editableInstallments.map((inst, index) => ({
            id: initialInstallments[index]?.id || undefined, // Keep ID if it exists (reusing old slots)
            saleId: sale.id,
            customerId: customerId,
            customerName: updatedSaleData.customerName,
            number: index + 1,
            totalInstallments: editableInstallments.length,
            dueDate: inst.dueDate,
            amount: inst.amount,
            status: initialInstallments[index]?.status || 'Pendente'
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
                    {/* Customer (Read Only) */}
                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Cliente</label>
                        <div className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center">
                            <span className="font-bold text-slate-500">{customers.find(c => c.id === customerId)?.name || sale.customerName}</span>
                            <span className="material-symbols-outlined ml-auto text-slate-300 text-sm">lock</span>
                        </div>
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

                    {/* Installments Editing */}
                    {paymentMethod === PaymentMethod.TERM && (
                        <div className="space-y-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-[24px] border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Configurar Parcelas</p>
                                <button 
                                    onClick={redistributeTotal}
                                    className="text-[10px] font-black uppercase text-blue-600 hover:underline"
                                >
                                    Dividir Automático
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Nº de Parcelas</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="24"
                                        value={editableInstallments.length}
                                        onChange={(e) => handleNumInstallmentsChange(parseInt(e.target.value))}
                                        className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pr-1">
                                {editableInstallments.map((inst, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Parcela {idx + 1}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Vencimento</label>
                                                <input
                                                    type="date"
                                                    value={new Date(inst.dueDate).toISOString().split('T')[0]}
                                                    onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)}
                                                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Valor</label>
                                                <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">R$</span>
                                                    <input
                                                        type="number"
                                                        value={inst.amount}
                                                        onChange={(e) => updateInstallment(idx, 'amount', e.target.value)}
                                                        className="w-full h-9 pl-7 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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

                <div className="p-6 bg-slate-50 dark:bg-slate-800/30 space-y-3">
                    {paymentMethod === PaymentMethod.TERM && (
                        <div className={`p-4 rounded-2xl border flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300 ${
                            isTotalValid 
                            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800' 
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-sm ${isTotalValid ? 'text-success' : 'text-red-500'}`}>
                                        {isTotalValid ? 'check_circle' : 'warning'}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resumo da Conferência</span>
                                </div>
                                {!isTotalValid && (
                                    <button 
                                        onClick={redistributeTotal}
                                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-[9px] font-black uppercase shadow-sm"
                                    >
                                        Auto-Ajustar
                                    </button>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mt-1">
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase font-bold">Soma das Parcelas</p>
                                    <p className={`text-lg font-black ${isTotalValid ? 'text-slate-700 dark:text-slate-200' : 'text-red-600 animate-pulse'}`}>
                                        R$ {installmentsSum.toFixed(2)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-400 uppercase font-bold">Diferença</p>
                                    <p className={`text-lg font-black ${isTotalValid ? 'text-success' : 'text-red-600'}`}>
                                        {difference === 0 ? 'Zerado' : `R$ ${difference > 0 ? '-' : '+'}${Math.abs(difference).toFixed(2)}`}
                                    </p>
                                </div>
                            </div>

                            {!isTotalValid && (
                                <p className="text-[10px] font-bold text-red-500 mt-1 italic">
                                    * O salvamento está bloqueado até que a diferença seja zero.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl font-bold text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isTotalValid}
                            className={`flex-[2] h-12 rounded-xl font-bold text-white shadow-lg active:scale-95 transition-all ${
                                isTotalValid 
                                ? 'bg-primary shadow-primary/20' 
                                : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                            }`}
                        >
                            {isTotalValid ? 'Salvar Alterações' : 'Ajustar Totais'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditSaleModal;
