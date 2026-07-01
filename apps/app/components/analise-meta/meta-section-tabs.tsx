'use client'

/**
 * CRM → Análise → Meta tab — espelha a secção standalone /dashboard/analise-meta
 * dentro do shell do CRM, com 3 sub-tabs:
 *
 *   Pedidos   — pipeline kanban dos pedidos de campanha aos parceiros
 *   Campanhas — grelha de campanhas Meta sincronizadas + drill-in inline
 *   Leads     — inbox de leads Meta (pesquisa, "Por atribuir", atribuição manual)
 *
 * Os pedidos vêm primeiro: são o que antecede uma campanha ao vivo.
 *
 * Filtros partilhados (Campanhas + Leads): intervalo de datas para todos; e,
 * só para gestão, um selector de consultor (consultores vêem sempre apenas os
 * seus dados, enforced server-side). Os pedidos não usam estes filtros.
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

import { CampaignRequestsBoard } from '@/components/analise-meta/campaign-requests-board'
import { MetaLeadsInboxView } from '@/components/analise-meta/meta-leads-inbox-view'
import { MetaPeriodSelect } from '@/components/analise-meta/meta-period-select'
import { MetaCampaignsView } from '@/components/leads/pipeline/meta-campaigns-view'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMetaSyncJob } from '@/hooks/use-meta-sync-job'
import { usePermissions } from '@/hooks/use-permissions'
import { useUser } from '@/hooks/use-user'
import { isManagementRole } from '@/lib/auth/roles'
import { presetToRange, type MetaDatePreset } from '@/lib/meta/date-range'
import { cn } from '@/lib/utils'

type SubTab = 'pedidos' | 'campanhas' | 'leads'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'pedidos', label: 'Pedidos' },
  { key: 'campanhas', label: 'Campanhas' },
  { key: 'leads', label: 'Leads' },
]

const ALL_CONSULTANTS = '__all__'

interface ConsultantOption {
  id: string
  commercial_name: string | null
}

export function MetaSectionTabs() {
  const [subTab, setSubTab] = useState<SubTab>('pedidos')
  const { hasPermission } = usePermissions()
  const { user } = useUser()
  const { trigger, running } = useMetaSyncJob()
  // Sincroniza campanhas + anúncios + leads + desempenho (gasto) numa só acção,
  // como o botão "Sincronizar leads" do Meta Ads. Método diferente (job em
  // background via mube), mas UX igual: um clique, corre em segundo plano, e a
  // página refresca quando termina. Só gestão (settings) — a route enforça também.
  const canSync = hasPermission('settings')
  const isManagement = isManagementRole(user?.role_names ?? [])

  // Shared filters for Campanhas + Leads. `period` is a preset or 'custom';
  // when custom, the range comes from the calendar instead of presetToRange.
  const [period, setPeriod] = useState<MetaDatePreset | 'custom'>('maximum')
  const [customRange, setCustomRange] = useState<{ from?: string; to?: string }>({})
  const [consultantId, setConsultantId] = useState<string>(ALL_CONSULTANTS)
  // Drill-in state lives in <MetaCampaignsView>; it reports back so we can hide
  // the shared filter row (the detail carries its own period selector top-right).
  const [campaignDetailOpen, setCampaignDetailOpen] = useState(false)
  const range = useMemo(
    () => (period === 'custom' ? customRange : presetToRange(period)),
    [period, customRange],
  )

  // Consultant options (management only) for the consultor filter.
  const [consultants, setConsultants] = useState<ConsultantOption[]>([])
  useEffect(() => {
    if (!isManagement) return
    let active = true
    fetch('/api/users/consultants')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ConsultantOption[]) => {
        if (active) setConsultants(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isManagement])

  // Hidden while a campaign detail is open — the detail has its own selector.
  const showFilters =
    (subTab === 'campanhas' && !campaignDetailOpen) || subTab === 'leads'
  const selectedConsultant = consultantId === ALL_CONSULTANTS ? null : consultantId

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="bg-background/50 supports-[backdrop-filter]:bg-background/40 inline-flex rounded-full border border-border/40 p-1 backdrop-blur-xl">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                subTab === t.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {canSync && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => trigger(['campaigns', 'ads', 'leads', 'insights'], null)}
            disabled={running}
            className={cn(
              'rounded-full gap-2',
              !running && 'border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/5 hover:text-[#1877F2]',
            )}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>{running ? 'A sincronizar…' : 'Sincronizar'}</span>
          </Button>
        )}
      </div>

      {/* Shared filters (Campanhas + Leads) */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3">
          <MetaPeriodSelect
            period={period}
            customRange={customRange}
            onPeriodChange={setPeriod}
            onCustomRangeChange={setCustomRange}
          />

          {/* Consultor filter — management only */}
          {isManagement && (
            <Select value={consultantId} onValueChange={setConsultantId}>
              <SelectTrigger className="w-[200px] rounded-lg">
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CONSULTANTS}>Todos os consultores</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.commercial_name ?? c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {subTab === 'pedidos' && <CampaignRequestsBoard />}
      {subTab === 'campanhas' && (
        <MetaCampaignsView
          key={`${range.from ?? ''}|${range.to ?? ''}|${selectedConsultant ?? ''}`}
          from={range.from}
          to={range.to}
          consultantId={selectedConsultant}
          onDetailOpenChange={setCampaignDetailOpen}
        />
      )}
      {subTab === 'leads' && (
        <MetaLeadsInboxView
          key={`${range.from ?? ''}|${range.to ?? ''}|${selectedConsultant ?? ''}`}
          from={range.from}
          to={range.to}
          consultantId={selectedConsultant}
        />
      )}
    </div>
  )
}
