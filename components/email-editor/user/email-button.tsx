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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput, RadiusInput } from '@/components/email-editor/settings'

const SHADOW_PRESETS = [
  { value: 'none', label: 'Nenhuma' },
  { value: '0 1px 2px 0 rgba(0,0,0,0.05)', label: 'Extra Leve' },
  { value: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)', label: 'Leve' },
  { value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)', label: 'Média' },
  { value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', label: 'Grande' },
]

interface EmailButtonProps {
  text?: string
  href?: string
  backgroundColor?: string
  color?: string
  borderRadius?: string
  fontSize?: number
  paddingX?: number
  paddingY?: number
  align?: string
  fullWidth?: boolean
  boxShadow?: string
}

export const EmailButton = ({
  text = 'Clique aqui',
  href = '#',
  backgroundColor = '#576c98',
  color = '#fafafa',
  borderRadius = '65px',
  fontSize = 16,
  paddingX = 24,
  paddingY = 12,
  align = 'center',
  fullWidth = false,
  boxShadow = 'none',
}: EmailButtonProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={{ textAlign: align as React.CSSProperties['textAlign'] }}
    >
      <a
        href={href}
        style={{
          backgroundColor,
          color,
          borderRadius,
          fontSize,
          padding: `${paddingY}px ${paddingX}px`,
          display: fullWidth ? 'block' : 'inline-block',
          width: fullWidth ? '100%' : 'auto',
          textDecoration: 'none',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          boxSizing: 'border-box',
          boxShadow: boxShadow !== 'none' ? boxShadow : undefined,
        }}
      >
        {text}
      </a>
    </div>
  )
}

const EmailButtonSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailButtonProps,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Texto</Label>
        <Input
          type="text"
          value={props.text}
          onChange={(e) => setProp((p: EmailButtonProps) => { p.text = e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>URL (href)</Label>
        <Input
          type="text"
          placeholder="https://..."
          className="font-mono text-xs"
          value={props.href}
          onChange={(e) => setProp((p: EmailButtonProps) => { p.href = e.target.value })}
        />
      </div>
      <ColorPickerField
        label="Cor de fundo"
        value={props.backgroundColor || '#576c98'}
        onChange={(v) => setProp((p: EmailButtonProps) => { p.backgroundColor = v })}
      />
      <ColorPickerField
        label="Cor do texto"
        value={props.color || '#fafafa'}
        onChange={(v) => setProp((p: EmailButtonProps) => { p.color = v })}
      />
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={props.align}
          onValueChange={(v) => {
            if (v) setProp((p: EmailButtonProps) => { p.align = v })
          }}
        >
          <ToggleGroupItem value="left" aria-label="Esquerda">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Centro">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Direita">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Padding</Label>
        <UnitInput
          value={`${props.paddingY ?? 12}px`}
          onChange={(v) => setProp((p: EmailButtonProps) => { p.paddingY = parseFloat(v) || 12 })}
          units={['px']}
        />
      </div>
      <RadiusInput
        value={props.borderRadius || '65px'}
        onChange={(v) => setProp((p: EmailButtonProps) => { p.borderRadius = v })}
      />
      <div className="space-y-2">
        <Label>Largura</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          className="w-full"
          value={props.fullWidth ? '100%' : 'auto'}
          onValueChange={(val) => {
            if (val) setProp((p: EmailButtonProps) => { p.fullWidth = val === '100%' })
          }}
        >
          <ToggleGroupItem value="auto" className="flex-1 text-xs">Auto</ToggleGroupItem>
          <ToggleGroupItem value="100%" className="flex-1 text-xs">100%</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label>Sombra</Label>
        <Select
          value={props.boxShadow || 'none'}
          onValueChange={(v) => setProp((p: EmailButtonProps) => { p.boxShadow = v })}
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

EmailButton.craft = {
  displayName: 'Botão',
  props: {
    text: 'Clique aqui',
    href: '#',
    backgroundColor: '#576c98',
    color: '#fafafa',
    borderRadius: '65px',
    fontSize: 16,
    paddingX: 24,
    paddingY: 12,
    align: 'center',
    fullWidth: false,
    boxShadow: 'none',
  },
  related: {
    settings: EmailButtonSettings,
  },
}
