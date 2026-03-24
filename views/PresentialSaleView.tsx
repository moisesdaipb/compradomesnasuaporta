import React, { useState } from 'react';
import { ViewState, BasketModel, StockItem, Customer, SaleItem, PaymentMethod } from '../types';
import { getStockQuantity } from '../store';
import { formatCurrency } from '../utils';

interface PresentialSaleViewProps {
    basketModels: BasketModel[];
    stock: StockItem[];
    customers: Customer[];
    selectedCustomer: Customer | null;
    onSelectCustomer: (customer: Customer | null) => void;
    onCreateSale: (
        customerId: string,
        customerName: string,
        items: SaleItem[],
        paymentMethod: PaymentMethod,
        channel: 'online' | 'presencial',
        installmentsCount?: number,
        installmentDates?: number[],
        deliveryInfo?: { address: string; number: string; contact: string; notes?: string },
        installmentAmounts?: number[],
        paymentSubMethod?: string,
        changeAmount?: number,
    ) => void;
    setView: (v: ViewState) => void;
}

const PresentialSaleView: React.FC<PresentialSaleViewProps> = ({
    basketModels,
    stock,
    customers,
    selectedCustomer,
    onSelectCustomer,
    onCreateSale,
    setView,
}) => {
    const [step, setStep] = useState<'product' | 'payment' | 'installments' | 'success'>(
        selectedCustomer ? 'product' : 'product'
    );
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [quantity, setQuantity] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [installmentDates, setInstallmentDates] = useState<number[]>([]);
    const [distributionType, setDistributionType] = useState<'equal' | 'custom'>('equal');
    const [customAmounts, setCustomAmounts] = useState<string[]>([]);

    const activeModels = basketModels.filter(m => m.active);
    const model = basketModels.find(m => m.id === selectedModel);
    const stockQty = selectedModel ? getStockQuantity(stock, selectedModel) : 0;
    const total = model ? model.price * quantity : 0;

    const handleConfirm = () => {
        if (!selectedCustomer || !model) return;

        if (paymentMethod === PaymentMethod.TERM) {
            const unfilled = installmentDates.slice(0, installmentsCount).some(d => d === 0);
            if (unfilled) {
                alert('Por favor, selecione as datas de vencimento de todas as parcelas.');
                return;
            }
        }

        const items: SaleItem[] = [{
            basketModelId: model.id,
            basketName: model.name,
            quantity,
            unitPrice: model.price,
        }];

        onCreateSale(
            selectedCustomer.id,
            selectedCustomer.name,
            items,
            paymentMethod,
            'presencial',
            paymentMethod === PaymentMethod.TERM ? installmentsCount : undefined,
            paymentMethod === PaymentMethod.TERM ? installmentDates : undefined,
            undefined,
            paymentMethod === PaymentMethod.TERM && distributionType === 'custom'
                ? customAmounts.map(a => parseFloat(a) || 0)
                : undefined,
            undefined, // paymentSubMethod
            undefined, // changeAmount
        );

        setStep('success');
    };

    const generateInstallmentDates = (count: number) => {
        const dates: number[] = [];
        const today = new Date();
        for (let i = 1; i <= count; i++) {
            // We set to 0 to represent "blank" as requested by user
            dates.push(0);
        }
        setInstallmentDates(dates);

        // Reset custom amounts when count changes
        const equalAmount = (total / count).toFixed(2);
        setCustomAmounts(Array(count).fill(equalAmount));
    };

    const totalCustom = customAmounts.slice(0, installmentsCount).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
    const isValidCustom = Math.abs(totalCustom - total) < 0.01;

    // Success Screen
    if (step === 'success') {
        return (
            <div className="flex flex-col h-full items-center justify-center px-8 text-center animate-in fade-in duration-500">
                <div className="size-24 bg-success/10 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                    <span className="material-symbols-outlined text-5xl text-success">check_circle</span>
                </div>
                <h2 className="text-2xl font-black mb-2">Venda Realizada!</h2>
                <p className="text-slate-500 mb-2">
                    {model?.name} para {selectedCustomer?.name}
                </p>
                <p className="text-2xl font-black text-primary mb-8">{formatCurrency(total)}</p>
                <button
                    onClick={() => {
                        setStep('product');
                        setSelectedModel('');
                        setQuantity(1);
                        onSelectCustomer(null);
                    }}
                    className="px-8 py-4 bg-primary text-white font-bold rounded-xl"
                >
                    Nova Venda
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300 overflow-y-auto no-scrollbar pb-64">
            {/* Header */}
            <div className="px-4 py-2 mt-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h3 className="text-lg font-bold leading-tight">Venda Presencial</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {step === 'product' ? 'Selecione o produto' : step === 'payment' ? 'Forma de pagamento' : 'Parcelas'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Progress */}
            <div className="px-4 mt-2">
                <div className="flex gap-2">
                    {['Cliente', 'Produto', 'Pagamento'].map((s, idx) => (
                        <div key={s} className="flex-1">
                            <div className={`h-1 rounded-full ${(idx === 0 && selectedCustomer) ||
                                (idx === 1 && (step === 'payment' || step === 'installments')) ||
                                (idx === 2 && step === 'installments')
                                ? 'bg-primary'
                                : 'bg-slate-200 dark:bg-slate-700'
                                }`} />
                            <p className="text-[10px] text-slate-400 mt-1 text-center">{s}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Selected Customer */}
            {selectedCustomer && (
                <div className="mx-4 mt-4 p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">person</span>
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-sm">{selectedCustomer.name}</p>
                        <p className="text-xs text-slate-500">{selectedCustomer.phone}</p>
                    </div>
                    <button
                        onClick={() => setView('customer-register')}
                        className="text-xs text-primary font-medium"
                    >
                        Alterar
                    </button>
                </div>
            )}

            {!selectedCustomer && (
                <div className="mx-4 mt-4">
                    <button
                        onClick={() => setView('customer-register')}
                        className="w-full p-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl flex items-center justify-center gap-2 text-slate-500"
                    >
                        <span className="material-symbols-outlined">person_add</span>
                        Selecionar Cliente
                    </button>
                </div>
            )}

            <div className="p-4">
                {step === 'product' && (
                    <>
                        {/* Product Selection */}
                        <h4 className="font-bold mb-3">Selecione o Modelo</h4>
                        <div className="space-y-3">
                            {activeModels.map(m => {
                                const qty = getStockQuantity(stock, m.id);
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedModel(m.id)}
                                        disabled={qty <= 0}
                                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${selectedModel === m.id
                                            ? 'border-primary bg-primary/5'
                                            : qty <= 0
                                                ? 'border-slate-200 dark:border-slate-700 opacity-50'
                                                : 'border-slate-200 dark:border-slate-700'
                                            }`}
                                    >
                                        <img src={m.image} alt={m.name} className="size-16 rounded-xl object-cover" />
                                        <div className="flex-1 text-left">
                                            <p className="font-bold">{m.name}</p>
                                            <p className="text-lg font-black text-primary">{formatCurrency(m.price)}</p>
                                            <p className={`text-xs ${qty < 20 ? 'text-danger' : 'text-slate-400'}`}>
                                                {qty > 0 ? `${qty} em estoque` : 'Sem estoque'}
                                            </p>
                                        </div>
                                        {selectedModel === m.id && (
                                            <span className="material-symbols-outlined text-primary">check_circle</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quantity */}
                        {selectedModel && (
                            <div className="mt-6">
                                <h4 className="font-bold mb-3">Quantidade</h4>
                                <div className="flex items-center gap-4 justify-center">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="size-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center active:scale-95"
                                    >
                                        <span className="material-symbols-outlined">remove</span>
                                    </button>
                                    <span className="text-3xl font-black w-16 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(Math.min(stockQty, quantity + 1))}
                                        className="size-12 rounded-xl bg-primary text-white flex items-center justify-center active:scale-95"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {step === 'payment' && (
                    <>
                        <h4 className="font-bold mb-3">Forma de Pagamento</h4>
                        <div className="space-y-3">
                            {[
                                { method: PaymentMethod.PIX, icon: 'qr_code_2', label: 'PIX', desc: 'Pagamento instantâneo' },
                                { method: PaymentMethod.CARD, icon: 'credit_card', label: 'Cartão', desc: 'Maquininha física' },
                                { method: PaymentMethod.TERM, icon: 'calendar_month', label: 'Parcelado', desc: 'Pagamento parcelado' },
                            ].map(option => (
                                <button
                                    key={option.method}
                                    onClick={() => {
                                        setPaymentMethod(option.method);
                                        if (option.method === PaymentMethod.TERM) {
                                            generateInstallmentDates(installmentsCount);
                                        }
                                    }}
                                    className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${paymentMethod === option.method
                                        ? 'border-primary bg-primary/5'
                                        : 'border-slate-200 dark:border-slate-700'
                                        }`}
                                >
                                    <div className={`size-12 rounded-xl flex items-center justify-center ${paymentMethod === option.method
                                        ? 'bg-primary text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                                        }`}>
                                        <span className="material-symbols-outlined">{option.icon}</span>
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="font-bold">{option.label}</p>
                                        <p className="text-xs text-slate-500">{option.desc}</p>
                                    </div>
                                    {paymentMethod === option.method && (
                                        <span className="material-symbols-outlined text-primary">check_circle</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {step === 'installments' && (
                    <>
                        <h4 className="font-bold mb-3">Configurar Parcelas</h4>

                        {/* Number of Installments */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-4">
                            <p className="text-sm text-slate-500 mb-3">Número de Parcelas</p>
                            <div className="flex gap-2 flex-wrap">
                                {[1, 2, 3, 4, 5, 6].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => {
                                            setInstallmentsCount(n);
                                            generateInstallmentDates(n);
                                        }}
                                        className={`px-4 py-2 rounded-lg font-bold ${installmentsCount === n
                                            ? 'bg-primary text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                    >
                                        {n}x
                                    </button>
                                ))}
                            </div>

                            <div className="flex p-1 bg-slate-50 dark:bg-slate-700 rounded-xl mt-4 mb-2">
                                <button
                                    onClick={() => setDistributionType('equal')}
                                    className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${distributionType === 'equal' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary' : 'text-slate-400'}`}
                                >
                                    Parcelas Iguais
                                </button>
                                <button
                                    onClick={() => setDistributionType('custom')}
                                    className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${distributionType === 'custom' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary' : 'text-slate-400'}`}
                                >
                                    Personalizar Valores
                                </button>
                            </div>

                            {distributionType === 'equal' ? (
                                <p className="text-lg font-bold text-primary mt-3">
                                    {installmentsCount}x de {formatCurrency(total / installmentsCount)}
                                </p>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {customAmounts.slice(0, installmentsCount).map((amt, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-slate-400 w-8">{idx + 1}ª</span>
                                            <div className="flex-1 relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                                <input
                                                    type="number"
                                                    value={amt}
                                                    onChange={(e) => {
                                                        const newAmts = [...customAmounts];
                                                        newAmts[idx] = e.target.value;
                                                        setCustomAmounts(newAmts);
                                                    }}
                                                    className="w-full h-11 pl-8 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <div className={`p-3 rounded-xl flex items-center justify-between mt-4 ${isValidCustom ? 'bg-success/5 border border-success/20' : 'bg-danger/5 border border-danger/20'}`}>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Soma das Parcelas</span>
                                            <span className={`text-sm font-black ${isValidCustom ? 'text-success' : 'text-danger'}`}>{formatCurrency(totalCustom)}</span>
                                        </div>
                                        {!isValidCustom && (
                                            <span className="text-[10px] font-bold text-danger max-w-[120px] text-right">A soma deve ser {formatCurrency(total)}</span>
                                        )}
                                        {isValidCustom && (
                                            <span className="material-symbols-outlined text-success">check_circle</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Installment Dates */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <p className="text-sm text-slate-500 mb-3">Datas de Vencimento</p>
                            <div className="space-y-2">
                                {installmentDates.slice(0, installmentsCount).map((date, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                        <span className="text-sm">Parcela {idx + 1}</span>
                                        <input
                                            type="date"
                                            value={date > 0 ? new Date(date).toISOString().split('T')[0] : ''}
                                            onChange={(e) => {
                                                const newDates = [...installmentDates];
                                                newDates[idx] = new Date(e.target.value).getTime();
                                                setInstallmentDates(newDates);
                                            }}
                                            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-primary outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Footer Actions */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
                {/* Summary */}
                {selectedModel && model && (
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-3 mb-3 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-400">{quantity}x {model.name}</p>
                            <p className="text-xl font-black text-primary">{formatCurrency(total)}</p>
                        </div>
                    </div>
                )}

                {step === 'product' && (
                    <button
                        onClick={() => setStep('payment')}
                        disabled={!selectedCustomer || !selectedModel}
                        className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${selectedCustomer && selectedModel
                            ? 'bg-primary text-white shadow-lg active:scale-[0.98]'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        Continuar para Pagamento
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                )}

                {step === 'payment' && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep('product')}
                            className="h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-600 font-medium"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <button
                            onClick={() => {
                                if (paymentMethod === PaymentMethod.TERM) {
                                    setStep('installments');
                                } else {
                                    handleConfirm();
                                }
                            }}
                            className="flex-1 h-14 bg-success text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                        >
                            {paymentMethod === PaymentMethod.TERM ? (
                                <>
                                    Configurar Parcelas
                                    <span className="material-symbols-outlined">arrow_forward</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">check</span>
                                    Confirmar Venda
                                </>
                            )}
                        </button>
                    </div>
                )}

                {step === 'installments' && (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setStep('payment')}
                            className="h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-600 font-medium"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={distributionType === 'custom' && !isValidCustom}
                            className={`flex-1 h-14 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${distributionType === 'custom' && !isValidCustom
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-success text-white active:scale-[0.98]'
                                }`}
                        >
                            <span className="material-symbols-outlined">check</span>
                            Confirmar Venda
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PresentialSaleView;
