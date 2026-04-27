'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { MaskInput } from '@/components/ui/mask-input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/kibo-ui/spinner'
import { datePTMask, datePTtoISO, isoToDatePT } from '@/lib/masks'
import { PropertyAddressMapPicker } from './property-address-map-picker'
import {
  propertySchema,
} from '@/lib/validations/property'
import {
  PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_CONDITIONS, ENERGY_CERTIFICATES,
  PROPERTY_STATUS, CONTRACT_REGIMES, TYPOLOGIES, SOLAR_ORIENTATIONS, VIEWS,
  EQUIPMENT, FEATURES,
} from '@/lib/constants'
import {
  MapPin, Layers, Globe, ChevronRight, Check, ExternalLink,
  Home, Briefcase, Newspaper, Loader2, AlertCircle, Camera, Activity,
} from 'lucide-react'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { useUser } from '@/hooks/use-user'
import { ADMIN_ROLES, classifyMember } from '@/lib/auth/roles'
import { CalendarRichEditor } from '@/components/calendar/calendar-rich-editor'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'
import type {
  PropertyFormData, PropertySpecsFormData, PropertyInternalFormData,
} from '@/lib/validations/property'

const NONE_VALUE = '__none__'

const AMENITY_EMOJIS: Record<string, string> = {
  'Varanda': '🌸', 'Terraço': '☀️', 'Jardim': '🌻', 'Piscina': '🏊', 'Garagem': '🚗',
  'Arrecadação': '📦', 'Sótão': '🏠', 'Cave': '🏗️', 'Ginásio': '💪',
  'Condomínio Fechado': '🔒', 'Portaria': '🛡️', 'Cozinha Equipada': '🍳',
  'Mobilado': '🛋️', 'Suite': '🛏️',
  'Ar Condicionado': '❄️', 'Aquecimento Central': '🔥', 'Lareira': '🪵',
  'Painéis Solares': '♻️', 'Bomba de Calor': '🌡️', 'Vidros Duplos': '🪟',
  'Estores Eléctricos': '🔌', 'Alarme': '🚨', 'Vídeo Porteiro': '📹', 'Sistema de Rega': '💧',
  'Norte': '⬆️', 'Sul': '⬇️', 'Este': '➡️', 'Oeste': '⬅️', 'Nascente': '🌅', 'Poente': '🌇',
  'Mar': '🌊', 'Serra': '🏔️', 'Rio': '🏞️', 'Cidade': '🏙️', 'Campo': '🌾',
}

/* ───────── Combined form schema (mirrors PropertyForm + new fields) ───────── */

const formSchema = propertySchema.extend({
  typology: z.string().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  bathrooms: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  area_gross: z.coerce.number().positive().optional().or(z.literal('')),
  area_util: z.coerce.number().positive().optional().or(z.literal('')),
  construction_year: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 5).optional().or(z.literal('')),
  parking_spaces: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  garage_spaces: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  has_elevator: z.boolean().optional(),
  fronts_count: z.coerce.number().int().nonnegative().optional().or(z.literal('')),
  features: z.array(z.string()).optional(),
  solar_orientation: z.array(z.string()).optional(),
  views_list: z.array(z.string()).optional(),
  equipment_list: z.array(z.string()).optional(),
  storage_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  balcony_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  pool_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  attic_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  pantry_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  gym_area: z.coerce.number().nonnegative().optional().or(z.literal('')),
  internal_notes: z.string().optional(),
  commission_agreed: z.coerce.number().nonnegative().optional().or(z.literal('')),
  commission_type: z.string().optional(),
  contract_term: z.string().optional(),
  contract_expiry: z.string().optional(),
  imi_value: z.coerce.number().nonnegative().optional().or(z.literal('')),
  condominium_fee: z.coerce.number().nonnegative().optional().or(z.literal('')),
  cpcv_percentage: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  has_mortgage: z.boolean().optional(),
  mortgage_owed: z.coerce.number().nonnegative().optional().or(z.literal('')),
  use_license_number: z.string().optional(),
  use_license_date: z.string().optional(),
  use_license_issuer: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

function cleanNumber(v: unknown): number | undefined {
  if (v === '' || v === undefined || v === null) return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

/** Convert legacy markdown-style descriptions (**bold**, blank-line paragraphs)
 *  into the HTML the rich editor expects. If the value is already HTML
 *  (any opening tag detected), pass it through untouched. */
function descriptionToHtml(text: string | null | undefined): string {
  if (!text) return ''
  if (/<\w+[^>]*>/.test(text)) return text
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Bullet lines starting with "- " or "• " → list items grouped per run.
  const lines = withBold.split('\n')
  const out: string[] = []
  let listBuf: string[] = []
  const flushList = () => {
    if (listBuf.length === 0) return
    out.push('<ul>' + listBuf.map((l) => `<li>${l}</li>`).join('') + '</ul>')
    listBuf = []
  }
  let para: string[] = []
  const flushPara = () => {
    if (para.length === 0) return
    out.push(`<p>${para.join('<br/>')}</p>`)
    para = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushList()
      flushPara()
      continue
    }
    const m = line.match(/^[-•]\s+(.*)$/)
    if (m) {
      flushPara()
      listBuf.push(m[1])
    } else {
      flushList()
      para.push(line)
    }
  }
  flushList()
  flushPara()
  return out.join('')
}

/* ───────── Props ───────── */

export interface PropertyEditSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Property to edit. Null = the sheet is dormant. */
  propertyId: string | null
  /** Optional preloaded data so the sheet opens instant — fetched server-side
   *  by the caller. If omitted, the sheet fetches on open. */
  initialProperty?: PropertyFullData | null
  onSaved?: () => void
}

/** Shape we read from `/api/properties/[id]` (a join over the 3 tables). */
export interface PropertyFullData {
  id: string
  updated_at?: string | null
  title?: string | null
  description?: string | null
  property_type?: string | null
  business_type?: string | null
  listing_price?: number | null
  status?: string | null
  property_condition?: string | null
  energy_certificate?: string | null
  external_ref?: string | null
  consultant_id?: string | null
  consultant?: { commercial_name?: string | null } | null
  address_street?: string | null
  address_parish?: string | null
  postal_code?: string | null
  city?: string | null
  zone?: string | null
  latitude?: number | null
  longitude?: number | null
  contract_regime?: string | null
  // Apresentação / website
  show_on_website?: boolean
  presentation_show_staging?: boolean
  presentation_show_ai_plantas?: boolean
  link_portal_remax?: string | null
  link_portal_idealista?: string | null
  link_portal_imovirtual?: string | null
  link_portal_infinity?: string | null
  remax_published_date?: string | null
  remax_draft_number?: string | null
  notas_juridico_convictus?: string | null
  // Joined nested
  dev_property_specifications?: PropertySpecsFormData | null
  dev_property_internal?: Partial<PropertyInternalFormData> & {
    has_mortgage?: boolean | null
    mortgage_owed?: number | null
    use_license_number?: string | null
    use_license_date?: string | null
    use_license_issuer?: string | null
  } | null
}

/* ───────── Tabs ───────── */

const TABS = [
  { value: 'geral', label: 'Geral', icon: Home },
  { value: 'localizacao', label: 'Localização', icon: MapPin },
  { value: 'especificacoes', label: 'Especs', icon: Layers },
  { value: 'contrato', label: 'Contrato', icon: Briefcase },
  { value: 'apresentacao', label: 'Apresentação', icon: Newspaper },
] as const

type TabValue = typeof TABS[number]['value']

/* ───────── Component ───────── */

export function PropertyEditSheet({
  open, onOpenChange, propertyId, initialProperty, onSaved,
}: PropertyEditSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const [property, setProperty] = useState<PropertyFullData | null>(initialProperty ?? null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [tab, setTab] = useState<TabValue>('geral')
  const [consultants, setConsultants] = useState<{ id: string; commercial_name: string }[]>([])
  // Gate that prevents the form from rendering until form.reset has populated
  // the field values from the loaded property. Without this, Select components
  // mount with empty values and Radix sometimes won't update the trigger when
  // the value flips later — leaving the user staring at "Seleccione..." even
  // though field.value already holds the saved value.
  const [isFormReady, setIsFormReady] = useState(false)

  // Management gate: only brokers/admin/staff see the Estado + Apresentação
  // quick controls. Consultores see the regular form fields only.
  const roleName = user?.role?.name
  const isManagement =
    classifyMember(roleName) === 'staff' ||
    ADMIN_ROLES.some((r) => r.toLowerCase() === roleName?.toLowerCase())

  /* Load consultors once */
  useEffect(() => {
    fetch('/api/consultants?per_page=100&status=active&include_brokers=true')
      .then((r) => r.json())
      .then((d) => setConsultants(d.data || []))
      .catch(() => {})
  }, [])

  /* Fetch property when opening (unless preloaded) */
  useEffect(() => {
    if (!open || !propertyId) return
    if (initialProperty && initialProperty.id === propertyId) {
      setProperty(initialProperty)
      return
    }
    let cancelled = false
    setLoading(true)
    fetch(`/api/properties/${propertyId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setProperty(data) })
      .catch(() => { if (!cancelled) setProperty(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, propertyId, initialProperty])

  /* Reset tab on close */
  useEffect(() => {
    if (!open) setTab('geral')
  }, [open])

  /* Build defaults from the loaded property — memoized so the form's `values`
   *  prop only changes when `property` itself changes (otherwise react-hook-form
   *  re-syncs on every render and overrides the user's in-flight edits). */
  const defaultValues = useMemo<Partial<FormValues>>(
    () => property
      ? buildDefaults(property)
      : { has_elevator: false, features: [], solar_orientation: [], views_list: [], equipment_list: [] },
    [property],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: defaultValues as any,
  })

  /* Explicitly reset the form whenever the property reference changes — using
   *  `values` on `useForm` proved to be brittle here (the Select trigger could
   *  show "Não atribuído" while the underlying form value was already the
   *  consultant_id, depending on render timing). `form.reset(...)` is the
   *  blessed way to push fresh data into all field controllers in one go.
   *  The `isFormReady` flag is flipped to true only after the reset commits,
   *  so children render with the correct field values from their first mount
   *  (preventing Select triggers from sticking on the placeholder). */
  useEffect(() => {
    setIsFormReady(false)
  }, [property?.id])

  useEffect(() => {
    if (property) {
      form.reset(buildDefaults(property))
      setIsFormReady(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id, property?.updated_at])

  /* Make sure the property's currently-assigned consultant is always in the
   *  dropdown — the /api/consultants endpoint filters by status=active, so an
   *  ex-consultant assigned to an old property would otherwise leave the Select
   *  showing a placeholder instead of the name. */
  const consultantsWithAssigned = useMemo(() => {
    const list = consultants.slice()
    const assignedId = property?.consultant_id
    const assignedName = property?.consultant?.commercial_name ?? null
    if (assignedId && assignedName && !list.some((c) => c.id === assignedId)) {
      list.unshift({ id: assignedId, commercial_name: `${assignedName} (inactivo)` })
    }
    return list
  }, [consultants, property?.consultant_id, property?.consultant?.commercial_name])

  const status = form.watch('status')
  const isPending = status === 'pending_approval'

  /* Approve = single-click status flip + immediate save of just status */
  const handleApprove = async () => {
    if (!propertyId) return
    setApproving(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property: { status: 'active' } }),
      })
      if (!res.ok) throw new Error()
      form.setValue('status', 'active')
      setProperty((p) => p ? { ...p, status: 'active' } : p)
      toast.success('Imóvel aprovado e marcado como activo')
      onSaved?.()
    } catch {
      toast.error('Erro ao aprovar imóvel')
    } finally {
      setApproving(false)
    }
  }

  /* Submit — splits the values into the 3-payload shape the API expects */
  const handleSubmit = async (values: FormValues) => {
    if (!propertyId) return
    setSaving(true)
    try {
      const { property: propPayload, specifications, internal } = splitPayload(values)
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property: propPayload, specifications, internal }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao guardar imóvel')
      }
      toast.success('Imóvel actualizado')
      onSaved?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao guardar imóvel')
    } finally {
      setSaving(false)
    }
  }

  const statusMeta = status ? PROPERTY_STATUS[status as keyof typeof PROPERTY_STATUS] : null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[92dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[820px] sm:rounded-l-3xl',
        )}
      >
        <VisuallyHidden>
          <SheetTitle>Editar imóvel</SheetTitle>
          <SheetDescription>Actualize os dados do imóvel.</SheetDescription>
        </VisuallyHidden>
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        {/* Header */}
        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 gap-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-semibold leading-tight tracking-tight truncate">
                {property?.title || 'Editar imóvel'}
              </h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {property?.external_ref && (
                  <span className="tabular-nums">{property.external_ref}</span>
                )}
                {statusMeta && (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                    statusMeta.bg, statusMeta.text,
                  )}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', statusMeta.dot)} />
                    {statusMeta.label}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 mr-10">
              {isPending && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApprove}
                  disabled={approving}
                >
                  {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Aprovar
                </Button>
              )}
            </div>
          </div>

          {/* Management strip — Estado + Website público. Hidden for
              consultores. Lives above the tabs because these decisions cut
              across all sections of the imóvel. The other apresentação
              toggles (staging, plantas IA) live inside the Apresentação tab. */}
          {isManagement && property && (
            <div className="mt-4 rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm divide-y divide-border/30">
              <ManagementRow
                icon={Activity}
                label="Estado"
                hint="Workflow e visibilidade na lista"
                control={
                  <StatusInlinePicker
                    status={form.watch('status') ?? property.status ?? 'pending_approval'}
                    onChange={(v) => form.setValue('status', v, { shouldDirty: true })}
                  />
                }
              />
              <ManagementRow
                icon={Globe}
                label="Mostrar no website público"
                hint="infinitygroup.pt + pesquisa pública"
                control={
                  <Switch
                    checked={!!form.watch('show_on_website')}
                    onCheckedChange={(v) => form.setValue('show_on_website', v, { shouldDirty: true })}
                  />
                }
              />
            </div>
          )}

          {/* Tabs — on mobile only the active tab shows the label, the others
              collapse to a square icon button so 5 tabs fit on one row.
              Centered on mobile, left-aligned from sm+. */}
          <div className="mt-4 flex justify-center sm:justify-start">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
              <TabsList className="bg-muted/40 backdrop-blur-sm border border-border/30 rounded-full p-1 h-auto flex flex-nowrap justify-start gap-0.5 overflow-x-auto scrollbar-hide max-w-full">
                {TABS.map(({ value, label, icon: Icon }) => {
                  const active = tab === value
                  return (
                    <TabsTrigger
                      key={value}
                      value={value}
                      title={label}
                      aria-label={label}
                      className={cn(
                        'rounded-full py-1 text-xs font-medium gap-1.5 shrink-0 inline-flex items-center justify-center transition-all',
                        active ? 'px-3' : 'px-2 sm:px-3',
                        'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
                        'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className={cn(active ? 'inline' : 'hidden sm:inline')}>{label}</span>
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
          </div>
        </SheetHeader>

        {/* Body */}
        {loading || (property && !isFormReady) ? (
          <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !property ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <AlertCircle className="h-6 w-6" />
            <p className="text-sm">Imóvel não encontrado.</p>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit, (errors) => {
                // Without this callback, react-hook-form silently swallows
                // submit clicks when zod validation fails — the user just
                // sees the button do nothing. Surface the offending fields
                // and switch to the tab that contains the first error so
                // the inline FormMessage is visible.
                const flat = Object.keys(errors)
                if (flat.length === 0) return
                const FIELD_TO_TAB: Record<string, typeof tab> = {
                  title: 'geral', property_type: 'geral', business_type: 'geral',
                  listing_price: 'geral', status: 'geral', consultant_id: 'geral',
                  energy_certificate: 'geral', property_condition: 'geral', external_ref: 'geral',
                  address_street: 'localizacao', address_parish: 'localizacao',
                  postal_code: 'localizacao', city: 'localizacao', zone: 'localizacao',
                  latitude: 'localizacao', longitude: 'localizacao',
                  bedrooms: 'especificacoes', bathrooms: 'especificacoes',
                  area_gross: 'especificacoes', area_util: 'especificacoes',
                  typology: 'especificacoes', construction_year: 'especificacoes',
                  parking_spaces: 'especificacoes', garage_spaces: 'especificacoes',
                  contract_regime: 'contrato', contract_term: 'contrato',
                  commission_agreed: 'contrato', cpcv_percentage: 'contrato',
                }
                const firstField = flat[0]
                const targetTab = FIELD_TO_TAB[firstField]
                if (targetTab && targetTab !== tab) setTab(targetTab)
                toast.error(
                  flat.length === 1
                    ? `Campo inválido: ${firstField}`
                    : `${flat.length} campos por corrigir: ${flat.slice(0, 3).join(', ')}${flat.length > 3 ? '…' : ''}`,
                )
              })}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-6">
                {tab === 'geral' && <GeralPanel form={form} consultants={consultantsWithAssigned} />}
                {tab === 'localizacao' && <LocalizacaoPanel form={form} />}
                {tab === 'especificacoes' && <EspecsPanel form={form} />}
                {tab === 'contrato' && <ContratoPanel form={form} />}
                {tab === 'apresentacao' && <ApresentacaoPanel form={form} property={property} />}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-6 py-3 border-t border-border/40 flex items-center justify-end gap-2 bg-background/60 backdrop-blur-xl">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8 text-xs"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-full h-8 text-xs"
                  disabled={saving}
                >
                  {saving && <Spinner variant="infinite" size={14} className="mr-1.5" />}
                  Guardar alterações
                </Button>
              </div>
            </form>
          </Form>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Panels                                                                 */
/* ─────────────────────────────────────────────────────────────────────── */

function GeralPanel({
  form, consultants,
}: { form: any; consultants: { id: string; commercial_name: string }[] }) {
  return (
    <div className="space-y-5">
      <FormField control={form.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Título *</FormLabel>
          <FormControl><Input placeholder="Ex: Apartamento T2 no centro de Lisboa" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descrição</FormLabel>
          <FormControl>
            <CalendarRichEditor
              value={descriptionToHtml(field.value)}
              onChange={(html) => field.onChange(html)}
              placeholder="Descreva o imóvel..."
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="external_ref" render={({ field }) => (
          <FormItem>
            <FormLabel>Referência externa</FormLabel>
            <FormControl><Input placeholder="REF-001" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem>
            <FormLabel>Estado</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                {Object.entries(PROPERTY_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="property_type" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de imóvel *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                {Object.entries(PROPERTY_TYPES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="business_type" render={({ field }) => (
          <FormItem>
            <FormLabel>Negócio *</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                {Object.entries(BUSINESS_TYPES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="listing_price" render={({ field }) => (
          <FormItem>
            <FormLabel>Preço (€)</FormLabel>
            <FormControl>
              <MaskInput
                mask="currency" currency="EUR" locale="pt-PT" placeholder="0,00 €"
                value={field.value != null ? String(field.value) : ''}
                onValueChange={(_m, u) => field.onChange(u ? Number(u) : undefined)}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="property_condition" render={({ field }) => (
          <FormItem>
            <FormLabel>Condição</FormLabel>
            <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                {Object.entries(PROPERTY_CONDITIONS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="energy_certificate" render={({ field }) => (
          <FormItem>
            <FormLabel>Certificado energético</FormLabel>
            <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                {Object.entries(ENERGY_CERTIFICATES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="consultant_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Consultor</FormLabel>
            <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? undefined : v)} value={field.value || NONE_VALUE}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Não atribuído</SelectItem>
                {consultants.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.commercial_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  )
}

function LocalizacaoPanel({ form }: { form: any }) {
  return (
    <div className="space-y-4">
      <PropertyAddressMapPicker
        address={form.watch('address_street') || ''}
        postalCode={form.watch('postal_code') || ''}
        city={form.watch('city') || ''}
        zone={form.watch('zone') || ''}
        latitude={form.watch('latitude') ?? null}
        longitude={form.watch('longitude') ?? null}
        onAddressChange={(v) => form.setValue('address_street', v)}
        onPostalCodeChange={(v) => form.setValue('postal_code', v)}
        onCityChange={(v) => form.setValue('city', v)}
        onZoneChange={(v) => form.setValue('zone', v)}
        onLatitudeChange={(v) => form.setValue('latitude', v ?? undefined)}
        onLongitudeChange={(v) => form.setValue('longitude', v ?? undefined)}
      />
      <FormField control={form.control} name="address_parish" render={({ field }) => (
        <FormItem>
          <FormLabel>Freguesia</FormLabel>
          <FormControl><Input placeholder="Ex: Santa Maria Maior" {...field} value={field.value ?? ''} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

function EspecsPanel({ form }: { form: any }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField control={form.control} name="typology" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipologia</FormLabel>
            <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                {TYPOLOGIES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        {(['bedrooms', 'bathrooms', 'construction_year', 'area_gross', 'area_util', 'parking_spaces', 'garage_spaces', 'fronts_count'] as const).map((name) => {
          const labels: Record<string, string> = {
            bedrooms: 'Quartos', bathrooms: 'Casas de banho', construction_year: 'Ano construção',
            area_gross: 'Área bruta (m²)', area_util: 'Área útil (m²)',
            parking_spaces: 'Estacionamentos', garage_spaces: 'Garagens', fronts_count: 'Frentes',
          }
          return (
            <FormField key={name} control={form.control} name={name} render={({ field }) => (
              <FormItem>
                <FormLabel>{labels[name]}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step={name.includes('area') ? '0.01' : '1'} placeholder="0" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          )
        })}
      </div>

      <FormField control={form.control} name="has_elevator" render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0">
          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          <FormLabel className="font-normal cursor-pointer">Tem elevador</FormLabel>
        </FormItem>
      )} />

      <div className="space-y-5">
        <AmenityGrid label="Características" allItems={[...FEATURES]} value={form.watch('features') || []} onChange={(v: string[]) => form.setValue('features', v)} />
        <AmenityGrid label="Equipamento" allItems={[...EQUIPMENT]} value={form.watch('equipment_list') || []} onChange={(v: string[]) => form.setValue('equipment_list', v)} />
        <AmenityGrid label="Orientação solar" allItems={[...SOLAR_ORIENTATIONS]} value={form.watch('solar_orientation') || []} onChange={(v: string[]) => form.setValue('solar_orientation', v)} />
        <AmenityGrid label="Vistas" allItems={[...VIEWS]} value={form.watch('views_list') || []} onChange={(v: string[]) => form.setValue('views_list', v)} />
      </div>

      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Áreas extra (m²)</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { name: 'storage_area' as const, label: 'Arrecadação' },
          { name: 'balcony_area' as const, label: 'Varanda' },
          { name: 'pool_area' as const, label: 'Piscina' },
          { name: 'attic_area' as const, label: 'Sótão' },
          { name: 'pantry_area' as const, label: 'Despensa' },
          { name: 'gym_area' as const, label: 'Ginásio' },
        ]).map(({ name, label }) => (
          <FormField key={name} control={form.control} name={name} render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">{label}</FormLabel>
              <FormControl><Input type="number" min={0} step="0.01" placeholder="0" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        ))}
      </div>
    </div>
  )
}

function ContratoPanel({ form }: { form: any }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="contract_regime" render={({ field }) => (
          <FormItem>
            <FormLabel>Regime de contrato</FormLabel>
            <Select onValueChange={(v) => field.onChange(v === NONE_VALUE ? '' : v)} value={field.value || NONE_VALUE}>
              <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Nenhum</SelectItem>
                {Object.entries(CONTRACT_REGIMES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v as string}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="commission_type" render={({ field }) => (
          <FormItem>
            <FormLabel>Tipo de comissão</FormLabel>
            <Select onValueChange={field.onChange} value={field.value || 'percentage'}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="percentage">Percentagem</SelectItem>
                <SelectItem value="fixed">Valor fixo</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="commission_agreed" render={({ field }) => (
          <FormItem>
            <FormLabel>{form.watch('commission_type') === 'fixed' ? 'Comissão (€)' : 'Comissão (%)'}</FormLabel>
            <FormControl>
              {form.watch('commission_type') === 'fixed' ? (
                <MaskInput
                  mask="currency" currency="EUR" locale="pt-PT" placeholder="0,00 €"
                  value={field.value != null ? String(field.value) : ''}
                  onValueChange={(_m, u) => field.onChange(u ? Number(u) : undefined)}
                  onBlur={field.onBlur}
                />
              ) : (
                <MaskInput
                  mask="percentage" placeholder="0,00%"
                  value={field.value != null ? String(field.value) : ''}
                  onValueChange={(_m, u) => field.onChange(u ? Number(u) : undefined)}
                  onBlur={field.onBlur}
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="contract_term" render={({ field }) => (
          <FormItem>
            <FormLabel>Prazo do contrato</FormLabel>
            <FormControl><Input placeholder="6 meses" {...field} value={field.value ?? ''} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="contract_expiry" render={({ field }) => (
          <FormItem>
            <FormLabel>Data de expiração</FormLabel>
            <FormControl>
              <MaskInput
                mask={datePTMask} placeholder="DD/MM/AAAA"
                value={field.value ? isoToDatePT(field.value) : ''}
                onValueChange={(_m, u) => {
                  if (u.length === 8) field.onChange(datePTtoISO(u))
                  else field.onChange(u || '')
                }}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="imi_value" render={({ field }) => (
          <FormItem>
            <FormLabel>IMI (€)</FormLabel>
            <FormControl>
              <MaskInput
                mask="currency" currency="EUR" locale="pt-PT" placeholder="0,00 €"
                value={field.value != null ? String(field.value) : ''}
                onValueChange={(_m, u) => field.onChange(u ? Number(u) : undefined)}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="condominium_fee" render={({ field }) => (
          <FormItem>
            <FormLabel>Condomínio (€/mês)</FormLabel>
            <FormControl>
              <MaskInput
                mask="currency" currency="EUR" locale="pt-PT" placeholder="0,00 €"
                value={field.value != null ? String(field.value) : ''}
                onValueChange={(_m, u) => field.onChange(u ? Number(u) : undefined)}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="cpcv_percentage" render={({ field }) => (
          <FormItem>
            <FormLabel>CPCV (%)</FormLabel>
            <FormControl>
              <MaskInput
                mask="percentage" placeholder="0,00%"
                value={field.value != null ? String(field.value) : ''}
                onValueChange={(_m, u) => field.onChange(u ? Number(u) : undefined)}
                onBlur={field.onBlur}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      {/* Licença de Utilização */}
      <div className="rounded-2xl border border-border/40 bg-background/40 p-4 space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Licença de utilização</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField control={form.control} name="use_license_number" render={({ field }) => (
            <FormItem>
              <FormLabel>Número</FormLabel>
              <FormControl><Input placeholder="Ex.: 125/2019" {...field} value={field.value || ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="use_license_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Data de emissão</FormLabel>
              <FormControl>
                <MaskInput
                  mask={datePTMask} placeholder="DD/MM/AAAA"
                  value={field.value ? isoToDatePT(field.value) : ''}
                  onValueChange={(_m, u) => {
                    if (u.length === 8) field.onChange(datePTtoISO(u))
                    else field.onChange(u || '')
                  }}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="use_license_issuer" render={({ field }) => (
            <FormItem>
              <FormLabel>Entidade emissora</FormLabel>
              <FormControl><Input placeholder="Câmara Municipal de..." {...field} value={field.value || ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>

      {/* Hipoteca */}
      <div className="rounded-2xl border border-border/40 bg-background/40 p-4 space-y-3">
        <FormField control={form.control} name="has_mortgage" render={({ field }) => (
          <FormItem className="flex items-center gap-3 space-y-0">
            <FormControl>
              <Checkbox
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
              />
            </FormControl>
            <FormLabel className="m-0 cursor-pointer">Existe hipoteca sobre o imóvel</FormLabel>
          </FormItem>
        )} />

        {form.watch('has_mortgage') && (
          <FormField control={form.control} name="mortgage_owed" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor aproximado em dívida (€)</FormLabel>
              <FormControl>
                <MaskInput
                  mask="currency" currency="EUR" locale="pt-PT" placeholder="0,00 €"
                  value={field.value != null ? String(field.value) : ''}
                  onValueChange={(_m, u) => field.onChange(u ? Number(u) : undefined)}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        )}
      </div>

      <FormField control={form.control} name="internal_notes" render={({ field }) => (
        <FormItem>
          <FormLabel>Notas internas</FormLabel>
          <FormControl><Textarea placeholder="Notas internas sobre o imóvel..." className="min-h-[80px]" {...field} value={field.value ?? ''} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

function ApresentacaoPanel({ form }: { form: any; property: PropertyFullData }) {
  const showStaging = form.watch('presentation_show_staging') !== false
  const showAiPlantas = form.watch('presentation_show_ai_plantas') !== false
  return (
    <div className="space-y-5">
      {/* Apresentação pública (link partilhável) */}
      <div className="rounded-2xl border border-border/40 bg-background/40 p-4 space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Página de apresentação
        </h4>
        <div className="space-y-2.5">
          <ToggleRow
            label="Mostrar staging (fotos antes/depois)"
            checked={showStaging}
            onChange={(v) => form.setValue('presentation_show_staging', v, { shouldDirty: true })}
          />
          <ToggleRow
            label="Mostrar plantas geradas por IA"
            checked={showAiPlantas}
            onChange={(v) => form.setValue('presentation_show_ai_plantas', v, { shouldDirty: true })}
          />
        </div>
      </div>

      {/* Portal links */}
      <div className="rounded-2xl border border-border/40 bg-background/40 p-4 space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Links nos portais
        </h4>
        <div className="grid gap-3">
          <PortalLink form={form} field="link_portal_remax" label="RE/MAX" placeholder="https://www.remax.pt/imoveis/..." />
          <PortalLink form={form} field="link_portal_idealista" label="Idealista" placeholder="https://www.idealista.pt/imovel/..." />
          <PortalLink form={form} field="link_portal_imovirtual" label="Imovirtual" placeholder="https://www.imovirtual.com/anuncio/..." />
          <PortalLink form={form} field="link_portal_infinity" label="Infinity Group" placeholder="https://infinitygroup.pt/imovel/..." />
        </div>

        {/* REMAX-specific extras */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <FormField control={form.control} name="remax_draft_number" render={({ field }) => (
            <FormItem>
              <FormLabel>Nº rascunho RE/MAX</FormLabel>
              <FormControl><Input placeholder="—" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="remax_published_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Data publicação RE/MAX</FormLabel>
              <FormControl>
                <MaskInput
                  mask={datePTMask} placeholder="DD/MM/AAAA"
                  value={field.value ? isoToDatePT(field.value) : ''}
                  onValueChange={(_m, u) => {
                    if (u.length === 8) field.onChange(datePTtoISO(u))
                    else field.onChange(u || '')
                  }}
                  onBlur={field.onBlur}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
      </div>
    </div>
  )
}

/* ───────── Bits ───────── */

/** Strip row used for the Estado picker + apresentação toggles in the sheet
 *  header. Mirrors the row visual (icon + label + hint, control on the right). */
function ManagementRow({
  icon: Icon, label, hint, control,
}: {
  icon: React.ElementType
  label: string
  hint?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-tight truncate">{label}</p>
        {hint && <p className="text-[10px] text-muted-foreground truncate">{hint}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

/** Inline estado picker — pill that opens a popover with the full set of
 *  statuses. Used inside the Management strip alongside the toggles. */
function StatusInlinePicker({
  status, onChange,
}: {
  status: string
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  // Defensive: treat empty/unknown status as pending_approval so the pill
  // always shows a label + dot. ?? doesn't catch '' so use || here.
  const safeStatus = (status || 'pending_approval') as keyof typeof PROPERTY_STATUS
  const meta = PROPERTY_STATUS[safeStatus] ?? PROPERTY_STATUS.pending_approval
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/80 backdrop-blur-sm px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/40 min-w-[120px]"
          title="Alterar estado"
        >
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', meta.dot)} />
          <span className="flex-1 text-left">{meta.label}</span>
          <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', open && 'rotate-90')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl p-1.5">
        <div className="flex flex-col gap-0.5">
          {Object.entries(PROPERTY_STATUS).map(([k, v]) => {
            const active = k === safeStatus
            return (
              <button
                key={k}
                type="button"
                onClick={() => { onChange(k); setOpen(false) }}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                  active ? 'bg-muted/60 font-medium' : 'hover:bg-muted/30',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', v.dot)} />
                <span className="flex-1 text-left">{v.label}</span>
                {active && <Check className="h-3 w-3 text-foreground/70" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function PortalLink({ form, field, label, placeholder }: { form: any; field: string; label: string; placeholder: string }) {
  const value = form.watch(field) as string | null
  const valid = !!value && /^https?:\/\//i.test(value)
  return (
    <FormField control={form.control} name={field as any} render={({ field: f }) => (
      <FormItem>
        <FormLabel className="text-xs flex items-center justify-between">
          <span>{label}</span>
          {valid && (
            <a
              href={value!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              Abrir
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </FormLabel>
        <FormControl>
          <Input
            type="url"
            placeholder={placeholder}
            {...f}
            value={f.value ?? ''}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  )
}

function AmenityGrid({ label, allItems, value, onChange }: {
  label: string; allItems: string[]; value: string[]; onChange: (v: string[]) => void
}) {
  const toggle = (item: string) => {
    onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item])
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 gap-1.5">
        {allItems.map((item) => {
          const active = value.includes(item)
          const emoji = AMENITY_EMOJIS[item] || '✨'
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={cn(
                'min-w-0 overflow-hidden rounded-md border px-1.5 py-2 flex flex-col items-center justify-center gap-0.5 text-center transition-all',
                active
                  ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300'
                  : 'border-border bg-background/40 hover:bg-muted/50',
              )}
            >
              <span className="text-base leading-none">{emoji}</span>
              <span className="text-[10px] font-medium leading-tight w-full break-words hyphens-auto">
                {item}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ───────── Helpers ───────── */

function buildDefaults(p: PropertyFullData): Partial<FormValues> {
  const specs = p.dev_property_specifications ?? null
  const internal = p.dev_property_internal ?? null
  return {
    title: p.title ?? '',
    description: p.description ?? '',
    property_type: p.property_type ?? '',
    business_type: p.business_type ?? '',
    listing_price: (p.listing_price as any) ?? undefined,
    status: p.status ?? 'pending_approval',
    property_condition: p.property_condition ?? '',
    energy_certificate: p.energy_certificate ?? '',
    external_ref: p.external_ref ?? '',
    consultant_id: p.consultant_id ?? undefined,
    address_street: p.address_street ?? '',
    address_parish: p.address_parish ?? '',
    postal_code: p.postal_code ?? '',
    city: p.city ?? '',
    zone: p.zone ?? '',
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    contract_regime: p.contract_regime ?? internal?.contract_regime ?? '',
    show_on_website: p.show_on_website ?? false,
    presentation_show_staging: p.presentation_show_staging ?? true,
    presentation_show_ai_plantas: p.presentation_show_ai_plantas ?? true,
    link_portal_remax: p.link_portal_remax ?? '',
    link_portal_idealista: p.link_portal_idealista ?? '',
    link_portal_imovirtual: p.link_portal_imovirtual ?? '',
    link_portal_infinity: p.link_portal_infinity ?? '',
    remax_published_date: p.remax_published_date ?? '',
    remax_draft_number: p.remax_draft_number ?? '',
    notas_juridico_convictus: p.notas_juridico_convictus ?? '',
    typology: specs?.typology ?? '',
    bedrooms: (specs?.bedrooms as any) ?? '',
    bathrooms: (specs?.bathrooms as any) ?? '',
    area_gross: (specs?.area_gross as any) ?? '',
    area_util: (specs?.area_util as any) ?? '',
    construction_year: (specs?.construction_year as any) ?? '',
    parking_spaces: (specs?.parking_spaces as any) ?? '',
    garage_spaces: (specs?.garage_spaces as any) ?? '',
    has_elevator: specs?.has_elevator ?? false,
    fronts_count: (specs?.fronts_count as any) ?? '',
    features: specs?.features ?? [],
    solar_orientation: specs?.solar_orientation ?? [],
    views_list: specs?.views ?? [],
    equipment_list: specs?.equipment ?? [],
    storage_area: (specs?.storage_area as any) ?? '',
    balcony_area: (specs?.balcony_area as any) ?? '',
    pool_area: (specs?.pool_area as any) ?? '',
    attic_area: (specs?.attic_area as any) ?? '',
    pantry_area: (specs?.pantry_area as any) ?? '',
    gym_area: (specs?.gym_area as any) ?? '',
    internal_notes: internal?.internal_notes ?? '',
    commission_agreed: (internal?.commission_agreed as any) ?? '',
    commission_type: internal?.commission_type ?? 'percentage',
    contract_term: internal?.contract_term ?? '',
    contract_expiry: internal?.contract_expiry ?? '',
    imi_value: (internal?.imi_value as any) ?? '',
    condominium_fee: (internal?.condominium_fee as any) ?? '',
    cpcv_percentage: (internal?.cpcv_percentage as any) ?? '',
    has_mortgage: internal?.has_mortgage ?? undefined,
    mortgage_owed: (internal?.mortgage_owed as any) ?? '',
    use_license_number: internal?.use_license_number ?? '',
    use_license_date: internal?.use_license_date ?? '',
    use_license_issuer: internal?.use_license_issuer ?? '',
  }
}

function splitPayload(values: FormValues): {
  property: Partial<PropertyFormData>
  specifications: Partial<PropertySpecsFormData>
  internal: Partial<PropertyInternalFormData> & Record<string, unknown>
} {
  const {
    typology, bedrooms, bathrooms, area_gross, area_util, construction_year,
    parking_spaces, garage_spaces, has_elevator, fronts_count,
    features, solar_orientation, views_list, equipment_list,
    storage_area, balcony_area, pool_area, attic_area, pantry_area, gym_area,
    internal_notes, commission_agreed, commission_type, contract_term,
    contract_expiry, imi_value, condominium_fee, cpcv_percentage,
    has_mortgage, mortgage_owed, use_license_number, use_license_date, use_license_issuer,
    ...propertyData
  } = values

  const property: Partial<PropertyFormData> = {
    ...propertyData,
    listing_price: cleanNumber(propertyData.listing_price),
    // Date columns reject empty strings — coerce to null when blank.
    remax_published_date: propertyData.remax_published_date || null,
    // Strip empty consultant_id (the Select sets undefined for "Não atribuído"
    // but defensively normalise empty strings too — the column is uuid-typed).
    consultant_id: propertyData.consultant_id || undefined,
  }

  const specifications: Partial<PropertySpecsFormData> = {}
  if (typology) specifications.typology = typology
  const _bedrooms = cleanNumber(bedrooms); if (_bedrooms !== undefined) specifications.bedrooms = _bedrooms
  const _baths = cleanNumber(bathrooms); if (_baths !== undefined) specifications.bathrooms = _baths
  const _ag = cleanNumber(area_gross); if (_ag !== undefined) specifications.area_gross = _ag
  const _au = cleanNumber(area_util); if (_au !== undefined) specifications.area_util = _au
  const _cy = cleanNumber(construction_year); if (_cy !== undefined) specifications.construction_year = _cy
  const _ps = cleanNumber(parking_spaces); if (_ps !== undefined) specifications.parking_spaces = _ps
  const _gs = cleanNumber(garage_spaces); if (_gs !== undefined) specifications.garage_spaces = _gs
  if (has_elevator !== undefined) specifications.has_elevator = has_elevator
  const _fc = cleanNumber(fronts_count); if (_fc !== undefined) specifications.fronts_count = _fc
  if (features?.length) specifications.features = features
  if (solar_orientation?.length) specifications.solar_orientation = solar_orientation
  if (views_list?.length) specifications.views = views_list
  if (equipment_list?.length) specifications.equipment = equipment_list
  const _sa = cleanNumber(storage_area); if (_sa !== undefined) specifications.storage_area = _sa
  const _ba = cleanNumber(balcony_area); if (_ba !== undefined) specifications.balcony_area = _ba
  const _pa = cleanNumber(pool_area); if (_pa !== undefined) specifications.pool_area = _pa
  const _ata = cleanNumber(attic_area); if (_ata !== undefined) specifications.attic_area = _ata
  const _pta = cleanNumber(pantry_area); if (_pta !== undefined) specifications.pantry_area = _pta
  const _ga = cleanNumber(gym_area); if (_ga !== undefined) specifications.gym_area = _ga

  const internal: Partial<PropertyInternalFormData> & Record<string, unknown> = {}
  if (internal_notes !== undefined) internal.internal_notes = internal_notes || ''
  const _ca = cleanNumber(commission_agreed); if (_ca !== undefined) internal.commission_agreed = _ca
  if (commission_type) internal.commission_type = commission_type
  if (values.contract_regime) internal.contract_regime = values.contract_regime
  if (contract_term !== undefined) internal.contract_term = contract_term || ''
  // contract_expiry is a date column — empty string would be rejected.
  if (contract_expiry !== undefined) (internal as Record<string, unknown>).contract_expiry = contract_expiry || null
  const _imi = cleanNumber(imi_value); if (_imi !== undefined) internal.imi_value = _imi
  const _co = cleanNumber(condominium_fee); if (_co !== undefined) internal.condominium_fee = _co
  const _cp = cleanNumber(cpcv_percentage); if (_cp !== undefined) internal.cpcv_percentage = _cp
  if (has_mortgage !== undefined) internal.has_mortgage = has_mortgage
  if (!has_mortgage) {
    internal.mortgage_owed = null
  } else {
    const _mo = cleanNumber(mortgage_owed); if (_mo !== undefined) internal.mortgage_owed = _mo
  }
  if (use_license_number !== undefined) internal.use_license_number = use_license_number || null
  if (use_license_date !== undefined) internal.use_license_date = use_license_date || null
  if (use_license_issuer !== undefined) internal.use_license_issuer = use_license_issuer || null

  return { property, specifications, internal }
}
