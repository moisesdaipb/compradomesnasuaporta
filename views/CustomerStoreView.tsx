import React, { useState, useEffect, useMemo } from 'react';
import { ViewState, BasketModel, StockItem, SaleItem, BasketModelItem, AppSettings } from '../types';
import { getStockQuantity, fetchBasketModelItems } from '../store';

interface CustomerStoreViewProps {
    basketModels: BasketModel[];
    stock: StockItem[];
    cart: SaleItem[];
    settings?: AppSettings;
    onAddToCart: (modelId: string, quantity?: number) => void;
    setView: (v: ViewState) => void;
}

type ItemsByCategory = {
    alimentos: { name: string; qty: string }[];
    limpeza: { name: string; qty: string }[];
    mistura: { name: string; qty: string }[];
};

const CATEGORY_CONFIG = {
    alimentos: { icon: '🍚', label: 'Alimentos', titleColor: '#166534', lightBg: '#f0fdf4', borderColor: '#bbf7d0', iconBg: '#dcfce7' },
    limpeza: { icon: '✨', label: 'Limpeza', titleColor: '#6b21a8', lightBg: '#faf5ff', borderColor: '#e9d5ff', iconBg: '#f3e8ff' },
    mistura: { icon: '🥩', label: 'Carnes e Mistura', titleColor: '#9a3412', lightBg: '#fff7ed', borderColor: '#fed7aa', iconBg: '#ffedd5' },
} as const;

// Module-level cache — persists across component re-mounts (view navigation)
let _itemsCache: Record<string, ItemsByCategory> = {};

const CustomerStoreView: React.FC<CustomerStoreViewProps> = ({
    basketModels,
    stock,
    cart,
    settings,
    onAddToCart,
    setView,
}) => {
    // ... [No changes needed here until Quick View Modal rendering] ...
    const [search, setSearch] = useState('');
    // Filter Logic
    const [filter, setFilter] = useState<'todos' | 'mais-vendidos' | 'destaques'>('todos');

    const activeModels = useMemo(() => {
        return basketModels
            .filter(m => {
                const matchesSearch = m.active && m.name.toLowerCase().includes(search.toLowerCase());
                if (!matchesSearch) return false;

                if (filter === 'mais-vendidos') return m.isBestSeller;
                if (filter === 'destaques') return m.isFeatured;
                return true;
            })
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    }, [basketModels, search, filter]);

    // Carousel Logic
    const [currentSlide, setCurrentSlide] = useState(0);
    const slides = useMemo(() => [null, ...activeModels.filter(m => m.isFeatured).slice(0, 5)], [activeModels]);

    useEffect(() => {
        if (slides.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 5000); // 5 seconds per slide
        return () => clearInterval(timer);
    }, [slides.length]);


    // Use cache as initial state so items appear instantly on re-mount
    const [allItems, setAllItems] = useState<Record<string, ItemsByCategory>>(_itemsCache);
    const [loadingItems, setLoadingItems] = useState(Object.keys(_itemsCache).length === 0);

    useEffect(() => {
        // Skip fetch if we already have cached items for all active models
        const activeIds = basketModels.filter(m => m.active).map(m => m.id);
        const allCached = activeIds.length > 0 && activeIds.every(id => _itemsCache[id]);
        if (allCached) {
            setAllItems(_itemsCache);
            setLoadingItems(false);
            return;
        }

        const loadAllItems = async () => {
            setLoadingItems(true);
            const result: Record<string, ItemsByCategory> = { ..._itemsCache };
            try {
                await Promise.all(
                    basketModels.filter(m => m.active).map(async (model) => {
                        if (result[model.id]) return; // Already cached
                        try {
                            const items = await fetchBasketModelItems(model.id);
                            const grouped: ItemsByCategory = { alimentos: [], limpeza: [], mistura: [] };
                            items.forEach(i => {
                                const cat = (i.tipo || 'alimentos').toLowerCase() as keyof ItemsByCategory;
                                if (grouped[cat]) {
                                    grouped[cat].push({ name: i.name, qty: i.quantity });
                                } else {
                                    grouped.alimentos.push({ name: i.name, qty: i.quantity });
                                }
                            });
                            result[model.id] = grouped;
                        } catch (e) {
                            console.error('Error loading items for', model.id, e);
                        }
                    })
                );
            } finally {
                _itemsCache = result; // Update module cache
                setAllItems(result);
                setLoadingItems(false);
            }
        };
        if (basketModels.length > 0) loadAllItems();
    }, [basketModels]);

    // Quantity selector for cart
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const getQty = (id: string) => quantities[id] || 1;
    const setQty = (id: string, q: number) => setQuantities(prev => ({ ...prev, [id]: Math.max(1, q) }));

    const handleAddToCart = (modelId: string, available: number) => {
        const qtyToBuy = getQty(modelId);
        const cartQty = getCartQty(modelId);

        if (qtyToBuy + cartQty > available) {
            alert(`Desculpe, temos apenas ${available} unidades desta cesta em estoque.`);
            return;
        }

        onAddToCart(modelId, qtyToBuy);
        setQuantities(prev => ({ ...prev, [modelId]: 1 }));

        // Simple haptic feedback or visual cue could go here
    };

    // Count items in cart for a model
    const getCartQty = (modelId: string) => {
        return cart.filter(c => c.basketModelId === modelId).reduce((sum, c) => sum + c.quantity, 0);
    };

    // Quick View Modal Logic
    const [quickViewModelId, setQuickViewModelId] = useState<string | null>(null);
    const quickViewModel = quickViewModelId ? basketModels.find(m => m.id === quickViewModelId) : null;
    const quickViewItems = quickViewModelId ? allItems[quickViewModelId] : null;

    useEffect(() => {
        if (quickViewModelId) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [quickViewModelId]);

    return (
        <div className="flex flex-col h-full bg-slate-50 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="bg-white pb-4 shadow-sm z-10 sticky top-0">
                {/* Compact Search Bar */}
                <div className="px-5 pt-4 mb-3">
                    <div className="relative group mx-auto w-full">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors text-xl">search</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="O que você procura hoje?"
                            className="w-full h-12 pl-12 pr-4 bg-slate-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Quick Filters */}
                <div className="px-5 flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {[
                        { id: 'todos', label: 'Todos', icon: 'apps' },
                        { id: 'mais-vendidos', label: 'Mais Vendidos', icon: 'trending_up' },
                        { id: 'destaques', label: 'Destaques', icon: 'star' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as any)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${filter === f.id
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <span className={`material-symbols-outlined text-[16px] ${filter === f.id ? 'text-yellow-400' : ''}`}>{f.icon}</span>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-20 no-scrollbar pt-4">
                {/* Hero Banner Carousel */}
                <div className="relative overflow-hidden rounded-[28px] mb-6 h-[200px] shadow-xl shadow-primary/20 bg-slate-900 group">
                    {/* Backgrounds */}
                    {slides.map((model, index) => (
                        <div
                            key={index}
                            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${currentSlide === index ? 'opacity-100' : 'opacity-0'}`}
                        >
                            {index === 0 ? (
                                // Default Banner BG
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-br from-[#0a4da3] via-[#083d7a] to-[#041d3d]" />
                                    <div className="absolute inset-0 bg-black/20 mix-blend-multiply" />
                                </>
                            ) : (
                                // Product Banner BG
                                <>
                                    <img
                                        src={model!.image}
                                        alt={model!.name}
                                        className="w-full h-full object-cover opacity-60"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/60 to-transparent" />
                                </>
                            )}
                        </div>
                    ))}

                    {/* Content */}
                    <div className="relative z-10 h-full p-6 flex flex-col justify-center">
                        {currentSlide === 0 ? (
                            // Default Content
                            <div className="animate-in slide-in-from-left-4 fade-in duration-500">
                                <span className="inline-flex items-center gap-1 bg-yellow-400 text-slate-900 text-[9px] font-black px-3 py-1 rounded-full mb-3 uppercase tracking-widest shadow-lg">
                                    <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                                    OFERTA DO MÊS
                                </span>
                                <h2 className="text-2xl font-black mb-1 text-white tracking-tight drop-shadow-md">{settings?.appName || 'Cestas Básicas'}</h2>
                                <p className="text-white text-[12px] font-bold max-w-[220px] drop-shadow-md leading-relaxed">
                                    Economia real com frete grátis direto na sua casa.
                                </p>
                            </div>
                        ) : (
                            // Product Content
                            <div className="animate-in slide-in-from-right-4 fade-in duration-500">
                                <span className="inline-flex items-center gap-1 bg-primary text-white text-[9px] font-black px-3 py-1 rounded-full mb-2 uppercase tracking-widest shadow-lg">
                                    <span className="material-symbols-outlined text-[12px]">star</span>
                                    DESTAQUE
                                </span>
                                <h2 className="text-3xl font-black text-white mb-1 tracking-tight drop-shadow-md leading-none">
                                    {slides[currentSlide]!.name}
                                </h2>
                                <div className="flex items-baseline gap-1 mb-3">
                                    <span className="text-sm font-bold text-slate-300">R$</span>
                                    <span className="text-2xl font-black text-yellow-400">
                                        {slides[currentSlide]!.price.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                                <button
                                    onClick={() => {
                                        const el = document.getElementById(`basket-${slides[currentSlide]!.id}`);
                                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }}
                                    className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold px-4 py-2 rounded-xl transition-all border border-white/20"
                                >
                                    Ver Detalhes
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Indicators */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-20">
                        {slides.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'bg-white w-6' : 'bg-white/30 w-1.5 hover:bg-white/50'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Cards */}
                <div className="space-y-12 pb-12">
                    {activeModels.map((model, index) => {
                        const stockQty = getStockQuantity(stock, model.id);
                        const isOutOfStock = stockQty <= 0;
                        const isLowStock = stockQty > 0 && stockQty <= 5;
                        const items = allItems[model.id];
                        const totalItems = items
                            ? [...items.alimentos, ...items.limpeza, ...items.mistura].reduce((acc, i) => acc + (parseInt(i.qty) || 0), 0)
                            : 0;
                        const cartQty = getCartQty(model.id);

                        // Mock Data for Social Proof
                        const rating = (4.5 + (index * 0.1) % 0.5).toFixed(1);
                        const salesCount = 120 + (index * 45);

                        return (
                            <div
                                key={model.id}
                                id={`basket-${model.id}`}
                                className={`bg-white rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200/80 border-2 border-slate-100/50 transition-all ${isOutOfStock ? 'opacity-60 grayscale-[0.3]' : 'hover:border-primary/20'}`}
                            >
                                {/* Product Image */}
                                <div className="w-full relative overflow-hidden">
                                    <img
                                        src={model.image}
                                        alt={model.name}
                                        className="w-full h-auto"
                                    />
                                    {isOutOfStock && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <span className="bg-white/95 text-slate-900 text-xs font-black px-5 py-2.5 rounded-full shadow-lg">ESGOTADO</span>
                                        </div>
                                    )}
                                    {/* Badges overlay */}
                                    {/* Badge de Mais Vendida */}
                                    {model.isBestSeller && (
                                        <div className="absolute top-3 left-3 bg-yellow-400 text-slate-900 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shadow-lg z-10 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">emoji_events</span>
                                            Mais Vendida
                                        </div>
                                    )}

                                    {/* Badge de Destaque */}
                                    {model.isFeatured && !model.isBestSeller && (
                                        <div className="absolute top-3 left-3 bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg shadow-lg z-10 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">star</span>
                                            Destaque
                                        </div>
                                    )}

                                    {/* Frete Grátis badge already exists, keeping it */}
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-green-700 text-[10px] font-bold uppercase px-2 py-1 rounded-lg shadow-sm border border-green-100 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[12px]">local_shipping</span>
                                        Frete Grátis
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col relative w-full">
                                    {/* Social Proof Line */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex items-center gap-1 text-amber-400">
                                            <span className="material-symbols-outlined text-sm fill-current">star</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{model.rating?.toFixed(1) || '4.8'}</span>
                                        </div>
                                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                                            {model.isBestSeller ? '+500 vendidos' : '+100 vendidos'}
                                        </span>
                                    </div>

                                    <h3 className="font-black text-xl text-slate-900 leading-tight mb-2 tracking-tight">
                                        {model.name}
                                    </h3>

                                    {/* Compact Items Summary */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                                            <span className="text-lg">🛒</span>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] uppercase font-black text-slate-400 leading-none">Contém</span>
                                                <span className="text-xs font-bold text-slate-700 leading-none">{loadingItems ? '...' : totalItems} Itens</span>
                                            </div>
                                        </div>
                                        {model.weight && (
                                            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                                                <span className="text-lg">⚖️</span>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-black text-slate-400 leading-none">Peso aprox.</span>
                                                    <span className="text-xs font-bold text-slate-700 leading-none">{model.weight}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* View Items Button (NEW) */}
                                    <button
                                        onClick={() => setQuickViewModelId(model.id)}
                                        className="w-full h-9 mb-4 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-indigo-100"
                                    >
                                        <span className="material-symbols-outlined text-sm">visibility</span>
                                        Ver Composição Completa
                                    </button>


                                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                                        <div className="flex flex-col">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Apenas</p>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xs font-bold text-slate-400">R$</span>
                                                <span className="text-2xl font-black text-slate-900 tracking-tight">
                                                    {model.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {cartQty > 0 ? (
                                            <div className="flex items-center gap-3 bg-slate-900 text-white h-12 px-2 rounded-xl shadow-lg shadow-slate-900/20">
                                                <button
                                                    onClick={() => onAddToCart(model.id, -1)}
                                                    className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition-all font-bold"
                                                >
                                                    -
                                                </button>
                                                <span className="text-sm font-bold w-4 text-center">{cartQty}</span>
                                                <button
                                                    onClick={() => {
                                                        const available = stock.find(s => s.basketModelId === model.id)?.quantity || 0;
                                                        if (cartQty >= available) {
                                                            alert('Estoque máximo atingido no carrinho');
                                                            return;
                                                        }
                                                        onAddToCart(model.id, 1);
                                                    }}
                                                    className="size-8 flex items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition-all font-bold"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleAddToCart(model.id, stockQty)}
                                                disabled={isOutOfStock}
                                                className={`h-12 px-6 rounded-xl font-bold text-sm tracking-wide shadow-lg flex items-center gap-2 transition-all ${isOutOfStock
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                                    : 'bg-primary text-white shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98]'
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                                                {isOutOfStock ? 'Esgotado' : 'Comprar'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer safe area */}
                <div className="h-4"></div>
            </div>

            {/* QUICK VIEW MODAL */}
            {quickViewModelId && quickViewModel && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setQuickViewModelId(null)}
                    />
                    <div className="bg-white w-full max-w-sm max-h-[85vh] rounded-[32px] shadow-2xl overflow-hidden relative z-10 flex flex-col animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
                        {/* Header Image */}
                        <div className="relative h-48 shrink-0">
                            <img src={quickViewModel.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <button
                                onClick={() => setQuickViewModelId(null)}
                                className="absolute top-4 right-4 size-8 bg-black/40 text-white rounded-full backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                            <div className="absolute bottom-4 left-6 right-6">
                                <h3 className="text-white text-xl font-black leading-tight drop-shadow-md">{quickViewModel.name}</h3>
                                <p className="text-white/80 text-xs font-bold mt-1">{quickViewModel.description.substring(0, 60)}...</p>
                            </div>
                        </div>

                        {/* Content Scroll */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                            <div className="space-y-6">
                                {(['alimentos', 'limpeza', 'mistura'] as const).map(cat => {
                                    const items = quickViewItems?.[cat] || [];
                                    if (items.length === 0) return null;
                                    const config = CATEGORY_CONFIG[cat];

                                    return (
                                        <div
                                            key={cat}
                                            className="bg-white rounded-2xl shadow-sm border overflow-hidden"
                                            style={{ borderColor: config.borderColor }}
                                        >
                                            {/* Header with solid color background */}
                                            <div
                                                className="flex items-center gap-3 px-4 py-3 border-b"
                                                style={{ backgroundColor: config.lightBg, borderColor: config.borderColor }}
                                            >
                                                <span
                                                    className="size-8 flex items-center justify-center rounded-lg text-lg shadow-sm"
                                                    style={{ backgroundColor: config.iconBg }}
                                                >
                                                    {config.icon}
                                                </span>
                                                <h4
                                                    className="font-black text-sm uppercase tracking-wider"
                                                    style={{ color: config.titleColor }}
                                                >
                                                    {config.label}
                                                </h4>
                                                <span
                                                    className="ml-auto text-[10px] font-black uppercase px-2 py-1 rounded-md bg-white/50 backdrop-blur-sm"
                                                    style={{ color: config.titleColor }}
                                                >
                                                    {items.length} itens
                                                </span>
                                            </div>

                                            {/* List Items */}
                                            <ul className="divide-y divide-slate-50">
                                                {items.map((item, idx) => (
                                                    <li key={idx} className="flex items-center justify-between px-4 py-3 text-xs hover:bg-slate-50 transition-colors">
                                                        <span className="font-bold text-slate-600">{item.name}</span>
                                                        <span className="font-black text-slate-800 bg-slate-100 px-2 py-1 rounded-md min-w-[32px] text-center border border-slate-200">
                                                            {item.qty}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}

                                {(!quickViewItems || (quickViewItems.alimentos.length === 0 && quickViewItems.limpeza.length === 0 && quickViewItems.mistura.length === 0)) && (
                                    <div className="text-center py-10 opacity-50">
                                        <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
                                        <p className="text-sm font-bold">Nenhum item cadastrado nesta cesta.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Action */}
                        <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)] z-20">
                            <div className="flex flex-col flex-1 pl-2 justify-center">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valor Total</span>
                                <span className="text-2xl font-black text-slate-900 tracking-tight">R$ {quickViewModel.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <button
                                onClick={() => {
                                    setQuickViewModelId(null);
                                    if (getStockQuantity(stock, quickViewModel.id) > 0) {
                                        onAddToCart(quickViewModel.id, 1);
                                    }
                                }}
                                disabled={getStockQuantity(stock, quickViewModel.id) <= 0}
                                className="flex-[1.5] h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale hover:shadow-primary/40 hover:-translate-y-0.5"
                            >
                                <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                                {getStockQuantity(stock, quickViewModel.id) <= 0 ? 'Esgotado' : 'Comprar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerStoreView;
