'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Loader2, Sparkles, Database, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { goalBaseSchema, type CreateGoalInput } from '@/lib/validations/goal'
import { formatCurrency } from '@/lib/constants'
import type { ConsultantGoal } from '@/types/goal'

interface Suggestion {
  value: number
  source: 'data' | 'market_default'
  sample: number
}

interface Suggestions {
  sellers: {
    avg_sale_value: Suggestion
    avg_commission_pct: Suggestion
    pct_listings_sold: Suggestion
    pct_visit_to_listing: Suggestion
    pct_lead_to_visit: Suggestion
    avg_calls_per_lead: Suggestion
  }
  buyers: {
    avg_purchase_value: Suggestion
    avg_commission_pct: Suggestion
    close_rate: Suggestion
    pct_lead_to_qualified: Suggestion
    avg_calls_per_lead: Suggestion
  }
}

interface GoalConfigFormProps {
  consultants: { id: string; commercial_name: string }[]
  initialData?: ConsultantGoal
  goalId?: string
}

export function GoalConfigForm({ consultants, initialData, goalId }: GoalConfigFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
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
          sellers_pct_listings_sold: initialData.sellers_pct_listings_sold,
          sellers_pct_visit_to_listing: initialData.sellers_pct_visit_to_listing,
          sellers_pct_lead_to_visit: initialData.sellers_pct_lead_to_visit,
          sellers_avg_calls_per_lead: initialData.sellers_avg_calls_per_lead,
          buyers_avg_purchase_value: initialData.buyers_avg_purchase_value,
          buyers_avg_commission_pct: initialData.buyers_avg_commission_pct,
          buyers_close_rate: initialData.buyers_close_rate,
          buyers_pct_lead_to_qualified: initialData.buyers_pct_lead_to_qualified,
          buyers_avg_calls_per_lead: initialData.buyers_avg_calls_per_lead,
        }
      : {
          consultant_id: '',
          year: new Date().getFullYear(),
          annual_revenue_target: 0,
          pct_sellers: 50,
          pct_buyers: 50,
          working_weeks_year: 48,
          working_days_week: 5,
        },
  })

  const watchConsultantId = form.watch('consultant_id')
  const watchPctSellers = form.watch('pct_sellers')

  // Fetch suggestions when consultant changes
  const fetchSuggestions = useCallback(async (consultantId: string) => {
    if (!consultantId) return
    setLoadingSuggestions(true)
    try {
      const params = new URLSearchParams({ consultant_id: consultantId })
      const res = await fetch(`/api/goals/suggestions?${params}`)
      if (res.ok) {
        const data = await res.json()
        setSuggestions(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoadingSuggestions(false)
    }
  }, [])

  useEffect(() => {
    if (watchConsultantId) {
      fetchSuggestions(watchConsultantId)
    }
  }, [watchConsultantId, fetchSuggestions])

  // Also fetch on mount for edit mode
  useEffect(() => {
    if (initialData?.consultant_id) {
      fetchSuggestions(initialData.consultant_id)
    }
  }, [initialData?.consultant_id, fetchSuggestions])

  // Apply all suggestions at once
  function applyAllSuggestions() {
    if (!suggestions) return

    const s = suggestions
    const fields: [keyof CreateGoalInput, number][] = [
      ['sellers_avg_sale_value', s.sellers.avg_sale_value.value],
      ['sellers_avg_commission_pct', s.sellers.avg_commission_pct.value],
      ['sellers_pct_listings_sold', s.sellers.pct_listings_sold.value],
      ['sellers_pct_visit_to_listing', s.sellers.pct_visit_to_listing.value],
      ['sellers_pct_lead_to_visit', s.sellers.pct_lead_to_visit.value],
      ['sellers_avg_calls_per_lead', s.sellers.avg_calls_per_lead.value],
      ['buyers_avg_purchase_value', s.buyers.avg_purchase_value.value],
      ['buyers_avg_commission_pct', s.buyers.avg_commission_pct.value],
      ['buyers_close_rate', s.buyers.close_rate.value],
      ['buyers_pct_lead_to_qualified', s.buyers.pct_lead_to_qualified.value],
      ['buyers_avg_calls_per_lead', s.buyers.avg_calls_per_lead.value],
    ]

    for (const [field, value] of fields) {
      const current = form.getValues(field)
      if (current === null || current === undefined || current === 0) {
        form.setValue(field, value, { shouldDirty: true })
      }
    }

    toast.success('Sugestões aplicadas aos campos vazios')
  }

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
      router.push(`/dashboard/objetivos/${isEdit ? goalId : json.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar objetivo')
    } finally {
      setIsSubmitting(false)
    }
  }

  function SuggestionBadge({ suggestion, format = 'number' }: { suggestion: Suggestion | undefined; format?: 'number' | 'currency' | 'percent' }) {
    if (!suggestion) return null

    const isFromData = suggestion.source === 'data'
    const label = isFromData ? 'Dados reais' : 'Padrão do mercado'
    const Icon = isFromData ? Database : TrendingUp

    let displayValue: string
    if (format === 'currency') {
      displayValue = formatCurrency(suggestion.value)
    } else if (format === 'percent') {
      displayValue = `${suggestion.value}%`
    } else {
      displayValue = String(suggestion.value)
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`cursor-pointer text-xs ${isFromData ? 'border-emerald-500/30 text-emerald-600' : 'border-amber-500/30 text-amber-600'}`}
            >
              <Icon className="mr-1 h-3 w-3" />
              {displayValue}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}{isFromData ? ` (${suggestion.sample} registos)` : ''}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  function NumberFieldWithSuggestion({
    name,
    label,
    description,
    suffix,
    step = '1',
    suggestion,
    suggestFormat = 'number',
  }: {
    name: keyof CreateGoalInput
    label: string
    description?: string
    suffix?: string
    step?: string
    suggestion?: Suggestion
    suggestFormat?: 'number' | 'currency' | 'percent'
  }) {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>{label}</FormLabel>
              {suggestion && (
                <button
                  type="button"
                  onClick={() => form.setValue(name, suggestion.value, { shouldDirty: true })}
                >
                  <SuggestionBadge suggestion={suggestion} format={suggestFormat} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <FormControl>
                <Input
                  type="number"
                  step={step}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                />
              </FormControl>
              {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
            </div>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Base Config */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração Base</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {!isEdit && (
              <FormField
                control={form.control}
                name="consultant_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consultor</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar consultor..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {consultants.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <NumberFieldWithSuggestion name="year" label="Ano" />
            <NumberFieldWithSuggestion name="annual_revenue_target" label="Objetivo Anual de Faturação" suffix="€" step="100" />
            <NumberFieldWithSuggestion
              name="pct_sellers"
              label="% Vendedores"
              suffix="%"
              step="1"
            />
            <NumberFieldWithSuggestion
              name="pct_buyers"
              label="% Compradores"
              suffix="%"
              step="1"
              description={`Restante: ${100 - (watchPctSellers || 0)}%`}
            />
            <NumberFieldWithSuggestion name="working_weeks_year" label="Semanas Úteis / Ano" />
            <NumberFieldWithSuggestion name="working_days_week" label="Dias Úteis / Semana" />
          </CardContent>
        </Card>

        {/* Seller Funnel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Funil de Vendedores</CardTitle>
              <CardDescription className="mt-1">
                {suggestions ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <Sparkles className="h-3 w-3" />
                    Clique nos badges para aplicar sugestões individuais
                  </span>
                ) : loadingSuggestions ? (
                  <span className="flex items-center gap-1.5 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    A calcular sugestões...
                  </span>
                ) : (
                  'Selecione um consultor para ver sugestões baseadas nos dados'
                )}
              </CardDescription>
            </div>
            {suggestions && (
              <Button type="button" variant="outline" size="sm" onClick={applyAllSuggestions}>
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Aplicar Sugestões
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <NumberFieldWithSuggestion
              name="sellers_avg_sale_value"
              label="Valor Médio de Venda"
              suffix="€"
              step="1000"
              suggestion={suggestions?.sellers.avg_sale_value}
              suggestFormat="currency"
            />
            <NumberFieldWithSuggestion
              name="sellers_avg_commission_pct"
              label="Comissão Média"
              suffix="%"
              step="0.1"
              suggestion={suggestions?.sellers.avg_commission_pct}
              suggestFormat="percent"
            />
            <NumberFieldWithSuggestion
              name="sellers_pct_listings_sold"
              label="% Angariações Vendidas"
              suffix="%"
              step="1"
              suggestion={suggestions?.sellers.pct_listings_sold}
              suggestFormat="percent"
            />
            <NumberFieldWithSuggestion
              name="sellers_pct_visit_to_listing"
              label="% Visita → Angariação"
              suffix="%"
              step="1"
              suggestion={suggestions?.sellers.pct_visit_to_listing}
              suggestFormat="percent"
            />
            <NumberFieldWithSuggestion
              name="sellers_pct_lead_to_visit"
              label="% Lead → Visita"
              suffix="%"
              step="1"
              suggestion={suggestions?.sellers.pct_lead_to_visit}
              suggestFormat="percent"
            />
            <NumberFieldWithSuggestion
              name="sellers_avg_calls_per_lead"
              label="Chamadas por Lead"
              step="0.5"
              suggestion={suggestions?.sellers.avg_calls_per_lead}
            />
          </CardContent>
        </Card>

        {/* Buyer Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Funil de Compradores</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <NumberFieldWithSuggestion
              name="buyers_avg_purchase_value"
              label="Valor Médio de Compra"
              suffix="€"
              step="1000"
              suggestion={suggestions?.buyers.avg_purchase_value}
              suggestFormat="currency"
            />
            <NumberFieldWithSuggestion
              name="buyers_avg_commission_pct"
              label="Comissão Média"
              suffix="%"
              step="0.1"
              suggestion={suggestions?.buyers.avg_commission_pct}
              suggestFormat="percent"
            />
            <NumberFieldWithSuggestion
              name="buyers_close_rate"
              label="Taxa de Fecho"
              suffix="%"
              step="0.5"
              description="Ex: 16.67% = 1 em cada 6"
              suggestion={suggestions?.buyers.close_rate}
              suggestFormat="percent"
            />
            <NumberFieldWithSuggestion
              name="buyers_pct_lead_to_qualified"
              label="% Lead → Qualificado"
              suffix="%"
              step="1"
              suggestion={suggestions?.buyers.pct_lead_to_qualified}
              suggestFormat="percent"
            />
            <NumberFieldWithSuggestion
              name="buyers_avg_calls_per_lead"
              label="Chamadas por Lead"
              step="0.5"
              suggestion={suggestions?.buyers.avg_calls_per_lead}
            />
          </CardContent>
        </Card>

        {/* Legend */}
        {suggestions && (
          <div className="flex items-center gap-4 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-emerald-500" />
              <span>Dados reais — calculado a partir dos dados do sistema</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
              <span>Padrão do mercado — média do sector imobiliário em Portugal</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Guardar Alterações' : 'Criar Objetivo'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
