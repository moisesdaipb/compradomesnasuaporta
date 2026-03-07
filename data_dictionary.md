# Dicionário de Dados - Compra do Mês Logística

Este documento descreve a estrutura do banco de dados no Supabase para o sistema de logística e vendas da Cesta Básica na sua Casa.

## Diagrama ER (Resumido)

```mermaid
erDiagram
    PROFILES ||--o{ STOCK_ENTRIES : creates
    PROFILES ||--o{ CUSTOMERS : creates
    PROFILES ||--o{ SALES : sells
    PROFILES ||--o{ DELIVERIES : drives
    BASKET_MODELS ||--o{ STOCK_ENTRIES : contains
    BASKET_MODELS ||--o{ SALE_ITEMS : includes
    CUSTOMERS ||--o{ SALES : places
    SALES ||--|{ SALE_ITEMS : has
    SALES ||--o{ INSTALLMENTS : creates
    SALES ||--o{ DELIVERIES : requires
    DAILY_CLOSINGS ||--o{ DAILY_RECEIPTS : details
    SALES ||--o{ DAILY_RECEIPTS : linked_to
```

## Tabelas Principais

### 1. `profiles`
Estende os usuários do `auth.users` com informações específicas do sistema.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID | Chave primária (referência a `auth.users.id`). |
| `name` | TEXT | Nome completo do usuário. |
| `role`| TEXT | Papel: `gerente`, `vendedor`, `entregador` ou `cliente`. |
| `phone`| TEXT | Telefone para contato. |
| `status`| TEXT | `ativo` ou `inativo`. |
| `last_location` | JSONB | Últimas coordenadas GPS simuladas. |

### 2. `basket_models`
Catálogo de modelos de cestas disponíveis para venda.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID | Chave primária. |
| `name` | TEXT | Nome da cesta (ex: "Cesta Premium"). |
| `price` | DECIMAL | Valor de venda. |
| `weight` | TEXT | Peso aproximado. |
| `active` | BOOLEAN | Define se o modelo está visível para venda. |

### 3. `customers`
Cadastro de clientes.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID | Chave primária. |
| `name` | TEXT | Nome completo. |
| `cpf` | TEXT | CPF para emissão de nota fiscal (único). |
| `address` | TEXT | Logradouro. |
| `state` | TEXT | UF (Estado). |
| `created_by` | UUID | ID do vendedor que cadastrou o cliente. |

### 4. `sales`
Registro de vendas realizadas.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID | Chave primária. |
| `customer_id` | UUID | Referência ao cliente. |
| `seller_id` | UUID | Referência ao vendedor (se houver). |
| `total` | DECIMAL | Soma total dos itens. |
| `payment_method` | TEXT | `PIX`, `Cartão`, `A Prazo` ou `Na Entrega`. |
| `status` | TEXT | Status do pedido (Pendente, Entregue, etc). |

### 5. `deliveries`
Gerenciamento de entregas de cestas.

| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | UUID | Chave primária. |
| `sale_id` | UUID | Venda associada. |
| `driver_id` | UUID | Entregador atribuído. |
| `status` | TEXT | `Pendente`, `Em Rota`, `Entregue`, etc. |
| `delivered_at` | TIMESTAMPTZ | Data e hora da conclusão. |

## Regras de Segurança (RLS)

- **Gerentes**: Acesso total a todas as tabelas para auditoria e gestão.
- **Vendedores**: Podem visualizar e gerenciar apenas seus próprios clientes, vendas e prestações de conta.
- **Entregadores**: Podem visualizar e atualizar apenas as entregas atribuídas a eles.
- **Clientes**: Acesso de leitura apenas aos seus próprios pedidos e perfil.
- **Produtos**: Visíveis para todos os usuários logados.
