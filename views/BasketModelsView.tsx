import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { ViewState, BasketModel, BasketModelItem } from '../types';
import { BASKET_IMAGES } from '../constants';
import {
    uploadBasketImage,
    fetchBasketModelItems,
    addBasketModelItems,
    deleteBasketModelItem,
    deleteAllBasketModelItems,
} from '../store';

interface BasketModelsViewProps {
    basketModels: BasketModel[];
    onAddModel: (model: Omit<BasketModel, 'id' | 'createdAt'>) => void | Promise<void>;
    onUpdateModel: (id: string, updates: Partial<BasketModel>) => void | Promise<void>;
    onToggleModel: (id: string) => void;
    onDeleteModel: (id: string) => void;
    setView: (v: ViewState) => void;
}

const TIPOS_ITEM = ['Alimentos', 'Limpeza', 'Higiene', 'Mistura', 'Outros'] as const;

const BasketModelsView: React.FC<BasketModelsViewProps> = ({
    basketModels,
    onAddModel,
    onUpdateModel,
    onToggleModel,
    onDeleteModel,
    setView,
}) => {
    // --- Model Modal State ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<BasketModel | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        image: Object.values(BASKET_IMAGES)[0],
        isBestSeller: false,
        isFeatured: false,
        displayOrder: '0',
        rating: '4.8',
    });
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDescExpanded, setIsDescExpanded] = useState(false);
    const [descTab, setDescTab] = useState<'edit' | 'preview'>('edit');

    // --- Items Panel State ---
    const [itemsPanelModelId, setItemsPanelModelId] = useState<string | null>(null);
    const [itemsPanelModelName, setItemsPanelModelName] = useState('');
    const [items, setItems] = useState<BasketModelItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQty, setNewItemQty] = useState('');
    const [newItemTipo, setNewItemTipo] = useState('Alimentos');
    const [isSavingItems, setIsSavingItems] = useState(false);

    // --- Import State ---
    const [importMode, setImportMode] = useState<'none' | 'paste' | 'csv'>('none');
    const [pasteText, setPasteText] = useState('');
    const [importFeedback, setImportFeedback] = useState<any>(null); // Changed to object for type/message
    const [shouldReplaceItems, setShouldReplaceItems] = useState(false); // NEW: Replace option
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Item Counts per Model ---
    const [itemCounts, setItemCounts] = useState<Record<string, number>>({});

    // Load item counts for all models on mount
    useEffect(() => {
        loadAllItemCounts();
    }, [basketModels]);

    const loadAllItemCounts = async () => {
        const counts: Record<string, number> = {};
        await Promise.all(
            basketModels.map(async (model) => {
                try {
                    const items = await fetchBasketModelItems(model.id);
                    counts[model.id] = items.length;
                } catch {
                    counts[model.id] = 0;
                }
            })
        );
        setItemCounts(counts);
    };

    useEffect(() => {
        if (itemsPanelModelId) loadItems(itemsPanelModelId);
    }, [itemsPanelModelId]);

    const loadItems = async (modelId: string) => {
        setIsLoadingItems(true);
        try {
            const fetched = await fetchBasketModelItems(modelId);
            setItems(fetched);
        } catch (e) {
            console.error('Error loading items:', e);
            alert('Erro ao carregar itens.');
        } finally {
            setIsLoadingItems(false);
        }
    };

    // --- Model Handlers ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            setIsUploading(true);
            const publicUrl = await uploadBasketImage(file);
            setFormData(prev => ({ ...prev, image: publicUrl }));
        } catch (error) {
            console.error('Failed to upload image:', error);
            alert('Falha ao carregar imagem.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleOpenCreate = () => {
        setEditingModel(null);
        setIsSaving(false);
        setFormData({
            name: '',
            description: '',
            price: '0',
            image: Object.values(BASKET_IMAGES)[0],
            isBestSeller: false,
            isFeatured: false,
            displayOrder: '0',
            rating: '4.8'
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (model: BasketModel) => {
        setEditingModel(model);
        setIsSaving(false);
        setFormData({
            name: model.name,
            description: model.description,
            price: model.price.toString(),
            image: model.image,
            isBestSeller: model.isBestSeller,
            isFeatured: model.isFeatured,
            displayOrder: model.displayOrder.toString(),
            rating: model.rating.toString()
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        if (!formData.name) { alert('Informe o nome da cesta.'); return; }
        const numericPrice = parseFloat(formData.price.toString().replace(',', '.'));
        const numericOrder = parseInt(formData.displayOrder.toString()) || 0;
        const numericRating = parseFloat(formData.rating.toString().replace(',', '.')) || 4.8;

        if (isNaN(numericPrice)) { alert('Informe um preço válido.'); return; }
        if (isSaving) return;
        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                description: formData.description,
                price: numericPrice,
                image: formData.image,
                isBestSeller: formData.isBestSeller,
                isFeatured: formData.isFeatured,
                displayOrder: numericOrder,
                rating: numericRating
            };

            if (editingModel) {
                await onUpdateModel(editingModel.id, payload);
            } else {
                await onAddModel({ ...payload, active: true, weight: '' });
            }
            setIsModalOpen(false);
        } catch (error: any) {
            alert(`Falha ao salvar.\n${error.message || 'Erro desconhecido'}`);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Items Handlers ---
    const handleCloseItemsPanel = () => {
        // Refresh count for the model we just edited
        if (itemsPanelModelId) {
            setItemCounts(prev => ({ ...prev, [itemsPanelModelId]: items.length }));
        }
        setItemsPanelModelId(null);
    };

    const handleOpenItemsPanel = (model: BasketModel) => {
        setItemsPanelModelId(model.id);
        setItemsPanelModelName(model.name);
        setNewItemName('');
        setNewItemQty('');
        setNewItemTipo('Alimentos');
        setImportMode('none');
        setPasteText('');
        setImportFeedback('');
    };

    const handleAddSingleItem = async () => {
        if (!newItemName.trim() || !newItemQty.trim() || !itemsPanelModelId) return;
        setIsSavingItems(true);
        try {
            await addBasketModelItems(itemsPanelModelId, [{ name: newItemName, quantity: newItemQty, tipo: newItemTipo }]);
            setNewItemName('');
            setNewItemQty('');
            await loadItems(itemsPanelModelId);
        } catch (e: any) {
            alert('Erro ao adicionar item: ' + (e.message || ''));
        } finally {
            setIsSavingItems(false);
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!itemsPanelModelId) return;
        try {
            await deleteBasketModelItem(itemId);
            setItems(prev => prev.filter(i => i.id !== itemId));
        } catch (e: any) {
            alert('Erro ao remover item: ' + (e.message || ''));
        }
    };

    const handleClearAllItems = async () => {
        if (!itemsPanelModelId) return;
        if (!window.confirm('Tem certeza que deseja remover TODOS os itens?')) return;
        try {
            await deleteAllBasketModelItems(itemsPanelModelId);
            setItems([]);
        } catch (e: any) {
            alert('Erro ao limpar itens: ' + (e.message || ''));
        }
    };

    // --- XLSX Template Download ---
    const handleDownloadTemplate = () => {
        const templateData = [
            { nome: 'Arroz', quantidade: '5kg', tipo: 'Alimentos' },
            { nome: 'Feijão', quantidade: '2kg', tipo: 'Alimentos' },
            { nome: 'Óleo de Soja', quantidade: '2 un', tipo: 'Alimentos' },
            { nome: 'Carne Bovina', quantidade: '2kg', tipo: 'Mistura' },
            { nome: 'Sabão em Pó', quantidade: '1 un', tipo: 'Limpeza' },
            { nome: 'Papel Higiênico', quantidade: '4 un', tipo: 'Higiene' },
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        // Set column widths
        ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Itens da Cesta');
        XLSX.writeFile(wb, 'modelo_itens_cesta.xlsx');
    };

    // --- Helper: Normalize Tipo ---
    const normalizeTipo = (rawTipo: string): string => {
        const t = rawTipo.toLowerCase().trim();
        if (t.includes('alimento') || t.includes('comida') || t.includes('food')) return 'Alimentos';
        if (t.includes('limpeza') || t.includes('cleaning')) return 'Limpeza';
        if (t.includes('higiene') || t.includes('hygiene') || t.includes('pessoal')) return 'Higiene';
        if (t.includes('mistura') || t.includes('carne') || t.includes('protein')) return 'Mistura';
        return 'Outros';
    };

    // --- File Import (XLSX or CSV) ---
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !itemsPanelModelId) {
            console.warn('[import] No file or no model id', { file: !!file, modelId: itemsPanelModelId });
            return;
        }

        console.log('[import] File selected:', file.name, file.type, file.size, 'bytes');
        setImportFeedback({ type: 'info', message: `Lendo "${file.name}"...` });
        setIsSavingItems(true);

        try {
            let parsed: { name: string; quantity: string; tipo: string }[] = [];

            const ext = file.name.split('.').pop()?.toLowerCase();

            if (ext === 'xlsx' || ext === 'xls') {
                // Parse Excel
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                console.log('[import] XLSX rows:', rows.length, rows.slice(0, 3));

                for (const row of rows) {
                    // Try various column name patterns
                    const name = String(row['nome'] || row['Nome'] || row['NOME'] || row['nome do produto'] || row['Nome do Produto'] || row['produto'] || row['Produto'] || '').trim();
                    const quantity = String(row['quantidade'] || row['Quantidade'] || row['QUANTIDADE'] || row['qtd'] || row['Qtd'] || row['item'] || row['Item'] || '').trim();
                    const rawTipo = String(row['tipo'] || row['Tipo'] || row['TIPO'] || row['categoria'] || row['Categoria'] || '').trim();

                    const tipo = normalizeTipo(rawTipo || 'Alimentos');

                    if (name && quantity) {
                        parsed.push({ name, quantity, tipo });
                    }
                }
            } else {
                // Parse CSV/TXT
                const text = await file.text();
                console.log('[import] CSV text length:', text.length, 'preview:', text.substring(0, 200));
                parsed = parseCsvOrPaste(text);
            }

            console.log('[import] Parsed items:', parsed.length, parsed.slice(0, 5));

            if (parsed.length === 0) {
                setImportFeedback({ type: 'error', message: '❌ Nenhum item encontrado. Verifique as colunas (nome, quantidade, tipo).' });
                return;
            }

            if (shouldReplaceItems) {
                setImportFeedback({ type: 'info', message: `Substituindo itens por ${parsed.length} novos...` });
                await deleteAllBasketModelItems(itemsPanelModelId);
            } else {
                setImportFeedback({ type: 'info', message: `Adicionando ${parsed.length} novos itens...` });
            }

            await addBasketModelItems(itemsPanelModelId, parsed);
            await loadItems(itemsPanelModelId);
            setImportFeedback({ type: 'success', message: `✅ ${parsed.length} itens importados com sucesso!` });

            // Close panel after success if desired, or just clear feedback
            setTimeout(() => setImportFeedback(null), 4000);

        } catch (err: any) {
            console.error('[import] Error:', err);
            setImportFeedback({ type: 'error', message: `❌ Erro: ${err.message || 'Falha ao importar'}` });
        } finally {
            setIsSavingItems(false);
            // Reset input so same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // --- Paste from Excel ---
    const handleImportPaste = async () => {
        if (!pasteText.trim() || !itemsPanelModelId) return;
        const parsed = parseCsvOrPaste(pasteText);
        if (parsed.length === 0) {
            alert('Nenhum item encontrado. Cole no formato:\nNome [TAB] Quantidade [TAB] Tipo');
            return;
        }
        setIsSavingItems(true);
        try {
            if (shouldReplaceItems) {
                await deleteAllBasketModelItems(itemsPanelModelId);
            }
            await addBasketModelItems(itemsPanelModelId, parsed);
            await loadItems(itemsPanelModelId);
            setPasteText('');
            setImportMode('none');
        } catch (e: any) {
            alert('Erro ao importar: ' + (e.message || ''));
        } finally {
            setIsSavingItems(false);
        }
    };

    /**
     * Parse CSV or tab-separated text.
     * Accepts: nome,quantidade,tipo  OR  nome\tquantidade\ttipo  OR  nome;quantidade;tipo
     * If only 2 columns, tipo defaults to 'Alimentos'.
     */
    const parseCsvOrPaste = (text: string): { name: string; quantity: string; tipo: string }[] => {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        const results: { name: string; quantity: string; tipo: string }[] = [];
        for (const line of lines) {
            let parts: string[];
            if (line.includes('\t')) parts = line.split('\t');
            else if (line.includes(';')) parts = line.split(';');
            else parts = line.split(',');
            parts = parts.map(p => p.trim().replace(/^["']|["']$/g, '')); // strip quotes
            if (parts.length < 2) continue;
            const name = parts[0];
            const quantity = parts[1];
            const rawTipo = parts[2] || '';
            const tipo = normalizeTipo(rawTipo || 'Alimentos');

            // Skip header rows
            const nameLower = name.toLowerCase();
            if (nameLower === 'nome' || nameLower === 'nome do produto' || nameLower === 'produto') continue;
            if (!name || !quantity) continue;
            results.push({ name, quantity, tipo });
        }
        return results;
    };

    // --- Helpers ---
    const CATEGORY_CONFIG: Record<string, any> = {
        'Alimentos': { icon: '🍚', label: 'Alimentos', titleColor: '#166534', lightBg: '#f0fdf4', borderColor: '#bbf7d0', iconBg: '#dcfce7' },
        'Limpeza': { icon: '✨', label: 'Limpeza', titleColor: '#6b21a8', lightBg: '#faf5ff', borderColor: '#e9d5ff', iconBg: '#f3e8ff' },
        'Mistura': { icon: '🥩', label: 'Carnes e Mistura', titleColor: '#9a3412', lightBg: '#fff7ed', borderColor: '#fed7aa', iconBg: '#ffedd5' },
        'Higiene': { icon: '🧴', label: 'Higiene', titleColor: '#4c1d95', lightBg: '#f5f3ff', borderColor: '#ddd6fe', iconBg: '#ede9fe' },
        'Outros': { icon: '📦', label: 'Outros', titleColor: '#475569', lightBg: '#f8fafc', borderColor: '#e2e8f0', iconBg: '#f1f5f9' },
    };

    const groupedItems = () => {
        const groups: Record<string, BasketModelItem[]> = {
            'Alimentos': [],
            'Limpeza': [],
            'Higiene': [],
            'Mistura': [],
            'Outros': []
        };
        for (const item of items) {
            let key = normalizeTipo(item.tipo || 'Outros');
            // If key isn't in our predefined groups, put in Outros
            if (!groups[key]) key = 'Outros';
            groups[key].push(item);
        }
        // Remove empty groups if desired, but keeping them fixed order is nice too.
        // Let's remove empty ones to save space.
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) delete groups[key];
        });
        return groups;
    };

    const tipoColor = (tipo: string) => {
        // Legacy support if used elsewhere, or just keep for simplicity
        switch (tipo.toLowerCase()) {
            case 'alimentos': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
            case 'limpeza': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            case 'higiene': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
            case 'mistura': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
            default: return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
        }
    };

    // ========================================
    // RENDER
    // ========================================
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setView('dashboard')} className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h3 className="text-lg font-bold leading-tight">Modelos de Cesta</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{basketModels.length} modelos</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="px-4 mt-4 grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-2xl font-bold text-success">{basketModels.filter(m => m.active).length}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Ativos</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-2xl font-bold text-slate-400">{basketModels.filter(m => !m.active).length}</p>
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Inativos</p>
                </div>
            </div>

            {/* Models List */}
            <div className="p-4 space-y-3 pb-40 overflow-y-auto">
                {basketModels.map(model => (
                    <div key={model.id} className={`bg-white dark:bg-slate-800 p-4 rounded-xl border transition-all ${model.active ? 'border-slate-100 dark:border-slate-700' : 'border-slate-100 dark:border-slate-700 opacity-60'}`}>
                        <div className="flex items-start gap-4">
                            <img src={model.image} alt={model.name} className="size-20 rounded-xl object-cover" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h4 className="font-bold truncate">{model.name}</h4>
                                        <p className="text-xs text-slate-500 line-clamp-2">{model.description}</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase flex-shrink-0 ${model.active ? 'bg-success/10 text-success' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                        {model.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <p className="text-lg font-black text-primary">R$ {model.price.toFixed(2)}</p>
                                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">
                                        {itemCounts[model.id] !== undefined ? `${itemCounts[model.id]} itens` : '...'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                            <button onClick={() => handleOpenItemsPanel(model)} className="flex-1 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-lg">list_alt</span>
                                Itens
                            </button>
                            <button onClick={() => handleOpenEdit(model)} className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-lg">edit</span>
                                Editar
                            </button>
                            <button onClick={() => onToggleModel(model.id)} className={`py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center ${model.active ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                                <span className="material-symbols-outlined text-lg">{model.active ? 'visibility_off' : 'visibility'}</span>
                            </button>
                            <button onClick={() => { if (window.confirm(`Excluir "${model.name}"?`)) onDeleteModel(model.id); }} className="size-10 rounded-lg bg-danger/10 text-danger flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Button */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
                <button onClick={handleOpenCreate} className="w-full h-14 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95">
                    <span className="material-symbols-outlined">add</span>
                    Novo Modelo
                </button>
            </div>

            {/* ==================== MODEL MODAL ==================== */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="sticky top-0 bg-white dark:bg-slate-800 p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-lg font-bold">{editingModel ? 'Editar Modelo' : 'Novo Modelo'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* Image */}
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2 block flex justify-between items-center">
                                    <span>Imagem</span>
                                    {isUploading && <span className="text-[10px] text-primary animate-pulse font-bold uppercase">Enviando...</span>}
                                </label>
                                <div className="grid grid-cols-4 gap-2 mb-3">
                                    {Object.values(BASKET_IMAGES).map((img, idx) => (
                                        <button key={idx} type="button" onClick={() => setFormData({ ...formData, image: img })} className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${formData.image === img ? 'border-primary' : 'border-transparent'}`}>
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                        </button>
                                    ))}
                                    {!Object.values(BASKET_IMAGES).includes(formData.image) && (
                                        <div className="aspect-square rounded-xl overflow-hidden border-2 border-primary relative">
                                            <img src={formData.image} alt="" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-primary">check_circle</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <input type="file" id="image-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
                                <button type="button" onClick={() => document.getElementById('image-upload')?.click()} disabled={isUploading} className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 text-xs font-bold hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-lg">add_a_photo</span>
                                    {isUploading ? 'Enviando...' : 'Carregar Foto'}
                                </button>
                            </div>
                            {/* Name */}
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Nome</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Ex: Cesta Básica Grande" />
                            </div>
                            {/* Description */}
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block flex items-center justify-between">
                                    <span>Descrição</span>
                                    <button type="button" onClick={() => { setIsDescExpanded(true); setDescTab('edit'); }} className="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
                                        <span className="material-symbols-outlined text-sm">open_in_full</span> Expandir
                                    </button>
                                </label>
                                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full h-20 p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm" placeholder="Descrição do conteúdo da cesta" />
                            </div>
                            {/* Price */}
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">Preço (R$)</label>
                                <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="0.00" step="0.01" />
                            </div>

                            {/* Configurable Attributes */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-100 dark:border-slate-700">
                                <h4 className="col-span-2 text-xs font-black uppercase text-slate-400 mb-1">Configurações de Exibição</h4>

                                {/* Order & Rating */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Ordem</label>
                                    <input
                                        type="number"
                                        value={formData.displayOrder}
                                        onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Avaliação (1-5)</label>
                                    <input
                                        type="number"
                                        value={formData.rating}
                                        onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                                        className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-bold"
                                        placeholder="4.8"
                                        step="0.1"
                                        min="1"
                                        max="5"
                                    />
                                </div>

                                {/* Checkboxes */}
                                <div className="col-span-2 flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-700 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 flex-1 justify-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.isBestSeller}
                                            onChange={(e) => setFormData({ ...formData, isBestSeller: e.target.checked })}
                                            className="size-4 rounded border-slate-300 text-primary focus:ring-offset-0"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Mais Vendida</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-700 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 flex-1 justify-center">
                                        <input
                                            type="checkbox"
                                            checked={formData.isFeatured}
                                            onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                                            className="size-4 rounded border-slate-300 text-primary focus:ring-offset-0"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Destaque</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700">
                            <button onClick={handleSubmit} disabled={isSaving} className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${isSaving ? 'bg-slate-300' : 'bg-success'} text-white shadow-lg active:scale-95`}>
                                {isSaving ? (<><div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando...</>) : (<><span className="material-symbols-outlined">check</span> {editingModel ? 'Salvar Alterações' : 'Criar Modelo'}</>)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================== ITEMS PANEL ==================== */}
            {itemsPanelModelId && (
                <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[100] flex flex-col animate-in slide-in-from-right duration-300">
                    {/* Items Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={handleCloseItemsPanel} className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <div>
                                <h3 className="font-bold text-lg">Itens da Cesta</h3>
                                <p className="text-xs text-slate-500">{itemsPanelModelName}</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">{items.reduce((acc, item) => acc + (parseInt(item.quantity) || 0), 0)} itens</span>
                    </div>

                    {/* Add Item Form */}
                    <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1 space-y-2">
                                <div className="flex gap-2">
                                    <div className="relative w-32">
                                        <select
                                            value={newItemTipo}
                                            onChange={(e) => setNewItemTipo(e.target.value as any)}
                                            className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold appearance-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        >
                                            <option value="alimento">Alimento</option>
                                            <option value="higiene">Higiene</option>
                                            <option value="limpeza">Limpeza</option>
                                        </select>
                                        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">expand_more</span>
                                    </div>
                                    <input
                                        type="text"
                                        value={newItemQty}
                                        onChange={(e) => setNewItemQty(e.target.value)}
                                        placeholder="Qtd (ex: 2kg, 1un)"
                                        className="w-24 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    <input
                                        type="text"
                                        value={newItemName}
                                        onChange={(e) => setNewItemName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddSingleItem()}
                                        placeholder="Nome do produto"
                                        className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-primary focus:border-transparent"
                                    />
                                    <button
                                        onClick={handleAddSingleItem}
                                        disabled={isSavingItems}
                                        className="h-10 px-4 bg-primary text-white rounded-lg font-bold text-xs shadow-sm hover:bg-primary-dark transition-colors flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                    >
                                        {isSavingItems ? <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-lg">add</span>}
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Bulk Import */}
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setImportMode(importMode === 'csv' ? null : 'csv')}
                                className="text-xs font-bold text-primary flex items-center gap-1 hover:underline mb-2"
                            >
                                <span className="material-symbols-outlined text-sm">{importMode ? 'close' : 'upload_file'}</span>
                                {importMode ? 'Cancelar Importação' : 'Importar Lista em Massa (Excel/CSV)'}
                            </button>

                            {importMode === 'csv' && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex gap-3 mb-3">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept=".csv,.xlsx,.xls"
                                            className="hidden"
                                            onChange={handleFileImport}
                                        />
                                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 h-9 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined text-sm">folder_open</span> Escolher Arquivo
                                        </button>
                                        <button onClick={handleDownloadTemplate} className="px-3 h-9 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-500 hover:text-primary transition-all flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm">download</span> Modelo
                                        </button>
                                        {items.length > 0 && (
                                            <button onClick={handleClearAllItems} className="px-3 h-9 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 transition-all flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">delete_sweep</span> Limpar Tudo
                                            </button>
                                        )}
                                    </div>

                                    {/* Import Options */}
                                    <div className="mb-3 px-1">
                                        <label className="flex items-center gap-2 cursor-pointer select-none group">
                                            <div className={`size-4 rounded border flex items-center justify-center transition-colors ${shouldReplaceItems ? 'bg-primary border-primary' : 'bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-500'}`}>
                                                {shouldReplaceItems && <span className="material-symbols-outlined text-white text-[10px] font-bold">check</span>}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={shouldReplaceItems}
                                                onChange={(e) => setShouldReplaceItems(e.target.checked)}
                                            />
                                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-primary transition-colors">
                                                Substituir lista atual (apagar itens existentes)
                                            </span>
                                        </label>
                                    </div>

                                    {importFeedback && (
                                        <div className={`p-2 rounded mb-3 text-[10px] font-bold flex items-center gap-2 ${importFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                                            <span className="material-symbols-outlined text-sm">{importFeedback.type === 'success' ? 'check_circle' : 'error'}</span>
                                            {importFeedback.message}
                                        </div>
                                    )}

                                    <div className="relative">
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            <button onClick={() => setImportMode('paste')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${importMode === 'paste' ? 'bg-primary text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>Colar Texto</button>
                                        </div>
                                    </div>

                                    {/* Paste Area (Simplified for now - kept file upload focus) */}
                                    <div className="mt-2">
                                        <textarea
                                            value={pasteText}
                                            onChange={(e) => setPasteText(e.target.value)}
                                            placeholder={`Cole sua lista aqui...\nExemplo:\n2kg Arroz Tipo 1\n1un Oleo de Soja`}
                                            className="w-full h-24 p-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs focus:ring-1 focus:ring-primary resize-none"
                                        />
                                        <button
                                            onClick={handleImportPaste}
                                            disabled={isSavingItems || !pasteText.trim()}
                                            className="mt-2 w-full h-8 bg-primary text-white rounded-lg text-xs font-bold"
                                        >
                                            {isSavingItems ? 'Processando...' : 'Processar Texto Colado'}
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-[10px] text-slate-400">
                                            Ou cole diretamente: <button onClick={() => { parseCsvOrPaste(pasteText); setPasteText(''); setImportMode(null); }} className="underline hover:text-primary">Processar</button>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="flex-1 overflow-y-auto p-4 content-start">
                        {isLoadingItems ? (
                            <div className="flex items-center justify-center h-40">
                                <div className="size-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-50">
                                <span className="material-symbols-outlined text-6xl mb-2">shopping_basket</span>
                                <p className="text-sm font-bold">Nenhum item na cesta</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(groupedItems()).map(([tipo, groupItems]) => {
                                    const config = CATEGORY_CONFIG[tipo] || CATEGORY_CONFIG['Outros'];

                                    return (
                                        <div
                                            key={tipo}
                                            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500"
                                            style={{ borderColor: config.borderColor }}
                                        >
                                            {/* Header */}
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
                                                    {groupItems.reduce((acc, item) => acc + (parseInt(item.quantity) || 0), 0)} itens
                                                </span>
                                            </div>

                                            {/* List Items */}
                                            <ul className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                                {groupItems.map((item) => (
                                                    <li key={item.id} className="group flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{item.name}</span>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md min-w-[32px] text-center text-xs border border-slate-200 dark:border-slate-600">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="size-8 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                                title="Remover item"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {/* Footer Actions if needed */}
                </div>
            )}

            {/* ==================== EXPANDED DESCRIPTION ==================== */}
            {isDescExpanded && (
                <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-[200] flex flex-col animate-in slide-in-from-bottom duration-300">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setIsDescExpanded(false)} className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="material-symbols-outlined">arrow_back</span>
                            </button>
                            <h3 className="font-bold">Editor de Descrição</h3>
                        </div>
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button onClick={() => setDescTab('edit')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${descTab === 'edit' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'}`}>Editar</button>
                            <button onClick={() => setDescTab('preview')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${descTab === 'preview' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500'}`}>Visualizar</button>
                        </div>
                    </div>
                    {descTab === 'edit' && (
                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
                            <button onClick={() => setFormData(prev => ({ ...prev, description: prev.description + '\n- ' }))} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-50">
                                <span className="material-symbols-outlined text-sm">format_list_bulleted</span> Lista
                            </button>
                            <button onClick={() => setFormData(prev => ({ ...prev, description: prev.description + '\n\n' }))} className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-50">
                                <span className="material-symbols-outlined text-sm">keyboard_return</span> Pular Linha
                            </button>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto p-4">
                        {descTab === 'edit' ? (
                            <textarea autoFocus value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full h-full min-h-[50vh] bg-transparent border-none focus:ring-0 p-0 text-slate-700 dark:text-slate-200 text-base leading-relaxed resize-none" placeholder="Descreva aqui os detalhes da cesta..." />
                        ) : (
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 min-h-[50vh]">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Pré-visualização</h4>
                                <div className="text-slate-700 dark:text-slate-200 text-base leading-relaxed whitespace-pre-wrap">
                                    {formData.description || <span className="italic text-slate-400">Nenhuma descrição informada.</span>}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3">
                        <button onClick={() => setIsDescExpanded(false)} className="flex-1 h-14 bg-primary text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined font-bold">check</span> Concluir Edição
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BasketModelsView;
