# 📄 Editor de Documentos — Guia Completo

**Última actualização:** 25 de Fevereiro de 2026

## 📑 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Componentes](#componentes)
4. [Hooks](#hooks)
5. [Types & Interfaces](#types--interfaces)
6. [Configuração](#configuração)
7. [API Integration](#api-integration)
8. [Guia de Uso](#guia-de-uso)
9. [Exemplos Práticos](#exemplos-práticos)

---

## Visão Geral

O **Editor de Documentos** é um módulo completo para criação e edição de templates de documentos baseado em **TipTap**, uma framework de rich text editing moderna e extensível. O editor permite:

- ✅ **Rich text formatting**: bold, italic, underline, strikethrough, alignment, colors, highlights
- ✅ **Elementos avançados**: tabelas, imagens, quebras de página, linhas separadoras
- ✅ **Sistema de variáveis**: inserção de placeholders ({{nome_variavel}}) com decoração visual
- ✅ **Slash commands**: menu contextual com `/` para inserção de elementos
- ✅ **DOCX import**: importar templates existentes em formato Word
- ✅ **Modos de operação**: `template` (com variáveis), `document` (sem variáveis), `readonly` (apenas leitura)
- ✅ **Tipografia customizável**: 12 fontes Google Fonts a escolher

### Stack Tecnológico

| Componente        | Tecnologia                |
|-------------------|---------------------------|
| Editor Rich Text  | **TipTap 2.x**           |
| Framework         | **Next.js 16** (App Router) |
| Styling           | **Tailwind CSS v4**       |
| Components        | **shadcn/ui**            |
| Positioning       | **Tippy.js**             |
| Import DOCX       | **Mammoth.js**           |
| State Management  | **React Hooks**          |
| Backend           | **Supabase PostgreSQL**  |

---

## Arquitetura

### Estrutura de Pastas

```
components/document-editor/
├── document-editor.tsx              ← Core editor (imperative ref + hooks)
├── document-toolbar.tsx             ← Top toolbar (font, size, line-height, insert)
├── document-bubble-menu.tsx         ← Inline menu (text selection formatting)
├── document-slash-command.tsx       ← Slash command menu (/table, /image, etc.)
├── document-settings-panel.tsx      ← Settings sidebar (variables, page settings)
├── document-import-dialog.tsx       ← DOCX import modal
├── extensions/                      ← Custom TipTap extensions
│   ├── variable-node.ts             ← Variável decorada {{...}}
│   ├── slash-command.ts             ← Sistema de slash commands
│   ├── page-break.ts                ← Quebra de página
│   ├── indent.ts                    ← Indentação customizada
│   └── index.ts                     ← Export todas extensões
└── types.ts                         ← Interfaces, tipos, constantes

app/dashboard/templates-documentos/
├── page.tsx                         ← Listagem de templates
├── novo/page.tsx                    ← Criar novo template
└── [id]/
    └── page.tsx                     ← Editar template existente

hooks/
├── use-email-templates.ts           ← Fetch templates da API
├── use-email-template.ts            ← Fetch template individual
├── use-template-variables.ts        ← Sistema de variáveis
└── use-chat-messages.ts             ← (helper para contexto)

lib/
├── email-renderer.ts                ← Render templates com dados (não usado no editor)
└── process-engine.ts                ← Lógica de processamento

types/
└── template.ts                      ← Tipos centralizados
```

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│ Página: /templates-documentos/[id]                      │
│ - Fetch template data via useEmailTemplate()            │
│ - Load em DocumentTemplateEditor com initialTemplate    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ DocumentTemplateEditor (useImperativeHandle)            │
│ - useEditor() configurado com TipTap extensions         │
│ - State: content, mode, fonts, variables               │
│ - Ref methods: getContent, setContent, insert...       │
└──────────────┬──────────────────────────────────────────┘
               │
        ┌──────┴──────┬─────────────┬──────────────┐
        ▼             ▼             ▼              ▼
   ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │Toolbar │ │Bubble    │ │Slash     │ │Settings      │
   │        │ │Menu      │ │Command   │ │Panel         │
   └────────┘ └──────────┘ └──────────┘ └──────────────┘
        │             │            │             │
        └─────────────┴────────────┴─────────────┘
                 │
                 ▼
        ┌───────────────────────┐
        │ TipTap Editor Instance│
        │ - Extensions (15)     │
        │ - Content Storage     │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Save to Supabase DB   │
        │ tpl_doc_library       │
        │ - name                │
        │ - content_html        │
        │ - letterhead_url (opt)│
        └───────────────────────┘
```

---

## Componentes

### 1. DocumentEditor (Core)

**Localização:** `components/document-editor/document-editor.tsx`

Componente raiz que encapsula toda a lógica do editor TipTap com interface imperativa.

#### Props

```typescript
interface DocumentEditorProps {
  templateId?: string | null           // ID do template (null = novo)
  initialTemplate?: TemplateWithContent | null  // Dados iniciais
  mode?: 'template' | 'document' | 'readonly'   // Modo operação (default: 'template')
  onSave?: (content: string) => void   // Callback ao guardar
  onContentChange?: (content: string) => void  // Callback de mudança
}
```

#### Ref Methods (via useImperativeHandle)

```typescript
interface DocumentEditorRef {
  getContent: () => string                    // HTML do editor
  setContent: (html: string) => void          // Carregar HTML
  insertTable: (rows: number, cols: number) => void
  insertImage: (src: string, alt: string) => void
  insertPageBreak: () => void
  insertLine: () => void
  insertVariable: (name: string) => void
  insertLink: (url: string, text: string) => void
  clear: () => void
  focus: () => void
}
```

#### Features

- ✅ **TipTap Editor Core**: Inicializado com StarterKit + custom extensions
- ✅ **Character Count**: Contagem de palavras/caracteres no rodapé
- ✅ **Font Management**: Dropdown de 12 Google Fonts
- ✅ **Bubble Menu**: Menu flutuante ao seleccionar texto
- ✅ **Slash Commands**: Menu `/` para inserção rápida
- ✅ **Settings Panel**: Sidebar com variáveis e configurações
- ✅ **Loading State**: Handling para variáveis decoradas

#### Extensões Instaladas

```typescript
const extensions = [
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
  TableRow,
  TableHeader,
  TableCell,
  Image.configure({ inline: false, HTMLAttributes: { class: 'image' } }),
  Link.configure({ HTMLAttributes: { class: 'link', target: '_blank' } }),
  Typography,
  CharacterCount.configure({ limit: 100000 }),
  Dropcursor,
  Gapcursor,
  // Custom extensions
  VariableNode,
  SlashCommand,
  PageBreak,
  Indent,
]
```

### 2. DocumentToolbar

**Localização:** `components/document-editor/document-toolbar.tsx`

Barra de ferramentas superior com controles de formatação e inserção.

#### Controles

| Grupo          | Elementos                                  |
|----------------|-------------------------------------------|
| **Tipografia** | Font (Google Fonts), Font Size (8-36px)  |
| **Spacing**    | Line Height (1.0 - 2.5)                  |
| **Formatting** | Bold, Italic, Underline, Strike, Code    |
| **Colors**     | Text Color, Highlight Color (color picker)|
| **Alignment**  | Left, Center, Right, Justify             |
| **Lists**      | Bullet List, Ordered List, Task List     |
| **Advanced**   | Table, Image, Link, Page Break, HR       |
| **Insert**     | Variable (só em mode='template')         |

#### Implementação

```typescript
// Exemplo: Select de fonte
<Select value={fontFamily} onValueChange={handleFontFamily}>
  <SelectTrigger className="w-40">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {EDITOR_FONTS.map(font => (
      <SelectItem key={font} value={font}>
        {font}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 3. DocumentBubbleMenu

**Localização:** `components/document-editor/document-bubble-menu.tsx`

Menu flutuante que aparece ao seleccionar texto (integrado com Tippy.js).

#### Features

- ✅ Posicionamento automático (Tippy)
- ✅ Tema customizado (`data-theme="editor-menu"`)
- ✅ Formatação rápida (bold, italic, underline, etc.)
- ✅ Link insertion popup
- ✅ Text/highlight color pickers
- ✅ Alignment buttons
- ✅ Variable insertion (apenas em mode='template')

#### Styling

```css
/* No app/globals.css */
.tippy-box[data-theme~='editor-menu'] {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  color: var(--foreground) !important;
}

.tippy-box[data-theme~='editor-menu'] .tippy-arrow {
  display: none !important;
}
```

### 4. DocumentSlashCommand

**Localização:** `components/document-editor/document-slash-command.tsx`

Sistema de slash commands (`/table`, `/image`, etc.) com menu contextual.

#### Comandos Disponíveis

```
/table              → Inserir tabela (3x3 default)
/image              → Inserir imagem (upload via URL)
/page-break         → Quebra de página (word-break)
/line               → Linha separadora (HR)
/paragraph          → Parágrafo vazio
/heading1-6         → Headings (H1 a H6)
/bullet-list        → Lista com bullets
/ordered-list       → Lista numerada
/task-list          → Lista de tarefas
/variable           → Inserir variável {{...}} (template mode)
```

#### Implementação

```typescript
const suggestions = [
  { title: 'Tabela', command: () => editor.chain().focus().insertTable(...).run() },
  { title: 'Imagem', command: () => { /* upload dialog */ } },
  { title: 'Pausa', command: () => editor.chain().focus().pageBreak().run() },
  // ... mais
]
```

### 5. DocumentSettingsPanel

**Localização:** `components/document-editor/document-settings-panel.tsx`

Sidebar direita com variáveis do sistema, configurações de página, e preview.

#### Secções

1. **Variáveis do Sistema**: Lista de {{var}} disponíveis (fetch via `useTemplateVariables`)
2. **Configurações de Página**: Tamanho (A4, Letter), Margens, Papel
3. **Tipografia**: Preview das fontes seleccionadas
4. **Metadados**: Nome do template, descrição, categoria

### 6. DocumentImportDialog

**Localização:** `components/document-editor/document-import-dialog.tsx`

Modal para importar templates DOCX existentes.

#### Fluxo

1. Utilizador selecciona ficheiro .docx
2. Validação de tipo (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
3. Parse com **Mammoth.js** → HTML
4. Load HTML no editor via `editorRef.current?.setContent(html)`

#### Código Exemplo

```typescript
const handleImportDocx = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertArrayBuffer({
    arrayBuffer,
    convertImage: mammoth.images.imgElement(async (image) => {
      const url = await uploadImageToR2(image.read('blob'))
      return { src: url }
    })
  })
  
  editorRef.current?.setContent(result.value) // HTML
}
```

---

## Hooks

### 1. useEditor()

**Origem:** TipTap (built-in)

Inicializa e gerencia uma instância de editor TipTap.

```typescript
const editor = useEditor({
  extensions: [/* ... */],
  content: initialContent,
  editable: mode !== 'readonly',
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    onContentChange?.(html)
  },
})

// Acesso a métodos
editor?.chain().focus().toggleBold().run()
editor?.getJSON() // Exportar JSON
editor?.getHTML() // Exportar HTML
```

### 2. useTemplateVariables()

**Localização:** `hooks/use-template-variables.ts`

Fetch variáveis disponíveis do backend (sistema + customizáveis).

```typescript
const { data: variables, isLoading } = useTemplateVariables()

// Retorna:
// {
//   category: 'Utilizador',
//   variables: [
//     { name: 'nome_utilizador', label: 'Nome do Utilizador', type: 'string' },
//     { name: 'email_utilizador', label: 'Email', type: 'string' },
//   ]
// }
```

### 3. useEmailTemplate()

**Localização:** `hooks/use-email-template.ts`

Fetch template individual da API.

```typescript
const { data: template, isLoading, error } = useEmailTemplate(templateId)

// Template shape:
// {
//   id: 'uuid',
//   name: 'Template X',
//   subject: 'Assunto do email (se email template)',
//   content_html: '<div>...</div>',
//   category: 'Confirmacoes',
//   created_at: '2026-02-25T...',
//   variables: { categoria: [...] }
// }
```

### 4. useEmailTemplates()

**Localização:** `hooks/use-email-templates.ts`

Fetch listagem de templates com filtros.

```typescript
const { data: templates, isLoading } = useEmailTemplates(options?: {
  category?: string
  search?: string
  limit?: number
})
```

### 5. useImperativeHandle (Interno)

Dentro de `DocumentEditor`, usado para expor métodos imperativos pelo ref:

```typescript
useImperativeHandle(ref, () => ({
  getContent: () => editor?.getHTML() || '',
  setContent: (html: string) => editor?.commands.setContent(html),
  insertVariable: (name: string) => 
    editor?.chain().focus().insertContent(`{{${name}}}`).run(),
  // ... etc
}), [editor])
```

---

## Types & Interfaces

### 1. Template Types

**Localização:** `types/template.ts`

```typescript
// Template base (stored em tpl_doc_library)
export interface Template {
  id: string
  name: string
  category: string
  content_html: string
  letterhead_url?: string | null
  letterhead_file_name?: string | null
  letterhead_file_type?: string | null
  created_at: string
  updated_at: string
  created_by?: string
  is_active: boolean
}

// Template com variáveis injectadas
export interface TemplateWithContent extends Template {
  variables?: Record<string, TemplateVariable[]>
  rendered_content?: string // HTML com data injectado
}

// Variável de template
export interface TemplateVariable {
  name: string                // nome_cliente
  label: string               // Nome do Cliente
  type: 'string' | 'number' | 'date' | 'email'
  category: string            // Cliente
  example?: string
  required: boolean
}

// Dados para render
export interface TemplateRenderData {
  [key: string]: string | number | Date
}
```

### 2. Editor Types

**Localização:** `components/document-editor/types.ts`

```typescript
// Modo de operação
export type EditorMode = 'template' | 'document' | 'readonly'

// Props do editor
export interface DocumentEditorProps {
  templateId?: string | null
  initialTemplate?: TemplateWithContent | null
  mode?: EditorMode
  onSave?: (content: string) => void
  onContentChange?: (content: string) => void
}

// Ref imperativo
export interface DocumentEditorRef {
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
}

// Configuração de página
export interface DocumentSettingsConfig {
  pageFormat: 'A4' | 'Letter' | 'Legal'
  marginTop: number    // mm
  marginBottom: number
  marginLeft: number
  marginRight: number
  fontFamily: string
  fontSize: number
  lineHeight: number
}

// Fonte disponível
export const EDITOR_FONTS = [
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
] as const

export type EditorFont = typeof EDITOR_FONTS[number]
```

### 3. Extension Types (Custom)

```typescript
// Variable Node (custom extension)
export interface VariableNodeOptions {
  HTMLAttributes: Record<string, any>
}

// Page Break
export interface PageBreakOptions {
  HTMLAttributes: Record<string, any>
}

// Indent
export interface IndentOptions {
  types: string[]
  size: number
}
```

---

## Configuração

### Google Fonts Integration

**Arquivo:** `app/globals.css`

```css
@import url("https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400;1,700&family=Lora:ital,wght@0,400;0,700;1,400;1,700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400;1,600&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Source+Sans+3:ital,wght@0,400;0,700;1,400;1,700&family=Work+Sans:ital,wght@0,400;0,600;1,400;1,600&display=swap");
```

**Importante:** O @import de Google Fonts **DEVE** vir **antes** de todas as outras @import statements (tailwindcss, shadcn, etc.).

### TipTap Extensions Config

**Arquivo:** `components/document-editor/extensions/index.ts`

```typescript
export const getEditorExtensions = () => [
  StarterKit.configure({
    bulletList: { keepMarks: true, HTMLAttributes: { class: 'list-disc list-inside' } },
    orderedList: { keepMarks: true, HTMLAttributes: { class: 'list-decimal list-inside' } },
    heading: { levels: [1, 2, 3, 4, 5, 6] },
  }),
  // ... resto das extensões
]
```

### Custom Tippy Theme

**Arquivo:** `app/globals.css`

```css
/* Editor menu theme (para BubbleMenu e SlashCommand) */
.tippy-box[data-theme~='editor-menu'] {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  color: var(--foreground) !important;
}

.tippy-box[data-theme~='editor-menu'] .tippy-arrow {
  display: none !important;
}

/* Popover/Dropdown no-wrap */
[data-radix-dropdown-menu-content],
[data-radix-popover-content] {
  white-space: nowrap !important;
}

[data-radix-dropdown-menu-item],
[data-radix-popover-content] > * {
  white-space: nowrap !important;
}
```

### Environment Variables

**Arquivo:** `.env.local`

```bash
# Supabase (para fetch de templates/variáveis)
NEXT_PUBLIC_SUPABASE_URL=https://umlndumjfamfsswwjgoo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Cloudflare R2 (para upload de imagens)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=public
R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev
```

---

## API Integration

### 1. Fetch Template (GET)

**Route:** `GET /api/libraries/docs/:id`

```typescript
// Response
{
  id: 'uuid',
  name: 'Template X',
  category: 'Confirmacoes',
  content_html: '<div>...</div>',
  letterhead_url: 'https://r2.dev/...',
  created_at: '2026-02-24T...',
  variables: {
    'Cliente': [
      { name: 'nome_cliente', label: 'Nome', type: 'string', example: 'João' },
      { name: 'email_cliente', label: 'Email', type: 'email', example: 'joao@mail.com' }
    ],
    'Propriedade': [
      { name: 'ref_propriedade', label: 'Referência', type: 'string' }
    ]
  }
}
```

### 2. Save Template (POST/PUT)

**Route:** `POST /api/libraries/docs` (criar) ou `PUT /api/libraries/docs/:id` (editar)

**Request Body:**

```typescript
{
  name: 'Confirmação de Compra',
  category: 'Confirmacoes',
  content_html: '<div>...</div>',
  letterhead_url?: 'https://r2.dev/...',
  letterhead_file_name?: 'letterhead.png',
  letterhead_file_type?: 'image/png'
}
```

**Response:**

```typescript
{
  id: 'uuid',
  name: '...',
  created_at: '...',
  message: 'Template guardado com sucesso'
}
```

### 3. List Templates (GET)

**Route:** `GET /api/libraries/docs?category=Confirmacoes&search=...`

**Query Params:**

| Param      | Type   | Description                |
|------------|--------|----------------------------|
| category   | string | Filtrar por categoria      |
| search     | string | Search em name + category  |
| limit      | number | Limit de resultados (50)   |
| offset     | number | Pagination offset (0)      |

**Response:**

```typescript
{
  data: [
    { id, name, category, created_at, variables },
    ...
  ],
  total: 42,
  limit: 50,
  offset: 0
}
```

### 4. Delete Template (DELETE)

**Route:** `DELETE /api/libraries/docs/:id`

**Response:**

```typescript
{
  message: 'Template eliminado com sucesso',
  deletedId: 'uuid'
}
```

### 5. Get Variables (GET)

**Route:** `GET /api/libraries/template-variables`

**Response:**

```typescript
{
  categories: {
    'Utilizador': [
      { name: 'nome_utilizador', label: 'Nome', type: 'string' },
      { name: 'email_utilizador', label: 'Email', type: 'email' }
    ],
    'Cliente': [
      { name: 'nome_cliente', label: 'Nome Cliente', type: 'string' },
      ...
    ],
    'Propriedade': [...]
  }
}
```

---

## Guia de Uso

### 1. Criar Novo Template

**Rota:** `/dashboard/templates-documentos/novo`

```tsx
// app/dashboard/templates-documentos/novo/page.tsx
'use client'

import { DocumentTemplateEditor } from '@/components/document-editor'

export default function NewTemplatePage() {
  return (
    <div>
      <h1>Novo Template de Documento</h1>
      <DocumentTemplateEditor 
        templateId={null} 
        initialTemplate={null}
        mode="template"
        onSave={(content) => {
          // POST /api/libraries/docs com name + category
          toast.success('Template criado!')
        }}
      />
    </div>
  )
}
```

### 2. Editar Template Existente

**Rota:** `/dashboard/templates-documentos/[id]`

```tsx
// app/dashboard/templates-documentos/[id]/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useEmailTemplate } from '@/hooks/use-email-template'
import { DocumentTemplateEditor } from '@/components/document-editor'

export default function EditTemplatePage() {
  const { id } = useParams()
  const { data: template, isLoading } = useEmailTemplate(id as string)

  if (isLoading) return <Skeleton />
  if (!template) return <NotFound />

  return (
    <DocumentTemplateEditor 
      templateId={id as string}
      initialTemplate={template}
      mode="template"
      onSave={(content) => {
        // PUT /api/libraries/docs/[id] com content
      }}
    />
  )
}
```

### 3. Usar Editor em Modal

```typescript
import { useRef } from 'react'
import { DocumentTemplateEditor, type DocumentEditorRef } from '@/components/document-editor'

export function MyDialog() {
  const editorRef = useRef<DocumentEditorRef>(null)

  const handleSave = async () => {
    const html = editorRef.current?.getContent()
    await fetch('/api/libraries/docs', {
      method: 'POST',
      body: JSON.stringify({ 
        name, 
        category, 
        content_html: html 
      })
    })
  }

  return (
    <Dialog>
      <DialogContent>
        <DocumentTemplateEditor 
          ref={editorRef}
          mode="template"
        />
        <DialogFooter>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 4. Renderizar Template com Dados

```typescript
import { renderTemplate } from '@/lib/email-renderer'

const template = await fetchTemplate(templateId)
const rendered = renderTemplate(template.content_html, {
  nome_cliente: 'João Silva',
  email_cliente: 'joao@mail.com',
  ref_propriedade: 'PROP-2026-00042'
})

// rendered = '<div>Olá João Silva, referência da propriedade: PROP-2026-00042</div>'
```

---

## Exemplos Práticos

### Exemplo 1: Inserir Tabela via API

```typescript
// Usando ref imperativo
const editorRef = useRef<DocumentEditorRef>(null)

const handleInsertTable = () => {
  editorRef.current?.insertTable(3, 3)  // 3 linhas, 3 colunas
}

// No JSX
<DocumentTemplateEditor ref={editorRef} />
<Button onClick={handleInsertTable}>Adicionar Tabela 3x3</Button>
```

### Exemplo 2: Carregar Template e Modificar

```typescript
const editorRef = useRef<DocumentEditorRef>(null)
const { data: template } = useEmailTemplate(templateId)

useEffect(() => {
  if (template?.content_html) {
    editorRef.current?.setContent(template.content_html)
  }
}, [template])
```

### Exemplo 3: Import DOCX

```typescript
// Abrir modal de import
const [importOpen, setImportOpen] = useState(false)

const handleImport = (file: File) => {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertArrayBuffer({ arrayBuffer })
  editorRef.current?.setContent(result.value)
  setImportOpen(false)
}

// No JSX
<DocumentImportDialog 
  open={importOpen}
  onImport={handleImport}
/>
```

### Exemplo 4: Variáveis Dinâmicas

```typescript
// Ao clicar em botão "Inserir Variável"
const { data: variables } = useTemplateVariables()

const handleInsertVariable = (varName: string) => {
  editorRef.current?.insertVariable(varName)  // Insere {{varName}}
}

// Variables render como:
// <span class="variable-node">{{nome_cliente}}</span> com background amarelo
```

### Exemplo 5: Save com Validação

```typescript
const [isSaving, setIsSaving] = useState(false)

const handleSave = async () => {
  const html = editorRef.current?.getContent()
  
  if (!html || html.length < 10) {
    toast.error('Template muito curto')
    return
  }

  setIsSaving(true)
  try {
    const res = await fetch(
      templateId ? `/api/libraries/docs/${templateId}` : '/api/libraries/docs',
      {
        method: templateId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          category,
          content_html: html
        })
      }
    )

    if (!res.ok) throw new Error(await res.text())
    
    toast.success(templateId ? 'Template actualizado!' : 'Template criado!')
  } catch (error) {
    toast.error('Erro ao guardar')
  } finally {
    setIsSaving(false)
  }
}
```

---

## Troubleshooting

### ❌ BubbleMenu não aparece

**Causa:** Menu pode estar escondido por z-index ou espaço insuficiente.

**Solução:**

```typescript
// Verificar tippyOptions
<BubbleMenu
  editor={editor}
  tippyOptions={{
    theme: 'editor-menu',
    popperOptions: {
      modifiers: [
        { name: 'preventOverflow', options: { padding: 8 } }
      ]
    }
  }}
/>
```

### ❌ Variáveis não renderizam

**Causa:** Extension `VariableNode` pode não estar registada.

**Solução:** Verificar que está em `getEditorExtensions()` e que o selector match `{{...}}`.

### ❌ DOCX import falha

**Causa:** Ficheiro inválido ou CORS issue com fetch de imagens.

**Solução:**

```typescript
// Usar convertImage com R2
const result = await mammoth.convertArrayBuffer({
  arrayBuffer,
  convertImage: mammoth.images.imgElement(async (image) => {
    try {
      const url = await uploadToR2(image.read('blob'))
      return { src: url }
    } catch (e) {
      console.warn('Falha ao upload imagem:', e)
      return { src: '' } // Fallback vazio
    }
  })
})
```

### ❌ Dropdown text wrapping

**Causa:** Tailwind classes não aplicadas a RadixUI internals.

**Solução:** Usar data-attributes selectors em `globals.css`:

```css
[data-radix-dropdown-menu-content] {
  white-space: nowrap !important;
}
```

---

## Database Schema

### Tabela: `tpl_doc_library`

```sql
CREATE TABLE tpl_doc_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content_html TEXT NOT NULL,
  letterhead_url TEXT,
  letterhead_file_name TEXT,
  letterhead_file_type TEXT,
  created_by UUID REFERENCES dev_users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);
```

### Tabela: `tpl_template_variables` (Reference)

```sql
CREATE TABLE tpl_template_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'date', 'email')),
  example TEXT,
  required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Performance Tips

1. **Debounce onChange events**
   ```typescript
   const debouncedSave = useDebounce((content) => {
     // Auto-save
   }, 2000)
   ```

2. **Lazy load extensions**
   - Carregar extensões pesadas (Tables, Images) sob demanda

3. **Limite de caracteres**
   - Usar `CharacterCount` extension para avisar em 90k chars

4. **Render otimizado**
   - Usar `React.memo` para componentes que não mudam (toolbar buttons)

5. **Image compression**
   - Comprimir antes de upload ao R2

---

## Roadmap Futuro

- [ ] **Colaboração em tempo real** (Yjs + WebSocket)
- [ ] **Comments/Annotations** numa sidebar
- [ ] **Version control** (snapshots do template)
- [ ] **Template preview** com dados de exemplo
- [ ] **Rich PDF export** (headless-chrome)
- [ ] **A/B testing** (variants de template)
- [ ] **Analytics** (templates mais usados, conversão)

---

## Referências

- [TipTap Documentation](https://tiptap.dev)
- [Tippy.js Positioning](https://popper.js.org)
- [Mammoth.js (DOCX)](https://github.com/mwilkinson/mammoth.js)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Supabase PostgreSQL](https://supabase.com/docs/guides/database)

---

**Maintainer:** Claude Code Assistant  
**Última Actualização:** 25 de Fevereiro de 2026  
**Versão:** 1.0
