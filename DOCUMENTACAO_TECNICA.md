# Documentação Técnica: Sistema de Gestão "Cesta Básica Na Sua Casa"

## 1. Visão Geral
Este sistema é uma plataforma ERP/E-commerce verticalizada para a gestão completa de operações de venda e distribuição de cestas básicas. Ele abrange desde a aquisição de insumos brutos, fabricação da cesta (receitas), gestão de estoque multicanal, força de vendas (vendedores de rua), venda empresarial (B2B) e logística de entrega com rastreamento.

### stack Tecnológica
- **Frontend:** React 18, TypeScript, Vite.
- **Design:** Sistema de design customizado com suporte a Dark Mode.
- **Backend:** Supabase (PostgreSQL 15 as a Service).
- **Segurança:** Autenticação via JWT, Row Level Security (RLS) e Functions (RPC) para lógica atômica.

---

## 2. Pilares de Segurança e Risco Zero (Anti-Fraude)
O sistema foi projetado com foco absoluto em integridade de dados e prevenção de perdas financeiras ou de estoque.

### A. Rastreabilidade Total (Audit Logs)
Toda e qualquer operação sensível no sistema gera um rastro imutável na tabela `audit_logs`.
- Alterações de preço.
- Edições de usuários/vendedores.
- Ajustes manuais de estoque.
- Exclusão de registros.
- **Mapeamento:** `public.audit_logs` (> 1.600 registros de trilha auditável).

### B. Controle de Acesso de Camada Tripla
1. **Autenticação:** Login seguro via Supabase Auth.
2. **Autorização (RBAC):** Níveis hierárquicos (Gerente, Vendedor, Entregador, Cliente).
3. **RLS (Row Level Security):** O banco de dados bloqueia acessos indevidos via servidor. Um vendedor nunca consegue ler dados brutos de outro vendedor ou alterar configurações globais, mesmo que tente manipular o código frontend.

### C. Lógica de Negócio Atômica (RPCs)
Lógicas críticas (como baixar estoque ao realizar venda) não ocorrem no computador do usuário, mas dentro do banco de dados via **Stored Procedures (RPCs)**. Isso garante que, se houver falha de internet no meio da transação, ou nada acontece ou tudo acontece, prevenindo estados inconsistentes ("Venda sem baixa de estoque").

---

## 3. Módulos Funcionais

### Módulo de Vendas (Omnichannel)
- **Venda Presencial:** Interface otimizada para vendedores de rua.
- **Venda Empresarial (B2B):** Fluxo dedicado para grandes contratos com faturamento centralizado e estoque segregado.
- **E-commerce (Cliente):** Loja online integrada para auto-serviço do consumidor final.

### Módulo de Estoque e Produção
- **Gestão de Insumos:** Controle de matérias-primas com cálculo de "Potencial de Produção".
- **Receitas Mestre:** Definição exata de itens por modelo de cesta.
- **Estoque Multicanal:** Separação lógica entre estoque de varejo (Geral) e Enterprise (Empresarial).
- **Calculadora de Compras:** Gera lista de faltantes e emissão de Pedido de Compra em PDF.

### Módulo Financeiro e Recebíveis
- **Gestão de Parcelas:** Controle de crediário próprio com gestão de status (Pago, Pendente, Atrasado).
- **Calendário de Recebíveis:** Visão mensal de fluxo de caixa esperado.
- **Fechamento de Caixa Diário:** Processo de prestação de contas dos vendedores com aprovação gerencial obrigatória.

---

## 4. Estrutura de Dados (Grandes Números)

O sistema é composto por **22 tabelas principais** e mais de **18 funções de banco de dados** personalizadas.

| Tabela | Função Principal |
| :--- | :--- |
| `public.sales` | Registro mestre de todas as transações comerciais. |
| `public.installments` | Controle granular de parcelamento e crediário. |
| `public.stock_entries` | Históricos de movimentação de produtos prontos. |
| `public.supplies` | Matérias-primas e insumos brutos. |
| `public.productions` | Registro de ordens de fabricação de cestas. |
| `public.audit_logs` | Registro de segurança de toda execução do sistema. |
| `public.login_logs` | Controle de acessos e logins (IP, Data, Usuário). |
| `public.daily_closings` | Conferência de caixa e prestação de contas. |

---

## 5. Auditoria e Rastreabilidade de Execução
Para garantir a integridade, o sistema mantém dois logs principais operando em tempo real:

1. **Logs de Acesso (`login_logs`):** Monitora todos os acessos ao sistema, permitindo identificar acessos suspeitos ou fora do horário comercial.
2. **Logs de Auditoria Administrativa:** Cada vez que um gerente altera uma configuração de sistema ou nível de permissão, o registro é salvo com o ID de quem executou, o que foi alterado e o valor anterior.

## 6. Conclusão para Precificação
Este é um sistema de **Classe Enterprise**, que resolve o problema de confiança entre proprietário e operação. O valor agregado reside na **eliminação do erro humano e da fraude**, garantindo que 100% das cestas que saem da empresa resultem em 100% de entrada financeira auditada ou parcelas devidamente documentadas com lastro.

A arquitetura moderna baseada em Supabase permite escalabilidade para milhares de usuários simultâneos sem perda de performance.
