'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Eye,
  FileText,
  Camera,
  Folder,
  Workflow,
  Euro,
} from 'lucide-react'

import {
  NegocioApresentacaoView,
  type NegocioApresentacaoData,
} from '@/components/negocios/detail/negocio-apresentacao-view'
import { ResumoTab } from '@/components/negocios/detail/tabs/resumo-tab'
import { MomentosTab } from '@/components/negocios/detail/tabs/momentos-tab'
import { DocumentosTab } from '@/components/negocios/detail/tabs/documentos-tab'
import { ProcessoTab } from '@/components/negocios/detail/tabs/processo-tab'
import { FinanceiroTab } from '@/components/negocios/detail/tabs/financeiro-tab'

type TabKey = 'apresentacao' | 'resumo' | 'momentos' | 'documentos' | 'processo' | 'financeiro'

const TABS: { key: TabKey; label: string; icon: typeof Eye }[] = [
  { key: 'apresentacao', label: 'Apresentação', icon: Eye },
  { key: 'resumo', label: 'Resumo', icon: FileText },
  { key: 'momentos', label: 'Momentos', icon: Camera },
  { key: 'documentos', label: 'Documentos', icon: Folder },
  { key: 'processo', label: 'Processo', icon: Workflow },
  { key: 'financeiro', label: 'Financeiro', icon: Euro },
]

interface NegocioBundle {
  negocio: {
    id: string
    tipo: string | null
    pipeline_stage_id: string | null
    pipeline_stage?: { id: string; name: string; color: string | null; pipeline_type: string } | null
    expected_value: number | null
    expected_close_date: string | null
    won_date: string | null
    lost_date: string | null
    lost_reason: string | null
    temperatura: string | null
    origem: string | null
    classe_imovel: string | null
    quartos: number | null
    area_m2: number | null
    orcamento: number | null
    orcamento_max: number | null
    financiamento_necessario: boolean | null
    credito_pre_aprovado: boolean | null
    valor_credito: number | null
    observacoes: string | null
    property_id: string | null
    assigned_consultant_id: string | null
    lead?: {
      id: string
      nome: string
      full_name: string | null
      email: string | null
      telemovel: string | null
      empresa: string | null
      nipc: string | null
    } | null
  }
  property: {
    id: string
    address_street: string | null
    city: string | null
  } | null
  consultant: {
    id: string
    commercial_name: string
    profile_photo_url: string | null
    email: string | null
    phone: string | null
  } | null
  deal: {
    id: string
    reference: string | null
    status: string | null
    deal_type: string | null
    deal_value: number | null
    deal_date: string | null
    commission_pct: number | null
    commission_total: number | null
    payment_structure: string | null
    contract_signing_date: string | null
    max_deadline: string | null
    proc_instance_id: string | null
    external_property_link?: string | null
    external_property_zone?: string | null
    external_property_typology?: string | null
  } | null
  payments: Array<{
    id: string
    payment_moment: string | null
    payment_pct: number | null
    amount: number | null
    network_amount: number | null
    agency_amount: number | null
    consultant_amount: number | null
    is_signed: boolean | null
    is_received: boolean | null
    signed_date: string | null
    received_date: string | null
  }>
  proc_instance: {
    id: string
    external_ref: string | null
    current_status: string | null
  } | null
  moments: Array<{
    id: string
    moment_type: 'cpcv' | 'escritura' | 'contrato_arrendamento' | 'entrega_chaves'
    photo_urls: string[]
    manual_caption: string | null
    ai_description: string | null
    created_at: string
  }>
}

export default function NegocioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialTab = (searchParams.get('tab') as TabKey) || 'apresentacao'
  const [activeTab, setActiveTab] = useState<TabKey>(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'apresentacao',
  )

  const [bundle, setBundle] = useState<NegocioBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setIsLoading(true)
      setError(null)
      try {
        // Fallback: se `id` é um deal_id (vem da listing), resolve para negocio_id primeiro
        let negocioId: string = id
        const probeRes = await fetch(`/api/negocios/${id}/related`)
        if (!probeRes.ok && probeRes.status === 404) {
          const dRes = await fetch(`/api/deals/${id}`)
          if (dRes.ok) {
            const dealData = await dRes.json()
            const candidate = dealData?.negocio_id ?? dealData?.data?.negocio_id
            if (candidate) {
              negocioId = candidate
              router.replace(
                `/dashboard/negocios/${negocioId}${searchParams.toString() ? `?${searchParams}` : ''}`,
                { scroll: false },
              )
            }
          }
        }

        const res = await fetch(`/api/negocios/${negocioId}/related`)
        if (!res.ok) throw new Error('Negócio não encontrado')
        const payload = await res.json()

        if (cancelled) return

        // Map joined consultant payload to flat shape
        const consRaw = (payload.negocio?.consultant ?? null) as
          | { id: string; commercial_name: string; professional_email: string | null;
              dev_consultant_profiles?: { profile_photo_url: string | null; phone_commercial: string | null } | { profile_photo_url: string | null; phone_commercial: string | null }[] | null }
          | null
        const consProfile = consRaw?.dev_consultant_profiles
          ? Array.isArray(consRaw.dev_consultant_profiles)
            ? consRaw.dev_consultant_profiles[0]
            : consRaw.dev_consultant_profiles
          : null
        const consultant: NegocioBundle['consultant'] = consRaw
          ? {
              id: consRaw.id,
              commercial_name: consRaw.commercial_name,
              profile_photo_url: consProfile?.profile_photo_url ?? null,
              email: consRaw.professional_email ?? null,
              phone: consProfile?.phone_commercial ?? null,
            }
          : null

        const propertyRaw = payload.negocio?.property ?? null
        const property = propertyRaw
          ? { id: propertyRaw.id, address_street: propertyRaw.address_street ?? null, city: propertyRaw.city ?? null }
          : null

        setBundle({
          negocio: payload.negocio,
          property,
          consultant,
          deal: payload.deal,
          payments: payload.payments ?? [],
          proc_instance: payload.proc_instance,
          moments: payload.moments ?? [],
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro a carregar negócio')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchAll()
    return () => {
      cancelled = true
    }
  }, [id, router, searchParams])

  // Sync tab in URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString())
    if (activeTab === 'apresentacao') next.delete('tab')
    else next.set('tab', activeTab)
    const qs = next.toString()
    router.replace(`?${qs}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Apresentação data + photos
  const apresentacaoData = useMemo<NegocioApresentacaoData | null>(() => {
    if (!bundle) return null
    const propAddr = bundle.property
      ? [bundle.property.address_street, bundle.property.city].filter(Boolean).join(', ') || null
      : null
    const leadName = bundle.negocio.lead?.full_name || bundle.negocio.lead?.nome || 'Sem lead'
    return {
      id: bundle.negocio.id,
      tipo: bundle.negocio.tipo,
      pipelineStageName: bundle.negocio.pipeline_stage?.name ?? null,
      pipelineStageColor: bundle.negocio.pipeline_stage?.color ?? null,
      temperatura: bundle.negocio.temperatura,
      isExternalProperty: !bundle.property && !!bundle.deal?.external_property_link,
      leadName,
      leadEmail: bundle.negocio.lead?.email ?? null,
      leadPhone: bundle.negocio.lead?.telemovel ?? null,
      propertyAddress: propAddr,
      externalPropertyTypology: bundle.deal?.external_property_typology ?? null,
      externalPropertyZone: bundle.deal?.external_property_zone ?? null,
      expectedValue: bundle.negocio.expected_value,
      expectedCloseDate: bundle.negocio.expected_close_date,
      origem: bundle.negocio.origem,
      classeImovel: bundle.negocio.classe_imovel,
      quartos: bundle.negocio.quartos,
      areaM2: bundle.negocio.area_m2,
      observacoes: bundle.negocio.observacoes,
      consultantId: bundle.consultant?.id ?? null,
      consultantName: bundle.consultant?.commercial_name ?? null,
      consultantPhotoUrl: bundle.consultant?.profile_photo_url ?? null,
      consultantEmail: bundle.consultant?.email ?? null,
      consultantPhone: bundle.consultant?.phone ?? null,
      dealValue: bundle.deal?.deal_value ?? null,
      dealCommissionPct: bundle.deal?.commission_pct ?? null,
      dealCommissionTotal: bundle.deal?.commission_total ?? null,
      dealStatus: bundle.deal?.status ?? null,
    }
  }, [bundle])

  const apresentacaoPhotos = useMemo(
    () =>
      bundle?.moments.flatMap((m) =>
        m.photo_urls.map((url) => ({ url, momentType: m.moment_type, caption: m.manual_caption || m.ai_description })),
      ) ?? [],
    [bundle?.moments],
  )

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

  if (error || !bundle || !apresentacaoData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm font-medium text-muted-foreground">{error ?? 'Negócio não encontrado'}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-3 text-xs underline hover:text-foreground transition-colors"
        >
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* ── Top bar: Voltar (left) + Tabs + Edit/Delete (right) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-2 sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="rounded-full h-9 gap-1.5 self-start"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </Button>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center justify-center gap-1 p-1 rounded-full bg-muted/50 border border-border/40 overflow-x-auto scrollbar-hide max-w-full">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  title={t.label}
                  aria-label={t.label}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5 h-8 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    isActive ? 'px-3.5 py-1.5' : 'w-8 sm:w-auto sm:px-3.5 sm:py-1.5',
                    isActive
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className={cn(isActive ? 'inline' : 'hidden sm:inline')}>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'apresentacao' && (
        <NegocioApresentacaoView
          data={apresentacaoData}
          photos={apresentacaoPhotos}
          onOpenMomentos={() => setActiveTab('momentos')}
        />
      )}

      {activeTab === 'resumo' && <ResumoTab negocio={bundle.negocio} />}

      {activeTab === 'momentos' && <MomentosTab dealId={bundle.deal?.id ?? null} />}

      {activeTab === 'documentos' && <DocumentosTab negocioId={bundle.negocio.id} />}

      {activeTab === 'processo' && (
        <ProcessoTab
          procInstanceId={bundle.proc_instance?.id ?? null}
          procExternalRef={bundle.proc_instance?.external_ref ?? null}
          procStatus={bundle.proc_instance?.current_status ?? null}
        />
      )}

      {activeTab === 'financeiro' && (
        <FinanceiroTab deal={bundle.deal} payments={bundle.payments} />
      )}
    </div>
  )
}
