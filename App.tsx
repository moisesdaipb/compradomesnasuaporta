import React, { useState, useEffect, useCallback } from 'react';
import {
  ViewState,
  AppData,
  UserSession,
  Sale,
  SaleItem,
  PaymentMethod,
  Customer,
  BasketModel,
  Installment,
  InstallmentStatus,
  Delivery,
  DeliveryStatus,
  TeamMember,
  DailyClosing,
  ClosingStatus,
  StockEntry,
  OrderStatus,
  StockItem,
  UserRole,
  SaleGoal,
  AppSettings,
} from './types';
import {
  loadData,
  saveData,
  resetData,
  loadSession,
  saveSession,
  clearSession,
  generateId,
  updateStock,
  getStockQuantity,
  fetchBasketModels,
  fetchCustomers,
  fetchTeamMembers,
  fetchSales,
  fetchDeliveries,
  fetchDailyClosings,
  upsertCustomer,
  updateDeliveryStatus as updateDeliveryStatusInDb,
  updateSaleStatus,
  createSaleInDb,
  updateCompleteSale,
  payInstallment,
  upsertBasketModel,
  updateProfileStatus,
  updateProfile,
  createDailyClosing,
  assignDelivery,
  addStockEntry,
  fetchStockEntries,
  fetchStockSummary,
  deleteStockEntry,
  deleteBasketModel,
  uploadBasketImage,
  upsertTeamMember,
  deleteTeamMember,
  fetchAllProfiles,
  updateUserRole,
  fetchInstallments,
  fetchGoals,
  upsertGoals,
  clearGoals,
  fetchSettings,
  updateSettings,
  checkProfileConflict,
  upsertCustomerProfile,
  fetchLoginLogs,
} from './store';
import { supabase } from './supabase';
import { formatCurrency, validateCPF, isValidEmail } from './utils';
import Layout from './components/Layout';

// Views
import LoginView from './views/LoginView';
import Dashboard from './views/Dashboard';
import TeamView from './views/TeamView';
import StockView from './views/StockView';
import StockEntryView from './views/StockEntryView';
import BasketModelsView from './views/BasketModelsView';
import CustomerStoreView from './views/CustomerStoreView';
import CustomerCartView from './views/CustomerCartView';
import CustomerCheckoutView from './views/CustomerCheckoutView';
import CustomerOrdersView from './views/CustomerOrdersView';
import ManagerSalesView from './views/ManagerSalesView';
import CustomerRegisterView from './views/CustomerRegisterView';
import PresentialSaleView from './views/PresentialSaleView';
import InstallmentsView from './views/InstallmentsView';
import DailyClosingView from './views/DailyClosingView';
import ClosingApprovalView from './views/ClosingApprovalView';
import DeliveriesView from './views/DeliveriesView';
import GpsTrackingView from './views/GpsTrackingView';
import SellerManagementView from './views/SellerManagementView';
import SellerProfileView from './views/SellerProfileView';
import CustomerProfileView from './views/CustomerProfileView';
import UsersManagementView from './views/UsersManagementView';
import SettingsView from './views/SettingsView';
import AppConfigView from './views/AppConfigView';
import AnalyticsView from './views/AnalyticsView';
import ManagerCustomersView from './views/ManagerCustomersView';

interface AppState extends AppData {
  allUsers: any[];
}

const App: React.FC = () => {
  // Auth State
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Global Error Handler for debugging
  useEffect(() => {
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('[CRITICAL ERROR]', { message, source, lineno, colno, error });
      const errorDiv = document.createElement('div');
      errorDiv.style.position = 'fixed';
      errorDiv.style.top = '0';
      errorDiv.style.left = '0';
      errorDiv.style.width = '100vw';
      errorDiv.style.height = '100vh';
      errorDiv.style.background = '#0f172a';
      errorDiv.style.color = 'white';
      errorDiv.style.padding = '40px';
      errorDiv.style.zIndex = '99999';
      errorDiv.style.fontFamily = 'monospace';
      errorDiv.style.overflow = 'auto';
      errorDiv.innerHTML = `
        <h1 style="color: #ef4444; font-size: 24px;">❌ Erro Detectado</h1>
        <p style="margin: 20px 0; color: #94a3b8;">Um erro impediu o carregamento do sistema:</p>
        <div style="background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155;">
          <code style="color: #fda4af;">${message}</code>
          <p style="font-size: 12px; margin-top: 10px; color: #64748b;">Arquivo: ${source}:${lineno}:${colno}</p>
        </div>
        <button onclick="localStorage.clear(); window.location.reload();" style="margin-top: 30px; background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer;">
          Limpar Tudo e Tentar Novamente
        </button>
      `;
      document.body.appendChild(errorDiv);
    };
  }, []);

  // View State
  const [view, setView] = useState<ViewState>('dashboard');

  console.log('[App] State:', { isLoaded, sessionEmail: session?.email, view });
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>('login');

  // App Data - Initialize settings from localStorage for instant branding
  const [appData, setAppData] = useState<AppState>(() => {
    const local = loadData();
    return {
      basketModels: [],
      stockEntries: [],
      stock: [],
      customers: [],
      sales: [],
      installments: [],
      deliveries: [],
      team: [],
      dailyClosings: [],
      goals: [],
      settings: local.settings || { appName: 'Cesta Básica Na Sua Casa' },
      allUsers: [],
      loginLogs: [],
    };
  });

  // Cart (for customer online sales)
  const [cart, setCart] = useState<SaleItem[]>([]);

  // Selected customer for presential sale
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Loading Status for UI feedback
  const [loadingStatus, setLoadingStatus] = useState<string>('Inicializando...');
  const isRefreshingRef = React.useRef(false);
  const refreshTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const refreshAbortRef = React.useRef<AbortController | null>(null);
  const sessionRef = React.useRef<UserSession | null>(session);

  // Sync ref with state
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Load Initial Data from Supabase
  const refreshData = useCallback(async (isBackground = false) => {
    // If foreground refresh requested, cancel any background refresh in progress
    if (!isBackground && isRefreshingRef.current && refreshAbortRef.current) {
      console.log('[App] refreshData: Cancelling background refresh for a new foreground request');
      refreshAbortRef.current.abort();
      isRefreshingRef.current = false;
    }

    if (isRefreshingRef.current) {
      console.log('[App] refreshData skipped: already in progress');
      return;
    }

    // Cancel any pending scheduled refresh
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    // Create abort controller for this refresh cycle
    const abortController = new AbortController();
    refreshAbortRef.current = abortController;

    console.log(`[App] refreshData started (${isBackground ? 'background' : 'foreground'})`);
    isRefreshingRef.current = true;
    if (!isBackground) setLoadingStatus('Carregando dados do servidor...');
    try {
      const fetchStart = Date.now();
      const currentSession = sessionRef.current;
      const role = currentSession?.role;

      console.log(`[App] refreshData: fetching for role ${role || 'guest'}`);

      // Optimization: Conditional fetching based on role
      const isManager = role === 'gerente' || role === 'vendedor';
      const isDriver = role === 'entregador';

      const results = await Promise.all([
        fetchBasketModels().catch(err => { console.error('fetchBasketModels failed:', err); return []; }),
        fetchCustomers().catch(err => { console.error('fetchCustomers failed:', err); return []; }),
        // Role-restricted fetches
        (isManager ? fetchTeamMembers() : Promise.resolve([])).catch(err => { console.error('fetchTeamMembers failed:', err); return []; }),
        fetchSales().catch(err => { console.error('fetchSales failed:', err); return []; }),
        fetchDeliveries().catch(err => { console.error('fetchDeliveries failed:', err); return []; }),
        (isManager ? fetchDailyClosings() : Promise.resolve([])).catch(err => { console.error('fetchDailyClosings failed:', err); return []; }),
        (isManager ? fetchStockEntries() : Promise.resolve([])).catch(err => { console.error('fetchStockEntries failed:', err); return []; }),
        fetchStockSummary().catch(err => { console.error('fetchStockSummary failed:', err); return []; }),
        (isManager ? fetchAllProfiles() : Promise.resolve([])).catch(err => { console.error('fetchAllProfiles failed:', err); return []; }),
        fetchInstallments().catch(err => { console.error('fetchInstallments failed:', err); return []; }),
        (isManager ? fetchGoals() : Promise.resolve([])).catch(err => { console.error('fetchGoals failed:', err); return []; }),
        fetchSettings().catch(err => { console.error('fetchSettings failed:', err); return { appName: 'Cesta Básica Na Sua Casa' }; }),
        (isManager ? fetchLoginLogs() : Promise.resolve([])).catch(err => { console.error('fetchLoginLogs failed:', err); return []; }),
      ]);

      // If aborted while fetching, don't update state
      if (abortController.signal.aborted) {
        console.log('[App] refreshData was aborted, discarding results');
        return;
      }

      const [baskets, customers, team, sales, deliveries, closings, stockEntries, stockSummary, allUsers, installments, goals, settings, loginLogs] = results;
      console.log(`[App] Data fetched in ${Date.now() - fetchStart}ms`);

      setAppData(prev => {
        const stockMap = new Map<string, number>();
        (stockSummary || []).forEach((s: any) => {
          if (s.basketModelId) stockMap.set(s.basketModelId, s.quantity);
        });

        const calculatedStock = baskets.map(b => {
          const summaryQty = stockMap.get(b.id);
          if (summaryQty !== undefined) {
            return { basketModelId: b.id, quantity: summaryQty };
          }
          const entriesSum = stockEntries
            .filter(e => e.basketModelId === b.id)
            .reduce((acc, e) => acc + e.quantity, 0);
          const salesSum = sales
            .filter(s => s.status !== OrderStatus.CANCELLED)
            .reduce((acc, s) => {
              const items = s.items || [];
              const item = items.find(i => i.basketModelId === b.id);
              return acc + (item?.quantity || 0);
            }, 0);
          return { basketModelId: b.id, quantity: entriesSum - salesSum };
        });

        return {
          ...prev,
          basketModels: baskets,
          customers,
          team,
          sales,
          deliveries,
          dailyClosings: closings,
          stockEntries,
          allUsers,
          installments,
          stock: calculatedStock,
          goals,
          settings,
          loginLogs,
        };
      });
    } catch (error: any) {
      if (!abortController.signal.aborted) {
        console.error('[App] Error in refreshData:', error);
      }
    } finally {
      console.log('[App] refreshData finished');
      isRefreshingRef.current = false;
      refreshAbortRef.current = null;
    }
  }, []); // Reverted to empty array as we use sessionRef now

  // Cancel any in-flight refresh (frees browser connections for save operations)
  const cancelRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (refreshAbortRef.current) {
      console.log('[App] Cancelling in-flight refresh to free connections');
      refreshAbortRef.current.abort();
      refreshAbortRef.current = null;
      isRefreshingRef.current = false;
    }
  }, []);

  // Throttled Refresh Trigger
  const triggerRefresh = useCallback((delay = 1000) => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      refreshData(true);
    }, delay);
  }, [refreshData]);

  // Real-time Subscription Setup
  useEffect(() => {
    if (!session) return;

    console.log('[App] Setting up Real-time subscriptions...');

    const channel = supabase.channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries' },
        (payload) => {
          console.log('[App] Real-time delivery update received:', payload);
          triggerRefresh(500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        (payload) => {
          console.log('[App] Real-time sale update received:', payload);
          triggerRefresh(500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_closings' },
        () => {
          console.log('[App] Real-time daily_closings update received');
          triggerRefresh(500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'installments' },
        () => {
          console.log('[App] Real-time installments update received');
          triggerRefresh(500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_entries' },
        () => {
          console.log('[App] Real-time stock_entries update received');
          triggerRefresh(500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'basket_models' },
        () => {
          console.log('[App] Real-time basket_models update received');
          triggerRefresh(500);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('[App] Real-time profiles update received');
          triggerRefresh(500);
        }
      )
      .subscribe((status) => {
        console.log('[App] Subscription status:', status);
      });

    // Navigation and Focus Synchronization
    const onFocus = () => {
      console.log('[App] Window focused, refreshing data...');
      refreshData(true);
    };

    window.addEventListener('focus', onFocus);

    return () => {
      console.log('[App] Cleaning up subscriptions...');
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
    };
  }, [session, triggerRefresh, refreshData]);

  // View Change Trigger - Sync data on navigation
  useEffect(() => {
    if (session) {
      console.log('[App] View changed to:', view, '- triggering background refresh');
      triggerRefresh(300);
    }
  }, [view, session, triggerRefresh]);

  // Auth Handlers - State cleanup
  const clearAppState = useCallback(() => {
    console.log('Cleaning up app state...');
    clearSession();
    setSession(null);
    setCart([]);
    setSelectedCustomer(null);
    setView('login');
  }, []);

  const handleLogin = useCallback((userSession: UserSession) => {
    console.log('[App] handleLogin triggered for:', userSession.email, 'Role:', userSession.role);
    setSession(userSession);
    saveSession(userSession);

    console.log('[App] Setting view for role:', userSession.role);
    switch (userSession.role) {
      case 'cliente':
        setView('customer-store');
        break;
      case 'entregador':
        setView('deliveries');
        break;
      case 'vendedor':
        setView('dashboard');
        break;
      case 'gerente':
        setView('dashboard');
        break;
      default:
        console.warn('[App] Unknown role, defaulting to dashboard:', userSession.role);
        setView('dashboard');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    console.log('handleLogout manual trigger');
    // Optimistic logout: Clear state immediately
    clearAppState();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Error during signOut:', e);
    }
  }, [clearAppState]);

  // Initialize
  useEffect(() => {
    const recordLogin = async (userId: string, email: string) => {
      // Prevent redundant recording in the same session/tab
      const hasRecorded = sessionStorage.getItem(`login_recorded_${userId}`);
      if (hasRecorded) {
        console.log('[App] Login already recorded for this session:', email);
        return;
      }

      console.log('[App] Recording login for:', email);
      try {
        const now = new Date().toISOString();

        // Update profile last_login_at
        await supabase
          .from('profiles')
          .update({ last_login_at: now })
          .eq('id', userId);

        // Insert login log
        await supabase
          .from('login_logs')
          .insert({
            user_id: userId,
            email: email,
            user_agent: navigator.userAgent
          });

        sessionStorage.setItem(`login_recorded_${userId}`, 'true');
        console.log('[App] Login recorded successfully');
      } catch (e) {
        console.error('[App] Failed to record login:', e);
      }
    };

    const fetchProfile = async (userId: string, userToLink?: any): Promise<any> => {
      console.log('Fetching profile for:', userId);
      try {
        // Use a timeout for fetchProfile to prevent hangs
        const fetchPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), 45000)
        );

        const { data: profile, error: fetchError } = await Promise.race([fetchPromise, timeoutPromise]) as any;

        if (fetchError) {
          console.error('Error fetching profile:', fetchError);
          return null;
        }

        if (profile) {
          console.log('Profile found:', profile);
          return profile;
        }

        console.log('Profile not found, searching by email to link...');
        const user = userToLink || (await supabase.auth.getUser()).data.user;
        if (!user) return null;

        // Try to find if it was pre-registered in Team section
        const { data: existingByEmail } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (existingByEmail) {
          console.log('Found pre-registered profile, linking ID...');
          const { data: linkedProfile, error: linkError } = await supabase
            .from('profiles')
            .update({ id: user.id })
            .eq('id', existingByEmail.id)
            .select()
            .single();

          if (!linkError) return linkedProfile;
          console.error('Failed to link profile ID:', linkError);
        }

        console.log('Creating new profile...');
        const { data: newProfile, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuário',
            email: user.email,
            role: 'cliente',
            status: 'ativo'
          })
          .select()
          .maybeSingle();

        if (upsertError) {
          console.error('Failed to upsert profile:', upsertError);
          return null;
        }

        console.log('Successfully created/retrieved profile:', newProfile);
        return newProfile;
      } catch (e: any) {
        console.error('Critical failure in fetchProfile:', {
          message: e?.message,
          stack: e?.stack,
          error: e
        });
        return null;
      }
    };

    const initializeAuth = async () => {
      console.log('[App] initializeAuth started');
      try {
        const sessionStart = Date.now();
        // Increased timeout to 15s to handle database wake-up or slow connections
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('getSession timeout')), 15000));

        const { data: { session: supabaseSession } } = await Promise.race([sessionPromise, timeoutPromise]) as any;
        console.log(`[App] getSession took ${Date.now() - sessionStart}ms`);

        if (supabaseSession) {
          console.log('[App] Session detected:', supabaseSession.user.email);
          const profile = await fetchProfile(supabaseSession.user.id, supabaseSession.user);
          if (profile) {
            handleLogin({
              id: profile.id,
              name: profile.name,
              email: profile.email || '',
              role: profile.role,
              avatar: profile.avatar,
              provider: supabaseSession.user.app_metadata.provider,
              access_token: supabaseSession.access_token
            });
            triggerRefresh(500);
            // Record login in background
            recordLogin(profile.id, profile.email || supabaseSession.user.email || '');
          } else {
            console.warn('Authenticated but no profile could be loaded/created.');
          }
        } else {
          console.log('[App] No session, checking legacy stored session');
          const storedSession = loadSession();
          if (storedSession) {
            setSession(storedSession);
            triggerRefresh(500);
          }
        }
      } catch (e) {
        console.error('[App] Error during initializeAuth:', e);
      } finally {
        console.log('[App] initializeAuth finished, setting isLoaded=true');
        setIsLoaded(true);
      }
    };

    const safetyTimeout = setTimeout(() => {
      console.warn('[App] Safety timeout: forcing isLoaded=true');
      setIsLoaded(true);
    }, 15000); // 15s safety for low-spec devices/network

    initializeAuth().then(() => clearTimeout(safetyTimeout));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      console.log('[App] Auth event change:', event, supabaseSession?.user?.email);

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[App] Auth event: PASSWORD_RECOVERY detected');
        setAuthInitialMode('reset-password');
        setView('login');
      } else if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && supabaseSession) {
        // Prevent race condition: check if we already have this user logged in
        // FIX: Use loadSession() helper to avoid key mismatch
        const currentSession = loadSession();
        if (currentSession && currentSession.id === supabaseSession.user.id) {
          console.log('[App] Auth event: user already logged in locally, checking token update...');
          // If just a token update, we might want to update the session state but NOT fetch profile again
          if (currentSession.access_token !== supabaseSession.access_token) {
            console.log('[App] Updating access token only');
            const updatedSession = { ...currentSession, access_token: supabaseSession.access_token };
            setSession(updatedSession);
            saveSession(updatedSession);
          }
          return;
        }

        console.log('[App] Loading profile for event:', event);
        const profile = await fetchProfile(supabaseSession.user.id, supabaseSession.user);
        if (profile) {
          const newSession: UserSession = {
            id: profile.id,
            name: profile.name,
            email: profile.email || '',
            role: profile.role,
            avatar: profile.avatar,
            provider: supabaseSession.user.app_metadata.provider,
            access_token: supabaseSession.access_token
          };

          // Final check before calling handleLogin
          // FIX: Use loadSession() helper to avoid key mismatch
          const freshSession = loadSession();
          if (freshSession && freshSession.id === profile.id) {
            console.log('[App] Auth event: race condition avoided, user logged in during fetch.');
            return;
          }

          console.log('[App] Auth event: new login, calling handleLogin');
          handleLogin(newSession);

          triggerRefresh(500);
          // Record login only on SIGNED_IN to avoid infinite loop on profile updates
          if (event === 'SIGNED_IN') {
            recordLogin(profile.id, profile.email || supabaseSession.user.email || '');
          }
        } else {
          console.error('[App] Failed to load/create profile during auth event:', event);
        }
      } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        if (event === 'SIGNED_OUT') {
          console.log('[App] User signed out event detected.');
          clearAppState();
        }
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount — handleLogin and triggerRefresh are stable via useCallback



  // Team Handlers (Note: Real registration should happen via Auth)
  const handleAddTeamMember = useCallback(async (member: Omit<TeamMember, 'id' | 'salesCount' | 'deliveriesCount'>) => {
    try {
      if (member.cpf && !validateCPF(member.cpf)) {
        throw new Error('CPF inválido. Verifique os dígitos.');
      }

      if (member.email && !isValidEmail(member.email)) {
        throw new Error('Email inválido. Verifique o formato (ex: nome@email.com).');
      }

      console.log('[App] handleAddTeamMember starting...', member.email);

      const newMember = await upsertTeamMember({
        ...member,
        status: 'pendente',
        startDate: Date.now(),
      }, session?.access_token);

      if (newMember) {
        setAppData(prev => {
          // Avoid duplicates if real-time or double-click happens
          const exists = prev.team.some(m => m.id === newMember.id);
          if (exists) return prev;

          return {
            ...prev,
            team: [...prev.team, {
              ...newMember,
              salesCount: 0,
              deliveriesCount: 0
            }]
          };
        });

        // Final refresh to ensure everything is in sync
        triggerRefresh();
      }
    } catch (error: any) {
      console.error('[App] handleAddTeamMember Error:', error);
      alert(error.message || 'Erro ao adicionar membro da equipe. Verifique os dados.');
      // Re-trigger refresh to ensure UI is not stuck
      triggerRefresh();
      throw error;
    }
  }, [triggerRefresh]);

  const handleUpdateTeamMember = useCallback(async (id: string, updates: Partial<TeamMember>) => {
    try {
      if (updates.cpf && !validateCPF(updates.cpf)) {
        throw new Error('CPF inválido. Verifique os dígitos.');
      }

      if (updates.email && !isValidEmail(updates.email)) {
        throw new Error('Email inválido. Verifique o formato (ex: nome@email.com).');
      }

      console.log('Updating team member:', id, updates);
      await upsertTeamMember({ id, ...updates }, session?.access_token);
      triggerRefresh(100);
    } catch (error) {
      console.error('Error updating team member:', error);
      alert('Erro ao atualizar membro da equipe: ' + (error instanceof Error ? error.message : 'Verifique os dados.'));
      throw error;
    }
  }, [triggerRefresh]);

  const handleToggleTeamStatus = useCallback(async (id: string) => {
    try {
      const member = appData.team.find(m => m.id === id);
      if (member) {
        await updateProfileStatus(id, member.status === 'ativo' ? 'inativo' : 'ativo');
        triggerRefresh(100);
      }
    } catch (error) {
      console.error('Error toggling team status:', error);
    }
  }, [appData.team, triggerRefresh]);

  const handleDeleteTeamMember = useCallback(async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este membro permanentemente? Esta ação não pode ser desfeita.')) return;

    try {
      await deleteTeamMember(id);

      // Update local state
      setAppData(prev => ({
        ...prev,
        team: prev.team.filter(m => m.id !== id)
      }));

      // Also optionally refresh to be sure
      // triggerRefresh(100); 
    } catch (error: any) {
      console.error('Error deleting team member:', error);
      if (error.code === '23503') {
        alert('Não é possível excluir este membro pois ele já possui vendas, entregas ou registros vinculados. Tente DESATIVAR o colaborador ao invés de excluir.');
      } else {
        alert('Erro ao excluir membro da equipe.');
      }
    }
  }, []); // No dependencies needed for deleteTeamMember as it is imported

  // Basket Model Handlers
  const refreshBasketModelsOnly = useCallback(async () => {
    try {
      const baskets = await fetchBasketModels();
      setAppData(prev => ({ ...prev, basketModels: baskets }));
    } catch (e) {
      console.error('[App] refreshBasketModelsOnly failed:', e);
    }
  }, []);

  const handleAddBasketModel = useCallback(async (model: Omit<BasketModel, 'id' | 'createdAt'>) => {
    console.log('[App] handleAddBasketModel started');
    cancelRefresh();
    await upsertBasketModel(model);
    await refreshBasketModelsOnly();
  }, [refreshBasketModelsOnly, cancelRefresh]);

  const handleUpdateBasketModel = useCallback(async (id: string, updates: Partial<BasketModel>) => {
    console.log('[App] handleUpdateBasketModel for ID:', id);
    cancelRefresh();
    await upsertBasketModel({ id, ...updates });
    await refreshBasketModelsOnly();
  }, [refreshBasketModelsOnly, cancelRefresh]);

  const handleToggleBasketModel = useCallback(async (id: string) => {
    const model = appData.basketModels.find(m => m.id === id);
    if (!model) return;
    cancelRefresh();
    await upsertBasketModel({ id, active: !model.active });
    setTimeout(() => refreshBasketModelsOnly(), 500);
  }, [appData.basketModels, refreshBasketModelsOnly, cancelRefresh]);

  const handleDeleteBasketModel = useCallback(async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este modelo de cesta? Isso só funcionará se não houver vendas ou movimentações vinculadas.')) return;
    try {
      cancelRefresh();
      await deleteBasketModel(id);
      await refreshBasketModelsOnly();
    } catch (error: any) {
      console.error('Error deleting basket model:', error);
      if (error.code === '23503') {
        alert('Não é possível excluir esta cesta pois ela já possui vendas ou movimentações registradas. Tente desativá-la em vez de excluir.');
      } else {
        alert('Erro ao excluir modelo de cesta.');
      }
    }
  }, [refreshBasketModelsOnly, cancelRefresh]);

  // Stock Handlers
  const handleAddStockEntry = useCallback(async (entry: Omit<StockEntry, 'id' | 'createdBy'>) => {
    try {
      await addStockEntry({
        basket_model_id: entry.basketModelId,
        quantity: entry.quantity,
        unit_cost: entry.unitCost,
        supplier: entry.supplier,
        notes: entry.notes,
        created_by: session?.id || null,
        received_at: new Date(entry.receivedAt).toISOString()
      });
      triggerRefresh(100);
      alert('Entrada de estoque realizada com sucesso!');
    } catch (error: any) {
      console.error('Error adding stock entry:', error);
      alert('Erro ao adicionar estoque: ' + (error.message || 'Erro desconhecido'));
    }
  }, [session, triggerRefresh]);

  const handleDeleteStockEntry = useCallback(async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta movimentação?')) return;
    try {
      await deleteStockEntry(id);
      triggerRefresh(100);
    } catch (error: any) {
      console.error('Error deleting stock entry:', error);
      alert('Erro ao excluir movimentação. Verifique se você tem permissão ou se o registro ainda existe.');
    }
  }, [triggerRefresh]);

  const handleDecreaseStock = useCallback(async (modelId: string, quantity: number, notes: string) => {
    if (!session) return;
    try {
      await addStockEntry({
        basket_model_id: modelId,
        quantity: -Math.abs(quantity),
        unit_cost: 0,
        supplier: 'Ajuste Manual',
        notes,
        created_by: session.id,
        received_at: new Date().toISOString()
      });
      triggerRefresh(100);
      alert('Estoque diminuído com sucesso!');
    } catch (error: any) {
      console.error('Error decreasing stock:', error);
      alert('Erro ao diminuir estoque: ' + (error.message || 'Erro desconhecido'));
    }
  }, [session, triggerRefresh]);

  // Customer Handlers
  const handleAddCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'createdAt' | 'createdBy'>): Promise<Customer> => {
    try {
      const newCustomerData = {
        ...customer,
        createdAt: Date.now(),
        createdBy: session?.id || null,
      };

      const created = await upsertCustomer(newCustomerData);

      // Optimistic update to sync immediately
      setAppData(prev => ({
        ...prev,
        customers: [created, ...prev.customers]
      }));

      triggerRefresh(100);
      return created;
    } catch (error) {
      console.error('Error adding customer:', error);
      throw error;
    }
  }, [session, triggerRefresh]);

  const handleUpdateSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await updateSettings(newSettings);
      setAppData(prev => ({ ...prev, settings: newSettings }));
    } catch (error) {
      console.error('[handleUpdateSettings] Error:', error);
      throw error;
    }
  }, []);

  const handleUpdateProfile = useCallback(async (updates: Partial<Customer> & { avatar?: string }) => {
    if (!session) return;
    const start = Date.now();
    console.log('[App] handleUpdateProfile starting...', updates);

    // Cancel pending refreshes to prioritize this update
    cancelRefresh();

    try {
      // 1. Token Refresh/Check
      let currentToken = session.access_token;
      try {
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        if (freshSession) currentToken = freshSession.access_token;
      } catch (e) {
        console.warn('[App] Token refresh skip:', e);
      }

      const cleanCPF = updates.cpf?.replace(/\D/g, '');

      // Resolve target customer ID
      const targetId = appData.customers.find(c => c.id === session.id)?.id ||
        (updates.email && appData.customers.find(c => c.email === updates.email)?.id) ||
        (cleanCPF && appData.customers.find(c => c.cpf?.replace(/\D/g, '') === cleanCPF)?.id) ||
        session.id;

      console.log(`[App] [${Date.now() - start}ms] RPC Invocation for ID: ${targetId}`);

      // 2. Main RPC Call
      await upsertCustomerProfile({
        id: targetId,
        name: updates.name || session.name,
        avatar: updates.avatar,
        ...updates
      }, currentToken);

      console.log(`[App] [${Date.now() - start}ms] RPC Success. Updating roles...`);

      // 3. Optional Team Member Promotion
      let updatedRole = session.role;
      if (cleanCPF) {
        const pendingMember = appData.team.find(m =>
          m.status === 'pendente' && m.cpf.replace(/\D/g, '') === cleanCPF
        );
        if (pendingMember) {
          console.log('[App] Promoting user to:', pendingMember.role);
          updatedRole = pendingMember.role;
          await updateProfile(session.id, { role: updatedRole, status: 'ativo' });
        }
      }

      // 4. State Update
      const updatedSession = { ...session, role: updatedRole };
      setSession(updatedSession);
      saveSession(updatedSession);

      setAppData(prev => {
        const existing = prev.customers.find(c => c.id === targetId);
        const nextCustomer: Customer = {
          id: targetId,
          name: updates.name || session.name,
          email: updates.email || session.email || '',
          phone: updates.phone || '',
          cpf: updates.cpf || '',
          createdAt: Date.now(),
          createdBy: session.id,
          ...updates
        };

        if (existing) {
          return {
            ...prev,
            customers: prev.customers.map(c => c.id === targetId ? { ...c, ...nextCustomer } : c)
          };
        }
        return { ...prev, customers: [...prev.customers, nextCustomer] };
      });

      console.log(`[App] [${Date.now() - start}ms] Local state synced. Refreshing...`);
      triggerRefresh(100);
    } catch (error) {
      console.error('[App] handleUpdateProfile error:', error);
      throw error;
    }
  }, [session, appData.customers, appData.team, triggerRefresh, cancelRefresh]);

  // Sale Handlers
  const handleCreateSale = useCallback(async (
    customerId: string,
    customerName: string,
    items: SaleItem[],
    paymentMethod: PaymentMethod,
    channel: 'online' | 'presencial',
    installmentsCount?: number,
    installmentDates?: number[],
    deliveryInfo?: {
      address: string;
      number: string;
      neighborhood?: string;
      city?: string;
      zipCode?: string;
      state?: string;
      complement?: string;
      contact: string;
      notes?: string
    },
    installmentAmounts?: number[],
    paymentSubMethod?: string,
    changeAmount?: number,
  ) => {
    const total = items.reduce((acc, i) => acc + (i.unitPrice * i.quantity), 0);

    const saleData = {
      customer_id: customerId,
      customer_name: customerName,
      seller_id: session?.role === 'vendedor' ? session.id : null,
      seller_name: session?.role === 'vendedor' ? session.name : null,
      total,
      payment_method: paymentMethod,
      payment_sub_method: paymentSubMethod,
      change_amount: changeAmount,
      channel,
      status: channel === 'online' ? OrderStatus.PENDING : OrderStatus.DELIVERED,
      installments_count: installmentsCount,
      delivery_address: deliveryInfo?.address,
      delivery_number: deliveryInfo?.number,
      delivery_contact: deliveryInfo?.contact,
      delivery_neighborhood: deliveryInfo?.neighborhood,
      delivery_city: deliveryInfo?.city,
      delivery_zip_code: deliveryInfo?.zipCode,
      delivery_state: deliveryInfo?.state,
      delivery_complement: deliveryInfo?.complement,
      delivery_notes: deliveryInfo?.notes,
    };

    const installments: any[] = [];
    if (paymentMethod === PaymentMethod.TERM && installmentsCount) {
      for (let i = 0; i < installmentsCount; i++) {
        const dueDate = installmentDates?.[i] || Date.now() + (i + 1) * 30 * 86400000;
        const amount = installmentAmounts?.[i] || (total / installmentsCount);
        installments.push({
          customer_id: customerId,
          customer_name: customerName,
          number: i + 1,
          total_installments: installmentsCount,
          amount: amount,
          due_date: new Date(dueDate).toISOString().split('T')[0],
          status: 'Pendente' // Explicitly set status to avoid NULL in DB
        });
      }
    }

    let delivery = null;
    if (channel === 'online') {
      delivery = {
        customer_id: customerId,
        customer_name: customerName,
        address: deliveryInfo?.address || (appData.customers.find(c => c.id === customerId)?.address || ''),
        address_number: deliveryInfo?.number || (appData.customers.find(c => c.id === customerId)?.addressNumber || ''),
        neighborhood: deliveryInfo?.neighborhood || (appData.customers.find(c => c.id === customerId)?.neighborhood || ''),
        city: deliveryInfo?.city || (appData.customers.find(c => c.id === customerId)?.city || ''),
        zip_code: deliveryInfo?.zipCode || (appData.customers.find(c => c.id === customerId)?.zipCode || ''),
        state: deliveryInfo?.state || (appData.customers.find(c => c.id === customerId)?.state || ''),
        complement: deliveryInfo?.complement || (appData.customers.find(c => c.id === customerId)?.complement || ''),
        phone: deliveryInfo?.contact || (appData.customers.find(c => c.id === customerId)?.phone || ''),
        notes: deliveryInfo?.notes,
        status: DeliveryStatus.PENDING,
      };
    }

    try {
      const start = Date.now();
      console.log(`[App] [${new Date().toISOString()}] handleCreateSale atomic starting...`);

      // PRIORITY: Cancel any background refresh to free up connections
      cancelRefresh();

      const createdSale = await createSaleInDb(saleData, items, installments, delivery);
      console.log(`[App] [${Date.now() - start}ms] handleCreateSale atomic success! Sale ID: ${createdSale?.id}`);

      // Optimistic update for sales list
      setAppData(prev => ({
        ...prev,
        sales: [createdSale, ...prev.sales]
      }));

      triggerRefresh(10); // Refresh faster
      console.log(`[App] [${Date.now() - start}ms] handleCreateSale finished (including state update)`);
      return createdSale;
    } catch (error: any) {
      console.error('[App] handleCreateSale error:', error);
      // Log more details if available
      if (error.code) console.error('[App] Error code:', error.code);
      if (error.message) console.error('[App] Error message:', error.message);
      if (error.details) console.error('[App] Error details:', error.details);
      if (error.hint) console.error('[App] Error hint:', error.hint);
      throw error;
    }
  }, [session, appData.customers, triggerRefresh]);

  const handleUpdateSale = useCallback(async (
    saleId: string,
    saleData: any,
    items: any[],
    installments: any[]
  ) => {
    try {
      setLoadingStatus('Salvando alterações...');
      await updateCompleteSale(saleId, saleData, items, installments);
      triggerRefresh(100);
    } catch (error: any) {
      console.error('[App] handleUpdateSale error:', error);
      alert('Erro ao atualizar venda: ' + error.message);
    } finally {
      setLoadingStatus('Sincronizado');
    }
  }, [triggerRefresh]);

  const handleUpdateInstallments = useCallback(async (
    saleId: string,
    installments: any[]
  ) => {
    try {
      setLoadingStatus('Atualizando parcelas...');
      // We use updateCompleteSale with only the installments. 
      // The RPC should be robust enough to handle partial updates or we pass existing sale data.
      const sale = appData.sales.find(s => s.id === saleId);
      if (!sale) throw new Error('Venda não encontrada');

      const saleData = {
        customer_id: sale.customerId,
        total: sale.total,
        payment_method: sale.paymentMethod,
        status: sale.status,
        notes: sale.notes
      };

      // Items must be in snake_case for the RPC
      const itemsToSave = (sale.items || []).map((i: any) => ({
        basket_model_id: i.basketModelId,
        basket_name: i.basketName,
        quantity: i.quantity,
        unit_price: i.unitPrice
      }));

      await updateCompleteSale(saleId, saleData, itemsToSave, installments);
      triggerRefresh(100);
    } catch (error: any) {
      console.error('[App] handleUpdateInstallments error:', error);
      alert('Erro ao atualizar parcelas: ' + error.message);
    } finally {
      setLoadingStatus('Sincronizado');
    }
  }, [appData.sales, triggerRefresh]);

  const handleCancelOrder = useCallback(async (saleId: string, status: OrderStatus = OrderStatus.CANCELLED) => {
    try {
      console.log('[App] handleCancelOrder started for:', saleId, 'with status:', status);

      // Optimistic update
      setAppData(prev => ({
        ...prev,
        sales: prev.sales.map(s => s.id === saleId ? { ...s, status } : s)
      }));

      await updateSaleStatus(saleId, status);
      triggerRefresh(500); // Slightly longer delay to allow DB to settle
      console.log('[App] handleCancelOrder success');
    } catch (error) {
      console.error('[App] Error cancelling order:', error);
      // Revert optimistic update on error by triggering a fresh load
      triggerRefresh(10);
      alert('Não foi possível processar o cancelamento. Por favor, verifique se você tem permissão ou sua conexão.');
    }
  }, [triggerRefresh]);

  // Installment Handlers
  const handlePayInstallment = useCallback(async (id: string, paymentMethod: PaymentMethod) => {
    try {
      await payInstallment(id, paymentMethod);
      triggerRefresh(100);
    } catch (error) {
      console.error('Error paying installment:', error);
      alert('Erro ao registrar pagamento. Por favor, verifique sua conexão.');
    }
  }, [triggerRefresh]);

  const handleUpdateGoals = useCallback(async (goals: (Omit<SaleGoal, 'id' | 'updatedAt'> & { id?: string })[]) => {
    try {
      const updatedGoals = await upsertGoals(goals, session?.access_token);
      setAppData(prev => ({ ...prev, goals: updatedGoals }));
      triggerRefresh(100);
    } catch (error) {
      console.error('Error updating goals:', error);
      alert('Erro ao atualizar metas. Por favor, tente novamente.');
    }
  }, [session, triggerRefresh]);

  const handleClearGoals = useCallback(async () => {
    try {
      await clearGoals();
      setAppData(prev => ({ ...prev, goals: [] }));
      triggerRefresh(100);
    } catch (error) {
      console.error('Error clearing goals:', error);
      alert('Erro ao limpar metas.');
    }
  }, [triggerRefresh]);

  const handleUpdateCustomer = useCallback(async (customer: Partial<Customer>) => {
    try {
      setLoadingStatus('Salvando cliente...');
      await upsertCustomer(customer);
      triggerRefresh(100);
    } catch (error: any) {
      console.error('[App] handleUpdateCustomer error:', error);
      alert('Erro ao atualizar cliente: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoadingStatus('Sincronizado');
    }
  }, [triggerRefresh]);

  // Delivery Handlers
  const handleAssignDelivery = useCallback(async (deliveryId: string, driverId: string) => {
    try {
      await assignDelivery(deliveryId, driverId);

      // Optimistic/Immediate Sync Sale status locally
      const delivery = appData.deliveries.find(d => d.id === deliveryId);
      if (delivery && delivery.saleId) {
        const sale = appData.sales.find(s => s.id === delivery.saleId);
        if (sale && sale.status === OrderStatus.PENDING) {
          await updateSaleStatus(delivery.saleId, OrderStatus.CONFIRMED);

          setAppData(prev => ({
            ...prev,
            sales: prev.sales.map(s => s.id === delivery.saleId ? { ...s, status: OrderStatus.CONFIRMED } : s),
            deliveries: prev.deliveries.map(d => d.id === deliveryId ? { ...d, driverId, status: DeliveryStatus.ASSIGNED } : d)
          }));
        } else {
          // Even if sale not found or not pending, update delivery locally
          setAppData(prev => ({
            ...prev,
            deliveries: prev.deliveries.map(d => d.id === deliveryId ? { ...d, driverId, status: DeliveryStatus.ASSIGNED } : d)
          }));
        }
      }

      triggerRefresh(100);
    } catch (error) {
      console.error('Error assigning delivery:', error);
    }
  }, [appData.deliveries, appData.sales, triggerRefresh]);

  const handleUpdateDeliveryStatus = useCallback(async (id: string, status: DeliveryStatus, notes?: string) => {
    try {
      await updateDeliveryStatusInDb(id, status, notes);

      // Sync Sale status based on Delivery status
      const delivery = appData.deliveries.find(d => d.id === id);
      if (delivery && delivery.saleId) {
        let newSaleStatus: OrderStatus | null = null;
        if (status === DeliveryStatus.DELIVERED) {
          newSaleStatus = OrderStatus.DELIVERED;
        } else if (status === DeliveryStatus.IN_ROUTE) {
          newSaleStatus = OrderStatus.IN_DELIVERY;
        }

        if (newSaleStatus) {
          await updateSaleStatus(delivery.saleId, newSaleStatus);

          setAppData(prev => ({
            ...prev,
            sales: prev.sales.map(s => s.id === delivery.saleId ? { ...s, status: newSaleStatus! } : s),
            deliveries: prev.deliveries.map(d => d.id === id ? { ...d, status, notes: notes !== undefined ? notes : d.notes } : d)
          }));
        } else {
          // Just update delivery locally
          setAppData(prev => ({
            ...prev,
            deliveries: prev.deliveries.map(d => d.id === id ? { ...d, status, notes: notes !== undefined ? notes : d.notes } : d)
          }));
        }
      }

      triggerRefresh(100);
    } catch (error) {
      console.error('Error updating delivery status:', error);
    }
  }, [appData.deliveries, triggerRefresh]);

  // Daily Closing Handlers
  const handleCreateClosing = useCallback(async (closing: DailyClosing) => {
    try {
      await createDailyClosing({
        ...closing,
        closingDate: closing.closingDate, // Keep original timestamp if needed, but store splits it anyway
      });
      triggerRefresh(500);
    } catch (error) {
      console.error('Error creating daily closing:', error);
      alert('Erro ao criar fechamento: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  }, [triggerRefresh]);

  const handleApproveClosing = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('daily_closings')
        .update({
          status: ClosingStatus.APPROVED,
          approved_by: session?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      triggerRefresh(100);
    } catch (error) {
      console.error('Error approving closing:', error);
    }
  }, [session, triggerRefresh]);

  const handleRejectClosing = useCallback(async (id: string, reason: string) => {
    try {
      const { error } = await supabase
        .from('daily_closings')
        .update({
          status: ClosingStatus.REJECTED,
          notes: reason
        })
        .eq('id', id);

      if (error) throw error;
      triggerRefresh(100);
    } catch (error) {
      console.error('Error rejecting closing:', error);
    }
  }, [triggerRefresh]);

  // Cart Handlers
  const handleAddToCart = useCallback((modelId: string, quantity: number = 1) => {
    const model = appData.basketModels.find(m => m.id === modelId);
    if (!model) return;

    const existing = cart.find(i => i.basketModelId === modelId);
    if (existing) {
      setCart(cart.map(i =>
        i.basketModelId === modelId ? { ...i, quantity: i.quantity + quantity } : i
      ));
    } else {
      setCart([...cart, {
        basketModelId: modelId,
        basketName: model.name,
        quantity,
        unitPrice: model.price,
      }]);
    }
  }, [cart, appData.basketModels]);

  const handleUpdateCartQuantity = useCallback((modelId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(i => i.basketModelId !== modelId));
    } else {
      setCart(cart.map(i =>
        i.basketModelId === modelId ? { ...i, quantity } : i
      ));
    }
  }, [cart]);

  const handleClearCart = useCallback(() => {
    setCart([]);
  }, []);

  const handleUpdateUserRole = useCallback(async (userId: string, role: UserRole) => {
    try {
      await updateUserRole(userId, role);
      triggerRefresh(100);
    } catch (e) {
      console.error('Error updating user role:', e);
      throw e;
    }
  }, [triggerRefresh]);

  // Computed Values
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);

  // Get customer for online checkout
  const getCustomerForCheckout = (): Customer | null => {
    if (!session) return null;
    return appData.customers.find(c =>
      c.id === session.id ||
      (c.email && c.email === session.email && c.email !== 'Endereço não cadastrado')
    ) || {
      id: session.id,
      name: session.name,
      cpf: '',
      phone: '',
      address: 'Endereço não cadastrado',
      city: '',
      neighborhood: '',
      createdAt: Date.now(),
      createdBy: session.id,
    };
  };

  // Render
  if (!isLoaded) {
    const loadingSettings = appData.settings;
    const loadingLogoType = loadingSettings?.logoType || 'icon';
    const loadingAppLogo = loadingSettings?.appLogo || 'shopping_basket';
    const loadingAppName = loadingSettings?.appName || 'Cesta Básica';

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center p-8">
          <div className="size-24 bg-white/50 backdrop-blur-md rounded-[32px] flex items-center justify-center mx-auto mb-6 animate-pulse shadow-xl border border-white/20 overflow-hidden p-3">
            {loadingLogoType === 'icon' ? (
              <span className="material-symbols-outlined text-5xl text-primary">{loadingAppLogo}</span>
            ) : (
              <img src={loadingAppLogo} alt={loadingAppName} className="w-full h-full object-contain" />
            )}
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{loadingAppName}</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] animate-pulse mb-8">{loadingStatus}</p>

          <div className="space-y-4">
            <button
              onClick={() => setIsLoaded(true)}
              className="px-6 py-3 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 active:scale-95 transition-all text-sm"
            >
              Ignorar e Entrar
            </button>
            <br />
            <button
              onClick={() => window.location.reload()}
              className="text-primary text-xs font-bold uppercase tracking-widest hover:underline"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginView settings={appData.settings} onLogin={handleLogin} onRegisterCustomer={handleAddCustomer} initialMode={authInitialMode} />;
  }

  const renderContent = () => {
    switch (view) {
      case 'users-management':
        return (
          <UsersManagementView
            users={appData.allUsers}
            onUpdateRole={handleUpdateUserRole}
            setView={setView}
          />
        );

      case 'dashboard':
        if (session.role === 'vendedor') {
          return (
            <SellerManagementView
              sales={appData.sales}
              installments={appData.installments}
              deliveries={appData.deliveries}
              dailyClosings={appData.dailyClosings}
              goals={appData.goals}
              sellerId={session.id}
              sellerName={session.name}
              team={appData.team}
              setView={setView}
            />
          );
        }
        return (
          <Dashboard
            sales={appData.sales}
            baskets={appData.basketModels}
            stock={appData.stock}
            team={appData.team}
            deliveries={appData.deliveries}
            installments={appData.installments}
            dailyClosings={appData.dailyClosings}
            goals={appData.goals}
            userRole={session.role}
            userId={session.id}
            setView={setView}
          />
        );

      case 'team':
        return (
          <TeamView
            team={appData.team}
            onAddMember={handleAddTeamMember}
            onUpdateMember={handleUpdateTeamMember}
            onToggleStatus={handleToggleTeamStatus}
            onDeleteMember={handleDeleteTeamMember}
            setView={setView}
          />
        );

      case 'stock':
        return (
          <StockView
            basketModels={appData.basketModels}
            stock={appData.stock}
            stockEntries={appData.stockEntries}
            userRole={session.role}
            onDeleteEntry={handleDeleteStockEntry}
            onDeleteModel={handleDeleteBasketModel}
            onDecreaseStock={handleDecreaseStock}
            setView={setView}
          />
        );

      case 'stock-entry':
        return (
          <StockEntryView
            basketModels={appData.basketModels}
            stock={appData.stock}
            onAddEntry={handleAddStockEntry}
            setView={setView}
          />
        );

      case 'basket-models':
        return (
          <BasketModelsView
            basketModels={appData.basketModels}
            onAddModel={handleAddBasketModel}
            onUpdateModel={handleUpdateBasketModel}
            onToggleModel={handleToggleBasketModel}
            onDeleteModel={handleDeleteBasketModel}
            setView={setView}
          />
        );

      case 'customer-store':
        return (
          <CustomerStoreView
            basketModels={appData.basketModels}
            stock={appData.stock}
            cart={cart}
            settings={appData.settings}
            onAddToCart={handleAddToCart}
            setView={setView}
          />
        );

      case 'customer-cart':
        return (
          <CustomerCartView
            cart={cart}
            basketModels={appData.basketModels}
            stock={appData.stock}
            onUpdateQuantity={handleUpdateCartQuantity}
            onClearCart={handleClearCart}
            setView={setView}
          />
        );

      case 'customer-checkout':
        return (
          <CustomerCheckoutView
            cart={cart}
            customer={getCustomerForCheckout()}
            onCreateSale={handleCreateSale}
            onUpdateProfile={handleUpdateProfile}
            onClearCart={handleClearCart}
            setView={setView}
          />
        );

      case 'customer-orders':
        const currentOrdersCustomerId = appData.customers.find(c =>
          c.id === session.id ||
          (c.email && c.email === session.email && c.email !== 'Endereço não cadastrado')
        )?.id || session.id;
        return (
          <CustomerOrdersView
            sales={appData.sales}
            deliveries={appData.deliveries}
            basketModels={appData.basketModels}
            customerId={currentOrdersCustomerId}
            onCancelOrder={handleCancelOrder}
            setView={setView}
          />
        );

      case 'customer-profile':
        return (
          <CustomerProfileView
            session={session}
            customer={appData.customers.find(c =>
              c.id === session.id ||
              (c.email && c.email === session.email && c.email !== 'Endereço não cadastrado')
            ) || null}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
            setView={setView}
          />
        );

      case 'customer-register':
        return (
          <CustomerRegisterView
            customers={session?.role === 'gerente'
              ? appData.customers
              : appData.customers.filter(c => c.createdBy === session?.id)}
            onAddCustomer={handleAddCustomer}
            onSelectCustomer={setSelectedCustomer}
            setView={setView}
          />
        );

      case 'presential-sale':
        return (
          <PresentialSaleView
            basketModels={appData.basketModels}
            stock={appData.stock}
            customers={session?.role === 'gerente'
              ? appData.customers
              : appData.customers.filter(c => c.createdBy === session?.id)}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            onCreateSale={handleCreateSale}
            setView={setView}
          />
        );

      case 'installments':
        return (
          <InstallmentsView
            installments={appData.installments}
            sales={appData.sales}
            userRole={session?.role || 'cliente'}
            userId={session?.id || ''}
            onPayInstallment={handlePayInstallment}
            onUpdateInstallments={handleUpdateInstallments}
            setView={setView}
          />
        );

      case 'daily-closing':
        return (
          <DailyClosingView
            sales={appData.sales}
            installments={appData.installments}
            deliveries={appData.deliveries}
            dailyClosings={appData.dailyClosings}
            sellerId={session.id}
            sellerName={session.name}
            onCreateClosing={handleCreateClosing}
            setView={setView}
          />
        );

      case 'closing-approval':
        return (
          <ClosingApprovalView
            sales={appData.sales}
            team={appData.team}
            installments={appData.installments}
            deliveries={appData.deliveries}
            dailyClosings={appData.dailyClosings}
            onApproveClosing={handleApproveClosing}
            onRejectClosing={handleRejectClosing}
            setView={setView}
          />
        );

      case 'deliveries':
        return (
          <DeliveriesView
            deliveries={appData.deliveries}
            team={appData.team}
            userRole={session.role}
            userId={session.id}
            onAssignDelivery={handleAssignDelivery}
            onUpdateStatus={handleUpdateDeliveryStatus}
            onCancelSale={handleCancelOrder}
            setView={setView}
            customers={appData.customers}
            sales={appData.sales}
            baskets={appData.basketModels}
          />
        );

      case 'gps-tracking':
        return (
          <GpsTrackingView
            team={appData.team}
            setView={setView}
          />
        );

      case 'receivables':
        return (
          <InstallmentsView
            installments={appData.installments}
            sales={appData.sales}
            userRole={session?.role || 'cliente'}
            userId={session?.id || ''}
            onPayInstallment={handlePayInstallment}
            onUpdateInstallments={handleUpdateInstallments}
            setView={setView}
          />
        );

      case 'sales-list':
        const filteredSales = session.role === 'vendedor'
          ? appData.sales.filter(s =>
            s.sellerId === session.id &&
            s.channel === 'presencial' &&
            s.status === OrderStatus.DELIVERED
          )
          : appData.sales;
        return (
          <ManagerSalesView
            sales={filteredSales}
            deliveries={appData.deliveries}
            basketModels={appData.basketModels}
            installments={appData.installments}
            onUpdateStatus={handleCancelOrder}
            onUpdateSale={handleUpdateSale}
            setView={setView}
            userRole={session.role}
            customers={appData.customers}
            userId={session.id}
          />
        );

      case 'manager-customers':
        return (
          <ManagerCustomersView
            customers={appData.customers}
            team={appData.team}
            setView={setView}
            onUpdateCustomer={handleUpdateCustomer}
          />
        );

      case 'analytics':
        return (
          <AnalyticsView
            sales={appData.sales}
            installments={appData.installments}
            deliveries={appData.deliveries}
            dailyClosings={appData.dailyClosings}
            baskets={appData.basketModels}
            stock={appData.stock}
            team={appData.team}
            goals={appData.goals}
            settings={appData.settings}
            loginLogs={appData.loginLogs}
            customers={appData.customers}
            setView={setView}
          />
        );

      case 'profile':
        return (
          <SellerProfileView
            session={session}
            teamMember={appData.team.find(m => m.id === session.id) || null}
            onUpdateProfile={handleUpdateProfile}
            onLogout={handleLogout}
            setView={setView}
          />
        );

      case 'settings':
        return (
          <SettingsView
            team={appData.team}
            goals={appData.goals}
            settings={appData.settings}
            onUpdateGoals={handleUpdateGoals}
            onClearGoals={handleClearGoals}
            setView={setView}
          />
        );

      case 'app-config':
        return (
          <AppConfigView
            settings={appData.settings}
            onUpdateSettings={handleUpdateSettings}
            setView={setView}
          />
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
            <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-400">construction</span>
            </div>
            <h3 className="text-lg font-bold mb-2">Em Desenvolvimento</h3>
            <p className="text-slate-500 text-sm mb-6">A tela "{view}" será implementada em breve.</p>
            <button
              onClick={() => setView('dashboard')}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl"
            >
              Voltar ao Início
            </button>
          </div>
        );
    }
  };

  // Calculate delivery count for badge
  const deliveryCount = appData.deliveries.filter(d => {
    // Must be active status (ASSIGNED or PENDING and assigned to user)
    if (d.status !== DeliveryStatus.ASSIGNED && d.status !== DeliveryStatus.PENDING) return false;
    return d.driverId === session?.id;
  }).length;

  return (
    <Layout
      currentView={view}
      setView={setView}
      user={session}
      onLogout={handleLogout}
      cartCount={cartCount}
      deliveryCount={deliveryCount}
      settings={appData.settings}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
