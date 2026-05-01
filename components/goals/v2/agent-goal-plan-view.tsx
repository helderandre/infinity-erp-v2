'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/hooks/use-user'
import { useAgentGoal } from '@/hooks/use-agent-goal'
import { AGENT_GOAL_DEFAULTS, type AgentGoalInput } from '@/types/agent-goal'
import { agentGoalSchema } from '@/lib/validations/agent-goal'
import { RatioInput } from './ratio-input'
import { ProjectionPanel } from './projection-panel'
import { toast } from 'sonner'
import { Save, Settings2, ShoppingCart, Tag } from 'lucide-react'

type FormTab = 'geral' | 'vendedores' | 'compradores'

function buildInitialState(year: number, agentId: string): AgentGoalInput {
  return {
    agent_id: agentId,
    period_year: year,
    annual_revenue_target_eur: 100_000,
    pct_vendedores: 50,
    pct_compradores: 50,
    ...AGENT_GOAL_DEFAULTS,
  }
}

export function AgentGoalPlanView() {
  const { user } = useUser()
  const year = new Date().getFullYear()
  const { goal, isLoading, save, isSaving } = useAgentGoal({ year, agentId: user?.id ?? null })

  const [form, setForm] = useState<AgentGoalInput | null>(null)
  const [tab, setTab] = useState<FormTab>('geral')

  // Hydrate form once user + remote goal are settled
  useEffect(() => {
    if (!user?.id) return
    if (form) return
    if (goal) {
      const { id: _id, created_at: _ca, updated_at: _ua, targets: _t, ...rest } = goal
      setForm(rest as AgentGoalInput)
    } else if (!isLoading) {
      setForm(buildInitialState(year, user.id))
    }
  }, [user?.id, goal, isLoading, form, year])

  function update<K extends keyof AgentGoalInput>(key: K, value: AgentGoalInput[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // Keep pct_vendedores + pct_compradores summing to 100
  function updateSplit(side: 'vend' | 'comp', value: number) {
    const clamped = Math.max(0, Math.min(100, value))
    setForm((prev) => {
      if (!prev) return prev
      if (side === 'vend') return { ...prev, pct_vendedores: clamped, pct_compradores: 100 - clamped }
      return { ...prev, pct_compradores: clamped, pct_vendedores: 100 - clamped }
    })
  }

  const validation = useMemo(() => {
    if (!form) return null
    return agentGoalSchema.safeParse(form)
  }, [form])

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
    } else {
      toast.error(result.error || 'Erro ao guardar')
    }
  }

  if (!user?.id || isLoading || !form) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* Form column */}
      <div className="lg:col-span-2 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as FormTab)} className="gap-4">
          <div className="flex items-center justify-between gap-3">
            <TabsList className="inline-flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 h-auto">
              <TabsTrigger
                value="geral"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Geral
              </TabsTrigger>
              <TabsTrigger
                value="vendedores"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Tag className="h-3.5 w-3.5" />
                Vendedores
              </TabsTrigger>
              <TabsTrigger
                value="compradores"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Compradores
              </TabsTrigger>
            </TabsList>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !validation?.success}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'A guardar…' : 'Guardar plano'}
            </Button>
          </div>

          {/* GERAL */}
          <TabsContent value="geral" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Objetivo anual</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="annual">Receita anual desejada (€)</Label>
                  <Input
                    id="annual"
                    type="number"
                    min={0}
                    step={1000}
                    value={form.annual_revenue_target_eur}
                    onChange={(e) => update('annual_revenue_target_eur', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="year">Ano</Label>
                  <Input id="year" type="number" value={form.period_year} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição vendedor / comprador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pct-vend">% Vendedores</Label>
                    <Input
                      id="pct-vend"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={form.pct_vendedores}
                      onChange={(e) => updateSplit('vend', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pct-comp">% Compradores</Label>
                    <Input
                      id="pct-comp"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={form.pct_compradores}
                      onChange={(e) => updateSplit('comp', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  A soma é mantida em 100% automaticamente.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ritmo de trabalho</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="weeks">Semanas de trabalho por ano</Label>
                  <Input
                    id="weeks"
                    type="number"
                    min={1}
                    max={52}
                    value={form.working_weeks_per_year}
                    onChange={(e) => update('working_weeks_per_year', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="days">Dias de trabalho por semana</Label>
                  <Input
                    id="days"
                    type="number"
                    min={1}
                    max={7}
                    value={form.working_days_per_week}
                    onChange={(e) => update('working_days_per_week', parseInt(e.target.value) || 1)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VENDEDORES */}
          <TabsContent value="vendedores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Economia do negócio (vendedor)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Valor médio de venda (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={form.vendedor_avg_sale_value_eur}
                    onChange={(e) => update('vendedor_avg_sale_value_eur', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Comissão (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.vendedor_commission_pct}
                    onChange={(e) => update('vendedor_commission_pct', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funil de Captação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <RatioInput
                  outputLabel="Pré-angariação"
                  inputLabel="contactos"
                  value={form.vend_contactos_per_pre_angariacao}
                  onChange={(v) => update('vend_contactos_per_pre_angariacao', v)}
                />
                <RatioInput
                  outputLabel="Estudo de Mercado"
                  inputLabel="pré-angariações"
                  value={form.vend_pre_angariacoes_per_estudo}
                  onChange={(v) => update('vend_pre_angariacoes_per_estudo', v)}
                />
                <RatioInput
                  outputLabel="Angariação"
                  inputLabel="estudos"
                  value={form.vend_estudos_per_angariacao}
                  onChange={(v) => update('vend_estudos_per_angariacao', v)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funil da Angariação ao Fecho</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <RatioInput
                  outputLabel="Escritura"
                  inputLabel="angariações"
                  value={form.vend_angariacoes_per_escritura}
                  onChange={(v) => update('vend_angariacoes_per_escritura', v)}
                />
                <RatioInput
                  outputLabel="Proposta"
                  inputLabel="visitas"
                  value={form.vend_visitas_per_proposta}
                  onChange={(v) => update('vend_visitas_per_proposta', v)}
                />
                <RatioInput
                  outputLabel="CPCV"
                  inputLabel="propostas"
                  value={form.vend_propostas_per_cpcv}
                  onChange={(v) => update('vend_propostas_per_cpcv', v)}
                />
                <p className="pt-1 text-[11px] text-muted-foreground">
                  CPCV → Escritura assume 95% (constante; ~5% perde-se em financiamento/legal).
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPRADORES */}
          <TabsContent value="compradores" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Economia do negócio (comprador)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Valor médio de compra (€)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={form.comp_avg_purchase_value_eur}
                    onChange={(e) => update('comp_avg_purchase_value_eur', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Comissão (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.comp_commission_pct}
                    onChange={(e) => update('comp_commission_pct', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Funil do comprador</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <RatioInput
                  outputLabel="Pesquisa"
                  inputLabel="contactos"
                  value={form.comp_contactos_per_pesquisa}
                  onChange={(v) => update('comp_contactos_per_pesquisa', v)}
                />
                <RatioInput
                  outputLabel="Visita"
                  inputLabel="pesquisas"
                  value={form.comp_pesquisas_per_visita}
                  onChange={(v) => update('comp_pesquisas_per_visita', v)}
                />
                <RatioInput
                  outputLabel="Proposta"
                  inputLabel="visitas"
                  value={form.comp_visitas_per_proposta}
                  onChange={(v) => update('comp_visitas_per_proposta', v)}
                />
                <RatioInput
                  outputLabel="CPCV"
                  inputLabel="propostas"
                  value={form.comp_propostas_per_cpcv}
                  onChange={(v) => update('comp_propostas_per_cpcv', v)}
                />
                <p className="pt-1 text-[11px] text-muted-foreground">
                  CPCV → Escritura assume 95% (constante; ~5% perde-se em financiamento/legal).
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Projection sidebar */}
      <div className="lg:col-span-1">
        <ProjectionPanel goal={form} />
      </div>
    </div>
  )
}
