'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

interface EmailGridProps {
  columns?: number
  rows?: number
  gap?: number
  columnSizes?: string
  rowSizes?: string
  padding?: string | number
  background?: string
  borderRadius?: string
  borderColor?: string
  borderWidth?: number
  boxShadow?: string
  minHeight?: number
  children?: ReactNode
}

export const EmailGrid = ({
  columns = 2,
  rows = 1,
  gap = 16,
  columnSizes = '',
  rowSizes = '',
  padding = '0px',
  background = 'transparent',
  borderRadius = '0px',
  borderColor = 'transparent',
  borderWidth = 0,
  boxShadow = 'none',
  minHeight = 60,
  children,
}: EmailGridProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  const gridTemplateColumns = columnSizes.trim() || `repeat(${columns}, 1fr)`
  const gridTemplateRows = rowSizes.trim() || (rows > 1 ? `repeat(${rows}, auto)` : 'auto')

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gridTemplateRows,
        gap,
        padding: typeof padding === 'number'
          ? (padding > 0 ? padding : undefined)
          : (padding && padding !== '0px' ? padding : undefined),
        background: background !== 'transparent' ? background : undefined,
        borderRadius,
        borderColor,
        borderWidth: borderWidth > 0 ? borderWidth : undefined,
        borderStyle: borderWidth > 0 ? 'solid' : undefined,
        boxShadow: boxShadow !== 'none' ? boxShadow : undefined,
        minHeight,
      }}
    >
      {children}
    </div>
  )
}

const EmailGridSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailGridProps,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Colunas</Label>
        <UnitInput
          value={`${props.columns ?? 2}`}
          onChange={(v) => setProp((p: EmailGridProps) => { p.columns = Math.max(1, Math.min(6, parseInt(v) || 2)) })}
          units={['']}
          min={1}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Linhas</Label>
        <UnitInput
          value={`${props.rows ?? 1}`}
          onChange={(v) => setProp((p: EmailGridProps) => { p.rows = Math.max(1, Math.min(6, parseInt(v) || 1)) })}
          units={['']}
          min={1}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Espaçamento</Label>
        <UnitInput
          value={`${props.gap ?? 16}px`}
          onChange={(v) => setProp((p: EmailGridProps) => { p.gap = parseFloat(v) || 0 })}
          units={['px']}
          step={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Tamanho das Colunas</Label>
        <Input
          type="text"
          placeholder="ex: 1fr 2fr ou 200px 1fr"
          value={props.columnSizes}
          onChange={(e) => setProp((p: EmailGridProps) => { p.columnSizes = e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Vazio = colunas iguais
        </p>
      </div>
      <div className="space-y-2">
        <Label>Tamanho das Linhas</Label>
        <Input
          type="text"
          placeholder="ex: auto 200px ou 1fr 2fr"
          value={props.rowSizes}
          onChange={(e) => setProp((p: EmailGridProps) => { p.rowSizes = e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Vazio = linhas automáticas
        </p>
      </div>
      <SpacingInput
        label="Padding"
        value={props.padding ?? '0px'}
        onChange={(v) => setProp((p: EmailGridProps) => { p.padding = v })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Altura Mínima</Label>
        <UnitInput
          value={`${props.minHeight ?? 60}px`}
          onChange={(v) => setProp((p: EmailGridProps) => { p.minHeight = parseFloat(v) || 60 })}
          units={['px']}
          step={10}
        />
      </div>
      <ColorPickerField
        label="Cor de Fundo"
        value={props.background === 'transparent' ? '#ffffff' : (props.background || '#ffffff')}
        onChange={(v) => setProp((p: EmailGridProps) => { p.background = v })}
      />
      <RadiusInput
        value={props.borderRadius || '0px'}
        onChange={(v) => setProp((p: EmailGridProps) => { p.borderRadius = v })}
      />
      <ColorPickerField
        label="Cor da Borda"
        value={props.borderColor === 'transparent' ? '#000000' : (props.borderColor || '#000000')}
        onChange={(v) => setProp((p: EmailGridProps) => { p.borderColor = v })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Largura da Borda</Label>
        <UnitInput
          value={`${props.borderWidth ?? 0}px`}
          onChange={(v) => setProp((p: EmailGridProps) => { p.borderWidth = parseFloat(v) || 0 })}
          units={['px']}
        />
      </div>
      <div className="space-y-2">
        <Label>Sombra</Label>
        <Select
          value={props.boxShadow || 'none'}
          onValueChange={(v) => setProp((p: EmailGridProps) => { p.boxShadow = v })}
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

EmailGrid.craft = {
  displayName: 'Grelha',
  props: {
    columns: 2,
    rows: 1,
    gap: 16,
    columnSizes: '',
    rowSizes: '',
    padding: '0px',
    background: 'transparent',
    borderRadius: '0px',
    borderColor: 'transparent',
    borderWidth: 0,
    boxShadow: 'none',
    minHeight: 60,
  },
  related: {
    settings: EmailGridSettings,
  },
}
