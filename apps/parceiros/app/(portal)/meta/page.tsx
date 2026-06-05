import { PageHero, EmptyState } from '@portal/components/portal/page-hero'

export default function MetaPage() {
  // TODO: pull active campaigns (Meta Ads) attributed to this partner.
  const campaigns: { id: string; name: string; status: string; leads: number; spend: string }[] = []

  return (
    <div className="space-y-6">
      <PageHero
        title="Meta"
        subtitle="Campanhas activas e desempenho"
        kpis={[
          { label: 'Campanhas', value: campaigns.length },
          { label: 'Leads gerados', value: campaigns.reduce((n, c) => n + c.leads, 0) },
          { label: 'Activas', value: campaigns.filter((c) => c.status === 'active').length },
        ]}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title="Sem campanhas activas"
          hint="As campanhas Meta associadas ao parceiro aparecem aqui, com leads gerados e investimento."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">{c.name}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {c.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">{c.leads} leads</span>
                <span className="font-medium text-neutral-900">{c.spend}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
