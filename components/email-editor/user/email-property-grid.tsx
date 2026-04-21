'use client'

import { useNode } from '@craftjs/core'
import { Building2, Zap, ListChecks } from 'lucide-react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  type PropertyCardInput,
} from '@/lib/email/property-card-html'
import { PropertySelector } from '@/components/email-editor/standard/property-selector'

export type EmailPropertyGridMode = 'dynamic' | 'manual'

export interface EmailPropertyGridProps {
  mode?: EmailPropertyGridMode
  properties?: PropertyCardInput[]
  columns?: number
  ctaLabel?: string
}

/**
 * Craft.js block that renders a responsive grid of property cards in the
 * final email. Data is supplied as a JSON array of `PropertyCardInput`;
 * on serialisation the email-renderer calls `renderPropertyGrid` with the
 * exact same payload, so editor preview == sent email.
 */
export const EmailPropertyGrid = ({
  mode = 'dynamic',
  properties = [],
  columns = 3,
  ctaLabel = 'Ver imóvel',
}: EmailPropertyGridProps) => {
  const {
    connectors: { connect, drag },
  } = useNode()

  const list = Array.isArray(properties) ? properties : []
  const cols = Math.max(1, Math.min(3, columns || 3))

  if (list.length === 0) {
    return (
      <div
        ref={(ref) => {
          if (ref) connect(drag(ref))
        }}
        style={{
          padding: 24,
          border: '1px dashed #cbd5e1',
          borderRadius: 8,
          color: '#64748b',
          fontSize: 13,
          textAlign: 'center',
          fontFamily: 'Arial, sans-serif',
          background: '#f8fafc',
        }}
      >
        {mode === 'dynamic'
          ? 'Grelha dinâmica — preenchida automaticamente no envio a partir do dossier do negócio.'
          : 'Seleccione imóveis nas definições do bloco para pré-visualizar a grelha.'}
      </div>
    )
  }

  return (
    <div
      ref={(ref) => {
        if (ref) connect(drag(ref))
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap: 12,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {list.map((p, idx) => (
        <CardPreview key={`${p.href}-${idx}`} p={p} ctaLabel={ctaLabel} />
      ))}
    </div>
  )
}

function CardPreview({ p, ctaLabel }: { p: PropertyCardInput; ctaLabel: string }) {
  return (
    <div
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          height: 120,
          background: '#f1f5f9',
        }}
      >
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.imageUrl}
            alt={p.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
            }}
          >
            <Building2 size={28} />
          </div>
        )}
        {p.priceLabel && (
          <span
            style={{
              position: 'absolute',
              left: 8,
              bottom: 8,
              background: 'rgba(15,23,42,0.82)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            {p.priceLabel}
          </span>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px 12px' }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.3,
          }}
        >
          {p.title}
        </p>
        {(p.reference || p.location) && (
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: 11,
              color: '#64748b',
              lineHeight: 1.3,
            }}
          >
            {[p.reference, p.location].filter(Boolean).join(' · ')}
          </p>
        )}
        {p.specs && (
          <p
            style={{
              margin: '2px 0 8px 0',
              fontSize: 11,
              color: '#64748b',
              lineHeight: 1.3,
            }}
          >
            {p.specs}
          </p>
        )}
        <span
          style={{
            display: 'inline-block',
            background: '#0f172a',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 6,
          }}
        >
          {ctaLabel}
        </span>
      </div>
    </div>
  )
}

const EmailPropertyGridSettings = () => {
  const {
    actions: { setProp },
    props,
  } = useNode((node) => ({
    props: node.data.props as EmailPropertyGridProps,
  }))

  const mode: EmailPropertyGridMode = props.mode === 'manual' ? 'manual' : 'dynamic'
  const properties = Array.isArray(props.properties) ? props.properties : []

  const setMode = (next: EmailPropertyGridMode) => {
    setProp((p: EmailPropertyGridProps) => {
      p.mode = next
      if (next === 'dynamic') p.properties = []
    })
  }

  const setProperties = (list: unknown[]) => {
    setProp((p: EmailPropertyGridProps) => {
      p.properties = list as PropertyCardInput[]
    })
  }

  return (
    <div className="space-y-3 p-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
        <ModeOption
          active={mode === 'dynamic'}
          icon={Zap}
          title="Dinâmica"
          description="Preenchida no envio"
          onClick={() => setMode('dynamic')}
        />
        <ModeOption
          active={mode === 'manual'}
          icon={ListChecks}
          title="Seleccionar imóveis"
          description="Lista fixa agora"
          onClick={() => setMode('manual')}
        />
      </div>

      {mode === 'dynamic' ? (
        <div className="rounded-md border bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
          Os imóveis serão preenchidos automaticamente a partir do dossier do
          negócio no momento do envio.
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Imóveis</Label>
          <PropertySelector value={properties} onChange={setProperties} />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Texto do botão</Label>
        <Input
          value={props.ctaLabel ?? 'Ver imóvel'}
          onChange={(e) =>
            setProp((p: EmailPropertyGridProps) => {
              p.ctaLabel = e.target.value
            })
          }
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Colunas (desktop)</Label>
        <Select
          value={String(props.columns ?? 3)}
          onValueChange={(v) =>
            setProp((p: EmailPropertyGridProps) => {
              p.columns = Number(v)
            })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 coluna</SelectItem>
            <SelectItem value="2">2 colunas</SelectItem>
            <SelectItem value="3">3 colunas</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function ModeOption({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean
  icon: typeof Zap
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2 rounded-md border px-2 py-2 text-left transition-colors ${
        active
          ? 'border-primary bg-background shadow-sm'
          : 'border-transparent bg-transparent hover:bg-background'
      }`}
    >
      <Icon
        className={`mt-0.5 h-3.5 w-3.5 ${
          active ? 'text-primary' : 'text-muted-foreground'
        }`}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`text-[11px] font-semibold leading-tight ${
            active ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {title}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
          {description}
        </div>
      </div>
    </button>
  )
}

EmailPropertyGrid.craft = {
  displayName: 'Grelha de Imóveis',
  props: {
    mode: 'dynamic' as EmailPropertyGridMode,
    properties: [],
    columns: 3,
    ctaLabel: 'Ver imóvel',
  },
  related: {
    settings: EmailPropertyGridSettings,
  },
}
