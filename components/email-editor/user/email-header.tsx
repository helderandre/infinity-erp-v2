'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

const LOGO_URL = 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/43f87d7c-92b5-4403-b7bb-618c8d4a2b9e.png'

interface EmailHeaderProps {
  backgroundColor?: string
  logoWidth?: number
  paddingY?: number
}

export const EmailHeader = ({
  backgroundColor = '#000000',
  logoWidth = 180,
  paddingY = 24,
}: EmailHeaderProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <div
      ref={(ref) => { if (ref) connect(drag(ref)) }}
      style={{
        backgroundColor,
        padding: `${paddingY}px 24px`,
        textAlign: 'center',
        width: '100%',
      }}
    >
      <img
        src={LOGO_URL}
        alt="Infinity Group"
        style={{
          width: `${logoWidth}px`,
          height: 'auto',
          display: 'inline-block',
        }}
      />
    </div>
  )
}

const EmailHeaderSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({ props: node.data.props }))

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Cor de fundo</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={props.backgroundColor || '#000000'}
            onChange={(e) => setProp((p: any) => { p.backgroundColor = e.target.value })}
            className="h-8 w-8 rounded border cursor-pointer"
          />
          <Input
            value={props.backgroundColor || '#000000'}
            onChange={(e) => setProp((p: any) => { p.backgroundColor = e.target.value })}
            className="flex-1 text-xs h-8"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Largura do logo (px)</Label>
        <Input
          type="number"
          value={props.logoWidth || 180}
          onChange={(e) => setProp((p: any) => { p.logoWidth = parseInt(e.target.value) || 180 })}
          className="text-xs h-8"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Padding vertical (px)</Label>
        <Input
          type="number"
          value={props.paddingY || 24}
          onChange={(e) => setProp((p: any) => { p.paddingY = parseInt(e.target.value) || 24 })}
          className="text-xs h-8"
        />
      </div>
    </div>
  )
}

EmailHeader.craft = {
  displayName: 'Cabeçalho',
  props: {
    backgroundColor: '#000000',
    logoWidth: 180,
    paddingY: 24,
  },
  related: {
    settings: EmailHeaderSettings,
  },
}
