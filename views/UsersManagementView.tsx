import React, { useState, useMemo } from 'react';
import { UserRole, ViewState } from '../types';

interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    phone?: string;
    cpf?: string;
    status: string;
    last_login_at?: string;
}

interface UsersManagementViewProps {
    users: any[];
    onUpdateRole: (userId: string, role: UserRole) => Promise<void>;
    setView: (v: ViewState) => void;
}

const UsersManagementView: React.FC<UsersManagementViewProps> = ({ users, onUpdateRole, setView }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'todos' | UserRole>('todos');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesFilter = filter === 'todos' || u.role === filter;
            const matchesSearch =
                (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (u.cpf || '').includes(searchTerm);
            return matchesFilter && matchesSearch;
        });
    }, [users, filter, searchTerm]);

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        if (!window.confirm(`Deseja alterar o cargo deste usuário para ${newRole}?`)) return;

        setIsUpdating(userId);
        try {
            await onUpdateRole(userId, newRole);
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Erro ao atualizar cargo.');
        } finally {
            setIsUpdating(null);
        }
    };

    const getRoleConfig = (role: UserRole) => {
        switch (role) {
            case 'gerente': return { label: 'Gerente', color: 'bg-danger/10 text-danger border-danger/20', icon: 'admin_panel_settings' };
            case 'vendedor': return { label: 'Vendedor', color: 'bg-primary/10 text-primary border-primary/20', icon: 'storefront' };
            case 'entregador': return { label: 'Entregador', color: 'bg-secondary/10 text-secondary border-secondary/20', icon: 'local_shipping' };
            case 'cliente': return { label: 'Cliente', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: 'person' };
            default: return { label: 'Usuário', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: 'person' };
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Nunca';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR') + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6">
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="size-12 rounded-2xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-xl">
                            <span className="material-symbols-outlined text-2xl">manage_accounts</span>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Gerenciar Usuários</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">Controle de Acessos e Cargos</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome, e-mail ou CPF..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border-transparent rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-sm"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {(['todos', 'gerente', 'vendedor', 'entregador', 'cliente'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${filter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-100 dark:border-slate-800'}`}
                            >
                                {f === 'todos' ? 'Todos' : f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                        <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                        <p className="font-bold">Nenhum usuário encontrado</p>
                    </div>
                ) : (
                    filteredUsers.map(user => {
                        const config = getRoleConfig(user.role);
                        return (
                            <div key={user.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className={`size-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${user.role === 'gerente' ? 'bg-danger' : user.role === 'vendedor' ? 'bg-primary' : user.role === 'entregador' ? 'bg-secondary' : 'bg-slate-400'}`}>
                                            <span className="material-symbols-outlined text-2xl">{config.icon}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white leading-tight">{user.name || 'Sem Nome'}</h4>
                                            <p className="text-xs font-bold text-slate-400 truncate max-w-[200px]">{user.email}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${config.color}`}>
                                                    {config.label}
                                                </span>
                                                {user.last_login_at && (
                                                    <span className="text-[9px] text-slate-400 font-bold">
                                                        Acesso: {formatDate(user.last_login_at)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isUpdating === user.id && (
                                        <div className="animate-spin text-primary">
                                            <span className="material-symbols-outlined">sync</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-50 dark:border-slate-800">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Alterar Cargo para:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {(['gerente', 'vendedor', 'entregador', 'cliente'] as UserRole[]).map(r => (
                                            <button
                                                key={r}
                                                disabled={user.role === r || isUpdating === user.id}
                                                onClick={() => handleRoleChange(user.id, r)}
                                                className={`h-10 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${user.role === r ? 'bg-slate-50 dark:bg-slate-800 text-slate-300 border-transparent cursor-default' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-white border-slate-100 dark:border-slate-800 hover:border-primary active:scale-95 shadow-sm'}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default UsersManagementView;
