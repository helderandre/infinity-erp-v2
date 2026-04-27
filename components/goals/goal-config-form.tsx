'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Loader2, Key, Home, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { goalBaseSchema, type CreateGoalInput } from '@/lib/validations/goal'
import type { ConsultantGoal } from '@/types/goal'
import { BUYER_STAGES, SELLER_STAGES } from '@/lib/goals/funnel/stages'
import type { FunnelType, FunnelStageDef } from '@/types/funnel'
import { GoalQuickFill } from './goal-quick-fill'

interface GoalConfigFormProps {
  consultants: { id: string; commercial_name: string }[]
  initialData?: ConsultantGoal
  goalId?: string
  onSuccess?: (id: string) => void
  onCancel?: () => void
  enableQuickFill?: boolean
}

const QUICK_FILL_KEYS = new Set<keyof CreateGoalInput>([
  'consultant_id',
  'year',
  'annual_revenue_target',
  'pct_sellers',
  'pct_buyers',
  'working_weeks_year',
  'working_days_week',
  'sellers_avg_sale_value',
  'sellers_avg_commission_pct',
  'buyers_avg_purchase_value',
  'buyers_avg_commission_pct',
])

function buildDefaultRates(funnel: FunnelType): Record<string, number> {
  const stages = funnel === 'buyer' ? BUYER_STAGES : SELLER_STAGES
  const out: Record<string, number> = {}
  // Last stage has no "next" → we skip it
  for (let i = 0; i < stages.length - 1; i++) {
    out[stages[i].key] = stages[i].defaultConversionRate
  }
  return out
}

function buildInitialRates(
  initial: ConsultantGoal | undefined,
  funnel: FunnelType,
): Record<string, number> {
  const defaults = buildDefaultRates(funnel)
  const stored = initial?.funnel_conversion_rates?.[funnel]
  if (!stored) return defaults
  return { ...defaults, ...stored }
}

export function GoalConfigForm({
  consultants,
  initialData,
  goalId,
  onSuccess,
  onCancel,
  enableQuickFill,
}: GoalConfigFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'geral' | 'vendedores' | 'compradores'>('geral')
  const isEdit = !!goalId

  const form = useForm<CreateGoalInput>({
    resolver: zodResolver(goalBaseSchema),
    defaultValues: initialData
      ? {
          consultant_id: initialData.consultant_id,
          year: initialData.year,
          annual_revenue_target: initialData.annual_revenue_target,
          pct_sellers: initialData.pct_sellers,
          pct_buyers: initialData.pct_buyers,
          working_weeks_year: initialData.working_weeks_year,
          working_days_week: initialData.working_days_week,
          sellers_avg_sale_value: initialData.sellers_avg_sale_value,
          sellers_avg_commission_pct: initialData.sellers_avg_commission_pct,
          buyers_avg_purchase_value: initialData.buyers_avg_purchase_value,
          buyers_avg_commission_pct: initialData.buyers_avg_commission_pct,
          funnel_conversion_rates: {
            buyer: buildInitialRates(initialData, 'buyer'),
            seller: buildInitialRates(initialData, 'seller'),
          },
        }
      : {
          consultant_id: '',
          year: new Date().getFullYear(),
          annual_revenue_target: 0,
          pct_sellers: 50,
          pct_buyers: 50,
          working_weeks_year: 48,
          working_days_week: 5,
          sellers_avg_sale_value: null,
          sellers_avg_commission_pct: null,
          buyers_avg_purchase_value: null,
          buyers_avg_commission_pct: null,
          funnel_conversion_rates: {
            buyer: buildDefaultRates('buyer'),
            seller: buildDefaultRates('seller'),
          },
        },
  })

  const watchPctSellers = form.watch('pct_sellers')

  async function onSubmit(data: CreateGoalInput) {
    setIsSubmitting(true)
    try {
      const url = isEdit ? `/api/goals/${goalId}` : '/api/goals'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }

      const json = await res.json()
      toast.success(isEdit ? 'Objetivo atualizado com sucesso' : 'Objetivo criado com sucesso')
      const resolvedId = isEdit ? goalId! : json.id
      if (onSuccess) {
        onSuccess(resolvedId)
      } else {
        router.push(`/dashboard/objetivos/${resolvedId}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar objetivo')
    } finally {
      setIsSubmitting(false)
    }
  }

  function NumberField({
    name,
    label,
    suffix,
    step = '1',
    description,
  }: {
    name: keyof CreateGoalInput
    label: string
    suffix?: string
    step?: string
    description?: string
  }) {
    return (
      <FormField
        control={form.control}
        name={name as any}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
              {label}
            </FormLabel>
            <div className="flex items-center gap-2">
              <FormControl>
                <Input
                  type="number"
                  step={step}
                  className="rounded-xl bg-background/80 border-border/40 tabular-nums"
                  value={(field.value as number | string | null | undefined) ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value ? Number(e.target.value) : null)
                  }
                />
              </FormControl>
              {suffix && (
                <span className="text-xs text-muted-foreground font-medium tabular-nums">
                  {suffix}
                </span>
              )}
            </div>
            {description && (
              <FormDescription className="text-[11px]">{description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  function ConversionRow({
    funnel,
    stage,
    nextStage,
  }: {
    funnel: FunnelType
    stage: FunnelStageDef
    nextStage: FunnelStageDef
  }) {
    const fieldName = `funnel_conversion_rates.${funnel}.${stage.key}` as const
    return (
      <Controller
        control={form.control}
        name={fieldName as any}
        render={({ field }) => {
          const pctValue =
            field.value != null && field.value !== ''
              ? Math.round(Number(field.value) * 100)
              : ''
          const defaultPct = Math.round(stage.defaultConversionRate * 100)
          return (
            <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 backdrop-blur-sm px-3 py-2.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="text-xs font-medium tracking-tight truncate">
                  {stage.label}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <span className="text-xs font-medium tracking-tight truncate text-muted-foreground">
                  {nextStage.label}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={pctValue}
                  placeholder={String(defaultPct)}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '') {
                      field.onChange(null)
                    } else {
                      const num = Number(v)
                      field.onChange(Math.max(0, Math.min(100, num)) / 100)
                    }
                  }}
                  className="w-16 h-8 rounded-lg text-xs text-right tabular-nums bg-background/80 border-border/40"
                />
                <span className="text-xs text-muted-foreground font-medium">%</span>
              </div>
            </div>
          )
        }}
      />
    )
  }

  function FunnelTab({ funnel }: { funnel: FunnelType }) {
    const stages = funnel === 'buyer' ? BUYER_STAGES : SELLER_STAGES
    const isBuyer = funnel === 'buyer'
    return (
      <div className="space-y-5">
        {/* Economics card */}
        <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center ring-1',
                isBuyer
                  ? 'bg-amber-50 text-amber-700 ring-amber-200/60'
                  : 'bg-rose-50 text-rose-700 ring-rose-200/60',
              )}
            >
              {isBuyer ? <Key className="h-4 w-4" /> : <Home className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
                Economia do negócio
              </p>
              <p className="text-sm font-semibold tracking-tight">
                {isBuyer ? 'Funil Compradores · 6 etapas' : 'Funil Vendedores · 8 etapas'}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              name={isBuyer ? 'buyers_avg_purchase_value' : 'sellers_avg_sale_value'}
              label={isBuyer ? 'Valor médio de compra' : 'Valor médio de venda'}
              suffix="€"
              step="1000"
            />
            <NumberField
              name={isBuyer ? 'buyers_avg_commission_pct' : 'sellers_avg_commission_pct'}
              label="Comissão média"
              suffix="%"
              step="0.1"
            />
          </div>
        </div>

        {/* Conversion rates card */}
        <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-4 space-y-3">
          <div>
            <p className="text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
              Taxas de conversão
            </p>
            <p className="text-sm font-semibold tracking-tight">Etapa para a seguinte</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Quanto da etapa anterior chega à seguinte. Define o ritmo necessário para atingir o
              objectivo.
            </p>
          </div>
          <div className="space-y-1.5">
            {stages.slice(0, -1).map((stage, idx) => (
              <ConversionRow
                key={stage.key}
                funnel={funnel}
                stage={stage}
                nextStage={stages[idx + 1]}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const applyAiFields = (fields: Record<string, unknown>) => {
    for (const [rawKey, rawValue] of Object.entries(fields)) {
      if (rawValue === null || rawValue === undefined || rawValue === '') continue
      const key = rawKey as keyof CreateGoalInput
      if (!QUICK_FILL_KEYS.has(key)) continue

      if (key === 'consultant_id') {
        if (isEdit) continue
        const match = consultants.find((c) => c.id === rawValue)
        if (!match) continue
        form.setValue('consultant_id', match.id, { shouldValidate: true, shouldDirty: true })
        continue
      }

      const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue)
      if (Number.isFinite(numeric)) {
        form.setValue(key as any, numeric as any, { shouldValidate: true, shouldDirty: true })
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {enableQuickFill && <GoalQuickFill onApply={applyAiFields} />}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-5">
          <TabsList className="grid w-full grid-cols-3 rounded-full p-1 h-9 bg-muted/40 border border-border/40 backdrop-blur-sm">
            <TabsTrigger value="geral" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Geral
            </TabsTrigger>
            <TabsTrigger value="vendedores" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
              <Home className="h-3 w-3" />
              Vendedores
            </TabsTrigger>
            <TabsTrigger value="compradores" className="rounded-full text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5">
              <Key className="h-3 w-3" />
              Compradores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="space-y-5 mt-0">
            <div className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-sm p-4 space-y-4">
              <div>
                <p className="text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
                  Configuração base
                </p>
                <p className="text-sm font-semibold tracking-tight">
                  Objectivo anual e capacidade de trabalho
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {!isEdit && (
                  <FormField
                    control={form.control}
                    name="consultant_id"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
                          Consultor
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl bg-background/80 border-border/40">
                              <SelectValue placeholder="Selecionar consultor..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {consultants.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.commercial_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <NumberField name="year" label="Ano" />
                <NumberField
                  name="annual_revenue_target"
                  label="Objectivo anual de faturação"
                  suffix="€"
                  step="100"
                />
                <NumberField name="pct_sellers" label="% Vendedores" suffix="%" step="1" />
                <NumberField
                  name="pct_buyers"
                  label="% Compradores"
                  suffix="%"
                  step="1"
                  description={`Soma actual: ${(watchPctSellers || 0) + (form.watch('pct_buyers') || 0)}%`}
                />
                <NumberField name="working_weeks_year" label="Semanas úteis / ano" />
                <NumberField name="working_days_week" label="Dias úteis / semana" />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vendedores" className="mt-0">
            <FunnelTab funnel="seller" />
          </TabsContent>

          <TabsContent value="compradores" className="mt-0">
            <FunnelTab funnel="buyer" />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (onCancel ? onCancel() : router.back())}
            className="rounded-full h-9 text-xs"
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="rounded-full h-9 text-xs">
            {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Guardar Alterações' : 'Criar Objectivo'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
