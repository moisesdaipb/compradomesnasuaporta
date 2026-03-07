# Protocolo de Arquitetura e Persistência - Cesta Básica System

Este documento serve como a **Fonte da Verdade** para qualquer futura iteração ou assistência por IA neste projeto. Siga rigorosamente estas diretrizes para manter a integridade e profissionalismo do sistema.

## 1. Princípio de Persistência Zero-Local (Critical)
**Regra**: NENHUM dado crítico de negócio (Vendas, Metas, Estoque, Clientes, Financeiro) deve residir exclusivamente no `localStorage`.
- **Implementação**: Todo `upsert` ou `update` deve ser direcionado imediatamente ao Supabase.
- **Transação**: Garanta que falhas no servidor sejam propagadas para a UI para evitar estados órfãos (desincronia cliente-servidor).

## 2. Padrão de Inicialização de Estado (State Initializer)
Para evitar o "Flash of Unstyled Content" (FOUC) ou "Flash of Default Data":
- **Configurações**: Use a função inicializadora do `useState` em `App.tsx` para carregar o `localStorage` (como cache) **no exato momento da montagem**.
- **Sincronização**: O `refreshData` deve ser disparado imediatamente após o boot para validar o cache com a realidade do banco de dados.

## 3. Autoridade Máxima do Servidor
O servidor (Supabase + RLS) é o único dono da verdade.
- **AppConfig**: O nome e logo da empresa devem ser buscados na tabela `app_config` (ID: `global`).
- **RLS**: Nunca remova políticas de Row Level Security. Configurações de branding devem ser `READ: Public` e `WRITE: Manager-only`.

## 4. Branding e Identidade Visual Dinâmica
O sistema deve suportar a identidade visual do cliente de forma reativa:
- **Fallback**: Mantenha "Cesta Básica na sua Casa" como valor `hardcoded` apenas como segurança técnica extrema.
- **Componentes**: `LoginView.tsx` e `Layout.tsx` devem sempre usar o `appName` vindo das props, nunca strings estáticas.
- **Logo**: Suporte a Tipos de Logo (Ícone vs Imagem URL vs Upload) deve ser mantido de forma consistente em todo o CSS.

## 5. Fluxo de Perfil e Mídia
- **Salvamento Automático**: Interações de recorte de imagem (Crop) devem disparar o upload e salvamento no perfil automaticamente após a confirmação do usuário.
- **Sanitização de Imagem**: Certifique-se de que o fundo de recortes circulares seja preenchido (ex: branco) para evitar bordas transparentes indesejadas.

## 6. Padrões de Código
- **Store**: Use `fetchX` para GET, `upsertX` para POST/PUT. Use console logs prefixados com `[store]` para facilitar trace de erros em tempo real.
- **Tipagem**: Mantenha `types.ts` atualizado com qualquer alteração no schema do banco de dados imediatamente.

---
**Nota para a IA**: Ao assumir este projeto, sua primeira tarefa deve ser auditar o `store.ts` para garantir que o fluxo de dados segue o padrão Supabase-First.
