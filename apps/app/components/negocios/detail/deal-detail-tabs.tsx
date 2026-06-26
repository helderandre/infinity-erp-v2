'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Handshake, FileText, Camera, Folder, Workflow, Euro, ShieldCheck, Plus, Briefcase } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import {
  NegocioApresentacaoView,
  type NegocioApresentacaoData,
} from '@/components/negocios/detail/negocio-apresentacao-view'
import { ResumoTab } from '@/components/negocios/detail/tabs/resumo-tab'
import { MomentosTab } from '@/components/negocios/detail/tabs/momentos-tab'
import { DocumentosTab } from '@/components/negocios/detail/tabs/documentos-tab'
import { ProcessoTab } from '@/components/negocios/detail/tabs/processo-tab'
import { ImovelTab } from '@/components/negocios/detail/tabs/imovel-tab'
import { DealFinanceiroPanel } from '@/components/financial/deal-financeiro-panel'
import { DealComplianceTab } from '@/components/financial/deal-compliance-tab'
import { SurveyInviteCard } from '@/components/financial/survey-invite-card'
import { DealDialog } from '@/components/deals/deal-dialog'
import { Button } from '@/components/ui/button'
import type { NegocioBundle } from '@/hooks/use-deal-bundle'

type TabKey =
  | 'imovel'
  | 'apresentacao'
  | 'resumo'
  | 'momentos'
  | 'documentos'
  | 'processo'
  | 'financeiro'
  | 'compliance'

const TABS: { key: TabKey; label: string; icon: typeof Handshake }[] = [
  { key: 'imovel', label: 'Imóvel', icon: Building2 },
  { key: 'apresentacao', label: 'Fecho', icon: Handshake },
  { key: 'resumo', label: 'Resumo', icon: FileText },
  { key: 'momentos', label: 'Momentos', icon: Camera },
  { key: 'documentos', label: 'Documentos', icon: Folder },
  { key: 'processo', label: 'Processo', icon: Workflow },
  { key: 'financeiro', label: 'Financeiro', icon: Euro },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
]

const DEFAULT_TAB: TabKey = 'imovel'

/**
 * Shared rich deal/negócio detail tab set, rendered on BOTH
 * `/dashboard/negocios/[id]` (Negócios section) and
 * `/dashboard/financeiro/deals/[id]` (Financeiro section). Owns the tab bar,
 * the active-tab state and the `?tab=` URL sync. Negócio-scoped tabs (Resumo,
 * Documentos) show an empty state for deal-only bundles (`negocio === null`).
 */
export function DealDetailTabs({
  bundle,
  onRefetch,
}: {
  bundle: NegocioBundle
  /** Re-carrega o bundle (ex.: após criar o fecho na tab Financeiro). */
  onRefetch?: () => void
}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initial = (searchParams.get('tab') as TabKey) || DEFAULT_TAB
  const [activeTab, setActiveTab] = useState<TabKey>(
    TABS.some((t) => t.key === initial) ? initial : DEFAULT_TAB,
  )

  // Keep the active tab reflected in the URL (?tab=…), preserving the pathname.
  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString())
    if (activeTab === DEFAULT_TAB) next.delete('tab')
    else next.set('tab', activeTab)
    const qs = next.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const apresentacaoData = useMemo<NegocioApresentacaoData | null>(() => {
    const { negocio, deal, property, consultant } = bundle
    if (!negocio && !deal) return null
    const propAddr = property
      ? [property.address_street, property.city].filter(Boolean).join(', ') || null
      : null
    const leadName = negocio?.lead?.full_name || negocio?.lead?.nome || 'Sem lead'
    return {
      id: negocio?.id ?? deal?.id ?? '',
      tipo: negocio?.tipo ?? deal?.deal_type ?? null,
      pipelineStageName: negocio?.pipeline_stage?.name ?? null,
      pipelineStageColor: negocio?.pipeline_stage?.color ?? null,
      temperatura: negocio?.temperatura ?? null,
      isExternalProperty: !property && !!deal?.external_property_link,
      leadName,
      leadEmail: negocio?.lead?.email ?? null,
      leadPhone: negocio?.lead?.telemovel ?? null,
      propertyAddress: propAddr,
      externalPropertyTypology: deal?.external_property_typology ?? null,
      externalPropertyZone: deal?.external_property_zone ?? null,
      expectedValue: negocio?.expected_value ?? null,
      expectedCloseDate: negocio?.expected_close_date ?? null,
      origem: negocio?.origem ?? null,
      classeImovel: negocio?.classe_imovel ?? null,
      quartos: negocio?.quartos ?? null,
      areaM2: negocio?.area_m2 ?? null,
      observacoes: negocio?.observacoes ?? null,
      consultantId: consultant?.id ?? null,
      consultantName: consultant?.commercial_name ?? null,
      consultantPhotoUrl: consultant?.profile_photo_url ?? null,
      consultantEmail: consultant?.email ?? null,
      consultantPhone: consultant?.phone ?? null,
      dealValue: deal?.deal_value ?? null,
      dealCommissionPct: deal?.commission_pct ?? null,
      dealCommissionTotal: deal?.commission_total ?? null,
      dealStatus: deal?.status ?? null,
    }
  }, [bundle])

  const photos = useMemo(
    () =>
      bundle.moments.flatMap((m) =>
        m.photo_urls.map((url) => ({
          url,
          momentType: m.moment_type,
          caption: m.manual_caption || m.ai_description,
        })),
      ),
    [bundle.moments],
  )

  const { negocio, deal, property, proc_instance } = bundle

  return (
    <div className="space-y-4">
      {/* ── Tab bar ── */}
      <div className="flex items-center justify-center sm:justify-start">
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/40 overflow-x-auto scrollbar-hide max-w-full">
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

      {/* ── Tab content ── */}
      {activeTab === 'imovel' && <ImovelTab deal={deal} property={property} />}

      {activeTab === 'apresentacao' &&
        (apresentacaoData ? (
          <NegocioApresentacaoView
            data={apresentacaoData}
            photos={photos}
            onOpenMomentos={() => setActiveTab('momentos')}
          />
        ) : (
          <EmptyTab title="Sem dados de apresentação" />
        ))}

      {activeTab === 'resumo' &&
        (negocio ? (
          <ResumoTab negocio={negocio} />
        ) : (
          <EmptyTab
            title="Sem resumo"
            description="O resumo aparece quando o negócio está ligado a uma lead/oportunidade."
          />
        ))}

      {activeTab === 'momentos' &&
        (deal?.id ? (
          <MomentosTab dealId={deal.id} />
        ) : (
          <EmptyTab
            title="Sem momentos"
            description="Os momentos de marketing aparecem quando existe um deal associado."
          />
        ))}

      {activeTab === 'documentos' &&
        (negocio ? (
          <DocumentosTab negocioId={negocio.id} />
        ) : (
          <EmptyTab
            title="Sem documentos"
            description="Os documentos aparecem quando o negócio está ligado a uma lead/oportunidade."
          />
        ))}

      {activeTab === 'processo' && (
        <ProcessoTab
          procInstanceId={proc_instance?.id ?? deal?.proc_instance_id ?? null}
          procExternalRef={proc_instance?.external_ref ?? null}
          procStatus={proc_instance?.current_status ?? null}
        />
      )}

      {activeTab === 'financeiro' && (
        <FinanceiroSection
          deal={deal}
          negocio={negocio}
          property={property}
          onDealCreated={onRefetch}
        />
      )}

      {activeTab === 'compliance' &&
        (deal?.id ? (
          <div className="animate-in fade-in duration-200 space-y-5">
            <DealComplianceTab
              dealId={deal.id}
              dealValue={deal.deal_value ?? 0}
              dealDate={deal.deal_date ?? ''}
            />
            <SurveyInviteCard dealId={deal.id} dealStatus={deal.status ?? ''} />
          </div>
        ) : (
          <EmptyTab
            title="Sem compliance"
            description="A verificação de compliance aparece quando existe um deal associado."
          />
        ))}
    </div>
  )
}

/**
 * Tab Financeiro do fecho. Mostra o painel financeiro quando o deal está
 * ligado a esta oportunidade (via `deals.negocio_id`). Quando ainda não há
 * fecho mas existe negócio, oferece "Criar fecho" — abre o `<DealDialog>` com
 * o contexto do negócio (que grava o `negocio_id`), espelhando o `FechoTab` do
 * sheet de CRM. Sem isto, oportunidades sem fecho mostravam um beco sem saída
 * ("Sem deal financeiro") em vez de deixar o consultor ligar o financeiro.
 */
function FinanceiroSection({
  deal,
  negocio,
  property,
  onDealCreated,
}: {
  deal: NegocioBundle['deal']
  negocio: NegocioBundle['negocio']
  property: NegocioBundle['property']
  onDealCreated?: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)

  if (deal?.id) {
    return <DealFinanceiroPanel dealId={deal.id} />
  }

  // Sem negócio (bundle deal-only sem deal) — nada para ligar.
  if (!negocio) {
    return (
      <EmptyTab
        title="Sem deal financeiro"
        description="O lado financeiro aparece quando a oportunidade é submetida para fecho."
      />
    )
  }

  const leadName = negocio.lead?.full_name || negocio.lead?.nome || null
  const leadEmail = negocio.lead?.email ?? null
  const leadPhone = negocio.lead?.telemovel ?? null

  const propertyContext = property
    ? {
        id: property.id,
        title: property.title ?? 'Imóvel',
        external_ref: property.external_ref ?? null,
        listing_price: property.listing_price ?? null,
        city: property.city ?? null,
      }
    : undefined

  return (
    <div className="animate-in fade-in duration-200">
      <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex flex-col items-center text-center">
        <div className="h-11 w-11 rounded-full bg-muted text-muted-foreground flex items-center justify-center mb-3">
          <Briefcase className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">Sem fecho de negócio</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[340px]">
          O fecho regista o contrato e despacha as comissões. Cria o fecho para
          ligar o cronograma de pagamentos e o resumo financeiro a esta
          oportunidade.
        </p>
        <Button
          type="button"
          size="sm"
          className="rounded-full mt-4 gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Criar fecho
        </Button>
      </div>

      <DealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        negocioContext={{
          id: negocio.id,
          leadName,
          leadEmail,
          leadPhone,
        }}
        propertyContext={propertyContext}
        onComplete={() => {
          setCreateOpen(false)
          toast.success('Fecho criado')
          onDealCreated?.()
        }}
      />
    </div>
  )
}

function EmptyTab({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex items-start gap-3 animate-in fade-in duration-200">
      <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  )
}
