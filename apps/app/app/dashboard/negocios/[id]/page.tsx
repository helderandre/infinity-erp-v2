'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSmartBack } from '@/hooks/use-previous-pathname'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Pencil } from 'lucide-react'

import { useDealBundle } from '@/hooks/use-deal-bundle'
import { DealDetailTabs } from '@/components/negocios/detail/deal-detail-tabs'
import { EditNegocioSheet } from '@/components/negocios/edit-negocio-sheet'

export default function NegocioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const goBack = useSmartBack('/dashboard/negocios')

  const { bundle, isLoading, error, resolvedNegocioId, refetch } = useDealBundle(id)
  const [editOpen, setEditOpen] = useState(false)

  // Canonicalize the URL when `id` was a deal_id that resolved to a negocio_id,
  // so the page lives at /dashboard/negocios/{negocioId} (keeps the sidebar in
  // the Negócios section). Deal-only bundles (no negócio) keep the deal_id URL.
  useEffect(() => {
    if (resolvedNegocioId && resolvedNegocioId !== id) {
      const qs = searchParams.toString()
      router.replace(`/dashboard/negocios/${resolvedNegocioId}${qs ? `?${qs}` : ''}`, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedNegocioId, id])

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <Skeleton className="h-10 w-full max-w-md rounded-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-[420px] rounded-2xl lg:col-span-2" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !bundle) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-muted-foreground">{error ?? 'Oportunidade não encontrada'}</p>
        <button
          type="button"
          onClick={goBack}
          className="mt-3 text-xs underline hover:text-foreground transition-colors"
        >
          Voltar
        </button>
      </div>
    )
  }

  const negocio = bundle.negocio

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* ── Top bar: Voltar (left) + Editar (right) ── */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={goBack}
          className="rounded-full h-9 gap-1.5 self-start"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Button>

        {negocio && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="rounded-full h-9 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
        )}
      </div>

      {/* ── Rich tab set (shared with /dashboard/financeiro/deals/[id]) ── */}
      <DealDetailTabs bundle={bundle} onRefetch={() => void refetch({ silent: true })} />

      {negocio && (
        <EditNegocioSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          negocioId={negocio.id}
          initial={{
            assigned_consultant_id: negocio.assigned_consultant_id ?? null,
            expected_value: negocio.expected_value ?? null,
            expected_close_date: negocio.expected_close_date ?? null,
            temperatura: (negocio.temperatura as 'Frio' | 'Morno' | 'Quente' | null) ?? null,
            observacoes: negocio.observacoes ?? null,
          }}
          dealId={bundle.deal?.id ?? null}
          dealInitial={{
            deal_value: bundle.deal?.deal_value ?? null,
            commission_pct: bundle.deal?.commission_pct ?? null,
          }}
          onSaved={() => {
            void refetch({ silent: true })
          }}
        />
      )}
    </div>
  )
}
