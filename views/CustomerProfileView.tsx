import React, { useState, useEffect, useRef } from 'react';
import { ViewState, UserSession, Customer } from '../types';
import { validateCPF } from '../utils';

interface CustomerProfileViewProps {
    session: UserSession;
    customer: Customer | null;
    onUpdateProfile: (updates: Partial<Customer> & { avatar?: string }) => void;
    onLogout: () => void;
    setView: (v: ViewState) => void;
}

const CustomerProfileView: React.FC<CustomerProfileViewProps> = ({
    session,
    customer,
    onUpdateProfile,
    onLogout,
    setView,
}) => {
    const [formData, setFormData] = useState<Partial<Customer> & { avatar?: string }>({
        name: customer?.name || session.name || '',
        email: customer?.email || session.email || '',
        avatar: session.avatar || '',
        phone: customer?.phone || '',
        cpf: customer?.cpf || '',
        address: customer?.address || '',
        addressNumber: customer?.addressNumber || '',
        complement: customer?.complement || '',
        neighborhood: customer?.neighborhood || '',
        city: customer?.city || '',
        state: customer?.state || '',
        zipCode: customer?.zipCode || '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Crop States
    const [cropImage, setCropImage] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Sincroniza o formulário quando os dados do cliente ou sessão mudam (ex: após um refresh em background)
    useEffect(() => {
        if (!isSaving) { // Não sobrescrever campos enquanto o usuário está digitando/salvando
            setFormData({
                name: customer?.name || session.name || '',
                email: customer?.email || session.email || '',
                avatar: session.avatar || '',
                phone: customer?.phone || '',
                cpf: customer?.cpf || '',
                address: customer?.address || '',
                addressNumber: customer?.addressNumber || '',
                complement: customer?.complement || '',
                neighborhood: customer?.neighborhood || '',
                city: customer?.city || '',
                state: customer?.state || '',
                zipCode: customer?.zipCode || '',
            });
        }
    }, [customer, session, isSaving]);
    const [isSearching, setIsSearching] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [cpfError, setCpfError] = useState<string | null>(null);

    // CEP Lookup (BrasilAPI)
    useEffect(() => {
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
                        zipCode: data.cep || prev.zipCode, // Keep formatted CEP if returned
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


    const [showError, setShowError] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);

    const validateEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const handleSave = async () => {
        const isCpfValid = validateCPF(formData.cpf || '');
        if (!isCpfValid) {
            setCpfError('O CPF informado é inválido.');
            return;
        }
        setCpfError(null);

        if (formData.email && !validateEmail(formData.email)) {
            setLastError('O e-mail informado é inválido (ex: julia@gmail.com)');
            setShowError(true);
            return;
        }

        setShowError(false);
        setLastError(null);

        const normalizeString = (str: string) => str.trim().replace(/\s+/g, ' ');

        setIsSaving(true);
        try {
            const normalizedData = {
                ...formData,
                name: normalizeString(formData.name || ''),
                address: normalizeString(formData.address || ''),
                neighborhood: normalizeString(formData.neighborhood || ''),
                city: normalizeString(formData.city || ''),
                complement: normalizeString(formData.complement || ''),
                phone: normalizeString(formData.phone || ''),
                cpf: normalizeString(formData.cpf || ''),
            };
            await onUpdateProfile(normalizedData);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error: any) {
            console.error('Save failed:', error);
            setLastError(error.message || 'Erro ao conectar com o servidor');
            setShowError(true);
            setTimeout(() => setShowError(false), 8000);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropImage(reader.result as string);
                setZoom(1);
                setOffset({ x: 0, y: 0 });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCropSave = () => {
        if (!cropImage || !containerRef.current) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new Image();
        img.onload = async () => {
            const size = 600; // Increased resolution for better quality
            canvas.width = size;
            canvas.height = size;

            // 1. Fill background with white (prevents black borders in JPEG)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);

            const containerSize = containerRef.current!.offsetWidth;

            // Matches CSS scale(zoom) where zoom=1 is natural size
            const sWidth = containerSize / zoom;
            const sHeight = containerSize / zoom;

            // Calculate source coordinates centered on image
            const sx = (img.width / 2 - sWidth / 2) - (offset.x / zoom);
            const sy = (img.height / 2 - sHeight / 2) - (offset.y / zoom);

            // Draw image on canvas
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, size, size);

            const croppedAvatar = canvas.toDataURL('image/jpeg', 0.9);
            const updatedData = { ...formData, avatar: croppedAvatar };
            setFormData(updatedData);
            setCropImage(null);

            // Auto-save the avatar change
            setIsSaving(true);
            try {
                await onUpdateProfile(updatedData);
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
            } catch (error: any) {
                console.error('Auto-save failed:', error);
                setLastError(error.message || 'Erro ao salvar foto automaticamente');
                setShowError(true);
                setTimeout(() => setShowError(false), 5000);
            } finally {
                setIsSaving(false);
            }
        };
        img.src = cropImage;
    };

    const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
    };

    const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDragging) return;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        setOffset({
            x: clientX - dragStart.x,
            y: clientY - dragStart.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);


    return (
        <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-300">
            {/* Hidden Photo Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handlePhotoChange}
            />

            {/* Header */}
            <div className="px-6 py-4 bg-white shadow-sm flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('customer-store')}
                        className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-600">arrow_back</span>
                    </button>
                    <h2 className="text-xl font-black text-slate-900">Meu Perfil</h2>
                </div>
                {showSuccess && (
                    <div className="flex items-center gap-2 text-success font-bold text-sm animate-in fade-in slide-in-from-top-2">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Salvo!
                    </div>
                )}
                {showError && (
                    <div className="flex items-center gap-2 text-danger font-bold text-sm animate-in fade-in slide-in-from-top-2">
                        <span className="material-symbols-outlined text-lg">error</span>
                        {lastError || 'Erro ao salvar'}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
                {/* Profile Header */}
                <div className="flex flex-col items-center text-center">
                    <div className="relative group">
                        <div className="size-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-slate-200">
                            <img
                                src={formData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || '')}&background=0a4da3&color=fff`}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 size-9 bg-[#0a4da3] text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-white z-10"
                        >
                            <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                    </div>
                    <div className="mt-4">
                        <h3 className="text-lg font-black text-slate-900">{formData.name}</h3>
                        <p className="text-sm text-slate-500 font-medium">{formData.email}</p>
                    </div>
                </div>

                {/* Personal Info */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-[#0a4da3] text-xl font-bold">person</span>
                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Dados Pessoais</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500 ml-1">NOME COMPLETO <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3] outline-none transition-all font-medium"
                                placeholder="Seu nome"
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">CPF <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    value={formData.cpf}
                                    onChange={(e) => {
                                        setFormData({ ...formData, cpf: e.target.value });
                                        if (cpfError) setCpfError(null);
                                    }}
                                    className={`w-full h-12 px-4 rounded-xl bg-white border ${cpfError ? 'border-danger ring-1 ring-danger' : 'border-slate-300'} shadow-sm focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3] outline-none transition-all font-medium`}
                                    placeholder="000.000.000-00"
                                />
                                {cpfError && (
                                    <p className="text-[10px] text-danger font-bold ml-1">{cpfError}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">TELEFONE <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3] outline-none transition-all font-medium"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-slate-500 ml-1">E-MAIL <span className="text-danger">*</span></label>
                                {session.provider === 'google' && (
                                    <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 font-bold px-2 py-0.5 rounded-full uppercase">
                                        <img src="https://www.google.com/favicon.ico" alt="Google" className="size-2.5" />
                                        Vinculado ao Google
                                    </span>
                                )}
                            </div>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                readOnly={session.provider === 'google'}
                                className={`w-full h-12 px-4 rounded-xl border shadow-sm focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3] outline-none transition-all font-medium ${session.provider === 'google' ? 'bg-slate-100/50 text-slate-400 cursor-not-allowed border-slate-200 border-dashed' : 'bg-white border-slate-300'}`}
                                placeholder="seu@email.com"
                            />
                        </div>
                    </div>
                </div>

                {/* Address Info */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#0a4da3] text-xl font-bold">location_on</span>
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Endereço de Entrega</h4>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500 ml-1">CEP <span className="text-danger">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.zipCode}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                                        const formatted = val.length > 5 ? `${val.slice(0, 5)}-${val.slice(5)}` : val;
                                        setFormData({ ...formData, zipCode: formatted });
                                    }}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm outline-none font-bold text-lg focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3]"
                                    placeholder="00000-000"
                                />
                                {isSearching && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <div className="size-4 border-2 border-[#0a4da3]/20 border-t-[#0a4da3] rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="col-span-3 space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">ENDEREÇO <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm outline-none font-medium focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3]"
                                    placeholder="Rua, Avenida..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">Nº <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    value={formData.addressNumber}
                                    onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm outline-none font-medium focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3]"
                                    placeholder="123"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">COMPLEMENTO</label>
                                <input
                                    type="text"
                                    value={formData.complement}
                                    onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm outline-none font-medium focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3]"
                                    placeholder="Ex: Apto 101"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">BAIRRO <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    value={formData.neighborhood}
                                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm outline-none font-medium focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3]"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-5 gap-4">
                            <div className="col-span-3 space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">CIDADE <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm outline-none font-medium focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3]"
                                />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-black text-slate-500 ml-1">ESTADO (UF) <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    value={formData.state}
                                    maxLength={2}
                                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-300 shadow-sm outline-none font-medium focus:ring-2 focus:ring-[#0a4da3]/20 focus:border-[#0a4da3]"
                                    placeholder="EX: SP"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Logout Button */}
                <div className="pt-4 pb-8 border-t border-slate-100">
                    <button
                        onClick={onLogout}
                        className="w-full h-12 flex items-center justify-center gap-2 text-danger font-bold hover:bg-danger/5 rounded-xl transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        SAIR DO SISTEMA
                    </button>
                </div>
            </div>

            {/* Footer Action */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-md p-6 bg-white/80 backdrop-blur-md border-t border-slate-100 z-50">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full h-14 bg-[#0a4da3] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
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

            {/* Crop Modal */}
            {cropImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-6 text-center border-b border-slate-100">
                            <h3 className="text-lg font-black text-slate-900">Ajustar Foto</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Arraste para centralizar</p>
                        </div>

                        <div className="p-8">
                            <div
                                ref={containerRef}
                                className="aspect-square w-full rounded-full overflow-hidden bg-slate-100 shadow-inner relative cursor-move touch-none"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onTouchStart={handleMouseDown as any}
                                onTouchMove={handleMouseMove as any}
                                onTouchEnd={handleMouseUp}
                            >
                                <img
                                    src={cropImage}
                                    alt="To crop"
                                    className="absolute max-w-none transition-transform duration-75 select-none pointer-events-none"
                                    style={{
                                        transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                                        top: '50%',
                                        left: '50%',
                                    }}
                                />
                                <div className="absolute inset-0 border-4 border-[#0a4da3] rounded-full pointer-events-none opacity-50" />
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className="material-symbols-outlined text-slate-400 text-sm">zoom_out</span>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="3"
                                        step="0.01"
                                        value={zoom}
                                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                                        className="flex-1 accent-[#0a4da3] h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer"
                                    />
                                    <span className="material-symbols-outlined text-[#0a4da3] text-lg">zoom_in</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 flex gap-3">
                            <button
                                onClick={() => setCropImage(null)}
                                className="flex-1 h-12 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleCropSave}
                                className="flex-2 px-8 h-12 bg-[#0a4da3] text-white font-black rounded-2xl shadow-lg shadow-[#0a4da3]/20 active:scale-95 transition-all"
                            >
                                PRONTO
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerProfileView;
