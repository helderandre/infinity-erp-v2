'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'

interface EmailButtonProps {
  text?: string
  href?: string
  backgroundColor?: string
  color?: string
  borderRadius?: number
  fontSize?: number
  paddingX?: number
  paddingY?: number
  align?: string
  fullWidth?: boolean
}

export const EmailButton = ({
  text = 'Clique aqui',
  href = '#',
  backgroundColor = '#2563eb',
  color = '#ffffff',
  borderRadius = 4,
  fontSize = 16,
  paddingX = 24,
  paddingY = 12,
  align = 'center',
  fullWidth = false,
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
    text,
    href,
    backgroundColor,
    color,
    borderRadius,
    fontSize,
    paddingX,
    paddingY,
    align,
    fullWidth,
  } = useNode((node) => ({
    text: node.data.props.text,
    href: node.data.props.href,
    backgroundColor: node.data.props.backgroundColor,
    color: node.data.props.color,
    borderRadius: node.data.props.borderRadius,
    fontSize: node.data.props.fontSize,
    paddingX: node.data.props.paddingX,
    paddingY: node.data.props.paddingY,
    align: node.data.props.align,
    fullWidth: node.data.props.fullWidth,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Texto</Label>
        <Input
          type="text"
          value={text}
          onChange={(e) => setProp((p: EmailButtonProps) => { p.text = e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label>Link (URL)</Label>
        <Input
          type="text"
          placeholder="https://..."
          value={href}
          onChange={(e) => setProp((p: EmailButtonProps) => { p.href = e.target.value })}
        />
      </div>
      <ColorPickerField
        label="Cor de Fundo"
        value={backgroundColor}
        onChange={(v) => setProp((p: EmailButtonProps) => { p.backgroundColor = v })}
      />
      <ColorPickerField
        label="Cor do Texto"
        value={color}
        onChange={(v) => setProp((p: EmailButtonProps) => { p.color = v })}
      />
      <div className="space-y-2">
        <Label>Raio da Borda ({borderRadius}px)</Label>
        <Slider
          min={0}
          max={20}
          step={1}
          value={[borderRadius]}
          onValueChange={([v]) => setProp((p: EmailButtonProps) => { p.borderRadius = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Tamanho da Fonte ({fontSize}px)</Label>
        <Slider
          min={12}
          max={24}
          step={1}
          value={[fontSize]}
          onValueChange={([v]) => setProp((p: EmailButtonProps) => { p.fontSize = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Padding Horizontal ({paddingX}px)</Label>
        <Slider
          min={8}
          max={48}
          step={1}
          value={[paddingX]}
          onValueChange={([v]) => setProp((p: EmailButtonProps) => { p.paddingX = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Padding Vertical ({paddingY}px)</Label>
        <Slider
          min={4}
          max={24}
          step={1}
          value={[paddingY]}
          onValueChange={([v]) => setProp((p: EmailButtonProps) => { p.paddingY = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={align}
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
      <div className="flex items-center justify-between">
        <Label>Largura Total</Label>
        <Switch
          checked={fullWidth}
          onCheckedChange={(v) => setProp((p: EmailButtonProps) => { p.fullWidth = v })}
        />
      </div>
    </div>
  )
}

EmailButton.craft = {
  displayName: 'Botão',
  props: {
    text: 'Clique aqui',
    href: '#',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    borderRadius: 4,
    fontSize: 16,
    paddingX: 24,
    paddingY: 12,
    align: 'center',
    fullWidth: false,
  },
  related: {
    settings: EmailButtonSettings,
  },
}
