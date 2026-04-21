## Why

O editor de templates de email actual (Craft.js visual builder) é poderoso mas excessivo para o caso de uso dominante: escrever um email simples de texto corrido com cabeçalho, assinatura e rodapé. Consultores queixam-se de fricção em tarefas triviais (drag-and-drop, panel de propriedades, camadas) quando só precisam de redigir prosa e deixar que o envelope institucional (header/footer/assinatura) seja aplicado automaticamente. Introduzir um **modo padrão** com um editor Tiptap permite atender ao caso comum com uma UX familiar, mantendo o modo visual existente — rebaptizado de **modo avançado** — para quem precisa de layout, grelhas e componentes (imagens, botões, grelha de imóveis, etc.).

## What Changes

- **Renomear** o modo actual `edit` (Craft.js) para `advanced` na UI: label passa de "Edição" para "Avançado". Lógica interna preserva snapshot/undo/redo do Craft.js sem alterações comportamentais.
- **Adicionar** um novo modo `standard` baseado em Tiptap:
  - Editor de texto corrido (parágrafos, títulos, listas, negrito/itálico/sublinhado, alinhamento, cor, link, variáveis via `@`).
  - Reutiliza o hook existente [`useEmailTiptap`](components/email-editor/hooks/use-email-tiptap.ts) com `variables` activas (mention suggestion) e `VariableNode`.
  - Canvas apresenta o envelope fixo em read-only acima e abaixo da área editável — **cabeçalho institucional → conteúdo Tiptap → assinatura → rodapé** — reutilizando exactamente os mesmos componentes `EmailHeader`, `EmailSignature` e `EmailFooter` renderizados fora do contexto Craft.js (modo estático de preview).
  - Signature mode switch (`process_owner` | `sender`) continua activo e controla o `EmailSignature` renderizado no canvas standard.
- **Persistência unificada**: templates criados em modo standard guardam um `editor_state` Craft.js equivalente (um único nó `EmailText` com o HTML do Tiptap, envolvido pelo trio Header/Signature/Footer). Isto garante que um mesmo template pode ser reaberto em qualquer um dos dois modos sem perda de dados e que o `renderEmailToHtml` existente continua a ser o ponto único de serialização para HTML de email.
- **Bidireccionalidade com guard-rail**: o toggle Standard↔Advanced é livre num sentido (advanced→standard: extracção do primeiro bloco de texto editável, com aviso se existirem outros componentes que serão perdidos) e livre no outro (standard→advanced: reaproveita o state equivalente).
- **Topbar**: `ToggleGroup` passa a ter três opções (Padrão · Avançado · Pré-visualizar) em vez de duas. `onAiGenerate`, `Undo`/`Redo` e `Guardar` continuam disponíveis em ambos os modos de edição.
- **Default mode ao abrir**: novos templates abrem em `standard`; templates existentes abrem no modo heurístico — se o `editor_state` contiver apenas o trio fixo + um `EmailText`, abre em `standard`; caso contrário abre em `advanced`.

## Capabilities

### New Capabilities

- `email-editor-modes`: define os dois modos de edição (`standard`, `advanced`) do editor de templates de email, a regra do envelope fixo (header/footer/signature sempre presente), a política de persistência unificada via `editor_state` Craft.js, a heurística de auto-selecção de modo ao abrir um template existente, e o comportamento do toggle Pré-visualizar para ambos os modos.

### Modified Capabilities

<!-- Nenhuma. O módulo de editor de email ainda não tem spec registada em `openspec/specs/`; toda a superfície afectada é nova. -->

## Impact

**Código afectado:**
- [`components/email-editor/email-editor.tsx`](components/email-editor/email-editor.tsx) — hosting do novo modo; branch de render por `mode`.
- [`components/email-editor/email-topbar.tsx`](components/email-editor/email-topbar.tsx) — extensão do tipo `EditorMode`, terceiro item no `ToggleGroup`, `disabled` states.
- Novo componente `components/email-editor/standard/email-standard-canvas.tsx` — renderiza Header + Tiptap editor + Signature + Footer em modo estático.
- Novo helper `lib/email/standard-state.ts` — converte `{ html, signatureMode }` ↔ `editor_state` canónico; detecta se um `editor_state` existente é standard-compatível.
- `app/dashboard/templates-email/[id]/page.tsx` e `.../novo/page.tsx` — passa `initialMode` derivado da heurística.

**APIs:** nenhuma mudança. `/api/libraries/emails[/:id]` continua a receber `editor_state` + `body_html` + `signature_mode`; o modo standard serializa para o mesmo formato.

**Dependências:** nenhuma nova. Tiptap + `useEmailTiptap` já existem e são usados dentro dos nós do modo avançado (por exemplo [`EmailText`](components/email-editor/user/email-text.tsx)).

**Renderização de email:** sem mudanças em [`lib/email-renderer.ts`](lib/email-renderer.ts). O HTML final é idêntico porque o `editor_state` resultante do standard é um subset estrito do que o advanced já produz.

**Riscos:** (1) perda silenciosa ao converter advanced→standard se o template tiver componentes ricos — mitigado com confirm dialog; (2) drift entre o Tiptap dentro do `EmailText` (modo avançado) e o Tiptap standalone (modo standard) — mitigado pela reutilização do mesmo `useEmailTiptap`.
