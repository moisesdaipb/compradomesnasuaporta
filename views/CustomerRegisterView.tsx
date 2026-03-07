import React, { useState } from 'react';
import { ViewState, Customer } from '../types';

interface CustomerRegisterViewProps {
    customers: Customer[];
    onAddCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => Promise<Customer>;
    onSelectCustomer: (customer: Customer) => void;
    setView: (v: ViewState) => void;
}

const CustomerRegisterView: React.FC<CustomerRegisterViewProps> = ({
    customers,
    onAddCustomer,
    onSelectCustomer,
    setView,
}) => {
    const [mode, setMode] = useState<'search' | 'register'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        cpf: '',
        phone: '',
        address: '',
        addressNumber: '',
        neighborhood: '',
        city: '',
        zipCode: '',
        state: '',
        complement: '',
        email: '',
    });
    const [isSearching, setIsSearching] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [cpfError, setCpfError] = useState<string | null>(null);

    // CEP Lookup (BrasilAPI)
    React.useEffect(() => {
        const cleanCEP = formData.zipCode?.replace(/\D/g, '');
        if (cleanCEP?.length === 8) {
            const fetchCEP = async () => {
                setIsSearching(true);
                try {
                    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCEP}`);
                    if (!response.ok) throw new Error('CEP não encontrado');
                    const data = await response.json();
                    setFormData(prev => ({
                        ...prev,
                        address: data.street || prev.address,
                        neighborhood: data.neighborhood || prev.neighborhood,
                        city: data.city || prev.city,
                        state: data.state || prev.state,
                        zipCode: data.cep || prev.zipCode,
                    }));
                } catch (error) {
                    console.error('CEP lookup error:', error);
                } finally {
                    setIsSearching(false);
                }
            };
            fetchCEP();
        }
    }, [formData.zipCode]);

    const validateCPF = (cpf: string) => {
        const cleanCPF = cpf.replace(/\D/g, '');
        if (cleanCPF.length === 0) return true;
        if (cleanCPF.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

        let sum = 0;
        let rev;
        for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cleanCPF.charAt(9))) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cleanCPF.charAt(10))) return false;

        return true;
    };

    const filteredCustomers = customers.filter(c => {
        const query = searchQuery.toLowerCase();
        return (
            (c.name || '').toLowerCase().includes(query) ||
            (c.cpf || '').includes(searchQuery) ||
            (c.phone || '').includes(searchQuery) ||
            (c.email || '').toLowerCase().includes(query)
        );
    });

    const formatCPF = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4').slice(0, 14);
    };

    const formatPhone = (value: string) => {
        const numbers = value.replace(/\D/g, '');
        if (numbers.length <= 10) {
            return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').slice(0, 15);
    };

    const handleRegister = async () => {
        if (!formData.name || !formData.cpf || !formData.phone || !formData.address || !formData.addressNumber || isRegistering) return;

        if (!validateCPF(formData.cpf)) {
            setCpfError('CPF inválido');
            return;
        }
        setCpfError(null);
        setIsRegistering(true);

        try {
            const newCustomer = await onAddCustomer({
                name: formData.name,
                cpf: formData.cpf,
                phone: formData.phone,
                address: formData.address,
                addressNumber: formData.addressNumber,
                neighborhood: formData.neighborhood,
                city: formData.city,
                zipCode: formData.zipCode || undefined,
                state: formData.state || undefined,
                complement: formData.complement || undefined,
                email: formData.email || undefined,
            });

            onSelectCustomer(newCustomer);
            setView('presential-sale');
        } catch (error) {
            console.error('Registration failed:', error);
            alert('Falha ao cadastrar cliente. Verifique sua conexão.');
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('presential-sale')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h3 className="text-lg font-bold leading-tight">Clientes</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {mode === 'search' ? 'Buscar ou cadastrar' : 'Novo cadastro'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Mode Tabs */}
            <div className="px-4 mt-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    <button
                        onClick={() => setMode('search')}
                        className={`flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${mode === 'search'
                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                            : 'text-slate-500'
                            }`}
                    >
                        <span className="material-symbols-outlined text-lg">search</span>
                        Buscar
                    </button>
                    <button
                        onClick={() => setMode('register')}
                        className={`flex-1 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all ${mode === 'register'
                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                            : 'text-slate-500'
                            }`}
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Cadastrar
                    </button>
                </div>
            </div>

            {mode === 'search' ? (
                <>
                    {/* Search Input */}
                    <div className="px-4 mt-4">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Nome, CPF ou telefone..."
                            />
                        </div>
                    </div>

                    {/* Results */}
                    <div className="flex-1 p-4 space-y-2 overflow-y-auto pb-32">
                        {filteredCustomers.length === 0 ? (
                            <div className="text-center py-10">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">person_search</span>
                                <p className="text-slate-500">Nenhum cliente encontrado</p>
                                <button
                                    onClick={() => setMode('register')}
                                    className="mt-4 text-primary font-medium"
                                >
                                    Cadastrar novo cliente
                                </button>
                            </div>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <button
                                    key={customer.id}
                                    onClick={() => {
                                        onSelectCustomer(customer);
                                        setView('presential-sale');
                                    }}
                                    className="w-full bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-left active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-primary">person</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold">{customer.name}</p>
                                            <p className="text-xs text-slate-500">{customer.cpf}</p>
                                            <p className="text-xs text-slate-400">{customer.phone}</p>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-400">chevron_right</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <form className="flex-1 p-4 space-y-4 overflow-y-auto pb-40">
                    {/* Name */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            Nome Completo *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Nome do cliente"
                        />
                    </div>

                    {/* CPF and Phone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                CPF *
                            </label>
                            <input
                                type="text"
                                value={formData.cpf}
                                onChange={(e) => {
                                    setFormData({ ...formData, cpf: formatCPF(e.target.value) });
                                    if (cpfError) setCpfError(null);
                                }}
                                className={`w-full h-12 px-4 rounded-xl border bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${cpfError ? 'border-danger ring-1 ring-danger' : 'border-slate-200 dark:border-slate-600'}`}
                                placeholder="000.000.000-00"
                            />
                            {cpfError && <p className="text-[10px] text-danger font-bold mt-1 ml-1">{cpfError}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Telefone *
                            </label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                    </div>

                    {/* CEP */}
                    <div className="relative">
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            CEP (preenche endereço)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formData.zipCode}
                                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="00000-000"
                            />
                            {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 ml-1 group">Se não souber o CEP, pode preencher abaixo manualmente.</p>
                    </div>

                    {/* Address and Number */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-3">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Endereço *
                            </label>
                            <input
                                type="text"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Rua, Avenida..."
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Nº *
                            </label>
                            <input
                                type="text"
                                value={formData.addressNumber}
                                onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent text-center"
                                placeholder="123"
                            />
                        </div>
                    </div>

                    {/* Complement */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            Complemento
                        </label>
                        <input
                            type="text"
                            value={formData.complement}
                            onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Apt, Bloco, etc."
                        />
                    </div>

                    {/* Neighborhood and City */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Bairro *
                            </label>
                            <input
                                type="text"
                                value={formData.neighborhood}
                                onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Bairro"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                Cidade *
                            </label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                placeholder="Cidade"
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                            Email (opcional)
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="email@exemplo.com"
                        />
                    </div>
                </form>
            )}

            {/* Register Button */}
            {mode === 'register' && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-4 glass-morphism border-t border-gray-200 dark:border-gray-800 z-50">
                    <button
                        onClick={handleRegister}
                        disabled={!formData.name || !formData.cpf || !formData.phone || !formData.address || !formData.addressNumber || isRegistering}
                        className={`w-full h-14 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${formData.name && formData.cpf && formData.phone && formData.address && formData.addressNumber && !isRegistering
                            ? 'bg-success text-white shadow-lg active:scale-[0.98]'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                    >
                        {isRegistering ? (
                            <div className="size-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <>
                                <span className="material-symbols-outlined">person_add</span>
                                Cadastrar e Continuar
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default CustomerRegisterView;
