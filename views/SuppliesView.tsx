import React, { useState, useMemo } from 'react';
import { 
  Supply, 
  SupplyEntry, 
  Supplier,
  BasketModel, 
  ViewState,
  SupplyRecipe,
  SupplyRecipeItem,
  Production,
} from '../types';
import { formatCurrency } from '../utils';
import { supabase } from '../supabase';

interface SuppliesViewProps {
  basketModels: BasketModel[];
  supplies: Supply[];
  supplyEntries: SupplyEntry[];
  suppliers: Supplier[];
  supplyRecipes: SupplyRecipe[];
  supplyRecipeItems: SupplyRecipeItem[];
  productions: Production[];
  onUpsertSupply: (supply: Partial<Supply>) => Promise<string | undefined>;
  onDeleteSupply: (id: string) => Promise<void>;
  onAddSupplyEntry: (entry: Omit<SupplyEntry, 'id' | 'createdAt'>) => Promise<void>;
  onUpsertSupplier: (supplier: Partial<Supplier>) => Promise<string | undefined>;
  onDeleteSupplier: (id: string) => Promise<void>;
  onDeleteSupplyEntry: (entryId: string, supplyId: string, quantity: number) => Promise<void>;
  onUpsertRecipe: (recipe: Partial<SupplyRecipe>, items: { supplyId: string, quantity: number }[]) => Promise<void>;
  onDeleteRecipe: (id: string) => Promise<void>;
  onRecordProduction: (recipeId: string, quantity: number) => Promise<void>;
  onApproveProduction: (id: string, channel: 'geral' | 'empresarial') => Promise<void>;
  onRejectProduction: (id: string) => Promise<void>;
  onRefresh: () => void;
  setView: (v: ViewState) => void;
  userId: string;
  userRole: string;
}

const SuppliesView: React.FC<SuppliesViewProps> = ({
  basketModels,
  supplies,
  supplyEntries,
  suppliers,
  supplyRecipes,
  supplyRecipeItems,
  productions,
  onUpsertSupply,
  onDeleteSupply,
  onAddSupplyEntry,
  onUpsertSupplier,
  onDeleteSupplier,
  onDeleteSupplyEntry,
  onUpsertRecipe,
  onDeleteRecipe,
  onRecordProduction,
  onApproveProduction,
  onRejectProduction,
  onRefresh,
  setView,
  userId,
  userRole
}) => {
  const [activeTab, setActiveTab] = useState<'insumos' | 'estoque' | 'fornecedores' | 'receitas' | 'producao'>('insumos');
  
  // Modals
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  
  // Editing State
  const [editingSupply, setEditingSupply] = useState<Partial<Supply> | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Partial<Supplier> | null>(null);
  const [selectedSupplyForEntry, setSelectedSupplyForEntry] = useState<Supply | null>(null);
  
  // Recipe Builder State
  const [editingRecipe, setEditingRecipe] = useState<Partial<SupplyRecipe> | null>(null);
  const [recipeItems, setRecipeItems] = useState<{ supplyId: string, quantity: number }[]>([]);

  // Production State
  const [selectedRecipeForProd, setSelectedRecipeForProd] = useState<SupplyRecipe | null>(null);
  const [productionQty, setProductionQty] = useState(0);
  const [isProcessingProduction, setIsProcessingProduction] = useState(false);

  // Approval Modal State
  const [approvingProductionId, setApprovingProductionId] = useState<string | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  // Calculator State
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false);
  const [calculatorRecipeId, setCalculatorRecipeId] = useState<string | null>(null);
  const [calculatorTargetQty, setCalculatorTargetQty] = useState(1);

  // Entries grouping state
  const [selectedEntryGroupKey, setSelectedEntryGroupKey] = useState<string | null>(null);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, SupplyEntry[]> = {};
    supplyEntries.forEach(e => {
      const d = new Date(e.receivedAt);
      const key = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[1][0].receivedAt - a[1][0].receivedAt);
  }, [supplyEntries]);

  // Calculations
  const calculateRecipeMax = (recipeId: string) => {
    const items = supplyRecipeItems.filter(i => i.recipeId === recipeId);
    if (items.length === 0) return 0;

    let minPotential = Infinity;
    items.forEach(item => {
      const supply = supplies.find(s => s.id === item.supplyId);
      if (supply) {
        const pot = Math.floor(supply.currentQuantity / (item.quantity || 1));
        if (pot < minPotential) minPotential = pot;
      }
    });

    return minPotential === Infinity ? 0 : minPotential;
  };

  const lowStockCount = supplies.filter(s => s.currentQuantity <= s.minStock).length;

  const dashboardPotentials = useMemo(() => {
    return supplyRecipes.filter(r => r.active).map(recipe => {
      const potential = calculateRecipeMax(recipe.id);
      return { recipeId: recipe.id, name: recipe.name, potential };
    });
  }, [supplyRecipes, supplyRecipeItems, supplies]);

  // Handlers
  const handleSaveSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupply?.name || !editingSupply?.category) return;
    try {
      await onUpsertSupply(editingSupply);
      setIsSupplyModalOpen(false);
      setEditingSupply(null);
      onRefresh();
    } catch (err) {
      alert('Erro ao salvar insumo');
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier?.name) return;
    try {
      await onUpsertSupplier(editingSupplier);
      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      onRefresh();
    } catch (err) {
      alert('Erro ao salvar fornecedor');
    }
  };

  const handleAddEntry = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const quantity = Number(formData.get('quantity'));
    const unitCost = Number(formData.get('unitCost'));
    const supplierId = String(formData.get('supplierId'));
    const notes = String(formData.get('notes'));

    if (!selectedSupplyForEntry || !quantity || !unitCost) return;

    try {
      await onAddSupplyEntry({
        supplyId: selectedSupplyForEntry.id,
        quantity,
        unitCost,
        supplierId: supplierId || undefined,
        notes,
        receivedAt: Date.now(),
        createdBy: userId
      });
      setIsEntryModalOpen(false);
      onRefresh();
    } catch (err) {
      alert('Erro ao registrar entrada');
    }
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe?.name || recipeItems.length === 0) {
      alert('Nome da receita e itens são obrigatórios');
      return;
    }
    try {
      await onUpsertRecipe(editingRecipe, recipeItems);
      setIsRecipeModalOpen(false);
      setEditingRecipe(null);
      setRecipeItems([]);
      onRefresh();
    } catch (err) {
      alert('Erro ao salvar receita');
    }
  };

  const handleRecordProd = async () => {
    if (!selectedRecipeForProd || productionQty <= 0) return;
    setIsProcessingProduction(true);
    try {
      await onRecordProduction(selectedRecipeForProd.id, productionQty);
      setProductionQty(0);
      setSelectedRecipeForProd(null);
      onRefresh();
    } catch (err) {
      alert('Erro ao registrar produção');
    } finally {
      setIsProcessingProduction(false);
    }
  };

  const renderRecipes = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Modelos de Receita</h3>
          <p className="text-[10px] text-slate-400 font-medium">Defina quais insumos compõem cada cesta.</p>
        </div>
        <button 
          onClick={() => { setEditingRecipe({ name: '', active: true, price: 0 }); setRecipeItems([]); setIsRecipeModalOpen(true); }}
          className="size-12 bg-primary text-white rounded-[18px] shadow-lg flex items-center justify-center active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {supplyRecipes.map(r => (
          <div key={r.id} className="bg-white dark:bg-slate-800 p-5 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
             <div>
                <h5 className="font-black text-slate-800 dark:text-white text-sm uppercase">{r.name}</h5>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                  {supplyRecipeItems.filter(i => i.recipeId === r.id).length} ITENS • {r.active ? <span className="text-green-500">ATIVA</span> : <span className="text-red-500">INATIVA</span>}
                </p>
             </div>
             <button 
               onClick={() => { 
                 setEditingRecipe(r); 
                 setRecipeItems(supplyRecipeItems.filter(i => i.recipeId === r.id).map(i => ({ supplyId: i.supplyId, quantity: i.quantity }))); 
                 setIsRecipeModalOpen(true); 
               }}
               className="size-10 bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-primary hover:text-white transition-all"
             >
                <span className="material-symbols-outlined text-lg">edit</span>
             </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderProducao = () => {
    const pendingProds = productions.filter(p => p.status === 'PENDENTE');
    const historyProds = productions.filter(p => p.status !== 'PENDENTE').slice(0, 10);
    const potential = selectedRecipeForProd ? calculateRecipeMax(selectedRecipeForProd.id) : 0;

    return (
      <div className="space-y-8">
        {/* Nova Produção */}
        <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-sm border border-slate-100 dark:border-slate-800 space-y-6">
          <div className="space-y-1">
            <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Nova Montagem</h3>
            <p className="text-[10px] text-slate-400 font-medium">Selecione a receita para iniciar a montagem.</p>
          </div>

          <div className="space-y-4">
            <select 
              className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[24px] font-bold text-slate-800 dark:text-white"
              value={selectedRecipeForProd?.id || ''}
              onChange={e => setSelectedRecipeForProd(supplyRecipes.find(r => r.id === e.target.value) || null)}
            >
              <option value="">Selecione a receita...</option>
              {supplyRecipes.filter(r => r.active).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            {selectedRecipeForProd && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex items-center justify-between">
                   <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">Saldo de Insumos para</span>
                   <span className="font-black text-blue-700 dark:text-blue-300">{potential} Unidades</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <input 
                    type="number"
                    placeholder="Quantidade de cestas montadas"
                    className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[24px] font-black outline-none focus:border-primary"
                    value={productionQty || ''}
                    onChange={e => setProductionQty(Number(e.target.value))}
                  />
                  <button 
                    onClick={handleRecordProd}
                    disabled={isProcessingProduction || productionQty <= 0 || productionQty > potential}
                    className={`h-14 rounded-[24px] font-black uppercase tracking-widest text-xs transition-all ${
                      isProcessingProduction || productionQty <= 0 || productionQty > potential
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-primary text-white shadow-lg'
                    }`}
                  >
                    Registrar Produção
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pendentes (Somente Gerente) */}
        {pendingProds.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-amber-500">pending_actions</span>
              <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-[10px]">Aguardando Aprovação</h4>
            </div>
            <div className="space-y-3">
              {pendingProds.map(p => {
                const recipe = supplyRecipes.find(r => r.id === p.recipeId);
                return (
                  <div key={p.id} className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-[32px] border border-amber-100 dark:border-amber-900/30 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-amber-600 uppercase mb-1">{recipe?.name}</p>
                      <h5 className="font-black text-slate-800 dark:text-white text-lg">{p.quantity} Unidades</h5>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(p.createdAt).toLocaleString()}</p>
                    </div>
                    {userRole === 'gerente' && (
                      <div className="flex gap-2">
                        <button onClick={() => onRejectProduction(p.id)} className="size-12 bg-white dark:bg-slate-800 text-red-500 rounded-2xl flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined">close</span>
                        </button>
                        <button onClick={() => { setApprovingProductionId(p.id); setIsApprovalModalOpen(true); }} className="size-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-md">
                          <span className="material-symbols-outlined">check</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Histórico Recente */}
        <div className="space-y-4">
          <h4 className="font-black text-slate-400 uppercase tracking-widest text-[10px] px-2">Histórico Recente</h4>
          <div className="space-y-2">
            {historyProds.map(p => {
              const recipe = supplyRecipes.find(r => r.id === p.recipeId);
              return (
                <div key={p.id} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700/50 flex items-center justify-between opacity-70">
                   <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${p.status === 'APROVADO' ? 'text-green-500' : 'text-red-500'}`}>
                        {p.status === 'APROVADO' ? 'check_circle' : 'cancel'}
                      </span>
                      <div>
                        <p className="text-xs font-black text-slate-700 dark:text-white uppercase">{recipe?.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">{p.quantity} UN • {new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                   </div>
                   <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${p.status === 'APROVADO' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                     {p.status}
                   </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500">
      {/* Projection Dashboard */}
      <div className="bg-[#0a4da3] p-5 rounded-[32px] shadow-xl text-white overflow-hidden relative">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-secondary">analytics</span>
            <h3 className="font-black uppercase tracking-widest text-xs">Potencial de Produção</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {dashboardPotentials.map(dp => (
              <div 
                key={dp.recipeId} 
                onClick={() => { setCalculatorRecipeId(dp.recipeId); setCalculatorTargetQty(dp.potential === 0 ? 1 : dp.potential); setIsCalculatorModalOpen(true); }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-3 flex items-center justify-between border border-white/10 hover:bg-white/20 cursor-pointer transition-all active:scale-[0.98]"
              >
                <span className="font-bold text-xs uppercase tracking-tight">{dp.name}</span>
                <span className="font-black text-secondary text-lg">
                  {dp.potential} UN
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-10 -right-10 size-40 bg-white/5 rounded-full blur-3xl">
           {lowStockCount > 0 && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 material-symbols-outlined text-6xl opacity-20">warning</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-transparent pb-2">
        {[
          { id: 'insumos', label: 'Insumos', icon: 'inventory_2' },
          { id: 'estoque', label: 'Entradas', icon: 'shopping_cart' },
          { id: 'receitas', label: 'Receitas', icon: 'set_meal' },
          { id: 'producao', label: 'Produção', icon: 'precision_manufacturing' },
          { id: 'fornecedores', label: 'Fornecedores', icon: 'local_shipping' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-[90px] py-3 px-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'}`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'insumos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <div>
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Cadastro de Insumos</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Defina as características técnicas dos itens.</p>
               </div>
               <button 
                 onClick={() => { setEditingSupply({ name: '', category: 'MANTIMENTOS', unit: 'KG', volume: '', packageType: 'PACOTE', minStock: 0 }); setIsSupplyModalOpen(true); }}
                 className="size-12 bg-primary text-white rounded-[18px] shadow-lg flex items-center justify-center active:scale-95 transition-all"
               >
                 <span className="material-symbols-outlined">add</span>
               </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
               {supplies.map(s => (
                 <div key={s.id} className="bg-white dark:bg-slate-800 p-4 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-700/50 flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                       <div className={`size-12 rounded-2xl flex items-center justify-center ${
                          s.category === 'MANTIMENTOS' ? 'bg-amber-100 text-amber-600' : 
                          s.category === 'LIMPEZA' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                       }`}>
                          <span className="material-symbols-outlined">{s.category === 'LIMPEZA' ? 'sanitizer' : 'eco'}</span>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{s.category} • {s.packageType}</p>
                          <h5 className="font-black text-slate-800 dark:text-white text-sm">
                             {s.name} <span className="text-slate-400 font-bold ml-1">{s.brand}</span>
                          </h5>
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{s.volume} {s.unit}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="text-right mr-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Saldo</p>
                          <p className={`font-black ${s.currentQuantity <= s.minStock ? 'text-red-500' : 'text-slate-800 dark:text-white'}`}>
                             {s.currentQuantity}
                          </p>
                       </div>
                       <button 
                         onClick={() => { setEditingSupply(s); setIsSupplyModalOpen(true); }}
                         className="size-9 bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                       >
                         <span className="material-symbols-outlined text-lg">edit</span>
                       </button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Entradas de Estoque</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Registre as compras e reposições.</p>
                </div>
                <button 
                  onClick={() => setIsEntryModalOpen(true)}
                  className="size-12 bg-green-500 text-white rounded-[18px] shadow-lg flex items-center justify-center active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined">add_shopping_cart</span>
                </button>
             </div>

             <div className="space-y-4">
                {groupedEntries.map(([groupKey, entries]) => {
                  const totalItems = entries.length;
                  const totalCost = entries.reduce((acc, e) => acc + (e.quantity * e.unitCost), 0);
                  
                  return (
                    <div key={groupKey} className="bg-white dark:bg-slate-800 rounded-[28px] shadow-sm border border-slate-100 dark:border-slate-700/50 overflow-hidden">
                       <div 
                         onClick={() => setSelectedEntryGroupKey(groupKey)}
                         className="flex justify-between items-center p-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-[0.99]"
                       >
                         <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className="material-symbols-outlined text-primary text-sm">schedule</span>
                               <h5 className="font-black text-slate-800 dark:text-white uppercase tracking-wider">{groupKey}</h5>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{totalItems} {totalItems === 1 ? 'Lançamento' : 'Lançamentos'}</p>
                         </div>
                         <div className="flex items-center gap-4">
                            <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Custo Total</p>
                               <span className="text-sm font-black text-green-600">{formatCurrency(totalCost)}</span>
                            </div>
                            <span className="material-symbols-outlined text-slate-400 transition-transform duration-300">open_in_new</span>
                         </div>
                       </div>
                    </div>
                  );
                })}
                {groupedEntries.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Nenhuma entrada registrada</p>}
             </div>
          </div>
        )}

        {activeTab === 'fornecedores' && (
           <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <div>
                   <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-xs">Gestão de Fornecedores</h3>
                   <p className="text-[10px] text-slate-400 font-medium">Lista mestre para registros de compra.</p>
                 </div>
                 <button 
                   onClick={() => { setEditingSupplier({ name: '' }); setIsSupplierModalOpen(true); }}
                   className="size-12 bg-indigo-500 text-white rounded-[18px] shadow-lg flex items-center justify-center active:scale-95 transition-all"
                 >
                   <span className="material-symbols-outlined">person_add</span>
                 </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                 {suppliers.map(sup => (
                    <div key={sup.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm flex items-center justify-between border border-slate-100 dark:border-slate-700/50">
                       <span className="font-black text-sm text-slate-700 dark:text-white uppercase">{sup.name}</span>
                       <div className="flex gap-1">
                          <button onClick={() => { setEditingSupplier(sup); setIsSupplierModalOpen(true); }} className="size-8 text-slate-400 hover:text-primary transition-colors">
                             <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button onClick={() => { if(confirm('Excluir fornecedor?')) onDeleteSupplier(sup.id); }} className="size-8 text-slate-400 hover:text-red-500 transition-colors">
                             <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'producao' && renderProducao()}
        {activeTab === 'receitas' && renderRecipes()}
      </div>

      {/* MODAL: INSUMO */}
      {isSupplyModalOpen && editingSupply && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
               <div className="p-8 pb-4 flex justify-between items-center">
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase">Insumo</h3>
                  <button onClick={() => setIsSupplyModalOpen(false)} className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                     <span className="material-symbols-outlined">close</span>
                  </button>
               </div>
               <form onSubmit={handleSaveSupply} className="p-8 pt-4 space-y-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoria</label>
                     <select className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold" value={editingSupply.category} onChange={e => setEditingSupply({...editingSupply, category: e.target.value as any})}><option value="MANTIMENTOS">MANTIMENTOS</option><option value="LIMPEZA">LIMPEZA</option><option value="MISTURA">MISTURA/FRIOS</option></select>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome</label>
                     <input type="text" required placeholder="NOME" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase" value={editingSupply.name} onChange={e => setEditingSupply({...editingSupply, name: e.target.value.toUpperCase()})}/>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca</label>
                     <input type="text" placeholder="MARCA" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase" value={editingSupply.brand} onChange={e => setEditingSupply({...editingSupply, brand: e.target.value.toUpperCase()})}/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <input type="text" placeholder="TAMANHO (EX: 5)" className="h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold" value={editingSupply.volume} onChange={e => setEditingSupply({...editingSupply, volume: e.target.value.toUpperCase()})}/>
                     <select className="h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold" value={editingSupply.unit} onChange={e => setEditingSupply({...editingSupply, unit: e.target.value})}><option value="KG">KG</option><option value="L">LITROS</option><option value="UN">UN</option></select>
                  </div>
                  <button type="submit" className="w-full h-14 bg-primary text-white font-black rounded-[22px] uppercase">Salvar Insumo</button>
               </form>
            </div>
         </div>
      )}

      {/* MODAL: RECEITA */}
      {isRecipeModalOpen && editingRecipe && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
              <div className="p-8 pb-4 flex justify-between items-center">
                 <h3 className="text-2xl font-black text-slate-800 dark:text-white uppercase">Mestre de Receita</h3>
                 <button onClick={() => setIsRecipeModalOpen(false)} className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>

              <form onSubmit={handleSaveRecipe} className="p-8 pt-4 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Receita</label>
                       <input type="text" required placeholder="EX: CESTA ECONOMICA A" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase" value={editingRecipe.name} onChange={e => setEditingRecipe({...editingRecipe, name:e.target.value.toUpperCase()})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status da Receita</label>
                       <button 
                         type="button"
                         onClick={() => setEditingRecipe({...editingRecipe, active: !editingRecipe.active})}
                         className={`w-full h-14 rounded-[20px] font-black uppercase text-xs transition-all border-2 ${editingRecipe.active ? 'bg-green-50 border-green-200 text-green-600' : 'bg-red-50 border-red-200 text-red-600'}`}
                       >
                         {editingRecipe.active ? 'RECEITA ATIVA' : 'RECEITA INATIVA'}
                       </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço de Venda</label>
                       <input type="number" step="0.01" placeholder="0.00" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold" value={editingRecipe.price || ''} onChange={e => setEditingRecipe({...editingRecipe, price: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Peso (EX: 12KG)</label>
                       <input type="text" placeholder="EX: 12KG" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase" value={editingRecipe.weight || ''} onChange={e => setEditingRecipe({...editingRecipe, weight: e.target.value.toUpperCase()})} />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descrição</label>
                    <textarea placeholder="DESCRIÇÃO DA CESTA" rows={2} className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase resize-none" value={editingRecipe.description || ''} onChange={e => setEditingRecipe({...editingRecipe, description: e.target.value.toUpperCase()})} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Foto da Cesta</label>
                    {editingRecipe.image && (
                      <div className="relative w-full h-40 rounded-[20px] overflow-hidden border-2 border-slate-100 dark:border-slate-700 mb-2">
                        <img src={editingRecipe.image} alt="Preview" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setEditingRecipe({...editingRecipe, image: ''})} className="absolute top-2 right-2 size-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    )}
                    <label className={`w-full h-14 flex items-center justify-center gap-2 rounded-[20px] border-2 border-dashed cursor-pointer transition-all ${editingRecipe.image ? 'border-green-300 bg-green-50 text-green-600' : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:border-primary hover:text-primary'}`}>
                      <span className="material-symbols-outlined">{editingRecipe.image ? 'check_circle' : 'cloud_upload'}</span>
                      <span className="text-xs font-black uppercase tracking-widest">{editingRecipe.image ? 'ALTERAR FOTO' : 'CARREGAR FOTO'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split('.').pop();
                        const fileName = `recipe_${Date.now()}.${ext}`;
                        const { error } = await supabase.storage.from('basket-images').upload(fileName, file, { upsert: true });
                        if (error) { alert('Erro ao enviar foto: ' + error.message); return; }
                        const { data: urlData } = supabase.storage.from('basket-images').getPublicUrl(fileName);
                        setEditingRecipe({...editingRecipe, image: urlData.publicUrl});
                      }} />
                    </label>
                 </div>

                 <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Itens da Composição</h4>
                       <button type="button" onClick={() => setRecipeItems([...recipeItems, { supplyId: '', quantity: 1 }])} className="text-primary font-black text-[10px] uppercase">Adicionar Item</button>
                    </div>
                    <div className="space-y-3">
                       {recipeItems.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                             <select className="flex-1 bg-transparent font-bold text-xs outline-none" value={item.supplyId} onChange={e => {
                                const newItems = [...recipeItems];
                                newItems[idx].supplyId = e.target.value;
                                setRecipeItems(newItems);
                             }}>
                                <option value="">Insumo...</option>
                                {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.brand})</option>)}
                             </select>
                             <input type="number" min="1" className="w-20 bg-transparent font-black text-center text-xs outline-none" value={item.quantity} onChange={e => {
                                const newItems = [...recipeItems];
                                newItems[idx].quantity = Math.max(1, Number(e.target.value));
                                setRecipeItems(newItems);
                             }} />
                             <button type="button" onClick={() => setRecipeItems(recipeItems.filter((_, i) => i !== idx))} className="text-red-400"><span className="material-symbols-outlined text-sm">remove_circle</span></button>
                          </div>
                       ))}
                    </div>
                 </div>

                 <div className="flex gap-3">
                    {editingRecipe.id && (
                       <button type="button" onClick={() => { if(confirm('Excluir esta receita?')) { onDeleteRecipe(editingRecipe.id!); setIsRecipeModalOpen(false); onRefresh(); } }} className="h-14 px-6 border-2 border-red-100 text-red-500 rounded-2xl font-black uppercase text-[10px]">Excluir</button>
                    )}
                    <button type="submit" className="flex-1 h-14 bg-primary text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Salvar Receita Mestre</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {isSupplierModalOpen && editingSupplier && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black uppercase">Fornecedor</h3>
                  <button onClick={() => setIsSupplierModalOpen(false)} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400"><span className="material-symbols-outlined">close</span></button>
               </div>
               <form onSubmit={handleSaveSupplier} className="space-y-6">
                  <input type="text" required placeholder="NOME DO FORNECEDOR" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase" value={editingSupplier.name} onChange={e => setEditingSupplier({...editingSupplier, name: e.target.value.toUpperCase()})}/>
                  <button type="submit" className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black uppercase shadow-lg">Salvar</button>
               </form>
            </div>
         </div>
      )}

      {isEntryModalOpen && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl overflow-hidden">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black uppercase">Entrada Insumo</h3>
                  <button onClick={() => setIsEntryModalOpen(false)} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400"><span className="material-symbols-outlined">close</span></button>
               </div>
               <form onSubmit={handleAddEntry} className="space-y-4">
                  <select required className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold text-xs" onChange={(e) => setSelectedSupplyForEntry(supplies.find(s => s.id === e.target.value) || null)}>
                     <option value="">Selecione Insumo...</option>
                     {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.brand})</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                     <input name="quantity" type="number" step="0.01" required placeholder="QTD" className="h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold"/>
                     <input name="unitCost" type="number" step="0.01" required placeholder="CUSTO UN." className="h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold"/>
                  </div>
                  <select name="supplierId" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold">
                     <option value="">Fornecedor...</option>
                     {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </select>
                  <input name="notes" type="text" placeholder="NOTAS" className="w-full h-14 px-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[20px] font-bold uppercase"/>
                  <button type="submit" className="w-full h-14 bg-green-500 text-white rounded-2xl font-black uppercase shadow-lg">Confirmar Entrada</button>
               </form>
            </div>
         </div>
      )}

      {/* CALCULATOR MODAL */}
      {isCalculatorModalOpen && calculatorRecipeId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[140] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase">Calculadora</h3>
                 <button onClick={() => { setIsCalculatorModalOpen(false); setCalculatorRecipeId(null); }} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                   <span className="material-symbols-outlined">close</span>
                 </button>
              </div>
              
              {(() => {
                const recipe = supplyRecipes.find(r => r.id === calculatorRecipeId);
                const items = supplyRecipeItems.filter(i => i.recipeId === calculatorRecipeId);
                const results = items.map(item => {
                  const supply = supplies.find(s => s.id === item.supplyId);
                  const required = (item.quantity || 1) * calculatorTargetQty;
                  const current = supply ? supply.currentQuantity : 0;
                  const missing = Math.max(0, required - current);
                  return { supplyName: supply ? `${supply.name} (${supply.brand})` : 'Insumo', required, current, missing };
                });
                const hasMissing = results.some(r => r.missing > 0);

                const handleGeneratePDF = () => {
                  const missingItems = results.filter(i => i.missing > 0);
                  if (missingItems.length === 0) {
                    alert("Não há itens faltantes para gerar pedido de compra.");
                    return;
                  }

                  const printWindow = window.open('', '', 'width=800,height=800');
                  if (!printWindow) return;

                  const today = new Date().toLocaleDateString('pt-BR');
                  
                  let html = `
                    <html>
                      <head>
                        <title>Pedido de Compra - ${recipe?.name || 'Receita'}</title>
                        <style>
                          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
                          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
                          .title { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
                          .subtitle { font-size: 14px; color: #64748b; margin-top: 5px; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th { text-align: left; padding: 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b; }
                          td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
                          .qty { font-weight: 900; text-align: center; color: #ef4444; }
                          .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; }
                          @media print {
                            body { padding: 0; }
                            button { display: none; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          <h1 class="title">Pedido de Compra</h1>
                          <p class="subtitle">Modelo: <strong>${recipe?.name || 'Receita'}</strong> | Data: ${today} | Meta: ${calculatorTargetQty} cestas</p>
                        </div>
                        <table>
                          <thead>
                            <tr>
                              <th>Cód. / Insumo</th>
                              <th style="text-align: center">Estoque Atual</th>
                              <th style="text-align: center">Total p/ Receita</th>
                              <th style="text-align: center">Faltam Comprar</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${missingItems.map(item => `
                              <tr>
                                <td><strong>${item.supplyName}</strong></td>
                                <td style="text-align: center">${item.current}</td>
                                <td style="text-align: center">${item.required}</td>
                                <td class="qty">${item.missing}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                        <div class="footer">Gerado via Cesta Básica na sua Casa - ${new Date().toLocaleString()}</div>
                        <script>
                          window.onload = () => { setTimeout(() => { window.print(); window.onafterprint = () => window.close(); }, 500); }
                        </script>
                      </body>
                    </html>
                  `;
                  printWindow.document.write(html);
                  printWindow.document.close();
                };

                return (
                  <div className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Composição</p>
                      <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase">{recipe?.name}</h4>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold uppercase block mb-2">Meta de Produção Cestas</label>
                      <input 
                        type="number" 
                        min="1"
                        value={calculatorTargetQty} 
                        onChange={e => setCalculatorTargetQty(Math.max(1, Number(e.target.value)))} 
                        className="w-full h-16 px-6 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black text-xl text-center outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <h5 className={`text-[10px] font-black uppercase flex items-center gap-2 ${hasMissing ? 'text-red-500' : 'text-emerald-500'}`}>
                          <span className="material-symbols-outlined text-sm">{hasMissing ? 'shopping_cart' : 'inventory_2'}</span>
                          {hasMissing ? 'Lista de Compras Necessária' : 'Você tem Insumos Suficientes!'}
                        </h5>
                        {hasMissing && (
                          <button 
                            onClick={handleGeneratePDF}
                            className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                            Gerar Pedido
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {results.length === 0 && <p className="text-xs text-slate-400">Esta receita não tem itens vinculados ainda.</p>}
                        {results.map((r, idx) => (
                           <div key={idx} className={`p-4 rounded-2xl border ${r.missing > 0 ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'} flex justify-between items-center transition-all`}>
                             <div className="flex-1">
                               <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 truncate tracking-wide">{r.supplyName}</p>
                               <div className="flex gap-3 mt-1.5 opacity-80">
                                   <p className="text-[9px] text-slate-500 font-bold">Estoque Atual: <span className="text-slate-700 dark:text-white ml-1">{r.current}</span></p>
                                   <p className="text-[9px] text-slate-500 font-bold">Total P/ Receita: <span className="text-slate-700 dark:text-white ml-1">{r.required}</span></p>
                               </div>
                             </div>
                             {r.missing > 0 ? (
                               <div className="ml-3 text-right bg-white dark:bg-slate-800 rounded-[12px] px-3 py-1.5 shadow-sm">
                                 <span className="text-[8px] font-black text-red-400 uppercase block leading-tight">Faltam</span>
                                 <span className="text-lg font-black text-red-600 leading-none">{r.missing}</span>
                               </div>
                             ) : (
                               <div className="ml-3">
                                 <span className="material-symbols-outlined text-emerald-500 text-3xl opacity-80">check_circle</span>
                               </div>
                             )}
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
           </div>
        </div>
      )}

      {/* MODAL DE ENTRADAS DE ESTOQUE (AGRUPADAS) */}
      {selectedEntryGroupKey && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[140] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl space-y-6 animate-in zoom-in-95 max-h-[90vh] flex flex-col">
               <div className="flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="text-xl font-black uppercase">Detalhes da Entrada</h3>
                     <p className="text-sm font-bold text-primary mt-1">{selectedEntryGroupKey}</p>
                  </div>
                  <button onClick={() => setSelectedEntryGroupKey(null)} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined">close</span>
                  </button>
               </div>

               <div className="flex-1 overflow-auto custom-scrollbar pr-2">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="border-b-2 border-slate-100 dark:border-slate-800">
                           <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Insumo</th>
                           <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</th>
                           <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd</th>
                           <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Custo Un.</th>
                           <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                           <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {groupedEntries.find(g => g[0] === selectedEntryGroupKey)?.[1].map(e => {
                           const supply = supplies.find(s => s.id === e.supplyId);
                           const supplier = suppliers.find(sup => sup.id === e.supplierId);
                           return (
                              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                 <td className="py-4 pr-4">
                                    <h6 className="font-extrabold text-slate-800 dark:text-white text-xs whitespace-nowrap">{supply?.name}</h6>
                                    <p className="text-[10px] text-slate-400 font-bold">{supply?.brand}</p>
                                 </td>
                                 <td className="py-4 pr-4 text-[10px] font-bold text-slate-500 uppercase">{supplier?.name || e.supplier || 'N/A'}</td>
                                 <td className="py-4 px-2 text-center text-sm font-black text-slate-800 dark:text-white">+{e.quantity}</td>
                                 <td className="py-4 pl-4 text-right text-xs font-bold text-slate-500">{formatCurrency(e.unitCost)}</td>
                                 <td className="py-4 pl-4 text-right text-sm font-black text-green-600">{formatCurrency(e.quantity * e.unitCost)}</td>
                                 <td className="py-4 pl-4 text-center">
                                    <button 
                                      onClick={() => { if(confirm('Excluir esta entrada?')) { onDeleteSupplyEntry(e.id, e.supplyId, e.quantity); setSelectedEntryGroupKey(null); } }}
                                      className="size-8 mx-auto bg-red-50 dark:bg-red-900/30 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                                      title="Excluir Entrada"
                                    >
                                       <span className="material-symbols-outlined text-[15px]">delete</span>
                                    </button>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
               
               <div className="pt-4 border-t-2 border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total do Lançamento</span>
                  <span className="text-xl font-black text-green-600">
                     {formatCurrency(groupedEntries.find(g => g[0] === selectedEntryGroupKey)?.[1].reduce((acc, e) => acc + (e.quantity * e.unitCost), 0) || 0)}
                  </span>
               </div>
            </div>
         </div>
      )}

      {/* MODAL: APROVAÇÃO COM CANAL */}
      {isApprovalModalOpen && approvingProductionId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[130] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl space-y-6 animate-in zoom-in-95">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase">Destino do Estoque</h3>
                 <button onClick={() => { setIsApprovalModalOpen(false); setApprovingProductionId(null); }} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                   <span className="material-symbols-outlined">close</span>
                 </button>
              </div>
              <p className="text-xs text-slate-400 font-medium">Escolha para onde essas cestas serão direcionadas após a aprovação.</p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    await onApproveProduction(approvingProductionId, 'geral');
                    setIsApprovalModalOpen(false);
                    setApprovingProductionId(null);
                    onRefresh();
                  }}
                  className="w-full p-5 rounded-[24px] border-2 border-green-200 bg-green-50 dark:bg-green-900/20 flex items-center gap-4 hover:border-green-400 transition-all active:scale-[0.98]"
                >
                  <div className="size-14 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-2xl">storefront</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-green-700 dark:text-green-300 uppercase text-sm">Venda Geral</p>
                    <p className="text-[10px] text-slate-400 font-medium">Disponível para vendedores e loja online</p>
                  </div>
                </button>
                <button
                  onClick={async () => {
                    await onApproveProduction(approvingProductionId, 'empresarial');
                    setIsApprovalModalOpen(false);
                    setApprovingProductionId(null);
                    onRefresh();
                  }}
                  className="w-full p-5 rounded-[24px] border-2 border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 flex items-center gap-4 hover:border-indigo-400 transition-all active:scale-[0.98]"
                >
                  <div className="size-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-2xl">business</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-indigo-700 dark:text-indigo-300 uppercase text-sm">Venda Empresarial</p>
                    <p className="text-[10px] text-slate-400 font-medium">Disponível apenas na tela de venda empresarial</p>
                  </div>
                </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default SuppliesView;
