'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useProperty } from '@/hooks/use-property'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { toast } from 'sonner'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import { PropertyPlantasSection } from '@/components/properties/property-plantas-section'
import { PropertyPropostaTab } from '@/components/properties/property-proposta-tab'
import { PropertyImpicTab } from '@/components/properties/property-impic-tab'
import { PropertyFichasTab } from '@/components/properties/property-fichas-tab'
import { VisitForm } from '@/components/visits/visit-form'
import { DealDialog } from '@/components/deals/deal-dialog'
import { PropertyDescriptionGenerator } from '@/components/properties/property-description-generator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Loader2,
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  Car,
  Calendar,
  Building2,
  User,
  FileText,
  Layers,
  ClipboardList,
  Clock,
  ExternalLink,
  FolderOpen,
  Euro,
  ImageIcon,
  Users,
  Briefcase,
  Home,
  ArrowUpDown,
  Sun,
  Dumbbell,
  Warehouse,
  Trees,
  ShieldCheck,
  Plus,
  Phone,
  Mail,
  Trash2,
} from 'lucide-react'
import {
  formatCurrency,
  formatArea,
  formatDate,
  PROPERTY_TYPES,
  BUSINESS_TYPES,
  PROPERTY_CONDITIONS,
  ENERGY_CERTIFICATES,
  CONTRACT_REGIMES,
  PROCESS_STATUS,
  PROCESS_TYPES,
  PROPERTY_STATUS,
  TYPOLOGIES,
  SOLAR_ORIENTATIONS,
  VIEWS,
  EQUIPMENT,
  FEATURES,
} from '@/lib/constants'

const PROPERTY_STATUS_OPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(PROPERTY_STATUS).map(([k, v]) => [k, v.label])
)

// ─── Tab config ────────────────────────────────────────────────

type TabKey = 'resumo' | 'media' | 'interessados' | 'fichas' | 'documentos' | 'proprietarios' | 'processos'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'resumo', label: 'Resumo', icon: Home },
  { key: 'media', label: 'Media', icon: ImageIcon },
  { key: 'interessados', label: 'Interessados', icon: Users },
  { key: 'fichas', label: 'Fichas de Visita', icon: ClipboardList },
  { key: 'documentos', label: 'Documentos', icon: FileText },
  { key: 'proprietarios', label: 'Proprietários', icon: User },
  { key: 'processos', label: 'Processos', icon: ClipboardList },
]

type ProcessSubTab = 'angariacao' | 'venda' | 'impic'

const PROCESS_SUBTABS: { key: ProcessSubTab; label: string; icon: React.ElementType }[] = [
  { key: 'angariacao', label: 'Angariação', icon: FolderOpen },
  { key: 'venda', label: 'Proc. Venda', icon: FileText },
  { key: 'impic', label: 'IMPIC', icon: ShieldCheck },
]

type InteressadosSubTab = 'pipeline' | 'visitas' | 'propostas'

const INTERESSADOS_SUBTABS: { key: InteressadosSubTab; label: string }[] = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'visitas', label: 'Visitas' },
  { key: 'propostas', label: 'Propostas' },
]

const INTERESSADO_STATUS: Record<string, { label: string; color: string }> = {
  suggested: { label: 'Sugerido', color: 'bg-slate-500/15 text-slate-700' },
  sent: { label: 'Enviado', color: 'bg-blue-500/15 text-blue-700' },
  visited: { label: 'Visitou', color: 'bg-amber-500/15 text-amber-700' },
  interested: { label: 'Interessado', color: 'bg-emerald-500/15 text-emerald-700' },
  discarded: { label: 'Descartado', color: 'bg-red-500/15 text-red-700' },
}

// ─── Main Component ────────────────────────────────────────────

export default function ImovelDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { property, isLoading, refetch } = useProperty(id)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [processes, setProcesses] = useState<any[]>([])
  const [processesLoading, setProcessesLoading] = useState(true)
  const [visits, setVisits] = useState<any[]>([])
  const [visitsLoading, setVisitsLoading] = useState(true)
  const [propostas, setPropostas] = useState<any[]>([])
  const [propostasLoading, setPropostasLoading] = useState(true)
  const [deals, setDeals] = useState<any[]>([])
  const [dealsLoading, setDealsLoading] = useState(true)
  const [showPropostaDialog, setShowPropostaDialog] = useState(false)
  const [showVisitDialog, setShowVisitDialog] = useState(false)
  const [showFechoDialog, setShowFechoDialog] = useState(false)
  const [resumeDealId, setResumeDealId] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<any>(null)
  const [interessados, setInteressados] = useState<{ linked: any[]; suggestions: any[] }>({ linked: [], suggestions: [] })
  const [interessadosLoading, setInteressadosLoading] = useState(true)
  const [interessadosSubTab, setInteressadosSubTab] = useState<InteressadosSubTab>('pipeline')
  const [resumoSection, setResumoSection] = useState<'info' | 'specs' | 'financeiro'>('info')
  const [activeTab, setActiveTab] = useState<TabKey>('resumo')
  const [processSubTab, setProcessSubTab] = useState<ProcessSubTab>('angariacao')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [consultantsList, setConsultantsList] = useState<{ id: string; commercial_name: string }[]>([])

  useEffect(() => {
    fetch('/api/consultants?per_page=100&status=active')
      .then(r => r.json())
      .then(d => setConsultantsList(d.data || []))
      .catch(() => {})
  }, [])

  // Initialize editData from property when entering edit mode
  const startEditing = useCallback(() => {
    if (!property) return
    const s = property.dev_property_specifications
    const i = property.dev_property_internal
    setEditData({
      // property
      consultant_id: property.consultant_id ?? '',
      status: property.status ?? 'pending_approval',
      show_on_website: (property as any).show_on_website ?? true,
      title: property.title ?? '', description: property.description ?? '',
      property_type: property.property_type ?? '', business_type: property.business_type ?? '',
      listing_price: property.listing_price ?? '', property_condition: property.property_condition ?? '',
      energy_certificate: property.energy_certificate ?? '', external_ref: property.external_ref ?? '',
      address_street: property.address_street ?? '', postal_code: property.postal_code ?? '',
      city: property.city ?? '', zone: property.zone ?? '',
      url_infinity: (property as any).link_portal_infinity ?? '', url_remax: (property as any).link_portal_remax ?? '', url_idealista: (property as any).link_portal_idealista ?? '', url_imovirtual: (property as any).link_portal_imovirtual ?? '',
      // specs
      typology: s?.typology ?? '', bedrooms: s?.bedrooms ?? '', bathrooms: s?.bathrooms ?? '',
      area_gross: s?.area_gross ?? '', area_util: s?.area_util ?? '',
      construction_year: s?.construction_year ?? '',
      parking_spaces: s?.parking_spaces ?? '', garage_spaces: s?.garage_spaces ?? '',
      has_elevator: s?.has_elevator ?? false, fronts_count: s?.fronts_count ?? '',
      features: s?.features ?? [], solar_orientation: s?.solar_orientation ?? [],
      views: s?.views ?? [], equipment: s?.equipment ?? [],
      storage_area: s?.storage_area ?? '', balcony_area: s?.balcony_area ?? '',
      pool_area: s?.pool_area ?? '', attic_area: s?.attic_area ?? '',
      pantry_area: s?.pantry_area ?? '', gym_area: s?.gym_area ?? '',
      // internal
      commission_agreed: i?.commission_agreed ?? '', commission_type: i?.commission_type || 'percentage',
      contract_regime: i?.contract_regime ?? '', contract_term: i?.contract_term ?? '',
      contract_expiry: i?.contract_expiry ?? '',
      imi_value: i?.imi_value ?? '', condominium_fee: i?.condominium_fee ?? '',
      cpcv_percentage: i?.cpcv_percentage ?? '', internal_notes: i?.internal_notes ?? '',
      exact_address: i?.exact_address ?? '', internal_postal_code: i?.postal_code ?? '',
      reference_internal: i?.reference_internal ?? '',
    })
    setIsEditing(true)
  }, [property])

  const cancelEditing = () => { setIsEditing(false); setEditData({}) }

  const updateField = (field: string, value: any) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const toggleArrayField = (field: string, item: string) => {
    setEditData(prev => {
      const arr: string[] = prev[field] || []
      return { ...prev, [field]: arr.includes(item) ? arr.filter((x: string) => x !== item) : [...arr, item] }
    })
  }

  // Helpers for building the payload
  const str = (v: any): string | undefined => (v !== undefined && v !== '' ? String(v) : undefined)
  const num = (v: any): number | undefined => (v !== undefined && v !== '' && !isNaN(Number(v)) ? Number(v) : undefined)

  const saveChanges = async () => {
    setIsSaving(true)
    try {
      const d = editData
      const propertyPayload: Record<string, any> = {
        consultant_id: str(d.consultant_id),
        status: str(d.status),
        title: d.title || undefined,
        description: str(d.description),
        property_type: str(d.property_type),
        business_type: str(d.business_type),
        listing_price: num(d.listing_price),
        property_condition: str(d.property_condition),
        energy_certificate: str(d.energy_certificate),
        external_ref: str(d.external_ref),
        address_street: str(d.address_street),
        postal_code: str(d.postal_code),
        city: str(d.city),
        zone: str(d.zone),
        contract_regime: str(d.contract_regime),
        link_portal_infinity: str(d.url_infinity),
        link_portal_remax: str(d.url_remax),
        link_portal_idealista: str(d.url_idealista),
        link_portal_imovirtual: str(d.url_imovirtual),
        show_on_website: d.show_on_website,
      }
      // Remove undefined keys
      for (const k of Object.keys(propertyPayload)) {
        if (propertyPayload[k] === undefined) delete propertyPayload[k]
      }

      const specsPayload: Record<string, any> = {
        typology: str(d.typology), bedrooms: num(d.bedrooms), bathrooms: num(d.bathrooms),
        area_gross: num(d.area_gross), area_util: num(d.area_util),
        construction_year: num(d.construction_year),
        parking_spaces: num(d.parking_spaces), garage_spaces: num(d.garage_spaces),
        has_elevator: d.has_elevator ?? false, fronts_count: num(d.fronts_count),
        features: d.features?.length ? d.features : undefined,
        solar_orientation: d.solar_orientation?.length ? d.solar_orientation : undefined,
        views: d.views?.length ? d.views : undefined,
        equipment: d.equipment?.length ? d.equipment : undefined,
        storage_area: num(d.storage_area), balcony_area: num(d.balcony_area),
        pool_area: num(d.pool_area), attic_area: num(d.attic_area),
        pantry_area: num(d.pantry_area), gym_area: num(d.gym_area),
      }
      for (const k of Object.keys(specsPayload)) {
        if (specsPayload[k] === undefined) delete specsPayload[k]
      }

      const internalPayload: Record<string, any> = {
        commission_agreed: num(d.commission_agreed), commission_type: str(d.commission_type),
        contract_regime: str(d.contract_regime), contract_term: str(d.contract_term),
        contract_expiry: str(d.contract_expiry),
        imi_value: num(d.imi_value), condominium_fee: num(d.condominium_fee),
        cpcv_percentage: num(d.cpcv_percentage), internal_notes: str(d.internal_notes),
        exact_address: str(d.exact_address), postal_code: str(d.internal_postal_code),
        reference_internal: str(d.reference_internal),
      }
      for (const k of Object.keys(internalPayload)) {
        if (internalPayload[k] === undefined) delete internalPayload[k]
      }

      const res = await fetch(`/api/properties/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: Object.keys(propertyPayload).length > 0 ? propertyPayload : undefined,
          specifications: Object.keys(specsPayload).length > 0 ? specsPayload : undefined,
          internal: Object.keys(internalPayload).length > 0 ? internalPayload : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao guardar')
      }

      toast.success('Imóvel actualizado com sucesso')
      setIsEditing(false)
      setEditData({})
      refetch()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar alterações')
    } finally {
      setIsSaving(false)
    }
  }

  // Load process data
  useEffect(() => {
    if (!id) return
    setProcessesLoading(true)
    fetch(`/api/processes?property_id=${id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { setProcesses(Array.isArray(data) ? data : data?.data || []) })
      .catch(() => setProcesses([]))
      .finally(() => setProcessesLoading(false))
  }, [id])

  // Load visits
  const fetchVisits = useCallback(() => {
    if (!id) return
    setVisitsLoading(true)
    fetch(`/api/properties/${id}/visits`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setVisits(Array.isArray(d) ? d : []))
      .catch(() => setVisits([]))
      .finally(() => setVisitsLoading(false))
  }, [id])

  // Load propostas
  const fetchPropostas = useCallback(() => {
    if (!id) return
    setPropostasLoading(true)
    fetch(`/api/properties/${id}/propostas`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setPropostas(Array.isArray(d) ? d : []))
      .catch(() => setPropostas([]))
      .finally(() => setPropostasLoading(false))
  }, [id])

  // Load deals (proc. venda)
  const fetchDeals = useCallback(() => {
    if (!id) return
    setDealsLoading(true)
    fetch(`/api/deals?property_id=${id}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDeals(Array.isArray(d) ? d : []))
      .catch(() => setDeals([]))
      .finally(() => setDealsLoading(false))
  }, [id])

  const fetchInteressados = useCallback(() => {
    if (!id) return
    setInteressadosLoading(true)
    fetch(`/api/properties/${id}/interessados`)
      .then((r) => r.ok ? r.json() : { linked: [], suggestions: [] })
      .then((d) => setInteressados({ linked: d.linked || [], suggestions: d.suggestions || [] }))
      .catch(() => setInteressados({ linked: [], suggestions: [] }))
      .finally(() => setInteressadosLoading(false))
  }, [id])

  useEffect(() => { fetchVisits() }, [fetchVisits])
  useEffect(() => { fetchPropostas() }, [fetchPropostas])
  useEffect(() => { fetchDeals() }, [fetchDeals])
  useEffect(() => { fetchInteressados() }, [fetchInteressados])

  // Init map
  useEffect(() => {
    if (activeTab !== 'resumo') return
    if (!property?.latitude || !property?.longitude || !mapContainerRef.current) return
    if (mapRef.current) return

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [property.longitude!, property.latitude!],
        zoom: 15,
        interactive: false,
      })

      new mapboxgl.Marker()
        .setLngLat([property.longitude!, property.latitude!])
        .addTo(map)

      mapRef.current = map
    }

    initMap()
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [activeTab, property?.latitude, property?.longitude])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-28 rounded-full" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar
        </button>
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold">Imóvel não encontrado</h2>
          <p className="text-muted-foreground">O imóvel que procura não existe ou foi eliminado.</p>
        </div>
      </div>
    )
  }

  const specs = property.dev_property_specifications
  const internal = property.dev_property_internal
  const propertyImages = (property.dev_property_media || []).filter((m: any) => m.media_type !== 'planta')
  const coverImage = propertyImages.find((m: any) => m.is_cover)?.url
    || propertyImages[0]?.url

  return (
    <div className="space-y-5">
      {/* ═══════ HERO HEADER with tabs inside ═══════ */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900">
        {coverImage && (
          <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: `url('${coverImage}')` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/95 via-neutral-900/60 to-neutral-900/30" />

        <div className="relative z-10 px-6 sm:px-8 pt-5 pb-5 flex flex-col justify-between" style={{ minHeight: '16rem' }}>
          {/* Top row: back + edit toggle */}
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/dashboard/imoveis')} className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
            <div className="flex items-center gap-2">
              {isEditing && (
                <>
                  <button onClick={cancelEditing} className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-red-500/20 backdrop-blur-sm border border-red-400/30 text-red-300 hover:bg-red-500/30 transition-all" title="Cancelar"><X className="h-4 w-4" /></button>
                  <button onClick={saveChanges} disabled={isSaving} className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50" title="Guardar">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                </>
              )}
              <button onClick={() => isEditing ? cancelEditing() : startEditing()} className={cn('inline-flex items-center justify-center h-8 w-8 rounded-full backdrop-blur-sm border transition-all', isEditing ? 'bg-white/30 border-white/40 text-white ring-2 ring-white/20' : 'bg-white/15 border-white/20 text-white hover:bg-white/25')} title={isEditing ? 'Sair de edição' : 'Editar'}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Property info */}
          <div className="mt-auto">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isEditing ? (
                <select value={editData.status || property.status || 'pending_approval'} onChange={(e) => updateField('status', e.target.value)} className="text-[11px] font-bold rounded-full px-3 py-1 bg-white/20 backdrop-blur-sm text-white border border-white/30 focus:outline-none focus:ring-1 focus:ring-white/40 appearance-none cursor-pointer">
                  {Object.entries(PROPERTY_STATUS_OPTIONS).map(([k, v]) => (<option key={k} value={k} className="text-neutral-900">{v}</option>))}
                </select>
              ) : (
                <StatusBadge status={property.status || 'pending_approval'} type="property" />
              )}
              {property.business_type && (
                <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full', property.business_type === 'venda' ? 'bg-blue-500/30 text-blue-200 border border-blue-400/30' : property.business_type === 'arrendamento' ? 'bg-amber-500/30 text-amber-200 border border-amber-400/30' : 'bg-white/15 text-neutral-300 border border-white/20')}>
                  {BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type}
                </span>
              )}
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => updateField('show_on_website', !editData.show_on_website)}
                  className={cn('text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border transition-colors', editData.show_on_website ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/30' : 'bg-white/10 text-neutral-400 border-white/15')}
                >
                  {editData.show_on_website ? 'No Website' : 'Oculto do Website'}
                </button>
              ) : (
                (property as any).show_on_website === false && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-400/20">
                    Oculto do Website
                  </span>
                )
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">{property.title}</h1>
            {(property.city || property.zone || property.address_street) && (
              <div className="flex items-center gap-1.5 mt-1.5 text-neutral-300 text-sm">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[property.address_street, property.zone, property.city].filter(Boolean).join(', ')}
              </div>
            )}
            <div className="flex items-center gap-2.5 mt-1.5">
              {property.external_ref && (
                <span className="text-sm font-mono font-bold text-white/70 tracking-wide mr-1">ID: {property.external_ref}</span>
              )}
              {[
                  { key: 'infinity', url: (property as any).link_portal_infinity || `https://infinitygroup.pt/property/${property.slug || property.id}`, bg: 'bg-black', hover: 'hover:bg-neutral-800', icon: (<svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white"><path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L7.8 14.39c-.64.64-1.49.99-2.4.99-1.87 0-3.39-1.51-3.39-3.38S3.53 8.62 5.4 8.62c.91 0 1.76.35 2.44 1.03l1.13 1 1.51-1.34L9.22 8.2C8.2 7.18 6.84 6.62 5.4 6.62 2.42 6.62 0 9.04 0 12s2.42 5.38 5.4 5.38c1.44 0 2.8-.56 3.77-1.53l7.03-6.24c.64-.64 1.49-.99 2.4-.99 1.87 0 3.39 1.51 3.39 3.38s-1.52 3.38-3.39 3.38c-.9 0-1.76-.35-2.44-1.03l-1.14-1.01-1.51 1.34 1.27 1.12c1.02 1.01 2.37 1.57 3.82 1.57 2.98 0 5.4-2.41 5.4-5.38s-2.42-5.37-5.4-5.37z"/></svg>) },
                  { key: 'remax', url: (property as any).link_portal_remax || (property.external_ref ? `https://www.remax.pt/${property.external_ref}` : null), bg: 'bg-blue-600', hover: 'hover:bg-blue-700', icon: (<svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#EF4444"/></svg>) },
                  { key: 'idealista', url: (property as any).link_portal_idealista || null, bg: 'bg-yellow-400', hover: 'hover:bg-yellow-300', icon: (<svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#000"/></svg>) },
                  { key: 'imovirtual', url: (property as any).link_portal_imovirtual || null, bg: 'bg-red-500', hover: 'hover:bg-red-600', icon: (<svg viewBox="0 0 24 24" className="h-3.5 w-3.5"><path d="M12 2L3 9v12h6v-7h6v7h6V9L12 2z" fill="#fff"/></svg>) },
                ].map((portal) => (
                  <a
                    key={portal.key}
                    href={portal.url || '#'}
                    target={portal.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    onClick={(e) => { if (!portal.url) e.preventDefault() }}
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${portal.bg} ${portal.hover} transition-all ${portal.url ? 'opacity-100 shadow-md' : 'opacity-30 cursor-not-allowed'}`}
                    title={portal.key.charAt(0).toUpperCase() + portal.key.slice(1)}
                  >
                    {portal.icon}
                  </a>
                ))}
            </div>
            <div className="flex items-center gap-3 sm:gap-5 mt-3 flex-wrap">
              <HeroStat icon={Euro} value={formatCurrency(property.listing_price)} className="text-white font-bold text-lg" />
              {specs?.typology && <HeroStat icon={Building2} value={specs.typology} />}
              {specs?.bedrooms != null && <HeroStat icon={BedDouble} value={`${specs.bedrooms} quartos`} />}
              {specs?.bathrooms != null && <HeroStat icon={Bath} value={`${specs.bathrooms} WC`} />}
              {specs?.area_util && <HeroStat icon={Maximize} value={formatArea(specs.area_util)} />}
              {(specs?.parking_spaces || specs?.garage_spaces) && <HeroStat icon={Car} value={`${(specs?.parking_spaces || 0) + (specs?.garage_spaces || 0)} lug.`} />}
            </div>
          </div>

          {/* Tab selector — inside hero */}
          <div className="flex items-center gap-1 p-1 mt-4 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 overflow-x-auto scrollbar-hide w-fit max-w-full">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className={cn('inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300', activeTab === t.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-300 hover:text-white hover:bg-white/10')}>
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════ TAB CONTENT ═══════ */}

      {/* ─── Resumo (includes specs + financeiro + location) ─── */}
      {activeTab === 'resumo' && (
        <div className={cn('rounded-xl border shadow-sm animate-in fade-in duration-300 overflow-hidden', isEditing ? 'bg-card ring-1 ring-primary/10' : 'bg-card')}>
          {/* Sub-section tabs */}
          <div className="flex items-center gap-1 p-1 m-4 mb-0 rounded-full bg-muted/50 border border-border/30 w-fit">
            {([['info', 'Geral'], ['specs', 'Especificações'], ['financeiro', 'Financeiro']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setResumoSection(key)} className={cn('px-3.5 py-1 rounded-full text-[11px] font-medium transition-all', resumoSection === key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-5">
            {/* ── Geral & Localização ── */}
            {resumoSection === 'info' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <SectionTitle>Informações Gerais</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoChip label="Tipo" value={PROPERTY_TYPES[property.property_type as keyof typeof PROPERTY_TYPES] || property.property_type} editing={isEditing} editValue={editData.property_type} onChange={(v) => updateField('property_type', v)} type="select" options={PROPERTY_TYPES} />
                      <InfoChip label="Negócio" value={BUSINESS_TYPES[property.business_type as keyof typeof BUSINESS_TYPES] || property.business_type} editing={isEditing} editValue={editData.business_type} onChange={(v) => updateField('business_type', v)} type="select" options={BUSINESS_TYPES} />
                      <InfoChip label="Condição" value={PROPERTY_CONDITIONS[property.property_condition as keyof typeof PROPERTY_CONDITIONS] || property.property_condition} editing={isEditing} editValue={editData.property_condition} onChange={(v) => updateField('property_condition', v)} type="select" options={PROPERTY_CONDITIONS} />
                      <InfoChip label="Certificado" value={ENERGY_CERTIFICATES[property.energy_certificate as keyof typeof ENERGY_CERTIFICATES] || property.energy_certificate} editing={isEditing} editValue={editData.energy_certificate} onChange={(v) => updateField('energy_certificate', v)} type="select" options={ENERGY_CERTIFICATES} />
                      <InfoChip label="Referência" value={property.external_ref} editing={isEditing} editValue={editData.external_ref} onChange={(v) => updateField('external_ref', v)} />
                      <InfoChip label="Consultor" value={property.consultant?.commercial_name} editing={isEditing} editValue={editData.consultant_id} onChange={(v) => updateField('consultant_id', v)} type="select" options={Object.fromEntries(consultantsList.map(c => [c.id, c.commercial_name]))} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <SectionTitle icon={MapPin}>Localização</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoChip label="Morada" value={property.address_street} editing={isEditing} editValue={editData.address_street} onChange={(v) => updateField('address_street', v)} />
                      <InfoChip label="Código Postal" value={property.postal_code} editing={isEditing} editValue={editData.postal_code} onChange={(v) => updateField('postal_code', v)} />
                      <InfoChip label="Cidade" value={property.city} editing={isEditing} editValue={editData.city} onChange={(v) => updateField('city', v)} />
                      <InfoChip label="Zona" value={property.zone} editing={isEditing} editValue={editData.zone} onChange={(v) => updateField('zone', v)} />
                    </div>
                    {property.latitude && property.longitude && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property.address_street, property.city].filter(Boolean).join(', '))}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 rounded-full px-3 py-1.5 transition-colors">
                        <ExternalLink className="h-3 w-3" /> Ver no Google Maps
                      </a>
                    )}
                  </div>
                </div>
                {property.latitude && property.longitude && (
                  <div ref={mapContainerRef} className="h-[200px] rounded-xl overflow-hidden border" />
                )}
                <div className="flex items-center gap-4 pt-2 border-t text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Criado: {formatDate(property.created_at)}</span>
                  {property.updated_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Actualizado: {formatDate(property.updated_at)}</span>}
                </div>
              </div>
            )}

            {/* ── Especificações ── */}
            {resumoSection === 'specs' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {isEditing ? (
                    <>
                      <InfoChip label="Tipologia" value={specs?.typology} editing editValue={editData.typology} onChange={(v) => updateField('typology', v)} type="select" options={Object.fromEntries(TYPOLOGIES.map(t => [t, t]))} />
                      <InfoChip label="Quartos" value={specs?.bedrooms} editing editValue={editData.bedrooms} onChange={(v) => updateField('bedrooms', v)} type="number" />
                      <InfoChip label="WC" value={specs?.bathrooms} editing editValue={editData.bathrooms} onChange={(v) => updateField('bathrooms', v)} type="number" />
                      <InfoChip label="Área bruta m²" value={specs?.area_gross ? formatArea(specs.area_gross) : undefined} editing editValue={editData.area_gross} onChange={(v) => updateField('area_gross', v)} type="number" />
                      <InfoChip label="Área útil m²" value={specs?.area_util ? formatArea(specs.area_util) : undefined} editing editValue={editData.area_util} onChange={(v) => updateField('area_util', v)} type="number" />
                      <InfoChip label="Ano" value={specs?.construction_year} editing editValue={editData.construction_year} onChange={(v) => updateField('construction_year', v)} type="number" />
                      <InfoChip label="Estac." value={specs?.parking_spaces} editing editValue={editData.parking_spaces} onChange={(v) => updateField('parking_spaces', v)} type="number" />
                      <InfoChip label="Garagens" value={specs?.garage_spaces} editing editValue={editData.garage_spaces} onChange={(v) => updateField('garage_spaces', v)} type="number" />
                    </>
                  ) : (
                    <>
                      <StatCard icon={Layers} label="Tipologia" value={specs?.typology} />
                      <StatCard icon={BedDouble} label="Quartos" value={specs?.bedrooms} />
                      <StatCard icon={Bath} label="WC" value={specs?.bathrooms} />
                      <StatCard icon={Maximize} label="Área bruta" value={specs?.area_gross ? formatArea(specs.area_gross) : undefined} />
                      <StatCard icon={Maximize} label="Área útil" value={specs?.area_util ? formatArea(specs.area_util) : undefined} />
                      <StatCard icon={Calendar} label="Ano" value={specs?.construction_year} />
                      <StatCard icon={Car} label="Estac." value={specs?.parking_spaces} />
                      <StatCard icon={Car} label="Garagens" value={specs?.garage_spaces} />
                    </>
                  )}
                </div>
                <div className="space-y-4 pt-2">
                  {!isEditing && specs?.has_elevator && <BoolBadge label="Elevador" value />}
                  {!isEditing && specs?.fronts_count ? <span className="text-xs bg-muted rounded-full px-3 py-1 font-medium">{specs.fronts_count} frente{specs.fronts_count !== 1 ? 's' : ''}</span> : null}
                  <PropertyAmenityGrid label="Características" allItems={[...FEATURES]} selected={isEditing ? (editData.features || []) : (specs?.features || [])} isEditing={isEditing} onToggle={(item) => toggleArrayField('features', item)} />
                  <PropertyAmenityGrid label="Equipamento" allItems={[...EQUIPMENT]} selected={isEditing ? (editData.equipment || []) : (specs?.equipment || [])} isEditing={isEditing} onToggle={(item) => toggleArrayField('equipment', item)} />
                  <PropertyAmenityGrid label="Orientação Solar" allItems={[...SOLAR_ORIENTATIONS]} selected={isEditing ? (editData.solar_orientation || []) : (specs?.solar_orientation || [])} isEditing={isEditing} onToggle={(item) => toggleArrayField('solar_orientation', item)} />
                  <PropertyAmenityGrid label="Vistas" allItems={[...VIEWS]} selected={isEditing ? (editData.views || []) : (specs?.views || [])} isEditing={isEditing} onToggle={(item) => toggleArrayField('views', item)} />
                </div>
              </div>
            )}

            {/* ── Financeiro ── */}
            {resumoSection === 'financeiro' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-4">
                    <SectionTitle icon={Euro}>Preço & Comissão</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoChip label="Preço" value={formatCurrency(property.listing_price)} editing={isEditing} editValue={editData.listing_price} onChange={(v) => updateField('listing_price', v)} type="number" />
                      <InfoChip label="Comissão" value={internal?.commission_agreed ? (internal.commission_type === 'percentage' ? `${internal.commission_agreed}%` : formatCurrency(Number(internal.commission_agreed))) : undefined} editing={isEditing} editValue={editData.commission_agreed} onChange={(v) => updateField('commission_agreed', v)} type="number" />
                      <InfoChip label="Tipo Comissão" value={internal?.commission_type === 'percentage' ? 'Percentagem' : 'Valor fixo'} editing={isEditing} editValue={editData.commission_type} onChange={(v) => updateField('commission_type', v)} type="select" options={{ percentage: 'Percentagem', fixed: 'Valor fixo' }} />
                      <InfoChip label="CPCV %" value={internal?.cpcv_percentage != null ? `${internal.cpcv_percentage}%` : undefined} editing={isEditing} editValue={editData.cpcv_percentage} onChange={(v) => updateField('cpcv_percentage', v)} type="number" />
                    </div>
                    <SectionTitle>Encargos</SectionTitle>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoChip label="IMI Anual" value={internal?.imi_value ? formatCurrency(Number(internal.imi_value)) : undefined} editing={isEditing} editValue={editData.imi_value} onChange={(v) => updateField('imi_value', v)} type="number" />
                      <InfoChip label="Condomínio/mês" value={internal?.condominium_fee ? formatCurrency(Number(internal.condominium_fee)) : undefined} editing={isEditing} editValue={editData.condominium_fee} onChange={(v) => updateField('condominium_fee', v)} type="number" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <SectionTitle>Contrato</SectionTitle>
                    <div className="space-y-3">
                      <InfoChip label="Regime" value={CONTRACT_REGIMES[internal?.contract_regime as keyof typeof CONTRACT_REGIMES] || internal?.contract_regime} editing={isEditing} editValue={editData.contract_regime} onChange={(v) => updateField('contract_regime', v)} type="select" options={CONTRACT_REGIMES} />
                      <InfoChip label="Duração" value={internal?.contract_term} editing={isEditing} editValue={editData.contract_term} onChange={(v) => updateField('contract_term', v)} />
                      <InfoChip label="Validade" value={internal?.contract_expiry ? formatDate(internal.contract_expiry) : undefined} editing={isEditing} editValue={editData.contract_expiry} onChange={(v) => updateField('contract_expiry', v)} />
                    </div>
                    <SectionTitle>Notas Internas</SectionTitle>
                    {isEditing ? (
                      <textarea value={editData.internal_notes ?? ''} onChange={(e) => updateField('internal_notes', e.target.value)} rows={3} className="w-full text-sm bg-muted/30 rounded-lg border border-border/50 p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y" placeholder="Notas internas..." />
                    ) : (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{internal?.internal_notes || '—'}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Media (includes description + portal links) ─── */}
      {activeTab === 'media' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Portal links + Gallery — same card */}
          <div className="rounded-xl border bg-card shadow-sm p-5 space-y-5">
            {isEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium shrink-0">Idealista</span>
                <input value={editData.url_idealista ?? ''} onChange={(e) => updateField('url_idealista', e.target.value)} placeholder="https://..." className="text-xs bg-muted/30 border border-border/50 rounded-full px-3 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                <span className="text-[10px] text-muted-foreground font-medium shrink-0">Imovirtual</span>
                <input value={editData.url_imovirtual ?? ''} onChange={(e) => updateField('url_imovirtual', e.target.value)} placeholder="https://..." className="text-xs bg-muted/30 border border-border/50 rounded-full px-3 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Infinity', url: `https://infinitygroup.pt/property/${property.slug || property.id}`, bg: 'bg-neutral-900', text: 'text-white', hover: 'hover:bg-neutral-800', border: 'border-neutral-700' },
                  { label: 'RE/MAX', url: (property as any).link_portal_remax || (property.external_ref ? `https://www.remax.pt/${property.external_ref}` : null), bg: 'bg-blue-700', text: 'text-white', hover: 'hover:bg-blue-800', border: 'border-blue-600' },
                  { label: 'Idealista', url: (property as any).link_portal_idealista || null, bg: 'bg-yellow-500', text: 'text-yellow-950', hover: 'hover:bg-yellow-400', border: 'border-yellow-400' },
                  { label: 'Imovirtual', url: (property as any).link_portal_imovirtual || null, bg: 'bg-sky-500', text: 'text-white', hover: 'hover:bg-sky-600', border: 'border-sky-400' },
                ].map(portal => (
                  <a
                    key={portal.label}
                    href={portal.url || '#'}
                    target={portal.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1.5 border shadow-sm transition-all',
                      portal.url
                        ? `${portal.bg} ${portal.text} ${portal.hover} ${portal.border}`
                        : 'bg-muted/60 text-muted-foreground border-border cursor-not-allowed opacity-40'
                    )}
                    onClick={(e) => { if (!portal.url) e.preventDefault() }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    {portal.label}
                  </a>
                ))}
              </div>
            )}

            <PropertyMediaGallery
              propertyId={property.id}
              media={(property.dev_property_media || []).filter((m: any) => m.media_type !== 'planta')}
              onMediaChange={refetch}
            />

            {/* Description — inside same card */}
            <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Descrição</h3>
                  {isEditing && (
                    <PropertyDescriptionGenerator
                      propertyId={property.id}
                      property={property}
                      existingDescription={property.description || ''}
                      onUseDescription={async (desc) => {
                        updateField('description', desc)
                        try {
                          await fetch(`/api/properties/${property.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ description: desc }),
                          })
                          await refetch()
                        } catch {
                          toast.error('Erro ao guardar descrição')
                        }
                      }}
                    />
                  )}
                </div>
                <DescriptionContent
                  text={isEditing ? editData.description ?? property.description ?? '' : property.description || ''}
                  editing={isEditing}
                  onChange={(v) => updateField('description', v)}
                />
              </div>

            {/* Plantas */}
            <PropertyPlantasSection
              propertyId={property.id}
              plantas={(property.dev_property_media || []).filter((m: any) => m.media_type === 'planta')}
              onMediaChange={refetch}
            />
          </div>
        </div>
      )}

      {/* ─── Interessados (pipeline + visitas + propostas) ─── */}
      {activeTab === 'interessados' && (
        <div className="rounded-xl border bg-card shadow-sm animate-in fade-in duration-300 overflow-hidden">
          {/* Sub-tab selector */}
          <div className="flex items-center gap-1 p-1 m-4 mb-0 rounded-full bg-muted/50 border border-border/30 w-fit">
            {INTERESSADOS_SUBTABS.map((st) => (
              <button key={st.key} onClick={() => setInteressadosSubTab(st.key)} className={cn('px-3.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all', interessadosSubTab === st.key ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                {st.label}
              </button>
            ))}
          </div>

          <div className="p-5 pt-4">
          {/* ══ Pipeline ══ */}
          {interessadosSubTab === 'pipeline' && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Linked interested buyers */}
              {interessadosLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : (
                <>
                  {interessados.linked.length > 0 && (
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interessados ({interessados.linked.length})</p>
                      </div>
                      <div className="divide-y">
                        {interessados.linked.map((link: any) => {
                          const neg = link.negocio
                          const lead = neg?.lead
                          const agent = neg?.agent
                          const st = INTERESSADO_STATUS[link.status] || { label: link.status, color: 'bg-muted text-muted-foreground' }
                          const firstName = (lead?.nome || lead?.name || 'Cliente').split(' ')[0]
                          return (
                            <div key={link.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0 text-sm font-bold text-primary">
                                {firstName[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{firstName}</span>
                                  <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5', st.color)}>{st.label}</span>
                                  {neg?.orcamento && <span className="text-[10px] bg-muted rounded-full px-2 py-0.5">{formatCurrency(Number(neg.orcamento))}</span>}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  {agent?.commercial_name && <span className="font-medium text-foreground">{agent.commercial_name}</span>}
                                </div>
                              </div>
                              {/* Call colleague button */}
                              {agent && (
                                <a href={`tel:${neg?.agent_profile?.phone_commercial || ''}`} className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 transition-colors shrink-0" title={`Ligar para ${agent.commercial_name}`}>
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {/* Status update buttons */}
                              <div className="flex items-center gap-1 shrink-0">
                                {['sent', 'visited', 'interested', 'discarded'].filter(s => s !== link.status).map(s => {
                                  const cfg = INTERESSADO_STATUS[s]
                                  return (
                                    <button key={s} onClick={async () => {
                                      await fetch(`/api/properties/${id}/interessados/${link.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }) })
                                      fetchInteressados()
                                    }} className={cn('text-[9px] font-medium rounded-full px-2 py-0.5 transition-colors hover:shadow-sm', cfg.color)} title={cfg.label}>
                                      {cfg.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {interessados.suggestions.length > 0 && (
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                      <div className="px-5 py-3 border-b bg-muted/30">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sugestões de Match ({interessados.suggestions.length})</p>
                      </div>
                      <div className="divide-y">
                        {interessados.suggestions.map((neg: any) => {
                          const lead = neg.lead
                          const firstName = (lead?.nome || lead?.name || 'Cliente').split(' ')[0]
                          return (
                            <div key={neg.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 shrink-0 text-sm font-bold text-amber-600">
                                {firstName[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{firstName}</span>
                                  {neg.orcamento && (
                                    <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5',
                                      neg.price_flag === 'green' ? 'bg-emerald-500/15 text-emerald-700' :
                                      neg.price_flag === 'yellow' ? 'bg-yellow-500/15 text-yellow-700' :
                                      neg.price_flag === 'orange' ? 'bg-orange-500/15 text-orange-700' :
                                      neg.price_flag === 'red' ? 'bg-red-500/15 text-red-700' : 'bg-muted'
                                    )}>{formatCurrency(Number(neg.orcamento_max || neg.orcamento))}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  {neg.agent?.commercial_name && <span className="font-medium text-foreground">{neg.agent.commercial_name}</span>}
                                </div>
                              </div>
                              {neg.agent && (
                                <a href={`tel:${neg.agent.commercial_name}`} className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 transition-colors shrink-0" title={`Ligar para ${neg.agent.commercial_name}`}>
                                  <Phone className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <Button size="sm" className="rounded-full gap-1 text-xs shrink-0" onClick={async () => {
                                await fetch(`/api/properties/${id}/interessados`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ negocio_id: neg.id }) })
                                toast.success('Interessado adicionado')
                                fetchInteressados()
                              }}>
                                <Plus className="h-3 w-3" /> Adicionar
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {interessados.linked.length === 0 && interessados.suggestions.length === 0 && (
                    <EmptySection icon={Users} message="Sem interessados nem sugestões de match. Os compradores que correspondem ao perfil deste imóvel aparecerão aqui automaticamente." />
                  )}
                </>
              )}
            </div>
          )}

          {/* ══ Visitas ══ */}
          {interessadosSubTab === 'visitas' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{visitsLoading ? '...' : `${visits.length} visita${visits.length !== 1 ? 's' : ''}`}</p>
                <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setShowVisitDialog(true)}>
                  <Plus className="h-3 w-3" /> Agendar Visita
                </Button>
              </div>
              {visitsLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : visits.length > 0 ? (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="divide-y">
                    {visits.map((v) => {
                      const VISIT_STATUS: Record<string, { label: string; color: string }> = { scheduled: { label: 'Agendada', color: 'bg-blue-500/15 text-blue-700' }, confirmed: { label: 'Confirmada', color: 'bg-emerald-500/15 text-emerald-700' }, completed: { label: 'Realizada', color: 'bg-slate-500/15 text-slate-700' }, cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-700' }, no_show: { label: 'Não compareceu', color: 'bg-amber-500/15 text-amber-700' } }
                      const st = VISIT_STATUS[v.status] || { label: v.status, color: 'bg-muted text-muted-foreground' }
                      return (
                        <div key={v.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 shrink-0"><Calendar className="h-4 w-4 text-blue-600" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{v.visit_date ? new Date(v.visit_date + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                              {v.visit_time && <span className="text-xs text-muted-foreground">{v.visit_time.slice(0, 5)}</span>}
                              <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5', st.color)}>{st.label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              {(v.client_name || v.lead?.nome || v.lead?.name) && <span className="flex items-center gap-1"><User className="h-3 w-3" />{v.client_name || v.lead?.nome || v.lead?.name}</span>}
                              {v.consultant?.commercial_name && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{v.consultant.commercial_name}</span>}
                            </div>
                          </div>
                          {v.feedback_rating && <div className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">{v.feedback_rating}/5</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <EmptySection icon={Calendar} message="Sem visitas registadas." />
              )}
            </div>
          )}

          {/* ══ Propostas ══ */}
          {interessadosSubTab === 'propostas' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{propostasLoading ? '...' : `${propostas.length} proposta${propostas.length !== 1 ? 's' : ''}`}</p>
                <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setShowPropostaDialog(true)}>
                  <Plus className="h-3 w-3" /> Nova Proposta
                </Button>
              </div>
              {propostasLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : propostas.length > 0 ? (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                  <div className="divide-y">
                    {propostas.map((p) => {
                      const PROPOSTA_STATUS: Record<string, { label: string; color: string }> = { rascunho: { label: 'Rascunho', color: 'bg-slate-500/15 text-slate-700' }, enviada: { label: 'Enviada', color: 'bg-blue-500/15 text-blue-700' }, aceite: { label: 'Aceite', color: 'bg-emerald-500/15 text-emerald-700' }, rejeitada: { label: 'Rejeitada', color: 'bg-red-500/15 text-red-700' }, expirada: { label: 'Expirada', color: 'bg-amber-500/15 text-amber-700' } }
                      const st = PROPOSTA_STATUS[p.status] || { label: p.status, color: 'bg-muted text-muted-foreground' }
                      const NATUREZAS: Record<string, string> = { propriedade_plena: 'Prop. Plena', arrendamento: 'Arrend.', cedencia_posicao: 'Ced. Posição', superficie: 'Superfície', outro: 'Outro' }
                      return (
                        <div key={p.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 shrink-0"><Briefcase className="h-4 w-4 text-violet-600" /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{formatCurrency(Number(p.preco))}</span>
                              <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5', st.color)}>{st.label}</span>
                              <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{NATUREZAS[p.natureza] || p.natureza}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              {p.proponente_nome && <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.proponente_nome}</span>}
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(p.created_at)}</span>
                            </div>
                          </div>
                          {p.pdf_url && <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-3.5 w-3.5" /></a>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <EmptySection icon={Briefcase} message="Sem propostas geradas. Clique em 'Nova Proposta' para criar." />
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* ─── Fichas de Visita ─── */}
      {activeTab === 'fichas' && property && (
        <div className="animate-in fade-in duration-300">
          <PropertyFichasTab
            propertyId={property.id}
            propertySlug={property.slug}
            listingPrice={property.listing_price ? Number(property.listing_price) : null}
          />
        </div>
      )}

      {/* ─── Documentos ─── */}
      {activeTab === 'documentos' && (
        <div className="animate-in fade-in duration-300">
          <EmptySection icon={FileText} message="Os documentos deste imóvel podem ser geridos aqui. Funcionalidade de upload em desenvolvimento." />
        </div>
      )}

      {/* ─── Proprietários ─── */}
      {activeTab === 'proprietarios' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
            <SectionTitle icon={Users}>Proprietários</SectionTitle>
            {property.property_owners?.length ? (
              <div className="space-y-2">
                {property.property_owners.map((po, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border/30 cursor-pointer hover:bg-muted/60 hover:shadow-sm transition-all"
                    onClick={() => setSelectedOwner(po)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{po.owners?.name || 'Proprietário'}</p>
                        {po.is_main_contact && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-medium rounded-full px-2 py-0.5">Contacto Principal</span>}
                        {po.owners?.person_type === 'coletiva' && <span className="text-[10px] font-medium bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">Empresa</span>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {po.owners?.nif && <span>NIF: {po.owners.nif}</span>}
                        {po.owners?.email && <span>{po.owners.email}</span>}
                        {po.owners?.phone && <span>{po.owners.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold bg-muted rounded-full px-3 py-1">{po.ownership_percentage}%</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum proprietário associado a este imóvel.</p>
            )}
          </div>

          {/* Owner detail sheet */}
          <Sheet open={!!selectedOwner} onOpenChange={(o) => { if (!o) setSelectedOwner(null) }}>
            <SheetContent className="sm:max-w-md overflow-y-auto p-0">
              {selectedOwner?.owners && (() => {
                const o = selectedOwner.owners
                const isCompany = o.person_type === 'coletiva'
                return (
                  <div className="flex flex-col">
                    {/* Header */}
                    <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 px-6 pt-8 pb-6 text-white shrink-0">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center text-lg font-bold">
                          {(o.name || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg leading-tight">{o.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {isCompany && <span className="text-[10px] font-medium bg-violet-500/30 text-violet-200 rounded-full px-2 py-0.5">Empresa</span>}
                            {selectedOwner.is_main_contact && <span className="text-[10px] font-medium bg-emerald-500/30 text-emerald-200 rounded-full px-2 py-0.5">Contacto Principal</span>}
                            <span className="text-neutral-400 text-xs">{selectedOwner.ownership_percentage}% propriedade</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-5 space-y-5">
                      {/* Contact */}
                      <div className="space-y-2">
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Contacto</p>
                        <div className="grid grid-cols-1 gap-2">
                          {o.email && <OwnerField icon={Mail} label="Email" value={o.email} />}
                          {o.phone && <OwnerField icon={Phone} label="Telemóvel" value={o.phone} />}
                          {o.nif && <OwnerField icon={FileText} label="NIF" value={o.nif} />}
                        </div>
                      </div>

                      {/* Identification */}
                      {(o.id_doc_type || o.nationality || o.birth_date) && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Identificação</p>
                          <div className="grid grid-cols-2 gap-2">
                            {o.nationality && <InfoChip label="Nacionalidade" value={o.nationality} />}
                            {o.naturality && <InfoChip label="Naturalidade" value={o.naturality} />}
                            {o.birth_date && <InfoChip label="Data Nascimento" value={formatDate(o.birth_date)} />}
                            {o.id_doc_type && <InfoChip label="Doc. Identificação" value={o.id_doc_type.toUpperCase()} />}
                            {o.id_doc_number && <InfoChip label="Nº Documento" value={o.id_doc_number} />}
                            {o.id_doc_expiry && <InfoChip label="Validade Doc." value={formatDate(o.id_doc_expiry)} />}
                            {o.id_doc_issued_by && <InfoChip label="Emitido por" value={o.id_doc_issued_by} />}
                            {o.marital_status && <InfoChip label="Estado Civil" value={o.marital_status} />}
                            {o.marital_regime && <InfoChip label="Regime Matrimonial" value={o.marital_regime} />}
                          </div>
                        </div>
                      )}

                      {/* Address */}
                      {(o.address || o.city) && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Morada</p>
                          <div className="grid grid-cols-2 gap-2">
                            {o.address && <InfoChip label="Morada" value={o.address} />}
                            {o.postal_code && <InfoChip label="Código Postal" value={o.postal_code} />}
                            {o.city && <InfoChip label="Cidade" value={o.city} />}
                            {o.is_portugal_resident != null && <InfoChip label="Residente PT" value={o.is_portugal_resident ? 'Sim' : 'Não'} />}
                            {o.residence_country && <InfoChip label="País Residência" value={o.residence_country} />}
                          </div>
                        </div>
                      )}

                      {/* Professional */}
                      {(o.profession || o.last_profession) && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Profissão</p>
                          <div className="grid grid-cols-2 gap-2">
                            {o.profession && <InfoChip label="Profissão" value={o.profession} />}
                            {o.last_profession && <InfoChip label="Última Profissão" value={o.last_profession} />}
                          </div>
                        </div>
                      )}

                      {/* Compliance / PEP */}
                      {(o.is_pep != null || o.funds_origin?.length) && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Compliance</p>
                          <div className="space-y-2">
                            {o.is_pep != null && (
                              <div className={cn('rounded-lg px-3 py-2 text-sm font-medium', o.is_pep ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')}>
                                PEP: {o.is_pep ? `Sim — ${o.pep_position || 'Cargo não especificado'}` : 'Não'}
                              </div>
                            )}
                            {o.funds_origin?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                <span className="text-[10px] text-muted-foreground mr-1">Origem fundos:</span>
                                {o.funds_origin.map((f: string) => (
                                  <span key={f} className="text-[10px] bg-muted rounded-full px-2 py-0.5 font-medium">{f}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Company info */}
                      {isCompany && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Dados Empresa</p>
                          <div className="grid grid-cols-2 gap-2">
                            {o.legal_representative_name && <InfoChip label="Representante Legal" value={o.legal_representative_name} />}
                            {o.legal_representative_nif && <InfoChip label="NIF Representante" value={o.legal_representative_nif} />}
                            {o.legal_nature && <InfoChip label="Natureza Jurídica" value={o.legal_nature} />}
                            {o.company_object && <InfoChip label="Objecto Social" value={o.company_object} />}
                            {o.cae_code && <InfoChip label="CAE" value={o.cae_code} />}
                            {o.rcbe_code && <InfoChip label="RCBE" value={o.rcbe_code} />}
                            {o.country_of_incorporation && <InfoChip label="País Constituição" value={o.country_of_incorporation} />}
                          </div>
                        </div>
                      )}

                      {/* Observations */}
                      {o.observations && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Observações</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{o.observations}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* ─── Processos (unified tab with sub-tabs) ─── */}
      {activeTab === 'processos' && (
        <div className="rounded-xl border bg-card shadow-sm animate-in fade-in duration-300 overflow-hidden">
          {/* Sub-tab selector */}
          <div className="flex items-center gap-1 p-1 m-4 mb-0 rounded-full bg-muted/50 border border-border/30 overflow-x-auto scrollbar-hide w-fit max-w-full">
            {PROCESS_SUBTABS.map((st) => {
              const Icon = st.icon
              return (
                <button
                  key={st.key}
                  onClick={() => setProcessSubTab(st.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all duration-300',
                    processSubTab === st.key
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {st.label}
                </button>
              )
            })}
          </div>

          <div className="p-5 pt-4">
          {/* ══ Sub-tab: Angariação ══ */}
          {processSubTab === 'angariacao' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {processesLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : processes.filter((p) => p.process_type === 'angariacao').length > 0 ? (
                processes.filter((p) => p.process_type === 'angariacao').map((proc) => {
                  const typeInfo = proc.process_type ? PROCESS_TYPES[proc.process_type as keyof typeof PROCESS_TYPES] : null
                  const percent = proc.percent_complete || 0
                  return (
                    <div key={proc.id} className="rounded-xl border bg-card shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => router.push(`/dashboard/processos/${proc.id}`)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><ClipboardList className="h-4 w-4 text-primary" /></div>
                          <div>
                            <p className="font-semibold text-sm">{proc.external_ref || 'Sem referência'}</p>
                            {typeInfo && <p className="text-xs text-muted-foreground">{typeInfo.label}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={proc.current_status} type="process" />
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Progresso</span><span className="font-medium">{percent}%</span></div>
                        <Progress value={percent} className="h-1.5" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {proc.tpl_processes?.name && <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{proc.tpl_processes.name}</span>}
                        {proc.requested_by_user?.commercial_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{proc.requested_by_user.commercial_name}</span>}
                        {proc.started_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(proc.started_at)}</span>}
                      </div>
                    </div>
                  )
                })
              ) : (
                <EmptySection icon={FolderOpen} message="Nenhum processo de angariação. Os processos serão criados quando o imóvel for submetido para aprovação." />
              )}
            </div>
          )}

          {/* removed: visitas + propostas moved to Interessados tab */}
          {false && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{visitsLoading ? '...' : `${visits.length} visita${visits.length !== 1 ? 's' : ''}`}</p>
                <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setShowVisitDialog(true)}>
                  <Plus className="h-3 w-3" /> Agendar Visita
                </Button>
              </div>
              {visitsLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : (
                <>
                  {visits.length > 0 ? (
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                      <div className="divide-y">
                        {visits.map((v) => {
                          const VISIT_STATUS: Record<string, { label: string; color: string }> = {
                            scheduled: { label: 'Agendada', color: 'bg-blue-500/15 text-blue-700' },
                            confirmed: { label: 'Confirmada', color: 'bg-emerald-500/15 text-emerald-700' },
                            completed: { label: 'Realizada', color: 'bg-slate-500/15 text-slate-700' },
                            cancelled: { label: 'Cancelada', color: 'bg-red-500/15 text-red-700' },
                            no_show: { label: 'Não compareceu', color: 'bg-amber-500/15 text-amber-700' },
                          }
                          const st = VISIT_STATUS[v.status] || { label: v.status, color: 'bg-muted text-muted-foreground' }
                          return (
                            <div key={v.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
                                <Calendar className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{v.visit_date ? new Date(v.visit_date + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                                  {v.visit_time && <span className="text-xs text-muted-foreground">{v.visit_time.slice(0, 5)}</span>}
                                  <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5', st.color)}>{st.label}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  {(v.client_name || v.lead?.nome || v.lead?.name) && <span className="flex items-center gap-1"><User className="h-3 w-3" />{v.client_name || v.lead?.nome || v.lead?.name}</span>}
                                  {v.consultant?.commercial_name && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{v.consultant.commercial_name}</span>}
                                  {(v.client_phone || v.lead?.telemovel || v.lead?.phone_primary) && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{v.client_phone || v.lead?.telemovel || v.lead?.phone_primary}</span>}
                                </div>
                                {v.notes && <p className="text-xs text-muted-foreground mt-1 italic truncate">{v.notes}</p>}
                              </div>
                              {v.feedback_rating && (
                                <div className="text-xs font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">{v.feedback_rating}/5</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <EmptySection icon={Calendar} message="Sem visitas registadas para este imóvel." />
                  )}
                </>
              )}
            </div>
          )}

          {/* removed: propostas moved to Interessados tab */}
          {false && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{propostasLoading ? '...' : `${propostas.length} proposta${propostas.length !== 1 ? 's' : ''}`}</p>
                <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setShowPropostaDialog(true)}>
                  <Plus className="h-3 w-3" /> Nova Proposta
                </Button>
              </div>
                  {propostasLoading ? (
                    <Skeleton className="h-32 w-full rounded-xl" />
                  ) : propostas.length > 0 ? (
                    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
                      <div className="divide-y">
                        {propostas.map((p) => {
                          const PROPOSTA_STATUS: Record<string, { label: string; color: string }> = {
                            rascunho: { label: 'Rascunho', color: 'bg-slate-500/15 text-slate-700' },
                            enviada: { label: 'Enviada', color: 'bg-blue-500/15 text-blue-700' },
                            aceite: { label: 'Aceite', color: 'bg-emerald-500/15 text-emerald-700' },
                            rejeitada: { label: 'Rejeitada', color: 'bg-red-500/15 text-red-700' },
                            expirada: { label: 'Expirada', color: 'bg-amber-500/15 text-amber-700' },
                          }
                          const st = PROPOSTA_STATUS[p.status] || { label: p.status, color: 'bg-muted text-muted-foreground' }
                          const NATUREZAS: Record<string, string> = { propriedade_plena: 'Propriedade Plena', arrendamento: 'Arrendamento', cedencia_posicao: 'Cedência Posição', superficie: 'Superfície', outro: 'Outro' }
                          return (
                            <div key={p.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 shrink-0">
                                <Briefcase className="h-4 w-4 text-violet-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{formatCurrency(Number(p.preco))}</span>
                                  <span className={cn('text-[10px] font-medium rounded-full px-2 py-0.5', st.color)}>{st.label}</span>
                                  <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">{NATUREZAS[p.natureza] || p.natureza}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                  {p.proponente_nome && <span className="flex items-center gap-1"><User className="h-3 w-3" />{p.proponente_nome}</span>}
                                  {p.consultant?.commercial_name && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{p.consultant.commercial_name}</span>}
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(p.created_at)}</span>
                                </div>
                              </div>
                              {p.pdf_url && (
                                <a href={p.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700" onClick={(e) => e.stopPropagation()}>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <EmptySection icon={Briefcase} message="Sem propostas geradas. Clique em 'Nova Proposta' para criar." />
                  )}
            </div>
          )}

          {/* ══ Sub-tab: Processos de Venda/Negócio ══ */}
          {processSubTab === 'venda' && (() => {
            const negocioProcesses = processes.filter((p) => p.process_type === 'negocio')
            const draftDeals = deals.filter((d) => d.status === 'draft')
            const totalCount = negocioProcesses.length + draftDeals.length
            const isLoadingVenda = processesLoading || dealsLoading

            return (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{isLoadingVenda ? '...' : `${totalCount} processo${totalCount !== 1 ? 's' : ''}`}</p>
                  <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setShowFechoDialog(true)}>
                    <Plus className="h-3 w-3" /> Fecho de Negócio
                  </Button>
                </div>
                {isLoadingVenda ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : totalCount > 0 ? (
                  <>
                    {/* Submitted+ processes (same card as angariação) */}
                    {negocioProcesses.map((proc) => {
                      const typeLabel = proc.deal_type === 'pleno' ? 'Pleno' : proc.deal_type === 'comprador_externo' ? 'Comprador Externo' : proc.deal_type === 'pleno_agencia' ? 'Pleno de Agência' : proc.deal_type === 'angariacao_externa' ? 'Angariação Externa' : 'Negócio'
                      const percent = proc.percent_complete || 0
                      return (
                        <div key={proc.id} className="rounded-xl border bg-card shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:border-primary/30" onClick={() => router.push(`/dashboard/processos/${proc.id}`)}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10"><Briefcase className="h-4 w-4 text-emerald-600" /></div>
                              <div>
                                <p className="font-semibold text-sm">{proc.external_ref || 'Sem referência'}</p>
                                <p className="text-xs text-muted-foreground">{typeLabel}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={proc.current_status} type="process" />
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                          </div>
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Progresso</span><span className="font-medium">{percent}%</span></div>
                            <Progress value={percent} className="h-1.5" />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {proc.tpl_processes?.name && <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{proc.tpl_processes.name}</span>}
                            {proc.requested_by_user?.commercial_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{proc.requested_by_user.commercial_name}</span>}
                            {proc.started_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(proc.started_at)}</span>}
                          </div>
                        </div>
                      )
                    })}

                    {/* Draft deals (not yet submitted) */}
                    {draftDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="rounded-xl border border-dashed bg-card shadow-sm p-5 cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                        onClick={() => {
                          setResumeDealId(deal.id)
                          setShowFechoDialog(true)
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500/10"><Briefcase className="h-4 w-4 text-slate-500" /></div>
                            <div>
                              <p className="font-semibold text-sm">Rascunho</p>
                              {deal.deal_type && <p className="text-xs text-muted-foreground">{deal.deal_type === 'pleno' ? 'Pleno' : deal.deal_type === 'comprador_externo' ? 'Comprador Externo' : deal.deal_type === 'pleno_agencia' ? 'Pleno de Agência' : deal.deal_type === 'angariacao_externa' ? 'Angariação Externa' : deal.deal_type}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-slate-500/15 text-slate-700">Rascunho</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (!confirm('Eliminar este rascunho?')) return
                                try {
                                  await fetch(`/api/deals/${deal.id}`, { method: 'DELETE' })
                                  toast.success('Rascunho eliminado')
                                  fetchDeals()
                                } catch {
                                  toast.error('Erro ao eliminar')
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1.5 mb-3">
                          <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Progresso</span><span className="font-medium">Rascunho</span></div>
                          <Progress value={0} className="h-1.5" />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {deal.deal_value > 0 && <span className="font-medium text-foreground">{formatCurrency(Number(deal.deal_value))}</span>}
                          {deal.business_type && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{deal.business_type === 'venda' ? 'Venda' : deal.business_type === 'arrendamento' ? 'Arrendamento' : 'Trespasse'}</span>}
                          {deal.consultant?.commercial_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{deal.consultant.commercial_name}</span>}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <EmptySection icon={Briefcase} message="Sem processos de negócio. Clique em 'Fecho de Negócio' para iniciar." />
                )}
              </div>
            )
          })()}

          {/* ══ Sub-tab: IMPIC ══ */}
          {processSubTab === 'impic' && (
            <div className="animate-in fade-in duration-200">
              <PropertyImpicTab
                propertyId={id}
                propertyTitle={property?.title}
                owners={property?.property_owners}
              />
            </div>
          )}
          </div>
        </div>
      )}

      {/* ═══════ DIALOGS ═══════ */}

      {/* Visit scheduler dialog */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Agendar Visita</DialogTitle>
          </DialogHeader>
          <VisitForm
            defaultPropertyId={id}
            onSubmit={async (data) => {
              const res = await fetch('/api/visits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || 'Erro ao agendar visita')
              }
              toast.success('Visita agendada com sucesso')
              setShowVisitDialog(false)
              fetchVisits()
              return res.json()
            }}
            onCancel={() => setShowVisitDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Proposta dialog */}
      <Dialog open={showPropostaDialog} onOpenChange={setShowPropostaDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Gerar Proposta</DialogTitle>
          </DialogHeader>
          <PropertyPropostaTab
            propertyId={id}
            listingPrice={property?.listing_price ? Number(property.listing_price) : undefined}
            onGenerated={() => { setShowPropostaDialog(false); fetchPropostas() }}
          />
        </DialogContent>
      </Dialog>

      {/* Fecho de Negocio dialog */}
      <DealDialog
        open={showFechoDialog}
        onOpenChange={(open) => {
          setShowFechoDialog(open)
          if (!open) setResumeDealId(null)
        }}
        draftId={resumeDealId}
        propertyContext={!resumeDealId && property ? {
          id: property.id,
          title: property.title,
          external_ref: property.external_ref,
          business_type: property.business_type,
          listing_price: property.listing_price,
          city: property.city,
          commission_agreed: property.dev_property_internal?.commission_agreed ? Number(property.dev_property_internal.commission_agreed) : null,
        } : undefined}
        onComplete={() => {
          fetchDeals()
          setResumeDealId(null)
        }}
      />
    </div>
  )
}

// ─── Shared Sub-components ─────────────────────────────────────

function DescriptionContent({ text, editing, onChange }: { text: string; editing?: boolean; onChange?: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isLong = text.length > 300

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [editing, text])

  if (editing && onChange) {
    return (
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          onChange(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = e.target.scrollHeight + 'px'
        }}
        className="w-full text-sm text-foreground bg-muted/30 rounded-lg border border-border/50 p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none leading-relaxed min-h-[4rem]"
        placeholder="Descrição do imóvel..."
      />
    )
  }

  // Check if text contains markdown-style bold or HTML tags
  const hasRichContent = /\*\*.*?\*\*|<strong>|<br\s*\/?>|<p>|<ul>|<li>/i.test(text)

  if (hasRichContent) {
    // Convert markdown bold to HTML if needed, then render as rich text
    const html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/(?<!\n)\n(?!\n)/g, '<br/>')
    const displayHtml = isLong && !expanded
      ? html.slice(0, 500).replace(/<[^>]*$/, '') + '…'
      : html

    return (
      <div>
        <div
          className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none [&_strong]:text-foreground [&_strong]:font-semibold"
          dangerouslySetInnerHTML={{ __html: displayHtml }}
        />
        {isLong && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1">
            {expanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>
    )
  }

  const displayText = isLong && !expanded ? text.slice(0, 300).trimEnd() + '…' : text
  return (
    <div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{displayText}</p>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-1">
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  )
}

function DescriptionCard({ text, editing, onChange }: { text: string; editing?: boolean; onChange?: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 300
  const displayText = isLong && !expanded ? text.slice(0, 300).trimEnd() + '…' : text

  return (
    <div className={cn('rounded-xl border shadow-sm p-5 space-y-3', editing ? 'bg-card ring-1 ring-primary/10' : 'bg-card')}>
      <SectionTitle>Descrição</SectionTitle>
      {editing && onChange ? (
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="w-full text-sm text-foreground bg-muted/30 rounded-lg border border-border/50 p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y leading-relaxed"
          placeholder="Descrição do imóvel..."
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{displayText}</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {expanded ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function HeroStat({ icon: Icon, value, className }: { icon: React.ElementType; value: string; className?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
      <span className={cn('text-sm text-neutral-200', className)}>{value}</span>
    </div>
  )
}

function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </h3>
  )
}

function InfoChip({
  label,
  value,
  editing,
  editValue,
  onChange,
  type = 'text',
  options,
}: {
  label: string
  value: string | number | null | undefined
  editing?: boolean
  editValue?: string | number
  onChange?: (val: string) => void
  type?: 'text' | 'number' | 'select' | 'textarea'
  options?: Record<string, string>
}) {
  if (editing && onChange) {
    return (
      <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
        <p className="text-[9px] uppercase tracking-wider text-primary/70 font-medium mb-1">{label}</p>
        {type === 'select' && options ? (
          <select
            value={String(editValue ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm font-medium bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
          >
            <option value="">—</option>
            {Object.entries(options).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea
            value={String(editValue ?? '')}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className="w-full text-sm font-medium bg-transparent border-0 p-0 focus:outline-none focus:ring-0 resize-none"
          />
        ) : (
          <input
            type={type}
            value={editValue ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-sm font-medium bg-transparent border-0 p-0 focus:outline-none focus:ring-0"
          />
        )}
      </div>
    )
  }
  return (
    <div className="rounded-lg bg-muted/40 border border-border/30 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
    </div>
  )
}

function QuickRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/30">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-background border shadow-sm shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="font-semibold text-sm">{value || '—'}</p>
      </div>
    </div>
  )
}

function BoolBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2.5 py-1',
      value ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'
    )}>
      {label}
    </span>
  )
}

const PROPERTY_AMENITY_EMOJIS: Record<string, { emoji: string; label: string; category: 'features' | 'equipment' | 'solar_orientation' | 'views' }> = {
  // Features
  'Varanda': { emoji: '🌸', label: 'Varanda', category: 'features' },
  'Terraço': { emoji: '☀️', label: 'Terraço', category: 'features' },
  'Jardim': { emoji: '🌻', label: 'Jardim', category: 'features' },
  'Piscina': { emoji: '🏊', label: 'Piscina', category: 'features' },
  'Garagem': { emoji: '🚗', label: 'Garagem', category: 'features' },
  'Arrecadação': { emoji: '📦', label: 'Arrecadação', category: 'features' },
  'Sótão': { emoji: '🏠', label: 'Sótão', category: 'features' },
  'Cave': { emoji: '🏗️', label: 'Cave', category: 'features' },
  'Ginásio': { emoji: '💪', label: 'Ginásio', category: 'features' },
  'Condomínio Fechado': { emoji: '🔒', label: 'Cond. Fechado', category: 'features' },
  'Portaria': { emoji: '🛡️', label: 'Portaria', category: 'features' },
  'Cozinha Equipada': { emoji: '🍳', label: 'Coz. Equipada', category: 'features' },
  'Mobilado': { emoji: '🛋️', label: 'Mobilado', category: 'features' },
  'Suite': { emoji: '🛏️', label: 'Suite', category: 'features' },
  // Equipment
  'Ar Condicionado': { emoji: '❄️', label: 'A/C', category: 'equipment' },
  'Aquecimento Central': { emoji: '🔥', label: 'Aquec. Central', category: 'equipment' },
  'Lareira': { emoji: '🪵', label: 'Lareira', category: 'equipment' },
  'Painéis Solares': { emoji: '♻️', label: 'Painéis Solares', category: 'equipment' },
  'Bomba de Calor': { emoji: '🌡️', label: 'Bomba Calor', category: 'equipment' },
  'Vidros Duplos': { emoji: '🪟', label: 'Vidros Duplos', category: 'equipment' },
  'Estores Eléctricos': { emoji: '🔌', label: 'Estores Eléc.', category: 'equipment' },
  'Alarme': { emoji: '🚨', label: 'Alarme', category: 'equipment' },
  'Vídeo Porteiro': { emoji: '📹', label: 'Vídeo Porteiro', category: 'equipment' },
  'Sistema de Rega': { emoji: '💧', label: 'Rega', category: 'equipment' },
  // Solar orientation
  'Norte': { emoji: '⬆️', label: 'Norte', category: 'solar_orientation' },
  'Sul': { emoji: '⬇️', label: 'Sul', category: 'solar_orientation' },
  'Este': { emoji: '➡️', label: 'Este', category: 'solar_orientation' },
  'Oeste': { emoji: '⬅️', label: 'Oeste', category: 'solar_orientation' },
  'Nascente': { emoji: '🌅', label: 'Nascente', category: 'solar_orientation' },
  'Poente': { emoji: '🌇', label: 'Poente', category: 'solar_orientation' },
  // Views
  'Mar': { emoji: '🌊', label: 'Mar', category: 'views' },
  'Serra': { emoji: '🏔️', label: 'Serra', category: 'views' },
  'Rio': { emoji: '🏞️', label: 'Rio', category: 'views' },
  'Cidade': { emoji: '🏙️', label: 'Cidade', category: 'views' },
  'Campo': { emoji: '🌾', label: 'Campo', category: 'views' },
}

function PropertyAmenityGrid({
  allItems,
  selected,
  isEditing,
  onToggle,
  label,
}: {
  allItems: string[]
  selected: string[]
  isEditing: boolean
  onToggle: (item: string) => void
  label: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-1">
        {allItems.map((item) => {
          const active = selected.includes(item)
          const info = PROPERTY_AMENITY_EMOJIS[item] || { emoji: '✨', label: item }
          return (
            <button
              key={item}
              type="button"
              disabled={!isEditing}
              onClick={() => isEditing && onToggle(item)}
              className={cn(
                'rounded-md border px-1 py-2 flex flex-col items-center justify-center gap-0.5 text-center transition-all',
                active
                  ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-300'
                  : 'border-border hover:bg-muted/50',
                isEditing ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <span className="text-sm">{info.emoji}</span>
              <span className={cn('text-[8px] font-medium leading-tight px-0.5', active ? 'text-orange-700 dark:text-orange-300' : '')}>
                {info.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TagList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center bg-muted text-foreground text-[11px] font-medium rounded-full px-2.5 py-1">
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function OwnerField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 border border-border/30 px-3 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  )
}

function EmptySection({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
