# 🔗 Hooks & Types — Referência Completa

**Documentação detalhada de todos os Hooks e Types do Editor de Documentos**

## Tabela de Conteúdos

1. [Hooks](#hooks)
2. [Types & Interfaces](#types--interfaces)
3. [Constantes](#constantes)
4. [Utilitários](#utilitários)

---

## Hooks

### useEditor() — TipTap Core Hook

**Origem:** `@tiptap/react`

Hook built-in do TipTap que cria e gerencia uma instância do editor.

#### Assinatura

```typescript
const editor = useEditor({
  extensions: Extension[],
  content?: string | JSONContent,
  editable?: boolean,
  autofocus?: boolean | 'start' | 'end',
  enableInputRules?: boolean,
  enablePasteRules?: boolean,
  onUpdate?: ({ editor }: { editor: Editor }) => void,
  onSelectionUpdate?: ({ editor, transaction }: EditorEvents['selectionUpdate']) => void,
  onContentError?: ({ error, ... }: any) => void,
  onCreate?: ({ editor }: { editor: Editor }) => void,
  onDestroy?: () => void,
  onCreate?: ({ editor }: { editor: Editor }) => void,
}) => Editor | null
```

#### Exemplo com Configuração Completa

```typescript
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      bulletList: { keepMarks: true },
      orderedList: { keepMarks: true },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    FontFamily.configure({ types: ['textStyle'] }),
    Color.configure({ types: ['textStyle'] }),
    Highlight.configure({ multicolor: true }),
    Table.configure({ resizable: true }),
    // ... custom extensions
  ],
  content: `<h1>Olá</h1><p>Conteúdo inicial</p>`,
  editable: true,
  autofocus: 'start',
  enableInputRules: true,
  enablePasteRules: true,

  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    const json = editor.getJSON()
    onContentChange?.(html)
  },

  onSelectionUpdate: ({ editor, transaction }) => {
    // Detectar mudanças de selecção
    const { $from } = transaction.selection
    const marks = $from.marks()
    // Actualizar UI (bold estado, etc.)
  },

  onContentError: ({ error }) => {
    console.error('TipTap Error:', error)
  },
})
```

#### Métodos Principais

| Método                    | Retorna      | Descrição                    |
|---------------------------|--------------|------------------------------|
| `getHTML()`              | `string`     | Export HTML do editor        |
| `getJSON()`              | `JSONContent`| Export formato JSON          |
| `getText()`              | `string`     | Apenas texto sem tags        |
| `chain()`                | `ChainAPI`   | Iniciar chain de commandos   |
| `focus()`                | `void`       | Coloca foco no editor        |
| `destroy()`              | `void`       | Limpar recursos              |
| `isActive(name, attrs?)`| `boolean`    | Verificar se mark/node activo|
| `view.dom`              | `HTMLElement`| Elemento DOM do editor       |
| `storage`               | `Record`     | Storage customizado          |

#### Executar Comandos

```typescript
// Método chain() - fluent API
editor?.chain()
  .focus()
  .toggleBold()
  .toggleItalic()
  .run()

// Método directo
editor?.commands.setBold()
editor?.commands.setFontFamily('Arial')
```

---

### useTemplateVariables()

**Localização:** `hooks/use-template-variables.ts`

Fetch variáveis disponíveis do backend para inserção em templates.

#### Assinatura

```typescript
function useTemplateVariables(): {
  data: Record<string, TemplateVariable[]> | undefined
  isLoading: boolean
  error: Error | null
}
```

#### Retorno (data)

```typescript
{
  'Utilizador': [
    {
      name: 'nome_utilizador',
      label: 'Nome do Utilizador',
      type: 'string',
      category: 'Utilizador',
      example: 'João Silva',
      required: true
    },
    {
      name: 'email_utilizador',
      label: 'Email',
      type: 'email',
      category: 'Utilizador',
      example: 'joao@mail.com',
      required: true
    },
    // ...
  ],
  
  'Cliente': [
    {
      name: 'nome_cliente',
      label: 'Nome do Cliente',
      type: 'string',
      category: 'Cliente',
      required: true
    },
    // ...
  ],

  'Propriedade': [
    {
      name: 'ref_propriedade',
      label: 'Referência',
      type: 'string',
      category: 'Propriedade',
      example: 'PROP-2026-00042',
      required: false
    },
    // ...
  ],
}
```

#### Exemplo de Uso

```typescript
import { useTemplateVariables } from '@/hooks/use-template-variables'

export function MyComponent() {
  const { data: variables, isLoading } = useTemplateVariables()

  return (
    <div>
      {isLoading && <Spinner />}
      {variables && (
        <ul>
          {Object.entries(variables).map(([category, vars]) => (
            <li key={category}>
              <h4>{category}</h4>
              {vars.map(v => (
                <div key={v.name}>
                  <code>{v.name}</code>: {v.label}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

#### Implementação Interna

```typescript
export function useTemplateVariables() {
  const [data, setData] = useState<Record<string, TemplateVariable[]>>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchVariables = async () => {
      try {
        setIsLoading(true)
        const res = await fetch('/api/libraries/template-variables')
        if (!res.ok) throw new Error('Falha ao fetch variables')
        
        const json = await res.json()
        setData(json.categories)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchVariables()
  }, [])

  return { data, isLoading, error }
}
```

---

### useEmailTemplate()

**Localização:** `hooks/use-email-template.ts`

Fetch template individual da API (GET `/api/libraries/docs/:id`).

#### Assinatura

```typescript
function useEmailTemplate(
  templateId: string | null | undefined,
  options?: {
    enabled?: boolean  // Skip fetch se false
    revalidateOnFocus?: boolean
  }
): {
  data: TemplateWithContent | undefined
  isLoading: boolean
  error: Error | null
  mutate: (data?: TemplateWithContent) => void
}
```

#### Retorno (data)

```typescript
{
  id: 'uuid-here',
  name: 'Confirmação de Compra',
  category: 'Confirmacoes',
  content_html: '<div><h1>Bem-vindo {{nome_cliente}}</h1>...</div>',
  letterhead_url: 'https://r2.dev/letterhead.png' | null,
  letterhead_file_name: 'letterhead.png' | null,
  letterhead_file_type: 'image/png' | null,
  created_at: '2026-02-24T10:30:00Z',
  updated_at: '2026-02-24T10:30:00Z',
  is_active: true,
  variables: {
    'Cliente': [
      { name: 'nome_cliente', label: 'Nome', type: 'string', ... },
    ],
    'Propriedade': [
      { name: 'ref_propriedade', label: 'Referência', type: 'string', ... },
    ],
  }
}
```

#### Exemplo

```typescript
export function EditTemplatePage() {
  const { id } = useParams()
  const { data: template, isLoading, error } = useEmailTemplate(id as string)

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorAlert error={error} />
  if (!template) return <NotFound />

  return (
    <DocumentTemplateEditor
      templateId={id as string}
      initialTemplate={template}
      mode="template"
    />
  )
}
```

#### Implementação

```typescript
export function useEmailTemplate(
  templateId: string | null | undefined,
  options?: { enabled?: boolean; revalidateOnFocus?: boolean }
) {
  const [data, setData] = useState<TemplateWithContent>()
  const [isLoading, setIsLoading] = useState(!!templateId)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!templateId || options?.enabled === false) return

    const fetchTemplate = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/libraries/docs/${templateId}`)
        if (!res.ok) throw new Error('Template not found')
        
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTemplate()

    // Revalidate on focus (opcional)
    if (options?.revalidateOnFocus) {
      const handleFocus = () => fetchTemplate()
      window.addEventListener('focus', handleFocus)
      return () => window.removeEventListener('focus', handleFocus)
    }
  }, [templateId, options])

  return {
    data,
    isLoading,
    error,
    mutate: (newData?: TemplateWithContent) => {
      if (newData) setData(newData)
    }
  }
}
```

---

### useEmailTemplates()

**Localização:** `hooks/use-email-templates.ts`

Fetch listagem de templates com filtros.

#### Assinatura

```typescript
function useEmailTemplates(options?: {
  category?: string
  search?: string
  limit?: number
  offset?: number
}): {
  data: Template[] | undefined
  total: number | undefined
  isLoading: boolean
  error: Error | null
  hasMore: boolean
}
```

#### Retorno

```typescript
{
  data: [
    { id, name, category, created_at, is_active },
    { id, name, category, created_at, is_active },
    // ...
  ],
  total: 42,
  isLoading: false,
  error: null,
  hasMore: true // (offset + limit) < total
}
```

#### Exemplo

```typescript
export function TemplatesListPage() {
  const [category, setCategory] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const { data: templates, isLoading, hasMore } = useEmailTemplates({
    category,
    search,
    limit: 20,
  })

  return (
    <div>
      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <Select value={category} onValueChange={setCategory}>
        <SelectItem value="">All Categories</SelectItem>
        <SelectItem value="Confirmacoes">Confirmações</SelectItem>
        <SelectItem value="Rejeccoes">Rejeições</SelectItem>
      </Select>

      {isLoading && <Skeleton />}
      {templates && (
        <ul>
          {templates.map(t => (
            <li key={t.id}>{t.name} ({t.category})</li>
          ))}
        </ul>
      )}
      {hasMore && <Button>Load More</Button>}
    </div>
  )
}
```

---

### useImperativeHandle() — Para Ref

**Origem:** React (built-in)

Permite um parent component chamar métodos imperativos num child component encapsulado.

#### Padrão

```typescript
// Parent
const editorRef = useRef<DocumentEditorRef>(null)

const handleSave = () => {
  const html = editorRef.current?.getContent()
  // ...
}

return (
  <>
    <DocumentTemplateEditor ref={editorRef} />
    <Button onClick={handleSave}>Save</Button>
  </>
)

// Child (DocumentEditor)
useImperativeHandle(ref, () => ({
  getContent: () => editor?.getHTML() || '',
  setContent: (html: string) => editor?.commands.setContent(html),
  insertTable: (rows, cols) => editor?.commands.insertTable({ rows, cols }),
  // ... mais métodos
}), [editor])
```

---

### useDebounce()

**Localização:** `hooks/use-debounce.ts`

Debounce para valores (útil em search).

```typescript
function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// Uso
const [searchTerm, setSearchTerm] = useState('')
const debouncedSearch = useDebounce(searchTerm, 300)

useEffect(() => {
  if (debouncedSearch) {
    fetchTemplates(debouncedSearch)
  }
}, [debouncedSearch])
```

---

## Types & Interfaces

### Template Types

**Localização:** `types/template.ts`

#### TemplateBase

```typescript
export interface TemplateBase {
  id: string
  name: string
  category: string
  created_at: string
  updated_at: string
  created_by?: string
  is_active: boolean
}
```

#### Template (para listagem)

```typescript
export interface Template extends TemplateBase {
  // Apenas fields básicos, sem conteúdo
}
```

#### TemplateWithContent (completo)

```typescript
export interface TemplateWithContent extends TemplateBase {
  content_html: string
  letterhead_url?: string | null
  letterhead_file_name?: string | null
  letterhead_file_type?: string | null
  variables?: Record<string, TemplateVariable[]>
  rendered_content?: string
}
```

#### TemplateVariable

```typescript
export interface TemplateVariable {
  /**
   * Nome técnico da variável
   * @example "nome_cliente"
   */
  name: string

  /**
   * Label para display
   * @example "Nome do Cliente"
   */
  label: string

  /**
   * Tipo de dado
   */
  type: 'string' | 'number' | 'date' | 'email' | 'url' | 'boolean'

  /**
   * Categoria (agrupamento na UI)
   * @example "Cliente"
   */
  category: string

  /**
   * Valor de exemplo
   * @example "João Silva"
   */
  example?: string

  /**
   * Se é obrigatória no render
   */
  required: boolean

  /**
   * Formato (se aplicável)
   * @example "dd/mm/yyyy" para date
   */
  format?: string

  /**
   * Descrição adicional
   */
  description?: string
}
```

#### TemplateCreateInput

```typescript
export interface TemplateCreateInput {
  name: string
  category: string
  content_html: string
  letterhead_url?: string
  letterhead_file_name?: string
  letterhead_file_type?: string
}
```

#### TemplateUpdateInput

```typescript
export interface TemplateUpdateInput extends Partial<TemplateCreateInput> {
  // Apenas campos opcionais (partial update)
}
```

---

### Editor Types

**Localização:** `components/document-editor/types.ts`

#### EditorMode

```typescript
type EditorMode = 'template' | 'document' | 'readonly'

/**
 * 'template': Modo para criar templates com variáveis {{...}}
 * 'document': Modo para ediçãoaltura de documentos normais
 * 'readonly': Modo de visualização apenas
 */
```

#### DocumentEditorProps

```typescript
interface DocumentEditorProps {
  templateId?: string | null
  initialTemplate?: TemplateWithContent | null
  mode?: EditorMode
  onSave?: (content: string) => void
  onContentChange?: (content: string) => void
  onError?: (error: Error) => void
  autoSaveDelay?: number
  characterLimit?: number
}
```

#### DocumentEditorRef

```typescript
interface DocumentEditorRef {
  getContent: () => string
  setContent: (html: string) => void
  insertTable: (rows: number, cols: number) => void
  insertImage: (src: string, alt?: string) => void
  insertPageBreak: () => void
  insertLine: () => void
  insertVariable: (name: string) => void
  insertLink: (url: string, text: string) => void
  clear: () => void
  focus: () => void
  undo: () => void
  redo: () => void
  getCharacterCount: () => number
  getWordCount: () => number
}
```

#### DocumentSettingsConfig

```typescript
interface DocumentSettingsConfig {
  pageFormat: 'A4' | 'Letter' | 'Legal'
  marginTop: number      // mm
  marginBottom: number
  marginLeft: number
  marginRight: number
  fontFamily: EditorFont
  fontSize: number       // px
  lineHeight: number
}
```

#### EditorFont

```typescript
type EditorFont =
  | 'Times New Roman'
  | 'Arial'
  | 'Roboto'
  | 'Open Sans'
  | 'Source Serif 4'
  | 'Libre Baskerville'
  | 'Merriweather'
  | 'Lora'
  | 'Crimson Pro'
  | 'Playfair Display'
  | 'Source Sans 3'
  | 'Work Sans'

export const EDITOR_FONTS: EditorFont[] = [
  'Times New Roman',
  'Arial',
  'Roboto',
  'Open Sans',
  'Source Serif 4',
  'Libre Baskerville',
  'Merriweather',
  'Lora',
  'Crimson Pro',
  'Playfair Display',
  'Source Sans 3',
  'Work Sans',
]
```

---

### Extension Types

#### VariableNodeOptions

```typescript
interface VariableNodeOptions {
  HTMLAttributes: Record<string, any>
}

interface VariableNodeMeta {
  name: string
  label?: string
  example?: string
}
```

#### PageBreakOptions

```typescript
interface PageBreakOptions {
  HTMLAttributes: Record<string, any>
}
```

#### IndentOptions

```typescript
interface IndentOptions {
  types: string[]
  size: number
}
```

---

### API Response Types

#### TemplateResponse (single)

```typescript
interface TemplateResponse {
  id: string
  name: string
  category: string
  content_html: string
  letterhead_url?: string | null
  letterhead_file_name?: string | null
  letterhead_file_type?: string | null
  created_at: string
  updated_at: string
  is_active: boolean
  variables: Record<string, TemplateVariable[]>
}
```

#### TemplateListResponse

```typescript
interface TemplateListResponse {
  data: Template[]
  total: number
  limit: number
  offset: number
}
```

#### SaveTemplateResponse

```typescript
interface SaveTemplateResponse {
  id: string
  name: string
  created_at: string
  updated_at: string
  message: string
}
```

#### ErrorResponse

```typescript
interface ErrorResponse {
  error: string
  code?: string
  status: number
}
```

---

### Utility Types

#### EditableAttributes (TipTap generic)

```typescript
interface EditableAttributes {
  class?: string
  style?: string
  id?: string
  // ... etc
}
```

#### JSONContent (TipTap)

```typescript
interface JSONContent {
  type?: string
  attrs?: Record<string, any>
  content?: JSONContent[]
  marks?: Array<{
    type: string
    attrs?: Record<string, any>
  }>
  text?: string
}
```

---

## Constantes

### EDITOR_FONTS

```typescript
export const EDITOR_FONTS = [
  'Times New Roman',    // Serif clássico
  'Arial',              // Sans-serif universal
  'Roboto',             // Google Fonts - moderno
  'Open Sans',          // Google Fonts - limpo
  'Source Serif 4',     // Adobe Fonts - profissional
  'Libre Baskerville',  // Google Fonts - elegante
  'Merriweather',       // Google Fonts - editorial
  'Lora',               // Google Fonts - elegante
  'Crimson Pro',        // Google Fonts - tradicional
  'Playfair Display',   // Google Fonts - display
  'Source Sans 3',      // Adobe Fonts - clean
  'Work Sans',          // Google Fonts - geometrico
] as const
```

### PAGE_FORMATS

```typescript
export const PAGE_FORMATS = {
  A4: { width: 210, height: 297 },      // mm
  Letter: { width: 216, height: 279 },  // 8.5x11"
  Legal: { width: 216, height: 356 },   // 8.5x14"
}
```

### FONT_SIZES

```typescript
export const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36]
```

### LINE_HEIGHTS

```typescript
export const LINE_HEIGHTS = [1.0, 1.15, 1.5, 1.75, 2.0, 2.5]
```

### MARGINS

```typescript
export const DEFAULT_MARGINS = {
  top: 20,     // mm
  right: 20,
  bottom: 20,
  left: 20,
}
```

### COLOR_PRESETS

```typescript
export const COLOR_PRESETS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#6B7280', // Gray
]
```

---

## Utilitários

### cleanDocxHtml()

**Localização:** `lib/email-renderer.ts`

Remove estilos desnecessários de HTML DOCX importado.

```typescript
export function cleanDocxHtml(html: string): string {
  // Implementação
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove attributes não permitidos
  doc.querySelectorAll('*').forEach(el => {
    const attrsToRemove = ['style', 'class', 'width', 'height']
    attrsToRemove.forEach(attr => {
      el.removeAttribute(attr)
    })
  })

  // Remove elementos vazios
  doc.querySelectorAll('p, span, div').forEach(el => {
    if (!el.textContent?.trim()) {
      el.parentNode?.removeChild(el)
    }
  })

  return doc.body.innerHTML
}
```

### renderTemplate()

**Localização:** `lib/email-renderer.ts`

Renderiza template com dados, substituindo variáveis.

```typescript
export function renderTemplate(
  html: string,
  data: Record<string, any>
): string {
  let rendered = html

  // Substituir {{variavel}} pelos valores
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    rendered = rendered.replace(regex, String(value))
  })

  // Remover variáveis não preenchidas
  rendered = rendered.replace(/{{[^}]+}}/g, '')

  return rendered
}
```

### blobToBase64()

Converter Blob para base64 string.

```typescript
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
```

### validateTemplateHTML()

Validar HTML template.

```typescript
export function validateTemplateHTML(html: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Validar estrutura básica
  if (!html || html.length < 10) {
    errors.push('Template muito curto (min 10 chars)')
  }

  if (html.length > 100000) {
    errors.push('Template muito longo (max 100k chars)')
  }

  // Validar tags abertas/fechadas
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  
  if (doc.body.querySelectorAll('*').length === 0) {
    errors.push('HTML inválido ou vazio')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

---

## Migration Guide: Tipos Antigos → Novos

Se havia tipos anteriores diferentes:

| Antigo | Novo | Mudança |
|--------|------|---------|
| `EmailTemplate` | `TemplateWithContent` | Renamed |
| `EmailVariable` | `TemplateVariable` | Renamed |
| - | `EditorMode` | Novo tipo |
| - | `DocumentEditorRef` | Novo tipo |

---

## Checklist de Tipos Necessários

- [x] `TemplateBase` ← tabela base
- [x] `Template` ← para listagem
- [x] `TemplateWithContent` ← para detalhe
- [x] `TemplateVariable` ← estrutura configurável
- [x] `TemplateCreateInput` ← para POST/PUT
- [x] `EditorMode` ← para modo editor
- [x] `DocumentEditorProps` ← para component
- [x] `DocumentEditorRef` ← para useRef
- [x] `DocumentSettingsConfig` ← para settings
- [x] `EditorFont` ← para tipografia
- [x] Response types (API)

---

**Fim da Referência de Hooks & Types**

Próximo: Veja `EDITOR-DOCUMENTOS-GUIDE.md` para guia completo da implementação.
