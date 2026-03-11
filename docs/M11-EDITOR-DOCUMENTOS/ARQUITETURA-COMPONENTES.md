# 🏗️ Arquitetura de Componentes — Layout 3-Painel

**Guia de implementação dos componentes React para o builder visual**

---

## 📁 Estrutura de Ficheiros

```
components/document-builder/                 ← Nova pasta
├── document-builder.tsx                     ← Componente raiz
├── components-panel.tsx                     ← Sidebar esquerda
├── canvas-editor.tsx                        ← Canvas central
├── properties-panel.tsx                     ← Sidebar direita
├── hooks/
│   ├── use-builder-state.ts                ← Zustand store
│   ├── use-canvas-selection.ts              ← Seleção + highlight
│   └── use-canvas-drag-drop.ts              ← Drag & drop logic
├── types/
│   ├── builder.ts                           ← Types centralizados
│   ├── element.ts                           ← Element interface
│   └── properties.ts                        ← Property editors
├── ui/
│   ├── component-item.tsx                   ← Item draggable
│   ├── element-properties-form.tsx          ← Form genérico
│   ├── property-editor.tsx                  ← Editores específicos
│   └── canvas-toolbar.tsx                   ← Bubble menu
└── constants.ts                             ← Componentes base
```

---

## 🧩 Componente Raiz: DocumentBuilder

**Localização:** `components/document-builder/document-builder.tsx`

```typescript
import { useState, useRef } from 'react'
import { useBuilderStore } from './hooks/use-builder-state'
import { ComponentsPanel } from './components-panel'
import { CanvasEditor } from './canvas-editor'
import { PropertiesPanel } from './properties-panel'
import { DocumentTemplateHeader } from './document-template-header'

export function DocumentBuilder({ templateId }: { templateId?: string | null }) {
  const { selectedElement, isDirty } = useBuilderStore()
  const canvasRef = useRef(null)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <DocumentTemplateHeader templateId={templateId} />

      {/* 3-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Esquerda - Componentes */}
        <ComponentsPanel className="w-[280px] border-r" />

        {/* Canvas Central - Editor */}
        <CanvasEditor 
          ref={canvasRef}
          className="flex-1 overflow-auto bg-muted/20"
        />

        {/* Sidebar Direita - Propriedades */}
        <PropertiesPanel 
          className="w-[300px] border-l overflow-auto"
          element={selectedElement}
        />
      </div>

      {/* Unsaved indicator */}
      {isDirty && (
        <div className="bg-yellow-100 text-yellow-800 px-4 py-2 text-sm">
          Mudanças não guardadas
        </div>
      )}
    </div>
  )
}
```

---

## 1️⃣ ComponentsPanel — Sidebar Esquerda

**Localização:** `components/document-builder/components-panel.tsx`

```typescript
import { useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ComponentItem } from './ui/component-item'
import { useTemplateVariables } from '@/hooks/use-template-variables'
import { BUILDER_COMPONENTS } from './constants'

export function ComponentsPanel({ className }: { className?: string }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    content: true,
    media: true,
    structure: true,
    variables: true,
  })
  const { data: variables, isLoading: isLoadingVars } = useTemplateVariables()

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <div className={cn('flex flex-col bg-background', className)}>
      {/* Search */}
      <div className="border-b p-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-auto space-y-2 p-2">
        
        {/* CONTEÚDO */}
        <Section
          title="CONTEÚDO"
          isOpen={expandedSections.content}
          onToggle={() => toggleSection('content')}
        >
          {BUILDER_COMPONENTS.content.map(comp => (
            <ComponentItem
              key={comp.id}
              component={comp}
              visible={!searchTerm || comp.name.toLowerCase().includes(searchTerm.toLowerCase())}
            />
          ))}
        </Section>

        {/* MEDIA */}
        <Section
          title="MEDIA"
          isOpen={expandedSections.media}
          onToggle={() => toggleSection('media')}
        >
          {BUILDER_COMPONENTS.media.map(comp => (
            <ComponentItem key={comp.id} component={comp} />
          ))}
        </Section>

        {/* ESTRUTURA */}
        <Section
          title="ESTRUTURA"
          isOpen={expandedSections.structure}
          onToggle={() => toggleSection('structure')}
        >
          {BUILDER_COMPONENTS.structure.map(comp => (
            <ComponentItem key={comp.id} component={comp} />
          ))}
        </Section>

        {/* VARIÁVEIS */}
        <Section
          title="VARIÁVEIS"
          isOpen={expandedSections.variables}
          onToggle={() => toggleSection('variables')}
        >
          {isLoadingVars ? (
            <div className="text-xs text-muted-foreground p-2">Carregando...</div>
          ) : (
            Object.entries(variables || {}).map(([category, vars]) => (
              <details key={category} className="outline-none group">
                <summary className="text-xs font-medium text-muted-foreground cursor-pointer p-2 hover:bg-accent rounded list-none">
                  <span className="inline-block transition group-open:rotate-180 mr-1">▶</span>
                  {category}
                </summary>
                <div className="space-y-1 ml-2">
                  {vars.map(v => (
                    <button
                      key={v.name}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('varialbesType', 'variable')
                        e.dataTransfer.setData('variableName', v.name)
                      }}
                      className="w-full text-left text-xs p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition"
                    >
                      <code className="text-xs font-mono">{v.name}</code>
                      <p className="text-[10px] text-muted-foreground/70">{v.label}</p>
                    </button>
                  ))}
                </div>
              </details>
            ))
          )}
        </Section>
      </div>
    </div>
  )
}

// Componente auxiliar: Section
function Section({ 
  title, 
  isOpen, 
  onToggle, 
  children 
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <details open={isOpen} className="outline-none">
      <summary
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        className="text-xs font-semibold select-none cursor-pointer p-2 hover:bg-accent rounded flex items-center text-muted-foreground hover:text-foreground"
      >
        <ChevronDown 
          className={cn(
            'h-3 w-3 mr-1.5 transition-transform',
            !isOpen && '-rotate-90'
          )} 
        />
        {title}
      </summary>
      <div className="space-y-1 mt-1">
        {children}
      </div>
    </details>
  )
}
```

### ComponentItem — Item Draggable

```typescript
// components/document-builder/ui/component-item.tsx
import { useDrag } from 'react-use-gesture'
import { cn } from '@/lib/utils'

export interface DraggableComponent {
  id: string
  name: string
  icon: React.ReactNode
  defaultProps?: Record<string, any>
  element: string // 'p', 'div', 'img', 'table', etc.
}

export function ComponentItem({ 
  component, 
  visible = true 
}: { 
  component: DraggableComponent
  visible?: boolean
}) {
  if (!visible) return null

  return (
    <button
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy'
        e.dataTransfer.setData('componentType', component.element)
        e.dataTransfer.setData('componentId', component.id)
      }}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs',
        'text-foreground/70 hover:text-foreground',
        'hover:bg-accent transition-colors',
        'cursor-grab active:cursor-grabbing'
      )}
    >
      <span className="text-sm">{component.icon}</span>
      <span>{component.name}</span>
    </button>
  )
}
```

### Constants — Componentes Disponíveis

```typescript
// components/document-builder/constants.ts
import { 
  Type, Heading1, Squircle, Paperclip, 
  Image2, Grid3x3, Minus, Square, FileText 
} from 'lucide-react'
import type { DraggableComponent } from './ui/component-item'

export const BUILDER_COMPONENTS = {
  content: [
    {
      id: 'text',
      name: 'Texto',
      icon: <Type className="h-4 w-4" />,
      element: 'p',
      defaultProps: { fontSize: 14, color: '#000' }
    },
    {
      id: 'heading',
      name: 'Título',
      icon: <Heading1 className="h-4 w-4" />,
      element: 'h1',
      defaultProps: { level: 1, fontSize: 32 }
    },
    {
      id: 'button',
      name: 'Botão',
      icon: <Squircle className="h-4 w-4" />,
      element: 'button',
      defaultProps: { text: 'Click aqui', bgColor: '#0066FF' }
    },
    {
      id: 'attachment',
      name: 'Anexo',
      icon: <Paperclip className="h-4 w-4" />,
      element: 'attachment'
    }
  ] as DraggableComponent[],
  
  media: [
    {
      id: 'image',
      name: 'Imagem',
      icon: <Image2 className="h-4 w-4" />,
      element: 'img',
      defaultProps: { src: '', alt: '', width: 300, height: 200 }
    }
  ] as DraggableComponent[],
  
  structure: [
    {
      id: 'container',
      name: 'Contêner',
      icon: <Square className="h-4 w-4" />,
      element: 'div',
      defaultProps: { display: 'flex', flexDirection: 'column', gap: 20 }
    },
    {
      id: 'grid',
      name: 'Grelha',
      icon: <Grid3x3 className="h-4 w-4" />,
      element: 'div',
      defaultProps: { display: 'grid', gridCols: 3, gap: 20 }
    },
    {
      id: 'divider',
      name: 'Divisor',
      icon: <Minus className="h-4 w-4" />,
      element: 'hr',
      defaultProps: { color: '#e5e7eb', margin: 20 }
    },
    {
      id: 'spacer',
      name: 'Espaçador',
      icon: <FileText className="h-4 w-4" />,
      element: 'div',
      defaultProps: { height: 40 }
    }
  ] as DraggableComponent[]
}
```

---

## 2️⃣ CanvasEditor — Canvas Central

**Localização:** `components/document-builder/canvas-editor.tsx`

```typescript
import { forwardRef } from 'react'
import { useBuilderStore } from './hooks/use-builder-state'
import { useCanvasSelection } from './hooks/use-canvas-selection'
import { useCanvasDragDrop } from './hooks/use-canvas-drag-drop'
import { BubbleMenuToolbar } from './ui/canvas-toolbar'
import { CanvasElementRenderer } from './ui/canvas-element-renderer'

export const CanvasEditor = forwardRef<any>(({ className }: { className?: string }, ref) => {
  const { content, selectedElementId, updateElement } = useBuilderStore()
  const { handleCanvasClick, handleElementClick } = useCanvasSelection()
  const { handleDragOver, handleDrop } = useCanvasDragDrop(ref)

  return (
    <div 
      ref={ref}
      className={cn('relative', className)}
      onClick={handleCanvasClick}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Canvas Background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" 
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width="40" height="40" xmlns="http://www.w3.org/2000/svg"%3E%3Crect width="40" height="40" fill="transparent"/%3E%3Cpath d="M0 0h40v40H0z" fill="none" stroke="%23ddd" stroke-width="0.5"/%3E%3C/svg%3E")'
        }}
      />

      {/* Canvas Content */}
      <div className="relative p-8 max-w-2xl mx-auto bg-white shadow-lg">
        {content ? (
          <CanvasElementRenderer 
            html={content}
            selectedId={selectedElementId}
            onElementClick={handleElementClick}
          />
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p>Arraste componentes da esquerda ou clique para editar</p>
          </div>
        )}
      </div>

      {/* Bubble Menu (flutuante) */}
      <BubbleMenuToolbar />

      {/* Drop guide */}
      <div className="absolute pointer-events-none" 
        id="drop-guide"
        className="hidden border-2 border-primary/50 border-dashed bg-primary/5"
      />
    </div>
  )
})

CanvasEditor.displayName = 'CanvasEditor'
```

---

## 3️⃣ PropertiesPanel — Sidebar Direita

**Localização:** `components/document-builder/properties-panel.tsx`

```typescript
import { useBuilderStore } from './hooks/use-builder-state'
import { ElementPropertiesForm } from './ui/element-properties-form'
import type { BuilderElement } from './types/element'

export function PropertiesPanel({ 
  className,
  element 
}: { 
  className?: string
  element?: BuilderElement | null
}) {
  return (
    <div className={cn('flex flex-col bg-background', className)}>
      {/* Header */}
      <div className="border-b p-3 sticky top-0">
        <h3 className="text-sm font-semibold">
          {element ? `Propriedades — ${element.type}` : 'Propriedades'}
        </h3>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        {element ? (
          <ElementPropertiesForm element={element} />
        ) : (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Seleccione um elemento para ver propriedades
          </div>
        )}
      </div>
    </div>
  )
}
```

### ElementPropertiesForm — Form Genérico

```typescript
// components/document-builder/ui/element-properties-form.tsx
import { useBuilderStore } from '../hooks/use-builder-state'
import { PropertyEditor } from './property-editor'
import { ELEMENT_PROPERTY_SCHEMA } from '../types/properties'
import type { BuilderElement } from '../types/element'

export function ElementPropertiesForm({ element }: { element: BuilderElement }) {
  const { updateElement } = useBuilderStore()
  const schema = ELEMENT_PROPERTY_SCHEMA[element.type] || []

  const handlePropertyChange = (prop: string, value: any) => {
    updateElement(element.id, { ...element.props, [prop]: value })
  }

  return (
    <div className="space-y-4 p-4">
      {schema.map(({ key, label, type, options, ...config }) => (
        <PropertyEditor
          key={key}
          label={label}
          type={type}
          value={element.props[key]}
          onChange={(value) => handlePropertyChange(key, value)}
          options={options}
          {...config}
        />
      ))}
    </div>
  )
}
```

### PropertyEditor — Editores Específicos

```typescript
// components/document-builder/ui/property-editor.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColorPicker } from './color-picker'
import { cn } from '@/lib/utils'

export interface PropertyEditorProps {
  label: string
  type: 'text' | 'number' | 'color' | 'select' | 'alignment' | 'direction' | 'boolean'
  value: any
  onChange: (value: any) => void
  options?: Array<{ label: string; value: any }>
  min?: number
  max?: number
  suffix?: string
}

export function PropertyEditor({ 
  label, 
  type, 
  value, 
  onChange, 
  options, 
  ...props 
}: PropertyEditorProps) {
  
  switch (type) {
    case 'text':
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{label}</Label>
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      )

    case 'number':
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{label}</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={value || 0}
              onChange={(e) => onChange(+e.target.value)}
              min={props.min}
              max={props.max}
              className="h-8 text-xs flex-1"
            />
            {props.suffix && <span className="text-xs text-muted-foreground">{props.suffix}</span>}
            <button className="px-1 py-1 hover:bg-accent rounded">−</button>
            <button className="px-1 py-1 hover:bg-accent rounded">+</button>
          </div>
        </div>
      )

    case 'color':
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{label}</Label>
          <ColorPicker value={value} onChange={onChange} />
        </div>
      )

    case 'select':
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{label}</Label>
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )

    case 'alignment':
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{label}</Label>
          <div className="flex gap-1">
            {[
              { icon: '◀', value: 'left' },
              { icon: '◊', value: 'center' },
              { icon: '▶', value: 'right' },
              { icon: '▬', value: 'justify' }
            ].map(btn => (
              <button
                key={btn.value}
                onClick={() => onChange(btn.value)}
                className={cn(
                  'flex-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                  value === btn.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
                )}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
      )

    case 'direction':
      return (
        <div className="space-y-2">
          <Label className="text-xs font-medium">{label}</Label>
          <div className="flex gap-1">
            {[
              { icon: '↓', value: 'column', label: 'Coluna' },
              { icon: '→', value: 'row', label: 'Linha' }
            ].map(btn => (
              <button
                key={btn.value}
                title={btn.label}
                onClick={() => onChange(btn.value)}
                className={cn(
                  'flex-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                  value === btn.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'
                )}
              >
                {btn.icon}
              </button>
            ))}
          </div>
        </div>
      )

    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded"
          />
          <Label className="text-xs font-medium cursor-pointer">{label}</Label>
        </div>
      )

    default:
      return null
  }
}
```

---

## 🪝 Hooks Personalizados

### useBuilderStore — State Management

```typescript
// components/document-builder/hooks/use-builder-state.ts
import { create } from 'zustand'
import type { BuilderElement } from '../types/element'

interface BuilderState {
  templateId: string | null
  content: string
  elements: BuilderElement[]
  selectedElementId: string | null
  isDirty: boolean
  history: { past: any[]; present: any; future: any[] }
  
  // Actions
  setContent: (html: string) => void
  updateElement: (id: string, props: Partial<BuilderElement>) => void
  selectElement: (id: string | null) => void
  addElement: (parent: string | null, element: BuilderElement) => void
  removeElement: (id: string) => void
  undo: () => void
  redo: () => void
  save: () => Promise<void>
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  templateId: null,
  content: '',
  elements: [],
  selectedElementId: null,
  isDirty: false,
  history: { past: [], present: {}, future: [] },

  setContent: (html: string) => set({ content: html, isDirty: true }),

  updateElement: (id: string, props: Partial<BuilderElement>) => {
    set(state => ({
      elements: state.elements.map(el => 
        el.id === id ? { ...el, ...props } : el
      ),
      isDirty: true
    }))
  },

  selectElement: (id: string | null) => set({ selectedElementId: id }),

  addElement: (parent: string | null, element: BuilderElement) =>
    set(state => ({
      elements: [...state.elements, { ...element, parentId: parent }],
      isDirty: true
    })),

  removeElement: (id: string) =>
    set(state => ({
      elements: state.elements.filter(el => el.id !== id),
      isDirty: true
    })),

  undo: () => { /* ... */ },
  redo: () => { /* ... */ },
  save: () => { /* ... */ }
}))
```

---

## 🎯 Types Centralizados

```typescript
// components/document-builder/types/element.ts
export interface BuilderElement {
  id: string
  type: string // 'p', 'h1', 'div', 'img', etc.
  content?: string
  props: Record<string, any>
  children?: BuilderElement[]
  parentId?: string | null
}

export interface BuilderElementProps {
  fontSize?: number
  color?: string
  fontFamily?: string
  fontWeight?: number
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  paddingTop?: number
  paddingBottom?: number
  paddingLeft?: number
  paddingRight?: number
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  [key: string]: any
}
```

---

## ✅ Checklist de Implementação

- [ ] Criar pasta `components/document-builder/`
- [ ] Implementar `DocumentBuilder` (raiz)
- [ ] Implementar `ComponentsPanel` (sidebar esquerda)
- [ ] Implementar `CanvasEditor` (canvas central)
- [ ] Implementar `PropertiesPanel` (sidebar direita)
- [ ] Criar hooks (useBuilderStore, useCanvasSelection, useCanvasDragDrop)
- [ ] Implementar drag-and-drop
- [ ] Implementar seleção de elementos
- [ ] Implementar property editors (text, color, select, etc.)
- [ ] Integrar com TipTap editor
- [ ] Adicionar undo/redo
- [ ] Adicionar auto-save
- [ ] Testar responsividade

---

**Próximo passo:** Implementar cada componente seguindo a ordem acima.
