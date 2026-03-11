# 🧩 Referência Completa de Componentes

**Documentação detalhada de todos os componentes do Editor de Documentos**

## Tabela de Conteúdos

1. [DocumentEditor](#documenteditor)
2. [DocumentToolbar](#documenttoolbar)
3. [DocumentBubbleMenu](#documentbubblemenu)
4. [DocumentSlashCommand](#documentslashcommand)
5. [DocumentSettingsPanel](#documentsettingspanel)
6. [DocumentImportDialog](#documentimportdialog)
7. [Custom Extensions](#custom-extensions)

---

## DocumentEditor

**Localização:** `components/document-editor/document-editor.tsx`

Componente principal encapsulador com gerenciamento completo do TipTap editor.

### Props Interface

```typescript
interface DocumentEditorProps {
  /**
   * ID do template (null se criando novo)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  templateId?: string | null

  /**
   * Dados iniciais do template
   * Carrega HTML inicial e variáveis disponíveis
   */
  initialTemplate?: TemplateWithContent | null

  /**
   * Modo de operação do editor
   * - 'template': com inserção de variáveis ({{...}})
   * - 'document': rich text sem variáveis
   * - 'readonly': apenas visualização
   * @default 'template'
   */
  mode?: 'template' | 'document' | 'readonly'

  /**
   * Callback disparado ao guardar (botão Save)
   * Recebe HTML do editor
   */
  onSave?: (content: string) => void

  /**
   * Callback disparado a cada mudança de conteúdo
   * Útil para auto-save
   */
  onContentChange?: (content: string) => void
}
```

### Ref Interface (useImperativeHandle)

```typescript
interface DocumentEditorRef {
  /**
   * Retorna HTML do editor
   * @returns HTML string
   */
  getContent: () => string

  /**
   * Carrega conteúdo HTML no editor
   * @param html - HTML string
   */
  setContent: (html: string) => void

  /**
   * Insere tabela
   * @param rows - Número de linhas
   * @param cols - Número de colunas
   */
  insertTable: (rows: number, cols: number) => void

  /**
   * Insere imagem
   * @param src - URL da imagem
   * @param alt - Texto alternativo
   */
  insertImage: (src: string, alt?: string) => void

  /**
   * Insere quebra de página
   */
  insertPageBreak: () => void

  /**
   * Insere linha separadora (HR)
   */
  insertLine: () => void

  /**
   * Insere variável {{name}}
   * @param name - Nome da variável
   */
  insertVariable: (name: string) => void

  /**
   * Insere link
   * @param url - URL destination
   * @param text - Texto do link
   */
  insertLink: (url: string, text: string) => void

  /**
   * Limpa todo o conteúdo
   */
  clear: () => void

  /**
   * Coloca foco no editor
   */
  focus: () => void
}
```

### Exemplo de Uso

```typescript
import { useRef } from 'react'
import { DocumentEditor, type DocumentEditorRef } from '@/components/document-editor'

export function MyComponent() {
  const editorRef = useRef<DocumentEditorRef>(null)

  const handleGetContent = () => {
    const html = editorRef.current?.getContent()
    console.log('Editor content:', html)
  }

  const handleInsertTable = () => {
    editorRef.current?.insertTable(3, 3)
  }

  return (
    <div>
      <DocumentEditor
        ref={editorRef}
        templateId={null}
        mode="template"
        onContentChange={(content) => console.log('Changed:', content)}
      />
      <button onClick={handleGetContent}>Get Content</button>
      <button onClick={handleInsertTable}>Insert 3x3 Table</button>
    </div>
  )
}
```

### State Management Interno

```typescript
// Font family state
const [fontFamily, setFontFamily] = useState<EditorFont>('Arial')

// Font size state (8-36px)
const [fontSize, setFontSize] = useState<number>(16)

// Line height state (1.0-2.5)
const [lineHeight, setLineHeight] = useState<number>(1.5)

// Variables loading
const [isLoadingVariables, setIsLoadingVariables] = useState(false)

// Settings panel visibility
const [showSettings, setShowSettings] = useState(true)

// DOCX import dialog state
const [importDialogOpen, setImportDialogOpen] = useState(false)
```

### Integração com TipTap

```typescript
const editor = useEditor({
  extensions: getEditorExtensions(),
  content: initialTemplate?.content_html || DEFAULT_CONTENT,
  editable: mode !== 'readonly',
  
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    onContentChange?.(html)
    
    // Update character count
    const charCount = editor.storage.characterCount.characters()
    // ...
  },

  onSelectionUpdate: ({ editor, transaction }) => {
    // Actualizar fontFamily/fontSize quando selecciona texto
    const { $from } = transaction.selection
    const marks = $from.marks()
    // ...
  },

  onContentError: ({ error }) => {
    console.error('TipTap error:', error)
  }
})
```

### Lifecycle (useEffect)

```typescript
// Decode HTML initialTemplate
useEffect(() => {
  if (initialTemplate?.content_html && !contentSet) {
    editorRef.current?.setContent(initialTemplate.content_html)
    setContentSet(true)
  }
}, [initialTemplate])

// Load variables
useEffect(() => {
  setIsLoadingVariables(true)
  fetchVariables().then(setVariables).finally(() => setIsLoadingVariables(false))
}, [mode])

// Cleanup
useEffect(() => {
  return () => {
    editor?.destroy()
  }
}, [editor])
```

---

## DocumentToolbar

**Localização:** `components/document-editor/document-toolbar.tsx`

Barra de ferramentas superior com controlos de formatação e inserção.

### Props

```typescript
interface DocumentToolbarProps {
  editor: Editor | null
  mode?: EditorMode
  fontFamily?: string
  onFontFamilyChange?: (font: EditorFont) => void
  fontSize?: number
  onFontSizeChange?: (size: number) => void
  lineHeight?: number
  onLineHeightChange?: (lh: number) => void
  isLoading?: boolean
}
```

### Controlos Disponíveis

#### 1. Font Family Dropdown

```typescript
<Select value={fontFamily} onValueChange={handleFontFamily}>
  <SelectTrigger className="w-40">
    <SelectValue placeholder="Font..." />
  </SelectTrigger>
  <SelectContent className="w-auto whitespace-nowrap">
    {EDITOR_FONTS.map(font => (
      <SelectItem key={font} value={font}>
        <span style={{ fontFamily: font }}>{font}</span>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Fontes disponíveis (12 total):**
- Times New Roman
- Arial
- Roboto
- Open Sans
- Source Serif 4
- Libre Baskerville
- Merriweather
- Lora
- Crimson Pro
- Playfair Display
- Source Sans 3
- Work Sans

#### 2. Font Size Slider

```typescript
<Select value={fontSize.toString()} onValueChange={(v) => changeFontSize(+v)}>
  <SelectTrigger className="w-20">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36].map(size => (
      <SelectItem key={size} value={size.toString()}>
        {size}px
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Range:** 8px - 36px

#### 3. Line Height Slider

```typescript
<Select value={lineHeight.toString()} onValueChange={(v) => changeLineHeight(+v)}>
  <SelectTrigger className="w-24">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {[1.0, 1.15, 1.5, 1.75, 2.0, 2.5].map(lh => (
      <SelectItem key={lh} value={lh.toString()}>
        {lh.toFixed(2)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

**Range:** 1.0 - 2.5

#### 4. Formatting Buttons

| Botão       | Atalho | Acção                              |
|-------------|--------|----------------------------------|
| **B**       | Ctrl+B | `toggleBold()`                    |
| *I*        | Ctrl+I | `toggleItalic()` + `toggleStyle()` |
| <u>U</u>   | Ctrl+U | `toggleUnderline()`               |
| ~~S~~      | -      | `toggleStrike()`                  |
| `Code`     | Ctrl+` | `toggleCode()`                    |

#### 5. Color Pickers

```typescript
// Text Color
<Popover>
  <PopoverTrigger asChild>
    <button className="flex items-center gap-2">
      <span className="text-lg">A</span>
      <ChevronDown className="h-4 w-4" />
    </button>
  </PopoverTrigger>
  <PopoverContent>
    <ColorPicker 
      value={selectedColor}
      onChange={(color) => editor?.chain().focus().setColor(color).run()}
    />
  </PopoverContent>
</Popover>

// Highlight Color
<Popover>
  <PopoverTrigger asChild>
    <button className="bg-yellow-200 rounded px-2">
      <Highlighter className="h-4 w-4" />
    </button>
  </PopoverTrigger>
  <PopoverContent>
    <ColorPicker
      value={selectedHighlight}
      onChange={(color) => editor?.chain().focus().toggleHighlight({ color }).run()}
    />
  </PopoverContent>
</Popover>
```

#### 6. Alignment Buttons

```typescript
const alignments = ['left', 'center', 'right', 'justify']

{alignments.map(align => (
  <button
    key={align}
    onClick={() => editor?.chain().focus().setTextAlign(align).run()}
    className={editor?.isActive({ textAlign: align }) ? 'bg-accent' : ''}
  >
    <AlignIcon align={align} />
  </button>
))}
```

#### 7. List Buttons

```typescript
// Bullet List
<button onClick={() => editor?.chain().focus().toggleBulletList().run()}>
  <List className="h-4 w-4" />
</button>

// Ordered List
<button onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
  <ListOrdered className="h-4 w-4" />
</button>

// Task List
<button onClick={() => editor?.chain().focus().toggleTaskList().run()}>
  <CheckSquare className="h-4 w-4" />
</button>
```

#### 8. Insert Dropdown

```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button className="flex items-center gap-2">
      Inserir
      <ChevronDown className="h-4 w-4" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
    <DropdownMenuItem onClick={() => editor?.chain().focus().insertTable(...).run()}>
      <Table className="mr-2 h-4 w-4" />
      <span>Tabela (3x3)</span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={handleInsertImage}>
      <Image2 className="mr-2 h-4 w-4" />
      <span>Imagem</span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => editor?.chain().focus().pageBreak().run()}>
      <FileText className="mr-2 h-4 w-4" />
      <span>Quebra de Página</span>
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
      <Minus className="mr-2 h-4 w-4" />
      <span>Linha Separadora</span>
    </DropdownMenuItem>
    {mode === 'template' && (
      <DropdownMenuItem onClick={showVariableDialog}>
        <Braces className="mr-2 h-4 w-4" />
        <span>Variável</span>
      </DropdownMenuItem>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

### Eventos

```typescript
// Font change
const handleFontFamily = (font: EditorFont) => {
  editor?.chain().focus().setFontFamily(font).run()
  onFontFamilyChange?.(font)
}

// Size change
const handleFontSize = (size: number) => {
  editorRef.current?.style.setProperty('--font-size', `${size}px`)
  onFontSizeChange?.(size)
}

// Line height change
const handleLineHeight = (lh: number) => {
  editor?.view.dom.style.lineHeight = lh.toString()
  onLineHeightChange?.(lh)
}
```

---

## DocumentBubbleMenu

**Localização:** `components/document-editor/document-bubble-menu.tsx`

Menu flutuante contextual que aparece ao seleccionar texto.

### Props

```typescript
interface DocumentBubbleMenuProps {
  editor: Editor | null
  mode?: EditorMode
  isLoadingVariables?: boolean
  variables?: Record<string, TemplateVariable[]>
}
```

### Elementos Visíveis

```
┌─── Bubble Menu ────────────────────────────┐
│ B I U ~~  | Color | Highlight | Align      │
│ Link | {{} | Remove Link | More...        │
└────────────────────────────────────────────┘
```

### Botões Principais

#### Text Style Buttons
```typescript
const styleButtons = [
  { icon: Bold, action: 'toggleBold', title: 'Bold (Ctrl+B)' },
  { icon: Italic, action: 'toggleItalic', title: 'Italic (Ctrl+I)' },
  { icon: Underline, action: 'toggleUnderline', title: 'Underline (Ctrl+U)' },
  { icon: Strikethrough, action: 'toggleStrike', title: 'Strikethrough' },
]

{styleButtons.map(btn => (
  <BubbleButton
    key={btn.action}
    isActive={editor?.isActive(btn.action)}
    onClick={() => editor?.chain().focus()[btn.action]?.().run()}
    title={btn.title}
  >
    <btn.icon className="h-4 w-4" />
  </BubbleButton>
))}
```

#### Color & Highlight

```typescript
// Text Color Picker
<Popover>
  <PopoverTrigger asChild>
    <BubbleButton title="Text Color">
      <Type className="h-4 w-4" />
    </BubbleButton>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-3">
    <div className="flex flex-wrap gap-2">
      {COLORS.map(color => (
        <button
          key={color}
          className="w-6 h-6 rounded border"
          style={{ backgroundColor: color }}
          onClick={() => editor?.chain().focus().setColor(color).run()}
        />
      ))}
    </div>
  </PopoverContent>
</Popover>

// Highlight Color (similar)
```

#### Link Management

```typescript
// Link Popover (appears if selection is link)
{editor?.isActive('link') ? (
  <>
    <BubbleButton
      onClick={() => editor?.chain().focus().editLink().run()}
      title="Edit Link"
    >
      <Link className="h-4 w-4" />
    </BubbleButton>
    <BubbleButton
      onClick={() => editor?.chain().focus().unsetLink().run()}
      title="Remove Link"
    >
      <Unlink className="h-4 w-4" />
    </BubbleButton>
  </>
) : (
  // Link creation popover
  <Popover open={linkOpen} onOpenChange={setLinkOpen}>
    <PopoverTrigger asChild>
      <BubbleButton title="Insert Link (Ctrl+K)">
        <Link className="h-4 w-4" />
      </BubbleButton>
    </PopoverTrigger>
    <PopoverContent>
      <input 
        autoFocus
        type="url" 
        placeholder="https://..."
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleInsertLink()
        }}
      />
    </PopoverContent>
  </Popover>
)}
```

#### Alignment Buttons

```typescript
// Text alignment buttons
{['left', 'center', 'right', 'justify'].map(align => (
  <BubbleButton
    key={align}
    isActive={editor?.isActive({ textAlign: align })}
    onClick={() => editor?.chain().focus().setTextAlign(align).run()}
  >
    <AlignmentIcon type={align} />
  </BubbleButton>
))}
```

#### Variable Insertion (Template Mode Only)

```typescript
{mode === 'template' && (
  <Popover open={varOpen} onOpenChange={setVarOpen}>
    <PopoverTrigger asChild>
      <BubbleButton 
        title="Insert Variable (only in template mode)"
        disabled={isLoadingVariables}
      >
        <Braces className="h-4 w-4" />
      </BubbleButton>
    </PopoverTrigger>
    <PopoverContent className="w-64">
      <div className="space-y-3">
        {isLoadingVariables ? (
          <Skeleton className="h-20" />
        ) : (
          Object.entries(variables || {}).map(([category, vars]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold mb-2">{category}</h4>
              <div className="space-y-1">
                {vars.map(v => (
                  <button
                    key={v.name}
                    className="w-full text-left px-2 py-1 hover:bg-accent rounded text-sm"
                    onClick={() => {
                      editor?.chain().focus().insertContent(`{{${v.name}}}`).run()
                      setVarOpen(false)
                    }}
                  >
                    <code className="text-xs">{v.name}</code>
                    <p className="text-muted-foreground text-xs">{v.label}</p>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </PopoverContent>
  </Popover>
)}
```

### Styling

```typescript
// BubbleButton component
<button
  className={cn(
    'px-2 py-1 rounded hover:bg-accent transition-colors',
    isActive && 'bg-accent text-accent-foreground'
  )}
  onClick={onClick}
  disabled={disabled}
  title={title}
>
  {children}
</button>
```

### Tippy Configuration

```typescript
const tippyOptions = {
  theme: 'editor-menu', // Custom theme (transparent, no arrow)
  popperOptions: {
    modifiers: [
      {
        name: 'preventOverflow',
        options: {
          padding: 8,
        },
      },
    ],
  },
}
```

---

## DocumentSlashCommand

**Localização:** `components/document-editor/document-slash-command.tsx`

Sistema de slash commands (`/table`, `/image`, etc.) com autocomplete menu.

### Estructura Básica

```typescript
const SlashCommand = Command.create({
  name: 'slashCommand',
  
  addOptions() {
    return {
      suggestion: {
        items: ({ query }) => {
          return SUGGESTIONS
            .filter(item => item.title.toLowerCase().startsWith(query.toLowerCase()))
            .slice(0, 10)
        },
        
        render() {
          let component: any
          let popup: any
          
          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props,
                editor: props.editor,
              })
              popup = new Tippy(document.body, {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'editor-menu',
              })
            },
            
            onUpdate(props) {
              component?.updateProps(props)
              popup?.setProps({
                getReferenceClientRect: props.clientRect,
              })
            },
            
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.hide()
                return true
              }
              
              if (props.event.key === 'ArrowUp') {
                component?.onKeyDown(props)
                return true
              }
              
              if (props.event.key === 'ArrowDown') {
                component?.onKeyDown(props)
                return true
              }
              
              if (props.event.key === 'Enter') {
                component?.onKeyDown(props)
                return true
              }
              
              return false
            },
            
            onExit() {
              popup?.destroy()
              component?.destroy()
            },
          }
        },
      },
    }
  },
})
```

### Comandos Disponíveis

```typescript
interface SlashCommandItem {
  title: string
  description: string
  searchTerms: string[]
  icon: ReactNode
  command: ({ editor, range }: { editor: Editor; range: Range }) => void
}

const SUGGESTIONS: SlashCommandItem[] = [
  {
    title: 'Tabela',
    description: 'Inserir uma tabela 3x3',
    searchTerms: ['tabela', 'table', 'grid'],
    icon: <Table className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run()
    },
  },
  
  {
    title: 'Imagem',
    description: 'Inserir uma imagem via URL',
    searchTerms: ['imagem', 'image', 'img'],
    icon: <Image2 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      // Abrir image URL dialog
      showImageDialog((url) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setImage({ src: url })
          .run()
      })
    },
  },

  {
    title: 'Quebra de Página',
    description: 'Adicionar quebra de página',
    searchTerms: ['quebra', 'pagina', 'page', 'break'],
    icon: <FileText className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .pageBreak()
        .run()
    },
  },

  {
    title: 'Linha',
    description: 'Inserir linha separadora',
    searchTerms: ['linha', 'hr', 'separator'],
    icon: <Minus className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHorizontalRule()
        .run()
    },
  },

  // Headings
  {
    title: 'Titulo 1',
    description: 'Heading grande',
    searchTerms: ['heading1', 'h1', 'titulo'],
    icon: <Heading1 className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 1 })
        .run()
    },
  },
  // ... H2-H6 similar

  // Lists
  {
    title: 'Bullet List',
    description: 'Lista com bullets',
    searchTerms: ['bullets', 'bullet', 'list'],
    icon: <List className="w-4 h-4" />,
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBulletList()
        .run()
    },
  },
  // ... mais

  // Variables (template mode only)
  {
    title: 'Variável',
    description: 'Inserir {{variable}} placeholder',
    searchTerms: ['var', 'variable', 'placeholder'],
    icon: <Braces className="w-4 h-4" />,
    command: ({ editor, range }) => {
      showVariableDialog((varName) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(`{{${varName}}}`)
          .run()
      })
    },
  },
]
```

### Menu Visuals (SlashCommandMenu Component)

```typescript
export const SlashCommandMenu = forwardRef<any>((props: {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
  selectedIndex: number
  onSelect: (index: number) => void
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        props.command(items[selectedIndex])
        return true
      }
      return false
    },
  }))

  return (
    <div 
      ref={containerRef}
      className="z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => props.command(item)}
          onMouseEnter={() => setSelectedIndex(index)}
          className={cn(
            'w-full px-2 py-1.5 text-sm rounded flex items-start justify-between',
            index === selectedIndex && 'bg-accent'
          )}
        >
          <div>
            <p className="font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
          <div className="text-muted-foreground">
            {item.icon}
          </div>
        </button>
      ))}
    </div>
  )
})
```

---

## DocumentSettingsPanel

**Localização:** `components/document-editor/document-settings-panel.tsx`

Sidebar com variáveis, configurações e preview.

### Props

```typescript
interface DocumentSettingsPanelProps {
  editor: Editor | null
  variables?: Record<string, TemplateVariable[]>
  isLoadingVariables?: boolean
  templateName?: string
  onTemplateNameChange?: (name: string) => void
  mode?: EditorMode
}
```

### Secções Internas

```typescript
export function DocumentSettingsPanel(props) {
  const [activeTab, setActiveTab] = useState<'variables' | 'settings' | 'metadata'>('variables')

  return (
    <div className="w-64 border-l bg-muted/20 p-4 overflow-y-auto">
      {/* Aba: Variáveis */}
      {activeTab === 'variables' && (
        <div className="space-y-4">
          <h3 className="font-semibold">Variáveis Disponíveis</h3>
          {isLoadingVariables ? (
            <Skeleton className="h-20" />
          ) : (
            <VariablesSection variables={variables} />
          )}
        </div>
      )}

      {/* Aba: Configurações */}
      {activeTab === 'settings' && (
        <SettingsTab editor={editor} />
      )}

      {/* Aba: Metadados */}
      {activeTab === 'metadata' && (
        <MetadataTab templateName={templateName} onNameChange={onTemplateNameChange} />
      )}
    </div>
  )
}
```

### VariablesSection Component

```typescript
function VariablesSection({ variables }) {
  /
  return (
    <div className="space-y-3">
      {Object.entries(variables || {}).map(([category, vars]) => (
        <div key={category}>
          <details className="group cursor-pointer">
            <summary className="text-sm font-medium text-muted-foreground">
              {category}
              <span className="ml-auto inline-block transition group-open:rotate-180">
                <ChevronRight className="h-4 w-4" />
              </span>
            </summary>
            <div className="space-y-1 mt-2 ml-2">
              {vars.map(v => (
                <VariableItemButton key={v.name} variable={v} />
              ))}
            </div>
          </details>
        </div>
      ))}
    </div>
  )
}

function VariableItemButton({ variable }: { variable: TemplateVariable }) {
  const { editor } = useEditorContext()
  
  return (
    <button
      className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
      onClick={() => {
        editor?.chain()
          .focus()
          .insertContent(`{{${variable.name}}}`)
          .run()
      }}
      title={variable.example}
    >
      <code className="text-xs font-mono">{variable.name}</code>
      <p className="text-xs text-muted-foreground truncate">{variable.label}</p>
      {variable.example && (
        <p className="text-xs text-muted-foreground/60 truncate">Ex: {variable.example}</p>
      )}
    </button>
  )
}
```

### SettingsTab

```typescript
function SettingsTab({ editor }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Configurações de Página</h3>
      
      {/* Page Format */}
      <div>
        <label className="text-sm font-medium">Formato</label>
        <Select>
          <SelectTrigger className="text-xs">
            <SelectValue defaultValue="A4" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="A4">A4 (210x297mm)</SelectItem>
            <SelectItem value="Letter">Letter (8.5x11")</SelectItem>
            <SelectItem value="Legal">Legal (8.5x14")</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Margins */}
      <div>
        <label className="text-sm font-medium">Margens (mm)</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <input type="number" placeholder="Top" min="0" max="50" />
          <input type="number" placeholder="Right" min="0" max="50" />
          <input type="number" placeholder="Bottom" min="0" max="50" />
          <input type="number" placeholder="Left" min="0" max="50" />
        </div>
      </div>

      {/* Font Preview */}
      <div>
        <label className="text-sm font-medium mb-2 block">Preview Tipografia</label>
        <div className="border rounded p-3 text-sm space-y-1">
          <div style={{ fontFamily: 'Arial' }}>Arial: The quick brown fox</div>
          <div style={{ fontFamily: 'Merriweather' }}>Merriweather: The quick brown fox</div>
          <div style={{ fontFamily: 'Playfair Display' }}>Playfair: The quick brown fox</div>
        </div>
      </div>
    </div>
  )
}
```

---

## DocumentImportDialog

**Localização:** `components/document-editor/document-import-dialog.tsx`

Modal para importar templates DOCX.

### Props

```typescript
interface DocumentImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (html: string) => void
  isLoading?: boolean
}
```

### Fluxo Implementação

```typescript
export function DocumentImportDialog(props) {
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      // Validate file type
      if (!selected.type.includes('wordprocessingml') && !selected.name.endsWith('.docx')) {
        toast.error('Apenas ficheiros .docx são suportados')
        return
      }
      setFile(selected)
    }
  }

  const handleImport = async () => {
    if (!file) return
    
    setIsProcessing(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      
      // Convert DOCX to HTML using Mammoth
      const result = await mammoth.convertArrayBuffer({
        arrayBuffer,
        styleMap: [
          "p[style-name='Title'] => h1",
          "p[style-name='Heading 1'] => h1",
          "p[style-name='Heading 2'] => h2",
        ],
        convertImage: mammoth.images.imgElement(async (image) => {
          // Handle image extraction
          try {
            const blob = await image.read('blob')
            const base64 = await blobToBase64(blob)
            return {
              src: base64, // Inline base64 or upload to R2
            }
          } catch (e) {
            console.warn('Image conversion failed:', e)
            return { src: '' }
          }
        }),
      })

      // Clean up HTML
      const cleanedHtml = cleanDocxHtml(result.value)
      
      props.onImport(cleanedHtml)
      props.onOpenChange(false)
      toast.success('Template importado com sucesso')
    } catch (error) {
      console.error('Import failed:', error)
      toast.error('Falha ao importar DOCX')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Template DOCX</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-accent transition-colors"
            onDragOver={(e) => {
              e.preventDefault()
              e.currentTarget.classList.add('border-accent')
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('border-accent')
            }}
            onDrop={(e) => {
              e.preventDefault()
              const dropped = e.dataTransfer.files[0]
              if (dropped) handleFileSelect({ target: { files: e.dataTransfer.files } } as any)
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <div className="space-y-2">
                <CheckCircle className="h-8 w-8 mx-auto text-green-600" />
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Arraste um ficheiro .docx ou clique para seleccionar</p>
              </div>
            )}
          </div>

          {/* Warning */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Apenas estilos básicos são preservados. Revise o conteúdo após importação.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || isProcessing}
            isLoading={isProcessing}
          >
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Limpeza de HTML DOCX

```typescript
function cleanDocxHtml(html: string): string {
  // Parser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove unnecessary attributes
  doc.querySelectorAll('*').forEach(el => {
    const attrs = Array.from(el.attributes)
    attrs.forEach(attr => {
      if (!['href', 'src', 'alt', 'title', 'data-*'].some(k => attr.name.includes(k))) {
        el.removeAttribute(attr.name)
      }
    })
  })

  // Remove empty elements
  doc.querySelectorAll('p, div, span').forEach(el => {
    if (!el.textContent?.trim()) {
      el.parentNode?.removeChild(el)
    }
  })

  return doc.body.innerHTML
}
```

---

## Custom Extensions

### VariableNode

**Localização:** `components/document-editor/extensions/variable-node.ts`

Extensão customizada que define o elemento `{{variable}}`.

```typescript
export const VariableNode = Node.create({
  name: 'variable',
  
  group: 'inline',
  inline: true,
  atom: true,
  
  addAttributes() {
    return {
      name: {
        default: 'variableName',
        parseHTML: element => element.getAttribute('data-name'),
        renderHTML: attributes => ({
          'data-name': attributes.name,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="variable"]',
      },
    ]
  },

  renderHTML({ attributes }) {
    return [
      'span',
      {
        class: 'variable-node',
        'data-type': 'variable',
        'data-name': attributes.name,
      },
      `{{${attributes.name}}}`,
    ]
  },

  addInputRules() {
    return [
      new InputRule({
        find: /{{\s*(\w+)\s*}}/,
        handler: ({ state, range, match }) => {
          const { tr } = state
          const name = match[1]
          
          tr.replaceWith(
            range.from,
            range.to,
            this.type.create({ name })
          )
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertVariable: (name: string) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { name },
        })
      },
    }
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: /{{\s*(\w+)\s*}}/g,
        handler: ({ state, range, match }) => {
          const name = match[1]
          const { tr } = state
          
          tr.replaceWith(
            range.from,
            range.to,
            this.type.create({ name })
          )
        },
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewBlock(({ node, selected }) => (
      <span
        className={cn(
          'inline-flex items-center rounded bg-yellow-100 px-2 py-1 text-sm',
          selected && 'ring-2 ring-yellow-400'
        )}
      >
        <code className="font-mono text-xs">{}</code>
      </span>
    ))
  },
})
```

### PageBreak

**Localização:** `components/document-editor/extensions/page-break.ts`

```typescript
export const PageBreak = Node.create({
  name: 'pageBreak',
  
  group: 'block',
  atom: true,
  
  parseHTML() {
    return [{ tag: 'div[data-type="pageBreak"]' }]
  },

  renderHTML() {
    return ['div', { 'data-type': 'pageBreak', class: 'page-break' }, '']
  },

  addCommands() {
    return {
      setPageBreak: () => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
        })
      },
    }
  },
})
```

---

**Fim da Referência de Componentes**

Próximo: Consulte `HOOKS-REFERENCE.md` para documentação de Hooks.
