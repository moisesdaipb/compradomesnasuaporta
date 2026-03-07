import React, { useState } from 'react';
import { ViewState, BasketModel, StockItem, StockEntry, UserRole } from '../types';
import { getStockQuantity } from '../store';

interface StockViewProps {
    basketModels: BasketModel[];
    stock: StockItem[];
    stockEntries: StockEntry[];
    userRole: UserRole;
    onDeleteEntry: (id: string) => void;
    onDeleteModel: (id: string) => void;
    onDecreaseStock: (modelId: string, quantity: number, notes: string) => void;
    setView: (v: ViewState) => void;
}

const StockView: React.FC<StockViewProps> = ({
    basketModels,
    stock,
    stockEntries,
    userRole,
    onDeleteEntry,
    onDeleteModel,
    onDecreaseStock,
    setView,
}) => {
    const [activeTab, setActiveTab] = useState<'resumo' | 'historico'>('resumo');

    const activeModels = basketModels.filter(b => b.active);

    const handleDecreaseClick = (modelId: string) => {
        const qtyStr = window.prompt('Quantidade para diminuir (ex: 5):');
        if (!qtyStr) return;
        const qty = parseInt(qtyStr);
        if (isNaN(qty) || qty <= 0) {
            alert('Quantidade inválida.');
            return;
        }
        const notes = window.prompt('Motivo do ajuste (ex: Cesta danificada):') || 'Ajuste Manual';
        onDecreaseStock(modelId, qty, notes);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold">Gerenciamento de Estoque</h3>
                    {userRole === 'gerente' && (
                        <button
                            onClick={() => setView('stock-entry')}
                            className="p-2 bg-primary text-white rounded-xl shadow-lg active:scale-95 transition-transform flex items-center justify-center"
                            title="Nova Entrada"
                        >
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('resumo')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'resumo'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                            : 'text-slate-500'
                            }`}
                    >
                        Resumo
                    </button>
                    <button
                        onClick={() => setActiveTab('historico')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'historico'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                            : 'text-slate-500'
                            }`}
                    >
                        Histórico
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-32">
                {activeTab === 'resumo' ? (
                    <div className="space-y-3">
                        {activeModels.length === 0 && (
                            <div className="text-center py-10 text-slate-400">
                                Nenhum modelo de cesta ativo.
                            </div>
                        )}
                        {activeModels.map(basket => {
                            const qty = getStockQuantity(stock, basket.id);
                            return (
                                <div
                                    key={basket.id}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-2xl flex items-center gap-4 border border-slate-100 dark:border-slate-700 shadow-sm"
                                >
                                    <img src={basket.image} alt={basket.name} className="size-14 rounded-xl object-cover" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold truncate">{basket.name}</p>
                                        <p className="text-xs text-slate-500">Valor ref: R$ {basket.price.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            <p className={`font-black text-xl leading-none ${qty < 20 ? 'text-danger' : qty < 50 ? 'text-warning' : 'text-success'}`}>
                                                {qty}
                                            </p>
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">unid</p>
                                        </div>
                                        {userRole === 'gerente' && (
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => handleDecreaseClick(basket.id)}
                                                    className="size-7 flex items-center justify-center rounded-lg bg-warning/10 text-warning hover:bg-warning hover:text-white transition-colors"
                                                    title="Diminuir Estoque"
                                                >
                                                    <span className="material-symbols-outlined text-lg">remove</span>
                                                </button>
                                                <button
                                                    onClick={() => onDeleteModel(basket.id)}
                                                    className="size-7 flex items-center justify-center rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white transition-colors"
                                                    title="Excluir Modelo"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {stockEntries.length === 0 && (
                            <div className="text-center py-10 text-slate-400">
                                Nenhuma movimentação registrada.
                            </div>
                        )}
                        {stockEntries.map(entry => {
                            const model = basketModels.find(m => m.id === entry.basketModelId);
                            const isPositive = entry.quantity > 0;
                            return (
                                <div
                                    key={entry.id}
                                    className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden"
                                >
                                    {/* Indicator strip */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isPositive ? 'bg-success' : 'bg-danger'}`} />

                                    <div className="flex justify-between items-start mb-2 pl-2">
                                        <div>
                                            <p className="font-bold text-sm">{model?.name || 'Cesta Excluída'}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">
                                                {new Date(entry.receivedAt).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className={`font-black text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
                                                {isPositive ? '+' : ''}{entry.quantity}
                                            </p>
                                            {userRole === 'gerente' && (
                                                <button
                                                    onClick={() => onDeleteEntry(entry.id)}
                                                    className="size-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-slate-500 flex justify-between pl-2">
                                        <span>Fornecedor: <span className="font-medium text-slate-700 dark:text-slate-300">{entry.supplier}</span></span>
                                        {entry.unitCost > 0 && (
                                            <span>Custo: <span className="font-medium text-slate-700 dark:text-slate-300">R$ {entry.unitCost.toFixed(2)}</span></span>
                                        )}
                                    </div>
                                    {entry.notes && (
                                        <p className="text-[10px] text-slate-400 italic mt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700 ml-2">
                                            "{entry.notes}"
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StockView;
