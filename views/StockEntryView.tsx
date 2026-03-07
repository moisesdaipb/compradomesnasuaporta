import React, { useState } from 'react';
import { ViewState, BasketModel, StockEntry, StockItem } from '../types';
import { SUPPLIERS } from '../constants';
import { getStockQuantity } from '../store';

interface StockEntryViewProps {
    basketModels: BasketModel[];
    stock: StockItem[];
    onAddEntry: (entry: Omit<StockEntry, 'id' | 'createdBy'>) => Promise<void>;
    setView: (v: ViewState) => void;
}

const StockEntryView: React.FC<StockEntryViewProps> = ({
    basketModels,
    stock,
    onAddEntry,
    setView,
}) => {
    const [selectedModel, setSelectedModel] = useState('');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [supplier, setSupplier] = useState('');
    const [notes, setNotes] = useState('');
    const [success, setSuccess] = useState(false);

    const activeModels = basketModels.filter(m => m.active);

    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedModel || !quantity || !unitCost || !supplier) return;

        setLoading(true);
        try {
            await onAddEntry({
                basketModelId: selectedModel,
                quantity: parseInt(quantity),
                unitCost: parseFloat(unitCost),
                supplier,
                receivedAt: Date.now(),
                notes: notes || undefined,
            });

            // Reset form
            setSelectedModel('');
            setQuantity('');
            setUnitCost('');
            setSupplier('');
            setNotes('');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error: any) {
            console.error('[StockEntryView] Submit failed:', error);
            // Alert is already shown by handleAddStockEntry in App.tsx
        } finally {
            setLoading(false);
        }
    };

    const selectedModelData = basketModels.find(m => m.id === selectedModel);
    const currentStock = selectedModel ? getStockQuantity(stock, selectedModel) : 0;

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('stock')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h3 className="text-lg font-bold leading-tight">Entrada de Estoque</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Registrar cestas do fornecedor</p>
                    </div>
                </div>
            </div>

            {/* Success Message */}
            {success && (
                <div className="mx-4 mt-4 p-4 bg-success/10 border border-success/20 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <span className="material-symbols-outlined text-success">check_circle</span>
                    <p className="text-success font-medium">Estoque atualizado com sucesso!</p>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4 pb-40 overflow-y-auto">
                {/* Model Selection */}
                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 block">
                        Modelo da Cesta
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {activeModels.map(model => (
                            <button
                                key={model.id}
                                type="button"
                                onClick={() => setSelectedModel(model.id)}
                                className={`p-3 rounded-xl border-2 transition-all text-left ${selectedModel === model.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                    }`}
                            >
                                <img src={model.image} alt={model.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                                <p className="font-bold text-sm truncate">{model.name}</p>
                                <p className="text-xs text-slate-500">
                                    Estoque: <span className={getStockQuantity(stock, model.id) < 50 ? 'text-danger' : 'text-success'}>
                                        {getStockQuantity(stock, model.id)}
                                    </span>
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Selected Model Info */}
                {selectedModelData && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                        <div className="flex items-center gap-3">
                            <img src={selectedModelData.image} alt="" className="size-12 rounded-lg object-cover" />
                            <div className="flex-1">
                                <p className="font-bold">{selectedModelData.name}</p>
                                <p className="text-sm text-slate-500">Preço: R$ {selectedModelData.price.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400">Estoque Atual</p>
                                <p className="text-xl font-black text-primary">{currentStock}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quantity */}
                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                        Quantidade Recebida
                    </label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent text-lg font-bold"
                        placeholder="0"
                        min="1"
                    />
                    {quantity && selectedModel && (
                        <p className="text-sm text-success mt-1">
                            Novo estoque: {currentStock + parseInt(quantity || '0')} unidades
                        </p>
                    )}
                </div>

                {/* Unit Cost */}
                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                        Custo Unitário (R$)
                    </label>
                    <input
                        type="number"
                        value={unitCost}
                        onChange={(e) => setUnitCost(e.target.value)}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent text-lg"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                    />
                    {quantity && unitCost && (
                        <p className="text-sm text-slate-500 mt-1">
                            Total: R$ {(parseInt(quantity) * parseFloat(unitCost)).toFixed(2)}
                        </p>
                    )}
                </div>

                {/* Supplier */}
                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                        Fornecedor
                    </label>
                    <select
                        value={supplier}
                        onChange={(e) => setSupplier(e.target.value)}
                        className="w-full h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                        <option value="">Selecione o fornecedor</option>
                        {SUPPLIERS.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                {/* Notes */}
                <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                        Observações (opcional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-24 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                        placeholder="Número da nota fiscal, lote, etc..."
                    />
                </div>
            </form>

            {/* Submit Button */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
                <button
                    onClick={handleSubmit}
                    disabled={!selectedModel || !quantity || !unitCost || !supplier || loading}
                    className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${selectedModel && quantity && unitCost && supplier && !loading
                        ? 'bg-success text-white shadow-lg active:scale-[0.98]'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                >
                    <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>
                        {loading ? 'sync' : 'inventory'}
                    </span>
                    {loading ? 'Registrando...' : 'Registrar Entrada'}
                </button>
            </div>
        </div>
    );
};

export default StockEntryView;
