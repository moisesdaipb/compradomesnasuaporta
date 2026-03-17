import React, { useState, useMemo } from 'react';
import { Sale, Installment, InstallmentStatus, PaymentMethod } from '../types';
import { formatCurrency } from '../utils';

interface PartialPaymentModalProps {
    sale: Sale;
    installment: Installment;
    allInstallments: Installment[];
    paymentMethod?: PaymentMethod | null;
    onClose: () => void;
    onSave: (saleId: string, updatedInstallments: any[]) => Promise<void>;
}

const PartialPaymentModal: React.FC<PartialPaymentModalProps> = ({
    sale,
    installment,
    allInstallments,
    paymentMethod,
    onClose,
    onSave,
}) => {
    const [receivedAmount, setReceivedAmount] = useState<string>(installment.amount.toString());
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(paymentMethod || installment.paymentMethod || PaymentMethod.CASH);
    const [isSaving, setIsSaving] = useState(false);

    // Filter installments that are NOT paid and belong to this sale
    // We sort them so we can redistribute correctly
    const pendingInstallments = useMemo(() => {
        return allInstallments
            .filter(i => i.saleId === sale.id && i.status !== InstallmentStatus.PAID)
            .sort((a, b) => a.number - b.number);
    }, [allInstallments, sale.id]);

    const paidInstallments = useMemo(() => {
        return allInstallments
            .filter(i => i.saleId === sale.id && i.status === InstallmentStatus.PAID);
    }, [allInstallments, sale.id]);

    const [editableInstallments, setEditableInstallments] = useState(
        pendingInstallments.map(i => ({ 
            id: i.id,
            dueDate: i.dueDate, 
            amount: i.amount,
            number: i.number,
            status: i.status
        }))
    );

    const currentInstallmentIndex = useMemo(() => {
        return editableInstallments.findIndex(i => i.id === installment.id);
    }, [editableInstallments, installment.id]);

    const handleReceivedAmountChange = (value: string) => {
        // Validate input - allow empty, digits, and a single decimal separator
        if (value !== '' && !/^\d*[.,]?\d*$/.test(value)) return;
        
        setReceivedAmount(value);
        
        // Convert comma to dot for parsing
        const floatStr = value.replace(',', '.');
        const amount = parseFloat(floatStr) || 0;
        
        // Update the current installment in our editable list
        const newInsts = [...editableInstallments];
        if (currentInstallmentIndex !== -1) {
            newInsts[currentInstallmentIndex].amount = amount;
            setEditableInstallments(newInsts);
        }
    };

    const redistributeRemaining = () => {
        const amountReceived = parseFloat(receivedAmount) || 0;
        const totalPendingBefore = pendingInstallments.reduce((acc, i) => acc + i.amount, 0);
        const remainingToDistribute = totalPendingBefore - amountReceived;

        if (editableInstallments.length <= 1 || currentInstallmentIndex === -1) return;

        // Installments after the current one
        const futureInstallments = editableInstallments.filter((_, idx) => idx > currentInstallmentIndex);
        
        if (futureInstallments.length === 0) {
            // No future installments, maybe we should suggest adding one?
            // For now, let's just keep the debt in the current one if it's the last one
            return;
        }

        const partialAmount = Math.floor((remainingToDistribute / futureInstallments.length) * 100) / 100;
        const remainder = Math.round((remainingToDistribute - (partialAmount * futureInstallments.length)) * 100) / 100;

        const newInsts = editableInstallments.map((inst, idx) => {
            if (idx === currentInstallmentIndex) {
                return { ...inst, amount: amountReceived };
            }
            if (idx > currentInstallmentIndex) {
                // Find index in futureInstallments to apply remainder to the first one
                const futureIdx = idx - currentInstallmentIndex - 1;
                return { 
                    ...inst, 
                    amount: futureIdx === 0 ? partialAmount + remainder : partialAmount 
                };
            }
            return inst;
        });

        setEditableInstallments(newInsts);
    };

    const addInstallment = () => {
        const lastInst = editableInstallments[editableInstallments.length - 1];
        const lastDate = lastInst ? lastInst.dueDate : Date.now();
        const nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + 1);

        setEditableInstallments([
            ...editableInstallments,
            {
                id: undefined as any, // New installment
                dueDate: nextDate.getTime(),
                amount: 0,
                number: editableInstallments.length + paidInstallments.length + 1,
                status: InstallmentStatus.PENDING
            }
        ]);
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

    const removeInstallment = (index: number) => {
        if (editableInstallments.length <= 1) return;
        // Cannot remove the one we are currently paying
        if (index === currentInstallmentIndex) return;
        
        setEditableInstallments(editableInstallments.filter((_, i) => i !== index));
    };

    const totalSum = useMemo(() => {
        const paidSum = paidInstallments.reduce((acc, i) => acc + i.amount, 0);
        const pendingSum = editableInstallments.reduce((acc, i) => acc + i.amount, 0);
        return Math.round((paidSum + pendingSum) * 100) / 100;
    }, [paidInstallments, editableInstallments]);

    const difference = useMemo(() => 
        Math.round((sale.total - totalSum) * 100) / 100, 
    [sale.total, totalSum]);

    const isTotalValid = Math.abs(difference) < 0.01;

    const handleSave = async () => {
        if (!isTotalValid) {
            alert(`Erro: A soma das parcelas (R$ ${totalSum.toFixed(2)}) deve ser igual ao total da venda (R$ ${sale.total.toFixed(2)})`);
            return;
        }

        try {
            setIsSaving(true);
            
            // Format for the database - using camelCase to match the frontend state
            // and allowing handleUpdateInstallments in App.tsx to handle the mapping to DB
            const installmentsToSave = [
                ...paidInstallments.map(i => ({
                    id: i.id,
                    saleId: sale.id,
                    customerId: i.customerId,
                    customerName: i.customerName || sale.customerName,
                    number: i.number,
                    totalInstallments: editableInstallments.length + paidInstallments.length,
                    amount: i.amount,
                    dueDate: i.dueDate,
                    status: i.status,
                    paidAt: i.paidAt,
                    paymentMethod: i.paymentMethod
                })),
                ...editableInstallments.map((i, idx) => {
                    const isBeingPaid = i.id === installment.id && i.amount > 0;
                    const finalStatus = isBeingPaid ? InstallmentStatus.PAID : i.status;
                    return {
                        id: i.id || undefined,
                        saleId: sale.id,
                        customerId: sale.customerId,
                        customerName: sale.customerName || installment.customerName,
                        number: idx + paidInstallments.length + 1,
                        totalInstallments: editableInstallments.length + paidInstallments.length,
                        amount: i.amount,
                        dueDate: i.dueDate,
                        status: finalStatus,
                        paidAt: isBeingPaid ? Date.now() : (i.status === InstallmentStatus.PAID ? i.paidAt : null),
                        paymentMethod: isBeingPaid ? selectedMethod : (i.status === InstallmentStatus.PAID ? i.paymentMethod : null)
                    };
                })
            ];

            await onSave(sale.id, installmentsToSave);
            onClose();
        } catch (error: any) {
            console.error('Error saving partial payment:', error);
            alert('Erro ao salvar pagamento: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-xl font-black italic">Pagamento Customizado</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sale.customerName}</p>
                    </div>
                    <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto no-scrollbar flex-1">
                    {/* Received Amount Input */}
                    <div className="bg-primary/5 p-6 rounded-[24px] border border-primary/10">
                        <label className="text-[10px] font-black uppercase tracking-widest text-primary mb-2 block">Quanto o cliente está pagando hoje?</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black text-primary/40 italic">R$</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                autoFocus
                                value={receivedAmount}
                                onChange={(e) => handleReceivedAmountChange(e.target.value)}
                                className="w-full h-16 pl-16 pr-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-primary/20 text-3xl font-black text-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none italic"
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-3 text-center uppercase tracking-widest">
                            Valor original desta parcela: <span className="text-slate-600 dark:text-slate-200">R$ {installment.amount.toFixed(2)}</span>
                        </p>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Meio de Pagamento</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: PaymentMethod.PIX, icon: 'qr_code_2', label: 'PIX' },
                                { id: PaymentMethod.CARD, icon: 'credit_card', label: 'Cartão' },
                                { id: PaymentMethod.CASH, icon: 'payments', label: 'Dinheiro' }
                            ].map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setSelectedMethod(method.id as PaymentMethod)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1 ${
                                        selectedMethod === method.id
                                        ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10'
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200'
                                    }`}
                                >
                                    <span className="material-symbols-outlined">{method.icon}</span>
                                    <span className="text-[9px] font-black uppercase">{method.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Redistribution Area */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Redistribuição do Saldo</h4>
                            <div className="flex gap-2">
                                <button 
                                    onClick={redistributeRemaining}
                                    className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-colors"
                                >
                                    Dividir Restante
                                </button>
                                <button 
                                    onClick={addInstallment}
                                    className="px-3 py-1 bg-success/10 text-success rounded-lg text-[10px] font-black uppercase hover:bg-success/20 transition-colors flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-xs">add</span>
                                    Nova Parcela
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {editableInstallments.map((inst, idx) => {
                                const isCurrent = inst.id === installment.id;
                                return (
                                    <div key={idx} className={`p-4 rounded-2xl border transition-all ${
                                        isCurrent 
                                        ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/5' 
                                        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800'
                                    }`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-black uppercase ${isCurrent ? 'text-primary' : 'text-slate-400'}`}>
                                                    Parcela {inst.number}
                                                </span>
                                                {isCurrent && (
                                                    <span className="px-1.5 py-0.5 bg-primary text-white text-[8px] font-black uppercase rounded">Hoje</span>
                                                )}
                                            </div>
                                            {!isCurrent && (
                                                <button 
                                                    onClick={() => removeInstallment(idx)}
                                                    className="size-6 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Vencimento</label>
                                                <input
                                                    type="date"
                                                    value={new Date(inst.dueDate).toISOString().split('T')[0]}
                                                    readOnly={isCurrent}
                                                    onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)}
                                                    className={`w-full h-10 px-3 rounded-xl border text-xs font-bold ${
                                                        isCurrent 
                                                        ? 'bg-primary/10 border-transparent text-primary' 
                                                        : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700'
                                                    }`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Valor</label>
                                                <div className="relative">
                                                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold ${isCurrent ? 'text-primary' : 'text-slate-400'}`}>R$</span>
                                                    <input
                                                        type="number"
                                                        value={inst.amount}
                                                        readOnly={isCurrent}
                                                        onChange={(e) => updateInstallment(idx, 'amount', e.target.value)}
                                                        className={`w-full h-10 pl-8 pr-3 rounded-xl border text-xs font-bold ${
                                                            isCurrent 
                                                            ? 'bg-primary/10 border-transparent text-primary' 
                                                            : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer with Summary */}
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 space-y-4 shrink-0">
                    <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                        isTotalValid 
                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' 
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900'
                    }`}>
                        <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Novo Total da Venda</p>
                            <p className={`text-xl font-black ${isTotalValid ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>
                                R$ {totalSum.toFixed(2)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Diferença</p>
                            <p className={`text-xl font-black ${isTotalValid ? 'text-success' : 'text-red-500'}`}>
                                {difference === 0 ? 'Zerado' : `R$ ${difference > 0 ? '-' : '+'}${Math.abs(difference).toFixed(2)}`}
                            </p>
                        </div>
                    </div>

                    {!isTotalValid && (
                        <p className="text-[10px] font-bold text-red-500 text-center italic animate-pulse">
                            A soma das parcelas deve ser R$ {sale.total.toFixed(2)}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 h-14 rounded-2xl font-black text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 active:scale-95 transition-all uppercase tracking-widest text-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isTotalValid || isSaving}
                            className={`flex-[2] h-14 rounded-2xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs ${
                                (isTotalValid && !isSaving)
                                ? 'bg-primary shadow-primary/20' 
                                : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                            }`}
                        >
                            {isSaving ? (
                                <>
                                    <span className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-base">check_circle</span>
                                    Confirmar Pagamento
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PartialPaymentModal;
