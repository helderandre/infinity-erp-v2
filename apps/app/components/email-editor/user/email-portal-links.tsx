'use client'

import { useNode } from '@craftjs/core'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ColorPickerField } from '@/components/email-editor/color-picker-field'
import { UnitInput, RadiusInput } from '@/components/email-editor/settings'
import { PROPERTY_PORTALS, type PropertyPortalKey } from '@/lib/constants'
import { ArrowDown, ArrowRight, ExternalLink } from 'lucide-react'

const SHADOW_PRESETS = [
  { value: 'none', label: 'Nenhuma' },
  { value: '0 1px 2px 0 rgba(0,0,0,0.05)', label: 'Extra Leve' },
  { value: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)', label: 'Leve' },
  { value: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)', label: 'Média' },
  { value: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', label: 'Grande' },
]

export interface PortalItem {
  portal: string
  name: string
  url: string
}

export interface EmailPortalLinksProps {
  portals?: PortalItem[]
  title?: string
  showTitle?: boolean
  layout?: 'vertical' | 'horizontal'
  gap?: number
  borderRadius?: string
  cardBackground?: string
  boxShadow?: string
}

export const EmailPortalLinks = ({
  portals = [],
  title = 'Anúncios nos Portais',
  showTitle = true,
  layout = 'vertical',
  gap = 12,
  borderRadius = '8px',
  cardBackground = '#f9fafb',
  boxShadow = 'none',
}: EmailPortalLinksProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  // No portals populated yet — show placeholder (template builder mode)
  if (portals.length === 0) {
    return (
      <div
        ref={(ref) => {
          if (ref) connect(drag(ref))
        }}
        style={{
          border: '2px dashed #d1d5db',
          borderRadius: '8px',
          padding: '20px 24px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '13px',
          backgroundColor: '#f9fafb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <ExternalLink style={{ width: '18px', height: '18px', color: '#9ca3af' }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>Links de Portais</span>
        </div>
        <span>Os links dos portais imobiliários serão populados automaticamente com base no imóvel associado.</span>
      </div>
    )
  }

  const isHorizontal = layout === 'horizontal'

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
    >
      {showTitle && (
        <p style={{ fontWeight: 600, fontSize: '16px', margin: '0 0 12px 0', fontFamily: 'Arial, sans-serif' }}>
          {title}
        </p>
      )}
      <div
        style={{
          display: isHorizontal ? 'flex' : 'block',
          flexWrap: isHorizontal ? 'wrap' : undefined,
          gap: isHorizontal ? `${gap}px` : undefined,
        }}
      >
        {portals.map((portal, index) => {
          const meta = PROPERTY_PORTALS[portal.portal as PropertyPortalKey]
          const color = meta?.color || '#6B7280'
          const icon = meta?.icon || '🔗'

          return (
            <div
              key={index}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius,
                backgroundColor: cardBackground,
                boxShadow: boxShadow !== 'none' ? boxShadow : undefined,
                padding: '12px 16px',
                marginBottom: !isHorizontal && index < portals.length - 1 ? `${gap}px` : undefined,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  backgroundColor: `${color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', fontFamily: 'Arial, sans-serif' }}>
                  {portal.name || 'Portal'}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'Arial, sans-serif' }}>
                  Ver anúncio →
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Settings — only styling options, portals are populated automatically
const EmailPortalLinksSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailPortalLinksProps,
  }))

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">
        Os links dos portais são populados automaticamente com base no imóvel associado ao processo ou email.
      </div>

      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          type="text"
          value={props.title}
          onChange={(e) => setProp((p: EmailPortalLinksProps) => { p.title = e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Mostrar título</Label>
        <Switch
          checked={props.showTitle}
          onCheckedChange={(v) => setProp((p: EmailPortalLinksProps) => { p.showTitle = v })}
        />
      </div>

      <div className="space-y-2">
        <Label>Layout</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={props.layout}
          onValueChange={(v) => {
            if (v) setProp((p: EmailPortalLinksProps) => { p.layout = v as 'vertical' | 'horizontal' })
          }}
        >
          <ToggleGroupItem value="vertical" aria-label="Vertical">
            <ArrowDown className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="horizontal" aria-label="Horizontal">
            <ArrowRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Espaçamento</Label>
        <UnitInput
          value={`${props.gap ?? 12}px`}
          onChange={(v) => setProp((p: EmailPortalLinksProps) => { p.gap = parseFloat(v) || 12 })}
          units={['px']}
        />
      </div>

      <RadiusInput
        value={props.borderRadius || '8px'}
        onChange={(v) => setProp((p: EmailPortalLinksProps) => { p.borderRadius = v })}
      />

      <ColorPickerField
        label="Fundo do card"
        value={props.cardBackground || '#f9fafb'}
        onChange={(v) => setProp((p: EmailPortalLinksProps) => { p.cardBackground = v })}
      />

      <div className="space-y-2">
        <Label>Sombra</Label>
        <Select
          value={props.boxShadow || 'none'}
          onValueChange={(v) => setProp((p: EmailPortalLinksProps) => { p.boxShadow = v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHADOW_PRESETS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

EmailPortalLinks.craft = {
  displayName: 'Links de Portais',
  props: {
    portals: [],
    title: 'Anúncios nos Portais',
    showTitle: true,
    layout: 'vertical',
    gap: 12,
    borderRadius: '8px',
    cardBackground: '#f9fafb',
    boxShadow: 'none',
  } as EmailPortalLinksProps,
  related: {
    settings: EmailPortalLinksSettings,
  },
}
