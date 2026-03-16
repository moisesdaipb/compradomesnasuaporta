import React, { useState } from 'react';
import { Customer, TeamMember, ViewState } from '../types';

interface ManagerCustomersViewProps {
    customers: Customer[];
    team: TeamMember[];
    setView: (v: ViewState) => void;
}

const ManagerCustomersView: React.FC<ManagerCustomersViewProps> = ({
    customers,
    team,
    setView,
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCustomers = customers
        .filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.phone.includes(searchQuery) ||
            (c.cpf && c.cpf.includes(searchQuery))
        )
        .sort((a, b) => b.createdAt - a.createdAt);

    const getCreatorName = (createdBy?: string) => {
        if (!createdBy) return 'Online (Site/App)';
        const member = team.find(t => t.id === createdBy);
        return member ? `Vendedor: ${member.name}` : 'Origem Desconhecida';
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300 bg-slate-50 dark:bg-slate-900">
            {/* Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-500"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h2 className="text-xl font-black">Base de Clientes</h2>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Gestão e Origem de Cadastros</p>
                    </div>
                </div>
            </div>

            {/* Stats & Search */}
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <p className="text-2xl font-black text-primary">{customers.length}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total de Clientes</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <p className="text-2xl font-black text-success">
                            {customers.filter(c => !c.createdBy).length}
                        </p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Auto-Cadastros</p>
                    </div>
                </div>

                <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou telefone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl border border-white dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm font-bold focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* Customers List */}
            <div className="flex-1 px-6 pb-32 overflow-y-auto space-y-3 no-scrollbar">
                {filteredCustomers.map(customer => (
                    <div key={customer.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:border-primary/30 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="size-12 rounded-xl bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-primary">
                                <span className="material-symbols-outlined text-2xl">person</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">{customer.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-bold text-slate-400">{customer.phone}</span>
                                    <span className="size-1 rounded-full bg-slate-300"></span>
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${!customer.createdBy ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {getCreatorName(customer.createdBy)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Cadastrado em</p>
                            <p className="text-xs font-bold">{new Date(customer.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                ))}

                {filteredCustomers.length === 0 && (
                    <div className="py-20 text-center">
                        <span className="material-symbols-outlined text-5xl text-slate-200 mb-4">search_off</span>
                        <p className="text-slate-400 font-bold">Nenhum cliente encontrado</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ManagerCustomersView;
