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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react'
import { EMAIL_TEMPLATE_VARIABLES } from '@/lib/constants'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'

interface EmailTextProps {
  text?: string
  fontSize?: number
  fontWeight?: string
  color?: string
  textAlign?: string
  lineHeight?: number
  fontFamily?: string
}

export const EmailText = ({
  text = 'Texto de exemplo',
  fontSize = 16,
  fontWeight = 'normal',
  color = '#000000',
  textAlign = 'left',
  lineHeight = 1.5,
  fontFamily = 'Arial, sans-serif',
}: EmailTextProps) => {
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
      <p
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) =>
          setProp((p: EmailTextProps) => {
            p.text = e.currentTarget.textContent || ''
          })
        }
        style={{
          fontSize,
          fontWeight,
          color,
          textAlign: textAlign as React.CSSProperties['textAlign'],
          lineHeight,
          fontFamily,
          margin: 0,
          outline: 'none',
          cursor: 'text',
        }}
      >
        {text}
      </p>
    </div>
  )
}

const EmailTextSettings = () => {
  const {
    actions: { setProp },
    fontSize,
    fontWeight,
    color,
    textAlign,
    lineHeight,
    fontFamily,
    text,
  } = useNode((node) => ({
    fontSize: node.data.props.fontSize,
    fontWeight: node.data.props.fontWeight,
    color: node.data.props.color,
    textAlign: node.data.props.textAlign,
    lineHeight: node.data.props.lineHeight,
    fontFamily: node.data.props.fontFamily,
    text: node.data.props.text,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tamanho da Fonte ({fontSize}px)</Label>
        <Slider
          min={10}
          max={48}
          step={1}
          value={[fontSize]}
          onValueChange={([v]) => setProp((p: EmailTextProps) => { p.fontSize = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Peso da Fonte</Label>
        <Select
          value={fontWeight}
          onValueChange={(v) => setProp((p: EmailTextProps) => { p.fontWeight = v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="bold">Bold</SelectItem>
            <SelectItem value="300">Light (300)</SelectItem>
            <SelectItem value="500">Medium (500)</SelectItem>
            <SelectItem value="600">Semi-bold (600)</SelectItem>
            <SelectItem value="700">Bold (700)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <ColorPickerField
        label="Cor"
        value={color}
        onChange={(v) => setProp((p: EmailTextProps) => { p.color = v })}
      />
      <div className="space-y-2">
        <Label>Alinhamento</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={textAlign}
          onValueChange={(v) => {
            if (v) setProp((p: EmailTextProps) => { p.textAlign = v })
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
          <ToggleGroupItem value="justify" aria-label="Justificado">
            <AlignJustify className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="space-y-2">
        <Label>Altura da Linha ({lineHeight})</Label>
        <Slider
          min={1}
          max={3}
          step={0.1}
          value={[lineHeight]}
          onValueChange={([v]) => setProp((p: EmailTextProps) => { p.lineHeight = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Fonte</Label>
        <Select
          value={fontFamily}
          onValueChange={(v) => setProp((p: EmailTextProps) => { p.fontFamily = v })}
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
      <div className="space-y-2">
        <Label>Variáveis</Label>
        <div className="flex flex-wrap gap-1">
          {EMAIL_TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.value}
              type="button"
              className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
              onClick={() =>
                setProp((p: EmailTextProps) => {
                  p.text = (text || '') + ' ' + v.value
                })
              }
              title={v.label}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

EmailText.craft = {
  displayName: 'Texto',
  props: {
    text: 'Texto de exemplo',
    fontSize: 16,
    fontWeight: 'normal',
    color: '#000000',
    textAlign: 'left',
    lineHeight: 1.5,
    fontFamily: 'Arial, sans-serif',
  },
  related: {
    settings: EmailTextSettings,
  },
}
