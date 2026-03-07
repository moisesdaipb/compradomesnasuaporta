import React, { useState } from 'react';
import { ViewState, AppSettings } from '../types';
import { uploadAppLogo } from '../store';

interface AppConfigViewProps {
    settings: AppSettings;
    onUpdateSettings: (settings: AppSettings) => Promise<void>;
    setView: (v: ViewState) => void;
}

const AppConfigView: React.FC<AppConfigViewProps> = ({
    settings,
    onUpdateSettings,
    setView,
}) => {
    const [appName, setAppName] = useState(settings.appName);
    const [appLogo, setAppLogo] = useState(settings.appLogo || 'shopping_basket');
    const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber || '');
    const [logoType, setLogoType] = useState<'icon' | 'image'>(settings.logoType || 'icon');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const icons = [
        'shopping_basket', 'storefront', 'local_mall', 'inventory_2',
        'package_2', 'shopping_cart', 'fastfood', 'grocery'
    ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(10);
        try {
            const url = await uploadAppLogo(file);
            setUploadProgress(100);
            setAppLogo(url);
            setLogoType('image');
        } catch (error) {
            console.error('Error uploading logo:', error);
            alert('Erro ao fazer upload do logotipo.');
        } finally {
            setTimeout(() => {
                setIsUploading(false);
                setUploadProgress(0);
            }, 500);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onUpdateSettings({ 
                appName, 
                appLogo, 
                logoType, 
                whatsappNumber: whatsappNumber.replace(/\D/g, '') 
            });
            alert('Configurações salvas com sucesso!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Erro ao salvar configurações.');
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = appName !== settings.appName ||
        appLogo !== settings.appLogo ||
        logoType !== settings.logoType ||
        whatsappNumber !== settings.whatsappNumber;

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white px-6 py-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-600">arrow_back</span>
                    </button>
                    <h2 className="text-xl font-black text-slate-900">Configurações do App</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 space-y-8">
                    {/* Visual Identity Section */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="size-12 rounded-2xl bg-[#0a4da3]/5 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#0a4da3] font-bold">palette</span>
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900">Identidade Visual</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Logo e Nome do Sistema</p>
                            </div>
                        </div>

                        {/* App Name */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Nome do Aplicativo</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={appName}
                                    onChange={(e) => setAppName(e.target.value)}
                                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3] outline-none transition-all font-bold text-slate-900"
                                    placeholder="Ex: Cesta Básica na Sua Casa"
                                />
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    rocket_launch
                                </span>
                            </div>
                        </div>

                        {/* WhatsApp Number */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp de Contato</label>
                                <span className="text-[9px] font-bold text-slate-300">Ex: 5541999999999</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={whatsappNumber}
                                    onChange={(e) => setWhatsappNumber(e.target.value)}
                                    className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3] outline-none transition-all font-bold text-slate-900"
                                    placeholder="55 (Código do País) + DDD + Número"
                                />
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    chat_bubble
                                </span>
                            </div>
                        </div>

                        {/* Logo Type Selector */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Tipo de Logotipo</label>
                            <div className="grid grid-cols-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 gap-1.5">
                                <button
                                    onClick={() => setLogoType('icon')}
                                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${logoType === 'icon' ? 'bg-white text-[#0a4da3] shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">face</span>
                                    ÍCONE
                                </button>
                                <button
                                    onClick={() => setLogoType('image')}
                                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${logoType === 'image' ? 'bg-white text-[#0a4da3] shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">link</span>
                                    URL
                                </button>
                                <label className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all cursor-pointer ${isUploading ? 'bg-[#0a4da3]/10 text-[#0a4da3]' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
                                    <span className="material-symbols-outlined text-sm">{isUploading ? 'sync' : 'upload'}</span>
                                    {isUploading ? `${uploadProgress}%` : 'UPLOAD'}
                                </label>
                            </div>
                        </div>

                        {/* Logo Settings */}
                        {logoType === 'icon' ? (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">Escolher Ícone</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {icons.map(icon => (
                                        <button
                                            key={icon}
                                            onClick={() => setAppLogo(icon)}
                                            className={`size-14 rounded-2xl flex items-center justify-center transition-all ${appLogo === icon ? 'bg-[#0a4da3] text-white shadow-lg shadow-[#0a4da3]/30 scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                        >
                                            <span className="material-symbols-outlined text-2xl">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black text-slate-400 ml-1 uppercase tracking-widest">URL ou Caminho da Imagem</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={appLogo}
                                        onChange={(e) => setAppLogo(e.target.value)}
                                        className="w-full h-14 pl-12 pr-4 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3] outline-none transition-all font-bold text-slate-900"
                                        placeholder="https://exemplo.com/sua-logo.png"
                                    />
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        image
                                    </span>
                                </div>
                                <div className="mt-4 p-4 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
                                    {appLogo && (appLogo.startsWith('http') || appLogo.includes('base64')) ? (
                                        <>
                                            <img src={appLogo} alt="Preview" className="h-16 w-auto object-contain rounded-lg shadow-sm" />
                                            <p className="text-[9px] font-black text-[#0a4da3] mt-2 uppercase tracking-tighter opacity-50">Logotipo Selecionado</p>
                                        </>
                                    ) : (
                                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Prévia da imagem aparecerá aqui</div>
                                    )}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={isSaving || !hasChanges}
                            className="w-full h-16 bg-[#0a4da3] text-white font-black rounded-[24px] shadow-xl shadow-[#0a4da3]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale mt-4"
                        >
                            {isSaving ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">save</span>
                                    SALVAR ALTERAÇÕES
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="p-5 bg-[#0a4da3]/5 rounded-[24px] border border-[#0a4da3]/10">
                    <div className="flex gap-4">
                        <div className="size-8 rounded-full bg-[#0a4da3] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-white text-base">info</span>
                        </div>
                        <p className="text-[11px] text-[#0a4da3] font-bold leading-relaxed uppercase tracking-wide opacity-80">
                            A personalização visual ajuda colaboradores e clientes a identificarem sua marca. <br />O logotipo alterado será exibido na tela de login e em todo o sistema.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AppConfigView;
