# 📦 Documentação Completa do Sistema — Cesta Básica na sua Casa

**Versão:** 1.0  
**Data:** Março de 2026  
**Plataforma:** Web (SPA — Single Page Application)  
**URL de Produção:** https://compradomesnasuaporta.vercel.app

---

## 1. Visão Geral

O **Cesta Básica na sua Casa** é uma plataforma web completa e profissional para gerenciamento de vendas, estoque, entregas e equipe de uma operação de distribuição de cestas básicas. O sistema atende **4 perfis de usuário** (Gerente, Vendedor, Entregador e Cliente) com interfaces dedicadas para cada um, oferecendo desde uma loja virtual para clientes até um painel de BI (Business Intelligence) para o Gerente.

Trata-se de um sistema **sob medida**, desenvolvido com tecnologias de ponta, hospedado na nuvem e projetado para operação em tempo real.

---

## 2. Perfis de Usuário e Funcionalidades

### 2.1 👔 Gerente (Administrador)

O gerente tem acesso completo ao sistema e pode monitorar todas as operações do negócio.

| Módulo | Funcionalidades |
|---|---|
| **Dashboard Executivo** | Visão consolidada de vendas, estoque, entregas e metas em tempo real. Indicadores-chave (KPIs) de performance da operação. |
| **Painel de BI / Analytics** | Gráficos interativos de tendências semanais, distribuição por canal (online/presencial), análise de saúde do estoque, ranking de vendedores, exportação de relatórios para Excel (.xlsx). |
| **Gestão de Equipe** | Cadastro, edição, ativação/desativação de vendedores e entregadors. Controle de comissões e salário base. Verificação automática de duplicidade (CPF, e-mail, telefone). |
| **Gestão de Estoque** | Cadastro de modelos de cesta (nome, preço, peso, imagem, descrição). Registro de entradas de estoque com fornecedor e custo unitário. Controle de quantidade disponível por modelo. |
| **Modelos de Cestas** | Criação e edição de cestas com atributos configuráveis: preço, peso, imagem, status (ativa/inativa), destaque, mais vendida, ordem de exibição, avaliação. |
| **Gestão de Entregas** | Atribuição de entregadores a entregas pendentes. Acompanhamento de status (Pendente → Atribuída → Em Rota → Entregue). |
| **Aprovação de Fechamentos** | Revisão e aprovação/rejeição dos fechamentos diários enviados pelos vendedores. Detalhamento com valores em PIX, cartão, dinheiro e parcelas. |
| **Gestão de Vendas** | Listagem completa de todas as vendas com filtros. Detalhamento por vendedor, cliente, canal e status. |
| **Gestão de Usuários** | Gerenciamento de papéis (roles) dos usuários do sistema. Promoção/rebaixamento de perfis. |
| **Configurações do App** | Personalização do nome e logo da aplicação. Configuração do número de WhatsApp para suporte. |
| **Metas de Vendas** | Criação de metas gerais, por vendedor ou por canal (online/presencial). Períodos configuráveis: diárias, quinzenais, mensais ou customizadas. |

---

### 2.2 🧑‍💼 Vendedor

O vendedor possui um painel simplificado focado na operação de vendas presenciais e acompanhamento de metas.

| Módulo | Funcionalidades |
|---|---|
| **Dashboard do Vendedor** | Resumo das vendas do dia, parcelas pendentes, metas ativas e progresso. |
| **Venda Presencial** | Registro de venda presencial com seleção de cliente, cestas, quantidade, forma de pagamento (PIX, Cartão, A Prazo, Na Entrega) e valor de troco. Cálculo automático de parcelas para vendas a prazo. |
| **Cadastro de Clientes** | Cadastro rápido de novos clientes com validação de CPF (algoritmo completo de dígitos verificadores), telefone e e-mail. Busca por clientes existentes. |
| **Gestão de Parcelas** | Visualização de parcelas pendentes e atrasadas. Registro de pagamento de parcelas com comprovante. |
| **Fechamento Diário** | Seleção manual das vendas a incluir no fechamento. Resumo detalhado por forma de pagamento. Envio para aprovação do gerente. |
| **Perfil do Vendedor** | Visualização e edição do próprio perfil. Logout seguro. |

---

### 2.3 🚚 Entregador

O entregador possui uma interface simples e objetiva para gerenciar suas entregas.

| Módulo | Funcionalidades |
|---|---|
| **Entregas Atribuídas** | Lista de entregas atribuídas ao entregador com endereço do cliente, dados de contato e notas. |
| **Atualização de Status** | Alteração do status de entrega: Em Rota → Entregue / Problema. |
| **Perfil** | Edição de dados pessoais e logout. |

---

### 2.4 🛒 Cliente (Loja Online)

O cliente possui acesso a uma loja virtual completa integrada ao sistema.

| Módulo | Funcionalidades |
|---|---|
| **Loja Virtual (Vitrine)** | Exibição dos modelos de cestas disponíveis com imagem, preço, peso, avaliação e selo de destaque/mais vendida. |
| **Carrinho de Compras** | Adição/remoção de cestas ao carrinho com controle de quantidade. Resumo do pedido com total. |
| **Checkout Completo** | Fluxo de finalização com seleção de endereço (cadastrado ou novo), forma de pagamento (PIX, Cartão, A Prazo, Na Entrega), configuração de parcelas, campo para troco e notas. Integração automática com estoque. |
| **Meus Pedidos** | Acompanhamento do status dos pedidos em tempo real. Histórico completo de compras. Solicitação de cancelamento. |
| **Meu Perfil** | Edição de dados pessoais, endereço e senha. |
| **Suporte via WhatsApp** | Botão flutuante de WhatsApp para contato direto com o suporte da empresa. |

---

## 3. Arquitetura Técnica

### 3.1 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    CLIENTE (Browser)                │
│                                                     │
│  React 19 + TypeScript + TailwindCSS + Vite 6       │
│  SPA (Single Page Application)                       │
│  27 Telas + 3 Componentes Reutilizáveis             │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (API REST + Realtime WebSocket)
                       ▼
┌─────────────────────────────────────────────────────┐
│                   SUPABASE (BaaS)                   │
│                                                     │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ Auth    │  │ Realtime │  │ PostgreSQL DB    │   │
│  │ (OAuth  │  │ (WebSocket│  │ (Row Level       │   │
│  │  + JWT) │  │  Pub/Sub)│  │  Security - RLS) │   │
│  └─────────┘  └──────────┘  └──────────────────┘   │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │ Storage (CDN)   │  │ Edge Functions (Deno)   │   │
│  └─────────────────┘  └─────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                 VERCEL (Hosting)                     │
│                                                     │
│  CDN Global · SSL · CI/CD · Edge Network             │
└─────────────────────────────────────────────────────┘
```

### 3.2 Stack Tecnológica Detalhada

| Camada | Tecnologia | Versão | Propósito |
|---|---|---|---|
| **Frontend** | React | 19.2.3 | Biblioteca de UI com componentes declarativos |
| **Linguagem** | TypeScript | 5.8.2 | Tipagem estática para maior segurança e manutenção |
| **Estilização** | TailwindCSS | CDN (último) | Framework CSS utilitário com design system customizado |
| **Tipografia** | Plus Jakarta Sans | Google Fonts | Fonte premium moderna |
| **Ícones** | Material Symbols Outlined | Google Fonts | Biblioteca de ícones do Google Material Design |
| **Build** | Vite | 6.2.0 | Bundler ultrarrápido com HMR (Hot Module Replacement) |
| **Backend (BaaS)** | Supabase | 2.95.3 | Backend-as-a-Service com PostgreSQL, Auth, Realtime |
| **Banco de Dados** | PostgreSQL | 15+ (Supabase) | Banco relacional open-source, gerenciado na nuvem |
| **Autenticação** | Supabase Auth | Integrado | OAuth 2.0, JWT, verificação por e-mail |
| **Exportação** | SheetJS (xlsx) | 0.18.5 | Geração de planilhas Excel para relatórios |
| **Hosting** | Vercel | — | Deploy contínuo, CDN global, SSL automático |
| **Design** | Glassmorphism + Dark Mode | — | UI moderna com efeitos de vidro fosco e tema escuro |

---

## 4. Estrutura do Banco de Dados

O banco de dados PostgreSQL possui as seguintes tabelas principais:

| Tabela | Descrição | Registros por Tabela |
|---|---|---|
| `profiles` | Perfis de todos os usuários (gerentes, vendedores, entregadores) | Usuários do sistema |
| `customers` | Cadastro de clientes com endereço completo | Base de clientes |
| `basket_models` | Modelos de cestas (Pequena, Grande, Big, etc.) | Catálogo de produtos |
| `stock_entries` | Entradas de estoque com fornecedor e custo | Histórico de compras |
| `sales` | Vendas realizadas (online e presenciais) | Transações comerciais |
| `sale_items` | Itens de cada venda (quantidade, preço unitário) | Detalhamento das vendas |
| `installments` | Parcelas de vendas a prazo | Controle financeiro |
| `deliveries` | Entregas com status e motorista atribuído | Logística |
| `daily_closings` | Fechamentos diários dos vendedores | Prestação de contas |
| `daily_receipts` | Recibos individuais dentro do fechamento | Comprovantes |
| `sale_goals` | Metas de vendas (gerais, por vendedor, por canal) | Planejamento |
| `app_config` | Configuração de nome, logo e WhatsApp do app | Personalização |
| `login_logs` | Registro de logins com user agent e timestamp | Auditoria |

### 4.1 Relacionamentos Principais

```
profiles ──┬── sales (vendedor → venda)
           ├── deliveries (entregador → entrega)
           ├── daily_closings (vendedor → fechamento)
           └── login_logs (usuário → log)

customers ──┬── sales (cliente → venda)
            ├── deliveries (cliente → entrega)
            └── installments (cliente → parcela)

basket_models ──┬── stock_entries (modelo → entrada)
               └── sale_items (modelo → item vendido)

sales ──┬── sale_items (venda → itens)
        ├── installments (venda → parcelas)
        └── deliveries (venda → entrega)
```

---

## 5. Segurança

### 5.1 Autenticação

| Recurso | Implementação |
|---|---|
| **Login por E-mail/Senha** | Autenticação nativa do Supabase com hash bcrypt seguro |
| **Login com Google (OAuth 2.0)** | Autenticação social integrada via Provider Google |
| **Recuperação de Senha** | Fluxo completo: solicitação por e-mail → link de recuperação → tela de definição de nova senha |
| **JWT (JSON Web Tokens)** | Tokens assinados para cada sessão autenticada, com expiração automática |
| **Registro de Logins** | Todas as sessões são registradas com timestamp e user agent para auditoria |

### 5.2 Autorização (Row Level Security — RLS)

O sistema utiliza **Row Level Security (RLS)** do PostgreSQL, que é o padrão mais seguro para controle de acesso em nível de linha no banco de dados. Cada tabela tem políticas específicas:

| Política | Descrição |
|---|---|
| **Isolamento por Perfil** | Cada usuário só pode acessar os dados que são relevantes ao seu papel (gerente, vendedor, entregador ou cliente) |
| **Gerente - Acesso Total** | Gerentes podem visualizar, criar, editar e excluir registros de toda a operação |
| **Vendedor - Acesso Restrito** | Vendedores só podem ver e gerenciar seus próprios dados (vendas, fechamentos, etc.) |
| **Cliente - Dados Próprios** | Clientes só acessam seu próprio perfil e seus pedidos |
| **Funções SECURITY DEFINER** | Operações críticas (como cadastro de equipe) utilizam funções protegidas no banco que verificam permissões antes de executar, evitando vulnerabilidades |

### 5.3 Validações no Frontend

| Validação | Descrição |
|---|---|
| **CPF** | Algoritmo completo de validação dos dígitos verificadores do CPF brasileiro |
| **E-mail** | Validação de formato de e-mail |
| **Telefone** | Formatação automática para padrão brasileiro |
| **Duplicidade** | Verificação em tempo real se CPF, e-mail ou telefone já estão cadastrados para outro usuário (via RPC `check_profile_conflict`) |
| **Senha** | Requisito mínimo de 6 caracteres para definição de novas senhas |

### 5.4 Infraestrutura de Segurança

| Recurso | Detalhes |
|---|---|
| **HTTPS/SSL** | Todo o tráfego é criptografado via certificado SSL da Vercel (TLS 1.3) |
| **Variáveis de Ambiente** | Chaves de API armazenadas em variáveis de ambiente, nunca no código-fonte |
| **CDN Global** | Conteúdo distribuído via rede global da Vercel para máxima disponibilidade |
| **Banco Gerenciado** | PostgreSQL hospedado e monitorado pela Supabase com backups automáticos |
| **Anon Key + RLS** | A chave pública (anon key) é combinada com RLS, garantindo que mesmo com exposição ao frontend, os dados ficam protegidos |

---

## 6. Funcionalidades Técnicas Avançadas

### 6.1 Atualização em Tempo Real (Realtime)
O sistema utiliza **WebSockets** via Supabase Realtime para sincronizar dados entre múltiplos usuários conectados simultaneamente. Quando um vendedor cria uma venda, o gerente vê a atualização no dashboard automaticamente.

### 6.2 PWA-Ready (Progressive Web App)
A aplicação é uma SPA (Single Page Application) otimizada para dispositivos móveis, com interface responsiva que se adapta a qualquer tamanho de tela.

### 6.3 Exportação de Relatórios
O módulo de Analytics permite exportar dados para **planilhas Excel (.xlsx)** com formatação, permitindo ao gerente analisar dados offline.

### 6.4 Design System Personalizado
A interface utiliza um design system profissional com:
- **Glassmorphism**: Efeitos de vidro fosco para um visual premium
- **Dark Mode**: Suporte completo a tema escuro
- **Micro-animações**: Transições suaves para uma experiência fluida
- **Cores Personalizadas**: Paleta de cores da marca (azul primário `#0a4da3`, amarelo secundário `#F5B301`)

### 6.5 Integração com WhatsApp
Botão flutuante configurável pelo gerente para contato direto com suporte via WhatsApp, disponível em todas as telas do sistema.

### 6.6 Sistema de Metas
Planejamento de metas de vendas com suporte a:
- Metas **gerais** para toda a operação
- Metas **por vendedor** individual
- Metas **por canal** (online vs. presencial)
- Períodos: diário, quinzenal, mensal ou customizado
- Acompanhamento de progresso em tempo real

### 6.7 Checkout Inteligente
Fluxo de checkout com:
- Seleção automática de endereço cadastrado
- Cálculo automático de parcelas
- Suporte a múltiplas formas de pagamento
- Validação de estoque em tempo real
- Campo para troco e observações

---

## 7. Telas do Sistema (27 Interfaces)

| # | Tela | Perfil | Descrição |
|---|---|---|---|
| 1 | Login | Todos | Autenticação com e-mail/senha e Google |
| 2 | Registro | Clientes | Cadastro de novos clientes |
| 3 | Recuperar Senha | Todos | Fluxo de recuperação via e-mail |
| 4 | Dashboard Gerente | Gerente | Painel executivo com KPIs |
| 5 | Dashboard Vendedor | Vendedor | Resumo de vendas e metas |
| 6 | Analytics / BI | Gerente | Gráficos, tendências e exportação Excel |
| 7 | Gestão de Equipe | Gerente | CRUD de vendedores e entregadores |
| 8 | Estoque | Gerente | Visão geral do estoque por modelo |
| 9 | Entrada de Estoque | Gerente | Registro de novas entradas |
| 10 | Modelos de Cestas | Gerente | CRUD completo de cestas |
| 11 | Gestão de Entregas | Gerente/Entregador | Atribuição e acompanhamento |
| 12 | Aprovação de Fechamentos | Gerente | Revisão e aprovação de caixas |
| 13 | Listagem de Vendas | Gerente | Todas as vendas com filtros |
| 14 | Gestão de Usuários | Gerente | Controle de permissões |
| 15 | Configurações do App | Gerente | Personalização de marca |
| 16 | Metas de Vendas | Gerente | Planejamento de metas |
| 17 | Venda Presencial | Vendedor | Registro de vendas em campo |
| 18 | Cadastro de Clientes | Vendedor | Cadastro rápido em campo |
| 19 | Gestão de Parcelas | Vendedor | Controle de recebíveis |
| 20 | Fechamento Diário | Vendedor | Prestação de contas |
| 21 | Perfil do Vendedor | Vendedor | Dados pessoais |
| 22 | Loja Virtual | Cliente | Vitrine de cestas |
| 23 | Carrinho | Cliente | Resumo do pedido |
| 24 | Checkout | Cliente | Finalização da compra |
| 25 | Meus Pedidos | Cliente | Acompanhamento de pedidos |
| 26 | Meu Perfil | Cliente | Dados pessoais do cliente |
| 27 | Layout / Navegação | Todos | Menu lateral, header, bottom navigation |

---

## 8. Infraestrutura e Deploy

| Aspecto | Detalhes |
|---|---|
| **Hospedagem Frontend** | Vercel (CDN global, SSL automático, edge network) |
| **Hospedagem Backend** | Supabase Cloud (PostgreSQL gerenciado, Auth, Realtime, Storage) |
| **CI/CD** | Deploy automático via Git push (integração Vercel ↔ GitHub) |
| **Domínio** | `compradomesnasuaporta.vercel.app` (customizável para domínio próprio) |
| **Disponibilidade** | 99.9% uptime (SLA Vercel + Supabase) |
| **Região** | Infraestrutura distribuída globalmente |
| **Backups** | Backups automáticos diários do banco de dados (Supabase) |

---

## 9. Resumo Quantitativo do Projeto

| Métrica | Valor |
|---|---|
| **Telas/Interfaces** | 27 |
| **Componentes Reutilizáveis** | 3 (Layout, InvoiceModal, DeliveryDetailsModal) |
| **Perfis de Usuário** | 4 (Gerente, Vendedor, Entregador, Cliente) |
| **Tabelas no Banco** | 13+ |
| **Funções RPC (Banco)** | 3+ (check_profile_conflict, upsert_team_member, get_stock_summary, etc.) |
| **Linhas de Código (Estimativa)** | ~15.000+ linhas TypeScript/TSX |
| **Integrações Externas** | Google OAuth, WhatsApp, Supabase Auth/Realtime/Storage |
| **Formas de Pagamento** | 4 (PIX, Cartão, A Prazo, Na Entrega) |
| **Tipos de Relatório** | Analytics com exportação Excel |
| **Responsividade** | Mobile-first, adapta a qualquer dispositivo |
| **Tempo de Desenvolvimento** | Projeto contínuo com evoluções incrementais |

---

## 10. Diferenciais Competitivos

1. **Sistema 100% sob medida** — Não é um template ou WordPress. Cada funcionalidade foi desenvolvida especificamente para o modelo de negócio de distribuição de cestas básicas.

2. **Multi-perfil com controle fino de permissões** — O sistema diferencia claramente as interfaces e acessos de cada tipo de usuário, com segurança verificada em nível de banco de dados (não apenas no frontend).

3. **Loja Virtual Integrada** — O cliente final pode fazer pedidos diretamente pelo sistema, eliminando a necessidade de plataformas externas de e-commerce.

4. **BI e Analytics** — Dashboard avançado com gráficos de tendência, ranking de vendedores, distribuição de canais e exportação para Excel.

5. **Fechamento Financeiro Auditável** — Fluxo completo de prestação de contas dos vendedores com aprovação/rejeição pelo gerente.

6. **Design Premium** — Interface moderna com glassmorphism, dark mode, animações suaves e tipografia premium (Plus Jakarta Sans).

7. **Tecnologias de Ponta** — React 19, TypeScript 5.8, Vite 6, Supabase, PostgreSQL com RLS — stack profissional usado por empresas como Notion, Linear e Vercel.

8. **Escalável** — A arquitetura permite escalar para centenas de usuários simultâneos sem modificações na infraestrutura.

---

*Documento gerado em Março de 2026.*  
*Sistema desenvolvido com tecnologias profissionais de mercado.*
