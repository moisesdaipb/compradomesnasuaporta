// ============================================
// TIPOS DO SISTEMA CESTA BÁSICA NA SUA CASA
// ============================================

// Formas de Pagamento
export enum PaymentMethod {
  CASH = 'Dinheiro',
  PIX = 'PIX',
  CARD = 'Cartão',
  TERM = 'A Prazo',
  ON_DELIVERY = 'Na Entrega'
}

// Status de Pedido
export enum OrderStatus {
  PENDING = 'Pendente',
  CONFIRMED = 'Confirmado',
  IN_DELIVERY = 'Em Entrega',
  DELIVERED = 'Entregue',
  CANCELLED = 'Cancelado',
  CANCELLATION_REQUESTED = 'Solicitação de Cancelamento'
}

// Status de Parcela
export enum InstallmentStatus {
  PENDING = 'Pendente',
  PAID = 'Pago',
  OVERDUE = 'Atrasado',
  CANCELLED = 'Cancelado'
}

// Status de Entrega
export enum DeliveryStatus {
  PENDING = 'Pendente',
  ASSIGNED = 'Atribuída',
  IN_ROUTE = 'Em Rota',
  DELIVERED = 'Entregue',
  PROBLEM = 'Problema',
  CANCELLED = 'Cancelado'
}

// Status de Fechamento
export enum ClosingStatus {
  PENDING = 'pendente',
  APPROVED = 'aprovado',
  REJECTED = 'rejeitado',
}

// Metas de Venda
export type GoalType = 'geral' | 'vendedor' | 'canal';
export type GoalPeriod = 'diaria' | 'quinzenal' | 'mensal' | 'customizada';

export interface SaleGoal {
  id: string;
  groupId?: string; // Para agrupar metas (Geral, Vendedores, Canais) de um mesmo planejamento
  name?: string; // Nome customizado da meta (ex: Meta Abril)
  type: GoalType;
  period: GoalPeriod;
  startDate: number;
  endDate: number;
  amount: number;
  sellerId?: string; // Se type === 'vendedor'
  channel?: 'online' | 'presencial'; // Se type === 'canal'
  isCancelled?: boolean; // Para marcar metas canceladas
  updatedAt: number;
}

// Perfis de Usuário
export type UserRole = 'gerente' | 'vendedor' | 'entregador' | 'cliente';

// ============================================
// MODELOS PRINCIPAIS
// ============================================

// Item que compõe a cesta (tabela separada)
export interface BasketModelItem {
  id: string;
  basketModelId: string;
  name: string;
  quantity: string;
  tipo: string;
}

// Modelo de Cesta (Pequena, Grande, Big, Short...)
export interface BasketModel {
  id: string;
  name: string;
  description: string;
  price: number;
  weight: string;
  image: string;
  active: boolean;
  createdAt: number;
  // Configurable Attributes
  isBestSeller: boolean;
  isFeatured: boolean;
  displayOrder: number;
  rating: number;

}

// Estoque por Modelo
export interface StockItem {
  basketModelId: string;
  quantity: number;
}

// Entrada de Estoque (quando recebe do fornecedor)
export interface StockEntry {
  id: string;
  basketModelId: string;
  quantity: number;
  unitCost: number;
  supplier: string;
  receivedAt: number;
  createdBy: string;
  notes?: string;
}

// Etiqueta de Cliente
export interface CustomerTag {
  type: 'bom_pagador' | 'mau_pagador' | 'recorrente' | 'outros';
  customLabel?: string;
  customIcon?: string;
}

// Cliente
export interface Customer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email?: string;
  // Endereço (opcional no cadastro)
  address?: string;
  addressNumber?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
  state?: string;
  complement?: string;
  // Etiquetas
  tags?: CustomerTag[];
  // Campos calculados
  createdAt: number;
  createdBy: string;
}

// Item da Venda
export interface SaleItem {
  basketModelId: string;
  basketName: string;
  quantity: number;
  unitPrice: number;
}

// Venda
export interface Sale {
  id: string;
  customerId: string;
  customerName: string;
  sellerId?: string;
  sellerName?: string;
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentSubMethod?: string;
  changeAmount?: number;
  channel: 'online' | 'presencial';
  status: OrderStatus;
  installmentsCount?: number;
  // Dados de entrega (para vendas online)
  deliveryAddress?: string;
  deliveryNumber?: string;
  deliveryContact?: string;
  deliveryNotes?: string;
  createdAt: number;
  notes?: string;
}

// Parcela (para vendas a prazo)
export interface Installment {
  id: string;
  saleId: string;
  customerId: string;
  customerName: string;
  number: number;
  totalInstallments: number;
  amount: number;
  dueDate: number;
  status: InstallmentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: number;
  receivedBy?: string;
  proofImage?: string;
}

// Entrega
export interface Delivery {
  id: string;
  saleId: string;
  customerId: string;
  customerName: string;
  address: string;
  driverId?: string;
  driverName?: string;
  status: DeliveryStatus;
  createdAt: number;
  assignedAt?: number;
  deliveredAt?: number;
  notes?: string;
}

// Membro da Equipe
export interface TeamMember {
  id: string;
  name: string;
  role: 'vendedor' | 'entregador';
  phone: string;
  email?: string;
  cpf: string;
  status: 'ativo' | 'inativo' | 'pendente';
  startDate: number;
  commissionRate?: number;
  baseSalary?: number;
  salesCount: number;
  deliveriesCount: number;
  avatar?: string;
  lastLoginAt?: number;
  // GPS simulado
  lastLocation?: {
    lat: number;
    lng: number;
    updatedAt: number;
  };
}

// Recebimento (para prestação de contas)
export interface DailyReceipt {
  id: string;
  saleId?: string;
  installmentId?: string;
  amount: number;
  paymentMethod: PaymentMethod;
  proofImage?: string;
}

// Fechamento Diário
export interface DailyClosing {
  id: string;
  sellerId: string;
  sellerName: string;
  closingDate: number;
  cashAmount: number;
  cardAmount: number;
  pixAmount: number;
  installmentAmount: number;
  receipts: DailyReceipt[];
  salesIds: string[];
  installmentIds: string[];
  status: ClosingStatus;
  approvedBy?: string;
  approvedAt?: number;
  notes?: string;
}

// Sessão do Usuário (mock - localStorage)
export interface UserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  provider?: string;
  access_token?: string;
}

// Configurações do App
export interface AppSettings {
  appName: string;
  appLogo?: string;
  logoType?: 'icon' | 'image';
  whatsappNumber?: string;
}

// ============================================
// VIEWS DO SISTEMA
// ============================================

export type ViewState =
  // Comum
  | 'login'
  | 'register'
  // Gerente
  | 'dashboard'
  | 'stock'
  | 'stock-entry'
  | 'basket-models'
  | 'team'
  | 'manager-audit'
  | 'deliveries'
  | 'gps-tracking'
  | 'closing-approval'
  | 'receivables'
  | 'sales-list'
  | 'users-management'
  | 'analytics'
  | 'manager-customers'
  | 'seller-audit'
  // Vendedor
  | 'presential-sale'
  | 'customer-register'
  | 'installments'
  | 'daily-closing'
  | 'seller-management'
  | 'profile'
  // Cliente
  | 'customer-store'
  | 'customer-cart'
  | 'customer-checkout'
  | 'customer-orders'
  | 'customer-profile'
  | 'settings'
  | 'app-config'
  | 'forgot-password'
  | 'reset-password';

// Registro de Login
export interface LoginLog {
  id: string;
  user_id: string;
  email: string;
  user_agent: string;
  created_at: string;
}

// Registro de Auditoria (Ações no Banco de Dados)
export interface AuditLog {
  id: string;
  created_at: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  table_name: string;
  record_id?: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: any;
  new_data?: any;
}

// ============================================
// DADOS DO APP (para store)
// ============================================

export interface AppData {
  // Modelos e Estoque
  basketModels: BasketModel[];
  stockEntries: StockEntry[];
  stock: StockItem[];

  // Clientes e Vendas
  customers: Customer[];
  sales: Sale[];
  installments: Installment[];

  // Entregas
  deliveries: Delivery[];

  // Equipe
  team: TeamMember[];

  // Financeiro
  dailyClosings: DailyClosing[];
  goals: SaleGoal[];
  settings: AppSettings;
  loginLogs: LoginLog[];
  auditLogs: AuditLog[];
}
