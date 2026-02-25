'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import type { ReactNode } from 'react'

interface EmailContainerProps {
  background?: string
  padding?: number
  borderRadius?: number
  borderColor?: string
  borderWidth?: number
  maxWidth?: number
  children?: ReactNode
}

export const EmailContainer = ({
  background = '#ffffff',
  padding = 20,
  borderRadius = 0,
  borderColor = 'transparent',
  borderWidth = 0,
  maxWidth = 600,
  children,
}: EmailContainerProps) => {
  const {
    connectors: { connect },
  } = useNode()

  return (
    <div
      ref={(ref) => {
        if (ref) connect(ref)
      }}
      style={{
        background,
        padding,
        borderRadius,
        borderColor,
        borderWidth,
        borderStyle: borderWidth > 0 ? 'solid' : 'none',
        maxWidth,
        margin: '0 auto',
        minHeight: 60,
      }}
    >
      {children}
    </div>
  )
}

const EmailContainerSettings = () => {
  const {
    actions: { setProp },
    background,
    padding,
    borderRadius,
    borderColor,
    borderWidth,
    maxWidth,
  } = useNode((node) => ({
    background: node.data.props.background,
    padding: node.data.props.padding,
    borderRadius: node.data.props.borderRadius,
    borderColor: node.data.props.borderColor,
    borderWidth: node.data.props.borderWidth,
    maxWidth: node.data.props.maxWidth,
  }))

  return (
    <div className="space-y-4">
      <ColorPickerField
        label="Cor de Fundo"
        value={background}
        onChange={(v) => setProp((p: EmailContainerProps) => { p.background = v })}
      />
      <div className="space-y-2">
        <Label>Padding ({padding}px)</Label>
        <Slider
          min={0}
          max={60}
          step={1}
          value={[padding]}
          onValueChange={([v]) => setProp((p: EmailContainerProps) => { p.padding = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Raio da Borda ({borderRadius}px)</Label>
        <Slider
          min={0}
          max={20}
          step={1}
          value={[borderRadius]}
          onValueChange={([v]) => setProp((p: EmailContainerProps) => { p.borderRadius = v })}
        />
      </div>
      <ColorPickerField
        label="Cor da Borda"
        value={borderColor === 'transparent' ? '#000000' : borderColor}
        onChange={(v) => setProp((p: EmailContainerProps) => { p.borderColor = v })}
      />
      <div className="space-y-2">
        <Label>Largura da Borda ({borderWidth}px)</Label>
        <Slider
          min={0}
          max={5}
          step={1}
          value={[borderWidth]}
          onValueChange={([v]) => setProp((p: EmailContainerProps) => { p.borderWidth = v })}
        />
      </div>
      <div className="space-y-2">
        <Label>Largura Máxima ({maxWidth}px)</Label>
        <Slider
          min={400}
          max={800}
          step={10}
          value={[maxWidth]}
          onValueChange={([v]) => setProp((p: EmailContainerProps) => { p.maxWidth = v })}
        />
      </div>
    </div>
  )
}

EmailContainer.craft = {
  displayName: 'Contentor',
  props: {
    background: '#ffffff',
    padding: 20,
    borderRadius: 0,
    borderColor: 'transparent',
    borderWidth: 0,
    maxWidth: 600,
  },
  related: {
    settings: EmailContainerSettings,
  },
  rules: {
    canDrag: () => false,
  },
}
