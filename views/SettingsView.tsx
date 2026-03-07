import React, { useState, useMemo } from 'react';
import { ViewState, TeamMember, SaleGoal, GoalPeriod, AppSettings } from '../types';

interface SettingsViewProps {
    team: TeamMember[];
    goals: SaleGoal[];
    settings: AppSettings;
    onUpdateGoals: (goals: (Omit<SaleGoal, 'id' | 'updatedAt'> & { id?: string })[]) => Promise<void>;
    onClearGoals: () => Promise<void>;
    setView: (v: ViewState) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    team,
    goals,
    settings,
    onUpdateGoals,
    onClearGoals,
    setView,
}) => {
    const sellers = useMemo(() => team.filter(t => t.role === 'vendedor' && t.status === 'ativo'), [team]);

    // UI State
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

    // Form State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [generalAmount, setGeneralAmount] = useState('0');
    const [distributionType, setDistributionType] = useState<'equal' | 'custom'>('equal');
    const [sellerGoalsMap, setSellerGoalsMap] = useState<Record<string, string>>({});
    const [onlineAmount, setOnlineAmount] = useState('0');
    const [goalName, setGoalName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Grouping logic
    const goalGroups = useMemo(() => {
        const groups: Record<string, {
            id: string;
            name: string;
            startDate: number;
            endDate: number;
            amount: number;
            isCancelled: boolean;
            subGoals: SaleGoal[];
        }> = {};

        goals.forEach(g => {
            if (g.type === 'geral' && g.groupId) {
                groups[g.groupId] = {
                    id: g.groupId,
                    name: g.name || '',
                    startDate: g.startDate,
                    endDate: g.endDate,
                    amount: g.amount,
                    isCancelled: !!g.isCancelled,
                    subGoals: []
                };
            }
        });

        goals.forEach(g => {
            if (g.type !== 'geral' && g.groupId && groups[g.groupId]) {
                groups[g.groupId].subGoals.push(g);
            }
        });

        return Object.values(groups).sort((a, b) => b.startDate - a.startDate);
    }, [goals]);

    // Derived State
    useMemo(() => {
        if (distributionType === 'equal' && parseFloat(generalAmount) > 0) {
            const count = sellers.length + 1; // +1 for online
            const perEntity = (parseFloat(generalAmount) / count).toFixed(2);
            const newMap: Record<string, string> = {};
            sellers.forEach(s => {
                newMap[s.id] = perEntity;
            });
            setSellerGoalsMap(newMap);
            setOnlineAmount(perEntity);
        }
    }, [generalAmount, distributionType, sellers.length]);

    const totalBreakdownAmount = (Object.values(sellerGoalsMap) as string[]).reduce((acc: number, val: string) => acc + (parseFloat(val) || 0), 0) + (parseFloat(onlineAmount) || 0);

    const checkOverlap = (start: string, end: string, excludeGroupId?: string) => {
        const startTs = new Date(start + 'T00:00:00').getTime();
        const endTs = new Date(end + 'T23:59:59').getTime();

        return goalGroups.some(g => {
            if (g.id === excludeGroupId || g.isCancelled) return false;
            return (startTs <= g.endDate && endTs >= g.startDate);
        });
    };

    const isFormValid = useMemo(() => {
        if (!startDate || !endDate || parseFloat(generalAmount) <= 0) return false;
        if (Math.abs(totalBreakdownAmount - parseFloat(generalAmount)) > 0.01) return false;
        if (checkOverlap(startDate, endDate, editingGroupId || undefined)) return false;
        return true;
    }, [startDate, endDate, generalAmount, totalBreakdownAmount, editingGroupId, goalGroups]);

    // Handlers
    const handleAddNew = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        setStartDate(start);
        setEndDate(end);
        setGeneralAmount('0');
        setGoalName('');
        setDistributionType('equal');
        setEditingGroupId(null);
        setIsAddingNew(true);
    };

    const handleEditGroup = (group: any) => {
        const now = Date.now();
        if (group.endDate < now) {
            alert('Não é possível editar metas de períodos já encerrados.');
            return;
        }

        setStartDate(new Date(group.startDate).toISOString().split('T')[0]);
        setEndDate(new Date(group.endDate).toISOString().split('T')[0]);
        setGeneralAmount(group.amount.toString());
        setGoalName(group.name);
        setEditingGroupId(group.id);

        const newMap: Record<string, string> = {};
        group.subGoals.forEach((sg: SaleGoal) => {
            if (sg.type === 'vendedor' && sg.sellerId) {
                newMap[sg.sellerId] = sg.amount.toString();
            } else if (sg.type === 'canal' && sg.channel === 'online') {
                setOnlineAmount(sg.amount.toString());
            }
        });
        setSellerGoalsMap(newMap);
        setDistributionType('custom');
        setIsAddingNew(true);
    };

    const handleCancelGroup = async (groupId: string) => {
        if (!window.confirm('Tem certeza que deseja cancelar este planejamento de metas?')) return;
        try {
            const goalsToUpdate = goals.map(g => g.groupId === groupId ? { ...g, isCancelled: true } : g);
            await onUpdateGoals(goalsToUpdate);
        } catch (error) {
            console.error(error);
            alert('Erro ao cancelar meta.');
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const groupId = editingGroupId || `group_${Date.now()}`;
            const startTimestamp = new Date(startDate + 'T00:00:00').getTime();
            const endTimestamp = new Date(endDate + 'T23:59:59').getTime();

            const goalsToUpsert: any[] = [];

            // Add General Goal
            goalsToUpsert.push({
                groupId,
                name: goalName,
                type: 'geral',
                period: 'mensal', // Simplified as per current model
                startDate: startTimestamp,
                endDate: endTimestamp,
                amount: parseFloat(generalAmount),
            });

            // Add Seller Goals
            sellers.forEach(s => {
                goalsToUpsert.push({
                    groupId,
                    name: goalName,
                    type: 'vendedor',
                    period: 'mensal',
                    startDate: startTimestamp,
                    endDate: endTimestamp,
                    amount: parseFloat(sellerGoalsMap[s.id]) || 0,
                    sellerId: s.id,
                });
            });

            // Add Online Goal
            goalsToUpsert.push({
                groupId,
                name: goalName,
                type: 'canal',
                channel: 'online',
                period: 'mensal',
                startDate: startTimestamp,
                endDate: endTimestamp,
                amount: parseFloat(onlineAmount) || 0,
            });

            await onUpdateGoals(goalsToUpsert);
            setIsAddingNew(false);
            setEditingGroupId(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar planejamento.');
        } finally {
            setIsSaving(false);
        }
    };

    const getStatusInfo = (group: any) => {
        const now = Date.now();
        if (group.isCancelled) return { label: 'Cancelada', color: 'bg-slate-500', icon: 'cancel' };
        if (group.endDate < now) return { label: 'Encerrada', color: 'bg-slate-400', icon: 'task_alt' };
        if (group.startDate <= now && group.endDate >= now) return { label: 'Ativa', color: 'bg-green-500', icon: 'online_prediction' };
        return { label: 'Agendada', color: 'bg-primary', icon: 'schedule' };
    };

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white px-6 py-4 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => isAddingNew ? setIsAddingNew(false) : setView('dashboard')}
                            className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            <span className="material-symbols-outlined text-slate-600">arrow_back</span>
                        </button>
                        <h2 className="text-xl font-black text-slate-900">
                            {isAddingNew ? 'Incluir Meta' : 'Metas de Vendas'}
                        </h2>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-32">
                <div className="space-y-6">
                    <div className="flex-1 p-4 overflow-y-auto">
                        {!isAddingNew ? (
                            <div className="space-y-6">
                                {/* List View */}
                                <div className="flex justify-between items-center px-2">
                                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Meus Planejamentos</h4>
                                    <div className="flex gap-2">
                                        {goals.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Tem certeza que deseja apagar TODO o histórico de metas? Esta ação não pode ser desfeita.')) {
                                                        onClearGoals();
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-red-500 border border-red-100 dark:border-red-900/30 rounded-xl font-bold text-xs shadow-sm hover:scale-105 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                                                Limpar
                                            </button>
                                        )}
                                        <button
                                            onClick={handleAddNew}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs shadow-sm hover:scale-105 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">add</span>
                                            Incluir Meta
                                        </button>
                                    </div>
                                </div>

                                {goalGroups.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center">
                                        <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                            <span className="material-symbols-outlined text-4xl text-slate-300">query_stats</span>
                                        </div>
                                        <h5 className="font-bold text-slate-500">Nenhuma meta cadastrada</h5>
                                        <p className="text-sm text-slate-400 mt-1 max-w-[200px]">Comece criando seu primeiro planejamento de vendas.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {goalGroups.map(group => {
                                            const status = getStatusInfo(group);
                                            const isPast = group.endDate < Date.now();
                                            const canAction = !group.isCancelled && !isPast;

                                            return (
                                                <div key={group.id} className={`bg-white dark:bg-slate-800 rounded-3xl border ${group.isCancelled ? 'opacity-60 grayscale' : 'border-slate-100 dark:border-slate-700 shadow-sm'}`}>
                                                    <div className="p-5">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h5 className="font-black text-lg">{group.name || `Meta ${new Date(group.startDate).toLocaleDateString('pt-BR', { month: 'short' })}`}</h5>
                                                                    <span className={`${status.color} text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1`}>
                                                                        <span className="material-symbols-outlined text-[10px]">{status.icon}</span>
                                                                        {status.label}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                                                                    <span className="material-symbols-outlined text-xs">calendar_today</span>
                                                                    {new Date(group.startDate).toLocaleDateString('pt-BR')} até {new Date(group.endDate).toLocaleDateString('pt-BR')}
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase">Valor Total</p>
                                                                <p className="font-black text-primary text-xl">R$ {group.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                            </div>
                                                        </div>

                                                        <div className="h-px bg-slate-50 dark:bg-slate-700/50 mb-4" />

                                                        <div className="flex items-center justify-between">
                                                            <div className="flex -space-x-2">
                                                                {sellers.slice(0, 3).map(s => (
                                                                    <div key={s.id} className="size-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                                                        {s.avatar ? <img src={s.avatar} alt="" className="size-full object-cover" /> : <span className="material-symbols-outlined text-sm text-slate-400">person</span>}
                                                                    </div>
                                                                ))}
                                                                {sellers.length > 3 && (
                                                                    <div className="size-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                                        <span className="text-[10px] font-bold">+{sellers.length - 3}</span>
                                                                    </div>
                                                                )}
                                                                <div className="size-8 rounded-full border-2 border-white dark:border-slate-800 bg-primary/10 flex items-center justify-center ml-2">
                                                                    <span className="material-symbols-outlined text-sm text-primary">language</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {canAction && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => handleCancelGroup(group.id)}
                                                                            className="size-10 flex items-center justify-center rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition-all"
                                                                            title="Cancelar"
                                                                        >
                                                                            <span className="material-symbols-outlined text-xl">block</span>
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleEditGroup(group)}
                                                                            className="flex items-center gap-2 px-4 h-10 bg-primary text-white rounded-xl font-bold text-xs shadow-md active:scale-95 transition-all"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">edit</span>
                                                                            Editar
                                                                        </button>
                                                                    </>
                                                                )}
                                                                {!canAction && !group.isCancelled && (
                                                                    <p className="text-[10px] font-black text-slate-400 italic">Período Encerrado</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                                {/* Form View */}
                                <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <h4 className="font-extrabold text-lg mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">label</span>
                                        Identificação da Meta
                                    </h4>
                                    <input
                                        type="text"
                                        value={goalName}
                                        onChange={(e) => setGoalName(e.target.value)}
                                        placeholder="Ex: Meta de Abril, Campanha Inverno..."
                                        className="w-full px-4 h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </section>

                                <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <h4 className="font-extrabold text-lg mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">calendar_month</span>
                                        Período da Meta
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] uppercase font-black text-slate-400 mb-1 block px-1">Início</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full px-4 h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] uppercase font-black text-slate-400 mb-1 block px-1">Fim</label>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                className="w-full px-4 h-12 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <h4 className="font-extrabold text-lg mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">analytics</span>
                                        Meta Geral do Bloco
                                    </h4>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                        <input
                                            type="number"
                                            value={generalAmount}
                                            onChange={(e) => setGeneralAmount(e.target.value)}
                                            className="w-full pl-12 pr-4 h-14 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl font-black text-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                            placeholder="0,00"
                                        />
                                    </div>
                                </section>

                                <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm pb-8">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="font-extrabold text-lg">Distribuição</h4>
                                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                                            <button
                                                onClick={() => setDistributionType('equal')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${distributionType === 'equal' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-500'}`}
                                            >
                                                Igual
                                            </button>
                                            <button
                                                onClick={() => setDistributionType('custom')}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${distributionType === 'custom' ? 'bg-white dark:bg-slate-800 shadow-sm text-primary' : 'text-slate-500'}`}
                                            >
                                                Manual
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4 p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 dark:border-primary/20">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-primary">language</span>
                                                </div>
                                                <p className="text-sm font-bold leading-tight">Vendas Online</p>
                                            </div>
                                            <input
                                                type="number"
                                                value={onlineAmount}
                                                disabled={distributionType === 'equal'}
                                                onChange={(e) => setOnlineAmount(e.target.value)}
                                                className="w-28 h-10 bg-white dark:bg-slate-800 border border-primary/20 rounded-xl font-bold text-sm text-right px-3"
                                            />
                                        </div>

                                        {sellers.map(s => (
                                            <div key={s.id} className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                        {s.avatar ? <img src={s.avatar} alt="" className="size-full object-cover" /> : <span className="material-symbols-outlined text-slate-400">person</span>}
                                                    </div>
                                                    <p className="text-sm font-bold">{s.name}</p>
                                                </div>
                                                <input
                                                    type="number"
                                                    value={sellerGoalsMap[s.id] || '0'}
                                                    disabled={distributionType === 'equal'}
                                                    onChange={(e) => setSellerGoalsMap(prev => ({ ...prev, [s.id]: e.target.value }))}
                                                    className="w-28 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm text-right px-3"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <button
                                    onClick={handleSave}
                                    disabled={!isFormValid || isSaving}
                                    className={`w-full h-14 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all ${isFormValid && !isSaving ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                                >
                                    {isSaving ? <div className="size-6 border-2 border-white border-t-transparent animate-spin rounded-full" /> : 'Salvar Planejamento'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
