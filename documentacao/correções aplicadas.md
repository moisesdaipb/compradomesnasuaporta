# Histórico de Correções Aplicadas no Banco de Dados

Este arquivo documenta de forma cronológica as intervenções técnicas e correções manuais realizadas diretamente na base de dados de produção do sistema da Cesta Básica, visando manter a integridade fiscal, contábil e de estoque.

---

### 1. Limpeza de Dados de Simulação (Vendedor de Teste)

* **Data e Horário:** 25/05/2026 às 22:50 (Horário Local)
* **Responsável Técnico:** Assistente de IA
* **Objeto da Correção:** Remoção das vendas e movimentações realizadas pelo usuário **Teste de reset de emails** (`moisesdaipb@yahoo.com.br`).
* **O porquê da correção:**
  O usuário de testes havia registrado vendas fictícias diretamente no ambiente de produção para simular o comportamento da aplicação em tempo real. Essas vendas geraram saídas falsas de estoque e inflaram os relatórios de faturamento e comissões do painel gerencial.
* **Detalhes da Ação:**
  * Foram excluídas as 4 vendas presenciais do vendedor de teste (IDs: `060a1a18`, `0b5eda4b`, `4f3208ee` e `c7c629ce`).
  * Foram excluídos todos os itens de venda (`sale_items`) e parcelas vinculadas (`installments`).
  * Foram excluídos os registros de movimentação de estoque (`stock_entries`) vinculados a esses IDs.
* **Impacto e Resultados:**
  * O faturamento e os relatórios gerenciais foram higienizados e agora mostram apenas vendas reais.
  * O estoque físico da empresa foi **recomposto com perfeição**, com a devolução automática de **2 Cestas Básicas Completas** e **3 Caixas de Leite 12 Litros** ao inventário disponível.

---

### 2. Reconciliação Contábil do Cliente Jefferson de Oliveira

* **Data e Horário:** 25/05/2026 às 22:55 (Horário Local)
* **Responsável Técnico:** Assistente de IA
* **Objeto da Correção:** Conciliação de parcelas e eliminação de saldo negativo do cliente **Jefferson de Oliveira** (`CPF: 104.440.709-31`).
* **O porquê da correção:**
  Devido a um pagamento a maior realizado pelo cliente na sua primeira compra (onde pagou R$ 500,00 em uma parcela para uma venda de R$ 730,00 que já possuía R$ 360,00 pagos), a base de dados registrou uma parcela pendente negativa de **R$ -130,00** para manter o total da venda. Posteriormente, na segunda compra, o cliente ficou com uma parcela de **R$ 130,00** pendente. Havia a necessidade de zerar as pendências do cliente sem gerar divergências nos fechamentos diários históricos aprovados pela gerência.
* **Detalhes da Ação:**
  * Adotou-se o método de **Conciliação de Saldos Pendentes** (Opção B), preservando intactos os fechamentos do passado.
  * A Parcela 3 de **R$ -130,00** da Venda 1 (ID `22f38b95`) teve seu status atualizado de `Pendente` para **`Pago`** via PIX em `07/04/2026` (data do pagamento a maior).
  * A Parcela 3 de **R$ 130,00** da Venda 2 (ID `fbf93aa7`) teve seu status atualizado de `Pendente` para **`Pago`** via PIX em `07/04/2026` (compensação do crédito).
* **Impacto e Resultados:**
  * O cliente Jefferson de Oliveira teve sua situação financeira **100% regularizada** e em dia no sistema.
  * A parcela com valor negativo foi devidamente baixada.
  * **Os fechamentos de caixa (`daily_closings`) aprovados pelo gerente foram preservados 100% intactos**, sem qualquer diferença ou quebra de conciliação contábil nos relatórios gerenciais históricos.
