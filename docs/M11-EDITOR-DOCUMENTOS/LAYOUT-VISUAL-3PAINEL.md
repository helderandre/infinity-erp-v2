# 🎨 Layout Visual — Estrutura 3-Painel (Builder Style)

**Especificação de Layout para o Editor de Documentos**  
**Inspirado em builders visuais modernos (Figma, Canva, EmailBuilder)**

---

## 📐 Arquitetura de Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    TOP BAR (Breadcrumb, Save)               │
├──────────┬─────────────────────────────┬──────────────────┤
│          │                             │                  │
│  SIDEBAR │         CANVAS/PREVIEW      │  PROPERTIES      │
│ ESQUERDA │      (Editor Principal)     │   SIDEBAR        │
│  (280px) │      (Flex: 1, centro)      │   DIREITA (300px)│
│          │                             │                  │
├──────────┼─────────────────────────────┼──────────────────┤
│ Texto    │  Olá {{proprietario_nome}} │ Direção: Coluna  │
│ Título   │  Bem-vindo!                 │ Alinhamento: ...│
│ Botão    │                             │ Gap: 20px       │
│ Imagem   │  [Clique para editar]      │ Padding: ...    │
│ Contêner │                             │ Margin: ...     │
│ Grelha   │                             │ Cor: ...        │
│ Divisor  │                             │ Largura Borda: ..
│ Espaçador│                             │                  │
│ Anexo    │                             │ Propriedades    │
│          │                             │ Avançadas ▼     │
└──────────┴─────────────────────────────┴──────────────────┘
```

---

## 📋 Componentes por Painel

### 1️⃣ SIDEBAR ESQUERDA — Paleta de Componentes

**Dimensões:** 280px (fixo), scrollável

**Estrutura:**

```
┌─ SIDEBAR ESQUERDA ───────────────┐
│  Pesquisar...                     │
├───────────────────────────────────┤
│ ▼ CONTEÚDO                        │
│   ├─ 📝 Texto                     │
│   ├─ H1 Título                    │
│   ├─ 🔘 Botão                     │
│   └─ 📎 Anexo                     │
├───────────────────────────────────┤
│ ▼ MEDIA                           │
│   ├─ 🖼️ Imagem                    │
│   └─ 🎬 Vídeo (futuro)            │
├───────────────────────────────────┤
│ ▼ ESTRUTURA                       │
│   ├─ 📦 Contêner                  │
│   ├─ 🔲 Grelha                    │
│   ├─ ━ Divisor                    │
│   └─ ▲ Espaçador                  │
├───────────────────────────────────┤
│ ▼ VARIÁVEIS                       │
│   ├─ Utilizador ▼                 │
│   │  • nome_utilizador            │
│   │  • email_utilizador           │
│   ├─ Cliente ▼                    │
│   │  • nome_cliente               │
│   │  • email_cliente              │
│   └─ Propriedade ▼               │
│      • ref_propriedade            │
│      • preco_propriedade          │
└───────────────────────────────────┘
```

**Componentes Draggable:**

| Ícone | Nome | Descrição | Props |
|-------|------|-----------|-------|
| 📝 | Texto | Parágrafo simples | fontSize, color, fontFamily |
| H1 | Título | Heading (H1-H6) | level, fontSize, weight |
| 🔘 | Botão | Button com CTA | text, url, bgColor, style |
| 📎 | Anexo | Link para arquivo | filename, url, icon |
| 🖼️ | Imagem | Image com crop/alt | src, alt, width, height |
| 📦 | Contêner | Div wrapper (layout) | bgColor, padding, margin, border |
| 🔲 | Grelha | Grid (2x2, 3x1, etc) | cols, gap, responsive |
| ━ | Divisor | Horizontal rule (HR) | color, thickness, margin |
| ▲ | Espaçador | Spacer (40px, 60px, etc) | height |

---

### 2️⃣ CANVAS CENTRAL — Editor Principal

**Dimensões:** Flex 1, scrollável verticalmente

**Características:**

```
┌─ CANVAS EDITOR ───────────────────────────┐
│  [Toolbar flutuante ao seleccionar]       │
│                                           │
│  ┌─ Email Template ─────────────────────┐ │
│  │ Olá {{proprietario_nome}} !         │ │  ← Conteúdo editável
│  │ Bem-vindo à Infinity Group          │ │
│  │                                      │ │
│  │ [Clique para editar texto]           │ │  ← Elementos editar inline
│  │                                      │ │
│  │ ┌─ Tabela 3x3 ──────────────────┐  │ │
│  │ │ Ref    │ Tipo  │ Preço        │  │ │
│  │ │─────────┼────────┼──────────────│  │ │
│  │ │ PROP-01 │ T1    │ €150.000    │  │ │
│  │ └────────────────────────────────┘  │ │
│  │                                      │ │
│  │ Atenciosamente,                      │ │
│  │ Equipa Infinity Group                │ │
│  └──────────────────────────────────────┘ │
│                                           │
│  [+ Adicionar elemento]                   │
└───────────────────────────────────────────┘
```

**Features:**

- ✅ **Selecção em tempo real** — clicar em elemento mostra props na direita
- ✅ **Inline editing** — clicar em texto permite editar directamente
- ✅ **Drag-to-reorder** — arrastar blocos para reordenar
- ✅ **Copy/Paste** — atalhos Ctrl+C/Ctrl+V
- ✅ **Bubble menu** — toolbar flutuante ao seleccionar
- ✅ **Variable highlighting** — {{var}} com background
- ✅ **Grid helper** — mostrar/esconder grid de guidelines

---

### 3️⃣ SIDEBAR DIREITA — Propriedades

**Dimensões:** 300px (fixo), scrollável

**Estrutura por Tipo de Elemento:**

#### Para Texto/Parágrafo:
```
┌─ PROPRIEDADES ─────────────────┐
│ 📝 Parágrafo                    │
├─────────────────────────────────┤
│ Tipografia                      │
│  Font: [Arial ▼]               │
│  Size: [14 ▼] px               │
│  Weight: [400 ▼]               │
│  Color: [#000000 ■]            │
│  Line Height: [1.5 ▼]          │
├─────────────────────────────────┤
│ Spacing                         │
│  Margin Top: [0] px [-] [+]    │
│  Margin Bottom: [20] px        │
│  Margin Left: [0] px           │
│  Margin Right: [0] px          │
├─────────────────────────────────┤
│ Alinhamento                     │
│  [◀] [◊] [▶] [▬]               │
│  (Left, Center, Right, Justify)│
├─────────────────────────────────┤
│ Avançado ▼                      │
│  • Opacity: [1.0]               │
│  • Text Shadow: ON/OFF          │
│  • Letter Spacing: [0]          │
└─────────────────────────────────┘
```

#### Para Contêner/Layout:
```
┌─ PROPRIEDADES ─────────────────┐
│ 📦 Contêner                     │
├─────────────────────────────────┤
│ Direção (Flex)                  │
│  [↓ Coluna] [→ Linha]           │
│  (Vertical, Horizontal)         │
├─────────────────────────────────┤
│ Alinhamento (Align)             │
│  Horizontal: [◀] [◊] [▶] [▬]   │
│  Vertical: [▲] [◊] [▼]          │
├─────────────────────────────────┤
│ Gap (Espaço entre items)        │
│  [20] px [-] [+]                │
├─────────────────────────────────┤
│ Padding (Espaço interno)        │
│  Top: [20] Right: [20]          │
│  Bottom: [20] Left: [20]        │
├─────────────────────────────────┤
│ Dimensões                       │
│  Width: [Auto ▼] / [100%]       │
│  Height: [Auto ▼]               │
├─────────────────────────────────┤
│ Cor & Borda                     │
│  Background: [#FFFFFF ■]        │
│  Border: [1px] [Solid] [#000]   │
│  Border Radius: [0] px          │
└─────────────────────────────────┘
```

#### Para Imagem:
```
┌─ PROPRIEDADES ─────────────────┐
│ 🖼️ Imagem                       │
├─────────────────────────────────┤
│ Fonte                           │
│  URL: [https://...] [↗]        │
│  Upload: [Choose File]          │
├─────────────────────────────────┤
│ Dimensões                       │
│  Width: [200] px                │
│  Height: [Auto ▼]               │
│  Aspect Ratio: [16:9 ▼]         │
├─────────────────────────────────┤
│ Apresentação                    │
│  Alt Text: [Descrição...]       │
│  Object Fit: [Cover ▼]          │
│  Border Radius: [0] px          │
├─────────────────────────────────┤
│ Spacing                         │
│  Margin: [0] px                 │
└─────────────────────────────────┘
```

---

## 🔄 Fluxo de Interação

### 1. Usuário abre template para editar

```
1. Click em template na listagem
   ↓
2. Carrega página /templates-documentos/[id]
   ↓
3. DocumentTemplateEditor renderiza 3 painéis
   ↓
4. Canvas mostra HTML do template
   ↓
5. Sidebar esquerda populated com componentes
   ↓
6. Sidebar direita vazia (aguardando seleção)
```

### 2. Usuário clica em elemento no canvas

```
1. Click em <p> no canvas
   ↓
2. Elemento recebe border/highlight
   ↓
3. Sidebar direita mostra propriedades do <p>
   ↓
4. Bubble menu aparece (bold, italic, color, etc.)
   ↓
5. Usuário edita propriedade (ex: fontSize)
   ↓
6. Canvas atualiza em tempo real (preview)
   ↓
7. Conteúdo marked as unsaved
```

### 3. Usuário arrasta componente para canvas

```
1. Arrasta "Tabela" da sidebar esquerda
   ↓
2. Cursor muda para "drop-here"
   ↓
3. Solta no canvas
   ↓
4. Nova tabela 3x3 inserida no cursor position
   ↓
5. Tabela automaticamente selecionada
   ↓
6. Sidebar direita mostra props da tabela
   ↓
7. Usuário pode editar linhas, colunas, etc.
```

---

## 🎯 Componente React — Estrutura

```typescript
export function DocumentTemplateBuilder() {
  return (
    <div className="flex h-screen flex-col bg-background">
      {/* TOP BAR */}
      <DocumentTemplateHeader />
      
      {/* 3-PAINEL LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR ESQUERDA */}
        <ComponentsPanel className="w-[280px] border-r">
          <SearchInput />
          <ComponentsTree />
          <VariablesPanel />
        </ComponentsPanel>

        {/* CANVAS CENTRAL */}
        <div className="flex-1 overflow-auto bg-muted/20">
          <CanvasEditor ref={editorRef} />
          <BubbleMenuToolbar />
          <ContextMenu />
        </div>

        {/* SIDEBAR DIREITA */}
        <PropertiesPanel className="w-[300px] border-l overflow-auto">
          {selectedElement ? (
            <ElementProperties element={selectedElement} />
          ) : (
            <EmptyPropertiesState />
          )}
        </PropertiesPanel>
      </div>
    </div>
  )
}
```

---

## 🎨 CSS Classes (Tailwind)

```css
/* Sidebar Esquerda */
.components-sidebar {
  @apply w-[280px] border-r bg-background flex flex-col;
}

/* Canvas Central */
.canvas-editor {
  @apply flex-1 overflow-auto bg-muted/20 p-8;
}

.canvas-element {
  @apply relative transition-all;
  
  &:hover {
    @apply ring-2 ring-primary/50;
  }
  
  &.selected {
    @apply ring-2 ring-primary bg-primary/5;
  }
}

/* Sidebar Direita */
.properties-sidebar {
  @apply w-[300px] border-l bg-background flex flex-col overflow-auto;
}

.property-section {
  @apply border-b p-4 space-y-3;
  
  & > h3 {
    @apply text-sm font-semibold text-foreground/80;
  }
}

/* Componentes Draggable */
.draggable-component {
  @apply cursor-grab active:cursor-grabbing p-2 rounded hover:bg-accent;
}

.drag-over {
  @apply ring-2 ring-primary ring-dashed;
}
```

---

## 🔧 Implementação por Fases

### FASE 1 — Estrutura Base (Semana 1)
- [x] Layout 3-painel com resizable dividers
- [x] ComponentsPanel com search e categorias
- [x] CanvasEditor com TipTap
- [x] PropertiesPanel com forms

### FASE 2 — Seleção & Interação (Semana 2)
- [ ] Click para seleccionar elemento
- [ ] Highlight visual (border + background)
- [ ] Bubble menu contextual
- [ ] Properties atualizar em tempo real

### FASE 3 — Drag & Drop (Semana 3)
- [ ] Drag componentes da sidebar esquerda
- [ ] Drop no canvas para inserir
- [ ] Drag-to-reorder elementos no canvas
- [ ] Preview de drop position

### FASE 4 — Variáveis (Semana 4)
- [ ] Sidebar esquerda com categorias de variáveis
- [ ] Click para inserir {{variable}}
- [ ] Highlight visual de variáveis
- [ ] Preview de valores de exemplo

### FASE 5 — Arquivo & Atalhos (Semana 5)
- [ ] Ctrl+S para guardar
- [ ] Ctrl+Z/Y para undo/redo
- [ ] Ctrl+C/V para copy/paste
- [ ] Delete para eliminar elemento

---

## 📐 Dimensões & Breakpoints

| Dispositivo | Sidebar Esq | Canvas | Sidebar Dir | Total |
|-------------|-------------|--------|-------------|-------|
| Desktop (1920px) | 280px | 1340px | 300px | 1920px |
| Laptop (1600px) | 280px | 1020px | 300px | 1600px |
| Tablet (1024px) | 200px (collapsed?) | 624px | 200px | 1024px |

**Mobile:** Layout adaptável (full-width canvas, tabs para sidebars)

---

## 🎯 Exemplos de Operações

### Editar Texto
```
1. Click em parágrafo no canvas
2. Sidebar direita mostra: Font, Size, Color, Weight, Alignment
3. Usuário clica no color picker
4. Selecciona cor azul
5. Parágrafo no canvas muda para azul instantly
6. TipTap command: editor.chain().setColor('#0000FF').run()
7. Save pending indicator mostra
```

### Adicionar Tabela
```
1. Drag "Tabela" da sidebar esquerda
2. Solta no canvas
3. Diálogo: "Rows: 3, Cols: 3?"
4. Click OK
5. Tabela 3x3 inserida
6. Tabela selecionada
7. Sidebar direita mostra: Merge Cell, Add Row/Col, Border Color, etc.
```

### Inserir Variável
```
1. Click em "Variáveis" na sidebar esquerda
2. Clica em "Cliente" category
3. Clica em "nome_cliente"
4. {{nome_cliente}} inserido no cursor position
5. Elemento com background amarelo como indicator
```

---

## 🔐 Estado Persistente

```typescript
// Store del editor state
{
  templateId: 'uuid',
  content: '<html>...</html>',
  selectedElementId: 'elem-123',
  selectedElementProps: { fontSize: 16, color: '#000' },
  isDirty: true,
  autoSaveTimer: null,
  history: {
    past: [{ content: '...' }, ...],
    present: { content: '...' },
    future: [],
  }
}
```

---

## 📱 Responsive Design

### Desktop (1920+)
- Todos 3 painéis visíveis
- Sidebars fixas, canvas scrollável

### Laptop (1024-1919)
- Todos 3 painéis visíveis com menor width
- Sidebars podem colapsar

### Tablet (768-1023)
- Sidebar esquerda colapsável (hamburger)
- Canvas em full width
- Sidebar direita em modal/drawer

### Mobile (<768)
- Apenas canvas visível
- Botão "+" para adicionar componentes (floating action)
- Props editor em modal bottom sheet

---

## 🎨 Color Scheme

| Elemento | Cor |
|----------|-----|
| Background | var(--background) |
| Sidebar | var(--muted) opacity-20 |
| Canvas | var(--muted) opacity-20 |
| Selected | primary ring |
| Hover | accent background |
| Properties Label | foreground opacity-80 |

---

**Fim da Especificação de Layout**

Próximo passo: Implementar componentes React para este layout.
