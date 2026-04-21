'use client'

import { useNode } from '@craftjs/core'
import {
  EmailButtonForm,
  EMAIL_BUTTON_FORM_DEFAULTS,
  type EmailButtonFormProps,
} from '@/components/email-editor/shared/email-block-forms'

type EmailButtonProps = EmailButtonFormProps

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
      <EmailButtonForm
        props={props}
        onChange={(patch) =>
          setProp((p: EmailButtonProps) => {
            Object.assign(p, patch)
          })
        }
      />
    </div>
  )
}

EmailButton.craft = {
  displayName: 'Botão',
  props: { ...EMAIL_BUTTON_FORM_DEFAULTS },
  related: {
    settings: EmailButtonSettings,
  },
}
