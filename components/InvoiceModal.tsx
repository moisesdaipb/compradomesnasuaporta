import React from 'react';
import { Customer, Sale, BasketModel } from '../types';

interface InvoiceModalProps {
    customer: Customer;
    sale: Sale;
    basket: BasketModel;
    onClose: () => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({
    customer,
    sale,
    basket,
    onClose,
}) => {
    const today = new Date().toLocaleDateString('pt-BR');
    const invoiceNumber = Math.floor(Math.random() * 900000) + 100000;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black">NOTA FISCAL</h2>
                        <p className="text-xs opacity-70">NFC-e Nº {invoiceNumber}</p>
                    </div>
                    <button onClick={onClose} className="size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Company Info (Mock) */}
                    <div className="text-center border-b border-slate-100 pb-4">
                        <h3 className="font-black text-slate-800">CESTA BÁSICA NA SUA CASA LTDA</h3>
                        <p className="text-[10px] text-slate-500">CNPJ: 00.000.000/0001-00</p>
                        <p className="text-[10px] text-slate-500">Rua Exemplo, 123 - São Paulo/SP</p>
                    </div>

                    {/* Customer Info */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinatário</h4>
                        <div className="bg-slate-50 rounded-2xl p-4">
                            <p className="text-sm font-bold text-slate-800">{customer.name}</p>
                            <p className="text-xs text-slate-600">CPF: {customer.cpf}</p>
                            <p className="text-xs text-slate-600">
                                {customer.address}, {customer.addressNumber}
                                {customer.complement ? ` - ${customer.complement}` : ''}
                            </p>
                            <p className="text-xs text-slate-600">
                                {customer.neighborhood} - {customer.city}/{customer.state}
                            </p>
                            <p className="text-xs text-slate-600">CEP: {customer.zipCode}</p>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Itens da Nota</h4>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left border-b border-slate-100">
                                    <th className="py-2 text-[10px] text-slate-500">PRODUTO</th>
                                    <th className="py-2 text-[10px] text-slate-500 text-center">QTD</th>
                                    <th className="py-2 text-[10px] text-slate-500 text-right">VALOR</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-slate-100">
                                    <td className="py-3">
                                        <p className="font-bold text-slate-800">{basket.name}</p>
                                        <p className="text-[10px] text-slate-500">{basket.weight}</p>
                                    </td>
                                    <td className="py-3 text-center">1</td>
                                    <td className="py-3 text-right font-bold text-slate-800">R$ {basket.price.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Totals */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 flex justify-between items-center">
                        <span className="font-bold">TOTAL DA NOTA</span>
                        <span className="text-xl font-black text-secondary">R$ {sale.total.toFixed(2)}</span>
                    </div>

                    {/* Footer */}
                    <div className="text-center space-y-2">
                        <p className="text-[9px] text-slate-400">Emissão em {today} - Via do Consumidor</p>
                        <div className="flex justify-center gap-2">
                            <div className="size-16 bg-slate-100 rounded-lg flex items-center justify-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300">qr_code_2</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
                    <button className="flex-1 h-12 bg-primary text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">download</span>
                        Baixar PDF
                    </button>
                    <button className="flex-1 h-12 bg-whatsapp text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-success/20">
                        <span className="material-symbols-outlined">send</span>
                        WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceModal;
