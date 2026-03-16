import React, { useState } from 'react';
import { ViewState, UserSession, UserRole, AppSettings } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  setView: (v: ViewState) => void;
  user: UserSession;
  onLogout: () => void;
  cartCount?: number;
  deliveryCount?: number;
  settings?: AppSettings;
}

// Configuração de menu por role
const getMenuItems = (role: UserRole): { icon: string; label: string; view: ViewState }[] => {
  switch (role) {
    case 'gerente':
      return [
        { icon: 'dashboard', label: 'Dashboard', view: 'dashboard' },
        { icon: 'query_stats', label: 'Insights', view: 'analytics' },
        { icon: 'inventory_2', label: 'Estoque', view: 'stock' },
        { icon: 'add_box', label: 'Entrada', view: 'stock-entry' },
        { icon: 'category', label: 'Modelos', view: 'basket-models' },
        { icon: 'person_search', label: 'Clientes', view: 'manager-customers' },
        { icon: 'group', label: 'Equipe', view: 'team' },
        {icon: 'local_shipping', label: 'Entregas', view: 'deliveries'},
        {icon: 'receipt_long', label: 'Fechar Caixa', view: 'closing-approval'},
        { icon: 'payments', label: 'Parcelado', view: 'receivables' },
        { icon: 'list_alt', label: 'Vendas', view: 'sales-list' },
        { icon: 'ads_click', label: 'Metas', view: 'settings' },
        { icon: 'settings', label: 'Configurações', view: 'app-config' },
        { icon: 'account_circle', label: 'Perfil', view: 'profile' },
      ];
    case 'vendedor':
      return [
        { icon: 'dashboard', label: 'Início', view: 'dashboard' },
        { icon: 'point_of_sale', label: 'Vender', view: 'presential-sale' },
        { icon: 'analytics', label: 'Vendas', view: 'sales-list' },
        { icon: 'local_shipping', label: 'Entregas', view: 'deliveries' },
        { icon: 'person_add', label: 'Clientes', view: 'customer-register' },
        { icon: 'credit_score', label: 'Parcelado', view: 'installments' },
        { icon: 'receipt_long', label: 'Fechar Caixa', view: 'daily-closing' },
        { icon: 'inventory_2', label: 'Estoque', view: 'stock' },
        { icon: 'account_circle', label: 'Perfil', view: 'profile' },
      ];
    case 'entregador':
      return [
        { icon: 'dashboard', label: 'Início', view: 'dashboard' },
        {icon: 'local_shipping', label: 'Entregas', view: 'deliveries'},
        {icon: 'account_circle', label: 'Perfil', view: 'profile'},
      ];
    case 'cliente':
      return [
        { icon: 'home', label: 'Início', view: 'customer-store' },
        { icon: 'grid_view', label: 'Categorias', view: 'customer-store' },
        { icon: 'receipt', label: 'Pedidos', view: 'customer-orders' },
        { icon: 'shopping_cart', label: 'Carrinho', view: 'customer-cart' },
      ];
    default:
      return [];
  }
};

const getRoleLabel = (role: UserRole): string => {
  switch (role) {
    case 'gerente': return 'Gerente';
    case 'vendedor': return 'Vendedor';
    case 'entregador': return 'Entregador';
    case 'cliente': return 'Cliente';
    default: return '';
  }
};

const getRoleColor = (role: UserRole): string => {
  switch (role) {
    case 'gerente': return 'from-purple-500 to-indigo-500';
    case 'vendedor': return 'from-primary to-blue-500';
    case 'entregador': return 'from-secondary to-amber-500';
    case 'cliente': return 'from-secondary to-warning';
    default: return 'from-slate-500 to-slate-600';
  }
};

const getRoleTextColor = (role: UserRole): string => {
  switch (role) {
    case 'gerente': return 'text-purple-700 dark:text-purple-400';
    case 'vendedor': return 'text-primary dark:text-blue-400';
    case 'entregador': return 'text-amber-700 dark:text-amber-400';
    case 'cliente': return 'text-pink-700 dark:text-pink-400';
    default: return 'text-slate-600 dark:text-slate-400';
  }
};

const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  setView,
  user,
  onLogout,
  cartCount = 0,
  deliveryCount = 0,
  settings,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const menuItems = getMenuItems(user.role);
  const isCustomer = user.role === 'cliente';
  const appName = settings?.appName || 'Cesta Básica na sua Casa';

  return (
    <div className={`flex flex-col h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white ${currentView === 'analytics' ? 'max-w-[1280px]' : 'max-w-md'} mx-auto relative overflow-hidden shadow-2xl transition-all duration-500`}>
      {/* Top Header */}
      <header className="flex-shrink-0 px-4 pt-4 pb-2 space-y-4">
        {/* Row 1: App Name (Clickable for Home) - Hidden on BI View for Space */}
        {currentView !== 'analytics' && (
          <div className="flex justify-center">
            <button
              onClick={() => setView(isCustomer ? 'customer-store' : 'dashboard')}
              className="bg-[#0a4da3] px-6 py-2 rounded-full shadow-lg border border-white/10 ring-4 ring-[#0a4da3]/5 active:scale-95 hover:scale-105 transition-all cursor-pointer"
            >
              <h1 className="text-[12px] xs:text-sm font-black text-white leading-tight uppercase tracking-[0.2em] text-center max-w-[260px] break-words drop-shadow-md">
                {appName}
              </h1>
            </button>
          </div>
        )}

        {/* Row 2: Menu | User Profile | Logout/Settings */}
        <div className="flex items-center justify-between gap-3 bg-white/50 dark:bg-slate-800/50 p-1 rounded-[24px] backdrop-blur-md border border-white/20 dark:border-slate-700/30">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`size-11 flex items-center justify-center ${isCustomer ? 'rounded-full' : 'rounded-2xl'} bg-white dark:bg-slate-800 shadow-sm active:scale-95 transition-transform shrink-0 border border-slate-100 dark:border-slate-700`}
            >
              <span className="material-symbols-outlined text-primary">menu</span>
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className={`size-10 ${isCustomer ? 'rounded-full' : 'rounded-2xl'} object-cover border-2 border-white dark:border-slate-700 shadow-md shrink-0`}
                />
              ) : (
                <div className={`size-10 ${isCustomer ? 'rounded-full' : 'rounded-2xl'} bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 shadow-md shrink-0`}>
                  <span className="material-symbols-outlined text-xl">person</span>
                </div>
              )}
              <div className="text-left min-w-0">
                <p className="font-bold text-xs xs:text-sm leading-tight text-slate-900 dark:text-white truncate">
                  {user.name}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className={`text-[9px] xs:text-[10px] font-black uppercase tracking-widest ${getRoleTextColor(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isCustomer ? (
              <button
                onClick={() => setView('customer-profile')}
                className="size-11 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm active:scale-95 transition-transform border border-slate-100 dark:border-slate-700"
              >
                <span className="material-symbols-outlined text-slate-700 dark:text-slate-300">settings</span>
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="size-11 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm active:scale-95 transition-transform text-danger"
              >
                <span className="material-symbols-outlined text-xl font-bold">logout</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {children}
      </main>

      {/* Bottom Navigation (Hidden on Desktop Analytics) */}
      {currentView !== 'analytics' && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 px-2 py-2 z-40">
          <div className="flex items-center justify-around">
            {menuItems.slice(0, 4).map((item) => {
              const isActive = currentView === item.view;
              const isSpecial = item.label === 'Carrinho';
              const isDeliveries = item.view === 'deliveries';

              if (isSpecial) {
                return (
                  <button
                    key={item.label}
                    onClick={() => setView(item.view)}
                    className="relative -top-3 flex flex-col items-center justify-center px-3 py-2"
                  >
                    <div className={`size-14 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-90 ${isActive ? 'bg-secondary text-slate-950' : 'bg-[#F2AE01] text-slate-950'}`}>
                      <span className="material-symbols-outlined text-2xl font-bold">
                        {item.icon}
                      </span>
                      {cartCount > 0 && (
                        <span className="absolute top-0 right-2 size-5 bg-[#0a4da3] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                          {cartCount}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold mt-1 ${isActive ? 'text-secondary' : 'text-slate-400'}`}>{item.label}</span>
                  </button>
                );
              }

              return (
                <button
                  key={item.label}
                  onClick={() => setView(item.view)}
                  className={`relative flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-all ${isActive
                    ? 'text-primary'
                    : 'text-slate-400'
                    }`}
                >
                  <div className="relative">
                    <span className={`material-symbols-outlined text-2xl ${isActive ? 'font-black' : ''}`}>
                      {item.icon}
                    </span>
                    {isDeliveries && deliveryCount > 0 && (
                      <span className="absolute -top-1 -right-1 size-4 bg-yellow-500 text-slate-900 text-[9px] font-bold rounded-full flex items-center justify-center border border-white dark:border-slate-900 animate-pulse">
                        {deliveryCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold mt-0.5">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        >
          {/* Sidebar Content */}
          <div
            className="absolute left-0 top-0 bottom-0 w-4/5 max-w-[300px] bg-white dark:bg-slate-900 shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sidebar Header */}
            <div className={`p-6 bg-gradient-to-br ${getRoleColor(user.role)} text-white`}>
              <div className="flex justify-between items-start mb-4">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="size-16 rounded-2xl object-cover border-2 border-white/20 shadow-lg" />
                ) : (
                  <div className="size-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/10">
                    <span className="material-symbols-outlined text-3xl">person</span>
                  </div>
                )}
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="size-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <h3 className="font-black text-lg leading-tight">{user.name}</h3>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-1">
                {getRoleLabel(user.role)}
              </p>
            </div>

            {/* Sidebar Menu */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">Navegação</p>
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    setView(item.view);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex items-center gap-4 w-full p-4 rounded-2xl transition-all ${currentView === item.view
                    ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                >
                  <span className="material-symbols-outlined">{item.icon}</span>
                  <span className="font-bold text-sm tracking-tight">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  onLogout();
                  setIsSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-danger font-bold hover:bg-danger/5 transition-all active:scale-95"
              >
                <span className="material-symbols-outlined">logout</span>
                <span className="text-sm uppercase tracking-widest">Sair do Sistema</span>
              </button>
              <p className="text-center text-[8px] text-slate-300 mt-4 uppercase font-bold tracking-widest">
                v1.1.0 • {appName}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* WhatsApp Floating Button - Only for online store (customers) */}
      {isCustomer && settings?.whatsappNumber && (
        <a
          href={`https://wa.me/${settings.whatsappNumber.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-24 right-6 z-[60] size-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-2xl shadow-[#25D366]/40 hover:scale-110 active:scale-95 transition-all animate-bounce duration-[3000ms]"
          title="Fale conosco no WhatsApp"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-8 fill-current"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.659 1.432 5.631 1.433h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}
    </div>
  );
};

export default Layout;
