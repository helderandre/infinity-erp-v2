# Spec — Componente EmailPortalLinks (Email Builder)

## Resumo

Novo componente Craft.js para o Email Builder: repetidor de cards com links de portais imobiliários. Cada card mostra o nome do portal, ícone com cor, e ao clicar leva ao URL do anúncio.

---

## Ficheiros a Criar

### 1. `components/email-editor/user/email-portal-links.tsx`

Criar componente Craft.js completo com 3 partes: interface, componente de renderização, settings panel.

**Imports:**
```tsx
'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput, RadiusInput } from '@/components/email-editor/settings'
import { PROPERTY_PORTALS, type PropertyPortalKey } from '@/lib/constants'
import { Plus, Trash2, ArrowDown, ArrowRight } from 'lucide-react'
```

**Interface PortalItem:**
```tsx
interface PortalItem {
  portal: string   // chave do portal ou 'custom'
  name: string     // nome a exibir
  url: string      // URL do anúncio
}
```

**Interface EmailPortalLinksProps:**
```tsx
interface EmailPortalLinksProps {
  portals?: PortalItem[]
  title?: string
  showTitle?: boolean
  layout?: 'vertical' | 'horizontal'
  gap?: number
  borderRadius?: string
  cardBackground?: string
  boxShadow?: string
}
```

**Componente EmailPortalLinks:**
- Usar `useNode()` com `connect(drag(ref))` — padrão igual a [email-button.tsx:52-54](components/email-editor/user/email-button.tsx#L52-L54)
- Se `portals.length === 0`: mostrar placeholder dashed border com texto "Nenhum portal configurado. Abra as propriedades para adicionar."
- Se tem portais: mapear sobre `portals[]` renderizando cards com:
  - Ícone do portal (emoji de `PROPERTY_PORTALS[portal.portal]`) dentro de div com `backgroundColor: ${color}15`
  - Nome do portal (font-weight 600, 14px)
  - Subtexto "Ver anúncio →" (12px, #6b7280)
- Layout vertical: `display: block`, cards com `marginBottom: gap`
- Layout horizontal: `display: flex`, `flexWrap: wrap`, `gap`
- Código de renderização visual conforme PRD secção 9 (linhas 374-455)

**Settings Panel (EmailPortalLinksSettings):**
- Usar `useNode((node) => ({ props: node.data.props as EmailPortalLinksProps }))` — padrão de [email-button.tsx:87-92](components/email-editor/user/email-button.tsx#L87-L92)
- **Secção CRUD de portais:**
  - Para cada portal no array: card com Select (portal), Input (URL), botão Trash2 para remover
  - Select pre-preenche `name` ao mudar (via `PROPERTY_PORTALS[key].name`)
  - Botão "+ Adicionar Portal" no fim
  - Usar `setProp` com mutações directas (Immer) — padrão do PRD secção 4
- **Secção Estilo:**
  - Input para título (string)
  - Switch para mostrar título (boolean)
  - ToggleGroup para layout (vertical/horizontal) com ícones ArrowDown/ArrowRight
  - UnitInput para gap (px)
  - RadiusInput para borderRadius
  - ColorPickerField para cardBackground
  - Select para boxShadow — usar SHADOW_PRESETS (mesmo array de [email-button.tsx:18-24](components/email-editor/user/email-button.tsx#L18-L24))

**Craft.js metadata:**
```tsx
EmailPortalLinks.craft = {
  displayName: 'Links de Portais',
  props: {
    portals: [],
    title: 'Anúncios nos Portais',
    showTitle: true,
    layout: 'vertical',
    gap: 12,
    borderRadius: '8px',
    cardBackground: '#f9fafb',
    boxShadow: 'none',
  } as EmailPortalLinksProps,
  related: {
    settings: EmailPortalLinksSettings,
  },
}
```

---

## Ficheiros a Modificar

### 2. `lib/constants.ts`

**O quê:** Adicionar constante `PROPERTY_PORTALS` e type `PropertyPortalKey`.

**Onde:** Depois de `LEAD_SOURCES` (após linha 370), antes de `LEAD_TYPES` (linha 372).

**Código a inserir:**
```tsx
// Portais imobiliários — metadata para Email Builder
export const PROPERTY_PORTALS = {
  idealista: {
    name: 'Idealista',
    color: '#1DBF73',
    icon: '🏠',
  },
  imovirtual: {
    name: 'Imovirtual',
    color: '#FF6600',
    icon: '🏡',
  },
  casa_sapo: {
    name: 'Casa Sapo',
    color: '#0066CC',
    icon: '🏘️',
  },
  supercasa: {
    name: 'SuperCasa',
    color: '#E31E24',
    icon: '🏢',
  },
  custom: {
    name: 'Personalizado',
    color: '#6B7280',
    icon: '🔗',
  },
} as const

export type PropertyPortalKey = keyof typeof PROPERTY_PORTALS
```

---

### 3. `components/email-editor/email-editor.tsx`

**O quê:** Registar `EmailPortalLinks` no resolver.

**Passo 1 — Adicionar import** (após linha 18, junto dos outros imports de user components):
```tsx
import { EmailPortalLinks } from './user/email-portal-links'
```

**Passo 2 — Adicionar ao resolver** (linha 38, antes do fecho `}`):
```tsx
  EmailGrid,
  EmailPortalLinks,  // ← adicionar
}
```

---

### 4. `components/email-editor/email-toolbox.tsx`

**O quê:** Adicionar item na toolbox para arrastar o componente para o canvas.

**Passo 1 — Adicionar import** (após linha 28):
```tsx
import { EmailPortalLinks } from './user/email-portal-links'
```

**Passo 2 — Adicionar ícone** ao import de lucide-react (linha 5-17), adicionar `ExternalLink`:
```tsx
import {
  // ... existentes
  ExternalLink,
} from 'lucide-react'
```

**Passo 3 — Adicionar item** na categoria 'Conteúdo' (após linha 48, depois de Anexo):
```tsx
{ label: 'Links Portais', icon: ExternalLink, element: <EmailPortalLinks /> },
```

---

### 5. `lib/email-renderer.ts`

**O quê:** Adicionar função `renderPortalLinks()` e case no switch de `renderNode()`.

**Passo 1 — Adicionar constante PROPERTY_PORTALS** no topo do ficheiro (após linha 10). Como o renderer não tem imports (é self-contained), copiar a constante inline:
```tsx
const PROPERTY_PORTALS: Record<string, { name: string; color: string; icon: string }> = {
  idealista: { name: 'Idealista', color: '#1DBF73', icon: '🏠' },
  imovirtual: { name: 'Imovirtual', color: '#FF6600', icon: '🏡' },
  casa_sapo: { name: 'Casa Sapo', color: '#0066CC', icon: '🏘️' },
  supercasa: { name: 'SuperCasa', color: '#E31E24', icon: '🏢' },
  custom: { name: 'Personalizado', color: '#6B7280', icon: '🔗' },
}
```

**Passo 2 — Adicionar função `renderPortalLinks()`** antes de `stripVariableSpans()` (antes da linha 543):
```tsx
function renderPortalLinks(props: Record<string, unknown>): string {
  const portals = (props.portals as Array<{ portal: string; name: string; url: string }>) || []
  const title = (props.title as string) || 'Anúncios nos Portais'
  const showTitle = (props.showTitle as boolean) ?? true
  const gap = (props.gap as number) ?? 12
  const borderRadius = (props.borderRadius as string) || '8px'
  const cardBackground = (props.cardBackground as string) || '#f9fafb'
  const boxShadow = (props.boxShadow as string) || 'none'

  if (portals.length === 0) return ''

  let html = ''

  if (showTitle) {
    html += `<p style="font-weight: 600; font-size: 16px; margin: 0 0 12px 0; font-family: Arial, sans-serif;">${title}</p>`
  }

  const cards = portals.map((portal) => {
    const meta = PROPERTY_PORTALS[portal.portal]
    const color = meta?.color || '#6B7280'
    const icon = meta?.icon || '🔗'

    const cardStyle = [
      `border: 1px solid #e5e7eb`,
      `border-radius: ${borderRadius}`,
      `background-color: ${cardBackground}`,
      boxShadow !== 'none' ? `box-shadow: ${boxShadow}` : '',
    ].filter(Boolean).join('; ')

    return (
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${cardStyle}">` +
      `<tbody><tr>` +
      `<td style="padding: 12px 16px;">` +
      `<a href="${portal.url || '#'}" target="_blank" style="text-decoration: none; color: inherit;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
      `<tbody><tr>` +
      `<td style="width: 36px; vertical-align: middle;">` +
      `<div style="width: 36px; height: 36px; border-radius: 6px; background-color: ${color}15; text-align: center; line-height: 36px; font-size: 18px;">${icon}</div>` +
      `</td>` +
      `<td style="vertical-align: middle; padding-left: 12px;">` +
      `<div style="font-weight: 600; font-size: 14px; font-family: Arial, sans-serif;">${portal.name || 'Portal'}</div>` +
      `<div style="font-size: 12px; color: #6b7280; font-family: Arial, sans-serif;">Ver anúncio &rarr;</div>` +
      `</td>` +
      `</tr></tbody></table>` +
      `</a>` +
      `</td>` +
      `</tr></tbody></table>`
    )
  })

  html += cards.join(
    `<div style="height: ${gap}px; font-size: 0; line-height: 0;">&nbsp;</div>`
  )

  return html
}
```

**Passo 3 — Adicionar case no switch** (linha 597, dentro do `default` switch, antes do `default: return allChildren`):
```tsx
        case 'EmailAttachment':
          return renderAttachment(props, variables)
        case 'EmailPortalLinks':        // ← adicionar
          return renderPortalLinks(props) // ← adicionar
        default:
          return allChildren
```

---

## Resumo de Alterações

| Ficheiro | Acção | Linhas afectadas |
|----------|-------|-----------------|
| `lib/constants.ts` | Inserir `PROPERTY_PORTALS` + type | Após L370 |
| `components/email-editor/user/email-portal-links.tsx` | **CRIAR** componente completo | ~250 linhas |
| `components/email-editor/email-editor.tsx` | Import + resolver entry | L18, L38 |
| `components/email-editor/email-toolbox.tsx` | Import + ícone + item na toolbox | L5-17, L28, L48 |
| `lib/email-renderer.ts` | Constante + `renderPortalLinks()` + case no switch | L10, L541, L597 |

## Ordem de Implementação

1. **`lib/constants.ts`** — PROPERTY_PORTALS (sem dependências)
2. **`email-portal-links.tsx`** — Componente + Settings (depende de constants)
3. **`email-editor.tsx`** — Registar no resolver (depende do componente)
4. **`email-toolbox.tsx`** — Adicionar à toolbox (depende do componente)
5. **`email-renderer.ts`** — Renderização HTML (independente)

## Verificação

- [ ] Componente aparece na toolbox em "Conteúdo"
- [ ] Drag & drop funciona no canvas
- [ ] Settings panel permite adicionar/editar/remover portais
- [ ] Select pre-preenche nome ao escolher portal
- [ ] Preview mostra HTML table-based correcto
- [ ] Template serializa e deserializa correctamente (guardar e recarregar)

## Referências

- PRD: `.agents/PRD-email-portal-links.md`
- Padrão componente: `components/email-editor/user/email-button.tsx`
- Padrão array props: `components/email-editor/user/email-attachment.tsx`
- Padrão shadow presets: `components/email-editor/user/email-button.tsx:18-24`
- Padrão renderer: `lib/email-renderer.ts:496-541` (renderAttachment)
- Switch do renderer: `lib/email-renderer.ts:584-601`
