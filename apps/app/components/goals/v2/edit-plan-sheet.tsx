'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'
import { useAgentGoal } from '@/hooks/use-agent-goal'
import { AGENT_GOAL_DEFAULTS, type AgentGoalInput } from '@/types/agent-goal'
import { agentGoalSchema } from '@/lib/validations/agent-goal'
import { computeAgentGoalTargets } from '@/lib/goals/v2/compute-targets'
import { VendedorRatioFields, CompradorRatioFields } from './plan-ratio-fields'
import { MiniFunnelVendedor, MiniFunnelComprador } from './mini-funnel-preview'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatCurrency, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Save, Tag, ShoppingCart, SlidersHorizontal } from 'lucide-react'

type EditTab = 'distribuicao' | 'vendedores' | 'compradores'

interface EditPlanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Notify the parent so it can refetch / re-render with the new goal */
  onSaved?: () => void
}

function buildInitial(year: number, agentId: string): AgentGoalInput {
  return {
    agent_id: agentId,
    period_year: year,
    annual_revenue_target_eur: 100_000,
    pct_vendedores: 50,
    pct_compradores: 50,
    ...AGENT_GOAL_DEFAULTS,
  }
}

// Slightly more opaque card surface inside the translucent sheet, so the
// content feels grounded against the backdrop.
const SHEET_CARD = 'rounded-2xl border border-border/50 bg-background/70 supports-[backdrop-filter]:bg-background/55 backdrop-blur-md shadow-sm p-4'

export function EditPlanSheet({ open, onOpenChange, onSaved }: EditPlanSheetProps) {
  const { user } = useUser()
  const isMobile = useIsMobile()
  const year = new Date().getFullYear()
  const { goal, isLoading, save, isSaving } = useAgentGoal({
    year,
    agentId: user?.id ?? null,
  })

  const [form, setForm] = useState<AgentGoalInput | null>(null)
  const [tab, setTab] = useState<EditTab>('distribuicao')

  useEffect(() => {
    if (!open || !user?.id) return
    if (goal) {
      const { id: _id, created_at: _ca, updated_at: _ua, targets: _t, ...rest } = goal
      setForm(rest as AgentGoalInput)
    } else if (!isLoading) {
      setForm(buildInitial(year, user.id))
    }
  }, [open, user?.id, goal, isLoading, year])

  function update<K extends keyof AgentGoalInput>(key: K, value: AgentGoalInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function updateSplit(side: 'vend' | 'comp', value: number) {
    const clamped = Math.max(0, Math.min(100, value))
    setForm((prev) => {
      if (!prev) return prev
      if (side === 'vend') return { ...prev, pct_vendedores: clamped, pct_compradores: 100 - clamped }
      return { ...prev, pct_compradores: clamped, pct_vendedores: 100 - clamped }
    })
  }

  const targets = useMemo(() => (form ? computeAgentGoalTargets(form) : null), [form])
  const validation = useMemo(() => (form ? agentGoalSchema.safeParse(form) : null), [form])
  const weeks = form ? Math.max(1, form.working_weeks_per_year) : 48

  async function handleSave() {
    if (!form) return
    const parsed = agentGoalSchema.safeParse(form)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      toast.error(first?.message || 'Dados inválidos')
      return
    }
    const result = await save(parsed.data as AgentGoalInput)
    if (result.ok) {
      toast.success('Plano guardado')
      onSaved?.()
      onOpenChange(false)
    } else {
      toast.error(result.error || 'Erro ao guardar')
    }
  }

  const isReady = !!form && !!targets && !isLoading && !!user?.id

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[90dvh] rounded-t-3xl'
            : 'w-full data-[side=right]:sm:max-w-[640px] sm:rounded-l-3xl'
        )}
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 shrink-0 border-b border-border/30">
          <SheetTitle className="text-base font-medium">Editar plano</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Ajusta os teus rácios, valores médios e distribuição. Os volumes recalculam em tempo real.
          </p>
        </SheetHeader>

        {/* Tabs */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as EditTab)}>
            <TabsList className="grid w-full grid-cols-3 h-9 p-0.5 rounded-full bg-muted/50 border border-border/30">
              <TabsTrigger
                value="distribuicao"
                className="rounded-full text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <SlidersHorizontal className="h-3 w-3" />
                Distribuição
              </TabsTrigger>
              <TabsTrigger
                value="vendedores"
                className="rounded-full text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Tag className="h-3 w-3" />
                Vendedores
              </TabsTrigger>
              <TabsTrigger
                value="compradores"
                className="rounded-full text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <ShoppingCart className="h-3 w-3" />
                Compradores
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!isReady ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : (
            <>
              {tab === 'distribuicao' && (
                <div className="space-y-4">
                  <section className={cn(SHEET_CARD, 'space-y-3')}>
                    <SectionTitle>Objetivo anual</SectionTitle>
                    <div className="space-y-1">
                      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Receita anual desejada
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          value={form!.annual_revenue_target_eur}
                          onChange={(e) => update('annual_revenue_target_eur', parseFloat(e.target.value) || 0)}
                          className="pl-7 h-10 rounded-xl bg-background/80 border-border/50 font-semibold text-base"
                        />
                      </div>
                    </div>
                  </section>

                  <section className={cn(SHEET_CARD, 'space-y-3')}>
                    <SectionTitle>Distribuição vendedor / comprador</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          % Vendedores
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={form!.pct_vendedores}
                          onChange={(e) => updateSplit('vend', parseFloat(e.target.value) || 0)}
                          className="h-9 rounded-xl bg-background/80 border-border/50 text-center font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          % Compradores
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={form!.pct_compradores}
                          onChange={(e) => updateSplit('comp', parseFloat(e.target.value) || 0)}
                          className="h-9 rounded-xl bg-background/80 border-border/50 text-center font-semibold"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      A soma é mantida em 100% automaticamente.
                    </p>
                  </section>

                  <section className={cn(SHEET_CARD, 'space-y-3')}>
                    <SectionTitle>Ritmo de trabalho</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Semanas / ano
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          value={form!.working_weeks_per_year}
                          onChange={(e) => update('working_weeks_per_year', parseInt(e.target.value) || 1)}
                          className="h-9 rounded-xl bg-background/80 border-border/50 font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Dias / semana
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={7}
                          value={form!.working_days_per_week}
                          onChange={(e) => update('working_days_per_week', parseInt(e.target.value) || 1)}
                          className="h-9 rounded-xl bg-background/80 border-border/50 font-semibold"
                        />
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {tab === 'vendedores' && (
                <div className="space-y-4">
                  <section className={cn(SHEET_CARD, 'space-y-3')}>
                    <SectionTitle>Economia do negócio (vendedor)</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Valor médio de venda
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            value={form!.vendedor_avg_sale_value_eur}
                            onChange={(e) => update('vendedor_avg_sale_value_eur', parseFloat(e.target.value) || 0)}
                            className="pl-7 h-9 rounded-xl bg-background/80 border-border/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Comissão
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={form!.vendedor_commission_pct}
                            onChange={(e) => update('vendedor_commission_pct', parseFloat(e.target.value) || 0)}
                            className="pr-7 h-9 rounded-xl bg-background/80 border-border/50"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={cn(SHEET_CARD, 'space-y-2')}>
                    <SectionTitle>Rácios do funil</SectionTitle>
                    <VendedorRatioFields goal={form!} update={update} />
                  </section>

                  <section className={cn(SHEET_CARD, 'space-y-3')}>
                    <SectionTitle>Pré-visualização do funil</SectionTitle>
                    <MiniFunnelVendedor targets={targets!} weeks={weeks} />
                  </section>
                </div>
              )}

              {tab === 'compradores' && (
                <div className="space-y-4">
                  <section className={cn(SHEET_CARD, 'space-y-3')}>
                    <SectionTitle>Economia do negócio (comprador)</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Valor médio de compra
                        </Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            value={form!.comp_avg_purchase_value_eur}
                            onChange={(e) => update('comp_avg_purchase_value_eur', parseFloat(e.target.value) || 0)}
                            className="pl-7 h-9 rounded-xl bg-background/80 border-border/50"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          Comissão
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={form!.comp_commission_pct}
                            onChange={(e) => update('comp_commission_pct', parseFloat(e.target.value) || 0)}
                            className="pr-7 h-9 rounded-xl bg-background/80 border-border/50"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={cn(SHEET_CARD, 'space-y-2')}>
                    <SectionTitle>Rácios do funil</SectionTitle>
                    <CompradorRatioFields goal={form!} update={update} />
                  </section>

                  <section className={cn(SHEET_CARD, 'space-y-3')}>
                    <SectionTitle>Pré-visualização do funil</SectionTitle>
                    <MiniFunnelComprador targets={targets!} weeks={weeks} />
                  </section>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with live projection summary + save */}
        <SheetFooter className="px-6 py-4 flex-col gap-3 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md border-t border-border/30">
          {targets && (
            <div className="grid grid-cols-3 gap-2 w-full">
              <FooterStat label="Vendedor" value={formatCurrency(targets.vend_projected_revenue_eur)} />
              <FooterStat label="Comprador" value={formatCurrency(targets.comp_projected_revenue_eur)} />
              <FooterStat label="Total" value={formatCurrency(targets.total_projected_revenue_eur)} highlight />
            </div>
          )}
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-full"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !validation?.success}
              className="rounded-full gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'A guardar…' : 'Guardar'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  )
}

function FooterStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      'rounded-xl border px-3 py-2',
      highlight
        ? 'border-emerald-500/40 bg-emerald-50/60 supports-[backdrop-filter]:bg-emerald-50/40'
        : 'border-border/40 bg-background/60 supports-[backdrop-filter]:bg-background/40'
    )}>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-sm font-bold tabular-nums', highlight && 'text-emerald-900')}>{value}</div>
    </div>
  )
}
