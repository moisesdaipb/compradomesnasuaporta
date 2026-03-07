import React, { useState, useMemo } from 'react';
import { TeamMember, ViewState } from '../types';
import { formatPhone } from '../utils';

interface TeamViewProps {
    team: TeamMember[];
    onAddMember: (member: Omit<TeamMember, 'id' | 'salesCount' | 'deliveriesCount'>) => void;
    onUpdateMember: (id: string, updates: Partial<TeamMember>) => void;
    onToggleStatus: (id: string) => void;
    onDeleteMember: (id: string) => void;
    setView: (v: ViewState) => void;
}

const TeamView: React.FC<TeamViewProps> = ({ team, onAddMember, onUpdateMember, onToggleStatus, onDeleteMember, setView }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'todos' | 'vendedor' | 'entregador'>('todos');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [conflictError, setConflictError] = useState<string | null>(null);

    const [newMember, setNewMember] = useState({
        name: '',
        role: 'vendedor' as 'vendedor' | 'entregador',
        phone: '',
        cpf: '',
        email: ''
    });

    const closeModal = () => {
        setIsModalOpen(false);
        setIsEditing(false);
        setNewMember({
            name: '', role: 'vendedor', phone: '', cpf: '', email: ''
        });
        setConflictError(null);
    };

    const filteredTeam = useMemo(() => {
        return team.filter(m => {
            const matchesFilter = filter === 'todos' || m.role === filter;
            const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.cpf.includes(searchTerm) ||
                m.phone.includes(searchTerm);
            return matchesFilter && matchesSearch;
        });
    }, [team, filter, searchTerm]);

    const stats = useMemo(() => ({
        vendedores: team.filter(m => m.role === 'vendedor').length,
        entregadores: team.filter(m => m.role === 'entregador').length,
        pendentes: team.filter(m => m.status === 'pendente').length
    }), [team]);

    const handleSubmit = async () => {
        if (!newMember.name || !newMember.phone || !newMember.cpf || !newMember.email) return;

        setIsSubmitting(true);
        setConflictError(null);
        try {
            if (isEditing && selectedMember) {
                await onUpdateMember(selectedMember.id, {
                    name: newMember.name,
                    role: newMember.role,
                    phone: newMember.phone,
                    cpf: newMember.cpf,
                    email: newMember.email,
                });
            } else {
                await onAddMember({
                    name: newMember.name,
                    role: newMember.role,
                    phone: newMember.phone,
                    cpf: newMember.cpf,
                    email: newMember.email,
                    status: 'pendente',
                    startDate: Date.now()
                });
            }

            closeModal();
            setSelectedMember(null);
        } catch (error: any) {
            console.error('Error in handleSubmit:', error);
            let message = error.message || 'Erro ao salvar. Verifique se os dados já estão em uso.';

            // Map technical field names to labels
            if (message.includes('Este email')) message = message.replace('email', 'E-mail');
            if (message.includes('Este cpf')) message = message.replace('cpf', 'CPF');
            if (message.includes('Este phone')) message = message.replace('phone', 'WhatsApp');

            if (message.includes('atrelado')) {
                setConflictError(message);
            } else {
                setConflictError(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusConfig = (status: TeamMember['status']) => {
        switch (status) {
            case 'ativo': return { label: 'Ativo', color: 'bg-success/10 text-success border-success/20', dot: 'bg-success' };
            case 'inativo': return { label: 'Inativo', color: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' };
            case 'pendente': return { label: 'Pendente', color: 'bg-orange-100 text-orange-600 border-orange-200', dot: 'bg-orange-500' };
        }
    };

    const handleShareInvite = (member: TeamMember) => {
        const text = `Olá ${member.name}! Você foi convidado para a equipe do Cesta Básica na sua Casa como ${member.role === 'vendedor' ? 'Vendedor(a)' : 'Entregador(a)'}. 

Para concluir seu cadastro, acesse o link abaixo e informe seu CPF (${member.cpf}):
https://cesta-basica-app.vercel.app/register?cpf=${member.cpf.replace(/\D/g, '')}`;

        const url = `https://wa.me/${member.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
        setSelectedMember(null);
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950">
            {/* Compact Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-lg">
                            <span className="material-symbols-outlined text-xl">group</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Equipe</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">Colaboradores</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="h-10 px-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95 group"
                    >
                        <span className="material-symbols-outlined text-lg group-hover:rotate-90 transition-transform">add_circle</span>
                        Novo
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-slate-50 dark:bg-slate-800/50 py-2.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center">
                        <p className="text-lg font-black text-primary leading-none">{stats.vendedores}</p>
                        <p className="text-[8px] uppercase text-slate-400 font-bold tracking-tight mt-1">Vendedores</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 py-2.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center">
                        <p className="text-lg font-black text-secondary leading-none">{stats.entregadores}</p>
                        <p className="text-[8px] uppercase text-slate-400 font-bold tracking-tight mt-1">Entregas</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 py-2.5 px-3 rounded-xl border border-slate-100 dark:border-slate-700/50 flex flex-col items-center">
                        <p className="text-lg font-black text-orange-500 leading-none">{stats.pendentes}</p>
                        <p className="text-[8px] uppercase text-slate-400 font-bold tracking-tight mt-1">Convites</p>
                    </div>
                </div>
            </div>

            {/* Search and Filters - Slightly More Compact */}
            <div className="p-4 py-3 space-y-3">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome ou CPF..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-11 pl-11 pr-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-sm text-sm"
                    />
                </div>

                <div className="flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {(['todos', 'vendedor', 'entregador'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 h-8 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${filter === f ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}
                        >
                            {f === 'todos' ? 'Todos' : f === 'vendedor' ? 'Vendedores' : 'Entregas'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Team List - Maximized Area */}
            <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-3 no-scrollbar">
                {filteredTeam.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-10 text-center animate-in fade-in zoom-in duration-500">
                        <div className="size-16 rounded-[24px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4">
                            <span className="material-symbols-outlined text-4xl">person_search</span>
                        </div>
                        <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">Nada encontrado</h4>
                        <p className="text-xs text-slate-400 font-bold">
                            Tente buscar com outros termos.
                        </p>
                    </div>
                ) : (
                    filteredTeam.map(member => {
                        const status = getStatusConfig(member.status);
                        return (
                            <div
                                key={member.id}
                                onClick={() => setSelectedMember(member)}
                                className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className={`size-12 rounded-xl flex items-center justify-center text-white shadow-md ${member.role === 'vendedor' ? 'bg-gradient-to-tr from-primary to-blue-400' : 'bg-gradient-to-tr from-secondary to-amber-400'}`}>
                                            <span className="material-symbols-outlined text-2xl">{member.role === 'vendedor' ? 'storefront' : 'local_shipping'}</span>
                                        </div>
                                        <div className={`absolute -bottom-0.5 -right-0.5 size-3.5 border-2 border-white dark:border-slate-900 rounded-full ${status?.dot || ''}`}></div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-black text-sm text-slate-900 dark:text-white truncate leading-tight">{member.name}</h4>
                                            <span className={`px-2 py-0.5 rounded-md text-[7px] font-black uppercase tracking-widest border shrink-0 ${status?.color || ''}`}>
                                                {status?.label || ''}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4 mt-1">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                                <span className="material-symbols-outlined text-xs opacity-50">phone_iphone</span>
                                                {member.phone}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                                                <span className="material-symbols-outlined text-xs opacity-50">badge</span>
                                                {member.cpf.slice(0, 7)}***
                                            </div>
                                        </div>
                                    </div>

                                    <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Member Action Menu (Bottom Sheet Style) */}
            {selectedMember && (
                <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4 sm:p-0 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)} />

                    <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col p-5 pb-6 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-500">
                        {/* Drawer Handle */}
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />

                        <div className="flex items-center gap-4 mt-6 mb-6">
                            <div className={`size-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${selectedMember.role === 'vendedor' ? 'bg-gradient-to-tr from-primary to-blue-400' : 'bg-gradient-to-tr from-secondary to-amber-400'}`}>
                                <span className="material-symbols-outlined text-3xl">{selectedMember.role === 'vendedor' ? 'storefront' : 'local_shipping'}</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{selectedMember.name}</h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                    {selectedMember.role === 'vendedor' ? 'Vendedor(a)' : 'Entregador(a)'} • {selectedMember.cpf}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            {selectedMember.status === 'pendente' && (
                                <button
                                    onClick={() => handleShareInvite(selectedMember)}
                                    className="w-full h-12 bg-success text-white rounded-xl flex items-center gap-3 px-5 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-success/20 transition-all active:scale-95 hover:brightness-110"
                                >
                                    <span className="material-symbols-outlined text-xl">share</span>
                                    Reenviar Convite WhatsApp
                                </button>
                            )}

                            <button
                                onClick={() => {
                                    setNewMember({
                                        name: selectedMember.name,
                                        role: selectedMember.role,
                                        phone: selectedMember.phone,
                                        cpf: selectedMember.cpf,
                                        email: selectedMember.email || ''
                                    });
                                    setIsEditing(true);
                                    setIsModalOpen(true);
                                }}
                                className="w-full h-12 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl flex items-center gap-3 px-5 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                <span className="material-symbols-outlined text-primary text-xl">edit</span>
                                Editar Cadastro
                            </button>

                            <button
                                onClick={() => {
                                    onToggleStatus(selectedMember.id);
                                    setSelectedMember(null);
                                }}
                                className={`w-full h-12 rounded-xl flex items-center gap-3 px-5 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 hover:brightness-95 ${selectedMember.status === 'ativo' ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20' : 'bg-primary/10 text-primary dark:bg-primary/20'}`}
                            >
                                <span className="material-symbols-outlined text-xl">{selectedMember.status === 'ativo' ? 'block' : 'check_circle'}</span>
                                {selectedMember.status === 'ativo' ? 'Desativar Colaborador' : 'Ativar Colaborador'}
                            </button>

                            <button
                                onClick={() => {
                                    onDeleteMember(selectedMember.id);
                                    setSelectedMember(null);
                                }}
                                className="w-full h-12 bg-red-50 text-red-600 dark:bg-red-900/20 rounded-xl flex items-center gap-3 px-5 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 hover:bg-red-100 dark:hover:bg-red-900/30"
                            >
                                <span className="material-symbols-outlined text-xl">delete</span>
                                Excluir Permanentemente
                            </button>

                            <button
                                onClick={() => setSelectedMember(null)}
                                className="w-full h-10 mt-1 text-slate-400 font-bold uppercase tracking-widest text-[10px] hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Registration Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeModal} />

                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom-10 duration-500">
                        <div className="p-8 pb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">{isEditing ? 'Editar Membro' : 'Novo Membro'}</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">{isEditing ? 'Atualizar Dados' : 'Cadastro de Equipe'}</p>
                            </div>
                            <button onClick={closeModal} className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 pt-2 space-y-6 no-scrollbar">
                            {conflictError && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 p-4 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                                    <span className="material-symbols-outlined text-red-500 mt-0.5">warning</span>
                                    <div>
                                        <p className="text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-tight">Dados em Uso</p>
                                        <p className="text-red-500 dark:text-red-400 text-[11px] font-bold mt-1 leading-relaxed">
                                            {conflictError}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex p-1 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                                <button
                                    onClick={() => setNewMember({ ...newMember, role: 'vendedor' })}
                                    className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${newMember.role === 'vendedor' ? 'bg-primary text-white shadow-lg' : 'text-slate-400'}`}
                                >
                                    Vendedor
                                </button>
                                <button
                                    onClick={() => setNewMember({ ...newMember, role: 'entregador' })}
                                    className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${newMember.role === 'entregador' ? 'bg-secondary text-slate-900 shadow-lg' : 'text-slate-400'}`}
                                >
                                    Entregador
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={newMember.name}
                                        onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                                        className="w-full h-14 px-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-primary transition-all font-bold"
                                        placeholder="Ex: João Roberto Silva"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">CPF</label>
                                    <input
                                        type="text"
                                        value={newMember.cpf}
                                        onChange={e => setNewMember({ ...newMember, cpf: e.target.value })}
                                        className="w-full h-14 px-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-primary transition-all font-bold"
                                        placeholder="000.000.000-00"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">WhatsApp</label>
                                    <input
                                        type="tel"
                                        value={newMember.phone}
                                        onChange={e => setNewMember({ ...newMember, phone: formatPhone(e.target.value) })}
                                        className="w-full h-14 px-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-primary transition-all font-bold"
                                        placeholder="(00) 00000-0000"
                                        maxLength={15}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Email (Obrigatório para login)</label>
                                    <input
                                        type="email"
                                        value={newMember.email}
                                        onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                                        className="w-full h-14 px-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-primary transition-all font-bold"
                                        placeholder="exemplo@email.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-8 pb-10 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !newMember.name || !newMember.phone || !newMember.cpf || !newMember.email}
                                className={`w-full h-16 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${!isSubmitting && newMember.name && newMember.phone && newMember.cpf && newMember.email ? 'bg-success text-white shadow-xl shadow-success/20 active:scale-95' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            >
                                {isSubmitting ? (
                                    <span className="animate-spin material-symbols-outlined">sync</span>
                                ) : (
                                    <span className="material-symbols-outlined">how_to_reg</span>
                                )}
                                {isSubmitting ? 'Processando...' : 'Salvar Cadastro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamView;
