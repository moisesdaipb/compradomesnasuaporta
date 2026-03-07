# Manual Técnico de Engenharia: Sistema "Cesta Básica na sua Casa"

Este manual é destinado a desenvolvedores e arquitetos de software que realizarão a manutenção ou expansão deste sistema. Ele descreve a lógica profunda, os fluxos de dados e as integrações críticas.

---

## 1. Arquitetura do Sistema

O sistema segue uma arquitetura **BaaS (Backend as a Service)** com uma camada de frontend altamente desacoplada e reativa.

### Frontend (Client-Side)
- **Framework:** React com Hooks (API de Contexto simplificada via `App.tsx`).
- **Estado Global:** Gerenciado via `useState` e `useMemo` no componente raiz (`App.tsx`), distribuído por fomento de props (Prop Drilling controlado).
- **Log de Acessos**: Tabela `login_logs` registra cada entrada no sistema para auditoria e gestão de engajamento da equipe.
- **Roteamento:** Simulado via estado (`view`) para garantir performance e evitar recarregamentos de página desnecessários em dispositivos móveis.
- **Persistência de Cache:** Implementada em `store.ts` usando `localStorage` para carregamento instantâneo de configurações e sessão.

## 6. Módulo de Inteligência (BI)
O sistema realiza transformações de dados em tempo real no frontend (`AnalyticsView.tsx`) para gerar insights:
- **Curva ABC**: Cálculo cumulativo de receita por produto para identificar o mix de 80/20.
- **Heatmap de Engajamento**: Agregador de horas de login para identificar picos de atividade da equipe.
- **Projeção de Caixa**: Filtro dinâmico sobre a tabela de parcelas (`installments`) com janelas temporais de 7, 15 e 30 dias.
- **Gráficos SVG**: Renderização nativa de componentes visuais sem dependências externas, garantindo leveza e performance.

### Backend (Serverless & Database Logic)
- **Supabase:** Atua como banco de dados e servidor de API.
- **Lógica Atômica (RPCs):** Para garantir integridade em operações complexas (como criar uma venda + descontar estoque + criar entrega), utilizamos funções PostgreSQL (RPC). Isso evita "race conditions" e garante que ou tudo é salvo, ou nada é salvo.

---

## 2. Dicionário de Lógica do Banco de Dados (RPCs)

As funções abaixo são o "coração" da lógica de negócio no backend:

*   `create_complete_sale`: Realiza a inserção atômica da venda, seus itens, gera as parcelas (se a prazo) e cria o registro de entrega.
*   `upsert_customer_profile`: Sincroniza dados entre a tabela de autenticação, perfis de equipe e cadastro de clientes, garantindo que um CPF seja único em todo o ecossistema.
*   `get_stock_summary`: Função de agregação que calcula o estoque atual subtraindo saídas (vendas) de entradas (compras), otimizando a leitura do dashboard.
*   `check_profile_conflict`: Validação preventiva de unicidade de Email, CPF e Telefone antes de qualquer tentativa de persistência.

---

## 3. Fluxos Críticos de Negócio

### A. Atribuição de Venda Online
Vendas originadas no portal do cliente possuem `sellerId` nulo inicialmente. A responsabilidade financeira é transferida ao **Entregador** no momento em que ele é atribuído à entrega. O sistema recalcula automaticamente os relatórios de fechamento de caixa para incluir esses valores sob o CPF do entregador.

### B. Ciclo de Vida da Entrega
1.  **Pendente:** Venda criada, mas sem motorista.
2.  **Atribuída:** Motorista definido (aparece no app do entregador).
3.  **Em Rota:** Motorista iniciou a entrega (notifica o sistema para rastreio).
4.  **Entregue:** Finalização com atualização automática do status da venda para "Entregue".

### C. Fechamento de Caixa e Auditoria
O vendedor seleciona quais vendas e parcelas está prestando contas. O sistema gera um `daily_closing` com status "Pendente". O gerente deve auditar os valores (Dinheiro, PIX, Cartão) e mudar o status para "Aprovado" para que a venda seja considerada liquidada operacionalmente.

---

## 4. Guia de Manutenção e Expansão

### Adicionar uma nova funcionalidade no Dashboard
1.  Crie a View em `views/NovaView.tsx`.
2.  Adicione o tipo em `ViewState` no arquivo `types.ts`.
3.  Adicione o caso no `switch` do `renderContent` em `App.tsx`.
4.  Se houver persistência, crie a função `fetch` ou `upsert` em `store.ts`.

### Atualização de Real-time
Se você adicionar uma nova tabela que precisa ser monitorada em tempo real:
1.  Vá até o `useEffect` de inscrições no `App.tsx`.
2.  Adicione um novo `.on('postgres_changes', ...)` para a tabela desejada.
3.  Chame `triggerRefresh()` no callback.

---

## 5. Variáveis de Ambiente
O sistema exige um arquivo `.env` (ou variáveis no provedor de hosting) com:
*   `VITE_SUPABASE_URL`: Endpoint da sua instância Supabase.
*   `VITE_SUPABASE_ANON_KEY`: Chave anônima para acesso público.

---
**Desenvolvido para Máxima Escalabilidade e Performance em Tempo Real.**
