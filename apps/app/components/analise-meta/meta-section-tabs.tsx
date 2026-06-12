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
import { CalendarDays, Loader2, RefreshCw } from 'lucide-react'
import { format, isValid, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { CampaignRequestsBoard } from '@/components/analise-meta/campaign-requests-board'
import { MetaLeadsInboxView } from '@/components/analise-meta/meta-leads-inbox-view'
import { MetaCampaignsView } from '@/components/leads/pipeline/meta-campaigns-view'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { META_DATE_PRESETS, presetToRange, type MetaDatePreset } from '@/lib/meta/date-range'
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
  const range = useMemo(
    () => (period === 'custom' ? customRange : presetToRange(period)),
    [period, customRange],
  )
  const customLabel = useMemo(() => {
    const f = customRange.from && isValid(parseISO(customRange.from)) ? parseISO(customRange.from) : null
    const t = customRange.to && isValid(parseISO(customRange.to)) ? parseISO(customRange.to) : null
    if (f && t) return `${format(f, 'dd MMM', { locale: pt })} – ${format(t, 'dd MMM yyyy', { locale: pt })}`
    if (f) return `Desde ${format(f, 'dd MMM yyyy', { locale: pt })}`
    return 'Escolher datas'
  }, [customRange])

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

  const showFilters = subTab === 'campanhas' || subTab === 'leads'
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
          {/* Date presets + custom range */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-muted p-0.5">
            <CalendarDays className="text-muted-foreground ml-2 mr-0.5 h-3.5 w-3.5 shrink-0" />
            {META_DATE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn(
                  'whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                  period === p.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPeriod('custom')}
              className={cn(
                'whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150',
                period === 'custom'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Personalizado
            </button>
          </div>

          {/* Custom range calendar */}
          {period === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs">
                  <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                  {customLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: customRange.from && isValid(parseISO(customRange.from)) ? parseISO(customRange.from) : undefined,
                    to: customRange.to && isValid(parseISO(customRange.to)) ? parseISO(customRange.to) : undefined,
                  }}
                  onSelect={(r) =>
                    setCustomRange({
                      from: r?.from ? format(r.from, 'yyyy-MM-dd') : undefined,
                      to: r?.to ? format(r.to, 'yyyy-MM-dd') : undefined,
                    })
                  }
                  locale={pt}
                  numberOfMonths={2}
                  captionLayout="dropdown"
                  fromYear={2020}
                  toYear={new Date().getFullYear() + 1}
                />
              </PopoverContent>
            </Popover>
          )}

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
