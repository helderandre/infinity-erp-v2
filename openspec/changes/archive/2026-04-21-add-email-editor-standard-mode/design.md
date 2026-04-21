## Context

O editor de templates de email vive em [`components/email-editor/`](components/email-editor/) e é composto por:

- Um canvas Craft.js (`<Editor>`) com um resolver de 14 nós (`EmailContainer`, `EmailText`, `EmailHeader`, `EmailSignature`, `EmailFooter`, `EmailImage`, `EmailButton`, `EmailGrid`, `EmailPropertyGrid`, etc.), topbar com toggle `edit | preview`, toolbox à esquerda, painel de propriedades/camadas à direita.
- Um renderer server-safe único em [`lib/email-renderer.ts`](lib/email-renderer.ts) que converte `editor_state` JSON para HTML de email (tables Outlook-safe).
- Um hook compartilhado [`useEmailTiptap`](components/email-editor/hooks/use-email-tiptap.ts) que configura Tiptap com `StarterKit`, `Underline`, `TextAlign`, `TextStyle`, `FontSize`, `Color`, `Link`, `VariableNode` e `VariableMention` (trigger `@`). Este hook já é usado dentro do nó Craft.js `EmailText` e reaparece no `BubbleMenu`.
- Persistência: `POST/PUT /api/libraries/emails[/:id]` com `{ name, subject, body_html, editor_state, signature_mode, category }`. Ver [`email-editor.tsx:219-266`](components/email-editor/email-editor.tsx#L219-L266).

O modo `edit` actual (Craft.js) mantém-se montado mesmo durante o `preview`, via `display: none`, para preservar estado do editor e history de undo/redo ([`email-editor.tsx:297-344`](components/email-editor/email-editor.tsx#L297-L344)).

A constrição forte vinda do produto é: **independentemente do modo de edição, o envelope institucional (header → conteúdo → assinatura → rodapé) é sempre aplicado ao HTML final**. No modo avançado isto é garantido porque os nós `EmailHeader`/`EmailSignature`/`EmailFooter` são colocados por defeito na ROOT do template novo. No modo standard queremos reforçar esta regra a nível de UI — tornando-os não-removíveis — e a nível de persistência — serializando sempre a mesma shape canónica.

## Goals / Non-Goals

**Goals:**

- Introduzir um modo `standard` baseado em Tiptap que serve o caso de uso "email de prosa com envelope".
- Renomear o modo `edit` para `advanced` em UI, sem quebrar consumidores.
- Garantir que o envelope (header/signature/footer) é sempre renderizado no canvas standard e imutável do ponto de vista do utilizador.
- Manter um único pipeline de render para HTML de email: `editor_state → renderEmailToHtml → body_html`.
- Permitir round-trip sem perda entre modos quando o conteúdo cabe na shape canónica standard.
- Avisar (e só então permitir) quando o toggle `advanced → standard` implique perda de blocos ricos.

**Non-Goals:**

- Não há alterações em [`lib/email-renderer.ts`](lib/email-renderer.ts). O novo modo produz um subset estrito do `editor_state` que o renderer já sabe consumir.
- Não há alterações nas APIs `/api/libraries/emails`. O contrato de persistência permanece idêntico.
- Não extraímos as 707 linhas de [`email-preview-panel.tsx`](components/email-editor/email-preview-panel.tsx) — fora do escopo.
- Não há migração de templates existentes em DB. A heurística de auto-selecção de modo ao abrir trata a coexistência.
- Não adicionamos um modo "HTML cru" nem importação via HTML externo.

## Decisions

### 1. Um único `<Editor>` Craft.js persistente + Tiptap standalone no modo standard

Três alternativas foram consideradas:

- **A**: Montar/desmontar o `<Editor>` Craft.js ao entrar/sair do modo standard, e usar apenas Tiptap no modo standard.
- **B**: Manter o `<Editor>` Craft.js sempre montado e, no modo standard, focar apenas o `EmailText` principal ao mesmo tempo que se esconde o resto (semelhante ao que já se faz com `display: none` para preview).
- **C** (escolhida): Manter o `<Editor>` Craft.js sempre montado (como hoje) e, no modo standard, renderizar por cima um canvas separado com header estático + Tiptap standalone + signature estática + footer estático. No save, o HTML do Tiptap é escrito para dentro do `EmailText` central do Craft.js via `actions.setProp`, e só depois se chama `query.serialize()`. Ao entrar em standard, lê-se o HTML do `EmailText` central e seeda-se o Tiptap.

Razão: C é a única que preserva o history de undo/redo do Craft.js ao alternar modos e não força refactor do `EmailText` (que também usa `useEmailTiptap`). A sincronização é unidireccional e explícita (entrada/saída de modo, save), o que evita loops de update entre dois editores Tiptap vivos.

Trade-off aceite: o Craft.js vive por baixo do canvas standard, mesmo sem estar visível. É pequeno em custo, dado que já vivia por baixo do preview da mesma forma.

### 2. Versões estáticas de Header/Signature/Footer

Os componentes actuais `EmailHeader`, `EmailSignature` e `EmailFooter` usam `useNode` e só funcionam dentro de um `<Editor>` Craft.js. Para o canvas standard precisamos do mesmo resultado visual sem o hook.

Decisão: criar `components/email-editor/standard/static-email-header.tsx`, `.../static-email-signature.tsx`, `.../static-email-footer.tsx`. Cada um duplica o JSX de render do correspondente Craft.js node e aceita as mesmas props. A lógica de fetch de assinatura do consultor (actualmente em `useResolvedSignatures` no preview panel) é extraída para um hook partilhado `hooks/use-resolved-signature.ts` e reutilizada pela versão estática.

Alternativa rejeitada: factorizar cada Craft.js component em `XRender(props)` puro + `X` wrapper que chama `useNode`. É mais elegante mas toca três componentes do modo avançado e aumenta o blast radius do change. Fica como cleanup futuro.

### 3. Shape canónica do `editor_state` para standard

Definida na spec. É um subset estrito do que o avançado produz — ROOT (`EmailContainer`) → `[EmailHeader, EmailContainer (inner) → [EmailText], EmailSignature, EmailFooter]`. O helper `lib/email/standard-state.ts` expõe três funções puras:

- `buildStandardState({ html, signatureMode, consultantId? }): string` — monta o JSON.
- `isStandardCompatible(editorState: string): boolean` — testa se o state tem exactamente essa forma (sem nós extras).
- `extractStandardContent(editorState: string): { html, droppedCount }` — tenta converter um state avançado em standard, contando quantos blocos serão descartados.

Testabilidade: estas funções são puras e cobertas por testes unitários, evitando depender do `<Editor>` Craft.js para validação.

### 4. Heurística de modo inicial

Implementada na page, não no componente, para manter o `EmailEditorComponent` agnóstico:

```
if (!editor_state && body_html) → 'standard' (seed Tiptap com body_html)
else if (isStandardCompatible(editor_state)) → 'standard'
else → 'advanced'
```

O `EmailEditorComponent` ganha uma prop `initialMode?: 'standard' | 'advanced'` com default `'standard'` para `/novo`.

### 5. Toggle Standard/Advanced e o `AlertDialog` de perda

O `ToggleGroup` passa a ter três items. No `onValueChange` do topbar, antes de propagar, o editor:

1. Se indo `standard → advanced`: `buildStandardState` com o HTML actual do Tiptap e `actions.deserialize` no Craft.js. Muda o mode.
2. Se indo `advanced → standard`: `query.serialize()`, passa a `extractStandardContent`. Se `droppedCount > 0`, abre `AlertDialog`; só confirma com consentimento explícito.
3. Se indo para `preview`: comportamento actual.

O `AlertDialog` é a variante PT-PT consistente com o resto do ERP (`ConfirmDialog` se existir, ou `AlertDialog` shadcn directo).

### 6. Save: ponto único de serialização

O handler `onSave` continua a viver em `email-editor.tsx` e a receber a string `editor_state`. Em modo standard, o callback de save:

1. Lê o HTML actual do Tiptap (via ref do editor standard).
2. Pega o `editor_state` mantido no Craft.js invisível, actualiza o `EmailText` central com o HTML novo via `actions.setProp` (ou reconstrói com `buildStandardState`).
3. Serializa e chama o `handleSave` existente.

Benefício: o `body_html` produzido é idêntico ao que o renderer sempre produziria, sem caminho alternativo de render.

### 7. AI Generate panel

`AiGenerateInput` continua a gerar um `editor_state` completo. Quando activo em modo standard, após geração o editor vai para modo advanced automaticamente (porque o output da IA habitualmente inclui imagens/botões) — com toast informativo *"A IA gerou blocos ricos — abri o modo Avançado."*. Em modo advanced comporta-se como hoje. Alternativa mais simples: desabilitar a IA no modo standard — rejeitada porque limita valor percebido.

## Risks / Trade-offs

- [Duplicação de JSX para header/signature/footer entre versões Craft.js e estáticas] → Mitigação: testes snapshot do `renderEmailToHtml` para as mesmas props garantem que a versão estática não diverge do render final de email. Cleanup futuro: factorizar em componentes puros partilhados.
- [Tiptap standalone + Tiptap dentro de `EmailText` invisível = dois editores Tiptap vivos para o mesmo conteúdo] → Mitigação: a sincronização é feita só no save e nas transições de modo; não há `useEffect` que reescreva um com o outro fora destes momentos.
- [`isStandardCompatible` pode falhar em matches legítimos por diffs cosméticos no JSON (ordem de props, `displayName`)] → Mitigação: comparação por forma estrutural (existência dos nós filhos esperados e ausência de nós extra), não por deep-equals.
- [Utilizadores podem perder trabalho ao ignorar o `AlertDialog` de perda e clicar "Continuar"] → Mitigação: o dialog mostra contagem específica ("perderá 3 blocos: 1 imagem, 1 botão, 1 grelha de imóveis"). O state avançado fica no history do Craft.js, portanto `Cmd+Z` após reverter para advanced recupera.
- [Templates seeded apenas com `body_html` (sem `editor_state`) hoje usam `generateEditorStateFromHtml` em [app/dashboard/templates-email/[id]/page.tsx:91-174](app/dashboard/templates-email/[id]/page.tsx#L91-L174)] → Esta função pode ser substituída por `buildStandardState` no caminho standard, dando-nos gratuitamente a abertura em modo standard destes templates. Executamos essa substituição como parte do change.

## Migration Plan

1. Nenhum dado em DB precisa de migrar. Todos os templates existentes continuam válidos.
2. Deploy único. Feature é puramente UI/client.
3. Rollback: reverter o commit; o `editor_state` persistido continua compatível com o modo avançado (é sempre um state Craft.js válido).

## Open Questions

- Deve o toggle para `preview` preservar o último modo de edição quando o utilizador regressar? Decisão proposta: sim — guardar `lastEditMode` em estado local e restaurar ao sair do preview. Reflectido no spec como cenário implícito ("preview" não perde contexto). Se tiver impacto prático, eleva-se a requirement em iteração futura.
- Deve o `signature_mode` `sender` ser permitido em modo standard? Decisão proposta: sim, mantemos a mesma UX. A assinatura estática só precisa de re-render quando `signature_mode` muda — trivial.
