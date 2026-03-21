// ============================================
// STORE - PERSISTÊNCIA LOCAL (LOCALSTORAGE)
// ============================================

import { createClient } from '@supabase/supabase-js';

import {
  AppData,
  BasketModel,
  BasketModelItem,
  StockItem,
  StockEntry,
  Customer,
  Sale,
  Installment,
  Delivery,
  DailyClosing,
  UserSession,
  OrderStatus,
  DeliveryStatus,
  InstallmentStatus,
  UserRole,
  TeamMember,
  PaymentMethod,
  SaleGoal,
  AppSettings,
  GoalType,
  GoalPeriod,
  LoginLog,
} from './types';
import { APP_STORAGE_KEY, SESSION_STORAGE_KEY, BASKET_IMAGES, AVATAR_IMAGES, DEFAULT_LOCATION } from './constants';
import { supabase } from './supabase';
import { parseDBDate } from './utils';

// ============================================
// DADOS INICIAIS (MOCK)
// ============================================

const INITIAL_STOCK: StockItem[] = [];

// Dados iniciais vazios
const INITIAL_DATA: AppData = {
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
  settings: {
    appName: 'Cesta Básica na sua Casa',
    appLogo: 'shopping_basket',
    logoType: 'icon'
  },
  loginLogs: []
};

// ============================================
// FUNÇÕES DE PERSISTÊNCIA
// ============================================

export const loadData = (): AppData => {
  const stored = localStorage.getItem(APP_STORAGE_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      return {
        basketModels: data.basketModels || [],
        stockEntries: data.stockEntries || [],
        stock: data.stock || [],
        customers: data.customers || INITIAL_DATA.customers,
        sales: data.sales || [],
        installments: data.installments || [],
        deliveries: data.deliveries || [],
        team: data.team || INITIAL_DATA.team,
        dailyClosings: data.dailyClosings || [],
        goals: data.goals || [],
        settings: data.settings || INITIAL_DATA.settings,
        loginLogs: data.loginLogs || [],
      };
    } catch (e) {
      console.error('Failed to parse storage', e);
    }
  }
  return INITIAL_DATA;
};

export const saveData = (data: AppData) => {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data));
};

export const resetData = () => {
  localStorage.removeItem(APP_STORAGE_KEY);
  localStorage.removeItem(SESSION_STORAGE_KEY);
  window.location.reload();
};

// ============================================
// SUPABASE SERVICE FUNCTIONS
// ============================================

export const fetchBasketModels = async (): Promise<BasketModel[]> => {
  const { data, error } = await supabase
    .from('basket_models')
    .select('*')
    .order('name');

  if (error) {
    console.error('[store] fetchBasketModels error:', error);
    throw error;
  }

  console.log('[store] fetchBasketModels raw data:', data);

  return (data || []).map(b => ({
    id: b.id,
    name: b.name,
    description: b.description,
    price: b.price || 0,
    weight: b.weight,
    image: b.image,
    active: b.active,
    createdAt: new Date(b.created_at).getTime(),
    isBestSeller: b.is_best_seller || false,
    isFeatured: b.is_featured || false,
    displayOrder: b.display_order || 0,
    rating: typeof b.rating === 'number' ? b.rating : 4.8,
  }));
};

export const fetchCustomers = async (): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    cpf: c.cpf,
    phone: c.phone,
    email: c.email,
    address: c.address,
    addressNumber: c.address_number,
    neighborhood: c.neighborhood,
    city: c.city,
    zipCode: c.zip_code,
    state: c.state,
    complement: c.complement,
    createdAt: new Date(c.created_at).getTime(),
    createdBy: c.created_by
  }));
};

export const checkProfileConflict = async (data: { email?: string; cpf?: string; phone?: string }, excludeId?: string, token?: string) => {
  if (!data.email && !data.cpf && !data.phone) return null;

  const clean = (val?: string) => val ? val.replace(/\D/g, '') : '';
  const cleanEmail = (val?: string) => val ? val.trim().toLowerCase() : '';

  console.log('[store] checkProfileConflict RPC call starting...');
  const startTime = Date.now();

  // Fresh client to avoid socket issues
  const localSupabase = createClient(
    (import.meta as any).env.VITE_SUPABASE_URL,
    (import.meta as any).env.VITE_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    }
  );

  try {
    const rpcPromise = localSupabase.rpc('check_profile_conflict', {
      p_cpf: data.cpf,
      p_phone: data.phone,
      p_email: data.email,
      p_exclude_id: excludeId
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT: Verificação de conflitos demorou mais de 30s.')), 30000)
    );

    const { data: conflict, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

    console.log(`[store] checkProfileConflict RPC finished in ${Date.now() - startTime}ms`);

    if (error) {
      console.error('Error checking conflicts (RPC):', error);
      return null;
    }

    if (conflict && conflict.conflict) {
      return { field: conflict.field, name: conflict.name };
    }

    return null;
  } catch (err: any) {
    console.error('[store] checkProfileConflict Exception:', err);
    if (err.message.includes('TIMEOUT')) throw err;
    return null;
  }
};


export const fetchTeamMembers = async (): Promise<TeamMember[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['vendedor', 'entregador']);

  if (error) throw error;
  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    role: p.role,
    phone: p.phone,
    email: p.email,
    cpf: p.cpf || '',
    status: p.status,
    startDate: p.start_date ? new Date(p.start_date).getTime() : Date.now(),
    commissionRate: p.commission_rate,
    baseSalary: p.base_salary,
    salesCount: p.sales_count || 0,
    deliveriesCount: p.deliveries_count || 0,
    avatar: p.avatar,
    lastLocation: p.last_location ? {
      lat: p.last_location.lat,
      lng: p.last_location.lng,
      updatedAt: p.last_location.updatedAt || new Date(p.updated_at).getTime()
    } : undefined
  }));
};

export const upsertTeamMember = async (member: Partial<TeamMember>, token?: string) => {
  console.log('[store] upsertTeamMember starting...', member.id || 'NEW');
  const startTime = Date.now();

  // Check for conflicts first
  const conflict = await checkProfileConflict({
    email: member.email,
    cpf: member.cpf,
    phone: member.phone
  }, member.id, token);

  if (conflict) {
    throw new Error(`Este ${conflict.field} já está atrelado a outro usuário (${conflict.name}).`);
  }

  const memberId = member.id || crypto.randomUUID();

  // Use RPC to bypass RLS (SECURITY DEFINER function)
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT: O salvamento do membro demorou mais de 30s.')), 30000)
    );

    const rpcPromise = supabase.rpc('upsert_team_member', {
      p_id: memberId,
      p_name: member.name,
      p_role: member.role,
      p_phone: member.phone || null,
      p_email: member.email || null,
      p_cpf: member.cpf || null,
      p_status: member.status || 'pendente',
      p_commission_rate: member.commissionRate || 0,
      p_base_salary: member.baseSalary || 0,
      p_start_date: member.startDate ? new Date(member.startDate).toISOString() : new Date().toISOString(),
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

    console.log(`[store] upsertTeamMember finished in ${Date.now() - startTime}ms`);

    if (error) {
      console.error('Error in upsertTeamMember:', error);
      throw error;
    }

    // RPC returns JSONB, map it back to a TeamMember-like object
    const row = data;
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      phone: row.phone,
      email: row.email,
      cpf: row.cpf || '',
      status: row.status,
      startDate: row.start_date ? new Date(row.start_date).getTime() : Date.now(),
      commissionRate: row.commission_rate,
      baseSalary: row.base_salary,
    };
  } catch (err: any) {
    console.error('[store] upsertTeamMember Exception:', err);
    throw err;
  }
};

export const deleteTeamMember = async (id: string) => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchSales = async (): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select('*, sale_items(*)');

  if (error) throw error;
  return (data || []).map(s => ({
    id: s.id,
    customerId: s.customer_id,
    customerName: s.customer_name,
    sellerId: s.seller_id,
    sellerName: s.seller_name,
    total: s.total || 0,
    paymentMethod: s.payment_method,
    channel: s.channel,
    status: s.status,
    installmentsCount: s.installments_count || 0,
    deliveryAddress: s.delivery_address,
    deliveryNumber: s.delivery_number,
    deliveryContact: s.delivery_contact,
    deliveryNotes: s.delivery_notes,
    createdAt: new Date(s.created_at).getTime(),
    items: (s.sale_items || []).map((i: any) => ({
      basketModelId: i.basket_model_id,
      basketName: i.basket_name,
      quantity: i.quantity,
      unitPrice: i.unit_price
    }))
  }));
};

export const fetchDeliveries = async (): Promise<Delivery[]> => {
  const { data, error } = await supabase
    .from('deliveries')
    .select('*');

  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id,
    saleId: d.sale_id,
    customerId: d.customer_id,
    customerName: d.customer_name,
    address: d.address,
    driverId: d.driver_id,
    driverName: d.driver_name,
    status: d.status,
    createdAt: parseDBDate(d.created_at),
    assignedAt: d.assigned_at ? new Date(d.assigned_at).getTime() : undefined,
    deliveredAt: d.delivered_at ? new Date(d.delivered_at).getTime() : undefined,
    notes: d.notes
  }));
};

export const fetchInstallments = async (): Promise<Installment[]> => {
  // Supabase PostgREST has a default max_rows of 1000.
  // We need to paginate to fetch all installments.
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('installments')
      .select('*')
      .order('due_date', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    
    const rows = data || [];
    allData = allData.concat(rows);
    
    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  console.log(`[store] fetchInstallments: fetched ${allData.length} total installments`);

  return allData.map(i => ({
    id: i.id,
    saleId: i.sale_id,
    customerId: i.customer_id,
    customerName: i.customer_name,
    number: i.number,
    totalInstallments: i.total_installments,
    amount: i.amount || 0,
    dueDate: parseDBDate(i.due_date),
    status: (() => {
      const s = i.status?.toLowerCase()?.trim();
      if (!s) return InstallmentStatus.PENDING; // Default to PENDING if null/empty
      if (s === 'pendente' || s === 'pending') return InstallmentStatus.PENDING;
      if (s === 'pago' || s === 'paid') return InstallmentStatus.PAID;
      if (s === 'atrasado' || s === 'overdue') return InstallmentStatus.OVERDUE;
      if (s === 'cancelado' || s === 'cancelled') return InstallmentStatus.CANCELLED;
      return i.status as InstallmentStatus;
    })(),
    paidAt: i.paid_at ? new Date(i.paid_at).getTime() : undefined,
    paymentMethod: i.payment_method as PaymentMethod | undefined,
    receivedBy: i.received_by,
    proofImage: i.proof_image
  }));
};

export const fetchDailyClosings = async (): Promise<DailyClosing[]> => {
  // 1. Fetch closings
  const { data: closings, error: closingsError } = await supabase
    .from('daily_closings')
    .select('*')
    .limit(10000)
    .order('created_at', { ascending: false });

  if (closingsError) throw closingsError;

  // 2. Fetch all receipts to link sales
  const { data: receipts, error: receiptsError } = await supabase
    .from('daily_receipts')
    .select('*')
    .limit(10000);

  if (receiptsError) throw receiptsError;

  return (closings || []).map(c => {
    const closingReceipts = (receipts || []).filter(r => r.closing_id === c.id);
    return {
      id: c.id,
      sellerId: c.seller_id,
      sellerName: c.seller_name,
      closingDate: new Date(c.closing_date || c.created_at).getTime(),
      cashAmount: c.cash_amount || 0,
      cardAmount: c.card_amount || 0,
      pixAmount: c.pix_amount || 0,
      installmentAmount: c.installment_amount || 0,
      receipts: closingReceipts.map(r => ({
        id: r.id,
        saleId: r.sale_id,
        installmentId: r.installment_id,
        amount: r.amount,
        paymentMethod: r.payment_method,
        proofImage: r.proof_image
      })),
      salesIds: closingReceipts.filter(r => r.sale_id).map(r => r.sale_id),
      installmentIds: closingReceipts.filter(r => r.installment_id).map(r => r.installment_id),
      status: c.status,
      approvedBy: c.approved_by,
      approvedAt: c.approved_at ? new Date(c.approved_at).getTime() : undefined,
      notes: c.notes
    };
  });
};

export const upsertCustomer = async (customer: Partial<Customer>) => {
  const mapped: any = { id: customer.id };

  if (customer.name !== undefined) mapped.name = customer.name;
  if (customer.cpf !== undefined) mapped.cpf = customer.cpf;
  if (customer.phone !== undefined) mapped.phone = customer.phone;
  if (customer.email !== undefined) mapped.email = customer.email;
  if (customer.address !== undefined) mapped.address = customer.address;
  if (customer.addressNumber !== undefined) mapped.address_number = customer.addressNumber;
  if (customer.neighborhood !== undefined) mapped.neighborhood = customer.neighborhood;
  if (customer.city !== undefined) mapped.city = customer.city;
  if (customer.zipCode !== undefined) mapped.zip_code = customer.zipCode;
  if (customer.state !== undefined) mapped.state = customer.state;
  if (customer.complement !== undefined) mapped.complement = customer.complement;
  if (customer.createdAt !== undefined) mapped.created_at = new Date(customer.createdAt).toISOString();
  if (customer.createdBy !== undefined) mapped.created_by = customer.createdBy;

  console.log('[store] executing upsertCustomer (with logs)...', mapped);

  const { data, error } = await supabase
    .from('customers')
    .upsert(mapped, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('[store] upsertCustomer error:', error);
    throw error;
  }
  
  return {
    id: data.id,
    name: data.name,
    cpf: data.cpf,
    phone: data.phone,
    email: data.email,
    address: data.address,
    addressNumber: data.address_number,
    neighborhood: data.neighborhood,
    city: data.city,
    zipCode: data.zip_code,
    state: data.state,
    complement: data.complement,
    createdAt: new Date(data.created_at).getTime(),
    createdBy: data.created_by
  };
};

export const upsertCustomerProfile = async (customer: Partial<Customer> & { avatar?: string }, token?: string) => {
  const payload = {
    p_id: customer.id,
    p_name: customer.name ?? null,
    p_email: customer.email ?? null,
    p_phone: customer.phone ?? null,
    p_cpf: customer.cpf ?? null,
    p_address: customer.address ?? null,
    p_address_number: customer.addressNumber ?? null,
    p_neighborhood: customer.neighborhood ?? null,
    p_city: customer.city ?? null,
    p_zip_code: customer.zipCode ?? null,
    p_state: customer.state ?? null,
    p_complement: customer.complement ?? null,
    p_avatar: customer.avatar ?? null
  };

  console.log('[store] Invoking upsert_customer_profile with (sanitized):', payload);

  let accessToken = token;

  if (!accessToken) {
    console.log('[store] Token not provided, getting session...');
    try {
      // Standard fetch session without excessive timeout logic unless needed
      const { data } = await supabase.auth.getSession();
      accessToken = data?.session?.access_token;

      if (!accessToken) {
        // Fallback check
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: sessionData } = await supabase.auth.getSession();
          accessToken = sessionData.session?.access_token;
        }
      }
    } catch (err) {
      console.error('[store] getSession failed:', err);
    }
  }

  if (!accessToken) throw new Error('Sessão expirada ou inválida. Por favor, saia e entre novamente.');

  // Create local client with the user's token for this specific atomic operation
  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  const localSupabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });

  // RPC execution with a reasonable timeout (15s matches the UI safety button)
  try {
    const rpcPromise = localSupabase.rpc('upsert_customer_profile', payload);
    const timeoutPromise = new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('TIMEOUT: O servidor não respondeu a tempo. Verifique sua internet.'));
      }, 15000);
    });

    const { data, error } = await Promise.race([rpcPromise, timeoutPromise]) as any;

    if (error) {
      console.error('[store] upsert_customer_profile error:', error);
      throw error;
    }

    if (data && data.success === false) {
      throw new Error(data.error || 'Erro ao salvar perfil no banco de dados.');
    }

    console.log('[store] upsert_customer_profile success');
    return data;
  } catch (err: any) {
    console.error('[store] upsertCustomerProfile failed:', err);
    throw err;
  }
};

export const updateDeliveryStatus = async (id: string, status: DeliveryStatus, notes?: string) => {
  const { data: delivery, error: fetchError } = await supabase
    .from('deliveries')
    .select('sale_id')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.warn('[store] updateDeliveryStatus - could not fetch delivery for sync:', fetchError);
  }

  const updatePayload: any = {
    status,
    delivered_at: status === DeliveryStatus.DELIVERED ? new Date().toISOString() : null
  };

  if (notes !== undefined) {
    updatePayload.notes = notes;
  }

  const { error } = await supabase
    .from('deliveries')
    .update(updatePayload)
    .eq('id', id);

  if (error) throw error;

  // Sync Sale status
  if (delivery && delivery.sale_id) {
    if (status === DeliveryStatus.DELIVERED) {
      await updateSaleStatus(delivery.sale_id, OrderStatus.DELIVERED);
    } else if (status === DeliveryStatus.IN_ROUTE) {
      await updateSaleStatus(delivery.sale_id, OrderStatus.IN_DELIVERY);
    }
  }
};

export const updateMemberLocation = async (id: string, lat: number, lng: number) => {
  const { error } = await supabase
    .from('profiles')
    .update({
      last_location: { lat, lng, updatedAt: Date.now() }
    })
    .eq('id', id);

  if (error) throw error;
};

export const createSaleInDb = async (saleData: any, items: any[], installments: any[], delivery: any) => {
  const start = Date.now();
  console.log(`[store] [${new Date().toISOString()}] createSaleInDb atomic - Starting transaction via RPC...`);

  // Wrap RPC in a race condition for timeout
  try {
    const timeoutPromise = new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('TIMEOUT: O servidor demorou muito para responder. Verifique "Meus Pedidos" em instantes.'));
      }, 30000); // 30 seconds timeout
    });

    const { data, error } = await Promise.race([
      supabase.rpc('create_complete_sale', {
        p_sale_data: saleData,
        p_items: items,
        p_installments: installments || [],
        p_delivery: delivery || null
      }),
      timeoutPromise
    ]) as any;

    if (error) {
      console.error(`[store] [${Date.now() - start}ms] createSaleInDb atomic error:`, error);
      throw error;
    }

    // COMPATIBILITY: Supabase RPC might return an array or a single object depending on PG function result type
    const result = Array.isArray(data) ? data[0] : data;

    if (!result) {
      console.error('[store] create_complete_sale returned no data even with success status');
      throw new Error('O servidor processou seu pedido mas não retornou os detalhes. Verifique "Meus Pedidos" para confirmar.');
    }

    console.log('[store] createSaleInDb raw result:', result);

    // Map snake_case from DB to camelCase for the app
    const mappedSale = {
      id: result.id,
      customerId: result.customer_id,
      customerName: result.customer_name,
      sellerId: result.seller_id,
      sellerName: result.seller_name,
      total: result.total,
      paymentMethod: result.payment_method,
      paymentSubMethod: result.payment_sub_method,
      changeAmount: result.change_amount,
      channel: result.channel,
      status: result.status,
      installmentsCount: result.installments_count,
      deliveryAddress: result.delivery_address,
      deliveryNumber: result.delivery_number,
      deliveryContact: result.delivery_contact,
      deliveryNotes: result.delivery_notes,
      createdAt: result.created_at ? new Date(result.created_at).getTime() : Date.now(),
      items: [] // Items are fetched separately by triggerRefresh usually, but keeping it consistent
    };

    console.log(`[store] [${Date.now() - start}ms] createSaleInDb atomic completed successfully.`);
    return mappedSale;
  } catch (ex: any) {
    const isTimeout = ex?.message && ex.message.includes('TIMEOUT');
    console.error(`[store] ${isTimeout ? 'TIMEOUT' : 'EXCEPTION'} in createSaleInDb:`, {
      message: ex?.message,
      code: ex?.code,
      details: ex?.details,
      hint: ex?.hint,
      stack: ex?.stack,
      error: ex
    });
    throw ex;
  }
};

export const updateSaleStatus = async (saleId: string, status: OrderStatus) => {
  console.log('[store] updateSaleStatus started', { saleId, status });

  // 1. Update Sale
  const { error: saleError } = await supabase
    .from('sales')
    .update({ status })
    .eq('id', saleId);

  if (saleError) {
    console.error('[store] updateSaleStatus - Sale error:', saleError);
    throw saleError;
  }

  // 2. Update associated Delivery and Installments if any
  // ONLY cancel delivery and installments if sale is fully CANCELLED
  if (status === OrderStatus.CANCELLED) {
    // 2.1 Cancel Deliveries
    const { error: delError } = await supabase
      .from('deliveries')
      .update({ status: DeliveryStatus.CANCELLED })
      .eq('sale_id', saleId);

    if (delError) {
      console.warn('[store] updateSaleStatus - Delivery update warning (might not exist):', delError);
    }

    // 2.2 Cancel Installments
    const { error: instError } = await supabase
      .from('installments')
      .update({ status: InstallmentStatus.CANCELLED })
      .eq('sale_id', saleId)
      .eq('status', InstallmentStatus.PENDING); // Only cancel those not yet paid

    if (instError) {
      console.warn('[store] updateSaleStatus - Installments update warning (might not exist):', instError);
    }
  }

  console.log('[store] updateSaleStatus completed');
};

export const updateCompleteSale = async (
  saleId: string,
  saleData: any,
  items: any[],
  installments: any[]
) => {
  const start = Date.now();
  console.log(`[store] [${new Date().toISOString()}] updateCompleteSale atomic - Starting via RPC...`);

  try {
    const timeoutPromise = new Promise((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('TIMEOUT: O servidor demorou muito para responder ao atualizar a venda.'));
      }, 30000);
    });

    const { data, error } = await Promise.race([
      supabase.rpc('update_complete_sale', {
        p_sale_id: saleId,
        p_sale_data: saleData,
        p_items: items,
        p_installments: installments || []
      }),
      timeoutPromise
    ]) as any;

    if (error) {
      console.error(`[store] [${Date.now() - start}ms] updateCompleteSale atomic error:`, error);
      throw error;
    }

    console.log(`[store] [${Date.now() - start}ms] updateCompleteSale atomic completed successfully.`);
    return data;
  } catch (ex: any) {
    console.error('[store] EXCEPTION in updateCompleteSale:', ex);
    throw ex;
  }
};

export const upsertBasketModel = async (model: Partial<BasketModel>) => {
  console.log('[store] upsertBasketModel started for:', model.id || 'NEW');

  if (model.id) {
    // UPDATE direto (sem RPC)
    const payload: any = {};
    if (model.name !== undefined) payload.name = model.name;
    if (model.description !== undefined) payload.description = model.description;
    if (model.price !== undefined) payload.price = model.price;
    if (model.weight !== undefined) payload.weight = model.weight;
    if (model.active !== undefined) payload.active = model.active;
    if (model.image) {
      payload.image = model.image;
    }
    if (model.isBestSeller !== undefined) payload.is_best_seller = model.isBestSeller;
    if (model.isFeatured !== undefined) payload.is_featured = model.isFeatured;
    if (model.displayOrder !== undefined) payload.display_order = model.displayOrder;
    if (model.rating !== undefined) payload.rating = model.rating;

    console.log('[store] Updating model with keys:', Object.keys(payload));
    const { error } = await supabase.from('basket_models').update(payload).eq('id', model.id);
    if (error) {
      console.error('[store] Update error:', error);
      throw new Error(error.message);
    }
    console.log('[store] Update SUCCESS');
  } else {
    // INSERT new model
    const payload: any = {
      name: model.name,
      description: model.description || '',
      price: model.price,
      weight: model.weight || '',
      active: model.active !== undefined ? model.active : true,
      image: model.image || null,
      is_best_seller: model.isBestSeller || false,
      is_featured: model.isFeatured || false,
      display_order: model.displayOrder || 0,
      rating: model.rating || 4.8,
    };
    console.log('[store] Inserting new model...');
    const { data, error } = await supabase.from('basket_models').insert(payload).select('id').single();
    if (error) {
      console.error('[store] Insert error:', error);
      throw new Error(error.message);
    }
    console.log('[store] Insert SUCCESS, id:', data?.id);
    return data?.id;
  }
  return model.id;
};

// ---- BASKET MODEL ITEMS (tabela separada) ----

export const fetchBasketModelItems = async (basketModelId: string): Promise<BasketModelItem[]> => {
  const { data, error } = await supabase
    .from('basket_model_items')
    .select('*')
    .eq('basket_model_id', basketModelId)
    .order('created_at');

  if (error) {
    console.error('[store] fetchBasketModelItems error:', error);
    throw error;
  }

  return (data || []).map(item => ({
    id: item.id,
    basketModelId: item.basket_model_id,
    name: item.name,
    quantity: item.quantity,
    tipo: item.tipo || 'alimentos',
  }));
};

export const addBasketModelItems = async (basketModelId: string, items: { name: string; quantity: string; tipo?: string }[]) => {
  if (items.length === 0) return;
  const payload = items.map(i => ({
    basket_model_id: basketModelId,
    name: i.name.trim(),
    quantity: i.quantity.trim(),
    tipo: (i.tipo || 'alimentos').trim(),
  }));
  const { error } = await supabase.from('basket_model_items').insert(payload);
  if (error) {
    console.error('[store] addBasketModelItems error:', error);
    throw new Error(error.message);
  }
};

export const deleteBasketModelItem = async (itemId: string) => {
  const { error } = await supabase.from('basket_model_items').delete().eq('id', itemId);
  if (error) {
    console.error('[store] deleteBasketModelItem error:', error);
    throw new Error(error.message);
  }
};

export const deleteAllBasketModelItems = async (basketModelId: string) => {
  const { error } = await supabase.from('basket_model_items').delete().eq('basket_model_id', basketModelId);
  if (error) {
    console.error('[store] deleteAllBasketModelItems error:', error);
    throw new Error(error.message);
  }
};

export const deleteBasketModel = async (id: string) => {
  console.log('[store] deleteBasketModel started for:', id);
  const { error } = await supabase
    .from('basket_models')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[store] deleteBasketModel error:', error);
    throw error;
  }
  console.log('[store] deleteBasketModel success');
};

export const uploadBasketImage = async (file: File) => {
  console.log('[store] uploadBasketImage started for:', file.name);

  // Create a unique file name
  const extension = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`;
  const filePath = `models/${fileName}`;

  const { data, error } = await supabase.storage
    .from('basket-images')
    .upload(filePath, file);

  if (error) {
    console.error('[store] uploadBasketImage error:', error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('basket-images')
    .getPublicUrl(filePath);

  console.log('[store] uploadBasketImage success, URL:', publicUrl);
  return publicUrl;
};

export const uploadAppLogo = async (file: File) => {
  console.log('[store] uploadAppLogo started for:', file.name);

  const extension = file.name.split('.').pop();
  const fileName = `logo-${Date.now()}.${extension}`;
  const filePath = `branding/${fileName}`;

  const { data, error } = await supabase.storage
    .from('basket-images')
    .upload(filePath, file);

  if (error) {
    console.error('[store] uploadAppLogo error:', error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('basket-images')
    .getPublicUrl(filePath);

  console.log('[store] uploadAppLogo success, URL:', publicUrl);
  return publicUrl;
};

export const updateProfileStatus = async (id: string, status: 'ativo' | 'inativo') => {
  const { error } = await supabase
    .from('profiles')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
};

export const updateProfile = async (id: string, updates: any) => {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
};

export const payInstallment = async (id: string, paymentMethod: PaymentMethod) => {
  const { error } = await supabase
    .from('installments')
    .update({
      status: InstallmentStatus.PAID,
      payment_method: paymentMethod,
      paid_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) throw error;
};

export const createDailyClosing = async (closing: DailyClosing) => {
  console.log('[store] createDailyClosing started', closing);

  // 1. Insert into daily_closings
  const payload: any = {
    closing_date: new Date(closing.closingDate).toISOString().split('T')[0],
    seller_id: closing.sellerId,
    seller_name: closing.sellerName,
    cash_amount: closing.cashAmount,
    card_amount: closing.cardAmount,
    pix_amount: closing.pixAmount,
    installment_amount: closing.installmentAmount,
    notes: closing.notes,
    status: closing.status || 'Pendente',
  };

  const { data: insertedClosing, error: closingError } = await supabase
    .from('daily_closings')
    .insert(payload)
    .select()
    .single();

  if (closingError) {
    console.error('[store] createDailyClosing error:', closingError);
    throw closingError;
  }

  // 2. Insert into daily_receipts for linked sales
  const finalReceipts = [];

  if (closing.salesIds && closing.salesIds.length > 0) {
    const { data: salesData } = await supabase
      .from('sales')
      .select('id, total, payment_method')
      .in('id', closing.salesIds);

    (salesData || []).forEach(s => {
      finalReceipts.push({
        closing_id: insertedClosing.id,
        sale_id: s.id,
        installment_id: null,
        amount: s.total,
        payment_method: s.payment_method,
        proof_image: null
      });
    });
  }

  // 3. Insert into daily_receipts for linked installments
  if (closing.installmentIds && closing.installmentIds.length > 0) {
    const { data: instData } = await supabase
      .from('installments')
      .select('id, amount, sale_id, payment_method')
      .in('id', closing.installmentIds);

    (instData || []).forEach(i => {
      finalReceipts.push({
        closing_id: insertedClosing.id,
        sale_id: i.sale_id,
        installment_id: i.id,
        amount: i.amount,
        payment_method: i.payment_method || 'DINHEIRO',
        proof_image: null
      });
    });
  }

  if (finalReceipts.length > 0) {
    const { error: receiptsError } = await supabase
      .from('daily_receipts')
      .insert(finalReceipts);

    if (receiptsError) {
      console.error('[store] error inserting daily_receipts:', receiptsError);
      throw receiptsError;
    }
  }

  return insertedClosing;
};

export const addStockEntry = async (entry: any) => {
  const payload = {
    basket_model_id: entry.basket_model_id || entry.basketModelId,
    quantity: entry.quantity,
    unit_cost: entry.unit_cost !== undefined ? entry.unit_cost : entry.unitCost,
    supplier: entry.supplier,
    notes: entry.notes,
    created_by: entry.created_by || entry.createdBy,
    received_at: entry.received_at || (entry.receivedAt ? new Date(entry.receivedAt).toISOString() : new Date().toISOString())
  };

  const { data, error } = await supabase
    .from('stock_entries')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[store] addStockEntry error:', error);
    throw error;
  }
  return data;
};

export const fetchStockEntries = async (): Promise<StockEntry[]> => {
  const { data, error } = await supabase
    .from('stock_entries')
    .select('*')
    .limit(10000)
    .order('received_at', { ascending: false });

  if (error) {
    console.error('[store] fetchStockEntries error:', error);
    throw error;
  }

  return (data || []).map(e => ({
    id: e.id,
    basketModelId: e.basket_model_id,
    quantity: e.quantity,
    unitCost: e.unit_cost,
    supplier: e.supplier,
    receivedAt: new Date(e.received_at).getTime(),
    createdBy: e.created_by,
    notes: e.notes
  }));
};

export const fetchStockSummary = async (): Promise<StockItem[]> => {
  const { data, error } = await supabase.rpc('get_stock_summary');

  if (error) {
    console.error('[store] fetchStockSummary error:', error);
    throw error;
  }

  return (data || []).map((s: any) => ({
    basketModelId: s.basket_model_id,
    quantity: s.quantity
  }));
};

export const deleteStockEntry = async (id: string) => {
  const { error } = await supabase
    .from('stock_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const assignDelivery = async (deliveryId: string, driverId: string) => {
  const { error } = await supabase
    .from('deliveries')
    .update({
      driver_id: driverId,
      status: DeliveryStatus.ASSIGNED,
      assigned_at: new Date().toISOString()
    })
    .eq('id', deliveryId);

  if (error) throw error;
};

// ============================================
// FUNÇÕES DE SESSÃO (AUTH MOCK)
// ============================================

export const loadSession = (): UserSession | null => {
  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse session', e);
    }
  }
  return null;
};

export const saveSession = (session: UserSession) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const fetchAllProfiles = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const updateUserRole = async (userId: string, role: UserRole) => {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) throw error;
};

// ============================================
// METAS DE VENDA
// ============================================

export const fetchGoals = async (): Promise<SaleGoal[]> => {
  console.log('[store] fetchGoals from Supabase...');
  const { data, error } = await supabase
    .from('sale_goals')
    .select('*')
    .limit(10000)
    .order('start_date', { ascending: false });

  if (error) {
    console.error('[store] fetchGoals error:', error);
    throw error;
  }

  return (data || []).map(g => ({
    id: g.id,
    groupId: g.group_id,
    name: g.name,
    type: g.type as GoalType,
    period: g.period as GoalPeriod,
    startDate: new Date(g.start_date).getTime(),
    endDate: new Date(g.end_date).getTime(),
    amount: Number(g.amount),
    sellerId: g.seller_id,
    channel: g.channel as 'online' | 'presencial',
    isCancelled: g.is_cancelled,
    updatedAt: new Date(g.updated_at).getTime(),
  }));
};

export const upsertGoals = async (newGoals: (Omit<SaleGoal, 'id' | 'updatedAt'> & { id?: string })[], token?: string) => {
  console.log('[store] upsertGoals in Supabase...');

  const formattedGoals = newGoals.map(goal => ({
    id: goal.id || crypto.randomUUID(),
    group_id: goal.groupId,
    name: goal.name,
    type: goal.type,
    period: goal.period,
    start_date: new Date(goal.startDate).toISOString(),
    end_date: new Date(goal.endDate).toISOString(),
    amount: goal.amount,
    seller_id: goal.sellerId,
    channel: goal.channel,
    is_cancelled: goal.isCancelled || false,
    updated_at: new Date().toISOString()
  }));

  // Force fresh client if token is provided to bypass potential socket hangs
  // @ts-ignore - getSupabaseClient is defined in this file but might not be exported or clearly visible to TS yet if I didn't verify it, but I used it in upsertCustomerProfile so it exists.
  // Actually, I should check if getSupabaseClient is available. I'll assume it is based on previous edits.
  // wait, I need to make sure I don't break the build.
  // checking previous edits... yes, I added getSupabaseClient in proper scope or imports?
  // It was likely added inside store.ts or supabase.ts.
  // In `upsertCustomerProfile` I used `const client = token ? createClient(...) : supabase`.
  // Let's use the same pattern here.

  let client = supabase;
  if (token) {
    console.log('[store] upsertGoals: Using fresh client with token pass-through');
    const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
    const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  }

  // Use Promise.race to prevent indefinite hangs
  const updatePromise = client
    .from('sale_goals')
    .upsert(formattedGoals)
    .select();

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout: upsertGoals took too long')), 15000)
  );

  const { data, error } = await Promise.race([updatePromise, timeoutPromise]) as any;

  if (error) {
    console.error('[store] upsertGoals error:', error);
    throw error;
  }

  return (data || []).map(g => ({
    id: g.id,
    groupId: g.group_id,
    name: g.name,
    type: g.type as GoalType,
    period: g.period as GoalPeriod,
    startDate: new Date(g.start_date).getTime(),
    endDate: new Date(g.end_date).getTime(),
    amount: Number(g.amount),
    sellerId: g.seller_id,
    channel: g.channel as 'online' | 'presencial',
    isCancelled: g.is_cancelled,
    updatedAt: new Date(g.updated_at).getTime(),
  }));
};

export const clearGoals = async () => {
  console.log('[store] clearGoals in Supabase (deleting all)...');
  const { error } = await supabase
    .from('sale_goals')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything

  if (error) {
    console.error('[store] clearGoals error:', error);
    throw error;
  }
  return [];
};

// ============================================
// CONFIGURAÇÕES DO APP
// ============================================

export const fetchSettings = async (): Promise<AppSettings> => {
  console.log('[store] fetchSettings from Supabase...');
  try {
    const { data: dbSettings, error } = await supabase
      .from('app_config')
      .select('app_name, app_logo, logo_type, whatsapp_number')
      .eq('id', 'global')
      .maybeSingle();

    if (error) {
      console.error('[store] fetchSettings Supabase error:', error);
      throw error;
    }

    if (dbSettings) {
      const settings: AppSettings = {
        appName: dbSettings.app_name,
        appLogo: dbSettings.app_logo || 'shopping_basket',
        logoType: dbSettings.logo_type as any,
        whatsappNumber: dbSettings.whatsapp_number
      };

      // Update local cache for instant loading on next session
      const data = loadData();
      data.settings = settings;
      saveData(data);

      return settings;
    }
  } catch (e) {
    console.error('[store] fetchSettings from Supabase failed, using local fallback:', e);
  }

  const localData = loadData();
  return localData.settings || INITIAL_DATA.settings;
};

export const updateSettings = async (settings: AppSettings) => {
  console.log('[store] updateSettings in Supabase and local...');

  // 1. Save locally first for instant feedback
  const data = loadData();
  data.settings = settings;
  saveData(data);

  // 2. Save to Supabase
  try {
    const { error } = await supabase
      .from('app_config')
      .upsert({
        id: 'global',
        app_name: settings.appName,
        app_logo: settings.appLogo,
        logo_type: settings.logoType,
        whatsapp_number: settings.whatsappNumber,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  } catch (e) {
    console.error('[store] updateSettings in Supabase failed:', e);
    throw e;
  }

  return settings;
};

// ============================================
// HELPERS
// ============================================

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const getStockQuantity = (stock: StockItem[], modelId: string): number => {
  const item = stock.find(s => s.basketModelId === modelId);
  return item?.quantity || 0;
};

export const updateStock = (stock: StockItem[], modelId: string, delta: number): StockItem[] => {
  const existing = stock.find(s => s.basketModelId === modelId);
  if (existing) {
    return stock.map(s =>
      s.basketModelId === modelId
        ? { ...s, quantity: Math.max(0, s.quantity + delta) }
        : s
    );
  }
  return [...stock, { basketModelId: modelId, quantity: Math.max(0, delta) }];
};


export const fetchLoginLogs = async (): Promise<LoginLog[]> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('login_logs')
    .select('*')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchLoginLogs failed:', error);
    return [];
  }
  return (data || []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    email: row.email,
    user_agent: row.user_agent,
    created_at: row.created_at,
  }));
};
