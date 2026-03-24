import React, { useState, useMemo } from 'react';
import { Sale, Installment, DailyClosing, TeamMember, UserSession, PaymentMethod, OrderStatus, InstallmentStatus, ClosingStatus } from '../types';
import { formatCurrency } from '../utils';

interface SellerAuditViewProps {
  sellerId: string;
  sales: Sale[];
  installments: Installment[];
  dailyClosings: DailyClosing[];
  team: TeamMember[];
  session: UserSession;
  onBack: () => void;
}

type TabType = 'A Prestar Contas' | 'Em Atraso' | 'A Receber' | 'Confirmados' | 'Tudo';

interface AuditRow {
  id: string;
  type: 'Venda à Vista' | 'Parcela';
  customerName: string;
  amount: number;
  date: number; // For sorting (dueDate for installments, createdAt for cash sales)
  status: string;
  paymentMethod: string;
  isAccounted: boolean;
  saleId: string;
  phone?: string;
  details?: string; // e.g. "Parcela 2/3"
}

const SellerAuditView: React.FC<SellerAuditViewProps> = ({
  sellerId,
  sales,
  installments,
  dailyClosings,
  team,
  session,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('A Prestar Contas');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Identificar o Vendedor
  const sellerSales = useMemo(() => sales.filter(s => s.sellerId === sellerId && s.status !== OrderStatus.CANCELLED), [sales, sellerId]);
  const sellerInfo = useMemo(() => {
    const member = team.find(t => t.id === sellerId);
    return member || { name: sellerSales[0]?.sellerName || 'Vendedor Desconhecido', id: sellerId };
  }, [team, sellerId, sellerSales]);

  // 2. Identificar Fechamentos do Vendedor (Histórico inteiro)
  const sellerClosings = useMemo(() => dailyClosings.filter(c => c.sellerId === sellerId), [dailyClosings, sellerId]);
  
  // IDs de vendas e parcelas já contabilizados (independente do status do fechamento ser aprovado ou pendente)
  const closedSaleIdsAll = useMemo(() => {
    const ids = new Set<string>();
    sellerClosings.forEach(c => (c.salesIds || []).forEach(id => ids.add(id)));
    return ids;
  }, [sellerClosings]);

  const closedInstIdsAll = useMemo(() => {
    const ids = new Set<string>();
    sellerClosings.forEach(c => (c.installmentIds || []).forEach(id => ids.add(id)));
    return ids;
  }, [sellerClosings]);

  // 3. Montar a base de dados em formato de Linhas (Rows) unificadas
  const allRows = useMemo(() => {
    const rows: AuditRow[] = [];

    // Adicionar vendas à vista (dinheiro/pix/cartão direto)
    sellerSales.forEach(sale => {
      if (sale.paymentMethod !== PaymentMethod.TERM) {
        rows.push({
          id: sale.id,
          type: 'Venda à Vista',
          customerName: sale.customerName || 'Cliente Balcão',
          amount: sale.total,
          date: sale.createdAt,
          status: 'Pago',
          paymentMethod: sale.paymentMethod,
          isAccounted: closedSaleIdsAll.has(sale.id),
          saleId: sale.id,
        });
      }
    });

    // Adicionar todas as parcelas das vendas a prazo
    const saleMap = new Map<string, Sale>(sellerSales.map(s => [s.id, s]));
    
    installments.forEach(inst => {
      const sale = saleMap.get(inst.saleId);
      if (sale) {
        // Find which number this installment is
        const saleInstallments = installments.filter(i => i.saleId === sale.id).sort((a, b) => a.dueDate - b.dueDate);
        const index = saleInstallments.findIndex(i => i.id === inst.id) + 1;
        const total = saleInstallments.length;

        rows.push({
          id: inst.id,
          type: 'Parcela',
          customerName: sale.customerName || 'Cliente Balcão',
          amount: inst.amount,
          date: inst.dueDate,
          status: inst.status,
          paymentMethod: 'A Prazo',
          isAccounted: closedInstIdsAll.has(inst.id),
          saleId: sale.id,
          details: `${index}/${total}`
        });
      }
    });

    return rows.sort((a, b) => b.date - a.date); // Sort newest first
  }, [sellerSales, installments, closedSaleIdsAll, closedInstIdsAll]);

  // 4. Filtrar por Aba
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const filteredRows = useMemo(() => {
    let result = allRows;

    // Filter by Tab
    switch (activeTab) {
      case 'A Prestar Contas':
        // Recebidos na mão, não fechados
        result = result.filter(r => r.status === 'Pago' && !r.isAccounted);
        break;
      case 'Em Atraso':
        // Pendentes e vencidos
        result = result.filter(r => r.status === 'Pendente' && r.date < todayStart.getTime());
        break;
      case 'A Receber':
        // Pendentes e não vencidos
        result = result.filter(r => r.status === 'Pendente' && r.date >= todayStart.getTime());
        break;
      case 'Confirmados':
        // Já contabilizados em um fechamento aprovado ou pendente
        result = result.filter(r => r.isAccounted);
        break;
      case 'Tudo':
        // No filter
        break;
    }

    // Filter by Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => r.customerName.toLowerCase().includes(term));
    }

    return result;
  }, [allRows, activeTab, searchTerm, todayStart]);

  // 5. Cálculos dos Cards (usando a base allRows)
  const stats = useMemo(() => {
    let total = 0, confirmado = 0, aPrestar = 0, emAtraso = 0, aReceber = 0;

    allRows.forEach(r => {
      total += r.amount;

      if (r.isAccounted) {
        // We consider it 'Confirmado' if it's accounted (even if the closing is pending approval, 
        // to simplify the seller view. Technically, if closing is pending, it might be separate, 
        // but for audit, it's out of their hands).
        confirmado += r.amount;
      } else {
        if (r.status === 'Pago') {
          aPrestar += r.amount;
        } else if (r.status === 'Pendente') {
          if (r.date < todayStart.getTime()) {
            emAtraso += r.amount;
          } else {
            aReceber += r.amount;
          }
        }
      }
    });

    return { total, confirmado, aPrestar, emAtraso, aReceber };
  }, [allRows, todayStart]);

  // Render Helpers
  const getStatusBadge = (r: AuditRow) => {
    if (r.isAccounted) return <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Fechado</span>;
    if (r.status === 'Pago') return <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Pago (Em Mãos)</span>;
    if (r.date < todayStart.getTime()) return <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Atrasado</span>;
    return <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">A Vencer</span>;
  };

  return (
    <div className="pb-20 max-w-lg mx-auto bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors active:scale-95">
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-300">arrow_back</span>
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 dark:text-white">Extrato Detalhado</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{sellerInfo.name}</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-xl mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Vendido</p>
          <h2 className="text-3xl font-black mb-4">{formatCurrency(stats.total)}</h2>
          
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                <p className="text-[9px] uppercase font-bold text-slate-300 mb-1">A Prestar Contas</p>
                <p className="text-lg font-black text-red-300">{formatCurrency(stats.aPrestar)}</p>
             </div>
             <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                <p className="text-[9px] uppercase font-bold text-slate-300 mb-1">Confirmado (Recibos)</p>
                <p className="text-lg font-black text-green-300">{formatCurrency(stats.confirmado)}</p>
             </div>
             <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                <p className="text-[9px] uppercase font-bold text-slate-300 mb-1">Em Atraso</p>
                <p className="text-lg font-black text-orange-300">{formatCurrency(stats.emAtraso)}</p>
             </div>
             <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/5">
                <p className="text-[9px] uppercase font-bold text-slate-300 mb-1">A Receber (No Prazo)</p>
                <p className="text-lg font-black text-blue-300">{formatCurrency(stats.aReceber)}</p>
             </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-700 dark:text-white placeholder:text-slate-400 placeholder:font-semibold focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
               <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 snap-x">
          {(['A Prestar Contas', 'Em Atraso', 'A Receber', 'Confirmados', 'Tudo'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full snap-start transition-all border ${
                activeTab === tab 
                  ? tab === 'A Prestar Contas' ? 'bg-red-100 border-red-200 text-red-700' :
                    tab === 'Em Atraso' ? 'bg-orange-100 border-orange-200 text-orange-700' :
                    tab === 'A Receber' ? 'bg-blue-100 border-blue-200 text-blue-700' :
                    tab === 'Confirmados' ? 'bg-green-100 border-green-200 text-green-700' :
                    'bg-slate-800 border-slate-800 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List */}
      <div className="px-4">
        {filteredRows.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
            <div className="size-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-slate-800 shadow-sm">
              <span className="material-symbols-outlined text-slate-300 text-2xl">receipt_long</span>
            </div>
            <p className="text-slate-500 font-bold text-sm">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRows.map((row) => (
              <div key={row.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-extrabold text-sm text-slate-800 dark:text-white truncate">{row.customerName}</p>
                    {getStatusBadge(row)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold mb-2">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">sell</span>
                      {row.type} {row.details && `(${row.details})`}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">event</span>
                      {new Date(row.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                     <p className={`font-black text-sm ${
                        row.status === 'Pendente' && row.date < todayStart.getTime() ? 'text-red-500' :
                        row.status === 'Pago' && !row.isAccounted ? 'text-orange-500' :
                        row.isAccounted ? 'text-green-500' : 'text-slate-700 dark:text-slate-300'
                     }`}>
                        {formatCurrency(row.amount)}
                     </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2">
                  {row.phone && (
                     <a 
                        href={`https://wa.me/55${row.phone.replace(/\D/g, '')}?text=Olá! Referente à ${row.type} no valor de ${formatCurrency(row.amount)}...`}
                        target="_blank"
                        rel="noreferrer"
                        className="size-10 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 flex items-center justify-center hover:scale-110 active:scale-95 transition-all outline-none"
                     >
                        <i className="fa-brands fa-whatsapp text-lg"></i>
                     </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerAuditView;
