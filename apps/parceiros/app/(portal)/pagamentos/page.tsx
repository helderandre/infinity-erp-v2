import { PageHero, EmptyState } from '@portal/components/portal/page-hero'

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

export default function PagamentosPage() {
  // TODO: pull referral commissions for this partner — paid vs pending — plus
  // issued invoices (faturas). Sourced from the referral payments + faturas.
  const aReceber: { id: string; ref: string; valor: string; data: string }[] = []
  const recebido: { id: string; ref: string; valor: string; data: string }[] = []
  const faturas: { id: string; numero: string; valor: string; estado: string }[] = []

  return (
    <div className="space-y-6">
      <PageHero
        title="Pagamentos"
        subtitle="Comissões de referência e faturação"
        kpis={[
          { label: 'Recebido', value: '0 €' },
          { label: 'A receber', value: '0 €' },
          { label: 'Faturas', value: faturas.length },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="A receber" action="comissões pendentes">
          {aReceber.length === 0 ? (
            <EmptyState title="Nada pendente" hint="As comissões de referências em curso aparecem aqui." />
          ) : (
            <ul className="divide-y divide-black/5">
              {aReceber.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{r.ref}</p>
                    <p className="text-xs text-neutral-400">{r.data}</p>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">{r.valor}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recebido" action="histórico">
          {recebido.length === 0 ? (
            <EmptyState title="Sem pagamentos" hint="As comissões já liquidadas aparecem aqui." />
          ) : (
            <ul className="divide-y divide-black/5">
              {recebido.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{r.ref}</p>
                    <p className="text-xs text-neutral-400">{r.data}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">{r.valor}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Faturas" action="emitidas">
        {faturas.length === 0 ? (
          <EmptyState title="Sem faturas" hint="As faturas emitidas ao parceiro aparecem aqui para download." />
        ) : (
          <ul className="divide-y divide-black/5">
            {faturas.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-900">Fatura {f.numero}</p>
                  <p className="text-xs text-neutral-400">{f.estado}</p>
                </div>
                <span className="text-sm font-semibold text-neutral-900">{f.valor}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
