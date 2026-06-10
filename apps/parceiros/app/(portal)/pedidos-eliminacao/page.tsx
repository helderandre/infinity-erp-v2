'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageHero, EmptyState } from '@portal/components/portal/page-hero'

interface DeletionRequest {
  id: string
  entity_type: 'lead' | 'negocio'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  reason: string | null
  snapshot: {
    name?: string | null
    email?: string | null
    phone?: string | null
    tipo?: string | null
    pipeline_type?: string | null
    expected_value?: number | null
  }
  created_at: string
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })

const entityLabel = (t: DeletionRequest['entity_type']) =>
  t === 'lead' ? 'Contacto' : 'Oportunidade'

export default function PedidosEliminacaoPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/deletion-requests?scope=partner&status=pending', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setRequests(json.requests ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    let notes: string | null = null
    if (action === 'reject') {
      notes = window.prompt('Motivo da recusa (opcional):') ?? null
    } else {
      if (!window.confirm('Confirma a eliminação? Esta acção é irreversível.')) return
    }
    setBusyId(id)
    try {
      const res = await fetch(`/api/deletion-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id))
      } else {
        const j = await res.json().catch(() => ({}))
        window.alert(j.error || 'Erro ao processar o pedido.')
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Pedidos de eliminação"
        subtitle="Aprove ou recuse a eliminação dos seus contactos e oportunidades"
        kpis={[{ label: 'Pendentes', value: String(requests.length) }]}
      />

      <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">
        {loading ? (
          <p className="py-6 text-center text-sm text-neutral-400">A carregar…</p>
        ) : requests.length === 0 ? (
          <EmptyState
            title="Sem pedidos pendentes"
            hint="Quando a equipa pedir para eliminar um contacto ou oportunidade que referenciou, aparece aqui para a sua aprovação."
          />
        ) : (
          <ul className="divide-y divide-black/5">
            {requests.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
                        {entityLabel(r.entity_type)}
                      </span>
                      <span className="text-xs text-neutral-400">{fmtDate(r.created_at)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-neutral-900">
                      {r.snapshot?.name || 'Sem nome'}
                    </p>
                    {r.reason && (
                      <p className="mt-0.5 text-xs text-neutral-500">Motivo: {r.reason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'reject')}
                      className="rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      Recusar
                    </button>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => decide(r.id, 'approve')}
                      className="rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Aprovar eliminação
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
