import React from 'react';
import { ViewState, SaleItem, BasketModel, StockItem } from '../types';
import { getStockQuantity } from '../store';

interface CustomerCartViewProps {
    cart: SaleItem[];
    basketModels: BasketModel[];
    stock: StockItem[];
    onUpdateQuantity: (modelId: string, quantity: number) => void;
    onClearCart: () => void;
    setView: (v: ViewState) => void;
}

const CustomerCartView: React.FC<CustomerCartViewProps> = ({
    cart,
    basketModels,
    stock,
    onUpdateQuantity,
    onClearCart,
    setView,
}) => {
    const getModel = (id: string) => basketModels.find(m => m.id === id);
    const total = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
    const itemCount = cart.reduce((acc, i) => acc + i.quantity, 0);

    if (cart.length === 0) {
        return (
            <div className="flex flex-col h-full animate-in fade-in duration-300">
                {/* Header */}
                <div className="px-4 py-2">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setView('customer-store')}
                            className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <h3 className="text-lg font-bold">Carrinho</h3>
                    </div>
                </div>

                {/* Empty State */}
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
                    <div className="size-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-5xl text-slate-400">shopping_cart</span>
                    </div>
                    <h3 className="text-xl font-bold mb-2">Carrinho Vazio</h3>
                    <p className="text-slate-500 mb-6">Adicione cestas para começar!</p>
                    <button
                        onClick={() => setView('customer-store')}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-xl"
                    >
                        Ver Produtos
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setView('customer-store')}
                            className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h3 className="text-lg font-bold">Carrinho</h3>
                            <p className="text-sm text-slate-500">{itemCount} {itemCount === 1 ? 'item' : 'itens'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClearCart}
                        className="text-sm text-danger font-medium"
                    >
                        Limpar
                    </button>
                </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 p-4 space-y-3 pb-52 overflow-y-auto">
                {cart.map((item) => {
                    const model = getModel(item.basketModelId);
                    if (!model) return null;

                    return (
                        <div
                            key={item.basketModelId}
                            className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700"
                        >
                            <div className="flex gap-4">
                                <img
                                    src={model.image}
                                    alt={model.name}
                                    className="size-20 rounded-xl object-cover"
                                />
                                <div className="flex-1">
                                    <h4 className="font-bold">{model.name}</h4>
                                    <p className="text-xs text-slate-500">{model.weight}</p>
                                    <p className="text-lg font-black text-primary mt-1">
                                        R$ {item.unitPrice.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => onUpdateQuantity(item.basketModelId, item.quantity - 1)}
                                        className="size-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center active:scale-95"
                                    >
                                        <span className="material-symbols-outlined">
                                            {item.quantity === 1 ? 'delete' : 'remove'}
                                        </span>
                                    </button>
                                    <span className="text-xl font-bold w-8 text-center">{item.quantity}</span>
                                    <button
                                        onClick={() => {
                                            const stockQty = getStockQuantity(stock, item.basketModelId);
                                            if (item.quantity + 1 > stockQty) {
                                                alert(`Limite de estoque atingido para ${model.name}.`);
                                                return;
                                            }
                                            onUpdateQuantity(item.basketModelId, item.quantity + 1);
                                        }}
                                        className="size-10 rounded-xl bg-primary text-white flex items-center justify-center active:scale-95"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                                <p className="text-lg font-bold">
                                    R$ {(item.unitPrice * item.quantity).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Summary and Checkout */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
                {/* Summary */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 mb-4 border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-slate-500">Subtotal ({itemCount} itens)</span>
                        <span className="font-medium">R$ {total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-slate-500">Entrega</span>
                        <span className="text-success font-medium">Grátis</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-700">
                        <span className="font-bold">Total</span>
                        <span className="text-xl font-black text-primary">R$ {total.toFixed(2)}</span>
                    </div>
                </div>

                {/* Checkout Button */}
                <button
                    onClick={() => setView('customer-checkout')}
                    className="w-full h-14 bg-success text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined">shopping_cart_checkout</span>
                    Finalizar Compra
                </button>
            </div>
        </div>
    );
};

export default CustomerCartView;
