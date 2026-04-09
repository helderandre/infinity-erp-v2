// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ArrowLeft, Building2, Plus, Sparkles, Link2, Globe, Loader2, ExternalLink,
  Trash2, CalendarDays, Clock, Star, Home, MapPin, Euro, CreditCard, Landmark,
  Phone, Mail, ChevronRight, Users, Eye, EyeOff, MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useUser } from '@/hooks/use-user'
import { NegocioDataCard } from '@/components/negocios/negocio-data-card'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { mapNegocioToAcquisition } from '@/lib/utils/negocio-to-acquisition'
import { VisitForm } from '@/components/visits/visit-form'
import { ObservationsButton } from '@/components/crm/observations-dialog'
import { TemperaturaSelector, type Temperatura } from '@/components/negocios/temperatura-selector'
import { EstadoPipelineSelector } from '@/components/negocios/estado-pipeline-selector'
import { AiFillDialog } from '@/components/negocios/ai-fill-dialog'
import {
  NEGOCIO_ESTADO_COLORS,
  NEGOCIO_ESTADO_OPTIONS,
  NEGOCIO_PROPERTY_STATUS,
  VISIT_STATUS_COLORS,
  formatCurrency,
} from '@/lib/constants'
import type { NegocioWithLeadBasic, NegocioProperty } from '@/types/lead'
import type { VisitWithRelations } from '@/types/visit'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ─── Venda Perspective (for Compra e Venda) ──────────────────────────────────

function VendaPerspective({ negocio, negocioId, leadId, onStartAcquisition, onOpenVendaProfile }: { negocio: any; negocioId: string; leadId: string; onStartAcquisition: () => void; onOpenVendaProfile: () => void }) {
  const router = useRouter()
  const [property, setProperty] = useState<any>(null)
  const [process, setProcess] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const procRes = await fetch(`/api/processes?negocio_id=${negocioId}&limit=1`)
        if (procRes.ok) {
          const procJson = await procRes.json()
          const proc = procJson.data?.[0]
          if (proc) {
            setProcess(proc)
            if (proc.property_id) {
              const propRes = await fetch(`/api/properties/${proc.property_id}`)
              if (propRes.ok) {
                const propJson = await propRes.json()
                setProperty(propJson.data || propJson)
              }
            }
          }
        }
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [negocioId])

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-64 rounded-2xl" /></div>
  }

  const cover = property?.dev_property_media?.find((m: any) => m.is_cover)?.url || property?.dev_property_media?.[0]?.url
  const specs = property?.dev_property_specifications
  const consultant = property?.consultant

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
      {/* Sidebar — Perfil de Venda card */}
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-3 transition-all duration-300 hover:shadow-md cursor-pointer group" onClick={onOpenVendaProfile}>
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perfil de Venda</h4>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {negocio.tipo_imovel_venda && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2.5 py-1 rounded-full">
                <Building2 className="h-2.5 w-2.5" />{negocio.tipo_imovel_venda}
              </span>
            )}
            {negocio.localizacao_venda && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2.5 py-1 rounded-full">
                <MapPin className="h-2.5 w-2.5" />{negocio.localizacao_venda}
              </span>
            )}
          </div>
          {negocio.preco_venda && (
            <div>
              <p className="text-[10px] text-muted-foreground">Preço Pretendido</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(Number(negocio.preco_venda))}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content — Imóvel */}
      <div className="space-y-4">
          {!property ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-neutral-100 dark:bg-white/10 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-lg font-semibold">Sem imóvel associado à venda</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Inicie o processo de angariação para associar o imóvel que este cliente pretende vender.
              </p>
              <Button className="mt-5 rounded-full px-6" onClick={onStartAcquisition}>
                <Home className="mr-2 h-4 w-4" />
                Iniciar Angariação
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Property hero card */}
              <div className="group rounded-2xl border overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl bg-card"
                onClick={() => router.push(`/dashboard/imoveis/${property.slug || property.id}`)}
              >
                <div className="relative h-56 sm:h-72 bg-muted">
                  {cover ? (
                    <img src={cover} alt={property.title} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center"><Building2 className="h-16 w-16 text-muted-foreground/15" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/70 via-neutral-900/20 to-transparent" />
                  {property.listing_price && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center bg-white/90 backdrop-blur-sm text-neutral-900 font-bold px-4 py-1.5 rounded-full shadow-lg text-base">
                        {formatCurrency(Number(property.listing_price))}
                      </span>
                    </div>
                  )}
                  {property.external_ref && (
                    <div className="absolute top-4 left-4">
                      <span className="inline-flex items-center bg-neutral-900/70 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">
                        {property.external_ref}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-5 right-5">
                    <h2 className="text-xl font-bold text-white leading-tight">{property.title}</h2>
                    <div className="flex items-center gap-2 mt-1.5 text-white/70 text-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      {[property.city, property.zone].filter(Boolean).join(', ')}
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-4 flex-wrap">
                    {specs?.bedrooms && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{specs.typology || `T${specs.bedrooms}`}</p>
                        <p className="text-[10px] text-muted-foreground">Tipologia</p>
                      </div>
                    )}
                    {specs?.area_util && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{specs.area_util} m²</p>
                        <p className="text-[10px] text-muted-foreground">Área útil</p>
                      </div>
                    )}
                    {specs?.bathrooms && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{specs.bathrooms}</p>
                        <p className="text-[10px] text-muted-foreground">WC</p>
                      </div>
                    )}
                    {specs?.parking_spaces && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{specs.parking_spaces}</p>
                        <p className="text-[10px] text-muted-foreground">Estacion.</p>
                      </div>
                    )}
                    {consultant && (
                      <div className="ml-auto flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-neutral-100 dark:bg-white/10 overflow-hidden shrink-0">
                          {consultant.dev_consultant_profiles?.profile_photo_url ? (
                            <img src={consultant.dev_consultant_profiles.profile_photo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                              {(consultant.commercial_name || '?')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{consultant.commercial_name}</p>
                          <p className="text-[11px] text-muted-foreground">Consultor</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Process status */}
              {process && (
                <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Processo de Angariação</p>
                      <p className="text-sm font-bold mt-1">{process.external_ref}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums">{process.percent_complete || 0}%</p>
                        <p className="text-[10px] text-muted-foreground">Progresso</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push(`/dashboard/processos/${process.id}`)}>
                        Ver Processo
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full rounded-full bg-neutral-900 dark:bg-white transition-all duration-500" style={{ width: `${process.percent_complete || 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  )
}

export default function NegocioDetailPage() {
  const { id: leadId, negocioId } = useParams<{ id: string; negocioId: string }>()
  const router = useRouter()
  const { user } = useUser()

  const [negocio, setNegocio] = useState<NegocioWithLeadBasic | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [refreshKey, setRefreshKey] = useState(0)
  const [acquisitionDialogOpen, setAcquisitionDialogOpen] = useState(false)
  const [aiFillOpen, setAiFillOpen] = useState(false)

  // Property tracking
  const [properties, setProperties] = useState<NegocioProperty[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [isLoadingMatches, setIsLoadingMatches] = useState(false)
  const [addingPropertyId, setAddingPropertyId] = useState<string | null>(null)

  // Dossier AI scores
  const [dossierScores, setDossierScores] = useState<Map<string, { score: number; reason: string }>>(new Map())
  const [isLoadingDossierScores, setIsLoadingDossierScores] = useState(false)

  const scoreDossierProperties = useCallback(async () => {
    const propertyIds = properties.filter(p => p.property_id).map(p => p.property_id!)
    if (propertyIds.length === 0) return
    setIsLoadingDossierScores(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/property-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_ids: propertyIds }),
      })
      if (res.ok) {
        const json = await res.json()
        const map = new Map<string, { score: number; reason: string }>()
        for (const s of json.scores || []) {
          map.set(s.id, { score: s.score, reason: s.reason })
        }
        setDossierScores(map)
      }
    } catch { /* silent */ }
    finally { setIsLoadingDossierScores(false) }
  }, [properties, negocioId])

  const openBuyerDetail = useCallback(async (buyer: any) => {
    setSelectedBuyer(buyer)
    setBuyerDetail(null)
    setIsLoadingBuyerDetail(true)
    try {
      const res = await fetch(`/api/negocios/${buyer.negocioId}`)
      if (res.ok) {
        const data = await res.json()
        setBuyerDetail(data)
      }
    } catch { /* silent */ }
    finally { setIsLoadingBuyerDetail(false) }
  }, [])

  // Property detail sheet
  const [selectedProperty, setSelectedProperty] = useState<NegocioProperty | null>(null)

  // External link dialog
  const [showExternalDialog, setShowExternalDialog] = useState(false)
  const [extUrl, setExtUrl] = useState('')
  const [extTitle, setExtTitle] = useState('')
  const [extPrice, setExtPrice] = useState('')
  const [extSource, setExtSource] = useState('')
  const [isAddingExternal, setIsAddingExternal] = useState(false)

  // Visits
  const [visits, setVisits] = useState<VisitWithRelations[]>([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(false)
  const [showVisitDialog, setShowVisitDialog] = useState(false)
  const [visitPropertyId, setVisitPropertyId] = useState<string | null>(null)
  const [selectedVisitDate, setSelectedVisitDate] = useState<Date | undefined>(undefined)

  // Interessados
  const [interessados, setInteressados] = useState<any[]>([])
  const [isLoadingInteressados, setIsLoadingInteressados] = useState(false)
  const [hiddenInteressados, setHiddenInteressados] = useState<Set<string>>(new Set())
  const [colleagueFilter, setColleagueFilter] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [selectedBuyer, setSelectedBuyer] = useState<any | null>(null)
  const [buyerDetail, setBuyerDetail] = useState<any | null>(null)
  const [isLoadingBuyerDetail, setIsLoadingBuyerDetail] = useState(false)

  // Profile sheets
  const [showProfileSheet, setShowProfileSheet] = useState(false)
  const [showVendaProfileSheet, setShowVendaProfileSheet] = useState(false)
  const [sheetTab, setSheetTab] = useState<'imovel' | 'credito' | 'contexto'>('imovel')

  // Compra e Venda perspective toggle
  const [perspective, setPerspective] = useState<'compra' | 'venda'>('compra')

  // Venda stats (fetched from property interessados)
  const [vendaStats, setVendaStats] = useState({ visits: 0, interessados: 0, propostas: 0 })

  const loadNegocio = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`)
      if (!res.ok) throw new Error('Negócio não encontrado')
      const data = await res.json()
      setNegocio(data)
      setForm(data)
    } catch {
      toast.error('Erro ao carregar negócio')
      router.push(`/dashboard/leads/${leadId}`)
    } finally {
      setIsLoading(false)
    }
  }, [negocioId, leadId, router])

  const fetchProperties = useCallback(async () => {
    const res = await fetch(`/api/negocios/${negocioId}/properties`)
    if (res.ok) {
      const json = await res.json()
      setProperties(json.data || [])
    }
  }, [negocioId])

  const fetchMatches = useCallback(async (withScore = false) => {
    setIsLoadingMatches(true)
    try {
      const url = `/api/negocios/${negocioId}/property-matches${withScore ? '?score=true' : ''}`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setMatches(json.data || [])
      }
    } catch { setMatches([]) }
    finally { setIsLoadingMatches(false) }
  }, [negocioId])

  const fetchVisits = useCallback(async () => {
    setIsLoadingVisits(true)
    try {
      const res = await fetch(`/api/visits?lead_id=${leadId}&limit=50`)
      if (res.ok) { const json = await res.json(); setVisits(json.data || []) }
    } catch { setVisits([]) }
    finally { setIsLoadingVisits(false) }
  }, [leadId])

  const fetchInteressados = useCallback(async (withScore = false) => {
    setIsLoadingInteressados(true)
    try {
      const url = `/api/negocios/${negocioId}/interessados${withScore ? '?score=true' : ''}`
      const res = await fetch(url)
      if (res.ok) { const json = await res.json(); setInteressados(json.data || []) }
    } catch { setInteressados([]) }
    finally { setIsLoadingInteressados(false) }
  }, [negocioId])

  useEffect(() => { loadNegocio() }, [loadNegocio])

  const tipo = (form.tipo as string) || negocio?.tipo || ''
  const estado = (form.estado as string) || negocio?.estado || 'Aberto'
  const isBuyerType = ['Compra', 'Compra e Venda'].includes(tipo)
  const isSellerType = ['Venda', 'Compra e Venda'].includes(tipo)
  const isInAcompanhamento = isBuyerType && ['Em Acompanhamento', 'Proposta'].includes(estado)

  // Load properties (both standard + acompanhamento)
  useEffect(() => {
    if (isBuyerType && negocioId) { fetchProperties() }
  }, [isBuyerType, negocioId, fetchProperties])

  // Fetch venda stats (visits/interessados/propostas for the linked property)
  useEffect(() => {
    if (tipo !== 'Compra e Venda') return
    async function fetchVendaStats() {
      try {
        const procRes = await fetch(`/api/processes?negocio_id=${negocioId}&limit=1`)
        if (!procRes.ok) return
        const procJson = await procRes.json()
        const proc = procJson.data?.[0]
        if (!proc?.property_id) return

        const [visitsRes, interessadosRes] = await Promise.all([
          fetch(`/api/properties/${proc.property_id}/visits`).then(r => r.ok ? r.json() : { data: [] }),
          fetch(`/api/properties/${proc.property_id}/interessados`).then(r => r.ok ? r.json() : { linked: [] }),
        ])

        const visitCount = visitsRes.data?.length || 0
        const linked = interessadosRes.linked || []
        const interessadosCount = linked.filter((l: any) => l.status === 'interested').length
        const propostasCount = linked.filter((l: any) => l.status === 'proposal').length

        setVendaStats({ visits: visitCount, interessados: interessadosCount, propostas: propostasCount })
      } catch {}
    }
    fetchVendaStats()
  }, [tipo, negocioId])

  const updateField = (field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {}
      const skipFields = ['id', 'lead_id', 'created_at', 'lead']
      for (const [key, value] of Object.entries(form)) {
        if (skipFields.includes(key)) continue
        body[key] = value ?? null
      }
      const res = await fetch(`/api/negocios/${negocioId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Erro ao guardar') }
      toast.success('Negócio actualizado com sucesso')
      setRefreshKey((k) => k + 1)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Erro ao guardar') }
    finally { setIsSaving(false) }
  }

  const saveSidebarField = async (field: string, value: unknown) => {
    updateField(field, value)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) })
      if (!res.ok) throw new Error('Erro ao guardar')
      toast.success('Actualizado')
    } catch { toast.error('Erro ao guardar') }
  }

  const handleSaveObservations = async (next: string | null) => {
    const res = await fetch(`/api/negocios/${negocioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observacoes: next }),
    })
    if (!res.ok) throw new Error('Failed to save')
    setForm((prev) => ({ ...prev, observacoes: next }))
  }

  const handleTemperaturaChange = async (next: Temperatura) => {
    updateField('temperatura', next)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperatura: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Erro ao guardar temperatura')
    }
  }

  const handlePipelineStageChange = async (stage: { id: string; name: string }) => {
    updateField('pipeline_stage_id', stage.id)
    updateField('estado', stage.name)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage_id: stage.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Fase actualizada')
    } catch {
      toast.error('Erro ao actualizar fase')
    }
  }

  const handleQuickFillApply = async (fields: Record<string, unknown>) => {
    const newForm = { ...form, ...fields }
    setForm(newForm)
    try {
      await fetch(`/api/negocios/${negocioId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) })
      setRefreshKey((k) => k + 1)
    } catch { toast.error('Erro ao guardar dados extraídos') }
  }

  // Property actions
  const handleAddProperty = async (propertyId: string) => {
    setAddingPropertyId(propertyId)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ property_id: propertyId }) })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || 'Erro') }
      toast.success('Imóvel adicionado')
      fetchProperties()
      setMatches((prev) => prev.filter((m) => m.id !== propertyId))
    } catch (err: any) { toast.error(err?.message || 'Erro ao adicionar imóvel') }
    finally { setAddingPropertyId(null) }
  }

  const handleUpdatePropertyStatus = async (propId: string, status: string) => {
    const res = await fetch(`/api/negocios/${negocioId}/properties/${propId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (res.ok) { toast.success('Estado actualizado'); fetchProperties() }
    else toast.error('Erro ao actualizar')
  }

  const handleRemoveProperty = async (propId: string) => {
    const res = await fetch(`/api/negocios/${negocioId}/properties/${propId}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Imóvel removido'); fetchProperties() }
    else toast.error('Erro ao remover')
  }

  const handleAddExternalProperty = async () => {
    if (!extUrl.trim()) return
    setIsAddingExternal(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ external_url: extUrl.trim(), external_title: extTitle.trim() || null, external_price: extPrice ? Number(extPrice) : null, external_source: extSource || null }) })
      if (!res.ok) throw new Error('Erro')
      toast.success('Link adicionado')
      setShowExternalDialog(false); setExtUrl(''); setExtTitle(''); setExtPrice(''); setExtSource('')
      fetchProperties()
    } catch { toast.error('Erro ao adicionar link externo') }
    finally { setIsAddingExternal(false) }
  }

  const handleCreateVisit = async (data: any) => {
    try {
      const res = await fetch('/api/visits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || 'Erro ao agendar visita') }
      toast.success('Visita agendada com sucesso')
      setShowVisitDialog(false); setVisitPropertyId(null); fetchVisits()
      return true
    } catch (err: any) { toast.error(err?.message || 'Erro ao agendar visita'); return null }
  }

  const handleStartFinanciamento = (propertyId?: string) => {
    router.push(`/dashboard/credito/novo?lead_id=${leadId}&negocio_id=${negocioId}${propertyId ? `&property_id=${propertyId}` : ''}`)
  }

  // ── Build matching extra tabs for NegocioDataCard ──
  const buildMatchingTabs = () => {
    const tabs: { value: string; label: string; content: React.ReactNode; onActivate?: () => void }[] = []

    // Buyer → Matching tab (suggestions only)
    if (isBuyerType) {
      tabs.push({
        value: 'matching',
        label: 'Matching',
        onActivate: () => { if (matches.length === 0 && !isLoadingMatches) fetchMatches() },
        content: (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{matches.length > 0 ? `${matches.length} imóveis compatíveis` : 'Baseado no orçamento, localização e tipo'}</p>
              <div className="flex items-center gap-1.5">
                {matches.length > 0 && (
                  <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => fetchMatches(true)} disabled={isLoadingMatches}>
                    {isLoadingMatches ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}Classificar IA
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => fetchMatches()}>
                  <Sparkles className="mr-1 h-3 w-3" />Actualizar
                </Button>
              </div>
            </div>
            {isLoadingMatches ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (<div key={i} className="rounded-xl border overflow-hidden flex"><Skeleton className="w-28 h-24" /><div className="flex-1 p-3.5 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div></div>))}
              </div>
            ) : matches.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum imóvel compatível encontrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Ajuste o perfil de procura para ampliar os resultados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matches.map((p, idx) => {
                  const cover = p.dev_property_media?.find((m: any) => m.is_cover)?.url || p.dev_property_media?.[0]?.url
                  const specs = p.dev_property_specifications
                  const isAdding = addingPropertyId === p.id
                  const score = p.match_score as number | null
                  const scoreColor = score != null
                    ? score >= 80 ? 'bg-emerald-500 text-white'
                    : score >= 60 ? 'bg-amber-500 text-white'
                    : score >= 40 ? 'bg-orange-500 text-white'
                    : 'bg-red-500 text-white'
                    : ''
                  return (
                    <div key={p.id} className={cn('group rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-card/80 animate-in fade-in slide-in-from-bottom-2',
                      p.price_flag === 'yellow' && 'ring-2 ring-amber-400/60',
                      p.price_flag === 'orange' && 'ring-2 ring-orange-400/60',
                      p.price_flag === 'red' && 'ring-2 ring-red-400/60'
                    )} style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}>
                      <div className="flex">
                        <div className="w-28 shrink-0 relative bg-muted">
                          {cover ? (<img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />) : (<div className="absolute inset-0 flex items-center justify-center"><Building2 className="h-6 w-6 text-muted-foreground/30" /></div>)}
                          {p.listing_price && (
                            <div className="absolute bottom-2 left-2">
                              <span className={cn('inline-flex items-center backdrop-blur-sm text-[11px] font-bold px-2 py-0.5 rounded-full',
                                p.price_flag === 'green' ? 'bg-emerald-900/80 text-emerald-100' :
                                p.price_flag === 'yellow' ? 'bg-amber-900/80 text-amber-100' :
                                p.price_flag === 'orange' ? 'bg-orange-900/80 text-orange-100' :
                                'bg-red-900/80 text-red-100'
                              )}>{(p.listing_price / 1000).toFixed(0)}k €</span>
                            </div>
                          )}
                          {score != null && (
                            <div className="absolute top-2 right-2">
                              <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full', scoreColor)}>{score}%</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 p-3.5 min-w-0 flex flex-col">
                          <p className="text-sm font-semibold truncate leading-tight">{p.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{[p.external_ref, p.city, p.zone].filter(Boolean).join(' · ')}</p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                            {specs?.bedrooms && <span>{specs.bedrooms} quartos</span>}
                            {specs?.area_util && <span>{specs.area_util} m²</span>}
                          </div>
                          {p.match_reason && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1 italic truncate">{p.match_reason}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-auto pt-2">
                            <Button variant="outline" size="sm" className="h-7 rounded-full text-xs flex-1" disabled={isAdding} onClick={() => handleAddProperty(p.id)}>
                              {isAdding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />} Adicionar ao dossier
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => router.push(`/dashboard/imoveis/${p.slug || p.id}`)}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ),
      })

      // Buyer → Imóveis tab (added/follow-up properties)
      tabs.push({
        value: 'imoveis',
        label: `Imóveis${properties.length > 0 ? ` (${properties.length})` : ''}`,
        content: (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {properties.length > 0
                  ? `${properties.length} imóv${properties.length === 1 ? 'el' : 'eis'} adicionado${properties.length === 1 ? '' : 's'} ao dossier`
                  : 'Sem imóveis no dossier'}
              </p>
              <div className="flex items-center gap-1.5">
                {properties.length > 0 && (
                  <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={scoreDossierProperties} disabled={isLoadingDossierScores}>
                    {isLoadingDossierScores ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}Classificar IA
                  </Button>
                )}
                <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => setShowExternalDialog(true)}>
                  <Link2 className="mr-1 h-3 w-3" /> Adicionar Link
                </Button>
              </div>
            </div>
            {properties.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum imóvel adicionado ao dossier</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Adicione imóveis a partir do tab Matching ou um link externo.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {properties.map((ap) => {
                    const isExternal = !ap.property_id && ap.external_url
                    const p = ap.property
                    const cover = p?.dev_property_media?.find((m: any) => m.is_cover)?.url || p?.dev_property_media?.[0]?.url
                    const specs = p?.dev_property_specifications
                    const propStatus = NEGOCIO_PROPERTY_STATUS[ap.status as keyof typeof NEGOCIO_PROPERTY_STATUS]
                    const price = isExternal ? ap.external_price : p?.listing_price
                    const dScore = ap.property_id ? dossierScores.get(ap.property_id) : null
                    const dScoreColor = dScore
                      ? dScore.score >= 80 ? 'bg-emerald-500 text-white'
                      : dScore.score >= 60 ? 'bg-amber-500 text-white'
                      : dScore.score >= 40 ? 'bg-orange-500 text-white'
                      : 'bg-red-500 text-white'
                      : ''

                    return (
                      <div key={ap.id} className="group rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg">
                        <div className="flex">
                          <div className="w-28 shrink-0 relative bg-muted">
                            {cover ? (
                              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                {isExternal ? <Globe className="h-6 w-6 text-muted-foreground/30" /> : <Building2 className="h-6 w-6 text-muted-foreground/30" />}
                              </div>
                            )}
                            {price && (
                              <div className="absolute bottom-2 left-2">
                                <span className="inline-flex items-center bg-neutral-900/80 backdrop-blur-sm text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{(Number(price) / 1000).toFixed(0)}k €</span>
                              </div>
                            )}
                            {dScore && (
                              <div className="absolute top-2 right-2">
                                <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full', dScoreColor)}>{dScore.score}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 p-3.5 min-w-0 flex flex-col">
                            <p className="text-sm font-semibold truncate leading-tight">{isExternal ? (ap.external_title || 'Link Externo') : (p?.title || 'Imóvel')}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              {isExternal ? (ap.external_source || 'Portal externo') : [p?.external_ref, p?.city, p?.zone].filter(Boolean).join(' · ')}
                            </p>
                            {!isExternal && specs && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                                {specs.bedrooms && <span>{specs.bedrooms} quartos</span>}
                                {specs.area_util && <span>{specs.area_util} m²</span>}
                              </div>
                            )}
                            {dScore?.reason && (
                              <p className="text-[10px] text-muted-foreground/70 mt-1 italic truncate">{dScore.reason}</p>
                            )}
                            <div className="flex items-center gap-1.5 mt-auto pt-2">
                              <Badge className={cn('rounded-full text-[9px] px-2 border-0', propStatus?.bg, propStatus?.text)}>{propStatus?.label}</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-full ml-auto text-muted-foreground hover:text-foreground"
                                title="Agendar visita"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setVisitPropertyId(p?.id || null)
                                  setShowVisitDialog(true)
                                }}
                              >
                                <CalendarDays className="h-3 w-3" />
                              </Button>
                              {isExternal ? (
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => window.open(ap.external_url!, '_blank')}><ExternalLink className="h-3 w-3" /></Button>
                              ) : p?.id && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => router.push(`/dashboard/imoveis/${p.slug || p.id}`)}><ExternalLink className="h-3 w-3" /></Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground/40 hover:text-destructive" onClick={() => handleRemoveProperty(ap.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ),
      })
    }

    // Visitas tab (buyers + sellers)
    tabs.push({
      value: 'visitas',
      label: `Visitas${visits.length > 0 ? ` (${visits.length})` : ''}`,
      onActivate: () => { if (visits.length === 0 && !isLoadingVisits) fetchVisits() },
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {visits.length > 0 ? `${visits.length} visita${visits.length !== 1 ? 's' : ''}` : 'Sem visitas agendadas'}
            </p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowVisitDialog(true)}>
              <Plus className="mr-1 h-3 w-3" />
              Nova Visita
            </Button>
          </div>
          {isLoadingVisits ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma visita agendada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visits.map((visit, idx) => {
                const vStatus = VISIT_STATUS_COLORS[visit.status as keyof typeof VISIT_STATUS_COLORS]
                const visitDate = new Date(`${visit.visit_date}T${visit.visit_time}`)
                return (
                  <div
                    key={visit.id}
                    onClick={() => router.push(`/dashboard/calendario?event=visit:${visit.id}&date=${visit.visit_date}`)}
                    className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 flex gap-4 transition-all hover:shadow-md hover:bg-card/80 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}
                  >
                    <div className="flex flex-col items-center justify-center w-14 shrink-0 rounded-lg bg-muted/40 p-2">
                      <span className="text-lg font-bold tabular-nums leading-none">{format(visitDate, 'd', { locale: pt })}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{format(visitDate, 'MMM', { locale: pt })}</span>
                      <span className="text-[11px] font-medium mt-0.5">{visit.visit_time?.slice(0, 5)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{visit.property?.title || 'Imóvel'}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{visit.property?.external_ref && `${visit.property.external_ref} · `}{visit.property?.city}{visit.property?.zone ? `, ${visit.property.zone}` : ''}</p>
                        </div>
                        {vStatus && (
                          <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', vStatus.bg, vStatus.text)}>{vStatus.label}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {visit.duration_minutes} min
                        {visit.consultant?.commercial_name && (<><span className="text-muted-foreground/30">·</span>{visit.consultant.commercial_name}</>)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ),
    })

    // Seller → Compradores tab
    if (isSellerType) {
      const myBuyers = interessados.filter((i: any) => i.isMine)
      const colleagueBuyers = interessados.filter((i: any) => !i.isMine)
      // Unique colleagues that have matching buyers
      const availableColleagues = [...new Set(colleagueBuyers.map((i: any) => i.colleague as string))].filter(Boolean).sort()
      const filteredColleagueBuyers = colleagueFilter
        ? colleagueBuyers.filter((i: any) => i.colleague === colleagueFilter)
        : colleagueBuyers

      const renderBuyerCard = (int: any, idx: number) => {
        const isHidden = hiddenInteressados.has(int.negocioId)
        const score = int.match_score as number | null
        const scoreColor = score != null
          ? score >= 80 ? 'bg-emerald-500 text-white'
          : score >= 60 ? 'bg-amber-500 text-white'
          : score >= 40 ? 'bg-orange-500 text-white'
          : 'bg-red-500 text-white'
          : ''
        if (!showHidden && isHidden) return null
        return (
          <div key={int.negocioId} className={cn('rounded-xl border bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between transition-all duration-300 animate-in fade-in slide-in-from-bottom-2', isHidden && 'opacity-50', int.isMine && 'cursor-pointer hover:shadow-md hover:bg-card/80')} style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }} onClick={int.isMine ? () => openBuyerDetail(int) : undefined}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{int.firstName}</p>
                {score != null && (
                  <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full', scoreColor)}>{score}%</span>
                )}
                {int.stageName && (
                  <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted/60" style={int.stageColor ? { backgroundColor: `${int.stageColor}20`, color: int.stageColor } : undefined}>{int.stageName}</span>
                )}
              </div>
              {!int.isMine && (
                <p className="text-xs text-muted-foreground truncate">{int.colleague}</p>
              )}
              {int.match_reason && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic truncate">{int.match_reason}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {int.phone && (
                <a href={`tel:${int.phone}`} className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all" title={`Ligar ${int.isMine ? int.firstName : int.colleague}`}>
                  <Phone className="h-3.5 w-3.5" />
                </a>
              )}
              {int.phone && (
                <a href={`https://wa.me/351${int.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all" title={`WhatsApp ${int.isMine ? int.firstName : int.colleague}`}>
                  <WhatsAppIcon className="h-3.5 w-3.5" />
                </a>
              )}
              {int.email && (
                <a href={`mailto:${int.email}`} className="h-8 w-8 rounded-full bg-muted/40 backdrop-blur-sm border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all" title={`Email ${int.isMine ? int.firstName : int.colleague}`}>
                  <Mail className="h-3.5 w-3.5" />
                </a>
              )}
              {!int.isMine && (
                <button
                  onClick={() => {
                    setHiddenInteressados(prev => {
                      const next = new Set(prev)
                      if (next.has(int.negocioId)) next.delete(int.negocioId)
                      else next.add(int.negocioId)
                      return next
                    })
                  }}
                  className={cn('h-8 w-8 rounded-full border border-border/50 flex items-center justify-center transition-all',
                    isHidden ? 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70' : 'bg-muted/40 text-muted-foreground hover:text-red-500 hover:bg-red-50 hover:border-red-200'
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

      tabs.push({
        value: 'compradores',
        label: `Compradores${interessados.length > 0 ? ` (${interessados.length})` : ''}`,
        onActivate: () => { if (interessados.length === 0 && !isLoadingInteressados) fetchInteressados() },
        content: (
          <div className="space-y-4">
            {/* Actions bar */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {interessados.length > 0
                  ? `${myBuyers.length} meu${myBuyers.length !== 1 ? 's' : ''} · ${colleagueBuyers.length} de colegas`
                  : 'Compradores que procuram imóveis semelhantes'}
              </p>
              <div className="flex items-center gap-1.5">
                {hiddenInteressados.size > 0 && (
                  <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => setShowHidden(!showHidden)}>
                    {showHidden ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                    {showHidden ? 'Ocultar' : `${hiddenInteressados.size} oculto${hiddenInteressados.size !== 1 ? 's' : ''}`}
                  </Button>
                )}
                {interessados.length > 0 && (
                  <Button variant="outline" size="sm" className="rounded-full text-xs" onClick={() => fetchInteressados(true)} disabled={isLoadingInteressados}>
                    {isLoadingInteressados ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}Classificar IA
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => fetchInteressados()}>
                  <Users className="mr-1 h-3 w-3" />Actualizar
                </Button>
              </div>
            </div>

            {isLoadingInteressados ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
            ) : interessados.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum comprador potencial encontrado</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Preencha os dados do imóvel para encontrar compradores compatíveis</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* ── My buyers ── */}
                {myBuyers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Os meus compradores</p>
                    {myBuyers.map((int, idx) => renderBuyerCard(int, idx))}
                  </div>
                )}

                {/* ── Colleague buyers ── */}
                {colleagueBuyers.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Compradores de colegas</p>
                      {availableColleagues.length > 1 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            onClick={() => setColleagueFilter(null)}
                            className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
                              !colleagueFilter ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                            )}
                          >Todos</button>
                          {availableColleagues.map((name) => (
                            <button
                              key={name}
                              onClick={() => setColleagueFilter(colleagueFilter === name ? null : name)}
                              className={cn('text-[10px] px-2 py-0.5 rounded-full transition-colors',
                                colleagueFilter === name ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                              )}
                            >{name}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    {filteredColleagueBuyers.map((int, idx) => renderBuyerCard(int, idx))}
                  </div>
                )}
              </div>
            )}
          </div>
        ),
      })
    }

    return tabs
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    )
  }

  if (!negocio) return null

  const neg = form as any
  const clientName = negocio.lead?.nome || negocio.lead?.full_name || 'Lead'
  const phone = negocio.lead?.telemovel || negocio.lead?.telefone || null
  const email = negocio.lead?.email || null

  const budgetText = neg.orcamento
    ? neg.orcamento_max
      ? `${(neg.orcamento / 1000).toFixed(0)}k — ${(neg.orcamento_max / 1000).toFixed(0)}k €`
      : `até ${(neg.orcamento / 1000).toFixed(0)}k €`
    : '—'

  const visitedCount = properties.filter(p => p.status === 'visited').length
  const interestedCount = properties.filter(p => p.status === 'interested').length
  const statusStyle = NEGOCIO_ESTADO_COLORS[estado as keyof typeof NEGOCIO_ESTADO_COLORS] || NEGOCIO_ESTADO_COLORS['Aberto']

  // ──── CONVERGED VIEW ────
  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 py-6 sm:px-8 sm:py-8">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10">
          {/* Back */}
          <button
            onClick={() => router.push(`/dashboard/leads/${leadId}`)}
            className="mb-4 -ml-1 inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white border border-white/20 px-3.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/25 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar
          </button>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">{tipo}</p>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">{clientName}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <EstadoPipelineSelector
                  tipo={tipo}
                  perspective={tipo === 'Compra e Venda' ? perspective : undefined}
                  pipelineStageId={(form.pipeline_stage_id as string) || (negocio?.pipeline_stage_id as string | undefined) || null}
                  fallbackLabel={estado}
                  onChange={handlePipelineStageChange}
                />
                <TemperaturaSelector
                  value={(form.temperatura as Temperatura) || null}
                  onChange={handleTemperaturaChange}
                />
                <ObservationsButton
                  observacoes={(form.observacoes as string | null) ?? null}
                  onSave={handleSaveObservations}
                />
                <span className="text-neutral-500 text-xs">
                  desde {format(new Date(negocio.created_at), "d MMM yyyy", { locale: pt })}
                </span>
              </div>
            </div>

            {/* Quick contact + AI fill */}
            <div className="hidden sm:flex items-center gap-2">
              {phone && (
                <a href={`tel:${phone}`} className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" title="Ligar">
                  <Phone className="h-4 w-4" />
                </a>
              )}
              {phone && (
                <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" title="WhatsApp">
                  <WhatsAppIcon className="h-4 w-4" />
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all" title="Email">
                  <Mail className="h-4 w-4" />
                </a>
              )}
              {/* Separator */}
              <span className="h-6 w-px bg-white/15 mx-1" aria-hidden />
              {/* AI fill — same shape as contact buttons */}
              <button
                type="button"
                onClick={() => setAiFillOpen(true)}
                className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
                title="Preencher com IA"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Compra e Venda perspective toggle */}
          {tipo === 'Compra e Venda' && (
            <div className="mt-4">
              <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-white/10">
                <button onClick={() => setPerspective('compra')}
                  className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300',
                    perspective === 'compra' ? 'bg-white text-neutral-900 shadow-sm' : 'text-white/60 hover:text-white'
                  )}
                >Compra</button>
                <button onClick={() => setPerspective('venda')}
                  className={cn('px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300',
                    perspective === 'venda' ? 'bg-white text-neutral-900 shadow-sm' : 'text-white/60 hover:text-white'
                  )}
                >Venda</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <NegocioDataCard tipo={tipo} negocioId={negocioId} form={form} onFieldChange={updateField} onSave={handleSave} isSaving={isSaving} refreshKey={refreshKey}
        extraTabs={buildMatchingTabs()}
        onAiFillClick={() => setAiFillOpen(true)}
      />

      <AcquisitionDialog open={acquisitionDialogOpen} onOpenChange={setAcquisitionDialogOpen} negocioId={negocioId} prefillData={mapNegocioToAcquisition(form)} onComplete={(procInstanceId) => { setAcquisitionDialogOpen(false); toast.success('Angariação criada com sucesso!'); router.push(`/dashboard/processos/${procInstanceId}`) }} />
      <AiFillDialog open={aiFillOpen} onOpenChange={setAiFillOpen} negocioId={negocioId} onApply={handleQuickFillApply} />

      {/* External Link Dialog */}
      <Dialog open={showExternalDialog} onOpenChange={setShowExternalDialog}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm"><Link2 className="h-4 w-4" /></div>
                Adicionar Link Externo
              </DialogTitle>
              <DialogDescription className="text-neutral-400 mt-1">Imóvel de um portal externo (Idealista, Imovirtual, etc.)</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="text-xs font-medium">URL do Imóvel *</Label><Input className="rounded-xl" placeholder="https://www.idealista.pt/imovel/..." value={extUrl} onChange={(e) => setExtUrl(e.target.value)} /></div>
            <div className="space-y-2"><Label className="text-xs font-medium">Título / Descrição</Label><Input className="rounded-xl" placeholder="T3 em Cascais com vista mar" value={extTitle} onChange={(e) => setExtTitle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-xs font-medium">Preço (€)</Label><Input className="rounded-xl" type="number" placeholder="350000" value={extPrice} onChange={(e) => setExtPrice(e.target.value)} /></div>
              <div className="space-y-2"><Label className="text-xs font-medium">Portal</Label>
                <Select value={extSource} onValueChange={setExtSource}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent><SelectItem value="idealista">Idealista</SelectItem><SelectItem value="imovirtual">Imovirtual</SelectItem><SelectItem value="casa_sapo">Casa Sapo</SelectItem><SelectItem value="supercasa">Supercasa</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" className="rounded-full" onClick={() => setShowExternalDialog(false)}>Cancelar</Button>
            <Button className="rounded-full px-6" disabled={!extUrl.trim() || isAddingExternal} onClick={handleAddExternalProperty}>{isAddingExternal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Visit Dialog */}
      <Dialog open={showVisitDialog} onOpenChange={(open) => { if (!open) { setShowVisitDialog(false); setVisitPropertyId(null) } }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
          <div className="-mx-6 -mt-6 mb-4 bg-neutral-900 rounded-t-2xl px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-white">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/15 backdrop-blur-sm"><CalendarDays className="h-4 w-4" /></div>
                Agendar Visita
              </DialogTitle>
              <DialogDescription className="text-neutral-400 mt-1">Agende uma visita para {clientName}</DialogDescription>
            </DialogHeader>
          </div>
          <VisitForm defaultPropertyId={visitPropertyId || undefined} defaultLeadId={leadId} defaultConsultantId={user?.id} onSubmit={handleCreateVisit} onCancel={() => { setShowVisitDialog(false); setVisitPropertyId(null) }} />
        </DialogContent>
      </Dialog>

      {/* legacy buyer detail / external dialog blocks below kept intact */}

        {/* Buyer Detail Sheet (own buyers) */}
        <Sheet open={!!selectedBuyer} onOpenChange={(open) => { if (!open) { setSelectedBuyer(null); setBuyerDetail(null) } }}>
          <SheetContent className="sm:max-w-md p-0 flex flex-col gap-0 overflow-y-auto">
            {selectedBuyer && (
              <>
                <div className="shrink-0 bg-neutral-900 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center text-white font-bold text-sm">
                      {selectedBuyer.firstName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <SheetHeader className="space-y-0"><SheetTitle className="text-white text-base">{selectedBuyer.firstName}</SheetTitle></SheetHeader>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedBuyer.stageName && (
                          <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/15 text-white/80">{selectedBuyer.stageName}</span>
                        )}
                        {selectedBuyer.match_score != null && (
                          <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                            selectedBuyer.match_score >= 80 ? 'bg-emerald-500 text-white' :
                            selectedBuyer.match_score >= 60 ? 'bg-amber-500 text-white' :
                            selectedBuyer.match_score >= 40 ? 'bg-orange-500 text-white' :
                            'bg-red-500 text-white'
                          )}>{selectedBuyer.match_score}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Contact info */}
                  {(selectedBuyer.phone || selectedBuyer.email) && (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Contacto</p>
                      <div className="flex items-center gap-2">
                        {selectedBuyer.phone && (
                          <a href={`tel:${selectedBuyer.phone}`} className="flex-1 flex items-center gap-2 rounded-xl border px-3 py-2.5 hover:bg-muted/30 transition-colors">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{selectedBuyer.phone}</span>
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedBuyer.phone && (
                          <a href={`https://wa.me/351${selectedBuyer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border px-3 py-2.5 hover:bg-muted/30 transition-colors">
                            <WhatsAppIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">WhatsApp</span>
                          </a>
                        )}
                        {selectedBuyer.email && (
                          <a href={`mailto:${selectedBuyer.email}`} className="flex-1 flex items-center gap-2 rounded-xl border px-3 py-2.5 hover:bg-muted/30 transition-colors">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm truncate">{selectedBuyer.email}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Match reason */}
                  {selectedBuyer.match_reason && (
                    <div className="rounded-xl border border-dashed bg-muted/10 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-1">Razão do match</p>
                      <p className="text-sm">{selectedBuyer.match_reason}</p>
                    </div>
                  )}

                  {/* Negócio details */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Perfil de procura</p>
                    {isLoadingBuyerDetail ? (
                      <div className="space-y-2">
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                        <Skeleton className="h-10 rounded-xl" />
                      </div>
                    ) : buyerDetail ? (
                      <div className="grid grid-cols-2 gap-2">
                        {buyerDetail.tipo_imovel && (
                          <div className="rounded-xl border px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">Tipo</p>
                            <p className="text-sm font-medium">{buyerDetail.tipo_imovel}</p>
                          </div>
                        )}
                        {buyerDetail.localizacao && (
                          <div className="rounded-xl border px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">Localização</p>
                            <p className="text-sm font-medium">{buyerDetail.localizacao}</p>
                          </div>
                        )}
                        {(buyerDetail.orcamento || buyerDetail.orcamento_max) && (
                          <div className="rounded-xl border px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">Orçamento</p>
                            <p className="text-sm font-medium">
                              {buyerDetail.orcamento ? `${(buyerDetail.orcamento / 1000).toFixed(0)}k` : '—'}
                              {buyerDetail.orcamento_max ? ` — ${(buyerDetail.orcamento_max / 1000).toFixed(0)}k €` : ' €'}
                            </p>
                          </div>
                        )}
                        {buyerDetail.quartos_min && (
                          <div className="rounded-xl border px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">Quartos mín.</p>
                            <p className="text-sm font-medium">{buyerDetail.quartos_min}</p>
                          </div>
                        )}
                        {buyerDetail.area_min_m2 && (
                          <div className="rounded-xl border px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">Área mín.</p>
                            <p className="text-sm font-medium">{buyerDetail.area_min_m2} m²</p>
                          </div>
                        )}
                        {buyerDetail.estado_imovel && (
                          <div className="rounded-xl border px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">Estado</p>
                            <p className="text-sm font-medium">{buyerDetail.estado_imovel}</p>
                          </div>
                        )}
                        {buyerDetail.observacoes && (
                          <div className="col-span-2 rounded-xl border px-3 py-2">
                            <p className="text-[10px] text-muted-foreground">Observações</p>
                            <p className="text-sm">{buyerDetail.observacoes}</p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Navigate to negócio */}
                  <Button variant="outline" className="w-full rounded-full" onClick={() => { setSelectedBuyer(null); router.push(`/dashboard/crm/negocios/${selectedBuyer.negocioId}`) }}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Ver negócio completo
                  </Button>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    )
  }
