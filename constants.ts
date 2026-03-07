// ============================================
// CONSTANTES DO SISTEMA CESTA BÁSICA
// ============================================

export const APP_STORAGE_KEY = 'cesta-basica-app-data';
export const SESSION_STORAGE_KEY = 'cesta-basica-session';

// Imagens de exemplo para cestas
export const BASKET_IMAGES = {
  pequena: 'https://images.unsplash.com/photo-1534483509719-3feaee7c30da?w=800&q=80',
  grande: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80',
  familia: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=800&q=80',
  premium: 'https://images.unsplash.com/photo-1573246123716-6b1782bfc499?w=800&q=80',
};

// Avatares de exemplo
export const AVATAR_IMAGES = {
  gerente: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80',
  vendedor1: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80',
  vendedor2: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&q=80',
  entregador1: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80',
  entregador2: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80',
  cliente: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80',
};

// Coordenadas de exemplo (São Paulo)
export const DEFAULT_LOCATION = {
  lat: -23.5505,
  lng: -46.6333,
};

// Fornecedores de exemplo
export const SUPPLIERS = [
  'Atacadão',
  'Makro',
  'Assaí',
  'Sam\'s Club',
  'Outro'
];

// Meta diária padrão
export const DAILY_GOAL = 10000;

// Cores do tema
export const THEME_COLORS = {
  primary: '#3B82F6',
  secondary: '#F59E0B',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

// Mapeamento de Estados - Nomes para Siglas (UF)
export const BRAZIL_STATES_MAP: Record<string, string> = {
  'Acre': 'AC',
  'Alagoas': 'AL',
  'Amapá': 'AP',
  'Amazonas': 'AM',
  'Bahia': 'BA',
  'Ceará': 'CE',
  'Distrito Federal': 'DF',
  'Espírito Santo': 'ES',
  'Goiás': 'GO',
  'Maranhão': 'MA',
  'Mato Grosso': 'MT',
  'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG',
  'Pará': 'PA',
  'Paraíba': 'PB',
  'Paraná': 'PR',
  'Pernambuco': 'PE',
  'Piauí': 'PI',
  'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS',
  'Rondônia': 'RO',
  'Roraima': 'RR',
  'Santa Catarina': 'SC',
  'São Paulo': 'SP',
  'Sergipe': 'SE',
  'Tocantins': 'TO',
};
