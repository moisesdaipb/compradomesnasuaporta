# Manifesto de Arquivos: Guia da Estrutura de Código

Este documento serve como um mapa para navegar no código-fonte do sistema **Cesta Básica na sua Casa**.

---

## 📁 Diretórios Principais

### `/` (Raiz)
*   `App.tsx`: **Componente Central.** Orquestra o estado global, autenticação, roteamento de visualizações e inscrições em tempo real do Supabase.
*   `store.ts`: **Camada de Dados.** Contém todas as funções de comunicação com o Supabase e lógica de persistência local.
*   `types.ts`: **Definições de Tipagem.** Centraliza todas as interfaces e enums usados em todo o sistema.
*   `constants.ts`: Armazena chaves de armazenamento, cores do tema e URLs estáticas.

*   `CorporateSaleView.tsx`: Fluxo completo de venda empresarial (B2B).
*   `SuppliesView.tsx`: Gestão de insumos, calculadora de produção e geração de pedidos de compra.
*   `InstallmentsView.tsx`: Gestão de cobranças parceladas com filtros avançados.
*   `GpsTrackingView.tsx`: Mapa para acompanhamento de entregadores.
*   ... (e outros 18+ arquivos específicos).

### `/components` (Componentes Reutilizáveis)
*   `Layout.tsx`: Estrutura padrão com Sidebar e áreas de conteúdo.
*   `DeliveryDetailsModal.tsx`: Popup detalhado para gestão de entregas.
*   `InvoiceModal.tsx`: Visualização de comprovante de venda.

---

### `/documentacao` (Novo)
*   `REGRAS_DO_SISTEMA.md`: Lógica de negócio e permissões (Ex: Regras de cancelamento).
*   `MANUAL_TECNICO.md`: Documentação executiva para precificação.
*   `data_dictionary.md`: Esquema detalhado do Postgres.

---

## 🛠 Arquivos de Configuração
*   `package.json`: Dependências do projeto (React, Supabase, XLSX).
*   `tsconfig.json`: Configurações do compilador TypeScript.
*   `vite.config.ts`: Configurações de build e dev server.

---

## 📋 Como navegar para Manutenção
1.  **Deseja alterar um campo no banco?** Comece alterando `types.ts`, então atualize o `upsert` em `store.ts` e refita a mudança na `View` correspondente.
2.  **Deseja mudar uma cor do sistema?** Altere os valores hexadecimais em `constants.ts`.
3.  **Deseja adicionar um novo tipo de usuário?** Atualize `UserRole` em `types.ts` e trate a permissão de acesso no `renderContent` do `App.tsx`.

---
**Este manifesto garante que o sistema possa ser estudado de forma rápida e eficiente por novos desenvolvedores.**
