'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'
import { useFunnelAggregates } from '@/hooks/use-funnel-aggregates'
import { useAgentGoal } from '@/hooks/use-agent-goal'
import { useAgentWeeklyReport } from '@/hooks/use-agent-weekly-report'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'
import {
  isoMondayOf, nextWeek, prevWeek, endOfWeek, ymd, parseYmd,
  isCurrentWeek, isFuture,
} from '@/lib/goals/v2/week-utils'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ChevronLeft, ChevronRight, Calendar, Save, Sparkles, Trophy, AlertTriangle, Target,
  Phone, Search, FileText, Tag, Eye, FileSignature, KeyRound, ShoppingCart, Plus,
} from 'lucide-react'
import type { FunnelStage, FunnelSide } from '@/types/funnel-event'
import { AddActivityDialog } from './add-activity-dialog'

// Picker lists exclude stages that are auto-only (see MANUAL_BLOCKED_STAGES).
const VENDEDOR_PICKER_STAGES = [
  { value: 'contacto' as FunnelStage, label: 'Contactos' },
  { value: 'estudo' as FunnelStage, label: 'Estudos de Mercado' },
  { value: 'visita' as FunnelStage, label: 'Visitas' },
  { value: 'proposta' as FunnelStage, label: 'Propostas' },
]

const COMPRADOR_PICKER_STAGES = [
  { value: 'contacto' as FunnelStage, label: 'Contactos' },
  { value: 'visita' as FunnelStage, label: 'Visitas' },
  { value: 'proposta' as FunnelStage, label: 'Propostas' },
]

const STAGE_META: Record<FunnelStage, { label: string; Icon: typeof Phone }> = {
  contacto:        { label: 'Contactos',          Icon: Phone },
  pre_angariacao:  { label: 'Pré-angariações',    Icon: Search },
  estudo:          { label: 'Estudos',            Icon: FileText },
  angariacao:      { label: 'Angariações',        Icon: Tag },
  pesquisa:        { label: 'Pesquisas',          Icon: Search },
  visita:          { label: 'Visitas',            Icon: Eye },
  proposta:        { label: 'Propostas',          Icon: FileSignature },
  cpcv:            { label: 'CPCVs',              Icon: KeyRound },
  fecho:           { label: 'Fechos',             Icon: KeyRound },
}

const VENDEDOR_STAGES: FunnelStage[] = [
  'contacto', 'pre_angariacao', 'estudo', 'angariacao',
  'visita', 'proposta', 'cpcv', 'fecho',
]
const COMPRADOR_STAGES: FunnelStage[] = [
  'contacto', 'pesquisa', 'visita', 'proposta', 'cpcv', 'fecho',
]

export function RelatorioSemanalView() {
  const { user } = useUser()
  const [monday, setMonday] = useState<Date>(() => isoMondayOf(new Date()))

  const weekStartStr = ymd(monday)
  const weekEndStr = ymd(endOfWeek(monday))
  const sinceIso = monday.toISOString()
  const untilIso = endOfWeek(monday).toISOString()

  const year = monday.getFullYear()
  const { goal } = useAgentGoal({ year, agentId: user?.id ?? null })
  const { data: aggregates, isLoading: aggLoading, refetch: refetchAggregates } = useFunnelAggregates({
    agentId: user?.id ?? null,
    since: sinceIso,
    until: untilIso,
    refetchKey: monday.getTime(),
  })

  // Default date for new entries: today when on the current week, else the
  // selected week's Monday — keeps freshly-added events inside the visible window.
  const isThisWeek = isCurrentWeek(monday)
  const defaultEntryDate = isThisWeek ? ymd(new Date()) : weekStartStr
  const {
    report, isLoading, save, isSaving, generateAi, isGenerating,
  } = useAgentWeeklyReport({ weekStart: weekStartStr, agentId: user?.id ?? null })

  // Local form state (synced when the loaded report changes)
  const [wins, setWins] = useState('')
  const [challenges, setChallenges] = useState('')
  const [next, setNext] = useState('')
  useEffect(() => {
    setWins(report?.notes_wins ?? '')
    setChallenges(report?.notes_challenges ?? '')
    setNext(report?.notes_next_week ?? '')
  }, [report?.id, report?.notes_wins, report?.notes_challenges, report?.notes_next_week])

  const targets = useMemo(() => {
    if (!goal) return null
    const { id: _id, created_at: _ca, updated_at: _ua, targets: _t, ...rest } = goal
    return computeAgentGoalTargets(rest as never)
  }, [goal])

  const weeks = goal?.working_weeks_per_year ?? 48
  const weeklyTarget = (annual: number) => annual / Math.max(1, weeks)

  async function handleSave() {
    const result = await save({
      notes_wins: wins.trim() || null,
      notes_challenges: challenges.trim() || null,
      notes_next_week: next.trim() || null,
    })
    if (result.ok) toast.success('Notas guardadas')
    else toast.error(result.error || 'Erro ao guardar')
  }

  async function handleGenerateAi() {
    const result = await generateAi()
    if (result.ok) toast.success('Análise gerada')
    else toast.error(result.error || 'Erro ao gerar análise')
  }

  function jumpThisWeek() {
    setMonday(isoMondayOf(new Date()))
  }
  function jumpPrev() { setMonday(prevWeek(monday)) }
  function jumpNext() {
    if (!isFuture(nextWeek(monday))) setMonday(nextWeek(monday))
  }

  const cantGoForward = isCurrentWeek(monday)
  const monthlyHeader = `${format(monday, "d 'de' MMMM", { locale: pt })} – ${format(endOfWeek(monday), "d 'de' MMMM", { locale: pt })}`

  return (
    <div className="space-y-4">
      {/* Week selector */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={jumpPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={jumpNext} disabled={cantGoForward}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {isThisWeek ? 'Esta semana' : 'Semana de'}
          </span>
          <span className="text-sm font-semibold capitalize tabular-nums">{monthlyHeader}</span>
        </div>
        <Button
          variant={isThisWeek ? 'secondary' : 'outline'}
          size="sm"
          className="rounded-full h-8 text-xs"
          onClick={jumpThisWeek}
          disabled={isThisWeek}
        >
          Esta semana
        </Button>
      </div>

      {/* Stats grid: per side, per stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SideStatsCard
          title="Vendedor"
          icon={Tag}
          side="vendedor"
          stages={VENDEDOR_STAGES}
          pickerStages={VENDEDOR_PICKER_STAGES}
          counts={aggregates?.counts.vendedor ?? {}}
          weeklyTargetFor={(stage) => {
            if (!targets) return 0
            const map: Partial<Record<FunnelStage, number>> = {
              contacto: weeklyTarget(targets.vend_target_contactos),
              pre_angariacao: weeklyTarget(targets.vend_target_pre_angariacoes),
              estudo: weeklyTarget(targets.vend_target_estudos),
              angariacao: weeklyTarget(targets.vend_target_angariacoes),
              visita: weeklyTarget(targets.vend_target_visitas),
              proposta: weeklyTarget(targets.vend_target_propostas),
              cpcv: weeklyTarget(targets.vend_target_cpcvs),
              fecho: weeklyTarget(targets.vend_target_escrituras),
            }
            return map[stage] ?? 0
          }}
          isLoading={aggLoading}
          defaultEntryDate={defaultEntryDate}
          onEntryAdded={refetchAggregates}
        />
        <SideStatsCard
          title="Comprador"
          icon={ShoppingCart}
          side="comprador"
          stages={COMPRADOR_STAGES}
          pickerStages={COMPRADOR_PICKER_STAGES}
          counts={aggregates?.counts.comprador ?? {}}
          weeklyTargetFor={(stage) => {
            if (!targets) return 0
            const map: Partial<Record<FunnelStage, number>> = {
              contacto: weeklyTarget(targets.comp_target_contactos),
              pesquisa: weeklyTarget(targets.comp_target_pesquisas),
              visita: weeklyTarget(targets.comp_target_visitas),
              proposta: weeklyTarget(targets.comp_target_propostas),
              cpcv: weeklyTarget(targets.comp_target_cpcvs),
              fecho: weeklyTarget(targets.comp_target_escrituras),
            }
            return map[stage] ?? 0
          }}
          isLoading={aggLoading}
          defaultEntryDate={defaultEntryDate}
          onEntryAdded={refetchAggregates}
        />
      </div>

      {/* Notes */}
      <section className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Reflexão da semana</h3>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="rounded-full h-7 text-xs gap-1"
          >
            <Save className="h-3 w-3" />
            {isSaving ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
        <NotesField
          icon={Trophy}
          color="text-emerald-600"
          label="Vitórias da semana"
          placeholder="O que correu bem? Que negócios avançaram?"
          value={wins}
          onChange={setWins}
          disabled={isLoading}
        />
        <NotesField
          icon={AlertTriangle}
          color="text-amber-600"
          label="Desafios"
          placeholder="O que foi mais difícil? Onde te bloqueaste?"
          value={challenges}
          onChange={setChallenges}
          disabled={isLoading}
        />
        <NotesField
          icon={Target}
          color="text-sky-600"
          label="Plano para a próxima semana"
          placeholder="Em que vais focar? Que ações vais priorizar?"
          value={next}
          onChange={setNext}
          disabled={isLoading}
        />
      </section>

      {/* AI assistant */}
      <section className="rounded-2xl border border-primary/30 bg-primary/5 supports-[backdrop-filter]:bg-primary/[0.04] backdrop-blur-sm p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Assistente IA</h3>
          </div>
          <Button
            size="sm"
            onClick={handleGenerateAi}
            disabled={isGenerating || isLoading}
            className="rounded-full h-7 text-xs gap-1"
          >
            <Sparkles className="h-3 w-3" />
            {isGenerating ? 'A analisar…' : (report?.ai_summary ? 'Re-analisar' : 'Analisar semana')}
          </Button>
        </div>

        {!report?.ai_summary && !isGenerating && (
          <p className="text-xs text-muted-foreground">
            Carrega em "Analisar semana" para receberes um resumo, pontos fortes, áreas de foco e dicas para a próxima semana — baseado nos teus dados reais e nas notas que escreveste acima.
          </p>
        )}

        {isGenerating && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
          </div>
        )}

        {report?.ai_summary && !isGenerating && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed">{report.ai_summary}</p>
            {report.ai_advice && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <AdviceBlock title="Pontos fortes" items={report.ai_advice.strengths ?? []} icon={Trophy} color="text-emerald-700" bg="bg-emerald-50/60 border-emerald-500/30" />
                <AdviceBlock title="Áreas de foco" items={report.ai_advice.focus_areas ?? []} icon={AlertTriangle} color="text-amber-700" bg="bg-amber-50/60 border-amber-500/30" />
                <AdviceBlock title="Dicas próx. semana" items={report.ai_advice.tips ?? []} icon={Target} color="text-sky-700" bg="bg-sky-50/60 border-sky-500/30" />
              </div>
            )}
            {report.ai_generated_at && (
              <p className="text-[10px] text-muted-foreground/70">
                Gerado em {format(parseYmd(report.ai_generated_at.slice(0, 10)), "d 'de' MMMM", { locale: pt })}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function SideStatsCard({
  title, icon: Icon, side, stages, pickerStages, counts, weeklyTargetFor, isLoading,
  defaultEntryDate, onEntryAdded,
}: {
  title: string
  icon: typeof Phone
  side: FunnelSide
  stages: FunnelStage[]
  pickerStages: { value: FunnelStage; label: string }[]
  counts: Partial<Record<FunnelStage, { total: number; manual: number }>>
  weeklyTargetFor: (s: FunnelStage) => number
  isLoading: boolean
  defaultEntryDate: string
  onEntryAdded: () => void
}) {
  return (
    <section className="rounded-2xl border border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-sm p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <AddActivityDialog
          side={side}
          stages={pickerStages}
          defaultDate={defaultEntryDate}
          onSuccess={onEntryAdded}
          trigger={
            <button
              type="button"
              aria-label="Adicionar atividade"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/40 bg-background/60 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          }
        />
      </div>
      <div className="space-y-1">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </>
        ) : (
          stages.map((stage) => {
            const c = counts[stage] ?? { total: 0, manual: 0 }
            const target = weeklyTargetFor(stage)
            const meta = STAGE_META[stage]
            const pct = target > 0 ? Math.min(100, (c.total / target) * 100) : 0
            return (
              <div key={stage} className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 hover:bg-background/40 transition-colors">
                <meta.Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs flex-1 truncate">{meta.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-1 w-12 overflow-hidden rounded-full bg-muted/30">
                    <div
                      className={cn('h-full', pct >= 100 ? 'bg-emerald-500' : 'bg-emerald-400/70')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-16 text-right">
                    <strong className="text-foreground">{c.total}</strong>
                    <span className="text-muted-foreground"> / {target.toFixed(1)}</span>
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

function NotesField({
  icon: Icon, color, label, placeholder, value, onChange, disabled,
}: {
  icon: typeof Phone
  color: string
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1">
      <div className={cn('flex items-center gap-1.5 text-[11px] uppercase tracking-wide', color)}>
        <Icon className="h-3 w-3" />
        <span className="font-medium">{label}</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="rounded-xl bg-background/60 border-border/40 resize-none text-sm"
      />
    </div>
  )
}

function AdviceBlock({
  title, items, icon: Icon, color, bg,
}: {
  title: string
  items: string[]
  icon: typeof Phone
  color: string
  bg: string
}) {
  return (
    <div className={cn('rounded-xl border backdrop-blur-sm px-3 py-2.5 space-y-1.5', bg)}>
      <div className={cn('flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold', color)}>
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground/70 italic">—</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-[11px] leading-snug text-foreground/90">
              · {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
