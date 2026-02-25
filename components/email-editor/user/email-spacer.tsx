'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'

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
    height,
  } = useNode((node) => ({
    height: node.data.props.height,
  }))

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Altura ({height}px)</Label>
        <Slider
          min={4}
          max={120}
          step={1}
          value={[height]}
          onValueChange={([v]) => setProp((p: EmailSpacerProps) => { p.height = v })}
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
