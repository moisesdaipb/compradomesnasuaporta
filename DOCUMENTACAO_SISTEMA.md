# Documentação Técnica e Funcional: Sistema "Cesta Básica na sua Casa"

Este documento detalha a arquitetura, as funcionalidades e as tecnologias empregadas no desenvolvimento do sistema **Cesta Básica na sua Casa**, uma solução completa para gestão de vendas, logística e relacionamento com o cliente.

---

### Classificação do Sistema
O sistema é uma plataforma híbrida de **ERP (Gestão de Recursos), CRM (Relacionamento com Cliente), E-commerce e Inteligência de Negócios (BI)**, focada em logística de distribuição direta ao consumidor.
*   **ERP (Enterprise Resource Planning):** Gestão de estoque, fechamento de caixa, controle financeiro e metas.
*   **CRM (Customer Relationship Management):** Cadastro detalhado de clientes, histórico de compras e gestão de parcelas.
*   **Vendas Online (E-commerce):** Portal do cliente para visualização de produtos, carrinho e checkout.
*   **Gestão Logística:** Controle de entregas em tempo real com atribuição de motoristas e status de rota.

---

## 2. Stack Tecnológica

### Frontend
*   **React 19:** Biblioteca principal para construção da interface de usuário.
*   **TypeScript:** Garantia de tipagem forte e redução de bugs em tempo de desenvolvimento.
*   **Vite:** Build tool ultra-rápida para desenvolvimento e otimização de produção.
*   **CSS Moderno (Vanilla):** Design baseado em *Glassmorphism* (efeito de vidro frost), cores vibrantes e micro-animações.
*   **XLSX:** Integração para exportação de relatórios financeiros para Excel.

### Backend & Infraestrutura (Serverless)
*   **Supabase:** Plataforma Backend-as-a-Service (BaaS) que provê:
    *   **PostgreSQL:** Banco de dados relacional robusto.
    *   **Auth:** Gerenciamento de usuários e níveis de acesso (RBAC).
    *   **Real-time:** Sincronização de dados instantânea entre vendedor e gerente via WebSockets.
    *   **Storage:** Armazenamento de imagens de produtos e documentos.
    *   **Postgres Functions (RPC):** Lógica complexa de negócio executada diretamente no banco de dados para máxima performance.

---

## 3. Arquitetura de Dados (Banco de Dados)
O sistema possui **14 tabelas principais** devidamente normalizadas:

1.  `basket_models`: Catálogo de cestas e atributos (preço, peso, imagem).
2.  `basket_model_items`: Detalhamento dos itens internos de cada cesta.
3.  `customers`: Cadastro unificado de clientes (CPF, endereços, contatos).
4.  `profiles`: Perfis de usuários (Gerentes, Vendedores, Entregadores, Clientes).
5.  `sales`: Cabeçalho das transações (canal, método de pagamento, status).
6.  `sale_items`: Itens vinculados a cada venda.
7.  `installments`: Controle de parcelamento para vendas "A Prazo".
8.  `deliveries`: Gestão de logística e status de entrega.
9.  `stock_entries`: Histórico de entrada de mercadorias e custo de aquisição.
10. `daily_closings`: Prestação de contas diária dos vendedores/entregadores.
11. `daily_receipts`: Vínculo entre pagamentos recebidos e fechamentos de caixa.
12. `sale_goals`: Definição e acompanhamento de metas (Diárias, Mensais, etc).
13. `app_config`: Configurações globais de marca (Logotipo, Nome do App).
14. `login_logs`: Auditoria de acessos ao sistema.

---

## 4. Estrutura de Telas e Dashboards (26+ Visualizações)

### Painel do Gerente (Controle Master)
*   **Dashboard:** Visão geral de vendas, estoque crítico e desempenho de equipe.
*   **Stock & Stock Entry:** Inventário em tempo real e registro de novas entradas.
*   **Team Management:** Cadastro e gestão de comissões de vendedores/entregadores.
*   **Deliveries & GPS Tracking:** Monitoramento geográfico e status das entregas.
*   **Closing Approval:** Auditoria financeira de todos os fechamentos de caixa da equipe.
*   **Manager Sales:** Listagem global de vendas com filtros avançados e exportação.

### Painel do Vendedor (Operacional)
*   **Seller Management:** Acompanhamento de metas pessoais e valores em mãos.
*   **Presential Sale:** Interface otimizada para vendas físicas rápidas.
*   **Customer Register:** Registro rápido de novos clientes no momento da venda.
*   **Installments:** Gestão de cobrança de parcelas em aberto.
*   **Daily Closing:** Fluxo de prestação de contas no final do expediente.

### Portal do Cliente (Vendas Online)
*   **Customer Store:** Vitrine virtual de cestas básicas.
*   **Cart & Checkout:** Fluxo fluido de compra com validação de dados.
*   **My Orders:** Acompanhamento de status de pedidos e histórico.
*   **Customer Profile:** Auto-gestão de endereço e dados pessoais.

### Administração e Configurações
*   **User Management:** Controle de papéis (quem é gerente, vendedor, etc).
*   **App Config:** Personalização visual do sistema pelo administrador.

---

## 5. Diferenciais Competitivos
- **Segurança Nativa (RLS)**: Cada usuário só acessa o que lhe é permitido.
- **Painel de BI Avançado**: Visões analíticas exclusivas para gerentes sobre saúde financeira, comportamento de clientes e auditoria de equipe.
- **Performance em Tempo Real**: Sincronização automática via Supabase Realtime.
- **Responsividade Total:** Funciona perfeitamente em celulares (vendedores/entregadores) e tablets/desktops (gerentes).
- **Offline-First Initializer:** O app pré-carrega configurações essenciais para um carregamento visual instantâneo.

---
**Documento gerado em:** 21 de Fevereiro de 2026.
