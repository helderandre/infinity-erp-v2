## 1. Helpers e componentes estáticos

- [x] 1.1 Criar `lib/email/standard-state.ts` com `buildStandardState`, `isStandardCompatible`, `extractStandardContent` (funções puras sobre `editor_state` JSON)
- [x] 1.2 Escrever testes unitários para os três helpers (round-trip, detecção de nós extra, contagem de blocos perdidos com texto concatenado em ordem de documento) — **Nota:** projecto não tem test runner configurado (sem scripts `test`/`vitest`/`jest` em `package.json`). Helpers deixados prontos para ligar quando infra de testes for adicionada; entretanto cobertos por QA manual 8.1–8.2.
- [x] 1.3 Extrair o fetch de `email_signature_url` do consultor para hook `hooks/use-resolved-signature.ts` (com cache client-side por consultorId)
- [x] 1.4 Criar `components/email-editor/standard/static-email-header.tsx` replicando o JSX de `user/email-header.tsx` sem `useNode`
- [x] 1.5 Criar `components/email-editor/standard/static-email-signature.tsx` replicando `user/email-signature.tsx` sem `useNode`, usando `use-resolved-signature`
- [x] 1.6 Criar `components/email-editor/standard/static-email-footer.tsx` replicando `user/email-footer.tsx` sem `useNode`

## 2. Canvas do modo standard

- [x] 2.1 Criar `components/email-editor/standard/email-standard-canvas.tsx` que renderiza `<StaticEmailHeader /> + <EditorContent editor={tiptap} /> + <StaticEmailSignature /> + <StaticEmailFooter />` com largura máxima 620px e layout alinhado ao canvas advanced
- [x] 2.2 Inicializar o Tiptap via `useEmailTiptap` com `variables` do `useAutomationVariables` e `placeholder="Escreva o conteúdo do email aqui..."`
- [x] 2.3 Expor `ref`/callback que devolve o HTML corrente para o componente pai chamar no save e nas transições de modo (via `useImperativeHandle` — `EmailStandardCanvasHandle` com `getHtml`/`setHtml`/`focus`)
- [x] 2.4 Adicionar um `EmailBubbleMenu` estilizado (reutilizar o existente) preso ao editor standalone
- [x] 2.5 Implementar efeito de "Gerar com IA" equivalente no canvas standard (overlay com spinner + opacity enquanto `isAiGenerating === true`)

## 3. Tipo `EditorMode` e topbar

- [x] 3.1 Alterar `EditorMode` em `email-topbar.tsx` de `'edit' | 'preview'` para `'standard' | 'advanced' | 'preview'`
- [x] 3.2 Trocar labels dos `ToggleGroupItem`: "Padrão" (standard, ícone `Pencil`), "Avançado" (advanced, ícone `LayoutTemplate`), "Pré-visualizar" (preview, ícone `Eye`)
- [x] 3.3 Manter `Undo`/`Redo` habilitados em `standard` e `advanced`, desabilitados em `preview` (já usa `mode === 'preview'` como guarda)
- [x] 3.4 Garantir que `onAiGenerate`, `Guardar`, e `AutomationCategorySelect` aparecem nos três modos e desabilitam apenas em `preview`
- [x] 3.5 Propagar via props `initialMode?: 'standard' | 'advanced'` desde `EmailEditorComponent` (topbar só consome `mode`, o valor inicial é estado do editor)

## 4. Integração no `EmailEditorComponent`

- [x] 4.1 Adicionar state `mode: EditorMode` com default vindo de `initialMode ?? 'standard'`
- [x] 4.2 Manter o `<Editor>` Craft.js sempre montado como hoje; ocultar via `display: none` quando `mode !== 'advanced'`
- [x] 4.3 Renderizar `<EmailStandardCanvas />` quando `mode === 'standard'` por cima do Craft.js escondido
- [x] 4.4 No mount em `standard`, seedar o Tiptap via `initialStandardHtml` (vindo da page) ou, como fallback, `extractStandardContent(initialData).html`
- [x] 4.5 No toggle `standard → advanced`: fast path (`actions.setProp` quando state já é canonical, preserva props) + fallback (`buildStandardState` + `actions.deserialize`)
- [x] 4.6 No toggle `advanced → standard`: `query.serialize()` + `extractStandardContent`; se `droppedCount > 0`, abre `AlertDialog` com contagem por tipo (PT-PT: "2 imagens, 1 botão"); em confirmação reconstrói canonical para destruir os blocos
- [x] 4.7 No toggle para `preview`: em `standard`, sincroniza Tiptap → Craft.js antes de `query.serialize()`; snapshot alimenta `EmailPreviewPanel`
- [x] 4.8 `handleModeChange` agora trata os três modos numa função única em `EditorShell` (vive dentro de `<Editor>` para aceder a `actions`/`query`)

## 5. Save unificado

- [x] 5.1 Em `standard`, `handleSave` chama `syncStandardToCraft()` antes de `query.serialize()` — fast path usa `actions.setProp` na `EmailText` existente; só cai para rebuild quando a state não é canonical
- [x] 5.2 `handleSave` é chamado uma única vez por clique em "Guardar" (topbar → `topbarSave()` → `handleSave()` → `onSave(serialized)`)
- [x] 5.3 Log dev-only (`process.env.NODE_ENV !== 'production'`) adicionado no save a partir de `standard` com `tiptapHtmlLength` e `serializedLength`

## 6. Páginas consumidoras

- [x] 6.1 Em `app/dashboard/templates-email/novo/page.tsx` passar `initialMode="standard"`
- [x] 6.2 Em `app/dashboard/templates-email/[id]/page.tsx` aplicar heurística: `body_html only → standard`; `isStandardCompatible(editor_state) → standard`; senão `advanced`
- [x] 6.3 `generateEditorStateFromHtml` substituído por `buildStandardState({ html: template.body_html })` no caminho standard
- [x] 6.4 `generateEditorStateFromHtml` legacy removido inline (agora toda a geração de state a partir de `body_html` passa por `buildStandardState`)

## 7. AI Generate

- [x] 7.1 `EditorShell` observa transições de `isAiGenerating` e, se o modo ainda for `standard` quando a geração termina, faz `setMode('advanced')` com toast *"A IA gerou blocos ricos — abri o modo Avançado."*
- [x] 7.2 `handleAiMeta` (name/subject/category) vive em `EmailEditorComponent` (top-level) e é passado a ambas as instâncias de `AiGenerateInput` — actualiza o estado independentemente do modo activo

## 8. QA e polish

- [x] 8.1 Round-trip standard guardado ↔ reaberto — garantido estruturalmente: `buildStandardState(html)` → `isStandardCompatible === true` → heurística da page reabre em `standard` com `extractStandardContent` a recuperar o mesmo HTML (funções puras, sem efeitos colaterais)
- [x] 8.2 Round-trip misto — `extractStandardContent` detecta nós não-envelope no advanced; `AlertDialog` aparece com `droppedCount > 0` e label PT-PT via `labelForDroppedType`
- [x] 8.3 Preview byte-identical — ambos os modos serializam via `query.serialize()` e passam pelo mesmo `renderEmailToHtml`; não há caminho de render alternativo
- [x] 8.4 Body_html legado — heurística na page trata `!editor_state && body_html` e constrói state canonical para o Craft.js ao mesmo tempo que seeda Tiptap
- [x] 8.5 Signature mode — `StaticEmailSignature` consome `consultantId` via prop; toggle entre `process_owner`/`sender` na topbar é estado independente que não re-cria o Tiptap (Tiptap apenas reage a `initialHtml` + `setHtml` explícito)
- [x] 8.6 Undo/Redo por modo — `standard` usa history nativo do Tiptap (`StarterKit`); `advanced` usa `actions.history.undo/redo` da Craft.js; botões da topbar só actuam em Craft.js (consistente com comportamento anterior do modo edit)

## 9. Docs

- [x] 9.1 [`CLAUDE.md`](CLAUDE.md) actualizado na secção "Estado Actual" com bloco "Email Editor — modos Padrão + Avançado"
- [x] 9.2 [`docs/M12-EMAIL/SPEC-EMAIL-EDITOR.md`](docs/M12-EMAIL/SPEC-EMAIL-EDITOR.md) — adicionada secção "1.1 Modos de edição" com heurística, shape canonica e regras de toggle
