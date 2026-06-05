'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { UnitInput } from '@/components/email-editor/settings'

interface EmailSpacerProps {
  height?: number
}

export const EmailSpacer = ({ height = 20 }: EmailSpacerProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={{ height, minHeight: height }}
    />
  )
}

const EmailSpacerSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailSpacerProps,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Altura</Label>
        <UnitInput
          value={`${props.height ?? 20}px`}
          onChange={(v) => setProp((p: EmailSpacerProps) => { p.height = Math.max(4, parseFloat(v) || 20) })}
          units={['px']}
        />
      </div>
    </div>
  )
}

EmailSpacer.craft = {
  displayName: 'Espaçador',
  props: {
    height: 20,
  },
  related: {
    settings: EmailSpacerSettings,
  },
}
