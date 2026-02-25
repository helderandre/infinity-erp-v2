'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'

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
    color,
    thickness,
    marginY,
    style,
  } = useNode((node) => ({
    color: node.data.props.color,
    thickness: node.data.props.thickness,
    marginY: node.data.props.marginY,
    style: node.data.props.style,
  }))

  return (
    <div className="space-y-4">
      <ColorPickerField
        label="Cor"
        value={color}
        onChange={(v) => setProp((p: EmailDividerProps) => { p.color = v })}
      />
      <div className="space-y-2">
        <Label>Espessura ({thickness}px)</Label>
        <Slider
          min={1}
          max={5}
          step={1}
          value={[thickness]}
          onValueChange={([v]) => setProp((p: EmailDividerProps) => { p.thickness = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Margem Vertical ({marginY}px)</Label>
        <Slider
          min={0}
          max={48}
          step={1}
          value={[marginY]}
          onValueChange={([v]) => setProp((p: EmailDividerProps) => { p.marginY = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Estilo</Label>
        <Select
          value={style}
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
