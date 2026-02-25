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
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput } from '@/components/email-editor/settings'

interface EmailDividerProps {
  color?: string
  thickness?: number
  marginY?: number
  style?: 'solid' | 'dashed' | 'dotted'
}

export const EmailDivider = ({
  color = '#e5e7eb',
  thickness = 1,
  marginY = 16,
  style = 'solid',
}: EmailDividerProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
    >
      <hr
        style={{
          borderTop: `${thickness}px ${style} ${color}`,
          borderBottom: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          marginTop: marginY,
          marginBottom: marginY,
        }}
      />
    </div>
  )
}

const EmailDividerSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailDividerProps,
  }))

  return (
    <div className="space-y-4">
      <ColorPickerField
        label="Cor"
        value={props.color || '#e5e7eb'}
        onChange={(v) => setProp((p: EmailDividerProps) => { p.color = v })}
      />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Espessura</Label>
        <UnitInput
          value={`${props.thickness ?? 1}px`}
          onChange={(v) => setProp((p: EmailDividerProps) => { p.thickness = Math.max(1, parseFloat(v) || 1) })}
          units={['px']}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Margem Vertical</Label>
        <UnitInput
          value={`${props.marginY ?? 16}px`}
          onChange={(v) => setProp((p: EmailDividerProps) => { p.marginY = parseFloat(v) || 0 })}
          units={['px']}
        />
      </div>
      <div className="space-y-2">
        <Label>Estilo</Label>
        <Select
          value={props.style}
          onValueChange={(v) => setProp((p: EmailDividerProps) => { p.style = v as EmailDividerProps['style'] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Sólido</SelectItem>
            <SelectItem value="dashed">Tracejado</SelectItem>
            <SelectItem value="dotted">Pontilhado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

EmailDivider.craft = {
  displayName: 'Divisor',
  props: {
    color: '#e5e7eb',
    thickness: 1,
    marginY: 16,
    style: 'solid',
  },
  related: {
    settings: EmailDividerSettings,
  },
}
