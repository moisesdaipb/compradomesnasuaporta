import React, { useState } from 'react';
import { UserSession, UserRole, Customer, AppSettings } from '../types';
import { saveSession, generateId } from '../store';
import { supabase } from '../supabase';

interface LoginViewProps {
    onLogin: (session: UserSession) => void;
    onRegisterCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>) => Promise<Customer>;
    settings?: AppSettings;
    initialMode?: 'login' | 'register' | 'forgot-password' | 'reset-password';
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegisterCustomer, settings, initialMode = 'login' }) => {
    const appName = settings?.appName || 'Cesta Básica na sua Casa';
    const appSubtitle = appName === 'Cesta Básica na sua Casa' ? '' : ''; // Subtitle is redundant with the full name
    const logoType = settings?.logoType || 'icon';
    const appLogo = settings?.appLogo || 'shopping_basket';
    const [mode, setMode] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>(initialMode);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Campos do cadastro
    const [registerData, setRegisterData] = useState({
        name: '',
        email: '',
        cpf: '',
        phone: '',
        address: '',
        addressNumber: '',
        neighborhood: '',
        city: '',
    });

    // Safety reset for loading state
    React.useEffect(() => {
        let timer: any;
        if (isLoading) {
            timer = setTimeout(() => {
                console.warn('Login/Register hanging? Resetting isLoading safety.');
                setIsLoading(false);
            }, 10000);
        }
        return () => clearTimeout(timer);
    }, [isLoading]);

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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        console.log('handleLogin starting for:', email);
        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                console.error('handleLogin auth error:', authError.message);
                setError('Falha no login: ' + authError.message);
                setIsLoading(false);
                return;
            }

            console.log('handleLogin auth success, fetching profile...');

            // Fetch profile directly and call onLogin
            if (data.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .maybeSingle();

                if (profileError || !profile) {
                    console.error('handleLogin profile error:', profileError);
                    setError('Erro ao carregar perfil. Tente novamente.');
                    setIsLoading(false);
                    return;
                }

                console.log('handleLogin profile loaded, calling onLogin:', profile.email, profile.role);
                onLogin({
                    id: profile.id,
                    name: profile.name,
                    email: profile.email || '',
                    role: profile.role,
                    avatar: profile.avatar,
                    provider: data.user.app_metadata?.provider || 'email',
                });
            }
        } catch (err: any) {
            console.error('handleLogin crash:', err);
            setError('Erro inesperado no login.');
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
                redirectTo: window.location.origin + '/',
            });

            if (resetError) {
                setError(resetError.message);
            } else {
                setSuccessMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
                setTimeout(() => setMode('login'), 5000);
            }
        } catch (err) {
            setError('Erro ao enviar e-mail de recuperação.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (newPassword.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setIsLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                setError(updateError.message);
            } else {
                setSuccessMessage('Senha atualizada com sucesso! Você já pode entrar.');
                setTimeout(() => setMode('login'), 3000);
            }
        } catch (err) {
            setError('Erro ao atualizar senha.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        try {
            const redirectUrl = window.location.origin.endsWith('/') 
                ? window.location.origin 
                : window.location.origin + '/';
                
            const { error: authError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                }
            });

            if (authError) {
                console.error('Erro Supabase:', authError.message);
                setError('Erro do Google: ' + authError.message);
            }
        } catch (err: any) {
            console.error('Falha no Login Google:', err);
            setError('Falha ao conectar com Google.');
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setIsLoading(true);

        console.log('handleRegister starting for:', registerData.email);
        try {
            const { data, error: authError } = await supabase.auth.signUp({
                email: registerData.email,
                password: password,
                options: {
                    data: {
                        name: registerData.name,
                        role: 'cliente'
                    }
                }
            });

            if (authError) {
                console.error('handleRegister auth error:', authError.message);
                setError('Erro no cadastro: ' + authError.message);
                setIsLoading(false);
                return;
            }

            if (data.user) {
                console.log('handleRegister success for user ID:', data.user.id);
                setSuccessMessage('Cadastro realizado! Redirecionando para o login...');
                setTimeout(() => {
                    setMode('login');
                    setEmail(registerData.email);
                    setPassword('');
                    setConfirmPassword('');
                    setSuccessMessage('Agora basta entrar com sua senha.');
                }, 2000);
            }
        } catch (err: any) {
            console.error('handleRegister crash:', err);
            setError('Erro inesperado no cadastro.');
        } finally {
            console.log('handleRegister finally block reached');
            setIsLoading(false);
        }
    };

    const handleClearSystem = async () => {
        if (!window.confirm('Isso irá sair da sua conta e limpar todos os dados salvos no navegador. Deseja continuar?')) return;

        setIsLoading(true);
        console.log('[LoginView] Starting full system clear...');

        try {
            // Priority 1: Clear local storage and session
            localStorage.clear();
            sessionStorage.clear();
            console.log('[LoginView] Local storage cleared');

            // Priority 2: Try to sign out from Supabase (silent failure)
            try {
                await supabase.auth.signOut();
                console.log('[LoginView] Supabase signOut success');
            } catch (authErr) {
                console.warn('[LoginView] Supabase signOut failed (expected if no session or offline):', authErr);
            }

            // Priority 3: Hard redirect to clear any lingering React state
            console.log('[LoginView] Forcing hard reload to root...');
            window.location.href = window.location.origin;
        } catch (err) {
            console.error('[LoginView] Error during system clear:', err);
            window.location.href = window.location.origin;
        }
    };


    return (
        <div className="min-h-screen bg-gradient-to-br from-primary via-blue-600 to-indigo-700 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-24 bg-white/20 backdrop-blur-md rounded-[32px] mb-4 shadow-xl border border-white/10 overflow-hidden p-2">
                        {logoType === 'icon' ? (
                            <span className="material-symbols-outlined text-6xl text-white drop-shadow-lg">{appLogo}</span>
                        ) : (
                            <img src={appLogo} alt={appName} className="w-full h-full object-contain drop-shadow-md" />
                        )}
                    </div>
                    <h1 className="text-3xl font-black text-white drop-shadow-md">{appName}</h1>
                    {appSubtitle && <p className="text-white/70 text-sm mt-1 font-bold uppercase tracking-widest">{appSubtitle}</p>}
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto">
                    {/* Tabs */}
                    <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 mb-6">
                        <button
                            onClick={() => setMode('login')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'login'
                                ? 'bg-white dark:bg-slate-600 text-primary dark:text-white shadow-sm'
                                : 'text-slate-500'
                                }`}
                        >
                            Entrar
                        </button>
                        <button
                            onClick={() => setMode('register')}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === 'register'
                                ? 'bg-white dark:bg-slate-600 text-primary dark:text-white shadow-sm'
                                : 'text-slate-500'
                                }`}
                        >
                            Cadastrar
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
                            {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-xl text-success text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                            {successMessage}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Social Login Button */}
                        <div className="space-y-3">
                            <button
                                onClick={handleGoogleLogin}
                                className="w-full h-12 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center gap-3 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-[0.98]"
                            >
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="size-5" />
                                <span>Entrar com Google</span>
                            </button>

                        </div>

                        <div className="flex items-center gap-4 py-2">
                            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700"></div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ou use seu email</span>
                            <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700"></div>
                        </div>

                        {mode === 'login' ? (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        Senha
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-xl">
                                                {showPassword ? 'visibility' : 'visibility_off'}
                                            </span>
                                        </button>
                                    </div>
                                    <div className="flex justify-end mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setMode('forgot-password')}
                                            className="text-xs font-bold text-primary hover:underline"
                                        >
                                            Esqueci minha senha
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-14 bg-primary hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined">
                                        {isLoading ? 'sync' : 'login'}
                                    </span>
                                    {isLoading ? 'Entrando...' : 'Entrar'}
                                </button>
                            </form>
                        ) : mode === 'register' ? (
                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        Nome Completo *
                                    </label>
                                    <input
                                        type="text"
                                        value={registerData.name}
                                        onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="Seu nome completo"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={registerData.email}
                                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        Senha *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                            placeholder="No mínimo 6 caracteres"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-xl">
                                                {showPassword ? 'visibility' : 'visibility_off'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        Confirmar Senha *
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className={`w-full h-12 pl-4 pr-12 rounded-xl border bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent ${confirmPassword && password !== confirmPassword
                                                    ? 'border-danger ring-1 ring-danger'
                                                    : 'border-slate-200 dark:border-slate-600'
                                                }`}
                                            placeholder="Repita sua senha"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-14 bg-success hover:bg-green-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined">
                                        {isLoading ? 'sync' : 'person_add'}
                                    </span>
                                    {isLoading ? 'Cadastrando...' : 'Criar Minha Conta'}
                                </button>
                            </form>
                        ) : mode === 'forgot-password' ? (
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        E-mail de Recuperação
                                    </label>
                                    <input
                                        type="email"
                                        value={recoveryEmail}
                                        onChange={(e) => setRecoveryEmail(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                        placeholder="seu@email.com"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-14 bg-primary hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined">
                                        {isLoading ? 'sync' : 'mail'}
                                    </span>
                                    {isLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="w-full py-2 text-sm font-bold text-slate-400 hover:text-primary transition-colors"
                                >
                                    Voltar para o Login
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 mb-4">
                                    <p className="text-xs text-primary font-medium text-center">
                                        Crie uma nova senha segura para sua conta.
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5 block">
                                        Nova Senha
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full h-12 pl-4 pr-12 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-primary focus:border-transparent"
                                            placeholder="No mínimo 6 caracteres"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-xl">
                                                {showPassword ? 'visibility' : 'visibility_off'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-14 bg-success hover:bg-green-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                                >
                                    <span className="material-symbols-outlined">
                                        {isLoading ? 'sync' : 'lock_reset'}
                                    </span>
                                    {isLoading ? 'Atualizando...' : 'Atualizar Senha'}
                                </button>
                            </form>
                        )}
                    </div>



                    {/* Emergency recovery */}
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-3">Problemas para entrar?</p>
                        <button
                            onClick={handleClearSystem}
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:text-danger hover:border-danger transition-all text-[11px] font-bold flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">restart_alt</span>
                            Limpar Sistema e Sair
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-white/50 text-xs mt-6">
                </p>
            </div>
        </div>
    );
};

export default LoginView;
