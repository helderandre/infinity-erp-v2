'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type {
  MarketingCatalogItem,
  MarketingCatalogAddon,
  CartPropertyBundle,
} from '@/types/marketing'
import { formatCurrency, MARKETING_CATEGORIES } from '@/lib/constants'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
// ScrollArea removed — using simple overflow-y-auto on SheetContent
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Building2,
  MapPin,
  ChevronRight,
  ChevronLeft,
  ShoppingCart,
  Check,
  ChevronDown,
  ChevronUp,
  Camera,
  Video,
  Palette,
  Package,
  Megaphone,
  Share2,
  MoreHorizontal,
  Loader2,
  Search,
  PenLine,
  CalendarDays,
  UserCheck,
  UserX,
  Clock,
  Plus,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  photography: Camera,
  video: Video,
  design: Palette,
  physical_materials: Package,
  ads: Megaphone,
  social_media: Share2,
  other: MoreHorizontal,
}

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  photography:
    'https://images.pexels.com/photos/6180674/pexels-photo-6180674.jpeg?auto=compress&cs=tinysrgb&w=800',
  video:
    'https://images.pexels.com/photos/2873486/pexels-photo-2873486.jpeg?auto=compress&cs=tinysrgb&w=800',
  design:
    'https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=800',
  physical_materials:
    'https://images.pexels.com/photos/5632399/pexels-photo-5632399.jpeg?auto=compress&cs=tinysrgb&w=800',
  ads:
    'https://images.pexels.com/photos/6476808/pexels-photo-6476808.jpeg?auto=compress&cs=tinysrgb&w=800',
  social_media:
    'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
  other:
    'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800',
}

const PROPERTY_TYPES = [
  'Apartamento',
  'Moradia',
  'Loja',
  'Escritório',
  'Terreno',
  'Armazém',
  'Outro',
] as const

const TYPOLOGIES = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+'] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropertyInfo {
  address: string
  postal_code: string
  city: string
  parish: string
  floor_door?: string
  access_instructions?: string
  property_type?: string
  typology?: string
  area_m2?: number
  has_exteriors: boolean
  has_facades: boolean
  is_occupied: boolean
  is_staged: boolean
  parking_available: boolean
  number_of_divisions?: number
}

interface PreferredDateEntry {
  date: string
  time_slot: string
}

interface AvailabilityInfo {
  will_be_present: boolean | null
  replacement_name: string
  replacement_phone: string
  preferred_dates: PreferredDateEntry[]
  notes: string
}

interface SelectedService {
  service: MarketingCatalogItem
  selectedAddons: MarketingCatalogAddon[]
}

interface SimpleProperty {
  id: string
  title: string
  address_street: string | null
  postal_code: string | null
  city: string | null
  zone: string | null
  property_type: string | null
  dev_property_specifications?: {
    typology: string | null
    area_util: number | null
    bedrooms: number | null
  } | null
}

interface PropertyServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyServices: MarketingCatalogItem[]
  onAddToCart: (bundle: CartPropertyBundle) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_PROPERTY_INFO: PropertyInfo = {
  address: '',
  postal_code: '',
  city: '',
  parish: '',
  floor_door: '',
  access_instructions: '',
  property_type: '',
  typology: '',
  area_m2: undefined,
  has_exteriors: false,
  has_facades: false,
  is_occupied: false,
  is_staged: false,
  parking_available: false,
  number_of_divisions: undefined,
}

const EMPTY_AVAILABILITY: AvailabilityInfo = {
  will_be_present: null,
  replacement_name: '',
  replacement_phone: '',
  preferred_dates: [],
  notes: '',
}

const TIME_SLOTS = [
  { key: 'morning', label: 'Manhã (9h-12h)' },
  { key: 'afternoon', label: 'Tarde (14h-18h)' },
  { key: 'late_afternoon', label: 'Fim de tarde (17h-20h)' },
  { key: 'flexible', label: 'Flexível' },
] as const

const TIME_SLOT_LABELS: Record<string, string> = Object.fromEntries(TIME_SLOTS.map(s => [s.key, s.label]))

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyServiceDialog({
  open,
  onOpenChange,
  propertyServices,
  onAddToCart,
}: PropertyServiceDialogProps) {
  // Step: 1 = property, 2 = services, 3 = availability, 4 = review
  const [step, setStep] = useState(1)

  // Step 1 state
  const [properties, setProperties] = useState<SimpleProperty[]>([])
  const [loadingProperties, setLoadingProperties] = useState(false)
  const [propertySearch, setPropertySearch] = useState('')
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null)
  const [selectedPropertyTitle, setSelectedPropertyTitle] = useState('')
  const [isManual, setIsManual] = useState(false)
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false)
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo>(EMPTY_PROPERTY_INFO)

  // Step 2 state
  const [selectedServices, setSelectedServices] = useState<Map<string, SelectedService>>(new Map())
  const [expandedAddons, setExpandedAddons] = useState<Set<string>>(new Set())

  // Step 3 state — availability
  const [availability, setAvailability] = useState<AvailabilityInfo>(EMPTY_AVAILABILITY)
  const [newDate, setNewDate] = useState('')
  const [newTimeSlot, setNewTimeSlot] = useState('')

  // Reset on open/close
  useEffect(() => {
    if (!open) return
    setStep(1)
    setSelectedPropertyId(null)
    setSelectedPropertyTitle('')
    setIsManual(false)
    setPropertyInfo(EMPTY_PROPERTY_INFO)
    setSelectedServices(new Map())
    setExpandedAddons(new Set())
    setAvailability(EMPTY_AVAILABILITY)
    setNewDate('')
    setPropertySearch('')
    setShowPropertyDropdown(false)
  }, [open])

  // Fetch properties when dialog opens
  useEffect(() => {
    if (!open) return
    setLoadingProperties(true)
    fetch('/api/properties?limit=200')
      .then((r) => r.json())
      .then((data) => {
        const items = Array.isArray(data) ? data : data?.data ?? []
        setProperties(items)
      })
      .catch(() => setProperties([]))
      .finally(() => setLoadingProperties(false))
  }, [open])

  // Filtered properties for search
  const filteredProperties = useMemo(() => {
    if (!propertySearch.trim()) return properties
    const q = propertySearch.toLowerCase()
    return properties.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.address_street?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q)
    )
  }, [properties, propertySearch])

  // Auto-fill from selected property
  const handleSelectProperty = useCallback(
    (prop: SimpleProperty) => {
      setSelectedPropertyId(prop.id)
      setSelectedPropertyTitle(prop.title || 'Sem titulo')
      setIsManual(false)
      setPropertyInfo({
        address: prop.address_street || '',
        postal_code: prop.postal_code || '',
        city: prop.city || '',
        parish: prop.zone || '',
        floor_door: '',
        access_instructions: '',
        property_type: prop.property_type || '',
        typology: prop.dev_property_specifications?.typology || '',
        area_m2: prop.dev_property_specifications?.area_util || undefined,
        has_exteriors: false,
        has_facades: false,
        is_occupied: false,
        is_staged: false,
        parking_available: false,
        number_of_divisions: prop.dev_property_specifications?.bedrooms || undefined,
      })
    },
    []
  )

  const handleSwitchToManual = useCallback(() => {
    setIsManual(true)
    setSelectedPropertyId(null)
    setSelectedPropertyTitle('')
    setPropertyInfo(EMPTY_PROPERTY_INFO)
  }, [])

  // Update a single field in propertyInfo
  const updateInfo = useCallback(
    <K extends keyof PropertyInfo>(key: K, value: PropertyInfo[K]) => {
      setPropertyInfo((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // Step 2 — toggle service
  const toggleService = useCallback(
    (service: MarketingCatalogItem) => {
      setSelectedServices((prev) => {
        const next = new Map(prev)
        if (next.has(service.id)) {
          next.delete(service.id)
        } else {
          next.set(service.id, { service, selectedAddons: [] })
        }
        return next
      })
    },
    []
  )

  // Step 2 — toggle addon
  const toggleAddon = useCallback(
    (serviceId: string, addon: MarketingCatalogAddon) => {
      setSelectedServices((prev) => {
        const next = new Map(prev)
        const entry = next.get(serviceId)
        if (!entry) return prev
        const hasAddon = entry.selectedAddons.some((a) => a.id === addon.id)
        next.set(serviceId, {
          ...entry,
          selectedAddons: hasAddon
            ? entry.selectedAddons.filter((a) => a.id !== addon.id)
            : [...entry.selectedAddons, addon],
        })
        return next
      })
    },
    []
  )

  // Toggle addon expansion
  const toggleAddonExpansion = useCallback((serviceId: string) => {
    setExpandedAddons((prev) => {
      const next = new Set(prev)
      if (next.has(serviceId)) next.delete(serviceId)
      else next.add(serviceId)
      return next
    })
  }, [])

  // Subtotal
  const subtotal = useMemo(() => {
    let total = 0
    selectedServices.forEach((entry) => {
      total += entry.service.price
      entry.selectedAddons.forEach((a) => (total += a.price))
    })
    return total
  }, [selectedServices])

  // Validation
  const canProceedStep1 =
    (selectedPropertyId && propertyInfo.address) ||
    (isManual && propertyInfo.address && propertyInfo.city)

  const canProceedStep2 = selectedServices.size > 0

  // Submit
  const handleAddToCart = useCallback(() => {
    const bundle: CartPropertyBundle = {
      type: 'property_bundle',
      propertyId: selectedPropertyId,
      propertyTitle: selectedPropertyTitle || propertyInfo.address,
      propertyInfo: {
        address: propertyInfo.address,
        postal_code: propertyInfo.postal_code,
        city: propertyInfo.city,
        parish: propertyInfo.parish,
        floor_door: propertyInfo.floor_door || undefined,
        access_instructions: propertyInfo.access_instructions || undefined,
        property_type: propertyInfo.property_type || undefined,
        typology: propertyInfo.typology || undefined,
        area_m2: propertyInfo.area_m2,
        has_exteriors: propertyInfo.has_exteriors,
        has_facades: propertyInfo.has_facades,
        is_occupied: propertyInfo.is_occupied,
        is_staged: propertyInfo.is_staged,
        parking_available: propertyInfo.parking_available,
        number_of_divisions: propertyInfo.number_of_divisions,
      },
      services: Array.from(selectedServices.values()),
      availability: availability.will_be_present !== null ? {
        will_be_present: availability.will_be_present,
        replacement_name: availability.replacement_name || undefined,
        replacement_phone: availability.replacement_phone || undefined,
        preferred_dates: availability.preferred_dates,
        notes: availability.notes || undefined,
      } : undefined,
    }
    onAddToCart(bundle)
    onOpenChange(false)
  }, [
    selectedPropertyId,
    selectedPropertyTitle,
    propertyInfo,
    selectedServices,
    availability,
    onAddToCart,
    onOpenChange,
  ])

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const stepLabel = step === 1 ? 'Seleccionar Imovel' : step === 2 ? 'Escolher Servicos' : step === 3 ? 'Disponibilidade' : 'Resumo'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="w-[calc(100vw-2rem)] sm:max-w-[460px] h-[85vh] sm:h-[80vh] rounded-2xl p-0 flex flex-col overflow-hidden">
        {/* ── Dark header ── */}
        <div className="bg-neutral-900 px-5 py-4 shrink-0 relative">
          <DialogClose className="absolute top-3 right-3 rounded-sm p-1 text-neutral-400 hover:text-white transition-colors focus:outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-white">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm">
                <Building2 className="h-4 w-4" />
              </div>
              {stepLabel}
            </DialogTitle>
            <DialogDescription className="text-neutral-400 mt-1">
              {step === 1 && 'Seleccione ou preencha os dados do imóvel.'}
              {step === 2 && 'Seleccione os serviços que pretende contratar.'}
              {step === 3 && 'Indique a sua disponibilidade para a realização dos serviços.'}
              {step === 4 && 'Reveja os detalhes antes de adicionar ao carrinho.'}
            </DialogDescription>
          </DialogHeader>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-2.5 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                type="button"
                disabled
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'w-8 bg-white'
                    : s < step
                    ? 'w-2.5 bg-white/60'
                    : 'w-2.5 bg-white/25'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 pb-5 pt-3 space-y-0 flex-1 overflow-y-auto">
            {/* ────────────────── STEP 1: Property ────────────────── */}
            {step === 1 && (
              <div className="space-y-5 w-full">
                {/* Option A: select from list */}
                {!isManual && !selectedPropertyId && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Seleccionar imóvel</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Pesquisar por título, morada ou cidade..."
                        value={propertySearch}
                        onChange={(e) => setPropertySearch(e.target.value)}
                        onFocus={() => setShowPropertyDropdown(true)}
                        className="pl-9 rounded-full"
                      />

                      {/* Dropdown */}
                      {showPropertyDropdown && (
                        <div className="absolute z-30 top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto overflow-x-hidden rounded-xl border bg-popover shadow-lg divide-y animate-in fade-in slide-in-from-top-2 duration-200">
                          {loadingProperties ? (
                            <div className="flex items-center justify-center py-3">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : filteredProperties.length === 0 ? (
                            <div className="text-center py-3 text-xs text-muted-foreground">
                              Nenhum imóvel encontrado.
                            </div>
                          ) : (
                            filteredProperties.slice(0, 6).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => { handleSelectProperty(p); setShowPropertyDropdown(false) }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors overflow-hidden"
                              >
                                <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <p className="text-xs font-medium truncate">{p.title}</p>
                                  {p.address_street && (
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {p.address_street}{p.city ? `, ${p.city}` : ''}
                                    </p>
                                  )}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground">ou</span>
                      <Separator className="flex-1" />
                    </div>

                    <Button
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => { setShowPropertyDropdown(false); handleSwitchToManual() }}
                    >
                      <PenLine className="mr-2 h-4 w-4" />
                      Preencher manualmente
                    </Button>
                  </div>
                )}

                {/* Option B / Auto-filled: Property form */}
                {(isManual || selectedPropertyId) && (
                  <div className="space-y-3">
                    {isManual && (
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Dados do imovel</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs rounded-full"
                          onClick={() => {
                            setIsManual(false)
                            setPropertyInfo(EMPTY_PROPERTY_INFO)
                          }}
                        >
                          Voltar a seleccao
                        </Button>
                      </div>
                    )}

                    {selectedPropertyId && (
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium text-emerald-800 truncate">
                          {selectedPropertyTitle}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto text-xs rounded-full h-7"
                          onClick={() => {
                            setSelectedPropertyId(null)
                            setSelectedPropertyTitle('')
                            setPropertyInfo(EMPTY_PROPERTY_INFO)
                          }}
                        >
                          Alterar
                        </Button>
                      </div>
                    )}

                    {/* Address fields */}
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Morada *</Label>
                        <Input
                          className="rounded-lg mt-1 h-8 text-sm"
                          placeholder="Rua, numero..."
                          value={propertyInfo.address}
                          onChange={(e) => updateInfo('address', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Codigo Postal</Label>
                          <Input
                            className="rounded-lg mt-1 h-8 text-sm"
                            placeholder="0000-000"
                            value={propertyInfo.postal_code}
                            onChange={(e) => updateInfo('postal_code', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Cidade *</Label>
                          <Input
                            className="rounded-lg mt-1 h-8 text-sm"
                            placeholder="Lisboa"
                            value={propertyInfo.city}
                            onChange={(e) => updateInfo('city', e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Freguesia</Label>
                        <Input
                          className="rounded-lg mt-1 h-8 text-sm"
                          placeholder="Freguesia"
                          value={propertyInfo.parish}
                          onChange={(e) => updateInfo('parish', e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Andar / Porta</Label>
                          <Input
                            className="rounded-lg mt-1 h-8 text-sm"
                            placeholder="3.o Esq."
                            value={propertyInfo.floor_door || ''}
                            onChange={(e) => updateInfo('floor_door', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Instrucoes de Acesso
                          </Label>
                          <Input
                            className="rounded-lg mt-1 h-8 text-sm"
                            placeholder="Codigo portao, chave..."
                            value={propertyInfo.access_instructions || ''}
                            onChange={(e) => updateInfo('access_instructions', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Property details */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Tipo de Imovel</Label>
                        <Select
                          value={propertyInfo.property_type || ''}
                          onValueChange={(v) => updateInfo('property_type', v)}
                        >
                          <SelectTrigger className="rounded-lg mt-1 h-8 text-sm">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {PROPERTY_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Tipologia</Label>
                        <Select
                          value={propertyInfo.typology || ''}
                          onValueChange={(v) => updateInfo('typology', v)}
                        >
                          <SelectTrigger className="rounded-lg mt-1 h-8 text-sm">
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                            {TYPOLOGIES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Area (m2)</Label>
                        <Input
                          type="number"
                          className="rounded-lg mt-1 h-8 text-sm"
                          placeholder="120"
                          value={propertyInfo.area_m2 ?? ''}
                          onChange={(e) =>
                            updateInfo(
                              'area_m2',
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">N.o Divisoes</Label>
                        <Input
                          type="number"
                          className="rounded-lg mt-1 h-8 text-sm"
                          placeholder="5"
                          value={propertyInfo.number_of_divisions ?? ''}
                          onChange={(e) =>
                            updateInfo(
                              'number_of_divisions',
                              e.target.value ? Number(e.target.value) : undefined
                            )
                          }
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Feature toggles */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Caracteristicas
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          ['has_exteriors', 'Exteriores'],
                          ['has_facades', 'Fachadas'],
                          ['is_occupied', 'Ocupado'],
                          ['is_staged', 'Decorado'],
                          ['parking_available', 'Estacionamento'],
                        ] as const
                      ).map(([key, label]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <span className="text-xs">{label}</span>
                          <Switch
                            className="scale-90"
                            checked={propertyInfo[key]}
                            onCheckedChange={(v) => updateInfo(key, v)}
                          />
                        </div>
                      ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ────────────────── STEP 2: Services ────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {propertyServices.map((service) => {
                    const isSelected = selectedServices.has(service.id)
                    const Icon = CATEGORY_ICONS[service.category] || MoreHorizontal
                    const hasAddons = service.addons && service.addons.length > 0
                    const isExpanded = expandedAddons.has(service.id)
                    const entry = selectedServices.get(service.id)

                    return (
                      <div
                        key={service.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleService(service)}
                        className={`group rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'border-neutral-900 shadow-lg ring-1 ring-neutral-900/10'
                            : 'hover:shadow-lg hover:border-neutral-300'
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative h-24 overflow-hidden">
                          <img
                            src={
                              service.thumbnail ||
                              CATEGORY_FALLBACK_IMAGES[service.category] ||
                              CATEGORY_FALLBACK_IMAGES.other
                            }
                            alt={service.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          {/* Category pill */}
                          <div className="absolute top-2 left-2">
                            <span className="inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm text-neutral-700 text-[10px] font-medium px-2 py-0.5 rounded-full shadow-sm">
                              <Icon className="h-3 w-3" />
                              {MARKETING_CATEGORIES[service.category]}
                            </span>
                          </div>
                          {/* Check overlay */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-neutral-900 flex items-center justify-center">
                              <Check className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                          {/* Price tag */}
                          <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-0.5 text-xs font-bold text-neutral-900 shadow-sm">
                            {formatCurrency(service.price)}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="p-2.5">
                          <p className="text-xs font-semibold leading-tight truncate">
                            {service.name}
                          </p>

                          {/* Addons toggle */}
                          {hasAddons && isSelected && (
                            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleAddonExpansion(service.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                {service.addons!.length} extra
                                {service.addons!.length !== 1 ? 's' : ''}
                              </button>
                              {isExpanded && (
                                <div className="mt-2 space-y-1.5">
                                  {service.addons!.map((addon) => {
                                    const addonSelected = entry?.selectedAddons.some(
                                      (a) => a.id === addon.id
                                    )
                                    return (
                                      <button
                                        key={addon.id}
                                        type="button"
                                        onClick={() => toggleAddon(service.id, addon)}
                                        className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                                          addonSelected
                                            ? 'border-neutral-900 bg-neutral-50'
                                            : 'hover:bg-muted/50'
                                        }`}
                                      >
                                        <div
                                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                                            addonSelected
                                              ? 'bg-neutral-900 border-neutral-900'
                                              : 'border-neutral-300'
                                          }`}
                                        >
                                          {addonSelected && (
                                            <Check className="h-2.5 w-2.5 text-white" />
                                          )}
                                        </div>
                                        <span className="text-xs flex-1 leading-snug">
                                          {addon.name}
                                        </span>
                                        <span className="text-[11px] font-medium shrink-0 whitespace-nowrap">
                                          {addon.price === 0
                                            ? 'Grátis'
                                            : `+${formatCurrency(addon.price)}`}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {propertyServices.length === 0 && (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    Nenhum servico de imovel disponivel.
                  </div>
                )}

                {/* Subtotal bar */}
                {selectedServices.size > 0 && (
                  <div className="rounded-xl bg-neutral-900 text-white px-4 py-3 flex items-center justify-between">
                    <span className="text-sm">
                      {selectedServices.size} servico{selectedServices.size !== 1 ? 's' : ''}{' '}
                      seleccionado{selectedServices.size !== 1 ? 's' : ''}
                    </span>
                    <span className="text-sm font-bold">{formatCurrency(subtotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* ────────────────── STEP 3: Availability ────────────────── */}
            {step === 3 && (
              <div className="space-y-5">
                {/* Will you be present? */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Estará presente no local? *
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAvailability((prev) => ({ ...prev, will_be_present: true, replacement_name: '', replacement_phone: '' }))}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 transition-all ${
                        availability.will_be_present === true
                          ? 'border-neutral-900 bg-neutral-50 shadow-sm ring-1 ring-neutral-900/10'
                          : 'hover:border-neutral-300 hover:bg-muted/30'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        availability.will_be_present === true ? 'bg-neutral-900 text-white' : 'bg-muted'
                      }`}>
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Sim</p>
                        <p className="text-[10px] text-muted-foreground">Estarei presente</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvailability((prev) => ({ ...prev, will_be_present: false }))}
                      className={`flex items-center gap-2.5 rounded-xl border p-3 transition-all ${
                        availability.will_be_present === false
                          ? 'border-neutral-900 bg-neutral-50 shadow-sm ring-1 ring-neutral-900/10'
                          : 'hover:border-neutral-300 hover:bg-muted/30'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        availability.will_be_present === false ? 'bg-neutral-900 text-white' : 'bg-muted'
                      }`}>
                        <UserX className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium">Não</p>
                        <p className="text-[10px] text-muted-foreground">Alguém irá no meu lugar</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Replacement person */}
                {availability.will_be_present === false && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      Pessoa de contacto no local
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Nome *</Label>
                        <Input
                          className="rounded-lg mt-1 h-8 text-sm"
                          placeholder="Nome completo"
                          value={availability.replacement_name}
                          onChange={(e) => setAvailability((prev) => ({ ...prev, replacement_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Telemóvel *</Label>
                        <Input
                          className="rounded-lg mt-1 h-8 text-sm"
                          placeholder="9XX XXX XXX"
                          value={availability.replacement_phone}
                          onChange={(e) => setAvailability((prev) => ({ ...prev, replacement_phone: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Preferred dates with per-date time slot */}
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Datas e horários preferenciais
                  </Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        className="rounded-lg h-8 text-sm flex-1"
                        value={newDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setNewDate(e.target.value)}
                      />
                    </div>
                    {newDate && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {TIME_SLOTS.map((slot) => (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => {
                              const alreadyExists = availability.preferred_dates.some(
                                (entry) => entry.date === newDate && entry.time_slot === slot.key
                              )
                              if (!alreadyExists) {
                                setAvailability((prev) => ({
                                  ...prev,
                                  preferred_dates: [...prev.preferred_dates, { date: newDate, time_slot: slot.key }].sort(
                                    (a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot)
                                  ),
                                }))
                              }
                              setNewDate('')
                              setNewTimeSlot('')
                            }}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all hover:border-neutral-300 hover:bg-muted/30`}
                          >
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {availability.preferred_dates.length > 0 && (
                    <div className="space-y-1.5">
                      {availability.preferred_dates.map((entry, idx) => (
                        <div
                          key={`${entry.date}-${entry.time_slot}-${idx}`}
                          className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-800 text-xs font-medium px-2.5 py-1.5 rounded-full mr-1.5 mb-1"
                        >
                          <CalendarDays className="h-3 w-3" />
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', weekday: 'short' })}
                          <span className="text-muted-foreground">·</span>
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {TIME_SLOT_LABELS[entry.time_slot] || entry.time_slot}
                          <button
                            type="button"
                            onClick={() =>
                              setAvailability((prev) => ({
                                ...prev,
                                preferred_dates: prev.preferred_dates.filter((_, i) => i !== idx),
                              }))
                            }
                            className="ml-0.5 hover:text-red-600 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Observações adicionais
                  </Label>
                  <Textarea
                    className="rounded-xl resize-none text-sm"
                    rows={2}
                    placeholder="Ex: chave com o porteiro, tocar à campainha do 3.o andar..."
                    value={availability.notes}
                    onChange={(e) => setAvailability((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* ────────────────── STEP 4: Review ────────────────── */}
            {step === 4 && (
              <div className="space-y-4">
                {/* Property summary */}
                <div className="rounded-xl border bg-card/50 p-4 space-y-2">
                  <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Imovel
                  </h4>
                  <p className="text-sm font-semibold">
                    {selectedPropertyTitle || propertyInfo.address}
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                    {propertyInfo.address && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {propertyInfo.address}
                      </span>
                    )}
                    {propertyInfo.city && <span>| {propertyInfo.city}</span>}
                    {propertyInfo.postal_code && <span>| {propertyInfo.postal_code}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {propertyInfo.property_type && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {propertyInfo.property_type}
                      </Badge>
                    )}
                    {propertyInfo.typology && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {propertyInfo.typology}
                      </Badge>
                    )}
                    {propertyInfo.area_m2 && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        {propertyInfo.area_m2} m2
                      </Badge>
                    )}
                    {propertyInfo.has_exteriors && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        Exteriores
                      </Badge>
                    )}
                    {propertyInfo.has_facades && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        Fachadas
                      </Badge>
                    )}
                    {propertyInfo.is_occupied && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        Ocupado
                      </Badge>
                    )}
                    {propertyInfo.is_staged && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        Decorado
                      </Badge>
                    )}
                    {propertyInfo.parking_available && (
                      <Badge variant="secondary" className="rounded-full text-[10px]">
                        Estacionamento
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Services summary */}
                <div className="rounded-xl border bg-card/50 p-4 space-y-3">
                  <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5" />
                    Servicos
                    <span className="ml-auto text-[10px] rounded-full bg-muted px-2 py-0.5">
                      {selectedServices.size}
                    </span>
                  </h4>
                  {Array.from(selectedServices.values()).map((entry, idx) => (
                    <div key={entry.service.id}>
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entry.service.name}</span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                            {
                              MARKETING_CATEGORIES[
                                entry.service.category as keyof typeof MARKETING_CATEGORIES
                              ]
                            }
                          </span>
                        </div>
                        <span className="font-medium">{formatCurrency(entry.service.price)}</span>
                      </div>
                      {entry.selectedAddons.map((addon) => (
                        <div key={addon.id} className="flex justify-between text-sm pl-4 mt-1.5">
                          <span className="text-muted-foreground">+ {addon.name}</span>
                          <span className="font-medium">
                            {addon.price === 0 ? 'Gratis' : formatCurrency(addon.price)}
                          </span>
                        </div>
                      ))}
                      {idx < selectedServices.size - 1 && <Separator className="my-3" />}
                    </div>
                  ))}
                </div>

                {/* Availability summary */}
                <div className="rounded-xl border bg-card/50 p-4 space-y-2">
                  <h4 className="font-medium text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Disponibilidade
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      {availability.will_be_present ? (
                        <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <UserX className="h-3.5 w-3.5 text-amber-600" />
                      )}
                      <span>
                        {availability.will_be_present
                          ? 'Estará presente'
                          : `Substituído por ${availability.replacement_name || '—'} (${availability.replacement_phone || '—'})`}
                      </span>
                    </div>
                    {availability.preferred_dates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {availability.preferred_dates.map((entry, idx) => (
                          <Badge key={`${entry.date}-${entry.time_slot}-${idx}`} variant="secondary" className="rounded-full text-[10px]">
                            {new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })} · {TIME_SLOT_LABELS[entry.time_slot] || entry.time_slot}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {availability.notes && (
                      <p className="text-xs text-muted-foreground italic">{availability.notes}</p>
                    )}
                  </div>
                </div>

                {/* Total */}
                <div className="rounded-xl bg-neutral-900 text-white p-4">
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        {/* ── Footer navigation (always visible) ── */}
        <div className="border-t px-5 py-3 flex items-center justify-between gap-3 shrink-0 bg-background">
          {step > 1 ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setStep((s) => s - 1)}
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" />
              Anterior
            </Button>
          ) : (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          )}

          {step < 4 ? (
            <Button
              className="rounded-full px-6"
              disabled={
                step === 1 ? !canProceedStep1 :
                step === 2 ? !canProceedStep2 :
                step === 3 ? availability.will_be_present === null :
                false
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Seguinte
              <ChevronRight className="ml-1.5 h-4 w-4" />
            </Button>
          ) : (
            <Button className="rounded-full px-6" onClick={handleAddToCart}>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Adicionar ao Carrinho
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
