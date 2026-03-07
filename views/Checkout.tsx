
import React, { useState } from 'react';
import { SaleItem, PaymentMethod, ViewState } from '../types';

interface CheckoutProps {
  items: SaleItem[];
  onFinishSale: (method: PaymentMethod, installments?: number) => void;
  setView: (v: ViewState) => void;
}

const Checkout: React.FC<CheckoutProps> = ({ items, onFinishSale, setView }) => {
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [installments, setInstallments] = useState<number>(4);

  const total = items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);

  const installmentOptions = [4, 5, 6, 7, 8];

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-300">
      <header className="flex items-center p-4 border-b border-gray-100 dark:border-gray-800">
        <button onClick={() => setView('new-sale')} className="flex size-10 items-center justify-start">
          <span className="material-symbols-outlined text-[#111418] dark:text-white">arrow_back_ios</span>
        </button>
        <h2 className="text-lg font-bold flex-1 text-center pr-10">Checkout</h2>
      </header>

      <div className="p-4 space-y-6 pb-40">
        {/* Summary Card */}
        <div className="flex items-center justify-between gap-4 rounded-xl bg-white dark:bg-gray-800 p-5 shadow-sm border border-gray-50 dark:border-gray-700">
          <div className="flex flex-col gap-1">
            <p className="text-gray-500 dark:text-gray-400 text-xs font-medium uppercase tracking-wider">Resumo da Venda</p>
            <p className="text-primary dark:text-blue-400 text-2xl font-bold leading-tight">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="material-symbols-outlined text-sm text-gray-400">shopping_basket</span>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-normal">{items.length} itens no carrinho</p>
            </div>
          </div>
          <div className="w-20 h-20 bg-primary/10 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-4xl">inventory_2</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2">
          <h3 className="text-lg font-bold leading-tight tracking-tight px-1">Forma de Pagamento</h3>
          <div className="flex h-14 w-full items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 p-1.5">
            {Object.values(PaymentMethod).map(pm => (
              <button
                key={pm}
                onClick={() => setMethod(pm)}
                className={`flex flex-col grow items-center justify-center rounded-lg px-2 h-full transition-all ${method === pm ? 'bg-white dark:bg-primary shadow-sm text-primary dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
              >
                <span className="material-symbols-outlined text-xl">
                  {pm === PaymentMethod.PIX ? 'qr_code' : pm === PaymentMethod.CARD ? 'credit_card' : 'calendar_month'}
                </span>
                <span className="text-[10px] font-bold uppercase">{pm}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Installments Slider - Only if A Prazo */}
        {method === PaymentMethod.TERM && (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div>
              <h3 className="text-lg font-bold leading-tight px-1">Parcelamento</h3>
              <p className="text-gray-500 text-sm px-1">Escolha o número de parcelas</p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {installmentOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => setInstallments(opt)}
                  className={`flex flex-col items-center justify-center min-w-[70px] h-20 rounded-xl transition-all border-2 ${installments === opt ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700'}`}
                >
                  <span className="text-xs opacity-80">Qtde</span>
                  <span className="text-xl font-bold">{opt}x</span>
                </button>
              ))}
            </div>

            {/* Cronograma */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-50 dark:border-gray-700">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Cronograma</span>
                <span className="text-primary dark:text-blue-400 text-xs font-bold">{installments} parcelas de R$ {(total / installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-gray-700">
                {[...Array(installments)].map((_, i) => (
                   <div key={i} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">{String(i + 1).padStart(2, '0')}</div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white">Parcela {i+1}</p>
                        <p className="text-xs text-gray-500">{i === 0 ? 'Vencimento próximo' : 'Agendado'}</p>
                      </div>
                    </div>
                    <p className="font-bold text-gray-800 dark:text-white">R$ {(total / installments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-100 dark:border-gray-800 z-50">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-gray-500 text-sm font-medium">Total a pagar</span>
            <span className="text-xl font-bold text-primary dark:text-blue-400">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          <button 
            onClick={() => onFinishSale(method, method === PaymentMethod.TERM ? installments : undefined)}
            className="w-full h-14 bg-secondary hover:bg-amber-500 text-[#111418] font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined font-bold">check_circle</span>
            Finalizar Venda
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Checkout;
