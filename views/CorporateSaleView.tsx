import React, { useState, useMemo } from 'react';
import {
  ViewState,
  CorporateCustomer,
  SupplyRecipe,
  StockEntry,
  SaleItem,
  PaymentMethod,
} from '../types';
import { formatCurrency } from '../utils';

// Masks
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const maskCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

interface CorporateSaleViewProps {
  corporateCustomers: CorporateCustomer[];
  supplyRecipes: SupplyRecipe[];
  stockEntries: StockEntry[];
  onCreateSale: (
    customerId: string,
    customerName: string,
    items: SaleItem[],
    paymentMethod: PaymentMethod,
    channel: 'online' | 'presencial' | 'empresarial',
    installmentsCount?: number,
    installmentDates?: number[],
    deliveryInfo?: any,
    installmentAmounts?: number[],
    paymentSubMethod?: string,
    changeAmount?: number,
  ) => Promise<any>;
  onUpsertCorporateCustomer: (customer: Partial<CorporateCustomer>) => Promise<void>;
  onDeleteCorporateCustomer: (id: string) => Promise<void>;
  onRefresh: () => void;
  setView: (v: ViewState) => void;
}

const CorporateSaleView: React.FC<CorporateSaleViewProps> = ({
  corporateCustomers,
  supplyRecipes,
  stockEntries,
  onCreateSale,
  onUpsertCorporateCustomer,
  onDeleteCorporateCustomer,
  onRefresh,
  setView,
}) => {
  const [activeTab, setActiveTab] = useState<'vender' | 'clientes'>('vender');

  // Client Selection
  const [selectedClient, setSelectedClient] = useState<CorporateCustomer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Client Form
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<CorporateCustomer> | null>(null);

  // Address fields (for form decomposition)
  const [addrCep, setAddrCep] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrNumber, setAddrNumber] = useState('');
  const [addrComplement, setAddrComplement] = useState('');
  const [addrNeighborhood, setAddrNeighborhood] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [isCepLoading, setIsCepLoading] = useState(false);

  // Sale State
  const [step, setStep] = useState<'client' | 'product' | 'payment' | 'installments' | 'success'>('client');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [installmentsCount, setInstallmentsCount] = useState(1);
  const [installmentDates, setInstallmentDates] = useState<number[]>([]);
  const [distributionType, setDistributionType] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Enterprise stock
  const enterpriseStockByRecipe = useMemo(() => {
    const stockMap: Record<string, number> = {};
    const enterpriseEntries = stockEntries.filter(e => e.channel === 'empresarial');
    for (const entry of enterpriseEntries) {
      const modelId = entry.basketModelId;
      const recipe = supplyRecipes.find(r => r.basketModelId === modelId);
      if (recipe) {
        stockMap[recipe.id] = (stockMap[recipe.id] || 0) + entry.quantity;
      }
    }
    return stockMap;
  }, [stockEntries, supplyRecipes]);

  const activeRecipesWithStock = useMemo(() => {
    return supplyRecipes.filter(r => r.active && (enterpriseStockByRecipe[r.id] || 0) > 0);
  }, [supplyRecipes, enterpriseStockByRecipe]);

  const recipe = supplyRecipes.find(r => r.id === selectedRecipe);
  const stockQty = selectedRecipe ? (enterpriseStockByRecipe[selectedRecipe] || 0) : 0;
  const total = recipe ? (recipe.price || 0) * quantity : 0;

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return corporateCustomers;
    const term = searchTerm.toLowerCase();
    return corporateCustomers.filter(c =>
      c.companyName.toLowerCase().includes(term) ||
      c.cnpj.includes(term) ||
      c.responsibleName.toLowerCase().includes(term)
    );
  }, [corporateCustomers, searchTerm]);

  // CEP lookup
  const handleCepLookup = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setIsCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setAddrStreet(data.logradouro?.toUpperCase() || '');
        setAddrNeighborhood(data.bairro?.toUpperCase() || '');
        setAddrCity(data.localidade?.toUpperCase() || '');
        setAddrState(data.uf?.toUpperCase() || '');
      }
    } catch {
      // silently fail
    }
    setIsCepLoading(false);
  };

  // Compose address from parts
  const composeAddress = () => {
    const parts = [addrStreet, addrNumber, addrComplement, addrNeighborhood, addrCity, addrState, addrCep].filter(Boolean);
    return parts.join(', ');
  };

  // Parse address into parts when editing
  const parseAddressForEdit = (address: string) => {
    const parts = address.split(',').map(p => p.trim());
    setAddrStreet(parts[0] || '');
    setAddrNumber(parts[1] || '');
    setAddrComplement(parts[2] || '');
    setAddrNeighborhood(parts[3] || '');
    setAddrCity(parts[4] || '');
    setAddrState(parts[5] || '');
    setAddrCep(parts[6] || '');
  };

  const openClientModal = (client: Partial<CorporateCustomer>) => {
    setEditingClient(client);
    if (client.address) {
      parseAddressForEdit(client.address);
    } else {
      setAddrCep(''); setAddrStreet(''); setAddrNumber(''); setAddrComplement('');
      setAddrNeighborhood(''); setAddrCity(''); setAddrState('');
    }
    setIsClientModalOpen(true);
  };

  const handleConfirmSale = async () => {
    if (!selectedClient || !recipe) return;
    if (paymentMethod === PaymentMethod.TERM) {
      const unfilled = installmentDates.slice(0, installmentsCount).some(d => d === 0);
      if (unfilled) { alert('Por favor, selecione as datas de vencimento de todas as parcelas.'); return; }
    }
    const items: SaleItem[] = [{
      basketModelId: recipe.basketModelId || recipe.id,
      basketName: recipe.name,
      quantity,
      unitPrice: recipe.price || 0,
    }];
    
    setIsSaving(true);
    try {
      await onCreateSale(
        selectedClient.id, selectedClient.companyName, items, paymentMethod, 'empresarial',
        paymentMethod === PaymentMethod.TERM ? installmentsCount : undefined,
        paymentMethod === PaymentMethod.TERM ? installmentDates : undefined,
        undefined,
        paymentMethod === PaymentMethod.TERM && distributionType === 'custom'
          ? customAmounts.map(a => parseFloat(a) || 0) : undefined,
      );
      setStep('success');
    } catch (error: any) {
      alert(`Erro ao realizar venda: ${error.message || 'Tente novamente.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const generateInstallmentDates = (count: number) => {
    setInstallmentDates(Array(count).fill(0));
    const equalAmount = (total / count).toFixed(2);
    setCustomAmounts(Array(count).fill(equalAmount));
  };

  const totalCustom = customAmounts.slice(0, installmentsCount).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  const isValidCustom = Math.abs(totalCustom - total) < 0.01;

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    try {
      const fullAddress = composeAddress();
      await onUpsertCorporateCustomer({ ...editingClient, address: fullAddress });
      setIsClientModalOpen(false);
      setEditingClient(null);
      onRefresh();
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    }
  };

  // Success Screen
  if (step === 'success') {
    return (
      <div className="flex flex-col h-full items-center justify-center px-8 text-center animate-in fade-in duration-500">
        <div className="size-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
          <span className="material-symbols-outlined text-5xl text-indigo-600">check_circle</span>
        </div>
        <h2 className="text-2xl font-black mb-2">VENDA EMPRESARIAL REALIZADA!</h2>
        <p className="text-slate-500 mb-2">{recipe?.name} para {selectedClient?.companyName}</p>
        <p className="text-2xl font-black text-indigo-600 mb-8">{formatCurrency(total)}</p>
        <button
          onClick={() => { setStep('client'); setSelectedClient(null); setSelectedRecipe(''); setQuantity(1); }}
          className="px-8 py-4 bg-indigo-600 text-white font-bold rounded-xl"
        >Nova Venda Empresarial</button>
      </div>
    );
  }

  // TAB: CLIENTES EMPRESARIAIS
  const renderClientes = () => (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Clientes Empresariais</h3>
          <p className="text-[10px] text-slate-400 font-medium">{corporateCustomers.length} empresas</p>
        </div>
        <button
          onClick={() => openClientModal({ companyName: '', cnpj: '', responsibleName: '', responsiblePhone: '' })}
          className="size-12 bg-indigo-600 text-white rounded-[18px] shadow-lg flex items-center justify-center active:scale-95 transition-all"
        ><span className="material-symbols-outlined">add</span></button>
      </div>

      <input type="text" placeholder="BUSCAR EMPRESA..." value={searchTerm}
        onChange={e => setSearchTerm(e.target.value.toUpperCase())}
        className="w-full h-12 px-5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] text-sm font-bold uppercase"
      />

      <div className="space-y-3">
        {filteredClients.map(c => (
          <div key={c.id} className="bg-white dark:bg-slate-800 p-5 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-700/50 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <h5 className="font-black text-slate-800 dark:text-white text-sm uppercase">{c.companyName}</h5>
                <p className="text-[10px] font-bold text-slate-400 uppercase">CNPJ: {c.cnpj}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openClientModal(c)}
                  className="size-10 bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
                ><span className="material-symbols-outlined text-lg">edit</span></button>
                <button onClick={async () => { if (confirm('Excluir esta empresa?')) { await onDeleteCorporateCustomer(c.id); onRefresh(); } }}
                  className="size-10 bg-slate-50 dark:bg-slate-900 text-red-400 rounded-2xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                ><span className="material-symbols-outlined text-lg">delete</span></button>
              </div>
            </div>
            <div className="flex gap-4 text-[10px] font-bold text-slate-400 uppercase">
              <span>👤 {c.responsibleName}</span>
              <span>📱 {c.responsiblePhone}</span>
            </div>
            {c.address && <p className="text-[10px] text-slate-400 font-medium">📍 {c.address}</p>}
          </div>
        ))}
      </div>
    </div>
  );

  // TAB: VENDER 
  const renderVender = () => (
    <div className="flex flex-col h-full animate-in fade-in duration-300 overflow-y-auto no-scrollbar pb-64">
      <div className="px-4 mt-2">
        <div className="flex gap-2">
          {['Empresa', 'Produto', 'Pagamento'].map((s, idx) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full ${(idx === 0 && selectedClient) ||
                (idx === 1 && (step === 'payment' || step === 'installments')) ||
                (idx === 2 && step === 'installments')
                ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <p className="text-[10px] text-slate-400 mt-1 text-center">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {selectedClient && (
        <div className="mx-4 mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center gap-3">
          <div className="size-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-indigo-600">business</span>
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">{selectedClient.companyName}</p>
            <p className="text-xs text-slate-500">{selectedClient.responsibleName} • {selectedClient.responsiblePhone}</p>
          </div>
          <button onClick={() => { setSelectedClient(null); setStep('client'); }} className="text-xs text-indigo-600 font-medium">Alterar</button>
        </div>
      )}

      <div className="p-4">
        {step === 'client' && (
          <>
            <h4 className="font-bold mb-3">Selecione a Empresa</h4>
            <input type="text" placeholder="BUSCAR EMPRESA..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value.toUpperCase())}
              className="w-full h-12 px-5 mb-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] text-sm font-bold uppercase"
            />
            <div className="space-y-3">
              {filteredClients.map(c => (
                <button key={c.id} onClick={() => { setSelectedClient(c); setStep('product'); }}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    selectedClient?.id === c.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 dark:border-slate-700'}`}
                >
                  <div className="size-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600">business</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold">{c.companyName}</p>
                    <p className="text-xs text-slate-500">{c.responsibleName}</p>
                  </div>
                </button>
              ))}
              {filteredClients.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">Nenhuma empresa encontrada</p>
                  <button onClick={() => setActiveTab('clientes')} className="mt-3 text-indigo-600 font-bold text-sm">Cadastrar nova empresa</button>
                </div>
              )}
            </div>
          </>
        )}

        {step === 'product' && (
          <>
            <h4 className="font-bold mb-3">Selecione o Produto</h4>
            <div className="space-y-3">
              {activeRecipesWithStock.length === 0 && (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inventory_2</span>
                  <p className="text-slate-400 text-sm font-bold">Nenhum produto com estoque empresarial</p>
                  <p className="text-[10px] text-slate-400">Aprove produções como "Empresarial" em Suprimentos</p>
                </div>
              )}
              {activeRecipesWithStock.map(r => {
                const qty = enterpriseStockByRecipe[r.id] || 0;
                return (
                  <button key={r.id} onClick={() => setSelectedRecipe(r.id)} disabled={qty <= 0}
                    className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                      selectedRecipe === r.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 dark:border-slate-700'}`}
                  >
                    {r.image ? (
                      <img src={r.image} alt={r.name} className="size-16 rounded-xl object-cover" />
                    ) : (
                      <div className="size-16 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-indigo-600">inventory_2</span>
                      </div>
                    )}
                    <div className="flex-1 text-left">
                      <p className="font-bold">{r.name}</p>
                      {r.weight && <p className="text-[10px] text-slate-400">{r.weight}</p>}
                      <p className="text-lg font-black text-indigo-600">{formatCurrency(r.price || 0)}</p>
                      <p className={`text-xs ${qty < 5 ? 'text-danger' : 'text-slate-400'}`}>
                        {qty > 0 ? `${qty} em estoque` : 'Sem estoque'}
                      </p>
                    </div>
                    {selectedRecipe === r.id && <span className="material-symbols-outlined text-indigo-600">check_circle</span>}
                  </button>
                );
              })}
            </div>
            {selectedRecipe && (
              <div className="mt-6">
                <h4 className="font-bold mb-3">Quantidade</h4>
                <div className="flex items-center gap-4 justify-center">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="size-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center active:scale-95"
                  ><span className="material-symbols-outlined">remove</span></button>
                  <span className="text-3xl font-black w-16 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(stockQty, quantity + 1))}
                    className="size-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center active:scale-95"
                  ><span className="material-symbols-outlined">add</span></button>
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
                { method: PaymentMethod.CARD, icon: 'credit_card', label: 'Cartão', desc: 'Cartão de crédito/débito' },
                { method: PaymentMethod.CASH, icon: 'payments', label: 'Dinheiro', desc: 'Pagamento em espécie' },
                { method: PaymentMethod.TERM, icon: 'calendar_month', label: 'A Prazo', desc: 'Pagamento parcelado' },
              ].map(option => (
                <button key={option.method}
                  onClick={() => { setPaymentMethod(option.method); if (option.method === PaymentMethod.TERM) generateInstallmentDates(installmentsCount); }}
                  className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                    paymentMethod === option.method ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 dark:border-slate-700'}`}
                >
                  <div className={`size-12 rounded-xl flex items-center justify-center ${
                    paymentMethod === option.method ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}>
                    <span className="material-symbols-outlined">{option.icon}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-bold">{option.label}</p>
                    <p className="text-xs text-slate-500">{option.desc}</p>
                  </div>
                  {paymentMethod === option.method && <span className="material-symbols-outlined text-indigo-600">check_circle</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'installments' && (
          <>
            <h4 className="font-bold mb-3">Configurar Parcelas</h4>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 mb-4">
              <p className="text-sm text-slate-500 mb-3">Número de Parcelas</p>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => { setInstallmentsCount(n); generateInstallmentDates(n); }}
                    className={`px-4 py-2 rounded-lg font-bold ${installmentsCount === n ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}
                  >{n}x</button>
                ))}
              </div>
              <div className="flex p-1 bg-slate-50 dark:bg-slate-700 rounded-xl mt-4 mb-2">
                <button onClick={() => setDistributionType('equal')} className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${distributionType === 'equal' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600' : 'text-slate-400'}`}>Parcelas Iguais</button>
                <button onClick={() => setDistributionType('custom')} className={`flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${distributionType === 'custom' ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600' : 'text-slate-400'}`}>Personalizar</button>
              </div>
              {distributionType === 'equal' ? (
                <p className="text-lg font-bold text-indigo-600 mt-3">{installmentsCount}x de {formatCurrency(total / installmentsCount)}</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {customAmounts.slice(0, installmentsCount).map((amt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 w-8">{idx + 1}ª</span>
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                        <input type="number" value={amt}
                          onChange={e => { const newAmts = [...customAmounts]; newAmts[idx] = e.target.value; setCustomAmounts(newAmts); }}
                          className="w-full h-11 pl-8 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                  <div className={`p-3 rounded-xl flex items-center justify-between mt-4 ${isValidCustom ? 'bg-success/5 border border-success/20' : 'bg-danger/5 border border-danger/20'}`}>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Soma</span>
                      <span className={`text-sm font-black ${isValidCustom ? 'text-success' : 'text-danger'}`}>{formatCurrency(totalCustom)}</span>
                    </div>
                    {!isValidCustom && <span className="text-[10px] font-bold text-danger max-w-[120px] text-right">A soma deve ser {formatCurrency(total)}</span>}
                    {isValidCustom && <span className="material-symbols-outlined text-success">check_circle</span>}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500 mb-3">Datas de Vencimento</p>
              <div className="space-y-2">
                {installmentDates.slice(0, installmentsCount).map((date, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-sm">Parcela {idx + 1}</span>
                    <input type="date" value={date > 0 ? new Date(date).toISOString().split('T')[0] : ''}
                      onChange={e => { const newDates = [...installmentDates]; newDates[idx] = new Date(e.target.value).getTime(); setInstallmentDates(newDates); }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
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
        {selectedRecipe && recipe && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 mb-3 border border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">{quantity}x {recipe.name}</p>
              <p className="text-xl font-black text-indigo-600">{formatCurrency(total)}</p>
            </div>
          </div>
        )}

        {step === 'product' && (
          <button onClick={() => setStep('payment')} disabled={!selectedClient || !selectedRecipe}
            className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
              selectedClient && selectedRecipe ? 'bg-indigo-600 text-white shadow-lg active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          >Continuar para Pagamento <span className="material-symbols-outlined">arrow_forward</span></button>
        )}

        {step === 'payment' && (
          <div className="flex gap-3">
            <button onClick={() => setStep('product')} className="h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-600 font-medium">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <button
              onClick={() => { if (paymentMethod === PaymentMethod.TERM) setStep('installments'); else handleConfirmSale(); }}
              disabled={isSaving}
              className={`flex-1 h-14 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                isSaving ? 'bg-slate-200 text-slate-400 cursor-wait' : 'bg-green-500 text-white active:scale-[0.98]'
              }`}
            >
              {paymentMethod === PaymentMethod.TERM ? (<>Configurar Parcelas <span className="material-symbols-outlined">arrow_forward</span></>) : (
                isSaving ? <div className="size-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <><span className="material-symbols-outlined">check</span> Confirmar Venda</>
              )}
            </button>
          </div>
        )}

        {step === 'installments' && (
          <div className="flex gap-3">
            <button onClick={() => setStep('payment')} className="h-14 px-4 rounded-xl border border-slate-200 dark:border-slate-600 font-medium">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <button onClick={handleConfirmSale} disabled={(distributionType === 'custom' && !isValidCustom) || isSaving}
              className={`flex-1 h-14 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                (distributionType === 'custom' && !isValidCustom) || isSaving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white active:scale-[0.98]'}`}
            >
              {isSaving ? <div className="size-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" /> : <><span className="material-symbols-outlined">check</span> Confirmar Venda</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 mt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('dashboard')} className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h3 className="text-lg font-bold leading-tight">Venda Empresarial</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Vendas para empresas</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-2">
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
          {[
            { id: 'vender' as const, label: 'VENDER', icon: 'point_of_sale' },
            { id: 'clientes' as const, label: 'EMPRESAS', icon: 'business' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600' : 'text-slate-400'}`}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'vender' ? renderVender() : renderClientes()}

      {/* MODAL: CLIENTE EMPRESARIAL */}
      {isClientModalOpen && editingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase">{editingClient.id ? 'Editar Empresa' : 'Nova Empresa'}</h3>
              <button onClick={() => { setIsClientModalOpen(false); setEditingClient(null); }} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Empresa</label>
                <input type="text" required placeholder="RAZÃO SOCIAL" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase" value={editingClient.companyName || ''} onChange={e => setEditingClient({ ...editingClient, companyName: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CNPJ</label>
                <input type="text" required placeholder="00.000.000/0000-00" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold" value={editingClient.cnpj || ''} onChange={e => setEditingClient({ ...editingClient, cnpj: maskCNPJ(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Responsável</label>
                <input type="text" required placeholder="NOME DO RESPONSÁVEL" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase" value={editingClient.responsibleName || ''} onChange={e => setEditingClient({ ...editingClient, responsibleName: e.target.value.toUpperCase() })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                  <input type="text" required placeholder="(00) 00000-0000" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold" value={editingClient.responsiblePhone || ''} onChange={e => setEditingClient({ ...editingClient, responsiblePhone: maskPhone(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <input type="email" placeholder="email@empresa.com" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold text-sm" value={editingClient.responsibleEmail || ''} onChange={e => setEditingClient({ ...editingClient, responsibleEmail: e.target.value })} />
                </div>
              </div>

              {/* Endereço com CEP */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="material-symbols-outlined text-slate-400 text-sm">location_on</span>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endereço</label>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[9px] font-bold text-slate-300 uppercase ml-1">CEP</label>
                    <div className="relative">
                      <input type="text" placeholder="00000-000"
                        className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm"
                        value={addrCep}
                        onChange={e => {
                          const masked = maskCEP(e.target.value);
                          setAddrCep(masked);
                          if (masked.replace(/\D/g, '').length === 8) handleCepLookup(masked);
                        }}
                      />
                      {isCepLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="size-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-bold text-slate-300 uppercase ml-1">Rua</label>
                    <input type="text" placeholder="RUA / AVENIDA" className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm uppercase" value={addrStreet} onChange={e => setAddrStreet(e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[9px] font-bold text-slate-300 uppercase ml-1">Número</label>
                    <input type="text" placeholder="Nº" className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm" value={addrNumber} onChange={e => setAddrNumber(e.target.value)} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-bold text-slate-300 uppercase ml-1">Complemento</label>
                    <input type="text" placeholder="SALA, ANDAR..." className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm uppercase" value={addrComplement} onChange={e => setAddrComplement(e.target.value.toUpperCase())} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-300 uppercase ml-1">Bairro</label>
                  <input type="text" placeholder="BAIRRO" className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm uppercase" value={addrNeighborhood} onChange={e => setAddrNeighborhood(e.target.value.toUpperCase())} />
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-3 space-y-1">
                    <label className="text-[9px] font-bold text-slate-300 uppercase ml-1">Cidade</label>
                    <input type="text" placeholder="CIDADE" className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm uppercase" value={addrCity} onChange={e => setAddrCity(e.target.value.toUpperCase())} />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-[9px] font-bold text-slate-300 uppercase ml-1">UF</label>
                    <input type="text" placeholder="UF" maxLength={2} className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl font-bold text-sm uppercase text-center" value={addrState} onChange={e => setAddrState(e.target.value.toUpperCase().slice(0, 2))} />
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg active:scale-[0.98] transition-all">
                {editingClient.id ? 'ATUALIZAR EMPRESA' : 'CADASTRAR EMPRESA'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateSaleView;
