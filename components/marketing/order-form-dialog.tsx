'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { MarketingCatalogItem, MarketingCatalogAddon, MarketingPack } from '@/types/marketing'
import { MARKETING_TIME_SLOTS, MARKETING_CONTACT_RELATIONSHIPS, formatCurrency } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  MapPin, CalendarDays, Home, User, ShoppingCart,
  ChevronLeft, ChevronRight, Loader2, AlertTriangle, Gift
} from 'lucide-react'

const PROPERTY_TYPES = [
  'Apartamento', 'Moradia', 'Loja', 'Terreno', 'Escritório', 'Armazém', 'Garagem', 'Outros'
]
const TYPOLOGIES = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+']

const orderFormSchema = z.object({
  address: z.string().optional(),
  postal_code: z.string().optional(),
  city: z.string().optional(),
  parish: z.string().optional(),
  floor_door: z.string().optional(),
  access_instructions: z.string().optional(),
  preferred_date: z.string().optional(),
  preferred_time: z.string().optional(),
  alternative_date: z.string().optional(),
  alternative_time: z.string().optional(),
  property_id: z.string().optional(),
  property_type: z.string().optional(),
  typology: z.string().optional(),
  area_m2: z.coerce.number().positive().optional().or(z.literal('')),
  has_exteriors: z.boolean().default(false),
  has_facades: z.boolean().default(false),
  is_occupied: z.boolean().default(false),
  is_staged: z.boolean().default(false),
  number_of_divisions: z.coerce.number().int().positive().optional().or(z.literal('')),
  parking_available: z.boolean().default(false),
  contact_is_agent: z.boolean().default(true),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_relationship: z.string().optional(),
  contact_observations: z.string().optional(),
})

type OrderFormData = z.infer<typeof orderFormSchema>

// Cart item types (shared with shop-tab)
interface CartServiceItem {
  type: 'service'
  service: MarketingCatalogItem
  selectedAddons: MarketingCatalogAddon[]
}

interface CartPackItem {
  type: 'pack'
  pack: MarketingPack
}

type CartItem = CartServiceItem | CartPackItem

interface OrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cartItems: CartItem[]
  onOrderPlaced: () => void
}

const STEP_ICONS = [MapPin, CalendarDays, Home, User, ShoppingCart]
const STEP_LABELS = ['Morada', 'Agendamento', 'Imóvel', 'Contacto', 'Resumo']

export function OrderFormDialog({ open, onOpenChange, cartItems, onOrderPlaced }: OrderFormDialogProps) {
  // Derive requirements from all cart items
  const requiresScheduling = cartItems.some(ci =>
    ci.type === 'service' ? ci.service.requires_scheduling : (ci.pack.items || []).some(i => i.requires_scheduling)
  )
  const requiresProperty = cartItems.some(ci =>
    ci.type === 'service' ? ci.service.requires_property : (ci.pack.items || []).some(i => i.requires_property)
  )

  const allSteps = [0, 1, 2, 3, 4]
  const activeSteps = allSteps.filter(step => {
    if (step === 0) return requiresScheduling || requiresProperty
    if (step === 1) return requiresScheduling
    if (step === 2) return requiresProperty
    if (step === 3) return requiresScheduling
    return true
  })

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [agentBalance, setAgentBalance] = useState<number | null>(null)
  const [properties, setProperties] = useState<Array<{ id: string; title: string; address_street: string | null; postal_code: string | null; city: string | null; property_type: string | null; zone: string | null }>>([])

  const currentStep = activeSteps[currentStepIdx]
  const isLastStep = currentStepIdx === activeSteps.length - 1
  const isFirstStep = currentStepIdx === 0

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema) as any,
    defaultValues: {
      contact_is_agent: true,
      has_exteriors: false,
      has_facades: false,
      is_occupied: false,
      is_staged: false,
      parking_available: false,
    },
  })

  const watchContactIsAgent = form.watch('contact_is_agent')
  const watchPropertyId = form.watch('property_id')

  useEffect(() => {
    if (!open) return
    fetch('/api/marketing/conta-corrente?summary=true')
      .then(r => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAgentBalance(data[0]?.current_balance ?? 0)
        }
      })
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open || !requiresProperty) return
    fetch('/api/properties?limit=200')
      .then(r => r.json())
      .then((data) => {
        setProperties(Array.isArray(data) ? data : data.data || [])
      })
      .catch(() => {})
  }, [open, requiresProperty])

  useEffect(() => {
    if (!watchPropertyId || watchPropertyId === 'manual') return
    const prop = properties.find(p => p.id === watchPropertyId)
    if (prop) {
      form.setValue('address', prop.address_street || '')
      form.setValue('postal_code', prop.postal_code || '')
      form.setValue('city', prop.city || '')
      form.setValue('parish', prop.zone || '')
      form.setValue('property_type', prop.property_type || '')
    }
  }, [watchPropertyId, properties, form])

  // Calculate total from all cart items
  const totalAmount = useMemo(() => {
    return cartItems.reduce((sum, ci) => {
      if (ci.type === 'service') {
        return sum + ci.service.price + ci.selectedAddons.reduce((s, a) => s + a.price, 0)
      }
      return sum + ci.pack.price
    }, 0)
  }, [cartItems])

  const balanceAfter = agentBalance !== null ? agentBalance - totalAmount : null

  const handleNext = () => { if (!isLastStep) setCurrentStepIdx(prev => prev + 1) }
  const handleBack = () => { if (!isFirstStep) setCurrentStepIdx(prev => prev - 1) }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const formData = form.getValues()

      // Build order items from cart
      const items: Array<{ catalog_item_id?: string; pack_id?: string; name: string; price: number }> = []

      for (const ci of cartItems) {
        if (ci.type === 'service') {
          items.push({ catalog_item_id: ci.service.id, name: ci.service.name, price: ci.service.price })
          for (const addon of ci.selectedAddons) {
            items.push({ catalog_item_id: ci.service.id, name: `${addon.name} (${ci.service.name})`, price: addon.price })
          }
        } else {
          items.push({ pack_id: ci.pack.id, name: ci.pack.name, price: ci.pack.price })
        }
      }

      const body = {
        ...formData,
        property_id: formData.property_id === 'manual' ? null : formData.property_id || null,
        area_m2: formData.area_m2 ? Number(formData.area_m2) : null,
        number_of_divisions: formData.number_of_divisions ? Number(formData.number_of_divisions) : null,
        items,
      }

      const res = await fetch('/api/marketing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar encomenda')
      }

      toast.success('Pedido criado com sucesso!')
      onOrderPlaced()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar pedido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Finalizar Pedido ({cartItems.length} {cartItems.length === 1 ? 'item' : 'itens'})
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-1 py-2">
          {activeSteps.map((step, idx) => {
            const Icon = STEP_ICONS[step]
            const isActive = idx === currentStepIdx
            const isDone = idx < currentStepIdx
            return (
              <div key={step} className="flex items-center gap-1">
                {idx > 0 && <div className={`w-8 h-px ${isDone ? 'bg-primary' : 'bg-muted'}`} />}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors
                    ${isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
                </div>
              </div>
            )
          })}
        </div>

        <Separator />

        {/* Step 0: Location */}
        {currentStep === 0 && (
          <div className="space-y-4 py-2">
            {requiresProperty && (
              <div className="space-y-2">
                <Label>Seleccionar imóvel</Label>
                <Select
                  value={watchPropertyId || 'manual'}
                  onValueChange={(v) => form.setValue('property_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher imóvel ou preencher manualmente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Preencher manualmente</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title} {p.city ? `— ${p.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Morada</Label>
                <Input {...form.register('address')} placeholder="Rua, número..." />
              </div>
              <div className="space-y-1.5">
                <Label>Código Postal</Label>
                <Input {...form.register('postal_code')} placeholder="0000-000" />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <Input {...form.register('city')} placeholder="Cidade" />
              </div>
              <div className="space-y-1.5">
                <Label>Freguesia</Label>
                <Input {...form.register('parish')} placeholder="Freguesia" />
              </div>
              <div className="space-y-1.5">
                <Label>Andar / Porta</Label>
                <Input {...form.register('floor_door')} placeholder="Ex: 3.º Esq." />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Instruções de Acesso</Label>
                <Textarea {...form.register('access_instructions')} placeholder="Tocar campainha 3B, código do portão 1234..." rows={2} />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Scheduling */}
        {currentStep === 1 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Indique as suas preferências de data. A equipa de marketing confirmará a data final.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Data Preferida</h4>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" {...form.register('preferred_date')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Período</Label>
                  <Select
                    value={form.watch('preferred_time') || ''}
                    onValueChange={(v) => form.setValue('preferred_time', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Escolher período" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARKETING_TIME_SLOTS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-medium">Data Alternativa</h4>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input type="date" {...form.register('alternative_date')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Período</Label>
                  <Select
                    value={form.watch('alternative_time') || ''}
                    onValueChange={(v) => form.setValue('alternative_time', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Escolher período" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARKETING_TIME_SLOTS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Property Details */}
        {currentStep === 2 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de Imóvel</Label>
                <Select
                  value={form.watch('property_type') || ''}
                  onValueChange={(v) => form.setValue('property_type', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipologia</Label>
                <Select
                  value={form.watch('typology') || ''}
                  onValueChange={(v) => form.setValue('typology', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Tipologia" /></SelectTrigger>
                  <SelectContent>
                    {TYPOLOGIES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Área (m²)</Label>
                <Input type="number" {...form.register('area_m2')} placeholder="120" />
              </div>
              <div className="space-y-1.5">
                <Label>N.º de Divisões</Label>
                <Input type="number" {...form.register('number_of_divisions')} placeholder="6" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'has_exteriors' as const, label: 'Tem Exteriores' },
                { name: 'has_facades' as const, label: 'Captar Fachadas' },
                { name: 'is_occupied' as const, label: 'Imóvel Ocupado' },
                { name: 'is_staged' as const, label: 'Imóvel Decorado/Staged' },
                { name: 'parking_available' as const, label: 'Estacionamento Disponível' },
              ].map(({ name, label }) => (
                <div key={name} className="flex items-center justify-between rounded-lg border p-3">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={form.watch(name)}
                    onCheckedChange={(v) => form.setValue(name, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Contact Person */}
        {currentStep === 3 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label className="text-sm">Eu vou estar presente</Label>
              <Switch
                checked={watchContactIsAgent}
                onCheckedChange={(v) => form.setValue('contact_is_agent', v)}
              />
            </div>

            {!watchContactIsAgent && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input {...form.register('contact_name')} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label>Telemóvel</Label>
                  <Input {...form.register('contact_phone')} placeholder="9XXXXXXXX" />
                </div>
                <div className="space-y-1.5">
                  <Label>Relação</Label>
                  <Select
                    value={form.watch('contact_relationship') || ''}
                    onValueChange={(v) => form.setValue('contact_relationship', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Relação" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARKETING_CONTACT_RELATIONSHIPS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Observações</Label>
                  <Textarea {...form.register('contact_observations')} placeholder="Proprietário só fala inglês, cão no imóvel..." rows={2} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Summary */}
        {currentStep === 4 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="font-medium text-sm">Itens do Pedido</h4>
              {cartItems.map((ci, idx) => (
                <div key={idx}>
                  {ci.type === 'service' ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>{ci.service.name}</span>
                        <span className="font-medium">{formatCurrency(ci.service.price)}</span>
                      </div>
                      {ci.selectedAddons.map((addon) => (
                        <div key={addon.id} className="flex justify-between text-sm pl-4">
                          <span className="text-muted-foreground">+ {addon.name}</span>
                          {addon.price === 0 ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Gift className="h-3 w-3" />Incluído
                            </Badge>
                          ) : (
                            <span className="font-medium">{formatCurrency(addon.price)}</span>
                          )}
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span>{ci.pack.name}</span>
                        <Badge variant="outline" className="text-[10px]">Pack</Badge>
                      </div>
                      <span className="font-medium">{formatCurrency(ci.pack.price)}</span>
                    </div>
                  )}
                  {idx < cartItems.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Balance impact */}
            {agentBalance !== null && (
              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-medium text-sm">Impacto na Conta Corrente</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo actual</span>
                  <span className={agentBalance < 0 ? 'text-red-600 font-medium' : ''}>
                    {formatCurrency(agentBalance)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Débito</span>
                  <span className="text-red-600">-{formatCurrency(totalAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-bold">
                  <span>Saldo após compra</span>
                  <span className={balanceAfter !== null && balanceAfter < 0 ? 'text-red-600' : 'text-emerald-600'}>
                    {balanceAfter !== null ? formatCurrency(balanceAfter) : '—'}
                  </span>
                </div>
                {balanceAfter !== null && balanceAfter < 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-md p-2 mt-1">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    O saldo ficará negativo. Este valor será deduzido nas próximas comissões.
                  </div>
                )}
              </div>
            )}

            {/* Form data summary */}
            {(requiresScheduling || requiresProperty) && (
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <h4 className="font-medium">Dados do Pedido</h4>
                {form.watch('address') && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Morada:</span>
                    <span>{form.watch('address')}, {form.watch('postal_code')} {form.watch('city')}</span>
                  </div>
                )}
                {form.watch('preferred_date') && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Data pref.:</span>
                    <span>{form.watch('preferred_date')} — {MARKETING_TIME_SLOTS[form.watch('preferred_time') as keyof typeof MARKETING_TIME_SLOTS] || ''}</span>
                  </div>
                )}
                {form.watch('alternative_date') && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Data alt.:</span>
                    <span>{form.watch('alternative_date')} — {MARKETING_TIME_SLOTS[form.watch('alternative_time') as keyof typeof MARKETING_TIME_SLOTS] || ''}</span>
                  </div>
                )}
                {form.watch('property_type') && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Imóvel:</span>
                    <span>{form.watch('property_type')} {form.watch('typology') || ''} — {form.watch('area_m2')}m²</span>
                  </div>
                )}
                {watchContactIsAgent ? (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Contacto:</span>
                    <span>Eu (consultor)</span>
                  </div>
                ) : form.watch('contact_name') ? (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Contacto:</span>
                    <span>{form.watch('contact_name')} — {form.watch('contact_phone')}</span>
                  </div>
                ) : null}
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Este valor será debitado da sua conta corrente e deduzido nas próximas comissões.
            </p>
          </div>
        )}

        <Separator />

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleBack} disabled={isFirstStep}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Anterior
          </Button>
          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              Confirmar Pedido
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Seguinte
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
