import React, { useEffect, useState } from 'react';
import { ViewState, TeamMember } from '../types';
import { DEFAULT_LOCATION } from '../constants';
import { supabase } from '../supabase';

interface GpsTrackingViewProps {
    team: TeamMember[];
    setView: (v: ViewState) => void;
}

const GpsTrackingView: React.FC<GpsTrackingViewProps> = ({
    team,
    setView,
}) => {
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

    // Filter team members with location
    const trackableTeam = team.filter(t =>
        t.status === 'ativo' && t.lastLocation
    );

    // Realtime location updates
    const [locations, setLocations] = useState<Record<string, { lat: number; lng: number; updatedAt: number }>>({});

    useEffect(() => {
        // Initialize with existing locations from team prop
        const initial: Record<string, { lat: number; lng: number; updatedAt: number }> = {};
        trackableTeam.forEach(t => {
            if (t.lastLocation) {
                initial[t.id] = {
                    lat: t.lastLocation.lat,
                    lng: t.lastLocation.lng,
                    updatedAt: t.lastLocation.updatedAt
                };
            }
        });
        setLocations(initial);

        // Subscribe to Realtime updates on profiles
        const channel = supabase
            .channel('public:profiles')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles'
            }, (payload) => {
                const updatedProfile = payload.new;
                if (updatedProfile.last_location) {
                    setLocations(prev => ({
                        ...prev,
                        [updatedProfile.id]: {
                            lat: updatedProfile.last_location.lat,
                            lng: updatedProfile.last_location.lng,
                            updatedAt: updatedProfile.last_location.updatedAt || Date.now()
                        }
                    }));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [trackableTeam]);

    const getRoleColor = (role: 'vendedor' | 'entregador') => {
        return role === 'vendedor' ? 'bg-primary' : 'bg-secondary';
    };

    const getTimeSince = (timestamp: number) => {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) return 'Agora';
        if (minutes < 60) return `${minutes}min atrás`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h atrás`;
    };

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="px-4 py-2">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView('dashboard')}
                        className="size-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h3 className="text-lg font-bold leading-tight">Mapa da Equipe</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {trackableTeam.length} membro(s) rastreável(is)
                        </p>
                    </div>
                </div>
            </div>

            {/* Map Container */}
            <div className="h-[450px] flex-shrink-0 relative mx-4 mt-4 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl">
                {/* Simulated Map Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCiSEZKVcCgEWwiT6reP0bpAvOu8QUFj8lzsKjdSTosHqLngjgISKph6G9_b7S1sf4Rbk7YegMwWjDtxnMoIF1nxhg73M2B5RvvK5WMw3OtpBl3ZoZcAT1Z-7g6pT1ySID57uDOc329kywSNNCZDImYdKzynDQaJU3bxyDnhUGrAhafWy1fPL84eRyVl4YTBgvTjQd42Y0EzF24ZAogGLgu_QuRbFTq2cLD4ilg6FrM5xd98yvQ0QaS7A8P-jgBbpK86ipqHJbN6qw')`
                    }}
                />
                <div className="absolute inset-0 bg-slate-900/10" />

                {/* Markers */}
                {trackableTeam.map((member, idx) => {
                    const loc = locations[member.id];
                    if (!loc) return null;

                    // Convert lat/lng to % position (simplified)
                    const centerLat = DEFAULT_LOCATION.lat;
                    const centerLng = DEFAULT_LOCATION.lng;
                    const scale = 1200;

                    const x = 50 + (loc.lng - centerLng) * scale;
                    const y = 50 - (loc.lat - centerLat) * scale;

                    return (
                        <button
                            key={member.id}
                            onClick={() => setSelectedMember(member)}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
                            style={{
                                left: `${Math.max(15, Math.min(85, x))}%`,
                                top: `${Math.max(15, Math.min(85, y))}%`,
                                transition: 'all 2s ease-in-out'
                            }}
                        >
                            <div className={`relative`}>
                                {/* Pulse animation */}
                                <div className={`absolute inset-0 ${getRoleColor(member.role)} rounded-full animate-ping opacity-30`} />

                                {/* Marker */}
                                <div className={`relative size-10 ${getRoleColor(member.role)} rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white`}>
                                    <span className="material-symbols-outlined text-lg">
                                        {member.role === 'vendedor' ? 'storefront' : 'local_shipping'}
                                    </span>
                                </div>

                                {/* Name tag */}
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                    <span className="px-2 py-0.5 bg-white dark:bg-slate-800 rounded-full text-[10px] font-bold shadow-sm">
                                        {member.name.split(' ')[0]}
                                    </span>
                                </div>
                            </div>
                        </button>
                    );
                })}

                {/* Legend */}
                <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm rounded-xl p-3 shadow-lg">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <div className="size-3 rounded-full bg-primary" />
                            <span className="text-[10px] font-medium">Vendedores</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="size-3 rounded-full bg-secondary" />
                            <span className="text-[10px] font-medium">Entregadores</span>
                        </div>
                    </div>
                </div>

                {/* Center Button */}
                <button className="absolute bottom-4 right-4 size-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700">
                    <span className="material-symbols-outlined text-primary">my_location</span>
                </button>
            </div>

            {/* Team List */}
            <div className="p-4 space-y-2 pb-32">
                <h4 className="font-bold text-sm text-slate-500">EQUIPE ATIVA</h4>
                {trackableTeam.map(member => (
                    <button
                        key={member.id}
                        onClick={() => setSelectedMember(member)}
                        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${selectedMember?.id === member.id
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700'
                            }`}
                    >
                        {member.avatar ? (
                            <img src={member.avatar} alt="" className="size-10 rounded-xl object-cover" />
                        ) : (
                            <div className={`size-10 rounded-xl ${getRoleColor(member.role)} flex items-center justify-center text-white`}>
                                <span className="material-symbols-outlined">
                                    {member.role === 'vendedor' ? 'storefront' : 'local_shipping'}
                                </span>
                            </div>
                        )}
                        <div className="flex-1 text-left">
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-slate-500 capitalize">{member.role}</p>
                        </div>
                        {member.lastLocation && (
                            <div className="text-right">
                                <span className="text-[10px] text-slate-400">
                                    {getTimeSince(member.lastLocation.updatedAt)}
                                </span>
                            </div>
                        )}
                    </button>
                ))}

                {trackableTeam.length === 0 && (
                    <div className="text-center py-8">
                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">location_off</span>
                        <p className="text-slate-500">Nenhum membro com GPS ativo</p>
                    </div>
                )}
            </div>

            {/* Member Detail Modal */}
            {selectedMember && (
                <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto px-4 z-50 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-4">
                            {selectedMember.avatar ? (
                                <img src={selectedMember.avatar} alt="" className="size-14 rounded-xl object-cover" />
                            ) : (
                                <div className={`size-14 rounded-xl ${getRoleColor(selectedMember.role)} flex items-center justify-center text-white`}>
                                    <span className="material-symbols-outlined text-2xl">
                                        {selectedMember.role === 'vendedor' ? 'storefront' : 'local_shipping'}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1">
                                <p className="font-bold">{selectedMember.name}</p>
                                <p className="text-sm text-slate-500 capitalize">{selectedMember.role}</p>
                                <p className="text-xs text-slate-400">{selectedMember.phone}</p>
                            </div>
                            <button
                                onClick={() => setSelectedMember(null)}
                                className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button className="flex-1 py-2.5 rounded-xl bg-primary/10 text-primary font-medium flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-lg">call</span>
                                Ligar
                            </button>
                            <button className="flex-1 py-2.5 rounded-xl bg-success/10 text-success font-medium flex items-center justify-center gap-1">
                                <span className="material-symbols-outlined text-lg">chat</span>
                                WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GpsTrackingView;
