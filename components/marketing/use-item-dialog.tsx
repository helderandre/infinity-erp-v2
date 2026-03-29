'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { MarketingOrderItem } from '@/types/marketing'
import { MARKETING_TIME_SLOTS, MARKETING_CONTACT_RELATIONSHIPS, formatCurrency } from '@/lib/constants'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  MapPin, CalendarDays, Home, User, ChevronLeft, ChevronRight, Loader2, Send
} from 'lucide-react'

const PROPERTY_TYPES = [
  'Apartamento', 'Moradia', 'Loja', 'Terreno', 'Escritório', 'Armazém', 'Garagem', 'Outros'
]
const TYPOLOGIES = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+']

const useItemSchema = z.object({
  property_id: z.string().optional().nullable(),
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
  property_type: z.string().optional(),
  typology: z.string().optional(),
  area_m2: z.coerce.number().positive().optional().or(z.literal('')).or(z.literal(0)),
  has_exteriors: z.boolean().default(false),
  has_facades: z.boolean().default(false),
  is_occupied: z.boolean().default(false),
  is_staged: z.boolean().default(false),
  number_of_divisions: z.coerce.number().int().positive().optional().or(z.literal('')).or(z.literal(0)),
  parking_available: z.boolean().default(false),
  contact_is_agent: z.boolean().default(true),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_relationship: z.string().optional(),
  contact_observations: z.string().optional(),
})

type UseItemFormData = z.infer<typeof useItemSchema>

interface UseItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderItem: MarketingOrderItem | null
  propertyId?: string | null
  propertyData?: {
    address_street?: string | null
    postal_code?: string | null
    city?: string | null
    zone?: string | null
    property_type?: string | null
  } | null
  onUsed: () => void
}

const STEP_CONFIG = [
  { key: 'location', icon: MapPin, label: 'Morada', requiresProperty: true },
  { key: 'scheduling', icon: CalendarDays, label: 'Agendamento', requiresScheduling: true },
  { key: 'property', icon: Home, label: 'Imóvel', requiresProperty: true },
  { key: 'contact', icon: User, label: 'Contacto', requiresScheduling: true },
]

export function UseItemDialog({ open, onOpenChange, orderItem, propertyId, propertyData, onUsed }: UseItemDialogProps) {
  const catalogItem = orderItem?.catalog_item
  const requiresScheduling = catalogItem?.requires_scheduling ?? false
  const requiresProperty = catalogItem?.requires_property ?? false

  // If neither is required, we skip steps entirely and just submit
  const needsForm = requiresScheduling || requiresProperty

  const activeSteps = STEP_CONFIG.filter(step => {
    if (step.requiresProperty && !requiresProperty) return false
    if (step.requiresScheduling && !requiresScheduling) return false
    return true
  })

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [properties, setProperties] = useState<Array<{ id: string; title: string; address_street: string | null; postal_code: string | null; city: string | null; property_type: string | null; zone: string | null }>>([])

  const form = useForm<UseItemFormData>({
    resolver: zodResolver(useItemSchema) as any,
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

  // Pre-fill if coming from a property
  useEffect(() => {
    if (!open) return
    if (propertyId) {
      form.setValue('property_id', propertyId)
    }
    if (propertyData) {
      if (propertyData.address_street) form.setValue('address', propertyData.address_street)
      if (propertyData.postal_code) form.setValue('postal_code', propertyData.postal_code)
      if (propertyData.city) form.setValue('city', propertyData.city)
      if (propertyData.zone) form.setValue('parish', propertyData.zone)
      if (propertyData.property_type) form.setValue('property_type', propertyData.property_type)
    }
    setCurrentStepIdx(0)
  }, [open, propertyId, propertyData, form])

  // Load properties list
  useEffect(() => {
    if (!open || !requiresProperty || propertyId) return
    fetch('/api/properties?limit=200')
      .then(r => r.json())
      .then((data) => setProperties(Array.isArray(data) ? data : data.data || []))
      .catch(() => {})
  }, [open, requiresProperty, propertyId])

  // Auto-fill when property selected
  useEffect(() => {
    if (!watchPropertyId || watchPropertyId === 'manual' || propertyId) return
    const prop = properties.find(p => p.id === watchPropertyId)
    if (prop) {
      form.setValue('address', prop.address_street || '')
      form.setValue('postal_code', prop.postal_code || '')
      form.setValue('city', prop.city || '')
      form.setValue('parish', prop.zone || '')
      form.setValue('property_type', prop.property_type || '')
    }
  }, [watchPropertyId, properties, form, propertyId])

  const currentStep = activeSteps[currentStepIdx]
  const isLastStep = currentStepIdx === activeSteps.length - 1
  const isFirstStep = currentStepIdx === 0

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const formData = form.getValues()

      const body: any = {
        order_item_id: orderItem?.id,
        property_id: propertyId || (formData.property_id === 'manual' ? null : formData.property_id) || null,
      }

      if (requiresProperty) {
        body.address = formData.address || null
        body.postal_code = formData.postal_code || null
        body.city = formData.city || null
        body.parish = formData.parish || null
        body.floor_door = formData.floor_door || null
        body.access_instructions = formData.access_instructions || null
        body.property_type = formData.property_type || null
        body.typology = formData.typology || null
        body.area_m2 = formData.area_m2 ? Number(formData.area_m2) : null
        body.has_exteriors = formData.has_exteriors
        body.has_facades = formData.has_facades
        body.is_occupied = formData.is_occupied
        body.is_staged = formData.is_staged
        body.number_of_divisions = formData.number_of_divisions ? Number(formData.number_of_divisions) : null
        body.parking_available = formData.parking_available
      }

      if (requiresScheduling) {
        body.preferred_date = formData.preferred_date || null
        body.preferred_time = formData.preferred_time || null
        body.alternative_date = formData.alternative_date || null
        body.alternative_time = formData.alternative_time || null
        body.contact_is_agent = formData.contact_is_agent
        body.contact_name = formData.contact_name || null
        body.contact_phone = formData.contact_phone || null
        body.contact_relationship = formData.contact_relationship || null
        body.contact_observations = formData.contact_observations || null
      }

      const res = await fetch('/api/marketing/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar pedido')
      }

      toast.success('Pedido de marketing criado! A equipa será notificada.')
      onUsed()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao utilizar produto')
    } finally {
      setSubmitting(false)
    }
  }

  // If no form needed, submit immediately
  const handleUseDirectly = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/marketing/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_item_id: orderItem?.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar pedido')
      }
      toast.success('Pedido de marketing criado!')
      onUsed()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao utilizar produto')
    } finally {
      setSubmitting(false)
    }
  }

  if (!orderItem) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Utilizar: {orderItem.name}</DialogTitle>
          <DialogDescription>
            {needsForm
              ? 'Preencha os dados necessários para activar este serviço.'
              : 'Este serviço não requer dados adicionais.'}
          </DialogDescription>
        </DialogHeader>

        {!needsForm ? (
          <>
            <div className="py-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Clique em &quot;Confirmar&quot; para enviar o pedido à equipa de marketing.
              </p>
              <p className="font-medium">{orderItem.name}</p>
              <p className="text-sm text-muted-foreground">{formatCurrency(orderItem.price)}</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleUseDirectly} disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Confirmar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-1 py-2">
              {activeSteps.map((step, idx) => {
                const Icon = step.icon
                const isActive = idx === currentStepIdx
                const isDone = idx < currentStepIdx
                return (
                  <div key={step.key} className="flex items-center gap-1">
                    {idx > 0 && <div className={`w-8 h-px ${isDone ? 'bg-primary' : 'bg-muted'}`} />}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors
                      ${isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{step.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator />

            {/* Step: Location */}
            {currentStep?.key === 'location' && (
              <div className="space-y-4 py-2">
                {!propertyId && (
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

            {/* Step: Scheduling */}
            {currentStep?.key === 'scheduling' && (
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

            {/* Step: Property Details */}
            {currentStep?.key === 'property' && (
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

            {/* Step: Contact */}
            {currentStep?.key === 'contact' && (
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

            <Separator />

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStepIdx(prev => prev - 1)} disabled={isFirstStep}>
                <ChevronLeft className="mr-1 h-4 w-4" />Anterior
              </Button>
              {isLastStep ? (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Enviar Pedido
                </Button>
              ) : (
                <Button onClick={() => setCurrentStepIdx(prev => prev + 1)}>
                  Seguinte<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
