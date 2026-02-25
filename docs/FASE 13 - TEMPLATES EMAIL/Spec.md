# Spec — M13: Editor de Templates de Email (craft.js)

**Data:** 2026-02-25
**Baseado em:** [PRD.md](PRD.md)

---

## Visao Geral

Implementar um editor drag-and-drop de templates de email usando **craft.js**, com CRUD completo, integrado no sidebar e nos templates de processo existentes. A implementacao segue os padroes ja estabelecidos no projecto (API routes, hooks, validacoes Zod, paginas de listagem/criacao/edicao).

---

## Pre-requisitos

### Instalar dependencias

```bash
npm install @craftjs/core @craftjs/layers
```

### Migracao SQL (Supabase)

Adicionar coluna `editor_state` a tabela `tpl_email_library`:

```sql
ALTER TABLE tpl_email_library
ADD COLUMN editor_state jsonb DEFAULT NULL;

COMMENT ON COLUMN tpl_email_library.editor_state IS
  'JSON serializado do estado do editor craft.js. body_html e gerado a partir deste JSON.';
```

### Regenerar types

```bash
npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > src/types/database.ts
```

Isto adicionara `editor_state: Json | null` ao type `tpl_email_library` em `types/database.ts` (linhas ~1753-1782).

---

## FASE 1 — Infraestrutura (API + Validacao + Hooks + Constantes)

---

### Ficheiro: `lib/validations/email-template.ts` (CRIAR)

**O que fazer:**
Criar schemas Zod para validacao de templates de email. Seguir o padrao de `lib/validations/document.ts`.

- Schema `emailTemplateSchema` com:
  - `name`: `z.string().min(2, 'Nome deve ter pelo menos 2 caracteres')`
  - `subject`: `z.string().min(1, 'Assunto e obrigatorio')`
  - `description`: `z.string().optional()`
  - `body_html`: `z.string().min(1, 'Corpo do email e obrigatorio')`
  - `editor_state`: `z.any().optional()` (JSON do craft.js)
- Schema `emailTemplateUpdateSchema` como `emailTemplateSchema.partial()`
- Export de `type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>`

---

### Ficheiro: `app/api/libraries/emails/route.ts` (CRIAR)

**O que fazer:**
Criar API de listagem e criacao de templates de email. Seguir o padrao exacto de `app/api/libraries/doc-types/route.ts`.

**GET handler:**
- Criar Supabase server client via `createClient()`
- Ler query param `search` de `request.url`
- Query `tpl_email_library` com select de `id, name, subject, description, created_at, updated_at`
- Se `search` existir, filtrar com `.or('name.ilike.%${search}%,subject.ilike.%${search}%')`
- Ordenar por `name` ascendente
- Retornar `NextResponse.json(data)` ou erro 500

**POST handler:**
- Auth check com `supabase.auth.getUser()` — retornar 401 se nao autenticado
- Parse body com `emailTemplateSchema.safeParse(body)` — retornar 400 com `parsed.error.flatten()` se invalido
- Insert em `tpl_email_library` com `.insert(parsed.data).select().single()`
- Retornar 201 com data, ou 400 se violacao de unique, ou 500 se outro erro
- Wrap tudo em `try/catch` com `console.error`

---

### Ficheiro: `app/api/libraries/emails/[id]/route.ts` (CRIAR)

**O que fazer:**
Criar API de detalhe, edicao e eliminacao de template. Seguir o padrao de `app/api/documents/[id]/route.ts` e `app/api/properties/[id]/route.ts`.

**GET handler:**
- Params async: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params`
- Query `tpl_email_library` com `.select('*').eq('id', id).single()`
- Se erro code `PGRST116` → retornar 404 `'Template nao encontrado'`
- Senao retornar data

**PUT handler:**
- Auth check (401 se nao autenticado)
- Parse body com `emailTemplateUpdateSchema.safeParse(body)` — retornar 400 se invalido
- Update em `tpl_email_library` com `.update(parsed.data).eq('id', id).select().single()`
- Retornar data actualizada, ou 404/500

**DELETE handler:**
- Auth check (401 se nao autenticado)
- Hard delete: `.delete().eq('id', id)` (templates de email nao precisam de soft delete — sao conteudo rascunho, nao registos operacionais)
- Retornar `{ success: true }` ou erro

---

### Ficheiro: `hooks/use-email-templates.ts` (CRIAR)

**O que fazer:**
Hook de listagem com search debounced. Seguir padrao de `hooks/use-properties.ts`.

- `'use client'` no topo
- Interface `EmailTemplate` com: `id, name, subject, description, created_at, updated_at` (todos string/null)
- Funcao `useEmailTemplates(search: string = '')`
- State: `templates` (array), `isLoading` (boolean), `error` (string|null)
- `useDebounce(search, 300)` para debounce do search
- `useCallback` com fetch para `/api/libraries/emails?search=...`
- `useEffect` que chama fetch quando `debouncedSearch` muda
- Retornar `{ templates, isLoading, error, refetch: fetchTemplates }`

---

### Ficheiro: `hooks/use-email-template.ts` (CRIAR)

**O que fazer:**
Hook de detalhe de um template individual. Seguir padrao de `hooks/use-property.ts`.

- `'use client'` no topo
- Interface `EmailTemplateDetail` extendendo `EmailTemplate` com `body_html, editor_state`
- Funcao `useEmailTemplate(id: string | undefined)`
- Guard: se `!id`, set `isLoading(false)` e return early
- Fetch para `/api/libraries/emails/${id}`
- Retornar `{ template, isLoading, error, refetch }`

---

### Ficheiro: `lib/constants.ts` (MODIFICAR)

**O que fazer:**
Adicionar constantes de variaveis de template e labels de componentes do editor. Adicionar **no final do ficheiro** (apos linha 866).

Adicionar:

```typescript
// === M13: Templates de Email ===

export const EMAIL_TEMPLATE_VARIABLES = [
  { value: '{{proprietario_nome}}', label: 'Nome do Proprietario' },
  { value: '{{proprietario_email}}', label: 'Email do Proprietario' },
  { value: '{{proprietario_telefone}}', label: 'Telefone do Proprietario' },
  { value: '{{imovel_ref}}', label: 'Referencia do Imovel' },
  { value: '{{imovel_titulo}}', label: 'Titulo do Imovel' },
  { value: '{{imovel_morada}}', label: 'Morada do Imovel' },
  { value: '{{imovel_preco}}', label: 'Preco do Imovel' },
  { value: '{{consultor_nome}}', label: 'Nome do Consultor' },
  { value: '{{consultor_email}}', label: 'Email do Consultor' },
  { value: '{{consultor_telefone}}', label: 'Telefone do Consultor' },
  { value: '{{processo_ref}}', label: 'Referencia do Processo' },
  { value: '{{data_actual}}', label: 'Data Actual' },
  { value: '{{empresa_nome}}', label: 'Nome da Empresa' },
] as const

export const EMAIL_COMPONENT_LABELS = {
  EmailContainer: 'Contentor',
  EmailText: 'Texto',
  EmailHeading: 'Titulo',
  EmailImage: 'Imagem',
  EmailButton: 'Botao',
  EmailDivider: 'Divisor',
  EmailSpacer: 'Espacador',
  EmailAttachment: 'Anexo',
} as const
```

---

## FASE 2 — Componentes do Editor craft.js

---

### Ficheiro: `components/email-editor/user/email-container.tsx` (CRIAR)

**O que fazer:**
Componente contentor droppable (canvas). E o root node do editor.

- `'use client'`
- Usar `useNode()` para obter `connectors: { connect }` (sem drag — contentores raiz nao sao arrastáveis)
- Receber props: `background` (#ffffff), `padding` (20), `borderRadius` (0), `borderColor` (transparent), `borderWidth` (0), `maxWidth` (600)
- Renderizar `<div>` com ref `connect`, aplicando os estilos via inline style (`style={{ ... }}`)
- Renderizar `{children}` dentro — este componente tem `canvas: true`
- Criar `EmailContainerSettings` com:
  - Input color para `background`
  - Slider para `padding` (0-60)
  - Slider para `borderRadius` (0-20)
  - Input color para `borderColor`
  - Slider para `borderWidth` (0-5)
  - Slider para `maxWidth` (400-800)
- Static `.craft`:
  - `displayName: 'Contentor'`
  - `props`: defaults acima
  - `related: { settings: EmailContainerSettings }`
  - `rules: { canDrag: () => false }` (root nao se arrasta)

---

### Ficheiro: `components/email-editor/user/email-text.tsx` (CRIAR)

**O que fazer:**
Componente de texto editavel. Suporta variaveis `{{var}}`.

- `useNode()` com `connect` e `drag`
- Props: `text` ('Texto de exemplo'), `fontSize` (16), `fontWeight` ('normal'), `color` (#000000), `textAlign` ('left'), `lineHeight` (1.5), `fontFamily` ('Arial, sans-serif')
- Renderizar `<div ref={ref => connect(drag(ref))}>` com `<p>` estilizado com inline styles
- Edição inline: usar `contentEditable` no `<p>`, com `onBlur` que faz `setProp(p => p.text = e.currentTarget.textContent)`
- `EmailTextSettings` com:
  - Slider `fontSize` (10-48)
  - Select `fontWeight` (normal, bold, 300, 500, 600, 700)
  - Input color `color`
  - ToggleGroup `textAlign` (left, center, right, justify) — usar icones AlignLeft, AlignCenter, AlignRight, AlignJustify
  - Slider `lineHeight` (1-3, step 0.1)
  - Select `fontFamily` (Arial, Helvetica, Georgia, Times New Roman, Verdana)
  - Section "Variaveis" — lista clicavel de `EMAIL_TEMPLATE_VARIABLES` que ao clicar insere `{{var}}` no texto (append ao `text` actual)
- `.craft`: `displayName: 'Texto'`, props defaults, related settings

---

### Ficheiro: `components/email-editor/user/email-heading.tsx` (CRIAR)

**O que fazer:**
Componente de titulo (H1-H4).

- `useNode()` com `connect` e `drag`
- Props: `text` ('Titulo'), `level` ('h2'), `color` (#000000), `textAlign` ('left'), `fontFamily` ('Arial, sans-serif')
- Renderizar o heading dinamico: `createElement(level, { style: {...} }, text)` — ou switch case para h1/h2/h3/h4
- Edição inline com `contentEditable` + `onBlur` → `setProp`
- `EmailHeadingSettings` com:
  - Select `level` (h1, h2, h3, h4) com labels PT-PT ("Titulo 1", "Titulo 2", etc.)
  - Input color `color`
  - ToggleGroup `textAlign`
  - Select `fontFamily`
- `.craft`: `displayName: 'Titulo'`, props defaults, related settings

---

### Ficheiro: `components/email-editor/user/email-image.tsx` (CRIAR)

**O que fazer:**
Componente de imagem.

- `useNode()` com `connect` e `drag`
- Props: `src` (''), `alt` (''), `width` (100), `align` ('center'), `href` (''), `borderRadius` (0)
- Se `src` vazio, renderizar placeholder com icone `ImageIcon` + texto "Insira URL da imagem"
- Se `src` preenchido, renderizar `<img>` com `style={{ width: '${width}%', borderRadius }}` dentro de `<div style={{ textAlign: align }}>`
- Se `href` preenchido, envolver `<img>` em `<a>`
- `EmailImageSettings` com:
  - Input text `src` (URL da imagem)
  - Input text `alt` (Texto alternativo)
  - Slider `width` (10-100, %)
  - ToggleGroup `align` (left, center, right)
  - Input text `href` (Link ao clicar)
  - Slider `borderRadius` (0-20)
- `.craft`: `displayName: 'Imagem'`, props defaults, related settings

---

### Ficheiro: `components/email-editor/user/email-button.tsx` (CRIAR)

**O que fazer:**
Componente de botao/CTA.

- `useNode()` com `connect` e `drag`
- Props: `text` ('Clique aqui'), `href` ('#'), `backgroundColor` (#2563eb), `color` (#ffffff), `borderRadius` (4), `fontSize` (16), `paddingX` (24), `paddingY` (12), `align` ('center'), `fullWidth` (false)
- Renderizar `<div style={{ textAlign: align }}>` com `<a>` estilizado como botao (inline styles com background, color, padding, border-radius, display inline-block, text-decoration none, font-size)
- Se `fullWidth`, display block + width 100%
- `EmailButtonSettings` com:
  - Input text `text`
  - Input text `href`
  - Input color `backgroundColor`
  - Input color `color`
  - Slider `borderRadius` (0-20)
  - Slider `fontSize` (12-24)
  - Slider `paddingX` (8-48)
  - Slider `paddingY` (4-24)
  - ToggleGroup `align`
  - Switch `fullWidth`
- `.craft`: `displayName: 'Botao'`, props defaults, related settings

---

### Ficheiro: `components/email-editor/user/email-divider.tsx` (CRIAR)

**O que fazer:**
Componente divisor horizontal.

- `useNode()` com `connect` e `drag`
- Props: `color` (#e5e7eb), `thickness` (1), `marginY` (16), `style` ('solid')
- Renderizar `<div ref>` com `<hr>` estilizado (border-top com color, thickness e style; margin-top/bottom com marginY)
- `EmailDividerSettings` com:
  - Input color `color`
  - Slider `thickness` (1-5)
  - Slider `marginY` (0-48)
  - Select `style` (solid → 'Solido', dashed → 'Tracejado', dotted → 'Pontilhado')
- `.craft`: `displayName: 'Divisor'`, props defaults, related settings

---

### Ficheiro: `components/email-editor/user/email-spacer.tsx` (CRIAR)

**O que fazer:**
Componente espacador vertical. O mais simples.

- `useNode()` com `connect` e `drag`
- Props: `height` (20)
- Renderizar `<div ref style={{ height, minHeight: height }}>` — vazio, apenas espaco
- `EmailSpacerSettings` com Slider `height` (4-120)
- `.craft`: `displayName: 'Espacador'`, props defaults, related settings

---

### Ficheiro: `components/email-editor/user/email-attachment.tsx` (CRIAR)

**O que fazer:**
Componente de anexo (placeholder visual no editor, nao faz upload real).

- `useNode()` com `connect` e `drag`
- Props: `label` ('Documento anexo'), `description` (''), `docTypeId` (''), `required` (true)
- Renderizar card visual com icone `Paperclip`, `label` como titulo, `description` como subtitulo
- Badge "Obrigatorio"/"Opcional" baseado em `required`
- `EmailAttachmentSettings` com:
  - Input text `label`
  - Input text `description`
  - Input text `docTypeId` (futuro: Select com doc_types)
  - Switch `required`
- `.craft`: `displayName: 'Anexo'`, props defaults, related settings

---

### Ficheiro: `components/email-editor/email-render-node.tsx` (CRIAR)

**O que fazer:**
RenderNode para indicadores visuais de seleccao/hover. Seguir exactamente o padrao da seccao 4.9 do PRD.

- Importar `useNode`, `useEditor` de `@craftjs/core` e `ROOT_NODE` de `@craftjs/utils`
- Importar `ReactDOM` de `react-dom`
- No componente `RenderNode({ render })`:
  - Obter `id` do `useNode()`
  - Obter `isActive` do `useEditor` (via `query.getEvent('selected').contains(id)`)
  - Obter `isHover, dom, name, moveable, deletable, parent` do `useNode` collector
  - `useEffect` para adicionar/remover classe CSS `component-selected` no `dom` quando `isActive || isHover`
  - Quando `isHover || isActive`, renderizar via `ReactDOM.createPortal` uma toolbar flutuante posicionada acima do elemento (`getBoundingClientRect()`)
  - Toolbar contem: nome do componente, icone grip (drag handle, se moveable), seta para cima (select parent, se nao ROOT_NODE), lixo (delete, se deletable)
  - Icones: `GripVertical`, `ArrowUp`, `Trash2` do lucide-react
  - Z-index alto: `z-[9999]`
- Estilos para `.component-selected` no CSS global (outline dashed azul)

---

### Ficheiro: `components/email-editor/email-toolbox.tsx` (CRIAR)

**O que fazer:**
Painel lateral esquerdo com componentes arrastaveis. Seguir padrao da seccao 4.5 do PRD.

- `'use client'`
- Importar `useEditor, Element` de `@craftjs/core`
- Importar todos os user components
- Obter `connectors` de `useEditor()`
- Renderizar sidebar com largura fixa `w-60`, border-right, padding
- Para cada componente, renderizar um `<button>` com:
  - `ref={(ref) => connectors.create(ref!, <ComponenteName prop1="..." />)}`
  - Icone do lucide + label PT-PT
- Componentes a listar (8):
  1. Texto (`Type` icon) → `<EmailText />`
  2. Titulo (`Heading` icon) → `<EmailHeading />`
  3. Imagem (`ImageIcon` icon) → `<EmailImage />`
  4. Botao (`MousePointer` icon) → `<EmailButton />`
  5. Contentor (`Square` icon) → `<Element is={EmailContainer} canvas padding={16} background="#f5f5f5" />`
  6. Divisor (`Minus` icon) → `<EmailDivider />`
  7. Espacador (`ArrowUpDown` icon) → `<EmailSpacer />`
  8. Anexo (`Paperclip` icon) → `<EmailAttachment />`
- Estilo dos botoes: `w-full flex items-center gap-2 p-2 rounded border hover:bg-muted cursor-grab`

---

### Ficheiro: `components/email-editor/email-settings-panel.tsx` (CRIAR)

**O que fazer:**
Painel lateral direito para propriedades do elemento seleccionado. Seguir padrao da seccao 4.6 do PRD.

- `'use client'`
- Importar `useEditor` de `@craftjs/core`
- Usar collector para obter `selected` (id, name, settings component, isDeletable)
- Se `selected` existe:
  - Mostrar header com nome do componente num `<Badge variant="secondary">`
  - Renderizar `React.createElement(selected.settings)` — painel de settings do componente
  - Se `isDeletable`, botao "Eliminar" (`variant="destructive"`) que chama `actions.delete(selected.id)`
- Se nada seleccionado:
  - Mensagem: "Clique num componente para editar as suas propriedades"

---

### Ficheiro: `components/email-editor/email-topbar.tsx` (CRIAR)

**O que fazer:**
Barra superior com metadados do template e accoes.

- `'use client'`
- Importar `useEditor` de `@craftjs/core`
- Props: `templateId` (string|null), `name`, `subject`, `description`, `onNameChange`, `onSubjectChange`, `onDescriptionChange`, `onSave`, `isSaving`
- Obter `canUndo, canRedo, actions, query` do `useEditor`
- Layout: flex row com gap, items-center, border-bottom, padding
- Lado esquerdo:
  - Botao "Voltar" (icone ArrowLeft) — `router.push('/dashboard/templates-email')`
  - Input para `name` (inline, sem borda quando nao focado — estilo clean)
- Centro:
  - Input para `subject` (inline)
- Lado direito:
  - Botao Undo (icone `Undo2`, disabled se `!canUndo`) → `actions.history.undo()`
  - Botao Redo (icone `Redo2`, disabled se `!canRedo`) → `actions.history.redo()`
  - Botao "Guardar" (icone `Save`, loading se `isSaving`) → chama `onSave` com `{ editor_state: query.serialize() }`

---

### Ficheiro: `components/email-editor/email-editor.tsx` (CRIAR)

**O que fazer:**
Componente principal — wrapper do `<Editor>` craft.js. E o ponto de entrada.

- `'use client'`
- Importar `Editor, Frame, Element` de `@craftjs/core`
- Importar `Layers` de `@craftjs/layers`
- Importar todos os user components
- Importar `RenderNode`, `EmailToolbox`, `EmailSettingsPanel`, `EmailTopbar`
- Props: `initialData` (string JSON | null — o `editor_state` da DB), `templateId` (string|null), `initialName`, `initialSubject`, `initialDescription`
- Definir `resolver` mapeando todos os user components: `{ EmailContainer, EmailText, EmailHeading, EmailImage, EmailButton, EmailDivider, EmailSpacer, EmailAttachment }`
- State local para `name`, `subject`, `description`, `isSaving`
- Funcao `handleSave(editorState)`:
  - Gerar `body_html` a partir do `editor_state` (versao simplificada: guardar o JSON; a conversao para HTML pode ser feita server-side ou com funcao utilitaria — inicialmente guardar ambos)
  - Se `templateId` existe: `PUT /api/libraries/emails/${templateId}` com `{ name, subject, description, body_html, editor_state }`
  - Se nao: `POST /api/libraries/emails` com os mesmos dados, depois `router.push` para a pagina de edicao do novo template
  - Toast de sucesso/erro
- Render:
  ```
  <Editor resolver={resolver} onRender={RenderNode}>
    <EmailTopbar ... />
    <div className="flex flex-1 overflow-hidden">
      <EmailToolbox />
      <div className="flex-1 overflow-auto bg-muted/30 p-8">
        <div className="mx-auto" style={{ maxWidth: 600 }}>
          <Frame data={initialData || undefined}>
            <Element is={EmailContainer} canvas padding={20} background="#ffffff">
              <EmailText text="Edite o seu template aqui" />
            </Element>
          </Frame>
        </div>
      </div>
      <div className="w-72 border-l overflow-auto">
        <EmailSettingsPanel />
        <Layers expandRootOnLoad />
      </div>
    </div>
  </Editor>
  ```
- O layout e full-height (h-screen ou h-[calc(100vh-var)]) para o editor ocupar toda a area

---

## FASE 3 — Paginas

---

### Ficheiro: `app/dashboard/templates-email/page.tsx` (CRIAR)

**O que fazer:**
Pagina de listagem de templates de email. Seguir padrao de `app/dashboard/processos/templates/page.tsx`.

- `'use client'`
- Usar `useEmailTemplates(search)` para obter dados
- State: `search`, `deleteId` (para confirmacao)
- Layout:
  - Header: titulo "Templates de Email", descricao "Gerir templates de email para processos", botao "Novo Template" → `/dashboard/templates-email/novo`
  - Search input com icone `Search` e debounce (via hook)
  - Tabela com colunas: Nome, Assunto, Descricao (truncada), Data Criacao (`formatDateTime`), Accoes
  - Accoes por linha (dropdown `MoreHorizontal`): "Editar" (navega para `[id]`), "Duplicar" (POST com dados copiados + nome " (copia)"), "Eliminar" (abre AlertDialog)
  - Loading: skeleton de 5 linhas
  - Empty state: icone `Mail`, titulo "Nenhum template de email", descricao "Crie o seu primeiro template de email", CTA "Criar Template"
  - `AlertDialog` para confirmar eliminacao com DELETE para `/api/libraries/emails/${deleteId}`
  - Toast de sucesso/erro apos eliminar + `refetch()`

---

### Ficheiro: `app/dashboard/templates-email/novo/page.tsx` (CRIAR)

**O que fazer:**
Pagina de criacao de template. Abre directamente o editor craft.js com campos de metadados na topbar.

- `'use client'`
- Renderizar `<EmailEditor>` com `initialData={null}`, `templateId={null}`, `initialName=""`, `initialSubject=""`, `initialDescription=""`
- O componente `EmailEditor` trata da criacao (POST) internamente

---

### Ficheiro: `app/dashboard/templates-email/[id]/page.tsx` (CRIAR)

**O que fazer:**
Pagina de edicao de template. Carrega dados e abre editor com estado.

- `'use client'`
- Usar `useParams<{ id: string }>()` para obter o id
- Usar `useEmailTemplate(id)` para carregar dados
- Loading state: skeleton do editor (sidebar esquerda + area central + sidebar direita)
- Not found state: mensagem de erro + botao voltar
- Quando carregado, renderizar `<EmailEditor>` com:
  - `initialData={template.editor_state}` (string JSON)
  - `templateId={template.id}`
  - `initialName={template.name}`
  - `initialSubject={template.subject}`
  - `initialDescription={template.description || ''}`

---

## FASE 4 — Integracao com Modulos Existentes

---

### Ficheiro: `components/layout/app-sidebar.tsx` (MODIFICAR)

**O que fazer:**
Adicionar entrada "Templates Email" ao menu do sidebar.

**Linha 19 (imports):** Adicionar `Mail` ao import do lucide-react:
```typescript
import {
  // ... existentes ...
  Mail,
} from 'lucide-react'
```

**Linha 121 (apos o item Marketing, antes de Definicoes):** Adicionar novo item ao array `menuItems`:
```typescript
{
  title: 'Templates Email',
  icon: Mail,
  href: '/dashboard/templates-email',
  permission: 'settings',
},
```

Isto insere o item entre "Marketing" e "Definicoes" no sidebar, visivel para quem tem permissao `settings`.

---

### Ficheiro: `components/templates/template-task-dialog.tsx` (MODIFICAR)

**O que fazer:**
Substituir placeholder "Em breve (M13)" por Select de templates de email e adicionar estado + fetch de templates.

**1) Adicionar imports (topo do ficheiro, apos linha 29):**
```typescript
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
```

**2) Adicionar state para email templates (apos linha 65, junto dos outros states):**
```typescript
// EMAIL state (M13)
const [emailLibraryId, setEmailLibraryId] = useState('')
const [emailTemplates, setEmailTemplates] = useState<Array<{ id: string; name: string; subject: string }>>([])
const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false)
```

**3) No useEffect de reset (linhas 72-100), adicionar reset do emailLibraryId:**
- No bloco `if (initialData)` (apos linha 85): `setEmailLibraryId(initialData.config?.email_library_id || '')`
- No bloco `else` (apos linha 97): `setEmailLibraryId('')`

**4) Adicionar useEffect para carregar email templates (apos o useEffect de doc_types, linha 112):**
```typescript
// Carregar email templates quando action_type = EMAIL
useEffect(() => {
  if (actionType === 'EMAIL' && emailTemplates.length === 0) {
    setEmailTemplatesLoading(true)
    fetch('/api/libraries/emails')
      .then((res) => res.json())
      .then((data) => setEmailTemplates(Array.isArray(data) ? data : []))
      .catch(() => setEmailTemplates([]))
      .finally(() => setEmailTemplatesLoading(false))
  }
}, [actionType, emailTemplates.length])
```

**5) No handleSubmit (linhas 114-144), adicionar validacao e config para EMAIL:**
- Apos linha 121 (validacao FORM): `if (actionType === 'EMAIL' && !emailLibraryId) return`
- Apos linha 130 (config FORM): adicionar:
```typescript
if (actionType === 'EMAIL' && emailLibraryId) {
  config.email_library_id = emailLibraryId
}
```

**6) Substituir o bloco placeholder (linhas 230-237) por:**
```tsx
{actionType === 'EMAIL' && (
  <div className="space-y-2">
    <Label>Template de Email</Label>
    <Select
      value={emailLibraryId}
      onValueChange={(v) => setEmailLibraryId(v)}
    >
      <SelectTrigger>
        <SelectValue placeholder={emailTemplatesLoading ? 'A carregar...' : 'Seleccione um template de email...'} />
      </SelectTrigger>
      <SelectContent>
        {emailTemplates.map((tpl) => (
          <SelectItem key={tpl.id} value={tpl.id}>
            <div className="flex flex-col">
              <span>{tpl.name}</span>
              <span className="text-xs text-muted-foreground">{tpl.subject}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    {emailLibraryId && (
      <Link href={`/dashboard/templates-email/${emailLibraryId}`} target="_blank">
        <Button variant="ghost" size="sm" type="button">
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          Ver template
        </Button>
      </Link>
    )}
  </div>
)}
```

---

### Ficheiro: `lib/validations/template.ts` (MODIFICAR)

**O que fazer:**
Tornar `email_library_id` obrigatorio quando `action_type === 'EMAIL'`.

**Substituir as linhas 43-45** (comentario sobre M13):
```typescript
// EMAIL e GENERATE_DOC: config opcional no MVP (bibliotecas vazias)
// Sera obrigatorio quando M13 estiver implementado
return true
```

**Por:**
```typescript
// EMAIL: email_library_id obrigatorio (M13)
if (task.action_type === 'EMAIL') {
  return !!task.config?.email_library_id
}
// GENERATE_DOC: config opcional (futuro M13 docs)
return true
```

---

## FASE 5 — CSS Global + Polish

---

### Ficheiro: `app/globals.css` (MODIFICAR)

**O que fazer:**
Adicionar estilos para o indicador visual de seleccao do craft.js.

Adicionar no final do ficheiro:

```css
/* craft.js editor — component selection indicator */
.component-selected {
  outline: 2px dashed hsl(var(--primary));
  outline-offset: 2px;
}
```

---

## Resumo de Ficheiros

### A CRIAR (21 ficheiros)

| # | Ficheiro | Tipo |
|---|----------|------|
| 1 | `lib/validations/email-template.ts` | Validacao Zod |
| 2 | `app/api/libraries/emails/route.ts` | API Route (GET+POST) |
| 3 | `app/api/libraries/emails/[id]/route.ts` | API Route (GET+PUT+DELETE) |
| 4 | `hooks/use-email-templates.ts` | Hook listagem |
| 5 | `hooks/use-email-template.ts` | Hook detalhe |
| 6 | `components/email-editor/user/email-container.tsx` | User Component |
| 7 | `components/email-editor/user/email-text.tsx` | User Component |
| 8 | `components/email-editor/user/email-heading.tsx` | User Component |
| 9 | `components/email-editor/user/email-image.tsx` | User Component |
| 10 | `components/email-editor/user/email-button.tsx` | User Component |
| 11 | `components/email-editor/user/email-divider.tsx` | User Component |
| 12 | `components/email-editor/user/email-spacer.tsx` | User Component |
| 13 | `components/email-editor/user/email-attachment.tsx` | User Component |
| 14 | `components/email-editor/email-render-node.tsx` | RenderNode |
| 15 | `components/email-editor/email-toolbox.tsx` | Painel lateral |
| 16 | `components/email-editor/email-settings-panel.tsx` | Painel propriedades |
| 17 | `components/email-editor/email-topbar.tsx` | Barra superior |
| 18 | `components/email-editor/email-editor.tsx` | Editor principal |
| 19 | `app/dashboard/templates-email/page.tsx` | Pagina listagem |
| 20 | `app/dashboard/templates-email/novo/page.tsx` | Pagina criacao |
| 21 | `app/dashboard/templates-email/[id]/page.tsx` | Pagina edicao |

### A MODIFICAR (5 ficheiros)

| # | Ficheiro | Alteracao |
|---|----------|-----------|
| 1 | `lib/constants.ts` | Adicionar `EMAIL_TEMPLATE_VARIABLES` + `EMAIL_COMPONENT_LABELS` (final do ficheiro) |
| 2 | `components/layout/app-sidebar.tsx` | Adicionar item "Templates Email" ao `menuItems` + import `Mail` |
| 3 | `components/templates/template-task-dialog.tsx` | Substituir placeholder M13 por Select de templates + state + fetch + validacao |
| 4 | `lib/validations/template.ts` | Tornar `email_library_id` obrigatorio para `action_type === 'EMAIL'` |
| 5 | `app/globals.css` | Adicionar classe `.component-selected` para indicador visual craft.js |

### MIGRACAO SQL (1)

| # | Accao |
|---|-------|
| 1 | `ALTER TABLE tpl_email_library ADD COLUMN editor_state jsonb DEFAULT NULL` |

### REGENERAR (1)

| # | Accao |
|---|-------|
| 1 | `npx supabase gen types typescript` → `types/database.ts` |

---

## Ordem de Implementacao Recomendada

1. **Pre-requisitos:** Instalar deps + migrar SQL + regenerar types
2. **Fase 1:** Validacao + APIs + Hooks + Constantes (infra)
3. **Fase 2:** User Components craft.js (8) + RenderNode + Toolbox + Settings Panel + Topbar + Editor principal
4. **Fase 3:** Paginas (listagem + criacao + edicao)
5. **Fase 4:** Integracao sidebar + template-task-dialog + validacao template
6. **Fase 5:** CSS global
