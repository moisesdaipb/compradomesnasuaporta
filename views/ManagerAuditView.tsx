import React, { useState, useMemo } from 'react';
import { Sale, Installment, DailyClosing, TeamMember, PaymentMethod, OrderStatus, AuditLog } from '../types';
import { formatCurrency } from '../utils';
import * as XLSX from 'xlsx';

interface ManagerAuditViewProps {
  sales: Sale[];
  installments: Installment[];
  dailyClosings: DailyClosing[];
  team: TeamMember[];
  auditLogs: AuditLog[];
  onBack: () => void;
}

type TabType = 'A Prestar Contas' | 'Em Atraso' | 'A Receber' | 'Confirmados' | 'Log de Ações' | 'Tudo';

interface AuditRow {
  id: string;
  sellerId: string;
  sellerName: string;
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

const ManagerAuditView: React.FC<ManagerAuditViewProps> = ({
  sales,
  installments,
  dailyClosings,
  team,
  auditLogs,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('A Prestar Contas');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<string>('all');

  // 1. Valid Sales (Not cancelled)
  const validSales = useMemo(() => sales.filter(s => s.status !== OrderStatus.CANCELLED), [sales]);

  // 2. Identify all closed installments and sales across all sellers
  const closedSaleIdsAll = useMemo(() => {
    const ids = new Set<string>();
    dailyClosings.forEach(c => (c.salesIds || []).forEach(id => ids.add(id)));
    return ids;
  }, [dailyClosings]);

  const closedInstIdsAll = useMemo(() => {
    const ids = new Set<string>();
    dailyClosings.forEach(c => (c.installmentIds || []).forEach(id => ids.add(id)));
    return ids;
  }, [dailyClosings]);

  const teamMap = useMemo(() => new Map(team.map(t => [t.id, t.name])), [team]);

  // 3. Mount global rows database
  const allRows = useMemo(() => {
    const rows: AuditRow[] = [];

    // Cash Sales
    validSales.forEach(sale => {
      if (sale.paymentMethod !== PaymentMethod.TERM) {
        rows.push({
          id: sale.id,
          sellerId: sale.sellerId,
          sellerName: teamMap.get(sale.sellerId) || sale.sellerName || 'Desconhecido',
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

    // Installments
    const saleMap = new Map<string, Sale>(validSales.map(s => [s.id, s]));
    
    installments.forEach(inst => {
      const sale = saleMap.get(inst.saleId);
      if (sale) {
        const saleInstallments = installments.filter(i => i.saleId === sale.id).sort((a, b) => a.dueDate - b.dueDate);
        const index = saleInstallments.findIndex(i => i.id === inst.id) + 1;
        const total = saleInstallments.length;

        rows.push({
          id: inst.id,
          sellerId: sale.sellerId,
          sellerName: teamMap.get(sale.sellerId) || sale.sellerName || 'Desconhecido',
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
  }, [validSales, installments, closedSaleIdsAll, closedInstIdsAll, teamMap]);

  // 4. Filtrar
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const filteredRows = useMemo(() => {
    let result = allRows;

    // Filter by Seller
    if (selectedSeller !== 'all') {
      result = result.filter(r => r.sellerId === selectedSeller);
    }

    // Filter by Tab
    switch (activeTab) {
      case 'A Prestar Contas':
        result = result.filter(r => r.status === 'Pago' && !r.isAccounted);
        break;
      case 'Em Atraso':
        result = result.filter(r => r.status === 'Pendente' && r.date < todayStart.getTime());
        break;
      case 'A Receber':
        result = result.filter(r => r.status === 'Pendente' && r.date >= todayStart.getTime());
        break;
      case 'Confirmados':
        result = result.filter(r => r.isAccounted);
        break;
      case 'Tudo':
        break;
    }

    // Filter by Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r => 
        r.customerName.toLowerCase().includes(term) ||
        r.sellerName.toLowerCase().includes(term)
      );
    }

    return result;
  }, [allRows, activeTab, searchTerm, selectedSeller, todayStart]);

  const filteredAuditLogs = useMemo(() => {
    if (activeTab !== 'Log de Ações') return [];
    let logs = auditLogs;

    if (selectedSeller !== 'all') {
      logs = logs.filter(l => l.user_id === selectedSeller);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      logs = logs.filter(l => 
        (l.user_name || '').toLowerCase().includes(term) ||
        (l.table_name || '').toLowerCase().includes(term) ||
        (l.action || '').toLowerCase().includes(term)
      );
    }

    return logs;
  }, [auditLogs, activeTab, searchTerm, selectedSeller]);

  // Render Helpers
  const getStatusString = (r: AuditRow) => {
    if (r.isAccounted) return 'Fechado/Confirmado';
    if (r.status === 'Pago') return 'A Prestar Contas (Na mão do vendedor)';
    if (r.date < todayStart.getTime()) return 'Em Atraso';
    return 'A Receber (No Prazo)';
  };

  const getStatusBadge = (r: AuditRow) => {
    if (r.isAccounted) return <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Fechado</span>;
    if (r.status === 'Pago') return <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">A Prestar Contas</span>;
    if (r.date < todayStart.getTime()) return <span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Atrasado</span>;
    return <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">A Receber</span>;
  };

  const exportToExcel = () => {
    const dataToExport = filteredRows.map(row => ({
      'Vendedor': row.sellerName,
      'Cliente': row.customerName,
      'Data Compra/Vencimento': new Date(row.date).toLocaleDateString('pt-BR'),
      'Tipo da Venda': row.type + (row.details ? ` (${row.details})` : ''),
      'Forma Pagamento': row.paymentMethod,
      'Status Contábil': getStatusString(row),
      'Valor (R$)': row.amount
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Auto-size columns slightly
    worksheet['!cols'] = [
      { wch: 20 }, // Vendedor
      { wch: 25 }, // Cliente
      { wch: 20 }, // Data
      { wch: 20 }, // Tipo
      { wch: 15 }, // Forma
      { wch: 35 }, // Status
      { wch: 15 }  // Valor
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria Geral');

    const fileName = `Auditoria_Global_${activeTab.replace(/ /g, '_')}_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const activeSellers = useMemo(() => team.filter(t => t.role === 'vendedor'), [team]);

  const totalFilteredAmount = useMemo(() => filteredRows.reduce((acc, row) => acc + row.amount, 0), [filteredRows]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-500">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="size-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">Auditoria Geral</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">Conferência Global da Empresa</p>
            </div>
          </div>
          <button 
            onClick={exportToExcel}
            title="Exportar dados atuais para Excel"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span className="hidden sm:inline">Excel</span>
          </button>
        </div>

        {/* Global Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              placeholder="Buscar por cliente ou vendedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm text-sm font-semibold"
            />
          </div>
          
          <div className="sm:w-64 relative">
             <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">person</span>
             <select
               value={selectedSeller}
               onChange={(e) => setSelectedSeller(e.target.value)}
               className="w-full h-11 pl-10 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary transition-all text-sm font-bold text-slate-700 dark:text-white appearance-none cursor-pointer"
             >
               <option value="all">Todos os Vendedores</option>
               {activeSellers.map(seller => (
                 <option key={seller.id} value={seller.id}>{seller.name}</option>
               ))}
             </select>
             <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">expand_more</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 pt-1 pb-3 shadow-sm">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
          {(['A Prestar Contas', 'Em Atraso', 'A Receber', 'Confirmados', 'Log de Ações', 'Tudo'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl snap-start transition-all border ${
                activeTab === tab 
                  ? tab === 'A Prestar Contas' ? 'bg-blue-100 border-blue-200 text-blue-700 shadow-sm' :
                    tab === 'Em Atraso' ? 'bg-red-100 border-red-200 text-red-700 shadow-sm' :
                    tab === 'A Receber' ? 'bg-orange-100 border-orange-200 text-orange-700 shadow-sm' :
                    tab === 'Confirmados' ? 'bg-green-100 border-green-200 text-green-700 shadow-sm' :
                    tab === 'Log de Ações' ? 'bg-purple-100 border-purple-200 text-purple-700 shadow-sm' :
                    'bg-slate-800 border-slate-800 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50">
         <span className="text-xs font-bold text-slate-500">
           {activeTab === 'Log de Ações' ? filteredAuditLogs.length : filteredRows.length} registros encontrados
         </span>
         {activeTab !== 'Log de Ações' && (
           <span className="text-sm font-black text-slate-800 dark:text-white">Total: {formatCurrency(totalFilteredAmount)}</span>
         )}
      </div>

      {/* Data Table / List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar pb-24">
        {activeTab === 'Log de Ações' ? (
          <div className="space-y-4">
            {filteredAuditLogs.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="size-20 bg-slate-50 dark:bg-slate-900 rounded-[20px] flex items-center justify-center mx-auto mb-5 border border-slate-100 dark:border-slate-800">
                  <span className="material-symbols-outlined text-slate-300 text-4xl">history</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">Nenhuma ação registrada</h3>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">As ações aparecerão aqui assim que ocorrerem mudanças no sistema</p>
              </div>
            ) : (
              filteredAuditLogs.map(log => (
                <div key={log.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-xl flex items-center justify-center ${
                        log.action === 'INSERT' ? 'bg-green-100 text-green-600' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-600' :
                        'bg-red-100 text-red-600'
                      }`}>
                        <span className="material-symbols-outlined text-xl">
                          {log.action === 'INSERT' ? 'add_circle' : log.action === 'UPDATE' ? 'edit' : 'delete'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                          {log.action === 'INSERT' ? 'Inserção' : log.action === 'UPDATE' ? 'Alteração' : 'Exclusão'} em <span className="text-primary">{log.table_name}</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 capitalize">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                        {log.user_name || 'Sistema'}
                      </p>
                      <p className={`text-[8px] font-bold uppercase tracking-widest ${
                        log.user_role === 'gerente' ? 'text-primary' : 'text-slate-400'
                      }`}>
                        {log.user_role || 'Auto'}
                      </p>
                    </div>
                  </div>

                  {log.action === 'UPDATE' && log.old_data && log.new_data && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 dark:border-slate-700">
                      <div className="grid grid-cols-2 bg-slate-50 dark:bg-slate-800/50 p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-700">
                        <div>Valor Antigo</div>
                        <div>Valor Novo</div>
                      </div>
                      <div className="grid grid-cols-2 p-2 gap-4 text-[10px] font-semibold font-mono break-all line-clamp-3">
                        <div className="text-red-500 opacity-60">
                          {Object.entries(log.old_data)
                            .filter(([key, val]) => JSON.stringify(val) !== JSON.stringify(log.new_data[key]))
                            .map(([key, val]) => `${key}: ${JSON.stringify(val)}`).join('\n')}
                        </div>
                        <div className="text-green-600">
                          {Object.entries(log.new_data)
                            .filter(([key, val]) => JSON.stringify(val) !== JSON.stringify(log.old_data[key]))
                            .map(([key, val]) => `${key}: ${JSON.stringify(val)}`).join('\n')}
                        </div>
                      </div>
                    </div>
                  )}

                  {(log.action === 'INSERT' || log.action === 'DELETE') && (
                    <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[10px] font-mono break-all line-clamp-2 opacity-60">
                      {JSON.stringify(log.action === 'INSERT' ? log.new_data : log.old_data)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <>
            {filteredRows.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="size-20 bg-slate-50 dark:bg-slate-900 rounded-[20px] flex items-center justify-center mx-auto mb-5 border border-slate-100 dark:border-slate-800">
                  <span className="material-symbols-outlined text-slate-300 text-4xl">inventory_2</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-1">Nenhum registro</h3>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Altere os filtros ou a aba</p>
              </div>
            ) : (
              <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                 {/* Desktop Table View */}
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                          <th className="p-4">Cliente</th>
                          <th className="p-4">Vendedor</th>
                          <th className="p-4">Tipo</th>
                          <th className="p-4">Data/Venc.</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Valor</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {filteredRows.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                             <td className="p-4 font-bold text-sm text-slate-800 dark:text-white">{row.customerName}</td>
                             <td className="p-4">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                   <span className="material-symbols-outlined text-[12px]">storefront</span>
                                   {row.sellerName}
                                </span>
                             </td>
                             <td className="p-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                {row.type} {row.details && <span className="opacity-70">({row.details})</span>}
                             </td>
                             <td className="p-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                                {new Date(row.date).toLocaleDateString('pt-BR')}
                             </td>
                             <td className="p-4">
                                {getStatusBadge(row)}
                             </td>
                             <td className="p-4 text-right font-black text-sm text-slate-800 dark:text-white">
                                {formatCurrency(row.amount)}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            )}

            {/* Mobile View */}
            <div className="md:hidden space-y-3">
               {filteredRows.map(row => (
                 <div key={row.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                   <div className="flex items-start justify-between mb-2">
                     <div className="flex-1 min-w-0 pr-3">
                       <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{row.customerName}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-[10px]">storefront</span>
                          {row.sellerName}
                       </p>
                     </div>
                     {getStatusBadge(row)}
                   </div>
                   
                   <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5">
                      <div>
                         <p className="text-[9px] text-slate-400 font-bold uppercase">Tipo Venda</p>
                         <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{row.type} {row.details && `(${row.details})`}</p>
                      </div>
                      <div>
                         <p className="text-[9px] text-slate-400 font-bold uppercase">Data/Vencimento</p>
                         <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{new Date(row.date).toLocaleDateString('pt-BR')}</p>
                      </div>
                   </div>
                   
                   <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-3">
                      <div className="flex items-center gap-2">
                         {row.phone && (
                            <a 
                               href={`https://wa.me/55${row.phone.replace(/\D/g, '')}?text=Olá! Sobre a ${row.type.toLowerCase()}...`}
                               target="_blank"
                               rel="noreferrer"
                               className="size-8 bg-green-50 text-green-600 rounded-full flex items-center justify-center hover:bg-green-100 transition-colors"
                            >
                               <i className="fa-brands fa-whatsapp"></i>
                            </a>
                         )}
                      </div>
                      <p className="font-black text-lg text-primary">{formatCurrency(row.amount)}</p>
                   </div>
                 </div>
               ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ManagerAuditView;
