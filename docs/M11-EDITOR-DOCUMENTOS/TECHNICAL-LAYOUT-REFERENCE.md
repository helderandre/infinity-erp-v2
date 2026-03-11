# 🔧 Referência Técnica - Layout do Template Editor

**Última actualização:** 2026-02-24  
**Versão do Next.js:** 16+  
**Framework CSS:** Tailwind CSS v4

---

## 📐 Estrutura Geral do Editor

```
DocumentTemplateEditor
├── Header Section (bg-card, border-b)
│   ├── Top Navigation (back button, title)
│   └── Metadata Section
│       ├── Nome do template (Input)
│       ├── Tipo de documento (Select)
│       ├── Descrição (Textarea)
│       └── Timbrado (Upload)
│
├── Main Content Area (flex-1, overflow-hidden)
│   ├── DocumentEditor (flex-1)
│   │   └── TipTap Editor Canvas
│   │
│   └── DocumentVariablesSidebar (w-80 shrink-0)
│       ├── Header (search + title)
│       └── ScrollArea
│           └── Variables List (grouped by category)
│
└── Hidden File Inputs
    ├── Image upload
    ├── DOCX import
    └── Letterhead upload
```

---

## 🎯 Componentes Principais

### 1. **DocumentTemplateEditor**
**Ficheiro:** `components/documents/document-template-editor.tsx`

**Props:**
```typescript
interface DocumentTemplateEditorProps {
  templateId: string | null
  initialTemplate?: DocumentTemplatePayload | null
}
```

**State Management:**
```typescript
// Template data
const [name, setName] = useState()
const [description, setDescription] = useState()
const [docTypeId, setDocTypeId] = useState()
const [letterheadUrl, setLetterheadUrl] = useState()
const [letterheadFileName, setLetterheadFileName] = useState()
const [letterheadFileType, setLetterheadFileType] = useState()

// UI state
const [isSaving, setIsSaving] = useState(false)
const [isImporting, setIsImporting] = useState(false)
const [isLoadingTypes, setIsLoadingTypes] = useState(true)

// Variables & content
const [variablesInDoc, setVariablesInDoc] = useState()
const [variables, setVariables] = useState()

// Refs
const editorRef = useRef()
const imageInputRef = useRef()
const docxInputRef = useRef()
const letterheadInputRef = useRef()
```

**Layout Sections:**

#### Header (Lines 229-236)
```tsx
<div className="flex flex-col gap-4 border-b border-border bg-card px-6 py-4">
  {/* Back button + title */}
  {/* Import DOCX + Save buttons */}
</div>
```

**Spacing:** `px-6 py-4`, `gap-4` entre elementos

#### Metadata Section (Lines 238-285)
```tsx
<div className="grid gap-4 md:grid-cols-[2fr_1fr]">
  {/* Nome (2/3 width on md+) */}
  {/* Tipo de Documento (1/3 width on md+) */}
</div>
{/* Descrição (full width) */}
{/* Timbrado (full width) */}
```

**Responsive:** 
- Mobile: `grid-cols-1` (stacked)
- Tablet+: `md:grid-cols-[2fr_1fr]` (2 columns)

#### Main Content (Lines 287-298)
```tsx
<div className="flex flex-1 overflow-hidden">
  <div className="flex-1 overflow-hidden">
    <DocumentEditor {...props} />
  </div>
  <DocumentVariablesSidebar
    className="w-80 shrink-0"
    {...props}
  />
</div>
```

**Layout:**
- `flex` container with `flex-1` (take full height)
- `overflow-hidden` (prevent scroll on main container)
- Editor gets `flex-1` (dynamic width)
- Sidebar fixed at `w-80` with `shrink-0`

---

### 2. **DocumentVariablesSidebar**
**Ficheiro:** `components/document-editor/document-variables-sidebar.tsx`

**Props:**
```typescript
interface DocumentVariablesSidebarProps {
  variablesInDoc: ParsedVariable[]
  allVariables: TemplateVariable[]
  onVariableClick?: (key: string) => void
  className?: string
}
```

**Layout Structure:**

#### Container (Line 56)
```tsx
<div className={cn('flex flex-col border-l border-border bg-card overflow-hidden', className)}>
```

- `flex flex-col` - vertical stack
- `border-l` - left border separator
- `bg-card` - matches theme
- `overflow-hidden` - clip overflow

#### Header (Lines 57-67)
```tsx
<div className="border-b border-border px-4 py-4 space-y-3">
  <div>
    <h3 className="text-sm font-semibold">Variáveis do template</h3>
    <p className="text-xs text-muted-foreground">Clique para inserir</p>
  </div>
  <div className="relative">
    {/* Search input */}
  </div>
</div>
```

**Spacing:**
- `px-4 py-4` - 16px padding
- `space-y-3` - 12px gap between groups
- Grouped structure with semantic `<div>`

#### ScrollArea (Lines 69+)
```tsx
<ScrollArea className="flex-1">
  <div className="p-4 pb-6 space-y-5">
    {/* Categories with variables */}
  </div>
</ScrollArea>
```

**Spacing:**
- `p-4` - 16px padding on all sides
- `pb-6` - 24px bottom padding (confortable scroll)
- `space-y-5` - 20px gap between categories

#### Category Group (Lines 85+)
```tsx
<div key={category}>
  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
    {category}
  </div>
  <div className="space-y-2">
    {/* Variable buttons */}
  </div>
</div>
```

**Spacing:**
- `mb-2` - 8px after category label
- `space-y-2` - 8px between variable items

#### Variable Item (Lines 98-110)
```tsx
<button
  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
>
  {/* Icon + text + count badge */}
</button>
```

**Spacing:**
- `px-3` - 12px horizontal padding
- `py-2` - 8px vertical padding
- `gap-2` - 8px between elements

**States:**
- `hover:bg-accent` - background on hover
- `transition-colors` - smooth color change

---

## 🎨 Tailwind Spacing Reference

| Class | Value | Used For |
|-------|-------|----------|
| `p-4` | 1rem (16px) | Standard padding |
| `pb-6` | 1.5rem (24px) | Bottom padding for scroll |
| `px-4` | 1rem (16px) | Horizontal padding |
| `py-4` | 1rem (16px) | Vertical padding |
| `px-3` | 0.75rem (12px) | Button horizontal |
| `py-2` | 0.5rem (8px) | Button vertical |
| `gap-2` | 0.5rem (8px) | Element spacing |
| `gap-4` | 1rem (16px) | Section spacing |
| `space-y-2` | 0.5rem (8px) | Vertical group spacing |
| `space-y-3` | 0.75rem (12px) | Larger group spacing |
| `space-y-5` | 1.25rem (20px) | Major section spacing |

---

## 📱 Responsive Breakpoints

**Current Layout:**
- **Mobile:** Full-width (no changes needed yet)
- **Tablet (768px+):** Metadata grid becomes 2 columns
- **Desktop (1024px+):** Optimal for 3-panel layout

**Future Improvements:**
- Hide sidebar on mobile (collapsible drawer)
- Stack editor/sidebar vertically on tablet
- Optimize for small screens

---

## 🔄 Data Flow

### Save Operation
```
User clicks "Guardar"
    ↓
setIsSaving(true)
    ↓
PUT /api/libraries/docs/{templateId}
    {
      name,
      description,
      content_html,
      doc_type_id,
      letterhead_url
    }
    ↓
toast.success() or toast.error()
    ↓
setIsSaving(false)
```

### Variable Insertion
```
User clicks variable in sidebar
    ↓
onVariableClick(key)
    ↓
editorRef.current?.insertVariable(key, isSystem)
    ↓
DocumentEditor updates content
    ↓
onVariablesChange() callback updates variablesInDoc
```

---

## 🎯 CSS Architecture

### Design Tokens Used
```css
/* Colors */
--background: card color (bg-card)
--border: separator color (border-border)
--foreground: text color
--muted-foreground: text-muted-foreground

/* Typography */
text-sm (14px) - labels, body
text-xs (12px) - secondary text
text-[10px] - category labels

/* Spacing Scale */
0.5rem (8px)   - space-y-2, py-2, px-3
0.75rem (12px) - space-y-3
1rem (16px)    - p-4, gap-4
1.25rem (20px) - space-y-5
1.5rem (24px)  - pb-6
```

### Utility Classes
- `flex-1` - grows to fill available space
- `shrink-0` - prevents shrinking
- `overflow-hidden` - clips overflow
- `hover:bg-accent` - hover state
- `transition-colors` - smooth transitions
- `truncate` - text overflow handling

---

## 🔧 Modification Guide

### To Change Padding in ScrollArea
```tsx
// Current: p-4 pb-6 space-y-5
// Option 1: Less padding
<div className="p-3 pb-4 space-y-4">

// Option 2: More padding  
<div className="p-5 pb-8 space-y-6">
```

### To Change Variable Item Height
```tsx
// Current: px-3 py-2
// Less compact:
className="px-4 py-2.5"

// More compact:
className="px-2 py-1"
```

### To Change Sidebar Width
```tsx
// Current: w-80 shrink-0
// Wider sidebar:
className="w-96 shrink-0"  // 384px

// Narrower sidebar:
className="w-72 shrink-0"  // 288px
```

### To Add Mobile Responsiveness
```tsx
// Stack header items on mobile
<div className="grid gap-4 md:grid-cols-[2fr_1fr]">

// Hide sidebar on mobile
<div className="hidden md:block w-80 shrink-0">
```

---

## 📋 Debugging Tips

### Layout Not Centering?
- Check parent `overflow-hidden`
- Verify `flex-1` on resizable items
- Ensure `shrink-0` on fixed-width items

### Sidebar Text Cut Off?
- Check `pb-6` at ScrollArea bottom
- Ensure `overflow-hidden` on main container
- Verify ScrollArea `flex-1` height

### Spacing Looks Wrong?
- Use browser DevTools to inspect `gap-*`, `space-y-*`, `p-*` classes
- Check if computed spacing matches Tailwind value
- Verify Tailwind v4 config is correct

### Performance Issues?
- Verify no `overflow-auto` on scrollable items (use ScrollArea component)
- Check for unnecessary re-renders in variable list
- Profile with React DevTools

---

## 🚀 Future Enhancement Ideas

1. **Drag-and-drop variables** → requires DND kit
2. **Collapsible categories** → add toggle state to categories
3. **Favorites sidebar** → separate section for pinned variables
4. **Mobile drawer** → hide sidebar behind hamburger menu
5. **Keyboard shortcuts** → Cmd/Ctrl+Click inserts variable
6. **Settings panel** → right-click context menu

---

## 📞 Contact & Support

For questions about this layout system:
- Check `CLAUDE.md` for overall architecture
- See `EDITOR-DOCUMENTOS-GUIDE.md` for usage guide
- Review `FIXEDLAYOUT-VISUAL-RESUMO.md` for visual changes

