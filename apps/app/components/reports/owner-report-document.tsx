import type {
  OwnerReportConfig,
  OwnerReportData,
} from '@/lib/reports/owner-activity-report'

/**
 * Documento visual do Relatório de Atividade ao Proprietário.
 * Renderizado por uma página SSR e convertido para PDF A4 via Puppeteer.
 * Apenas apresentação — recebe o snapshot já agregado.
 *
 * Copy em PT-PT formal (documento externo para o proprietário).
 */

const eur = (n: number | null | undefined, digits = 0) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: digits,
      }).format(n)

const num = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('pt-PT').format(n)

const datePT = (iso: string | null | undefined) =>
  !iso
    ? '—'
    : new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))

const ACCENT = '#1e293b' // slate-800
const GOLD = '#b78628'

const RATING_MAX = 5

// Favicon dos portais (serviço do Google) para enriquecer o bloco de portais.
const faviconUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

const PORTALS = [
  { key: 'idealista', label: 'Idealista', domain: 'idealista.pt' },
  { key: 'imovirtual', label: 'Imovirtual', domain: 'imovirtual.com' },
  { key: 'casaSapo', label: 'Casa Sapo', domain: 'casa.sapo.pt' },
  { key: 'website', label: 'Website', domain: 'infinitygroup.pt' },
] as const

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-7" style={{ breakInside: 'avoid' }}>
      <div className="mb-3 flex items-baseline gap-3 border-b border-slate-200 pb-1.5">
        <span className="h-3 w-1 rounded-full" style={{ background: GOLD }} />
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        {hint ? <span className="ml-auto text-[10px] text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold leading-none text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-[10px] text-slate-400">{sub}</div> : null}
    </div>
  )
}

export function OwnerReportDocument({
  data,
  config,
  print,
}: {
  data: OwnerReportData
  config: OwnerReportConfig
  print: boolean
}) {
  const { blocks } = config
  const p = data.property

  // ── Funil ──
  const funnelStages: { label: string; value: number }[] = []
  if (data.funnel.impressions != null)
    funnelStages.push({ label: 'Impressões', value: data.funnel.impressions })
  if (data.funnel.clicks != null && data.funnel.clicks > 0)
    funnelStages.push({ label: 'Cliques', value: data.funnel.clicks })
  funnelStages.push({ label: 'Leads geradas', value: data.funnel.leads })
  funnelStages.push({ label: 'Pedidos de visita', value: data.funnel.visitRequests })
  funnelStages.push({ label: 'Visitas realizadas', value: data.funnel.visitsDone })
  funnelStages.push({ label: 'Interessados', value: data.funnel.interested })
  const funnelMax = Math.max(1, ...funnelStages.map((s) => s.value))

  const showFeedback = blocks.feedback
  const showPrice =
    blocks.price && (p.listingPrice != null || data.priceComparison.avgPerceivedValue != null)
  const showMeta = blocks.meta && data.meta.hasData

  return (
    <div
      className={print ? 'bg-white' : 'min-h-screen bg-slate-100 py-8'}
      style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
    >
      <div
        className="mx-auto bg-white text-slate-700"
        style={{ width: '794px', padding: '24px 44px' }}
      >
        {/* ── Cabeçalho ── */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: GOLD }}
              >
                Infinity Group
              </div>
              <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
                Relatório de Atividade
              </h1>
            </div>
            <div className="text-right text-[10px] text-slate-400">
              <div>Emitido em {datePT(data.generatedAt)}</div>
              {data.generatedByName ? <div>Consultor: {data.generatedByName}</div> : null}
              {data.period.from || data.period.to ? (
                <div>
                  Período: {datePT(data.period.from)} — {datePT(data.period.to)}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="mt-5 overflow-hidden rounded-2xl border border-slate-200"
            style={{ background: ACCENT }}
          >
            <div className="flex">
              {p.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.coverUrl}
                  alt=""
                  className="h-[150px] w-[230px] flex-none object-cover"
                />
              ) : (
                <div className="h-[150px] w-[230px] flex-none bg-slate-700" />
              )}
              <div className="flex flex-col justify-center px-6 py-4 text-white">
                <div className="text-[10px] uppercase tracking-wide text-white/50">
                  {p.externalRef ? `Ref. ${p.externalRef}` : 'Imóvel'}
                </div>
                <div className="mt-1 text-[18px] font-semibold leading-snug">
                  {p.title ?? 'Imóvel'}
                </div>
                <div className="mt-1 text-[11px] text-white/70">
                  {[p.addressLine, p.zone, p.city].filter(Boolean).join(' · ') || '—'}
                </div>
                {p.listingPrice != null ? (
                  <div className="mt-2 text-[15px] font-semibold" style={{ color: '#e9c877' }}>
                    {eur(p.listingPrice)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {/* ── Resumo executivo ── */}
        <Section title="Resumo executivo">
          <div className="grid grid-cols-4 gap-3">
            <Kpi
              label="Dias em mercado"
              value={data.daysOnMarket != null ? String(data.daysOnMarket) : '—'}
              sub={p.createdAt ? `Desde ${datePT(p.createdAt)}` : undefined}
            />
            <Kpi label="Leads geradas" value={num(data.leads.total)} />
            <Kpi label="Pedidos de visita" value={num(data.visits.total)} />
            <Kpi label="Visitas realizadas" value={num(data.visits.completed)} />
          </div>
        </Section>

        {/* ── Funil ── */}
        {blocks.funnel ? (
          <Section title="Funil de conversão">
            <div className="space-y-2">
              {funnelStages.map((s, i) => {
                const prev = i > 0 ? funnelStages[i - 1].value : null
                const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null
                return (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-[120px] flex-none text-[11px] text-slate-500">{s.label}</div>
                    <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-slate-100">
                      <div
                        className="flex h-full items-center rounded-md px-2 text-[11px] font-semibold text-white"
                        style={{
                          width: `${Math.max(6, (s.value / funnelMax) * 100)}%`,
                          background: ACCENT,
                        }}
                      >
                        {num(s.value)}
                      </div>
                    </div>
                    <div className="w-[52px] flex-none text-right text-[10px] text-slate-400">
                      {conv != null ? `${conv}%` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        ) : null}

        {/* ── Campanhas Meta (sem nomes nem investimento) ── */}
        {showMeta ? (
          <Section title="Campanhas Meta">
            {(() => {
              const cards: [string, string][] = [
                ['Leads geradas', num(data.meta.totals.leads)],
              ]
              if (data.meta.totals.impressions > 0)
                cards.push(['Impressões', num(data.meta.totals.impressions)])
              if (data.meta.totals.clicks > 0)
                cards.push(['Cliques', num(data.meta.totals.clicks)])
              return (
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}
                >
                  {cards.map(([l, v]) => (
                    <Kpi key={l} label={l} value={v} />
                  ))}
                </div>
              )
            })()}
          </Section>
        ) : null}

        {/* ── Visitas ── */}
        {blocks.visits ? (
          <Section title="Detalhe de visitas">
            <div className="grid grid-cols-4 gap-3">
              <Kpi label="Agendadas" value={num(data.visits.scheduled)} />
              <Kpi label="Realizadas" value={num(data.visits.completed)} />
              <Kpi label="Não compareceu" value={num(data.visits.noShow)} />
              <Kpi label="Canceladas" value={num(data.visits.cancelled)} />
            </div>
            {data.interest.very_interested +
              data.interest.interested +
              data.interest.neutral +
              data.interest.not_interested >
            0 ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                  Muito interessados: {data.interest.very_interested}
                </span>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
                  Interessados: {data.interest.interested}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  Neutros: {data.interest.neutral}
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                  Sem interesse: {data.interest.not_interested}
                </span>
              </div>
            ) : null}
          </Section>
        ) : null}

        {/* ── Feedback agregado ── */}
        {showFeedback ? (
          <Section
            title="Feedback das visitas"
            hint={`${data.fichas.consideredCount} ficha(s) considerada(s)`}
          >
            {!data.fichas.meetsThreshold ? (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
                O feedback agregado fica disponível a partir de {data.fichas.threshold} fichas de
                visita (com consentimento de partilha). Atualmente há{' '}
                {data.fichas.consideredCount}.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                  {data.fichas.avgRatings
                    .filter((r) => r.key !== 'rating_overall')
                    .map((r) => (
                      <div key={r.key} className="flex items-center gap-3">
                        <div className="w-[120px] flex-none text-[11px] text-slate-500">
                          {r.label}
                        </div>
                        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${(r.avg / RATING_MAX) * 100}%`, background: GOLD }}
                          />
                        </div>
                        <div className="w-[34px] flex-none text-right text-[10px] font-medium text-slate-600">
                          {r.avg.toFixed(1)}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Kpi
                    label="Apreciação global"
                    value={
                      data.fichas.avgOverall != null
                        ? `${data.fichas.avgOverall.toFixed(1)}/${RATING_MAX}`
                        : '—'
                    }
                  />
                  <Kpi
                    label="Compraria o imóvel"
                    value={data.fichas.wouldBuyPct != null ? `${data.fichas.wouldBuyPct}%` : '—'}
                    sub={`${data.fichas.wouldBuyYes} sim · ${data.fichas.wouldBuyNo} não`}
                  />
                  <Kpi label="Valor percebido médio" value={eur(data.fichas.avgPerceivedValue)} />
                </div>

                {data.fichas.lowestDimension || data.fichas.highestDimension ? (
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                    {data.fichas.highestDimension ? (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                        Mais valorizado: {data.fichas.highestDimension.label} (
                        {data.fichas.highestDimension.avg.toFixed(1)})
                      </span>
                    ) : null}
                    {data.fichas.lowestDimension ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                        A melhorar: {data.fichas.lowestDimension.label} (
                        {data.fichas.lowestDimension.avg.toFixed(1)})
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </Section>
        ) : null}

        {/* ── Preço pedido vs. valor percebido ── */}
        {showPrice ? (
          <Section title="Preço pedido vs. valor percebido">
            {data.priceComparison.avgPerceivedValue == null ? (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
                O valor percebido médio fica disponível quando houver feedback de visitas
                suficiente (≥ {data.fichas.threshold} fichas consentidas).
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Preço pedido" value={eur(data.priceComparison.listingPrice)} />
                <Kpi
                  label="Valor percebido (média)"
                  value={eur(data.priceComparison.avgPerceivedValue)}
                />
                <Kpi
                  label="Diferença"
                  value={
                    data.priceComparison.deltaPct != null
                      ? `${data.priceComparison.deltaPct > 0 ? '+' : ''}${data.priceComparison.deltaPct}%`
                      : '—'
                  }
                  sub="percebido vs. pedido"
                />
              </div>
            )}
          </Section>
        ) : null}

        {/* ── Visualizações nos portais ── */}
        {blocks.portals ? (
          <Section title="Visualizações nos portais" hint="dados introduzidos manualmente">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PORTALS.map((p) => (
                <div
                  key={p.key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faviconUrl(p.domain)} alt="" className="h-6 w-6 flex-none rounded" />
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {p.label}
                    </div>
                    <div className="text-[18px] font-semibold leading-none text-slate-900">
                      {num(data.portalViews[p.key])}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-500">
              <span>Total de visualizações</span>
              <span className="text-[15px] font-semibold text-slate-900">
                {num(data.portalViews.total)}
              </span>
            </div>
          </Section>
        ) : null}

        {/* ── Nota do consultor ── */}
        {data.agentNote ? (
          <Section title="Nota do consultor">
            <p className="whitespace-pre-line rounded-lg bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
              {data.agentNote}
            </p>
          </Section>
        ) : null}

        {/* ── Rodapé ── */}
        <footer className="mt-8 border-t border-slate-200 pt-3 text-[9px] leading-snug text-slate-400">
          <p>
            Os dados de feedback são apresentados de forma agregada (médias) e apenas quando existe
            um número mínimo de fichas com consentimento de partilha, salvaguardando a privacidade
            dos visitantes (RGPD). Os valores de campanhas podem ser estimativas por rateio.
          </p>
          <p className="mt-1">
            Infinity Group · Relatório gerado automaticamente · {datePT(data.generatedAt)}
          </p>
        </footer>
      </div>
    </div>
  )
}
