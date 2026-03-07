import React, { useState, useRef } from 'react';
import { ViewState, UserSession, TeamMember } from '../types';

interface SellerProfileViewProps {
    session: UserSession;
    teamMember: TeamMember | null;
    onUpdateProfile: (updates: { name?: string; avatar?: string; phone?: string }) => Promise<void>;
    onLogout: () => void;
    setView: (v: ViewState) => void;
}

const SellerProfileView: React.FC<SellerProfileViewProps> = ({
    session,
    teamMember,
    onUpdateProfile,
    onLogout,
    setView,
}) => {
    const [formData, setFormData] = useState({
        name: teamMember?.name || session.name || '',
        phone: teamMember?.phone || '',
        avatar: session.avatar || '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Crop States
    const [cropImage, setCropImage] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

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
            const size = 300; // Target Size
            canvas.width = size;
            canvas.height = size;

            const containerSize = containerRef.current!.offsetWidth;
            const scale = (img.width / containerSize) / zoom;

            ctx.drawImage(
                img,
                (img.width / 2 - (containerSize / 2) * scale) - offset.x * scale,
                (img.height / 2 - (containerSize / 2) * scale) - offset.y * scale,
                containerSize * scale,
                containerSize * scale,
                0, 0, size, size
            );

            const croppedAvatar = canvas.toDataURL('image/jpeg', 0.8);
            setFormData({ ...formData, avatar: croppedAvatar });
            setCropImage(null);

            // Auto-save after crop
            await performSave({ ...formData, avatar: croppedAvatar });
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

    const performSave = async (data: typeof formData) => {
        setIsSaving(true);
        setError(null);
        try {
            await onUpdateProfile(data);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err: any) {
            setError(err.message || 'Erro ao salvar perfil');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = () => performSave(formData);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-in fade-in duration-300">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handlePhotoChange}
            />

            {/* Header */}
            <div className="px-6 py-4 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">arrow_back</span>
                    </button>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Meu Perfil</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                {/* Profile Photo Section */}
                <div className="flex flex-col items-center text-center py-4">
                    <div className="relative group">
                        <div className="size-32 rounded-[40px] border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden bg-slate-200 dark:bg-slate-700">
                            <img
                                src={formData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=0a4da3&color=fff`}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-2 -right-2 size-10 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-transform border-4 border-white dark:border-slate-800"
                        >
                            <span className="material-symbols-outlined text-lg">photo_camera</span>
                        </button>
                    </div>
                </div>

                {/* Form Section */}
                <div className="max-w-md mx-auto w-full space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">person</span>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full h-14 pl-12 pr-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Seu nome"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Telefone WhatsApp</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">call</span>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full h-14 pl-12 pr-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 opacity-60">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">mail</span>
                                <input
                                    type="email"
                                    value={session.email || ''}
                                    disabled
                                    className="w-full h-14 pl-12 pr-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-danger/10 border border-danger/20 rounded-2xl flex items-center gap-3 text-danger text-sm font-bold">
                            <span className="material-symbols-outlined">error</span>
                            {error}
                        </div>
                    )}

                    {showSuccess && (
                        <div className="p-4 bg-success/10 border border-success/20 rounded-2xl flex items-center gap-3 text-success text-sm font-bold animate-in zoom-in-95">
                            <span className="material-symbols-outlined">check_circle</span>
                            Perfil atualizado com sucesso!
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full h-14 bg-primary text-white font-black rounded-[20px] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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

                    <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
                        <button
                            onClick={onLogout}
                            className="w-full h-14 bg-white dark:bg-slate-800 text-danger border border-slate-200 dark:border-slate-700 font-bold rounded-[20px] transition-all flex items-center justify-center gap-3 active:bg-danger/5"
                        >
                            <span className="material-symbols-outlined">logout</span>
                            SAIR DO SISTEMA
                        </button>
                    </div>
                </div>
            </div>

            {/* Crop Modal */}
            {cropImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[40px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-6 text-center border-b border-slate-100 dark:border-slate-700">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Ajustar Foto</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Arraste para centralizar</p>
                        </div>

                        <div className="p-8">
                            <div
                                ref={containerRef}
                                className="aspect-square w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-inner relative cursor-move touch-none"
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
                                {/* Overlay circle to show visible area */}
                                <div className="absolute inset-0 border-4 border-primary rounded-full pointer-events-none opacity-50" />
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className="material-symbols-outlined text-slate-400 text-sm">zoom_out</span>
                                    <input
                                        type="range"
                                        min="1"
                                        max="3"
                                        step="0.01"
                                        value={zoom}
                                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                                        className="flex-1 accent-primary h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full appearance-none cursor-pointer"
                                    />
                                    <span className="material-symbols-outlined text-primary text-lg">zoom_in</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
                            <button
                                onClick={() => setCropImage(null)}
                                className="flex-1 h-12 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                CANCELAR
                            </button>
                            <button
                                onClick={handleCropSave}
                                className="flex-2 px-8 h-12 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
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

export default SellerProfileView;
