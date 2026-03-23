'use client'

import type { MapaGestaoTotals } from '@/types/financial'

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

interface MapaGestaoFunnelProps {
  totals: MapaGestaoTotals & { partner_total: number }
}

export function MapaGestaoFunnel({ totals }: MapaGestaoFunnelProps) {
  const layers = [
    { label: 'Report', value: totals.report, width: 100, bg: 'bg-neutral-900', text: 'text-white' },
    { label: 'A Receber Consultor', value: totals.consultant_total, width: 85, bg: 'bg-neutral-700', text: 'text-white' },
    { label: 'Convictus', value: totals.network_total, width: 70, bg: 'bg-neutral-500', text: 'text-white' },
    { label: 'Margem', value: totals.margin_total, width: 55, bg: 'bg-neutral-400', text: 'text-white' },
  ]

  return (
    <div className="space-y-6">
      {/* Funnel */}
      <div className="flex flex-col items-center gap-0">
        {layers.map((layer, idx) => (
          <div
            key={layer.label}
            className={`${layer.bg} ${layer.text} rounded-2xl flex flex-col items-center justify-center py-4 transition-all duration-500`}
            style={{
              width: `${layer.width}%`,
              marginTop: idx === 0 ? 0 : '-0.5rem',
              zIndex: layers.length - idx,
              position: 'relative',
            }}
          >
            <span className="text-xs font-medium opacity-80">{layer.label}</span>
            <span className="text-lg font-bold tabular-nums">{fmtCurrency(layer.value)}</span>
          </div>
        ))}
      </div>

      {/* Bottom cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 text-center">
          <span className="text-xl font-bold tabular-nums">{fmtCurrency(totals.partner_total)}</span>
          <p className="text-xs text-muted-foreground mt-1">Total Parceiros</p>
        </div>
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 text-center">
          <span className="text-xl font-bold tabular-nums">{fmtCurrency(totals.report)}</span>
          <p className="text-xs text-muted-foreground mt-1">Mapa de Comissoes Remax</p>
        </div>
      </div>
    </div>
  )
}
