# PRD — M13: Editor de Templates de Email (craft.js)

**Data:** 2026-02-25
**Módulo:** M13 — Bibliotecas (Templates Email)
**Stack:** craft.js + @craftjs/layers + Next.js 16 App Router

---

## 1. Objectivo

Criar um editor drag-and-drop de templates de email usando **craft.js**, integrado no ERP Infinity. Os templates serão reutilizáveis dentro dos **templates de processos** (M07) e acessíveis via a biblioteca de emails (`tpl_email_library`).

---

## 2. Arquivos da Base de Código Afectados

### 2.1 Ficheiros a CRIAR

| Ficheiro | Descrição |
|----------|-----------|
| `app/api/libraries/emails/route.ts` | GET (listagem) + POST (criar template) |
| `app/api/libraries/emails/[id]/route.ts` | GET (detalhe) + PUT (editar) + DELETE (eliminar) |
| `app/dashboard/templates-email/page.tsx` | Listagem de templates de email |
| `app/dashboard/templates-email/novo/page.tsx` | Criação (abre editor craft.js) |
| `app/dashboard/templates-email/[id]/page.tsx` | Edição (abre editor craft.js com dados carregados) |
| `components/email-editor/email-editor.tsx` | Editor principal (wrapper do `<Editor>` craft.js) |
| `components/email-editor/email-toolbox.tsx` | Painel lateral com componentes arrastáveis |
| `components/email-editor/email-settings-panel.tsx` | Painel de propriedades do elemento seleccionado |
| `components/email-editor/email-topbar.tsx` | Barra superior com acções (guardar, preview, undo/redo) |
| `components/email-editor/email-render-node.tsx` | RenderNode para indicadores visuais de selecção/hover |
| `components/email-editor/user/email-container.tsx` | Componente contentor (droppable canvas) |
| `components/email-editor/user/email-text.tsx` | Componente de texto editável |
| `components/email-editor/user/email-heading.tsx` | Componente de título (H1-H4) |
| `components/email-editor/user/email-image.tsx` | Componente de imagem |
| `components/email-editor/user/email-button.tsx` | Componente de botão/CTA |
| `components/email-editor/user/email-divider.tsx` | Componente divisor horizontal |
| `components/email-editor/user/email-spacer.tsx` | Componente espaçador |
| `components/email-editor/user/email-attachment.tsx` | Componente de anexo |
| `hooks/use-email-templates.ts` | Hook para listagem de templates |
| `hooks/use-email-template.ts` | Hook para detalhe de template |
| `lib/validations/email-template.ts` | Schemas Zod para validação |

### 2.2 Ficheiros a MODIFICAR

| Ficheiro | Alteração |
|----------|-----------|
| `components/templates/template-task-dialog.tsx` | Substituir placeholder "Em breve (M13)" por `<Select>` de templates de email |
| `lib/validations/template.ts` | Tornar `email_library_id` obrigatório quando `action_type === 'EMAIL'` |
| `components/layout/app-sidebar.tsx` | Adicionar entrada "Templates Email" ao menu |
| `lib/constants.ts` | Adicionar constantes para variáveis de template e labels PT-PT |
| `types/database.ts` | Já tem `tpl_email_library` — verificar se precisa de coluna `editor_json` |

### 2.3 Ficheiros de REFERÊNCIA (Padrões Existentes)

| Ficheiro | Padrão Útil |
|----------|-------------|
| `components/templates/template-builder.tsx` | Multi-container DnD com @dnd-kit, state decoupling |
| `components/templates/template-task-dialog.tsx` | Campos condicionais por action_type, dialog pattern |
| `components/templates/template-task-card.tsx` | Sortable items com dual-mode (normal + overlay) |
| `components/properties/property-media-gallery.tsx` | @dnd-kit simples com rectSortingStrategy |
| `app/api/templates/route.ts` | CRUD completo com nested inserts e rollback |
| `app/api/libraries/doc-types/route.ts` | Padrão para API de biblioteca (GET + POST) |
| `app/api/documents/[id]/route.ts` | Padrão para GET/PUT/DELETE com auth |
| `hooks/use-properties.ts` | Padrão para hook de listagem com filtros e debounce |
| `lib/validations/template.ts` | Nested schemas com `.refine()` condicional |
| `types/template.ts` | Type inference de database.ts com interfaces de relação |

---

## 3. Schema da Base de Dados

### 3.1 Tabela Existente: `tpl_email_library`

```typescript
// types/database.ts — já definido
tpl_email_library: {
  Row: {
    id: string              // UUID, PK
    name: string            // Nome do template (ex: "Convite Assinatura CPCV")
    subject: string         // Assunto do email (ex: "{{imovel_ref}} — Assinatura de CPCV")
    body_html: string       // HTML renderizado do email
    description: string | null  // Descrição interna
    created_at: string | null
    updated_at: string | null
  }
}
```

### 3.2 Coluna Nova Necessária (Migração SQL)

A tabela `tpl_email_library` precisa de uma coluna para guardar o JSON do editor craft.js (separado do `body_html` que é o output renderizado):

```sql
ALTER TABLE tpl_email_library
ADD COLUMN editor_state jsonb DEFAULT NULL;

COMMENT ON COLUMN tpl_email_library.editor_state IS
  'JSON serializado do estado do editor craft.js. body_html é gerado a partir deste JSON.';
```

**Lógica:**
- `editor_state` → JSON do craft.js (`query.serialize()`) — usado para carregar o editor
- `body_html` → HTML final renderizado — usado para enviar emails e preview

---

## 4. Documentação craft.js — Conceitos Chave

### 4.1 Pacotes Necessários

```bash
npm install @craftjs/core @craftjs/layers
```

**Versões actuais:**
- `@craftjs/core` v0.2.12 (React 19 support desde Feb 2025)
- `@craftjs/layers` v0.2.7

**Peer deps:** React 16.8+ / 17 / 18 / 19

### 4.2 Arquitectura Core

```
<Editor>           ← Estado global do editor + resolver de componentes
  <Frame>          ← Canvas editável (contém a árvore de nodes)
    <Element>      ← Cria nodes na árvore (canvas=true → droppable)
  </Frame>
</Editor>
```

**Conceitos:**
- **Node** — Cada componente renderizado dentro do `<Frame>` vira um "Node" na árvore interna
- **Canvas Node** — `<Element canvas>` cria zona droppable para receber filhos
- **Resolver** — Mapa `{ ComponentName: ComponentClass }` passado ao `<Editor>` para serialização/deserialização
- **User Components** — Componentes React decorados com `.craft` static (props default, settings, rules)

### 4.3 Setup Básico (Next.js App Router)

```tsx
// DEVE ser 'use client' — craft.js usa APIs do browser
'use client'

import { Editor, Frame, Element } from '@craftjs/core'
import { Layers } from '@craftjs/layers'

// Resolver mapeia nomes → componentes para serialização
const resolver = {
  EmailContainer,
  EmailText,
  EmailHeading,
  EmailImage,
  EmailButton,
  EmailDivider,
  EmailSpacer,
  EmailAttachment,
}

export function EmailEditor({ initialData, templateId }: Props) {
  return (
    <Editor
      resolver={resolver}
      onRender={RenderNode}           // Indicadores visuais de selecção
      onNodesChange={(query) => {     // Auto-save (debounced)
        const json = query.serialize()
        // guardar...
      }}
    >
      <EmailTopbar templateId={templateId} />
      <div className="flex">
        <EmailToolbox />
        <Frame data={initialData || undefined}>
          <Element is={EmailContainer} canvas padding={20} background="#ffffff">
            <EmailText text="Edite o seu template aqui" />
          </Element>
        </Frame>
        <div className="w-72">
          <EmailSettingsPanel />
          <Layers expandRootOnLoad />
        </div>
      </div>
    </Editor>
  )
}
```

### 4.4 User Components — Padrão

Cada componente segue este padrão:

```tsx
import { useNode } from '@craftjs/core'

export const EmailText = ({ text, fontSize, color, textAlign }) => {
  const {
    connectors: { connect, drag },
    actions: { setProp },
  } = useNode()

  return (
    <div ref={(ref) => connect(drag(ref))}>
      <p style={{ fontSize: `${fontSize}px`, color, textAlign }}>
        {text}
      </p>
    </div>
  )
}

// Settings panel renderizado quando o componente é seleccionado
const EmailTextSettings = () => {
  const {
    actions: { setProp },
    fontSize, color, textAlign,
  } = useNode((node) => ({
    fontSize: node.data.props.fontSize,
    color: node.data.props.color,
    textAlign: node.data.props.textAlign,
  }))

  return (
    <div className="space-y-4">
      <div>
        <Label>Tamanho da Fonte</Label>
        <Slider min={10} max={48} value={[fontSize]} onValueChange={([v]) => setProp((p) => p.fontSize = v)} />
      </div>
      <div>
        <Label>Cor</Label>
        <Input type="color" value={color} onChange={(e) => setProp((p) => p.color = e.target.value)} />
      </div>
      {/* ... mais propriedades */}
    </div>
  )
}

// Metadata estático do componente
EmailText.craft = {
  displayName: 'Texto',
  props: {
    text: 'Texto de exemplo',
    fontSize: 16,
    color: '#000000',
    textAlign: 'left',
  },
  related: {
    settings: EmailTextSettings,
  },
}
```

### 4.5 Toolbox — Arrastar para Criar

```tsx
import { useEditor, Element } from '@craftjs/core'

export const EmailToolbox = () => {
  const { connectors } = useEditor()

  return (
    <div className="w-60 p-4 space-y-2 border-r">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">Componentes</h3>

      {/* Cada ref usa connectors.create para arrastar novo componente */}
      <button
        ref={(ref) => connectors.create(ref, <EmailText text="Novo texto" />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <Type className="h-4 w-4" /> Texto
      </button>

      <button
        ref={(ref) => connectors.create(ref, <EmailHeading text="Título" level="h2" />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <Heading className="h-4 w-4" /> Título
      </button>

      <button
        ref={(ref) => connectors.create(ref, <EmailImage src="" alt="" />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <ImageIcon className="h-4 w-4" /> Imagem
      </button>

      <button
        ref={(ref) => connectors.create(ref, <EmailButton text="Clique aqui" />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <MousePointer className="h-4 w-4" /> Botão
      </button>

      <button
        ref={(ref) => connectors.create(ref, <Element is={EmailContainer} canvas padding={16} background="#f5f5f5" />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <Square className="h-4 w-4" /> Contentor
      </button>

      <button
        ref={(ref) => connectors.create(ref, <EmailDivider />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <Minus className="h-4 w-4" /> Divisor
      </button>

      <button
        ref={(ref) => connectors.create(ref, <EmailSpacer height={20} />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <ArrowUpDown className="h-4 w-4" /> Espaçador
      </button>

      <button
        ref={(ref) => connectors.create(ref, <EmailAttachment />)}
        className="w-full flex items-center gap-2 p-2 rounded border hover:bg-muted"
      >
        <Paperclip className="h-4 w-4" /> Anexo
      </button>
    </div>
  )
}
```

### 4.6 Settings Panel — Renderização Dinâmica

```tsx
import { useEditor } from '@craftjs/core'

export const EmailSettingsPanel = () => {
  const { actions, selected } = useEditor((state, query) => {
    const [currentNodeId] = state.events.selected
    let selected

    if (currentNodeId) {
      selected = {
        id: currentNodeId,
        name: state.nodes[currentNodeId].data.name,
        settings: state.nodes[currentNodeId].related?.settings,
        isDeletable: query.node(currentNodeId).isDeletable(),
      }
    }

    return { selected }
  })

  return selected ? (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Propriedades</span>
        <Badge variant="secondary">{selected.name}</Badge>
      </div>

      {/* Renderiza o painel de settings do componente seleccionado */}
      {selected.settings && React.createElement(selected.settings)}

      {selected.isDeletable && (
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => actions.delete(selected.id)}
        >
          Eliminar
        </Button>
      )}
    </div>
  ) : (
    <div className="p-4 text-sm text-muted-foreground">
      Clique num componente para editar as suas propriedades
    </div>
  )
}
```

### 4.7 Layers Panel

```tsx
import { Layers } from '@craftjs/layers'

// Dentro do <Editor>:
<Layers expandRootOnLoad />
```

**Props disponíveis:**
- `expandRootOnLoad` (boolean) — expande o nó raiz por defeito
- `renderLayer` (React.ReactElement) — componente customizado para cada layer

**Hook `useLayer`:**
- `connectors.drag(dom, nodeId)` — tornar layer arrastável
- `connectors.layer(dom, nodeId)` — elemento layer
- `connectors.layerHeading(dom, nodeId)` — cabeçalho do layer
- `actions.toggleLayer()` — expandir/colapsar

### 4.8 Save/Load (Serialização JSON)

```tsx
const { query, actions } = useEditor()

// GUARDAR — serializar todo o estado para JSON string
const json = query.serialize()
// Guardar `json` na coluna `tpl_email_library.editor_state`

// CARREGAR — deserializar JSON para o editor
actions.deserialize(savedJson)

// CARREGAR no render inicial — usar prop `data` do <Frame>
<Frame data={savedJsonString}>
  <Element is={EmailContainer} canvas>
    {/* Conteúdo default quando data é null */}
  </Element>
</Frame>

// PREVIEW (só leitura) — desactivar edição
<Editor enabled={false} resolver={resolver}>
  <Frame data={savedJson} />
</Editor>
```

### 4.9 RenderNode — Indicadores de Selecção

```tsx
import { useNode, useEditor } from '@craftjs/core'
import { ROOT_NODE } from '@craftjs/utils'
import ReactDOM from 'react-dom'

export const RenderNode = ({ render }) => {
  const { id } = useNode()
  const { actions, query, isActive } = useEditor((_, query) => ({
    isActive: query.getEvent('selected').contains(id),
  }))

  const {
    isHover, dom, name, moveable, deletable,
    connectors: { drag },
    parent,
  } = useNode((node) => ({
    isHover: node.events.hovered,
    dom: node.dom,
    name: node.data.custom.displayName || node.data.displayName,
    moveable: query.node(node.id).isDraggable(),
    deletable: query.node(node.id).isDeletable(),
    parent: node.data.parent,
  }))

  useEffect(() => {
    if (dom) {
      if (isActive || isHover) dom.classList.add('component-selected')
      else dom.classList.remove('component-selected')
    }
  }, [dom, isActive, isHover])

  // Renderiza toolbar flutuante via portal quando hover/selected
  return (
    <>
      {(isHover || isActive) && dom &&
        ReactDOM.createPortal(
          <div className="fixed flex items-center gap-1 px-2 py-1 text-xs text-white bg-primary rounded z-[9999]"
            style={{
              left: dom.getBoundingClientRect().left,
              top: dom.getBoundingClientRect().top - 28,
            }}>
            <span>{name}</span>
            {moveable && <span ref={drag} className="cursor-move"><GripVertical className="h-3 w-3" /></span>}
            {id !== ROOT_NODE && (
              <span className="cursor-pointer" onClick={() => actions.selectNode(parent)}>
                <ArrowUp className="h-3 w-3" />
              </span>
            )}
            {deletable && (
              <span className="cursor-pointer" onClick={() => actions.delete(id)}>
                <Trash2 className="h-3 w-3" />
              </span>
            )}
          </div>,
          document.body
        )
      }
      {render}
    </>
  )
}
```

### 4.10 Undo/Redo

```tsx
const { actions, canUndo, canRedo } = useEditor((state, query) => ({
  canUndo: query.history.canUndo(),
  canRedo: query.history.canRedo(),
}))

// Na topbar:
<Button disabled={!canUndo} onClick={() => actions.history.undo()}>
  <Undo className="h-4 w-4" />
</Button>
<Button disabled={!canRedo} onClick={() => actions.history.redo()}>
  <Redo className="h-4 w-4" />
</Button>
```

### 4.11 useEditor Hook — API Completa

**Connectors:**
- `select(dom, nodeId)` — clicar para seleccionar
- `hover(dom, nodeId)` — hover para highlight
- `drag(dom, nodeId)` — arrastar node existente
- `create(dom, userElement)` — arrastar para criar novo

**Actions:**
- `add(nodes, parentId?, index?)` — adicionar node
- `delete(nodeId)` — remover node
- `deserialize(data)` — carregar JSON
- `move(nodeId, targetParentId, index)` — mover node
- `setProp(nodeId, update)` — modificar props
- `setHidden(nodeId, bool)` — esconder/mostrar
- `selectNode(nodeId | null)` — selecção programática
- `history.undo()` / `history.redo()` — desfazer/refazer

**Query:**
- `serialize()` — JSON string do estado
- `node(id).isDeletable()` / `.isDraggable()` / `.descendants()` — queries de node
- `history.canUndo()` / `history.canRedo()` — estado do histórico

### 4.12 useNode Hook — API Completa

**Connectors:**
- `connect(dom)` — marca DOM como o componente
- `drag(dom)` — marca DOM como handle de arrasto

**Actions:**
- `setProp(update, throttleRate?)` — modificar props próprias
- `setCustom(update)` — modificar dados custom
- `setHidden(bool)` — esconder-se

**State collection:**
```tsx
const { isHover, isSelected, props } = useNode((node) => ({
  isHover: node.events.hovered,
  isSelected: node.events.selected,
  props: node.data.props,
}))
```

---

## 5. Padrões da Base de Código Existente

### 5.1 Padrão de API Route (biblioteca)

Seguir o padrão de `app/api/libraries/doc-types/route.ts`:

```typescript
// app/api/libraries/emails/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { emailTemplateSchema } from '@/lib/validations/email-template'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let query = supabase
      .from('tpl_email_library')
      .select('id, name, subject, description, created_at, updated_at')
      .order('name', { ascending: true })

    if (search) {
      query = query.or(`name.ilike.%${search}%,subject.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar templates de email:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = emailTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tpl_email_library')
      .insert(parsed.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('unique') ? 400 : 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar template de email:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

### 5.2 Padrão de Validação Zod

```typescript
// lib/validations/email-template.ts
import { z } from 'zod'

export const emailTemplateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  subject: z.string().min(1, 'Assunto é obrigatório'),
  description: z.string().optional(),
  body_html: z.string().min(1, 'Corpo do email é obrigatório'),
  editor_state: z.any().optional(), // JSON do craft.js
})

export const emailTemplateUpdateSchema = emailTemplateSchema.partial()

export type EmailTemplateFormData = z.infer<typeof emailTemplateSchema>
```

### 5.3 Padrão de Hook de Listagem

```typescript
// hooks/use-email-templates.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  description: string | null
  created_at: string | null
  updated_at: string | null
}

export function useEmailTemplates(search: string = '') {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/libraries/emails?${params.toString()}`)
      if (!res.ok) throw new Error('Erro ao carregar templates')

      const data = await res.json()
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return { templates, isLoading, error, refetch: fetchTemplates }
}
```

### 5.4 Padrão de Constantes PT-PT

```typescript
// Adicionar ao lib/constants.ts

export const EMAIL_TEMPLATE_VARIABLES = [
  { value: '{{proprietario_nome}}', label: 'Nome do Proprietário' },
  { value: '{{proprietario_email}}', label: 'Email do Proprietário' },
  { value: '{{proprietario_telefone}}', label: 'Telefone do Proprietário' },
  { value: '{{imovel_ref}}', label: 'Referência do Imóvel' },
  { value: '{{imovel_titulo}}', label: 'Título do Imóvel' },
  { value: '{{imovel_morada}}', label: 'Morada do Imóvel' },
  { value: '{{imovel_preco}}', label: 'Preço do Imóvel' },
  { value: '{{consultor_nome}}', label: 'Nome do Consultor' },
  { value: '{{consultor_email}}', label: 'Email do Consultor' },
  { value: '{{consultor_telefone}}', label: 'Telefone do Consultor' },
  { value: '{{processo_ref}}', label: 'Referência do Processo' },
  { value: '{{data_actual}}', label: 'Data Actual' },
  { value: '{{empresa_nome}}', label: 'Nome da Empresa' },
] as const

export const EMAIL_COMPONENT_LABELS = {
  EmailContainer: 'Contentor',
  EmailText: 'Texto',
  EmailHeading: 'Título',
  EmailImage: 'Imagem',
  EmailButton: 'Botão',
  EmailDivider: 'Divisor',
  EmailSpacer: 'Espaçador',
  EmailAttachment: 'Anexo',
} as const
```

### 5.5 Padrão do Sidebar (app-sidebar.tsx)

```typescript
// Adicionar ao array menuItems:
{
  title: 'Templates Email',
  icon: Mail,          // import { Mail } from 'lucide-react'
  href: '/dashboard/templates-email',
  permission: 'settings',    // ou criar permissão específica
},
```

### 5.6 Integração com Template de Processo (template-task-dialog.tsx)

Substituir o placeholder actual:

```tsx
// ANTES (placeholder):
{actionType === 'EMAIL' && (
  <div className="rounded-md border border-dashed p-3">
    <p className="text-sm text-muted-foreground">
      Selecção de template de email ficará disponível em breve (M13).
    </p>
  </div>
)}

// DEPOIS (selector de template):
{actionType === 'EMAIL' && (
  <div className="space-y-2">
    <Label>Template de Email</Label>
    <Select
      value={emailLibraryId}
      onValueChange={(v) => setEmailLibraryId(v)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Seleccione um template de email..." />
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
        <Button variant="ghost" size="sm">
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          Ver template
        </Button>
      </Link>
    )}
  </div>
)}
```

### 5.7 Validação de Template Actualizada

```typescript
// lib/validations/template.ts — actualizar .refine()
.refine(
  (task) => {
    if (task.action_type === 'UPLOAD') {
      return !!task.config?.doc_type_id
    }
    if (task.action_type === 'FORM') {
      return !!task.config?.owner_type
    }
    // M13: EMAIL agora requer email_library_id
    if (task.action_type === 'EMAIL') {
      return !!task.config?.email_library_id
    }
    return true
  },
  { message: 'Config inválido para o tipo de acção', path: ['config'] }
)
```

---

## 6. Componentes do Editor — Especificação

### 6.1 EmailContainer (canvas droppable)

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `background` | string | `#ffffff` | Cor de fundo |
| `padding` | number | 20 | Padding interno (px) |
| `borderRadius` | number | 0 | Raio da borda (px) |
| `borderColor` | string | `transparent` | Cor da borda |
| `borderWidth` | number | 0 | Largura da borda (px) |
| `maxWidth` | number | 600 | Largura máxima (px) — padrão email |

### 6.2 EmailText

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `text` | string | `'Texto de exemplo'` | Conteúdo (suporta variáveis `{{var}}`) |
| `fontSize` | number | 16 | Tamanho fonte (px) |
| `fontWeight` | string | `'normal'` | Peso da fonte |
| `color` | string | `#000000` | Cor do texto |
| `textAlign` | string | `'left'` | Alinhamento |
| `lineHeight` | number | 1.5 | Espaçamento entre linhas |
| `fontFamily` | string | `'Arial, sans-serif'` | Família de fonte |

### 6.3 EmailHeading

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `text` | string | `'Título'` | Conteúdo |
| `level` | `'h1'│'h2'│'h3'│'h4'` | `'h2'` | Nível do heading |
| `color` | string | `#000000` | Cor |
| `textAlign` | string | `'left'` | Alinhamento |
| `fontFamily` | string | `'Arial, sans-serif'` | Família de fonte |

### 6.4 EmailImage

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `src` | string | `''` | URL da imagem |
| `alt` | string | `''` | Texto alternativo |
| `width` | number | 100 | Largura (%) |
| `align` | string | `'center'` | Alinhamento |
| `href` | string | `''` | Link ao clicar |
| `borderRadius` | number | 0 | Raio da borda (px) |

### 6.5 EmailButton

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `text` | string | `'Clique aqui'` | Texto do botão |
| `href` | string | `'#'` | URL destino |
| `backgroundColor` | string | `#2563eb` | Cor de fundo |
| `color` | string | `#ffffff` | Cor do texto |
| `borderRadius` | number | 4 | Raio da borda |
| `fontSize` | number | 16 | Tamanho fonte |
| `paddingX` | number | 24 | Padding horizontal |
| `paddingY` | number | 12 | Padding vertical |
| `align` | string | `'center'` | Alinhamento |
| `fullWidth` | boolean | false | Ocupar largura total |

### 6.6 EmailDivider

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `color` | string | `#e5e7eb` | Cor da linha |
| `thickness` | number | 1 | Espessura (px) |
| `marginY` | number | 16 | Margem vertical (px) |
| `style` | `'solid'│'dashed'│'dotted'` | `'solid'` | Estilo da linha |

### 6.7 EmailSpacer

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `height` | number | 20 | Altura (px) |

### 6.8 EmailAttachment

| Propriedade | Tipo | Default | Descrição |
|-------------|------|---------|-----------|
| `label` | string | `'Documento anexo'` | Nome de exibição |
| `description` | string | `''` | Descrição do anexo |
| `docTypeId` | string | `''` | Tipo de documento (FK → doc_types) |
| `required` | boolean | true | Se o anexo é obrigatório |

---

## 7. Estrutura de Páginas e Rotas

```
app/dashboard/templates-email/
├── page.tsx                  ← Listagem de templates (tabela + search)
├── novo/page.tsx             ← Criar template → abre editor
└── [id]/page.tsx             ← Editar template → abre editor com dados
```

### 7.1 Listagem (`page.tsx`)

- Tabela com colunas: Nome, Assunto, Descrição, Data Criação, Acções
- Search com debounce (300ms)
- Botão "Criar Template" → `/dashboard/templates-email/novo`
- Acções por linha: Editar, Duplicar, Eliminar (com ConfirmDialog)
- Empty state com ícone Mail + CTA

### 7.2 Criação (`novo/page.tsx`)

- Formulário inicial: Nome + Assunto + Descrição (opcional)
- Ao guardar meta-dados, redireciona para editor craft.js
- Ou: Editor directo com campos de meta-dados integrados na topbar

### 7.3 Edição (`[id]/page.tsx`)

- Carrega template do DB (server-side fetch)
- Passa `editor_state` JSON ao componente EmailEditor
- Auto-save debounced no `onNodesChange`
- Botão "Guardar" manual na topbar (guarda nome, assunto, body_html + editor_state)

---

## 8. Fluxo de Dados

```
Utilizador abre editor
  │
  ▼ Server: GET /api/libraries/emails/[id]
  │ → Retorna { name, subject, body_html, editor_state }
  │
  ▼ Client: <EmailEditor initialData={editor_state} />
  │ → <Frame data={editor_state}> carrega estado
  │
  ▼ Utilizador edita template (drag-drop, propriedades)
  │
  ▼ onNodesChange → query.serialize() → auto-save debounced
  │
  ▼ Botão "Guardar":
  │ 1. editor_state = query.serialize()
  │ 2. body_html = renderToStaticHTML(editor_state) ← converter para HTML de email
  │ 3. PUT /api/libraries/emails/[id] com { name, subject, body_html, editor_state }
  │
  ▼ Resposta: { success: true }
```

---

## 9. Estado Actual da Integração

### O que JÁ existe e funciona:

| Item | Estado | Ficheiro |
|------|--------|----------|
| Tabela `tpl_email_library` | ✅ Definida no Supabase | `types/database.ts:1753-1778` |
| Types TypeScript | ✅ Gerados | `types/database.ts` |
| `email_library_id` no config | ✅ No type union | `types/template.ts` |
| ACTION_TYPES.EMAIL | ✅ Constante definida | `lib/constants.ts:387` |
| Ícone Mail em tasks | ✅ Renderiza | `components/processes/process-task-card.tsx:43` |
| Preview de email em processo | ✅ Mostra subject + body_html | `components/processes/task-detail-actions.tsx:187-210` |
| Validação task EMAIL | ✅ Config opcional (MVP) | `lib/validations/template.ts:33-51` |
| Placeholder "Em breve M13" | ✅ Pronto para substituir | `components/templates/template-task-dialog.tsx:230-237` |

### O que PRECISA ser criado:

| Item | Prioridade |
|------|-----------|
| API CRUD `/api/libraries/emails` | Alta |
| Editor craft.js com componentes | Alta |
| Páginas de listagem/criação/edição | Alta |
| Integração no template-task-dialog | Alta |
| Hook useEmailTemplates | Alta |
| Validação Zod email-template | Alta |
| Coluna `editor_state` na tabela | Alta |
| Conversão editor_state → body_html | Média |
| Sidebar menu entry | Baixa |
| Constantes variáveis de template | Média |

---

## 10. Dependências a Instalar

```bash
npm install @craftjs/core @craftjs/layers
```

**Nota:** Não é necessário instalar `react-contenteditable` — podemos usar inputs controlados do shadcn/ui para edição de texto nas propriedades. A edição inline no canvas pode ser feita com `contentEditable` nativo.

---

## 11. Referências e Fontes

### Documentação Oficial craft.js
- [Overview](https://craft.js.org/docs/overview)
- [Basic Tutorial](https://craft.js.org/docs/guides/basic-tutorial)
- [Save and Load](https://craft.js.org/docs/guides/save-load-state)
- [User Components](https://craft.js.org/docs/concepts/user-components)
- [useEditor API](https://craft.js.org/docs/api/useEditor)
- [useNode API](https://craft.js.org/docs/api/useNode)
- [Editor API](https://craft.js.org/docs/api/editor)
- [Frame API](https://craft.js.org/docs/api/frame)
- [Element API](https://craft.js.org/docs/api/element)
- [Layers](https://craft.js.org/docs/additional/layers)

### GitHub
- [craft.js Repository](https://github.com/prevwong/craft.js)
- [RenderNode Example](https://github.com/prevwong/craft.js/blob/main/examples/landing/components/editor/RenderNode.tsx)
- [React 19 Support PR](https://github.com/prevwong/craft.js/issues/723)
- [Landing Page Example](https://github.com/prevwong/craft.js/tree/main/examples/landing)

### npm
- [@craftjs/core](https://www.npmjs.com/package/@craftjs/core) — v0.2.12
- [@craftjs/layers](https://www.npmjs.com/package/@craftjs/layers) — v0.2.7

### Alternativa considerada (não usar)
- [EmailBuilder.js](https://github.com/usewaypoint/email-builder-js) — mais simples mas menos customizável que craft.js
