# Fixes - Layout e Spacing do Sidebar de Variáveis

**Data:** 2026-02-24  
**Versão:** v1.0  
**Componentes afectados:** `DocumentVariablesSidebar`

---

## 📋 Resumo das Mudanças

Corrigidos problemas de **spacing insuficiente** no painel de variáveis do editor de documentos. O sidebar agora tem:

1. ✅ Padding interno adequado (aumentado de `p-3` para `p-4`)
2. ✅ Espaçamento vertical entre categorias melhorado (aumentado de `space-y-4` para `space-y-5`)
3. ✅ Padding bottom adicional para não cortar variáveis no final (`pb-6`)
4. ✅ Spacing expandido nos items de variável (`py-2` em vez de `py-1.5`)
5. ✅ Header com melhor estruturação visual

---

## 🔧 Mudanças Técnicas

### Ficheiro: `components/document-editor/document-variables-sidebar.tsx`

#### Mudança 1: ScrollArea Padding
**Antes:**
```tsx
<ScrollArea className="flex-1">
  <div className="p-3 space-y-4">
```

**Depois:**
```tsx
<ScrollArea className="flex-1">
  <div className="p-4 pb-6 space-y-5">
```

**Porquê:**
- `p-4` = 1rem (16px) - padding padrão do design system
- `pb-6` = extra bottom padding para scroll confortável
- `space-y-5` = melhor separação entre categorias

#### Mudança 2: Categorias - Espaçamento
**Antes:**
```tsx
<div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
  {category}
</div>
<div className="space-y-1">
```

**Depois:**
```tsx
<div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
  {category}
</div>
<div className="space-y-2">
```

**Porquê:**
- `mb-2` = melhor breathing room entre label e items
- `space-y-2` = melhor separação entre items

#### Mudança 3: Buttons de Variável
**Antes:**
```tsx
className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left hover:bg-accent transition-colors"
```

**Depois:**
```tsx
className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
```

**Porquê:**
- `px-3` = 0.75rem (12px) - melhor horizontal space
- `py-2` = 0.5rem (8px) - melhor hit target e legibilidade

#### Mudança 4: Header Structure
**Antes:**
```tsx
<div className="border-b border-border px-4 py-3">
  <h3 className="text-sm font-semibold">Variáveis do template</h3>
  <p className="text-xs text-muted-foreground">Clique para inserir</p>
  <div className="relative mt-3">
    ...search input
  </div>
</div>
```

**Depois:**
```tsx
<div className="border-b border-border px-4 py-4 space-y-3 overflow-hidden">
  <div>
    <h3 className="text-sm font-semibold">Variáveis do template</h3>
    <p className="text-xs text-muted-foreground">Clique para inserir</p>
  </div>
  <div className="relative">
    ...search input
  </div>
</div>
```

**Porquê:**
- Agrupamento semântico com `<div>` wrapper
- `py-4` = padding vertical uniforme
- `space-y-3` = espaçamento automático entre children
- `overflow-hidden` = evitar scroll no header

---

## 📐 Especificação Visual

### Antes vs Depois

```
ANTES: Padding Insuficiente
┌─────────────────┐
│ Variáveis...    │ px-4, py-3
│ Clique...       │ 
│ [Search]        │ mt-3 = espaço dispar
├─────────────────┤
│ p-3 (12px)      │ ← pouco espaço
│ Categoria 1     │ mb-1 (4px)
│ • var1          │ py-1.5, gap-2
│ • var2          │ space-y-1 (4px)
│ Categoria 2     │ mb-1 (4px)
│ • var3          │ py-1.5
│ • var4          │
└─────────────────┘

DEPOIS: Padding Adequado
┌──────────────────┐
│ Variáveis...     │ px-4, py-4
│ Clique...        │ space-y-3
│ [Search]         │ ← espaço uniforme
├──────────────────┤
│ p-4 pb-6 (16px)  │ ← apropriado
│ Categoria 1      │ mb-2 (8px)
│ • var1           │ py-2, gap-2
│ • var2           │ space-y-2 (8px)
│ Categoria 2      │ mb-2 (8px)
│ • var3           │ py-2
│ • var4           │
│ [extra pb-6]     │ ← confortável
└──────────────────┘
```

---

## 🎯 Impacto visual

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Padding interno | 12px (p-3) | 16px (p-4) |
| Padding bottom | 0 | 24px (pb-6) |
| Separação categorias | 16px (space-y-4, mb-1) | 20px (space-y-5, mb-2) |
| Altura item | ~24px (py-1.5) | ~28px (py-2) |
| Hover area | Pequena | Confortável |

---

## ✅ Checklist de QA

- [x] Layout visualmente alinhado
- [x] Responsive em desktop (1024px+)
- [x] Responsive em tablet (768px)
- [x] Sem cut-off de texto
- [x] Scroll funciona bem
- [x] Hover states claros
- [x] Categorias bem separadas
- [x] Search input bem posicionado
- [x] Sem scrollbars desnecessários
- [x] Aceita muitas variáveis sem overflow

---

## 🚀 Como testar

1. Abrir página de edição de template: `/dashboard/templates-documentos/[id]`
2. Expandir o sidebar de variáveis
3. Verificar spacing em relação ao main editor
4. Rolar o sidebar para verificar padding bottom
5. Passar hover sobre variáveis para ver hit target
6. Testar em mobile (sidebar pode colapsável em futuro)

---

## 📝 Notas de Implementação

- Todas as mudanças usam **classes Tailwind v4** existentes
- Mantém consistência com design system da app
- Compatível com responsive design
- Usa `overflow-hidden` no header para evitar issues
- Adiciona `space-y-3` para espaçamento automático

---

## 🔗 Ficheiros Afectados

- `components/document-editor/document-variables-sidebar.tsx`

---

## 🎨 Próximas Melhorias (Future)

- [ ] Animação de collapse/expand no mobile
- [ ] Drag-and-drop de variáveis
- [ ] Categorias colapsáveis
- [ ] Favorites/pinned variables
- [ ] Keyboard navigation (arrow keys)
