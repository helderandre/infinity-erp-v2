'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Rows2,
  Columns2,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalSpaceBetween,
} from 'lucide-react'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput, RadiusInput, SpacingInput } from '@/components/email-editor/settings'
import type { ReactNode } from 'react'

const SHADOW_PRESETS = [
  { value: 'none', label: 'Nenhuma' },
  { value: '0 1px 2px 0 rgba(0,0,0,0.05)', label: 'Extra Leve' },
  { value: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)', label: 'Leve' },
  { value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)', label: 'Média' },
  { value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', label: 'Grande' },
  { value: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', label: 'Extra Grande' },
]

/**
 * Parse legacy `border` string (e.g. "1px solid #e5e7eb") into width + color.
 * Returns defaults if unparseable.
 */
function parseLegacyBorder(border?: string): { width: number; color: string } {
  if (!border || border === 'none') return { width: 0, color: 'transparent' }
  const match = border.match(/^(\d+)px\s+\w+\s+(.+)$/)
  if (match) return { width: parseInt(match[1]) || 0, color: match[2] }
  return { width: 0, color: 'transparent' }
}

interface EmailContainerProps {
  direction?: 'column' | 'row'
  align?: string
  justify?: string
  gap?: number
  padding?: string | number
  margin?: string | number
  width?: string
  background?: string
  border?: string
  borderWidth?: number
  borderColor?: string
  borderRadius?: string
  boxShadow?: string
  children?: ReactNode
}

/** Normalize padding/margin: number → "Npx", string → passthrough */
function normalizeSpacing(val: string | number | undefined, fallback: string): string {
  if (val == null) return fallback
  if (typeof val === 'number') return val > 0 ? `${val}px` : '0px'
  return val || fallback
}

export const EmailContainer = ({
  direction = 'column',
  align = 'stretch',
  justify = 'flex-start',
  gap = 8,
  padding = '24px',
  margin = '0px',
  width = '100%',
  background = '#ffffff',
  border,
  borderWidth = 0,
  borderColor = 'transparent',
  borderRadius = '0px',
  boxShadow = 'none',
  children,
}: EmailContainerProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  // Backward compat: if old `border` string exists, use it; otherwise use new split props
  const borderStyle = border && border !== 'none'
    ? border
    : borderWidth > 0
      ? `${borderWidth}px solid ${borderColor}`
      : undefined

  const paddingCSS = normalizeSpacing(padding, '24px')
  const marginCSS = normalizeSpacing(margin, '0px')

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={{
        display: 'flex',
        flexDirection: direction,
        alignItems: align,
        justifyContent: justify,
        gap: gap > 0 ? gap : undefined,
        padding: paddingCSS,
        margin: marginCSS !== '0px' ? marginCSS : undefined,
        width,
        background,
        border: borderStyle,
        borderRadius,
        boxShadow: boxShadow !== 'none' ? boxShadow : undefined,
        minHeight: 40,
      }}
    >
      {children}
    </div>
  )
}

const EmailContainerSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailContainerProps,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Direcção</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full"
          value={props.direction || 'column'}
          onValueChange={(val) => {
            if (val) setProp((p: EmailContainerProps) => { p.direction = val as 'column' | 'row' })
          }}
        >
          <ToggleGroupItem value="column" aria-label="Coluna" className="flex-1 gap-1.5">
            <Rows2 className="h-4 w-4" />
            <span className="text-xs">Coluna</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="row" aria-label="Linha" className="flex-1 gap-1.5">
            <Columns2 className="h-4 w-4" />
            <span className="text-xs">Linha</span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <Label>Alinhar itens</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={props.align || 'stretch'}
          onValueChange={(val) => {
            if (val) setProp((p: EmailContainerProps) => { p.align = val })
          }}
        >
          <ToggleGroupItem value="flex-start" aria-label="Início">
            <AlignStartVertical className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centro">
            <AlignCenterVertical className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="flex-end" aria-label="Fim">
            <AlignEndVertical className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="stretch" aria-label="Esticar" className="text-xs">
            ↕
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        <Label>Justificar</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={props.justify || 'flex-start'}
          onValueChange={(val) => {
            if (val) setProp((p: EmailContainerProps) => { p.justify = val })
          }}
        >
          <ToggleGroupItem value="flex-start" aria-label="Início">
            <AlignHorizontalJustifyStart className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centro">
            <AlignHorizontalJustifyCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="flex-end" aria-label="Fim">
            <AlignHorizontalJustifyEnd className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="space-between" aria-label="Distribuir">
            <AlignHorizontalSpaceBetween className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Gap</Label>
        <UnitInput
          value={`${props.gap ?? 8}px`}
          onChange={(v) => setProp((p: EmailContainerProps) => { p.gap = parseFloat(v) || 0 })}
          units={['px']}
          step={2}
        />
      </div>

      <SpacingInput
        label="Padding"
        value={props.padding ?? '24px'}
        onChange={(v) => setProp((p: EmailContainerProps) => { p.padding = v })}
      />

      <SpacingInput
        label="Margin"
        value={props.margin ?? '0px'}
        onChange={(v) => setProp((p: EmailContainerProps) => { p.margin = v })}
      />

      <div className="space-y-2">
        <Label>Largura</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full"
          value={props.width || '100%'}
          onValueChange={(val) => {
            if (val) setProp((p: EmailContainerProps) => { p.width = val })
          }}
        >
          <ToggleGroupItem value="auto" className="flex-1 text-xs">Auto</ToggleGroupItem>
          <ToggleGroupItem value="100%" className="flex-1 text-xs">100%</ToggleGroupItem>
          <ToggleGroupItem value="50%" className="flex-1 text-xs">50%</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ColorPickerField
        label="Cor de fundo"
        value={props.background || '#ffffff'}
        onChange={(v) => setProp((p: EmailContainerProps) => { p.background = v })}
      />

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Largura da Borda</Label>
        <UnitInput
          value={`${props.borderWidth ?? parseLegacyBorder(props.border).width}px`}
          onChange={(v) => setProp((p: EmailContainerProps) => {
            p.borderWidth = parseFloat(v) || 0
            p.border = 'none'
          })}
          units={['px']}
        />
      </div>
      <ColorPickerField
        label="Cor da Borda"
        value={
          (props.borderColor && props.borderColor !== 'transparent')
            ? props.borderColor
            : parseLegacyBorder(props.border).color !== 'transparent'
              ? parseLegacyBorder(props.border).color
              : '#000000'
        }
        onChange={(v) => setProp((p: EmailContainerProps) => {
          p.borderColor = v
          p.border = 'none'
        })}
      />

      <RadiusInput
        value={props.borderRadius || '0px'}
        onChange={(v) => setProp((p: EmailContainerProps) => { p.borderRadius = v })}
      />

      <div className="space-y-2">
        <Label>Sombra</Label>
        <Select
          value={props.boxShadow || 'none'}
          onValueChange={(v) => setProp((p: EmailContainerProps) => { p.boxShadow = v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHADOW_PRESETS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

EmailContainer.craft = {
  displayName: 'Contentor',
  props: {
    direction: 'column',
    align: 'stretch',
    justify: 'flex-start',
    gap: 8,
    padding: '24px',
    margin: '0px',
    width: '100%',
    background: '#ffffff',
    border: 'none',
    borderWidth: 0,
    borderColor: 'transparent',
    borderRadius: '0px',
    boxShadow: 'none',
  },
  related: {
    settings: EmailContainerSettings,
  },
  rules: {
    canDrag: () => true,
    canMoveIn: () => true,
  },
}
