'use client'

import { useNode } from '@craftjs/core'
import { Building2 } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  type PropertyCardInput,
} from '@/lib/email/property-card-html'

export interface EmailPropertyGridProps {
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
        Adicione imóveis nas definições do bloco para pré-visualizar a grelha.
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

  const json = JSON.stringify(props.properties ?? [], null, 2)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Imóveis (JSON)
        </Label>
        <Textarea
          rows={10}
          value={json}
          onChange={(e) => {
            const raw = e.target.value
            setProp((p: EmailPropertyGridProps) => {
              try {
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) p.properties = parsed
              } catch {
                /* allow temporarily invalid JSON while editing */
              }
            })
          }}
          className="font-mono text-xs"
          placeholder='[ { "title": "...", "priceLabel": "...", "location": "...", "specs": "...", "imageUrl": null, "href": "...", "reference": null } ]'
        />
        <p className="text-[10px] text-muted-foreground">
          No envio real a partir do dossier do negócio, esta lista é
          substituída automaticamente pelas propriedades seleccionadas.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Texto do botão
        </Label>
        <input
          type="text"
          value={props.ctaLabel ?? 'Ver imóvel'}
          onChange={(e) =>
            setProp((p: EmailPropertyGridProps) => {
              p.ctaLabel = e.target.value
            })
          }
          className="w-full rounded-md border bg-background px-2 py-1 text-xs"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Colunas (desktop)</Label>
        <select
          value={String(props.columns ?? 3)}
          onChange={(e) =>
            setProp((p: EmailPropertyGridProps) => {
              p.columns = Number(e.target.value)
            })
          }
          className="w-full rounded-md border bg-background px-2 py-1 text-xs"
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
      </div>
    </div>
  )
}

EmailPropertyGrid.craft = {
  displayName: 'Grelha de Imóveis',
  props: {
    properties: [],
    columns: 3,
    ctaLabel: 'Ver imóvel',
  },
  related: {
    settings: EmailPropertyGridSettings,
  },
}
