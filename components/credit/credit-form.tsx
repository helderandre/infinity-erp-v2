'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react'
import { createCreditRequestSchema } from '@/lib/validations/credit'
import {
  CIVIL_STATUS_OPTIONS,
  EMPLOYMENT_CONTRACT_OPTIONS,
  PROPERTY_PURPOSE_OPTIONS,
  RATE_TYPE_OPTIONS,
  CAPITAL_ORIGIN_OPTIONS,
} from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type CreditFormData = z.infer<typeof createCreditRequestSchema>

interface CreditFormProps {
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  isSubmitting: boolean
  leads?: { id: string; nome: string; email: string | null }[]
}

const STEPS = [
  { id: 'cliente', label: 'Cliente e Negócio' },
  { id: 'pessoal', label: 'Dados Pessoais' },
  { id: 'encargos', label: 'Encargos e Capital' },
  { id: 'credito', label: 'Crédito' },
  { id: 'consentimento', label: 'Consentimento' },
] as const

const STEP_FIELDS: Record<string, (keyof CreditFormData)[]> = {
  cliente: ['lead_id'],
  pessoal: ['data_nascimento_titular', 'estado_civil', 'numero_dependentes', 'rendimento_mensal_liquido', 'rendimento_anual_bruto', 'entidade_patronal', 'tipo_contrato_trabalho', 'antiguidade_emprego_meses'],
  encargos: ['encargos_creditos_existentes', 'encargos_cartoes', 'encargos_pensao_alimentos', 'outros_encargos', 'despesas_fixas_mensais', 'capital_proprio', 'origem_capital'],
  credito: ['imovel_valor_avaliacao', 'montante_solicitado', 'prazo_anos', 'tipo_taxa', 'imovel_finalidade'],
  consentimento: ['rgpd_consentimento'],
}

type Negocio = { id: string; tipo: string; localizacao?: string }
type Imovel = { id: string; title: string; listing_price?: number }

export function CreditForm({ onSubmit, isSubmitting, leads = [] }: CreditFormProps) {
  const [step, setStep] = useState(0)
  const [negocios, setNegocios] = useState<Negocio[]>([])
  const [imoveis, setImoveis] = useState<Imovel[]>([])

  const form = useForm<CreditFormData>({
    resolver: zodResolver(createCreditRequestSchema) as any,
    defaultValues: {
      numero_dependentes: 0, encargos_creditos_existentes: 0, encargos_cartoes: 0,
      encargos_pensao_alimentos: 0, outros_encargos: 0, despesas_fixas_mensais: 0,
      segundo_titular_encargos: 0, tem_segundo_titular: false, tem_fiador: false,
      tipo_taxa: 'variavel', rgpd_consentimento: false,
    },
  })

  const leadId = useWatch({ control: form.control, name: 'lead_id' })
  const temSegundoTitular = useWatch({ control: form.control, name: 'tem_segundo_titular' })
  const valorAvaliacao = useWatch({ control: form.control, name: 'imovel_valor_avaliacao' })
  const montanteSolicitado = useWatch({ control: form.control, name: 'montante_solicitado' })
  const rendimentoLiquido = useWatch({ control: form.control, name: 'rendimento_mensal_liquido' })
  const prazoAnos = useWatch({ control: form.control, name: 'prazo_anos' })

  useEffect(() => {
    if (!leadId) { setNegocios([]); return }
    fetch(`/api/negocios?lead_id=${leadId}`).then(r => r.json())
      .then(d => setNegocios(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => setNegocios([]))
  }, [leadId])

  useEffect(() => {
    fetch('/api/properties?limit=100').then(r => r.json())
      .then(d => setImoveis(Array.isArray(d) ? d : d.data ?? []))
      .catch(() => setImoveis([]))
  }, [])

  const ltv = useMemo(() => {
    if (!valorAvaliacao || !montanteSolicitado || valorAvaliacao <= 0) return null
    return (montanteSolicitado / valorAvaliacao) * 100
  }, [valorAvaliacao, montanteSolicitado])

  const taxaEsforco = useMemo(() => {
    if (!rendimentoLiquido || !montanteSolicitado || !prazoAnos || rendimentoLiquido <= 0) return null
    const prestacao = montanteSolicitado / (prazoAnos * 12)
    return (prestacao / rendimentoLiquido) * 100
  }, [rendimentoLiquido, montanteSolicitado, prazoAnos])

  const validateStep = useCallback(async () => {
    const fields = STEP_FIELDS[STEPS[step].id]
    if (!fields) return true
    return form.trigger(fields as (keyof CreditFormData)[])
  }, [step, form])

  const handleNext = useCallback(async () => {
    if (await validateStep()) setStep(s => Math.min(s + 1, STEPS.length - 1))
  }, [validateStep])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data as Record<string, unknown>)
  })

  const numField = (name: keyof CreditFormData, label: string, suffix?: string) => (
    <FormField control={form.control as any} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <div className="relative">
            <Input type="number" step="0.01" placeholder="0" {...field}
              value={field.value as string | number ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)} />
            {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{suffix}</span>}
          </div>
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  )

  const selectField = (name: keyof CreditFormData, label: string, options: readonly { value: string; label: string }[]) => (
    <FormField control={form.control as any} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={field.value as string ?? ''} onValueChange={field.onChange}>
          <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
          <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  )

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit}>
        <Tabs value={STEPS[step].id} onValueChange={v => setStep(STEPS.findIndex(s => s.id === v))}>
          <TabsList className="w-full grid grid-cols-5 mb-6">
            {STEPS.map((s, i) => (
              <TabsTrigger key={s.id} value={s.id} disabled={i > step} className="text-xs sm:text-sm">
                {i + 1}. {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Step 1 — Cliente e Negócio */}
          <TabsContent value="cliente">
            <Card><CardContent className="grid gap-4 pt-6">
              <FormField control={form.control as any} name="lead_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead / Cliente *</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar lead..." /></SelectTrigger></FormControl>
                    <SelectContent>{leads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}{l.email ? ` (${l.email})` : ''}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="negocio_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Negócio</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={!negocios.length}>
                    <FormControl><SelectTrigger><SelectValue placeholder={negocios.length ? 'Seleccionar negócio...' : 'Seleccione um lead primeiro'} /></SelectTrigger></FormControl>
                    <SelectContent>{negocios.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.tipo}{n.localizacao ? ` — ${n.localizacao}` : ''}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control as any} name="property_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Imóvel</FormLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar imóvel..." /></SelectTrigger></FormControl>
                    <SelectContent>{imoveis.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}{p.listing_price ? ` — ${p.listing_price.toLocaleString('pt-PT')} €` : ''}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent></Card>
          </TabsContent>

          {/* Step 2 — Dados Pessoais e Financeiros */}
          <TabsContent value="pessoal">
            <Card><CardContent className="space-y-6 pt-6">
              <h3 className="font-semibold text-base">Titular 1</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control as any} name="data_nascimento_titular" render={({ field }) => (
                  <FormItem><FormLabel>Data de Nascimento</FormLabel><FormControl>
                    <Input type="date" {...field} value={field.value ?? ''} />
                  </FormControl><FormMessage /></FormItem>
                )} />
                {selectField('estado_civil', 'Estado Civil', CIVIL_STATUS_OPTIONS)}
                {numField('numero_dependentes', 'N.º Dependentes')}
                {numField('rendimento_mensal_liquido', 'Rendimento Mensal Líquido', '€')}
                {numField('rendimento_anual_bruto', 'Rendimento Anual Bruto', '€')}
                <FormField control={form.control as any} name="entidade_patronal" render={({ field }) => (
                  <FormItem><FormLabel>Entidade Patronal</FormLabel><FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="Nome da empresa" />
                  </FormControl><FormMessage /></FormItem>
                )} />
                {selectField('tipo_contrato_trabalho', 'Tipo Contrato Trabalho', EMPLOYMENT_CONTRACT_OPTIONS)}
                {numField('antiguidade_emprego_meses', 'Antiguidade (meses)')}
                {numField('outros_rendimentos', 'Outros Rendimentos', '€')}
                <FormField control={form.control as any} name="fonte_outros_rendimentos" render={({ field }) => (
                  <FormItem><FormLabel>Fonte Outros Rendimentos</FormLabel><FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="Ex: rendas, pensão..." />
                  </FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control as any} name="tem_segundo_titular" render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 pt-2">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="font-medium">Tem 2.º titular</FormLabel>
                </FormItem>
              )} />
              {temSegundoTitular && (
                <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
                  <h3 className="font-semibold text-base sm:col-span-2">Titular 2</h3>
                  <FormField control={form.control as any} name="segundo_titular_nome" render={({ field }) => (
                    <FormItem><FormLabel>Nome</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control as any} name="segundo_titular_nif" render={({ field }) => (
                    <FormItem><FormLabel>NIF</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ''} maxLength={9} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control as any} name="segundo_titular_data_nascimento" render={({ field }) => (
                    <FormItem><FormLabel>Data de Nascimento</FormLabel><FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  {numField('segundo_titular_rendimento_liquido', 'Rendimento Líquido', '€')}
                  <FormField control={form.control as any} name="segundo_titular_entidade_patronal" render={({ field }) => (
                    <FormItem><FormLabel>Entidade Patronal</FormLabel><FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl><FormMessage /></FormItem>
                  )} />
                  {selectField('segundo_titular_tipo_contrato', 'Tipo Contrato', EMPLOYMENT_CONTRACT_OPTIONS)}
                  {numField('segundo_titular_encargos', 'Encargos Mensais', '€')}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* Step 3 — Encargos e Capital */}
          <TabsContent value="encargos">
            <Card><CardContent className="space-y-6 pt-6">
              <h3 className="font-semibold text-base">Encargos Mensais</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {numField('encargos_creditos_existentes', 'Créditos Existentes', '€')}
                {numField('encargos_cartoes', 'Cartões de Crédito', '€')}
                {numField('encargos_pensao_alimentos', 'Pensão de Alimentos', '€')}
                {numField('outros_encargos', 'Outros Encargos', '€')}
                {numField('despesas_fixas_mensais', 'Despesas Fixas Mensais', '€')}
              </div>
              <h3 className="font-semibold text-base pt-2">Capital Próprio</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {numField('capital_proprio', 'Valor Capital Próprio', '€')}
                {selectField('origem_capital', 'Origem do Capital', CAPITAL_ORIGIN_OPTIONS)}
              </div>
              <FormField control={form.control as any} name="tem_fiador" render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 pt-2">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="font-medium">Tem fiador</FormLabel>
                </FormItem>
              )} />
            </CardContent></Card>
          </TabsContent>

          {/* Step 4 — Crédito Pretendido */}
          <TabsContent value="credito">
            <Card><CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {numField('imovel_valor_avaliacao', 'Valor do Imóvel / Avaliação', '€')}
                {numField('montante_solicitado', 'Montante Solicitado', '€')}
                <FormField control={form.control as any} name="prazo_anos" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Prazo: {field.value ?? 30} anos</FormLabel>
                    <FormControl>
                      <Slider min={1} max={40} step={1} value={[field.value ?? 30]}
                        onValueChange={([v]) => field.onChange(v)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {selectField('tipo_taxa', 'Tipo de Taxa', RATE_TYPE_OPTIONS)}
                {selectField('imovel_finalidade', 'Finalidade do Imóvel', PROPERTY_PURPOSE_OPTIONS)}
              </div>
              {(ltv !== null || taxaEsforco !== null) && (
                <div className="grid gap-4 sm:grid-cols-2 pt-2">
                  {ltv !== null && (
                    <div className={`rounded-lg border p-4 ${ltv > 90 ? 'border-red-300 bg-red-50' : 'border-muted'}`}>
                      <p className="text-sm text-muted-foreground">LTV (Loan-to-Value)</p>
                      <p className={`text-2xl font-bold ${ltv > 90 ? 'text-red-600' : ''}`}>{ltv.toFixed(1)}%</p>
                      {ltv > 90 && <p className="text-xs text-red-600 flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />LTV superior a 90% — financiamento pouco provável</p>}
                    </div>
                  )}
                  {taxaEsforco !== null && (
                    <div className={`rounded-lg border p-4 ${taxaEsforco > 35 ? 'border-amber-300 bg-amber-50' : 'border-muted'}`}>
                      <p className="text-sm text-muted-foreground">Taxa de Esforço (estimada)</p>
                      <p className={`text-2xl font-bold ${taxaEsforco > 35 ? 'text-amber-600' : ''}`}>{taxaEsforco.toFixed(1)}%</p>
                      {taxaEsforco > 35 && <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><AlertTriangle className="h-3 w-3" />Taxa de esforço acima de 35% — pode ser recusado</p>}
                    </div>
                  )}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* Step 5 — Consentimento */}
          <TabsContent value="consentimento">
            <Card><CardContent className="space-y-6 pt-6">
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold">Resumo do Pedido</h3>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  <p>Lead: <span className="text-foreground font-medium">{leads.find(l => l.id === form.getValues('lead_id'))?.nome ?? '—'}</span></p>
                  {valorAvaliacao ? <p>Valor do imóvel: <span className="text-foreground font-medium">{valorAvaliacao.toLocaleString('pt-PT')} €</span></p> : null}
                  {montanteSolicitado ? <p>Montante solicitado: <span className="text-foreground font-medium">{montanteSolicitado.toLocaleString('pt-PT')} €</span></p> : null}
                  {prazoAnos ? <p>Prazo: <span className="text-foreground font-medium">{prazoAnos} anos</span></p> : null}
                  {ltv !== null ? <p>LTV: <span className="text-foreground font-medium">{ltv.toFixed(1)}%</span></p> : null}
                  {taxaEsforco !== null ? <p>Taxa de esforço estimada: <span className="text-foreground font-medium">{taxaEsforco.toFixed(1)}%</span></p> : null}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                <p>Ao submeter este pedido, autorizo a Infinity Group a recolher, tratar e partilhar os meus dados pessoais e financeiros
                  com instituições bancárias para efeitos de análise e concessão de crédito habitação, nos termos do Regulamento Geral
                  sobre a Protecção de Dados (RGPD). Os dados serão conservados durante o período necessário ao tratamento do pedido
                  e eliminados após a sua conclusão ou desistência.</p>
              </div>
              <FormField control={form.control as any} name="rgpd_consentimento" render={({ field }) => (
                <FormItem className="flex items-start gap-3 space-y-0">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <div>
                    <FormLabel className="font-medium">Li e aceito o tratamento dos meus dados pessoais *</FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )} />
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={handleNext}>
              Seguinte <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting || !form.getValues('rgpd_consentimento')}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Criar Pedido de Crédito
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
