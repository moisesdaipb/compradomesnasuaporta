
import React, { useState } from 'react';
import { BasketModel, ViewState } from '../types';

interface NewSaleProps {
  baskets: BasketModel[];
  onItemsSelected: (items: { basketId: string, quantity: number, unitPrice: number }[]) => void;
  setView: (v: ViewState) => void;
}

const NewSale: React.FC<NewSaleProps> = ({ baskets, onItemsSelected, setView }) => {
  const [selected, setSelected] = useState<Record<string, number>>({});

  const toggleSelect = (id: string, price: number) => {
    setSelected(prev => {
      const current = prev[id] || 0;
      if (current > 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: 1 };
    });
  };

  const totalSelected = Object.keys(selected).length;
  // Use Number(qty) to ensure the value is treated as a number in arithmetic operations, fixing potential type inference issues with Object.entries
  const totalPrice = Object.entries(selected).reduce((acc, [id, qty]) => {
    const b = baskets.find(x => x.id === id);
    const itemPrice = b ? b.price : 0;
    return acc + (itemPrice * Number(qty));
  }, 0);

  const handleContinue = () => {
    if (totalSelected === 0) return;
    const items = Object.entries(selected).map(([id, qty]) => ({
      basketId: id,
      quantity: qty,
      unitPrice: baskets.find(x => x.id === id)?.price || 0
    }));
    onItemsSelected(items);
    setView('checkout');
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      {/* Header Info */}
      <div className="px-4 py-2">
        <h3 className="text-lg font-bold leading-tight">Nova Venda Presencial</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Selecione os itens para o pedido</p>
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-4 mb-2">
        <label className="flex flex-col w-full">
          <div className="flex w-full h-12 items-stretch rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-center pl-4 text-gray-500">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input className="form-input flex-1 border-none bg-transparent focus:ring-0 text-base font-normal placeholder:text-gray-400 dark:placeholder:text-gray-500" placeholder="Buscar cliente por nome ou CPF..." />
          </div>
        </label>
      </div>

      {/* List */}
      <div className="p-4 space-y-4 pb-40">
        {baskets.map(basket => {
          const isSelected = !!selected[basket.id];
          return (
            <div
              key={basket.id}
              className={`flex flex-col rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden border transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100 dark:border-gray-700'}`}
            >
              <div className="h-40 w-full bg-center bg-no-repeat bg-cover" style={{ backgroundImage: `url("${basket.image}")` }}></div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-base font-bold text-[#111418] dark:text-white">{basket.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{basket.description}</p>
                  </div>
                  <p className="text-lg font-bold text-primary">R$ {basket.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                </div>
                <button
                  onClick={() => toggleSelect(basket.id, basket.price)}
                  className={`flex items-center justify-center gap-2 w-full h-10 rounded-lg font-medium transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-background-light dark:bg-gray-700 text-[#111418] dark:text-white hover:bg-gray-200'}`}
                >
                  <span className="material-symbols-outlined">{isSelected ? 'check' : 'add_shopping_cart'}</span>
                  <span>{isSelected ? 'Selecionado' : 'Selecionar'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Summary */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total selecionado ({totalSelected})</span>
            <span className="text-lg font-bold text-[#111418] dark:text-white">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <button
            disabled={totalSelected === 0}
            onClick={handleContinue}
            className={`flex w-full cursor-pointer items-center justify-center rounded-xl h-14 gap-3 font-bold text-base shadow-lg transition-all ${totalSelected > 0 ? 'bg-secondary text-[#111418] shadow-secondary/20 active:scale-[0.98]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
          >
            <span className="truncate">Continuar para Pagamento</span>
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewSale;
