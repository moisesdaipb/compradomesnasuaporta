# 📋 Regras do Sistema

Base de conhecimento com todas as regras de negócio implementadas no sistema.

---

## 1. Cancelamento de Vendas

### Resumo
O sistema possui regras diferenciadas de cancelamento de vendas com base no perfil do usuário e no tempo decorrido desde a criação do pedido.

### Regras por Perfil

| Perfil | Pode cancelar? | Restrição |
|---|---|---|
| **Cliente** | ✅ | Até 10 min = cancelamento direto. Após 10 min = apenas solicita ao gerente |
| **Vendedor** | ✅ | Somente vendas do **mesmo dia** (data atual). Dias anteriores são bloqueados |
| **Gerente** | ✅ | Sem restrições — pode cancelar qualquer venda a qualquer momento |

### Implementação — Cliente

**Arquivo:** `views/CustomerOrdersView.tsx` — linhas 360-389

```tsx
// O botão só aparece para pedidos Pendente ou Confirmado
{(selectedSale.status === OrderStatus.PENDING || selectedSale.status === OrderStatus.CONFIRMED) && (
    <button onClick={async () => {
        const now = Date.now();
        const tenMinutes = 10 * 60 * 1000;
        const isWithinWindow = (now - selectedSale.createdAt) < tenMinutes;
        const isDirectCancel = selectedSale.status === OrderStatus.PENDING && isWithinWindow;

        // Se dentro de 10 min → cancela direto
        // Se após 10 min → envia solicitação para o gerente
        await onCancelOrder(
            selectedSale.id,
            isDirectCancel ? OrderStatus.CANCELLED : OrderStatus.CANCELLATION_REQUESTED
        );
    }}>
)}
```

**Fluxo:**
1. Cliente clica em cancelar dentro de 10 min → status muda para `Cancelado`
2. Cliente clica em cancelar após 10 min → status muda para `Solicitação de Cancelamento`
3. Gerente recebe a solicitação e pode aprovar ou rejeitar

---

### Implementação — Vendedor

**Arquivo:** `views/ManagerSalesView.tsx` — linhas 39-45 e 553-589

```tsx
// Função auxiliar que verifica se a venda é do mesmo dia
const isSameDay = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
           date.getMonth() === now.getMonth() &&
           date.getDate() === now.getDate();
};

// Botões de editar/cancelar só aparecem se:
// - É gerente (sempre), OU
// - É o vendedor dono da venda E a venda é do mesmo dia
{(userRole === 'gerente' || (selectedSale.sellerId === userId && isSameDay(selectedSale.createdAt))) && (
    <div>
        <button>Editar Venda</button>
        <button>Cancelar Venda</button>
    </div>
)}

// Mensagem informativa quando o vendedor tenta acessar venda de dia anterior
{userRole === 'vendedor' && selectedSale.sellerId === userId && !isSameDay(selectedSale.createdAt) && (
    <p>Vendas de dias anteriores não podem ser editadas ou canceladas por vendedores.</p>
)}
```

**Regra:** O vendedor só pode editar e cancelar vendas criadas **no mesmo dia**. Após a virada do dia (00:00), ele perde o acesso a essas ações.

---

### Implementação — Gerente

**Arquivo:** `views/ManagerSalesView.tsx` — linhas 554-556 e 631-644

O gerente tem dois caminhos para cancelar:
1. **Botão normal** (linhas 556-581): Dentro do modal de detalhes, sem restrição de tempo
2. **Forçar Cancelamento Administrativo** (linhas 631-644): Botão extra no rodapé do modal para pedidos Pendente/Confirmado

```tsx
// Condição do gerente: sem restrição de isSameDay
{userRole === 'gerente' && (
    // Botões sempre visíveis para o gerente
)}

// Botão de força administrativa (linhas 631-644)
{(selectedSale.status === OrderStatus.PENDING || selectedSale.status === OrderStatus.CONFIRMED) && (
    <button>Forçar Cancelamento Administrativo</button>
)}
```

> ⚠️ **Nota:** O botão "Forçar Cancelamento Administrativo" aparece para **qualquer perfil** que acesse o modal com pedido Pendente/Confirmado. Verificar se deveria ser restrito apenas ao gerente.

---

### Aprovação de Solicitação de Cancelamento

**Arquivo:** `views/ManagerSalesView.tsx` — linhas 499-551

Quando um cliente solicita cancelamento (status = `CANCELLATION_REQUESTED`), o gerente vê um painel com dois botões:
- **Aprovar** → muda status para `Cancelado`
- **Rejeitar** → muda status de volta para `Confirmado`

---

## 2. Paginação e Ordenação de Listas (Supabase)

### Resumo
Sempre que uma lista contiver mais registros do que o limite padrão da API (1000 registros) e for necessário usar paginação (`.range(from, to)`), a ordenação **deve conter um critério de desempate único** para garantir a estabilidade das páginas.

### Regra de Ouro (Stability Sort)
Se ordenar dados usando uma propriedade de tempo não-única (como `due_date`, `createdAt` em dias com múltiplos registros) **é obrigatório** adicionar um segundo `.order('id', { ascending: true })`.

**Motivo:** Se o banco (Postgres) não souber a ordem exata de dois registros com a mesma data e eles caírem exatamente na quebra de uma página (ex: limite 1000), o sistema pode saltar um dos registros (ele não aparecerá nem na página 1, nem na página 2) devido ao re-embaralhamento interno das páginas.

### Implementação Universal (Tabelas de Alto Crescimento)
Devido ao risco de bloqueio, foi estabelecido um padrão de paginação via loop `while` no arquivo `store.ts`.  
As seguintes buscas/tabelas já operam nativamente imunes ao limite de 1000 linhas e imunes ao salto de dados:
*   `fetchInstallments` (Parcelas)
*   `fetchSales` (Vendas)
*   `fetchCustomers` (Clientes - Usam ordenação por nome + ID)
*   `fetchDeliveries` (Entregas)
*   `fetchDailyClosings` (Fechamentos Diários e Recibos Pix/Cartão)

**Exemplo Base**:

```typescript
    const { data, error } = await supabase
      .from('installments')
      .select('*')
      .order('due_date', { ascending: true }) // Critério Principal
      .order('id', { ascending: true })       // Critério de Desempate OBRIGATÓRIO
      .range(from, from + PAGE_SIZE - 1);
```

---

## 3. Reatribuicão de Clientes em Massa

### Resumo
O sistema permite a transferência em lote de todos os clientes vinculados a um vendedor para outro colaborador. Esta funcionalidade é exclusiva para o perfil de **Gerente** e destina-se a facilitar transições de equipe ou saídas de funcionários.

### Regras de Negócio
1. **Responsabilidade**: Ao reatribuir, o campo `createdBy` do cliente é alterado para o ID do novo vendedor.
2. **Impacto**: O novo vendedor passa a "possuir" o cliente para fins de novos pedidos e visibilidade (se aplicável).
3. **Segurança**: A operação é realizada via RPC (`reassign_customers`) para garantir que todos os registros sejam atualizados de forma atômica ou nenhum seja alterado em caso de erro.

### Implementação
**Arquivo:** `views/TeamView.tsx` — Função `handleReassign`
**Backend:** RPC `reassign_customers`

```sql
UPDATE customers
SET created_by = p_target_seller_id
WHERE created_by = p_source_seller_id;
```

---

## Histórico de Atualizações

| Data | Regra | Autor |
|---|---|---|
| 20/04/2026 | Documentada regra de cancelamento por perfil | Sistema |
| 20/04/2026 | Adicionada regra de Estabilidade de Paginação (Supabase) | Sistema |
| 20/04/2026 | Expansão da regra de paginação paralela para Vendas, Clientes, Entregas e Fechamentos | Sistema |
| 24/04/2026 | Implementada funcionalidade e regra de Reatribuição de Clientes em Massa | Sistema |
