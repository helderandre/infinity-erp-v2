'use client'

import { PageHero, EmptyState } from '@portal/components/portal/page-hero'
// Reuse the ERP ledger hook (maps to apps/app via the @/* alias). With no
// partner_id the API self-scopes to the logged-in partner, and the parceiros
// catch-all proxy forwards the request to the main ERP with auth cookies.
import { usePartnerLedger, formatEUR } from '@/hooks/use-partner-ledger'

function Section({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
        {action && <span className="text-xs font-medium text-neutral-400">{action}</span>}
      </div>
      {children}
    </section>
  )
}

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : ''

export default function PagamentosPage() {
  const { entries, summary, loading } = usePartnerLedger()

  const aReceber = entries.filter((e) => e.kind === 'commission' && e.status === 'pending')
  // History = pending commissions (a receber) + payments received. Paid
  // commissions are hidden because their payment row already shows the receipt
  // (avoids the same money appearing twice).
  const history = entries.filter((e) => !(e.kind === 'commission' && e.status === 'paid'))

  return (
    <div className="space-y-6">
      <PageHero
        title="Os meus ganhos"
        subtitle="Comissões de referência"
        kpis={[
          { label: 'Já recebido', value: summary ? formatEUR(summary.total_pago) : '—' },
          { label: 'A receber', value: summary ? formatEUR(summary.total_a_receber) : '—' },
        ]}
      />

      <Section title="A receber" action="comissões confirmadas por liquidar">
        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-400">A carregar…</p>
        ) : aReceber.length === 0 ? (
          <EmptyState title="Nada pendente" hint="As comissões confirmadas que aguardam pagamento aparecem aqui." />
        ) : (
          <ul className="divide-y divide-black/5">
            {aReceber.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">{e.description}</p>
                  <p className="text-xs text-neutral-400">{fmtDate(e.entry_date)}</p>
                </div>
                <span className="text-sm font-semibold text-amber-600">{formatEUR(Number(e.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Histórico" action="comissões e recebimentos">
        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-400">A carregar…</p>
        ) : history.length === 0 ? (
          <EmptyState title="Sem movimentos" hint="Comissões e recebimentos aparecem aqui." />
        ) : (
          <ul className="divide-y divide-black/5">
            {history.map((e) => {
              // From the partner's perspective everything here is money in their
              // favour. A "payment" is money they RECEIVED (a win), shown green
              // with a "+". A commission is money earned, pending or received.
              const isPayment = e.direction === 'debit'
              const status = isPayment
                ? 'Recebido'
                : e.status === 'paid'
                  ? 'Recebido'
                  : 'A receber'
              const green = isPayment || e.status === 'paid'
              return (
                <li key={e.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">{e.description}</p>
                    <p className="text-xs text-neutral-400">{fmtDate(e.entry_date)} · {status}</p>
                  </div>
                  <span className={green ? 'text-sm font-semibold text-emerald-600' : 'text-sm font-semibold text-amber-600'}>
                    +{formatEUR(Number(e.amount))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
