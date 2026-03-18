// @ts-nocheck
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  ArrowLeft, Building2, Plus, Sparkles, Link2, Globe, Loader2, ExternalLink,
  Trash2, CalendarDays, Clock, Star, Home, MapPin, Euro, CreditCard, Landmark,
  Phone, Mail, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useUser } from '@/hooks/use-user'
import { NegocioSidebar } from '@/components/negocios/negocio-sidebar'
import { NegocioDataCard } from '@/components/negocios/negocio-data-card'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { mapNegocioToAcquisition } from '@/lib/utils/negocio-to-acquisition'
import { VisitForm } from '@/components/visits/visit-form'
import {
  NEGOCIO_ESTADO_COLORS,
  NEGOCIO_ESTADO_OPTIONS,
  NEGOCIO_PROPERTY_STATUS,
  VISIT_STATUS_COLORS,
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

  // Property tracking
  const [properties, setProperties] = useState<NegocioProperty[]>([])
  const [matches, setMatches] = useState<any[]>([])
  const [isLoadingMatches, setIsLoadingMatches] = useState(false)
  const [addingPropertyId, setAddingPropertyId] = useState<string | null>(null)

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

  // Profile sheet
  const [showProfileSheet, setShowProfileSheet] = useState(false)
  const [sheetTab, setSheetTab] = useState<'imovel' | 'credito' | 'contexto'>('imovel')

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

  const fetchMatches = useCallback(async () => {
    setIsLoadingMatches(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/property-matches`)
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

  useEffect(() => { loadNegocio() }, [loadNegocio])

  const tipo = (form.tipo as string) || negocio?.tipo || ''
  const estado = (form.estado as string) || negocio?.estado || 'Aberto'
  const isBuyerType = ['Compra', 'Compra e Venda'].includes(tipo)
  const isInAcompanhamento = isBuyerType && ['Em Acompanhamento', 'Proposta'].includes(estado)

  // Load properties when entering acompanhamento mode
  useEffect(() => {
    if (isInAcompanhamento && negocioId) { fetchProperties() }
  }, [isInAcompanhamento, negocioId, fetchProperties])

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

  const saveSidebarField = async (field: string, value: string) => {
    updateField(field, value)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) })
      if (!res.ok) throw new Error('Erro ao guardar')
      toast.success('Actualizado')
    } catch { toast.error('Erro ao guardar') }
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

  // ──── STANDARD VIEW (non-acompanhamento) ────
  if (!isInAcompanhamento) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/leads/${leadId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <div className="flex gap-6 items-start">
          <div className="w-72 shrink-0">
            <NegocioSidebar tipo={tipo} leadName={clientName} createdAt={negocio.created_at} phone={phone} email={email} estado={estado} negocioId={negocioId} onEstadoChange={(v) => saveSidebarField('estado', v)} onQuickFillApply={handleQuickFillApply} onStartAcquisition={() => setAcquisitionDialogOpen(true)} />
          </div>
          <div className="flex-1 min-w-0">
            <NegocioDataCard tipo={tipo} negocioId={negocioId} form={form} onFieldChange={updateField} onSave={handleSave} isSaving={isSaving} refreshKey={refreshKey} />
          </div>
        </div>
        <AcquisitionDialog open={acquisitionDialogOpen} onOpenChange={setAcquisitionDialogOpen} negocioId={negocioId} prefillData={mapNegocioToAcquisition(form)} onComplete={(procInstanceId) => { setAcquisitionDialogOpen(false); toast.success('Angariação criada com sucesso!'); router.push(`/dashboard/processos/${procInstanceId}`) }} />
      </div>
    )
  }

  // ──── ACOMPANHAMENTO VIEW ────
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/leads/${leadId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Lead
      </Button>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900 px-6 py-6 sm:px-8 sm:py-8">
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/60 via-neutral-900/80 to-neutral-950" />
        <div className="relative z-10 flex flex-wrap items-center gap-4 sm:gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-medium">{tipo}</p>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">{clientName}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Select value={estado} onValueChange={(v) => saveSidebarField('estado', v)}>
                <SelectTrigger className={`${statusStyle.bg} ${statusStyle.text} border-0 rounded-full text-[10px] font-medium h-6 w-auto px-2.5 gap-1 [&>svg]:h-3 [&>svg]:w-3`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot} inline-block shrink-0`} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEGOCIO_ESTADO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-neutral-500 text-xs">
                desde {format(new Date(negocio.created_at), "d MMM yyyy", { locale: pt })}
              </span>
            </div>
          </div>

          {/* Quick contact */}
          <div className="hidden sm:flex items-center gap-2">
            {phone && (
              <a href={`tel:${phone}`} className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all">
                <Phone className="h-4 w-4" />
              </a>
            )}
            {phone && (
              <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all">
                <WhatsAppIcon className="h-4 w-4" />
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all">
                <Mail className="h-4 w-4" />
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="hidden lg:flex items-center gap-4 ml-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-white tabular-nums">{properties.length}</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Imóveis</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-400 tabular-nums">{visitedCount}</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Visitados</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400 tabular-nums">{interestedCount}</p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider">Interessados</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Perfil de Procura — compact, clickable */}
          <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-5 space-y-3 transition-all duration-300 hover:shadow-md cursor-pointer group" onClick={() => setShowProfileSheet(true)}>
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Perfil de Procura</h4>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {neg.tipo_imovel && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/60 px-2.5 py-1 rounded-full">
                  <Home className="h-2.5 w-2.5" />{neg.tipo_imovel}
                </span>
              )}
              {neg.quartos_min && (
                <span className="text-[10px] font-medium bg-muted/60 px-2.5 py-1 rounded-full">T{neg.quartos_min}+</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Orçamento</p>
                <p className="text-sm font-bold tabular-nums">{budgetText}</p>
              </div>
              {neg.localizacao && (
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Localização</p>
                  <p className="text-xs font-medium truncate max-w-[120px]">{neg.localizacao}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-4">
          <Tabs defaultValue="properties">
            <div className="flex items-center justify-between gap-3">
              <TabsList className="bg-muted/30">
                <TabsTrigger value="properties" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Building2 className="h-4 w-4" /> Imóveis
                  <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 ml-0.5">{properties.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="matches" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm" onClick={() => { if (matches.length === 0) fetchMatches() }}>
                  <Sparkles className="h-4 w-4" /> Matching
                </TabsTrigger>
                <TabsTrigger value="visits" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm" onClick={() => { if (visits.length === 0) fetchVisits() }}>
                  <CalendarDays className="h-4 w-4" /> Visitas
                  {visits.length > 0 && <Badge variant="secondary" className="text-[10px] rounded-full px-1.5 ml-0.5">{visits.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="form" className="gap-2 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Dados
                </TabsTrigger>
              </TabsList>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowExternalDialog(true)}>
                <Link2 className="mr-1.5 h-3.5 w-3.5" /> Adicionar Link
              </Button>
            </div>

            {/* Properties Tab */}
            <TabsContent value="properties" className="mt-4">
              {properties.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><Building2 className="h-7 w-7 text-muted-foreground/30" /></div>
                  <h3 className="text-base font-medium">Nenhum imóvel sugerido</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">Use a tab "Matching" para encontrar imóveis compatíveis ou adicione um link externo.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {properties.map((ap, idx) => {
                    const isExternal = !ap.property_id && ap.external_url
                    const p = ap.property
                    const cover = p?.dev_property_media?.find((m: any) => m.is_cover)?.url || p?.dev_property_media?.[0]?.url
                    const specs = p?.dev_property_specifications
                    const propStatus = NEGOCIO_PROPERTY_STATUS[ap.status as keyof typeof NEGOCIO_PROPERTY_STATUS]
                    const price = isExternal ? ap.external_price : p?.listing_price

                    return (
                      <div key={ap.id} className="group rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-card/80 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}>
                        <div className="flex">
                          <div className="w-28 shrink-0 relative bg-muted">
                            {cover ? (
                              <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                          </div>
                          <div className="flex-1 p-3.5 min-w-0 flex flex-col">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate leading-tight">{isExternal ? (ap.external_title || 'Link Externo') : (p?.title || 'Imóvel')}</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{isExternal ? (ap.external_source || 'Portal externo') : [p?.external_ref, p?.city, p?.zone].filter(Boolean).join(' · ')}</p>
                              </div>
                              <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', propStatus?.bg, propStatus?.text)}>{propStatus?.label}</Badge>
                            </div>
                            {!isExternal && specs && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                                {specs.bedrooms && <span>{specs.bedrooms} quartos</span>}
                                {specs.area_util && <span>{specs.area_util} m²</span>}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-auto">
                              <Select value={ap.status} onValueChange={(v) => handleUpdatePropertyStatus(ap.id, v)}>
                                <SelectTrigger className="h-6 rounded-full text-[10px] w-auto px-2 bg-muted/30 border-0"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(NEGOCIO_PROPERTY_STATUS).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isExternal ? (
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => window.open(ap.external_url!, '_blank')}><ExternalLink className="h-3 w-3" /></Button>
                              ) : p?.id && (
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => router.push(`/dashboard/imoveis/${p.id}`)}><ExternalLink className="h-3 w-3" /></Button>
                              )}
                              {!isExternal && p?.id && (
                                <Button variant="ghost" size="sm" className="h-6 rounded-full text-[10px] px-2" onClick={() => { setVisitPropertyId(p.id); setShowVisitDialog(true) }}><CalendarDays className="mr-1 h-2.5 w-2.5" />Visita</Button>
                              )}
                              {!isExternal && ap.status === 'interested' && p?.id && (
                                <Button variant="ghost" size="sm" className="h-6 rounded-full text-[10px] px-2" onClick={() => handleStartFinanciamento(p.id)}><Landmark className="mr-1 h-2.5 w-2.5" />Crédito</Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground/40 hover:text-destructive ml-auto opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveProperty(ap.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* Matches Tab */}
            <TabsContent value="matches" className="mt-4">
              {isLoadingMatches ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (<div key={i} className="rounded-xl border overflow-hidden flex"><Skeleton className="w-28 h-24" /><div className="flex-1 p-3.5 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div></div>))}
                </div>
              ) : matches.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><Sparkles className="h-7 w-7 text-muted-foreground/30" /></div>
                  <h3 className="text-base font-medium">Nenhum imóvel compatível</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">Ajuste o perfil de procura para ampliar os resultados.</p>
                  <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={fetchMatches}><Sparkles className="mr-1.5 h-3.5 w-3.5" />Pesquisar novamente</Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">{matches.length} imóveis compatíveis</p>
                    <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={fetchMatches}><Sparkles className="mr-1 h-3 w-3" />Actualizar</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matches.map((p, idx) => {
                      const cover = p.dev_property_media?.find((m: any) => m.is_cover)?.url || p.dev_property_media?.[0]?.url
                      const specs = p.dev_property_specifications
                      const isAdding = addingPropertyId === p.id
                      return (
                        <div key={p.id} className="group rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:shadow-lg hover:bg-card/80 animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}>
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
                            </div>
                            <div className="flex-1 p-3.5 min-w-0 flex flex-col">
                              <p className="text-sm font-semibold truncate leading-tight">{p.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{[p.external_ref, p.city, p.zone].filter(Boolean).join(' · ')}</p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                                {specs?.bedrooms && <span>{specs.bedrooms} quartos</span>}
                                {specs?.area_util && <span>{specs.area_util} m²</span>}
                              </div>
                              <div className="mt-auto pt-2">
                                <Button variant="outline" size="sm" className="h-7 rounded-full text-xs w-full" disabled={isAdding} onClick={() => handleAddProperty(p.id)}>
                                  {isAdding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />} Adicionar ao dossier
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Visits Tab */}
            <TabsContent value="visits" className="mt-4">
              {isLoadingVisits ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{selectedVisitDate ? format(selectedVisitDate, "d 'de' MMMM yyyy", { locale: pt }) : `${visits.length} visita${visits.length !== 1 ? 's' : ''}`}</p>
                    <div className="flex items-center gap-2">
                      {selectedVisitDate && <button onClick={() => setSelectedVisitDate(undefined)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline">Ver todas</button>}
                      <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowVisitDialog(true)}><Plus className="mr-1 h-3 w-3" />Nova Visita</Button>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 flex justify-center">
                    <Calendar mode="single" selected={selectedVisitDate} onSelect={(d) => setSelectedVisitDate(d || undefined)} locale={pt}
                      modifiers={{ hasVisit: visits.map(v => new Date(v.visit_date + 'T00:00:00')) }}
                      modifiersClassNames={{ hasVisit: 'relative after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-blue-500' }}
                    />
                  </div>
                  {(() => {
                    const filtered = selectedVisitDate ? visits.filter(v => v.visit_date === format(selectedVisitDate, 'yyyy-MM-dd')) : visits
                    return filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center">
                        <CalendarDays className="h-6 w-6 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">{selectedVisitDate ? 'Sem visitas neste dia' : 'Nenhuma visita agendada'}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filtered.map((visit, idx) => {
                          const vStatus = VISIT_STATUS_COLORS[visit.status as keyof typeof VISIT_STATUS_COLORS]
                          const visitDate = new Date(`${visit.visit_date}T${visit.visit_time}`)
                          return (
                            <div key={visit.id} className="rounded-xl border bg-card/50 backdrop-blur-sm p-4 flex gap-4 transition-all hover:shadow-sm animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'backwards' }}>
                              <div className="flex flex-col items-center justify-center w-14 shrink-0 rounded-lg bg-muted/40 p-2">
                                <span className="text-lg font-bold tabular-nums leading-none">{format(visitDate, 'd', { locale: pt })}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{format(visitDate, 'MMM', { locale: pt })}</span>
                                <span className="text-[11px] font-medium mt-0.5">{visit.visit_time?.slice(0, 5)}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold truncate">{visit.property?.title || 'Imóvel'}</p>
                                    <p className="text-[11px] text-muted-foreground">{visit.property?.external_ref && `${visit.property.external_ref} · `}{visit.property?.city}{visit.property?.zone ? `, ${visit.property.zone}` : ''}</p>
                                  </div>
                                  <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', vStatus?.bg, vStatus?.text)}>{vStatus?.label}</Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" /> {visit.duration_minutes} min
                                  {visit.consultant?.commercial_name && (<><span className="text-muted-foreground/30">·</span>{visit.consultant.commercial_name}</>)}
                                </div>
                                {visit.feedback_rating && (
                                  <div className="flex items-center gap-1 mt-1.5">
                                    {[1, 2, 3, 4, 5].map((s) => (<Star key={s} className={`h-3 w-3 ${s <= visit.feedback_rating! ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/20'}`} />))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              )}
            </TabsContent>

            {/* Form/Data Tab */}
            <TabsContent value="form" className="mt-4">
              <NegocioDataCard tipo={tipo} negocioId={negocioId} form={form} onFieldChange={updateField} onSave={handleSave} isSaving={isSaving} refreshKey={refreshKey} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

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

      {/* Perfil de Procura Sheet */}
      <Sheet open={showProfileSheet} onOpenChange={setShowProfileSheet}>
        <SheetContent className="sm:max-w-md p-0 flex flex-col gap-0 overflow-hidden">
          <div className="shrink-0 bg-neutral-900 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center"><Home className="h-5 w-5 text-white" /></div>
              <div>
                <SheetHeader className="space-y-0"><SheetTitle className="text-white text-base">Perfil de Procura</SheetTitle></SheetHeader>
                <p className="text-neutral-400 text-xs mt-0.5">{clientName}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {neg.tipo_imovel && <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-white/15 text-white px-2.5 py-1 rounded-full"><Building2 className="h-2.5 w-2.5" />{neg.tipo_imovel}</span>}
              {neg.classe_imovel && <span className="text-[10px] font-medium bg-white/15 text-white px-2.5 py-1 rounded-full">{neg.classe_imovel}</span>}
              {neg.estado_imovel && <span className="text-[10px] font-medium bg-white/15 text-white px-2.5 py-1 rounded-full">{neg.estado_imovel}</span>}
              {neg.quartos_min && <span className="text-[10px] font-medium bg-white/15 text-white px-2.5 py-1 rounded-full">T{neg.quartos_min}+</span>}
              {neg.casas_banho && <span className="text-[10px] font-medium bg-white/15 text-white px-2.5 py-1 rounded-full">{neg.casas_banho} WC</span>}
            </div>
            <div className="flex gap-1 mt-4 p-0.5 rounded-full bg-white/10">
              {(['imovel', 'credito', 'contexto'] as const).map(tab => (
                <button key={tab} onClick={() => setSheetTab(tab)} className={cn('flex-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-300', sheetTab === tab ? 'bg-white text-neutral-900 shadow-sm' : 'text-white/60 hover:text-white')}>
                  {tab === 'imovel' ? 'Imóvel' : tab === 'credito' ? 'Crédito' : 'Contexto'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 space-y-4" key={sheetTab}>
            <div className="animate-in fade-in duration-200">
              {sheetTab === 'imovel' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Orçamento</p><p className="text-lg font-bold tabular-nums mt-1">{budgetText}</p></div>
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Localização</p><div className="flex items-center gap-1.5 mt-1"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><p className="text-sm font-medium truncate">{neg.localizacao || '—'}</p></div></div>
                  </div>
                  {(neg.tem_garagem || neg.tem_elevador || neg.tem_exterior || neg.tem_piscina) && (
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 space-y-2 mt-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Características</p>
                      <div className="flex flex-wrap gap-1.5">
                        {neg.tem_garagem && <Badge variant="secondary" className="rounded-full text-[11px] bg-muted/40">Garagem</Badge>}
                        {neg.tem_elevador && <Badge variant="secondary" className="rounded-full text-[11px] bg-muted/40">Elevador</Badge>}
                        {neg.tem_exterior && <Badge variant="secondary" className="rounded-full text-[11px] bg-muted/40">Exterior</Badge>}
                        {neg.tem_piscina && <Badge variant="secondary" className="rounded-full text-[11px] bg-muted/40">Piscina</Badge>}
                      </div>
                    </div>
                  )}
                  {neg.observacoes && (<div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 mt-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Observações</p><p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{neg.observacoes}</p></div>)}
                </>
              )}
              {sheetTab === 'credito' && (
                <>
                  <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', neg.credito_pre_aprovado ? 'bg-emerald-500/10' : neg.financiamento_necessario ? 'bg-amber-500/10' : 'bg-muted')}>
                        <CreditCard className={cn('h-5 w-5', neg.credito_pre_aprovado ? 'text-emerald-500' : neg.financiamento_necessario ? 'text-amber-500' : 'text-muted-foreground')} />
                      </div>
                      <p className="text-sm font-semibold">{neg.credito_pre_aprovado ? 'Pré-aprovado' : neg.financiamento_necessario ? 'Necessita financiamento' : 'Sem financiamento'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Crédito</p><p className="text-lg font-bold mt-1">{neg.valor_credito ? `${(neg.valor_credito / 1000).toFixed(0)}k €` : '—'}</p></div>
                    <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Capital Próprio</p><p className="text-lg font-bold mt-1">{neg.capital_proprio ? `${(neg.capital_proprio / 1000).toFixed(0)}k €` : '—'}</p></div>
                  </div>
                  <Button variant="outline" className="w-full rounded-full mt-4" onClick={() => { setShowProfileSheet(false); handleStartFinanciamento() }}><Landmark className="mr-2 h-3.5 w-3.5" />Iniciar Financiamento</Button>
                </>
              )}
              {sheetTab === 'contexto' && (
                <>
                  {neg.motivacao_compra && (<div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Motivação de Compra</p><p className="text-sm">{neg.motivacao_compra}</p></div>)}
                  {neg.prazo_compra && (<div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 mt-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Prazo</p><p className="text-sm">{neg.prazo_compra}</p></div>)}
                  <div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-4 mt-4"><p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Resumo Financeiro</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Orçamento</span><span className="font-medium">{budgetText}</span></div>
                      {neg.valor_credito && <div className="flex justify-between"><span className="text-muted-foreground">Crédito</span><span className="font-medium">{(neg.valor_credito / 1000).toFixed(0)}k €</span></div>}
                      {neg.capital_proprio && <div className="flex justify-between"><span className="text-muted-foreground">Capital próprio</span><span className="font-medium">{(neg.capital_proprio / 1000).toFixed(0)}k €</span></div>}
                    </div>
                  </div>
                  {!neg.motivacao_compra && !neg.prazo_compra && (<div className="rounded-2xl border bg-card/50 backdrop-blur-sm p-8 text-center text-sm text-muted-foreground">Sem informações de contexto registadas.</div>)}
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
