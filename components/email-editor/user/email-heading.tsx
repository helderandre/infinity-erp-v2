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
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import { createElement } from 'react'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'

interface EmailHeadingProps {
  text?: string
  level?: 'h1' | 'h2' | 'h3' | 'h4'
  color?: string
  textAlign?: string
  fontFamily?: string
}

export const EmailHeading = ({
  text = 'Título',
  level = 'h2',
  color = '#000000',
  textAlign = 'left',
  fontFamily = 'Arial, sans-serif',
}: EmailHeadingProps) => {
  const {
    connectors: { connect, drag },
    actions: { setProp },
  } = useNode()

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
    >
      {createElement(
        level,
        {
          contentEditable: true,
          suppressContentEditableWarning: true,
          onBlur: (e: React.FocusEvent<HTMLHeadingElement>) =>
            setProp((p: EmailHeadingProps) => {
              p.text = e.currentTarget.textContent || ''
            }),
          style: {
            color,
            textAlign: textAlign as React.CSSProperties['textAlign'],
            fontFamily,
            margin: 0,
            outline: 'none',
            cursor: 'text',
          },
        },
        text
      )}
    </div>
  )
}

const EmailHeadingSettings = () => {
  const {
    actions: { setProp },
    level,
    color,
    textAlign,
    fontFamily,
  } = useNode((node) => ({
    level: node.data.props.level,
    color: node.data.props.color,
    textAlign: node.data.props.textAlign,
    fontFamily: node.data.props.fontFamily,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nível</Label>
        <Select
          value={level}
          onValueChange={(v) => setProp((p: EmailHeadingProps) => { p.level = v as EmailHeadingProps['level'] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="h1">Título 1</SelectItem>
            <SelectItem value="h2">Título 2</SelectItem>
            <SelectItem value="h3">Título 3</SelectItem>
            <SelectItem value="h4">Título 4</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ColorPickerField
        label="Cor"
        value={color}
        onChange={(v) => setProp((p: EmailHeadingProps) => { p.color = v })}
      />
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={textAlign}
          onValueChange={(v) => {
            if (v) setProp((p: EmailHeadingProps) => { p.textAlign = v })
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
      <div className="space-y-2">
        <Label>Fonte</Label>
        <Select
          value={fontFamily}
          onValueChange={(v) => setProp((p: EmailHeadingProps) => { p.fontFamily = v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Arial, sans-serif">Arial</SelectItem>
            <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
            <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
            <SelectItem value="Tahoma, sans-serif">Tahoma</SelectItem>
            <SelectItem value="Trebuchet MS, sans-serif">Trebuchet MS</SelectItem>
            <SelectItem value="Lucida Sans, Lucida Grande, sans-serif">Lucida Sans</SelectItem>
            <SelectItem value="Segoe UI, sans-serif">Segoe UI</SelectItem>
            <SelectItem value="Georgia, serif">Georgia</SelectItem>
            <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
            <SelectItem value="Palatino, Palatino Linotype, serif">Palatino</SelectItem>
            <SelectItem value="Book Antiqua, Palatino, serif">Book Antiqua</SelectItem>
            <SelectItem value="Courier New, monospace">Courier New</SelectItem>
            <SelectItem value="Lucida Console, monospace">Lucida Console</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

EmailHeading.craft = {
  displayName: 'Título',
  props: {
    text: 'Título',
    level: 'h2',
    color: '#000000',
    textAlign: 'left',
    fontFamily: 'Arial, sans-serif',
  },
  related: {
    settings: EmailHeadingSettings,
  },
}
