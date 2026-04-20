'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useProperty } from '@/hooks/use-property'
import { useUser } from '@/hooks/use-user'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/status-badge'
import { toast } from 'sonner'
import { PropertyMediaGallery } from '@/components/properties/property-media-gallery'
import { PropertyDocumentsRoot } from '@/components/properties/property-documents-root'
import { PropertyPlantasSection } from '@/components/properties/property-plantas-section'
import { PropertyPropostaTab } from '@/components/properties/property-proposta-tab'
import { PropertyImpicTab } from '@/components/properties/property-impic-tab'
import { PropertyFichasTab } from '@/components/properties/property-fichas-tab'
import { PropertyVisitasTab } from '@/components/properties/property-visitas-tab'
import { PropertyApresentacaoTab } from '@/components/properties/property-apresentacao-tab'
import { ProcessPipelinePanel } from '@/components/processes/process-pipeline-panel'
import { VisitForm } from '@/components/visits/visit-form'
import { DealDialog } from '@/components/deals/deal-dialog'
import { PropertyDescriptionGenerator } from '@/components/properties/property-description-generator'
import { PropertyAvailabilityPanel } from '@/components/booking/property-availability-panel'
import { PropertyOwnerAddDialog } from '@/components/properties/property-owner-add-dialog'
import { PropertyOwnerInvitesSection } from '@/components/properties/property-owner-invites-section'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  MessageSquare,
  EyeOff,
  Eye,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { motion, LayoutGroup } from 'framer-motion'
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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ─── Tab config ────────────────────────────────────────────────

type TabKey = 'apresentacao' | 'resumo' | 'media' | 'interessados' | 'visitas' | 'documentos' | 'proprietarios' | 'processos'

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'apresentacao', label: 'Apresentação', icon: Eye },
  { key: 'media', label: 'Media', icon: ImageIcon },
  { key: 'interessados', label: 'Interessados', icon: Users },
  { key: 'visitas', label: 'Visitas', icon: Calendar },
  { key: 'documentos', label: 'Documentos', icon: FileText },
  { key: 'proprietarios', label: 'Proprietários', icon: User },
  { key: 'processos', label: 'Processos', icon: ClipboardList },
]

type ProcessSubTab = 'angariacao' | 'venda' | 'impic'

const PROCESS_SUBTABS: { key: ProcessSubTab; label: string; icon: React.ElementType }[] = [
  { key: 'angariacao', label: 'Angariação', icon: FolderOpen },
  { key: 'venda', label: 'Venda', icon: FileText },
  { key: 'impic', label: 'IMPIC', icon: ShieldCheck },
]

type InteressadosSubTab = 'pipeline' | 'propostas'

const INTERESSADOS_SUBTABS: { key: InteressadosSubTab; label: string }[] = [
  { key: 'pipeline', label: 'Leads Infinity' },
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
  const { user: currentUser } = useUser()
  const currentUserId = currentUser?.id || null
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
  const [visitPrefillLeadId, setVisitPrefillLeadId] = useState<string | undefined>(undefined)
  const [showFechoDialog, setShowFechoDialog] = useState(false)
  const [resumeDealId, setResumeDealId] = useState<string | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<any>(null)
  const isMobile = useIsMobile()
  const [interessados, setInteressados] = useState<{ linked: any[]; suggestions: any[] }>({ linked: [], suggestions: [] })
  const [interessadosLoading, setInteressadosLoading] = useState(true)
  const [interessadosSubTab, setInteressadosSubTab] = useState<InteressadosSubTab>('pipeline')
  const [hiddenInteressados, setHiddenInteressados] = useState<Set<string>>(new Set())
  const [showHiddenInteressados, setShowHiddenInteressados] = useState(false)
  const [colleagueFilter, setColleagueFilter] = useState<string | null>(null)
  const [resumoSection, setResumoSection] = useState<'info' | 'specs' | 'financeiro'>('info')
  const [mediaSection, setMediaSection] = useState<'imagens' | 'plantas'>('imagens')
  const [descriptionExpanded, setDescriptionExpanded] = useState(false)
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as TabKey) || 'apresentacao'
  const initialProcessSubTab = (searchParams.get('sub') as ProcessSubTab) || 'angariacao'
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [processSubTab, setProcessSubTab] = useState<ProcessSubTab>(initialProcessSubTab)
  const [processToolbarEl, setProcessToolbarEl] = useState<HTMLDivElement | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [consultantsList, setConsultantsList] = useState<{ id: string; commercial_name: string }[]>([])

  useEffect(() => {
    fetch('/api/consultants?per_page=100&status=active&include_brokers=true')
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

  const cancelEditing = () => {
    setIsEditing(false)
    setEditData({})
    if (activeTab === 'resumo') setActiveTab('apresentacao')
  }

  const handleDeleteProperty = async () => {
    if (!property?.id) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/properties/${property.id}?mode=permanent`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao eliminar imóvel')
      }
      toast.success('Imóvel eliminado permanentemente')
      setDeleteStep(0)
      router.push('/dashboard/imoveis')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao eliminar imóvel')
      setIsDeleting(false)
    }
  }

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
      if (activeTab === 'resumo') setActiveTab('apresentacao')
      refetch()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao guardar alterações')
    } finally {
      setIsSaving(false)
    }
  }

  // Load process data — must wait for resolved UUID (URL `id` may be a slug)
  const fetchProcesses = useCallback(() => {
    if (!property?.id) return
    setProcessesLoading(true)
    fetch(`/api/processes?property_id=${property.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { setProcesses(Array.isArray(data) ? data : data?.data || []) })
      .catch(() => setProcesses([]))
      .finally(() => setProcessesLoading(false))
  }, [property?.id])

  useEffect(() => { fetchProcesses() }, [fetchProcesses])

  // Use resolved property UUID for sub-resource fetches (URL `id` may be a slug)
  const propertyId = property?.id

  // Load visits
  const fetchVisits = useCallback(() => {
    if (!propertyId) return
    setVisitsLoading(true)
    fetch(`/api/properties/${propertyId}/visits`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setVisits(Array.isArray(d) ? d : []))
      .catch(() => setVisits([]))
      .finally(() => setVisitsLoading(false))
  }, [propertyId])

  // Load propostas
  const fetchPropostas = useCallback(() => {
    if (!propertyId) return
    setPropostasLoading(true)
    fetch(`/api/properties/${propertyId}/propostas`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setPropostas(Array.isArray(d) ? d : []))
      .catch(() => setPropostas([]))
      .finally(() => setPropostasLoading(false))
  }, [propertyId])

  // Load deals (proc. venda)
  const fetchDeals = useCallback(() => {
    if (!propertyId) return
    setDealsLoading(true)
    fetch(`/api/deals?property_id=${propertyId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setDeals(Array.isArray(d) ? d : []))
      .catch(() => setDeals([]))
      .finally(() => setDealsLoading(false))
  }, [propertyId])

  const fetchInteressados = useCallback(() => {
    if (!propertyId) return
    setInteressadosLoading(true)
    fetch(`/api/properties/${propertyId}/interessados`)
      .then((r) => r.ok ? r.json() : { linked: [], suggestions: [] })
      .then((d) => setInteressados({ linked: d.linked || [], suggestions: d.suggestions || [] }))
      .catch(() => setInteressados({ linked: [], suggestions: [] }))
      .finally(() => setInteressadosLoading(false))
  }, [propertyId])

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
  const propertyImages = (property.dev_property_media || []).filter((m: any) => m.media_type !== 'planta' && m.media_type !== 'planta_3d')
  const coverImage = propertyImages.find((m: any) => m.is_cover)?.url
    || propertyImages[0]?.url

  return (
    <div className="space-y-5">
      {/* ═══════ UNIFIED LIGHT TOOLBAR (all tabs) ═══════ */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Row 1 (mobile): Voltar + Edit/Delete inline. On desktop: only Voltar */}
        <div className="flex items-center justify-between gap-2 lg:justify-start">
          <button
            onClick={() => router.push('/dashboard/imoveis')}
            className="inline-flex items-center gap-1.5 bg-muted/50 hover:bg-muted text-foreground px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>

          {/* Mobile-only edit/delete buttons */}
          <div className="flex items-center gap-2 lg:hidden">
            {isEditing && (
              <>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={cancelEditing} title="Cancelar">
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" onClick={saveChanges} disabled={isSaving} title="Guardar">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </>
            )}
            {!isEditing && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => {
                  if (activeTab === 'apresentacao') setActiveTab('resumo')
                  startEditing()
                }}
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {!isEditing && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeleteStep(1)}
                title="Eliminar imóvel"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Row 2 (mobile) / inline (desktop): tabs + desktop-only edit/delete */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Desktop-only edit/delete buttons */}
          <div className="hidden lg:flex items-center gap-2">
            {isEditing && (
              <>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={cancelEditing} title="Cancelar">
                  <X className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" onClick={saveChanges} disabled={isSaving} title="Guardar">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
              </>
            )}
            {!isEditing && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => {
                  if (activeTab === 'apresentacao') setActiveTab('resumo')
                  startEditing()
                }}
                title="Editar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {!isEditing && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => setDeleteStep(1)}
                title="Eliminar imóvel"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/40 overflow-x-auto scrollbar-hide max-w-full">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    activeTab === t.key
                      ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ═══════ TAB CONTENT ═══════ */}

      {/* ─── Apresentação (display page) ─── */}
      {activeTab === 'apresentacao' && (
        <PropertyApresentacaoTab property={property} onOpenMedia={() => setActiveTab('media')} />
      )}

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

      {/* ─── Media (images/plantas tabs on left | portals + description on right) ─── */}
      {activeTab === 'media' && (
        <LayoutGroup id="media-tab">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start animate-in fade-in duration-300">
            {/* Left: Imagens / Plantas tabs */}
            <motion.div
              layout
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'rounded-xl border bg-card shadow-sm p-5 space-y-4',
                descriptionExpanded ? 'lg:col-span-1' : 'lg:col-span-2'
              )}
            >
              <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 w-fit">
                {([['imagens', 'Imagens'], ['plantas', 'Plantas']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMediaSection(key)}
                    className={cn(
                      'px-3.5 py-1 rounded-full text-[11px] font-medium transition-all',
                      mediaSection === key
                        ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mediaSection === 'imagens' && (
                <PropertyMediaGallery
                  propertyId={property.id}
                  media={(property.dev_property_media || []).filter((m: any) => m.media_type !== 'planta' && m.media_type !== 'planta_3d')}
                  onMediaChange={refetch}
                  hideRoomLabels={descriptionExpanded}
                />
              )}

              {mediaSection === 'plantas' && (
                <PropertyPlantasSection
                  propertyId={property.id}
                  plantas={(property.dev_property_media || []).filter((m: any) => m.media_type === 'planta')}
                  renders3d={(property.dev_property_media || []).filter((m: any) => m.media_type === 'planta_3d')}
                  onMediaChange={refetch}
                />
              )}
            </motion.div>

            {/* Right: Portal links + Description (same card) */}
            <motion.div
              layout
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'rounded-xl border bg-card shadow-sm p-5 space-y-4 lg:sticky lg:top-4',
                descriptionExpanded ? 'lg:col-span-2' : 'lg:col-span-1'
              )}
            >
              {/* Portal links */}
              {isEditing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-medium shrink-0">Idealista</span>
                  <input value={editData.url_idealista ?? ''} onChange={(e) => updateField('url_idealista', e.target.value)} placeholder="https://..." className="text-xs bg-muted/30 border border-border/50 rounded-full px-3 py-1 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-primary/30" />
                  <span className="text-[10px] text-muted-foreground font-medium shrink-0">Imovirtual</span>
                  <input value={editData.url_imovirtual ?? ''} onChange={(e) => updateField('url_imovirtual', e.target.value)} placeholder="https://..." className="text-xs bg-muted/30 border border-border/50 rounded-full px-3 py-1 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-primary/30" />
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

              {/* Description (read-only or expanded editor) */}
              <div className="pt-4 border-t">
                {descriptionExpanded ? (
                  <PropertyDescriptionGenerator
                    inline
                    propertyId={property.id}
                    property={property}
                    existingDescription={property.description || ''}
                    onClose={() => setDescriptionExpanded(false)}
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
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">Descrição</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDescriptionExpanded(true)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Editar descrição
                      </Button>
                    </div>
                    <DescriptionContent
                      text={isEditing ? editData.description ?? property.description ?? '' : property.description || ''}
                      editing={isEditing}
                      onChange={(v) => updateField('description', v)}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </LayoutGroup>
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
          {/* ══ Pipeline (Leads Infinity) ══ */}
          {interessadosSubTab === 'pipeline' && (
            <div className="animate-in fade-in duration-200">
              {interessadosLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
              ) : (
                (() => {
                  // Merge linked + suggestions into one list of "matching buyers"
                  const buildRow = (neg: any, key: string, linked: boolean) => {
                    const lead = neg?.lead || {}
                    // Prefer the negocio's assigned consultant, fall back to lead's agent
                    const agent = neg?.consultant || lead?.agent || {}
                    const agentProfile = agent?.profile || {}
                    const ownerAgentId = neg?.assigned_consultant_id || lead?.agent_id || null
                    const isMine = !!(currentUserId && ownerAgentId && ownerAgentId === currentUserId)
                    const maxBudget = Number(neg?.orcamento_max || neg?.orcamento) || null
                    return {
                      key,
                      negocioId: neg?.id,
                      leadId: lead?.id || null,
                      isMine,
                      firstName: ((lead?.nome || 'Cliente').split(' ')[0] || 'Cliente'),
                      colleague: agent?.commercial_name || 'Sem consultor',
                      tipoImovel: neg?.tipo_imovel || null,
                      quartosMin: neg?.quartos_min || null,
                      localizacao: neg?.localizacao || null,
                      maxBudget,
                      typeMatch: neg?.type_match || null,
                      // For "my" buyers we want to contact the lead directly; for colleagues we contact the colleague
                      phone: isMine
                        ? (lead?.telemovel || agentProfile?.phone_commercial || null)
                        : (agentProfile?.phone_commercial || lead?.telemovel || null),
                      email: isMine
                        ? (lead?.email || agent?.professional_email || null)
                        : (agent?.professional_email || lead?.email || null),
                      linked,
                    }
                  }
                  const linkedRows = interessados.linked.map((link: any) =>
                    buildRow(link.negocio || {}, `linked-${link.id}`, true)
                  )
                  const suggestionRows = interessados.suggestions.map((neg: any) =>
                    buildRow(neg, `sug-${neg.id}`, false)
                  )
                  const all = [...linkedRows, ...suggestionRows]
                  const myBuyers = all.filter((r) => r.isMine)
                  const colleagueBuyers = all.filter((r) => !r.isMine)
                  const availableColleagues = [...new Set(colleagueBuyers.map((i) => i.colleague))].filter(Boolean).sort()
                  const filteredColleagueBuyers = colleagueFilter
                    ? colleagueBuyers.filter((i) => i.colleague === colleagueFilter)
                    : colleagueBuyers

                  if (all.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
                        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                          <Users className="h-7 w-7 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-base font-medium">Sem compradores compatíveis</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                          Os negócios de Compra cujo perfil corresponde a este imóvel aparecerão aqui automaticamente.
                        </p>
                      </div>
                    )
                  }

                  const renderRow = (int: any, idx: number) => {
                    const isHidden = hiddenInteressados.has(int.negocioId)
                    if (!showHiddenInteressados && isHidden) return null
                    return (
                      <div
                        key={int.key}
                        className={cn(
                          'rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between transition-all duration-300 animate-in fade-in slide-in-from-bottom-2',
                          isHidden && 'opacity-50'
                        )}
                        style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{int.firstName}</p>
                            {(int.tipoImovel || int.quartosMin) && (
                              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                                {[int.tipoImovel, int.quartosMin ? `T${int.quartosMin}+` : null].filter(Boolean).join(' · ')}
                              </span>
                            )}
                            {int.typeMatch === 'compatible' && (
                              <span
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                title="Tipo compatível mas não exacto"
                              >
                                compatível
                              </span>
                            )}
                            {int.maxBudget && (
                              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                até {formatCurrency(int.maxBudget)}
                              </span>
                            )}
                            {int.localizacao && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 max-w-[180px]"
                                title={int.localizacao}
                              >
                                <MapPin className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{int.localizacao}</span>
                              </span>
                            )}
                          </div>
                          {!int.isMine && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{int.colleague}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {int.phone && (
                            <a
                              href={`tel:${int.phone}`}
                              className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                              title={`Ligar ${int.isMine ? int.firstName : int.colleague}`}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {int.phone && (
                            <a
                              href={`https://wa.me/351${int.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                              title={`WhatsApp ${int.isMine ? int.firstName : int.colleague}`}
                            >
                              <WhatsAppIcon className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {int.email && (
                            <a
                              href={`mailto:${int.email}`}
                              className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                              title={`Email ${int.isMine ? int.firstName : int.colleague}`}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setVisitPrefillLeadId(int.leadId || undefined)
                              setShowVisitDialog(true)
                            }}
                            className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all"
                            title="Agendar visita"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </button>
                          {!int.isMine && (
                            <button
                              type="button"
                              onClick={() => {
                                setHiddenInteressados((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(int.negocioId)) next.delete(int.negocioId)
                                  else next.add(int.negocioId)
                                  return next
                                })
                              }}
                              className={cn(
                                'h-8 w-8 rounded-full border border-border/50 flex items-center justify-center transition-all',
                                isHidden
                                  ? 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70'
                                  : 'bg-muted/40 text-muted-foreground hover:text-red-500 hover:bg-red-50 hover:border-red-200'
                              )}
                              title={isHidden ? 'Mostrar' : 'Ocultar'}
                            >
                              {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {/* Header with counts and toggles */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {myBuyers.length} meu{myBuyers.length !== 1 ? 's' : ''} · {colleagueBuyers.length} de colega{colleagueBuyers.length !== 1 ? 's' : ''}
                        </p>
                        {hiddenInteressados.size > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full text-xs"
                            onClick={() => setShowHiddenInteressados(!showHiddenInteressados)}
                          >
                            {showHiddenInteressados
                              ? <><EyeOff className="mr-1 h-3 w-3" />Ocultar</>
                              : <><Eye className="mr-1 h-3 w-3" />{hiddenInteressados.size} oculto{hiddenInteressados.size !== 1 ? 's' : ''}</>}
                          </Button>
                        )}
                      </div>

                      <div className="space-y-5">
                        {/* ── My buyers ── */}
                        {myBuyers.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Os meus leads</p>
                            {myBuyers.map((int, idx) => renderRow(int, idx))}
                          </div>
                        )}

                        {/* ── Colleague buyers ── */}
                        {colleagueBuyers.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Leads de colegas</p>
                              {availableColleagues.length > 1 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => setColleagueFilter(null)}
                                    className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
                                      !colleagueFilter ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                    )}
                                  >Todos</button>
                                  {availableColleagues.map((name) => (
                                    <button
                                      key={name}
                                      type="button"
                                      onClick={() => setColleagueFilter(colleagueFilter === name ? null : name)}
                                      className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
                                        colleagueFilter === name ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                      )}
                                    >{name}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {filteredColleagueBuyers.map((int, idx) => renderRow(int, idx))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()
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

      {/* ─── Visitas (Pedidos · Visitas · Fichas · Análise) ─── */}
      {activeTab === 'visitas' && property && (
        <div className="animate-in fade-in duration-300">
          <PropertyVisitasTab
            propertyId={property.id}
            propertySlug={property.slug}
            consultantId={property.consultant_id ?? null}
            listingPrice={property.listing_price ? Number(property.listing_price) : null}
            visits={visits}
            visitsLoading={visitsLoading}
            onNewVisitClick={() => setShowVisitDialog(true)}
            onVisitsChange={() => { fetchVisits() }}
          />
        </div>
      )}

      {/* ─── Documentos ─── */}
      {activeTab === 'documentos' && (
        <div className="animate-in fade-in duration-300">
          <PropertyDocumentsRoot propertyId={property.id} />
        </div>
      )}

      {/* ─── Proprietários ─── */}
      {activeTab === 'proprietarios' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {/* Top — invite generator */}
          <PropertyOwnerInvitesSection
            propertyId={property.id}
            onSubmissionDetected={refetch}
          />

          {/* List (left half) + detail (right half on md+) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="rounded-xl border bg-card shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <SectionTitle icon={Users}>Proprietários</SectionTitle>
                <PropertyOwnerAddDialog
                  propertyId={property.id}
                  hasExistingOwners={(property.property_owners?.length ?? 0) > 0}
                  onAdded={refetch}
                />
              </div>
              {property.property_owners?.length ? (
                <div className="space-y-2">
                  {property.property_owners.map((po, i) => {
                    const isSelected = selectedOwner?.owners?.id === po.owners?.id
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all',
                          isSelected
                            ? 'bg-primary/5 border-primary/40 shadow-sm'
                            : 'bg-muted/40 border-border/30 hover:bg-muted/60 hover:shadow-sm'
                        )}
                        onClick={() => setSelectedOwner(isSelected ? null : po)}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm truncate">{po.owners?.name || 'Proprietário'}</p>
                            {po.is_main_contact && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-medium rounded-full px-2 py-0.5">Contacto Principal</span>}
                            {po.owners?.person_type === 'coletiva' && <span className="text-[10px] font-medium bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">Empresa</span>}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                            {po.owners?.nif && <span>NIF: {po.owners.nif}</span>}
                            {po.owners?.email && <span className="truncate max-w-[180px]">{po.owners.email}</span>}
                            {po.owners?.phone && <span>{po.owners.phone}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold bg-muted rounded-full px-3 py-1">{po.ownership_percentage}%</span>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum proprietário associado a este imóvel.</p>
              )}
            </div>

            {/* Inline detail (desktop only) */}
            <div className="hidden md:block md:sticky md:top-4">
              {selectedOwner?.owners ? (
                <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-2 duration-300">
                  <OwnerDetailContent
                    selectedOwner={selectedOwner}
                    propertyId={property.id}
                    variant="inline"
                    onClose={() => setSelectedOwner(null)}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 p-10 text-center">
                  <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {property.property_owners?.length
                      ? 'Seleccione um proprietário para ver os detalhes'
                      : 'Ainda não há proprietários associados'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Owner detail sheet — mobile only */}
          <Sheet open={!!selectedOwner && isMobile} onOpenChange={(o) => { if (!o) setSelectedOwner(null) }}>
            <SheetContent className="sm:max-w-md overflow-y-auto p-0">
              {selectedOwner?.owners && (
                <OwnerDetailContent
                  selectedOwner={selectedOwner}
                  propertyId={property.id}
                  variant="sheet"
                />
              )}
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* ─── Processos (unified tab with sub-tabs) ─── */}
      {activeTab === 'processos' && (
        <div className="rounded-xl border bg-card shadow-sm animate-in fade-in duration-300 overflow-hidden">
          {/* Sub-tab selector row: chips on the left, panel toolbar slot on the right */}
          <div className="flex items-center gap-3 m-4 mb-0 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-full bg-muted/50 border border-border/30 overflow-x-auto scrollbar-hide w-fit max-w-full">
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
            <div ref={setProcessToolbarEl} className="ml-auto flex items-center gap-2" />
          </div>

          <div className="p-5 pt-4">
          {/* ══ Sub-tab: Angariação ══ */}
          {processSubTab === 'angariacao' && (() => {
            const angariacao = processes.find((p) => p.process_type === 'angariacao')
            if (processesLoading) return <Skeleton className="h-64 w-full rounded-xl" />
            if (!angariacao) {
              return (
                <EmptySection
                  icon={FolderOpen}
                  message="Nenhum processo de angariação. Os processos serão criados quando o imóvel for submetido para aprovação."
                />
              )
            }
            return (
              <div className="animate-in fade-in duration-200">
                <ProcessPipelinePanel processId={angariacao.id} onProcessChange={fetchProcesses} toolbarElement={processToolbarEl} />
              </div>
            )
          })()}

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
            const ACTIVE_STATUSES = ['active', 'on_hold', 'pending_approval', 'returned']
            const currentProcess = negocioProcesses.find((p) => ACTIVE_STATUSES.includes(p.current_status))
            const historicalProcesses = negocioProcesses.filter((p) => !currentProcess || p.id !== currentProcess.id)
            const isLoadingVenda = processesLoading || dealsLoading
            const hasAnything = !!currentProcess || historicalProcesses.length > 0 || draftDeals.length > 0

            const formatDealType = (dealType?: string | null) => {
              if (dealType === 'pleno') return 'Pleno'
              if (dealType === 'comprador_externo') return 'Comprador Externo'
              if (dealType === 'pleno_agencia') return 'Pleno de Agência'
              if (dealType === 'angariacao_externa') return 'Angariação Externa'
              return dealType || 'Negócio'
            }

            return (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {isLoadingVenda ? '...' : currentProcess ? 'Processo activo' : 'Sem processo activo'}
                  </p>
                  <Button size="sm" className="rounded-full gap-1.5 text-xs" onClick={() => setShowFechoDialog(true)}>
                    <Plus className="h-3 w-3" /> Fecho de Negócio
                  </Button>
                </div>

                {isLoadingVenda ? (
                  <Skeleton className="h-64 w-full rounded-xl" />
                ) : !hasAnything ? (
                  <EmptySection icon={Briefcase} message="Sem processos de negócio. Clique em 'Fecho de Negócio' para iniciar." />
                ) : (
                  <>
                    {currentProcess && (
                      <ProcessPipelinePanel processId={currentProcess.id} onProcessChange={fetchProcesses} toolbarElement={processToolbarEl} />
                    )}

                    {(historicalProcesses.length > 0 || draftDeals.length > 0) && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Histórico</p>
                        <div className="space-y-2">
                          {historicalProcesses.map((proc) => {
                            const percent = proc.percent_complete || 0
                            return (
                              <div
                                key={proc.id}
                                className="rounded-lg border bg-muted/30 p-3 cursor-pointer transition-all hover:bg-muted/60 hover:border-primary/30"
                                onClick={() => router.push(`/dashboard/processos/${proc.id}`)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                                    <Briefcase className="h-3.5 w-3.5 text-emerald-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-semibold truncate">{proc.external_ref || 'Sem referência'}</p>
                                      <StatusBadge status={proc.current_status} type="process" />
                                      <span className="text-[10px] text-muted-foreground">{formatDealType(proc.deal_type)}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                      {proc.started_at && (
                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(proc.started_at)}</span>
                                      )}
                                      <span>{percent}% concluído</span>
                                    </div>
                                  </div>
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                </div>
                              </div>
                            )
                          })}

                          {draftDeals.map((deal) => (
                            <div
                              key={deal.id}
                              className="rounded-lg border border-dashed bg-muted/30 p-3 cursor-pointer transition-all hover:bg-muted/60 hover:border-primary/30"
                              onClick={() => {
                                setResumeDealId(deal.id)
                                setShowFechoDialog(true)
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-500/10">
                                  <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-semibold">Rascunho</p>
                                    <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-slate-500/15 text-slate-700">Rascunho</span>
                                    {deal.deal_type && <span className="text-[10px] text-muted-foreground">{formatDealType(deal.deal_type)}</span>}
                                  </div>
                                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                    {deal.deal_value > 0 && <span className="font-medium text-foreground">{formatCurrency(Number(deal.deal_value))}</span>}
                                    {deal.business_type && <span>{deal.business_type === 'venda' ? 'Venda' : deal.business_type === 'arrendamento' ? 'Arrendamento' : 'Trespasse'}</span>}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-destructive hover:text-destructive shrink-0"
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
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
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
      <Dialog open={showVisitDialog} onOpenChange={(o) => { setShowVisitDialog(o); if (!o) setVisitPrefillLeadId(undefined) }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Agendar Visita</DialogTitle>
          </DialogHeader>
          <VisitForm
            defaultPropertyId={id}
            defaultLeadId={visitPrefillLeadId}
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
              setVisitPrefillLeadId(undefined)
              fetchVisits()
              return res.json()
            }}
            onCancel={() => { setShowVisitDialog(false); setVisitPrefillLeadId(undefined) }}
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

      {/* ═══════ DELETE CONFIRMATIONS (two-step) ═══════ */}
      <AlertDialog open={deleteStep === 1} onOpenChange={(o) => !o && setDeleteStep(0)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar imóvel?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende eliminar este imóvel?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setDeleteStep(2) }}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteStep === 2} onOpenChange={(o) => !o && !isDeleting && setDeleteStep(0)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Tem mesmo a certeza?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Esta acção é <strong>permanente e irreversível</strong>. Não é possível
                  recuperar o imóvel após eliminação.
                </p>
                <p>Serão eliminados, em cascata:</p>
                <ul className="list-disc pl-5 text-sm space-y-0.5">
                  <li>Todas as imagens, plantas e renders 3D</li>
                  <li>Documentos associados ao imóvel</li>
                  <li>Especificações e dados internos</li>
                  <li>Ligações a proprietários</li>
                  <li>Processos, visitas e propostas relacionadas</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={isDeleting}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteProperty() }}
              disabled={isDeleting}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />A eliminar…</>
              ) : (
                'Eliminar permanentemente'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className={cn('text-sm text-foreground', className)}>{value}</span>
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

function OwnerDetailContent({
  selectedOwner,
  propertyId,
  onClose,
  variant,
}: {
  selectedOwner: any
  propertyId: string
  onClose?: () => void
  variant: 'sheet' | 'inline'
}) {
  const o = selectedOwner.owners
  const isCompany = o.person_type === 'coletiva'
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div
        className={cn(
          'bg-gradient-to-br from-neutral-900 to-neutral-800 px-6 pt-8 pb-6 text-white shrink-0',
          variant === 'inline' && 'rounded-t-xl'
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center text-lg font-bold">
            {(o.name || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg leading-tight">{o.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isCompany && (
                <span className="text-[10px] font-medium bg-violet-500/30 text-violet-200 rounded-full px-2 py-0.5">
                  Empresa
                </span>
              )}
              {selectedOwner.is_main_contact && (
                <span className="text-[10px] font-medium bg-emerald-500/30 text-emerald-200 rounded-full px-2 py-0.5">
                  Contacto Principal
                </span>
              )}
              <span className="text-neutral-400 text-xs">
                {selectedOwner.ownership_percentage}% propriedade
              </span>
            </div>
          </div>
          {variant === 'inline' && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
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
              {o.is_portugal_resident != null && (
                <InfoChip label="Residente PT" value={o.is_portugal_resident ? 'Sim' : 'Não'} />
              )}
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
                <div
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm font-medium',
                    o.is_pep
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  )}
                >
                  PEP: {o.is_pep ? `Sim — ${o.pep_position || 'Cargo não especificado'}` : 'Não'}
                </div>
              )}
              {o.funds_origin?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted-foreground mr-1">Origem fundos:</span>
                  {o.funds_origin.map((f: string) => (
                    <span key={f} className="text-[10px] bg-muted rounded-full px-2 py-0.5 font-medium">
                      {f}
                    </span>
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

        {/* Documentos do proprietário (apenas deste imóvel) */}
        <OwnerDocumentsList ownerId={o.id} propertyId={propertyId} />
      </div>
    </div>
  )
}

interface OwnerDoc {
  id: string
  file_name: string
  file_url: string
  valid_until: string | null
  doc_type: { id: string; name: string; category: string | null } | null
}

function OwnerDocumentsList({ ownerId, propertyId }: { ownerId: string; propertyId?: string }) {
  const [docs, setDocs] = useState<OwnerDoc[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const url = propertyId
      ? `/api/owners/${ownerId}/documents?property_id=${propertyId}`
      : `/api/owners/${ownerId}/documents`
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setDocs(Array.isArray(data) ? data : [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ownerId, propertyId])

  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
        Documentos {docs.length > 0 && <span className="ml-1 text-muted-foreground/60">({docs.length})</span>}
      </p>
      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem documentos associados.</p>
      ) : (
        <div className="space-y-1.5">
          {docs.map((doc) => {
            const expired = doc.valid_until && new Date(doc.valid_until) < new Date()
            return (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 rounded-lg bg-muted/40 border border-border/30 px-3 py-2 hover:bg-muted/70 transition-colors"
              >
                <div className="h-8 w-8 rounded-md bg-background flex items-center justify-center shrink-0">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.doc_type?.name || doc.file_name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    {doc.doc_type?.category && <span className="truncate">{doc.doc_type.category}</span>}
                    {doc.valid_until && (
                      <>
                        <span>·</span>
                        <span className={cn(expired && 'text-red-600 font-medium')}>
                          {expired ? 'Expirado' : `Válido até ${formatDate(doc.valid_until)}`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground/60 shrink-0" />
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
