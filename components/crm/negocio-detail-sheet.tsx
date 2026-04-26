// @ts-nocheck
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  Building2,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Euro,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Home,
  Info,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Ruler,
  Sparkles,
  Pencil,
  StickyNote,
  Thermometer,
  Trash2,
  User as UserIcon,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUser } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { NEGOCIO_PROPERTY_STATUS, VISIT_STATUS_COLORS } from '@/lib/constants'

import {
  TemperaturaSelector,
  temperaturaEmoji,
  type Temperatura,
} from '@/components/negocios/temperatura-selector'
import { EstadoPipelineSelector } from '@/components/negocios/estado-pipeline-selector'
import { ObservationsButton } from '@/components/crm/observations-dialog'
import { AiFillDialog } from '@/components/negocios/ai-fill-dialog'
import { NegocioDataCard } from '@/components/negocios/negocio-data-card'
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
import { VisitForm } from '@/components/visits/visit-form'
import { NegocioDocumentsFoldersView } from '@/components/negocios/negocio-documents-folders-view'
import { SendPropertiesDialog } from '@/components/negocios/send-properties-dialog'
import { PropertyDetailSheet } from '@/components/properties/property-detail-sheet'
import { Calendar } from '@/components/ui/calendar'
import { CalendarMonthGrid } from '@/components/calendar/calendar-month-grid'
import type { CalendarEvent } from '@/types/calendar'
import { addMonths, subMonths, isSameMonth } from 'date-fns'
import { useRouter } from 'next/navigation'
import { AcquisitionDialog } from '@/components/acquisitions/acquisition-dialog'
import { DealDialog } from '@/components/deals/deal-dialog'
import {
  buildAcquisitionPrefillFromNegocio,
  buildDealPropertyContextFromNegocio,
} from '@/lib/negocios/prefill-from-negocio'
import { InicioExtras } from '@/components/crm/negocio-inicio-extras'
import { MarketStudiesCard } from '@/components/crm/market-studies-card'
import { NegocioProposalsTab } from '@/components/crm/negocio-proposals-tab'
import {
  suggestNegocioToColleagueViaWhatsApp,
  suggestNegocioToColleagueViaInternalChat,
  buildNegocioSpecs,
} from '@/lib/negocios/suggest-to-colleague'
import {
  resolveLeadChat,
  sendOneProperty,
  type PropertyToSend,
} from '@/lib/negocios/send-properties-whatsapp'
import { MessageSquare } from 'lucide-react'
import { WhatsAppChatBubble } from '@/components/whatsapp/whatsapp-chat-bubble'
import { EmailChatBubble } from '@/components/email/email-chat-bubble'

interface NegocioDetailSheetProps {
  negocioId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type TabKey = 'inicio' | 'imoveis' | 'visitas' | 'propostas' | 'fecho' | 'interessados' | 'angariacao'

const TEMP_COLORS: Record<string, string> = {
  Frio: '#3b82f6',
  Morno: '#f59e0b',
  Quente: '#ef4444',
}

const TIPO_COLORS: Record<string, string> = {
  Compra: '#2563eb',
  Venda: '#16a34a',
  'Compra e Venda': '#7c3aed',
  Arrendatário: '#f59e0b',
  Arrendador: '#0891b2',
  Outro: '#64748b',
}

const eur = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copiado')
  } catch {
    toast.error('Não foi possível copiar')
  }
}

function formatRange(min: number | null, max: number | null, suffix = ''): string | null {
  if (min == null && max == null) return null
  if (min != null && max != null) {
    if (min === max) return `${eur.format(min)}${suffix}`
    return `${eur.format(min)} – ${eur.format(max)}${suffix}`
  }
  if (min != null) return `desde ${eur.format(min)}${suffix}`
  return `até ${eur.format(max!)}${suffix}`
}

export function NegocioDetailSheet({ negocioId, open, onOpenChange }: NegocioDetailSheetProps) {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const router = useRouter()

  const [negocio, setNegocio] = useState<any | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('inicio')
  const [aiFillOpen, setAiFillOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editInitialForm, setEditInitialForm] = useState<Record<string, unknown> | null>(null)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Property preview: when set, the shared PropertyDetailSheet opens on top
  // (rendered as a sibling outside this Sheet so its clicks don't bubble back
  // through the negócio sheet).
  const [previewPropertyId, setPreviewPropertyId] = useState<string | null>(null)

  const loadNegocio = useCallback(async () => {
    if (!negocioId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setNegocio(data)
      setForm(data)
    } catch {
      toast.error('Erro ao carregar negócio')
      setNegocio(null)
    } finally {
      setLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    if (!open || !negocioId) {
      setNegocio(null)
      setForm({})
      setActiveTab('inicio')
      return
    }
    loadNegocio()
  }, [open, negocioId, loadNegocio])

  const updateField = useCallback((field: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const saveFields = useCallback(
    async (patch: Record<string, unknown>, successMessage?: string) => {
      if (!negocioId) return
      try {
        const res = await fetch(`/api/negocios/${negocioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error()
        setForm((prev) => ({ ...prev, ...patch }))
        if (successMessage) toast.success(successMessage)
      } catch {
        toast.error('Erro ao guardar')
      }
    },
    [negocioId],
  )

  const handleTemperaturaChange = useCallback(
    async (next: Temperatura) => {
      updateField('temperatura', next)
      await saveFields({ temperatura: next })
    },
    [saveFields, updateField],
  )

  const handlePipelineStageChange = useCallback(
    async (stage: { id: string; name: string }) => {
      updateField('pipeline_stage_id', stage.id)
      updateField('estado', stage.name)
      await saveFields({ pipeline_stage_id: stage.id }, 'Fase actualizada')
    },
    [saveFields, updateField],
  )

  const handleSaveObservations = useCallback(
    async (next: string | null) => {
      if (!negocioId) return
      const res = await fetch(`/api/negocios/${negocioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observacoes: next }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setForm((prev) => ({ ...prev, observacoes: next }))
    },
    [negocioId],
  )

  const handleQuickFillApply = useCallback(
    async (fields: Record<string, unknown>) => {
      await saveFields(fields, 'Dados preenchidos')
    },
    [saveFields],
  )

  const tipo = (form.tipo as string) || negocio?.tipo || ''
  const isBuyerType = ['Compra', 'Compra e Venda', 'Arrendatário'].includes(tipo)
  const isSellerType = ['Venda', 'Compra e Venda', 'Arrendador'].includes(tipo)

  const tabs = useMemo<{ key: TabKey; label: string; icon: React.ElementType }[]>(() => {
    // Angariação (puro vendedor / arrendador) — fluxo focado em interessados + processo
    if (isSellerType && !isBuyerType) {
      return [
        { key: 'inicio', label: 'Início', icon: Info },
        { key: 'interessados', label: 'Interessados', icon: Users },
        { key: 'visitas', label: 'Visitas', icon: CalendarIcon },
        { key: 'angariacao', label: 'Angariação', icon: Briefcase },
      ]
    }
    // Compra / Arrendatário (e Compra-e-Venda — perspectiva de comprador)
    return [
      { key: 'inicio', label: 'Início', icon: Info },
      { key: 'imoveis', label: 'Imóveis', icon: Home },
      { key: 'visitas', label: 'Visitas', icon: CalendarIcon },
      { key: 'propostas', label: 'Propostas', icon: FileText },
      { key: 'fecho', label: 'Fecho', icon: Briefcase },
    ]
  }, [isBuyerType, isSellerType])

  const leadId = negocio?.lead_id ?? null

  const lead = negocio?.lead
  const clientName = lead?.full_name || lead?.nome || 'Negócio'

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'p-0 gap-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
          isMobile
            ? 'data-[side=bottom]:h-[85dvh] rounded-t-3xl'
            : 'h-full w-full data-[side=right]:sm:max-w-[820px] sm:rounded-l-3xl',
        )}
      >
        {isMobile && (
          <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25 z-20" />
        )}

        <SheetHeader className="shrink-0 px-6 pt-8 pb-3 sm:pt-10 gap-2 sm:gap-0 flex-col sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 pr-10 sm:pr-0">
            <SheetTitle className="text-[20px] font-semibold leading-tight tracking-tight break-words sm:truncate">
              {clientName}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Detalhes do negócio.
            </SheetDescription>
          </div>
          {negocio?.id && (
            <div className="flex items-center gap-1.5 sm:mr-10 shrink-0 flex-wrap">
              {leadId && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="rounded-full h-8 text-xs gap-1.5"
                  title="Ver perfil do contacto"
                >
                  <Link href={`/dashboard/leads/${leadId}`} onClick={() => onOpenChange(false)}>
                    <UserIcon className="h-3.5 w-3.5" />
                    Ver perfil
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs gap-1.5"
                onClick={() => {
                  // Snapshot do form actual para detectar dirty depois
                  setEditInitialForm({ ...form })
                  setEditOpen(true)
                }}
                title="Editar dados do negócio"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-8 text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                onClick={() => setDeleteOpen(true)}
                title="Eliminar negócio"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          )}
        </SheetHeader>

        {loading || !negocio ? (
          <DetailSkeleton />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            {/* pb extra à direita/baixo para o utilizador conseguir fazer scroll
                além das bubbles WhatsApp/Email que ficam fixas no canto. */}
            <div className="px-6 space-y-4 pb-40 sm:pb-24">
              {/* Tab selector — centered pills */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-background border border-border/50 w-fit max-w-full mx-auto overflow-x-auto">
                {tabs.map((t) => {
                  const Icon = t.icon
                  const isActive = activeTab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={cn(
                        'inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 shrink-0',
                        isActive ? 'bg-foreground text-background px-3.5' : 'text-muted-foreground hover:text-foreground h-8 w-8',
                      )}
                      title={t.label}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {isActive && <span>{t.label}</span>}
                    </button>
                  )
                })}
              </div>

              {activeTab === 'inicio' && (
                <DetalhesTab
                  negocio={negocio}
                  form={form}
                  tipo={tipo}
                  isBuyerType={isBuyerType}
                  onPipelineStageChange={handlePipelineStageChange}
                  onTemperaturaChange={handleTemperaturaChange}
                  onSaveObservations={handleSaveObservations}
                  onOpenAiFill={() => setAiFillOpen(true)}
                />
              )}
              {activeTab === 'imoveis' && negocio.id && (
                <ImoveisGroupedTab
                  negocioId={negocio.id}
                  leadId={leadId}
                  userId={user?.id}
                  onDossierChanged={loadNegocio}
                  onPreviewProperty={setPreviewPropertyId}
                />
              )}
              {activeTab === 'visitas' && leadId && (
                <VisitasTab leadId={leadId} userId={user?.id} />
              )}
              {activeTab === 'propostas' && negocio.id && (
                <PropostasTab negocioId={negocio.id} />
              )}
              {activeTab === 'fecho' && negocio.id && (
                <FechoTab negocioId={negocio.id} negocio={negocio} />
              )}
              {activeTab === 'interessados' && negocio.id && (
                <InteressadosTab
                  negocioId={negocio.id}
                  negocio={negocio}
                  currentUserId={user?.id ?? null}
                />
              )}
              {activeTab === 'angariacao' && negocio.id && (
                <AngariacaoTab negocioId={negocio.id} negocio={negocio} />
              )}
            </div>
          </div>
        )}

        {negocio?.id && (
          <AiFillDialog
            open={aiFillOpen}
            onOpenChange={setAiFillOpen}
            negocioId={negocio.id}
            onApply={handleQuickFillApply}
          />
        )}

        {/* Editar dados do negócio — replica o que existia na página dedicada */}
        {negocio?.id && (
          <>
            {(() => {
              const isDirty =
                editInitialForm != null &&
                JSON.stringify(form) !== JSON.stringify(editInitialForm)

              const attemptClose = (next: boolean) => {
                if (next) {
                  setEditOpen(true)
                  return
                }
                if (isDirty) {
                  setConfirmDiscardOpen(true)
                  return
                }
                setEditOpen(false)
                setEditInitialForm(null)
              }

              const doSave = async () => {
                if (!negocio?.id) return
                setEditSaving(true)
                try {
                  const res = await fetch(`/api/negocios/${negocio.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                  })
                  if (!res.ok) throw new Error()
                  toast.success('Negócio actualizado')
                  await loadNegocio()
                  setEditOpen(false)
                  setEditInitialForm(null)
                } catch {
                  toast.error('Erro ao guardar')
                } finally {
                  setEditSaving(false)
                }
              }

              return (
                <Dialog open={editOpen} onOpenChange={attemptClose}>
                  <DialogContent className="max-w-3xl w-[95vw] sm:w-full p-0 max-h-[90vh] overflow-hidden flex flex-col gap-0">
                    <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b border-border/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <DialogTitle className="flex items-center gap-2">
                            Editar negócio
                            {isDirty && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                                Alterações não guardadas
                              </span>
                            )}
                          </DialogTitle>
                          <DialogDescription className="sr-only">
                            Editar dados do negócio.
                          </DialogDescription>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full h-8 text-xs gap-1.5 shrink-0"
                          onClick={() => setAiFillOpen(true)}
                          title="Preencher campos com IA"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Preencher com IA
                        </Button>
                      </div>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                      <NegocioDataCard
                        tipo={tipo}
                        negocioId={negocio.id}
                        form={form}
                        onFieldChange={updateField}
                        isSaving={editSaving}
                        forceEditing
                        hideEditButton
                        onAiFillClick={() => setAiFillOpen(true)}
                        onSave={doSave}
                      />
                    </div>
                    {/* Footer proeminente — Cancelar + Guardar sempre visíveis */}
                    <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {isDirty
                          ? 'Tens alterações por guardar.'
                          : 'Sem alterações por guardar.'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => attemptClose(false)}
                          disabled={editSaving}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={doSave}
                          disabled={editSaving || !isDirty}
                          className="min-w-[120px]"
                        >
                          {editSaving ? 'A guardar...' : 'Guardar'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )
            })()}

            {/* Confirmação ao tentar sair com alterações não guardadas */}
            <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tens alterações por guardar neste negócio. Se saíres agora,{' '}
                    <strong>perdes tudo o que ainda não foi guardado</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Continuar a editar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      // Reverte form para o snapshot antes da edição
                      if (editInitialForm) setForm(editInitialForm)
                      setEditInitialForm(null)
                      setConfirmDiscardOpen(false)
                      setEditOpen(false)
                    }}
                  >
                    Descartar e sair
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}

        {/* Eliminar negócio — confirmação com aviso forte */}
        {negocio?.id && (
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminar este negócio?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">
                    Esta acção é <strong>irreversível</strong>. Todos os dados associados ao negócio
                    (zonas, propriedades anexadas, propostas, comunicações) serão eliminados
                    permanentemente.
                  </span>
                  <span className="block text-amber-700 dark:text-amber-400 font-medium">
                    Quaisquer alterações não guardadas serão perdidas.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting}
                  onClick={async (e) => {
                    e.preventDefault()
                    if (!negocio?.id) return
                    setDeleting(true)
                    try {
                      const res = await fetch(`/api/negocios/${negocio.id}`, {
                        method: 'DELETE',
                      })
                      if (!res.ok) throw new Error()
                      toast.success('Negócio eliminado')
                      setDeleteOpen(false)
                      onOpenChange(false)
                      // Refresh the underlying lead page so the negocio disappears
                      router.refresh()
                    } catch {
                      toast.error('Erro ao eliminar')
                    } finally {
                      setDeleting(false)
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? 'A eliminar...' : 'Eliminar definitivamente'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Floating WhatsApp + Email chat bubbles — replicam o que existia
            na página dedicada do negócio antes desta ser substituída pela sheet.
            Bubble buttons usam `position: fixed` ancorado ao viewport mas só
            renderizam enquanto o sheet está aberto. */}
        {(lead?.telemovel || lead?.telefone) && (
          <WhatsAppChatBubble
            contactPhone={lead?.telemovel || lead?.telefone || null}
            contactName={clientName}
            contactLeadId={leadId}
          />
        )}
        {lead?.email && (
          <EmailChatBubble
            contactEmail={lead.email}
            contactName={clientName}
          />
        )}
      </SheetContent>
    </Sheet>
    <PropertyDetailSheet
      propertyId={previewPropertyId}
      open={!!previewPropertyId}
      onOpenChange={(o) => { if (!o) setPreviewPropertyId(null) }}
    />
    </>
  )
}

// ─── Detalhes Tab ──────────────────────────────────────────────────────

// Amenities (matches the page + matching API label table, emojis from negocio-data-card)
const AMENITY_ITEMS: { field: string; emoji: string; label: string }[] = [
  { field: 'tem_elevador', emoji: '🏗️', label: 'Elevador' },
  { field: 'tem_estacionamento', emoji: '🅿️', label: 'Estacionamento' },
  { field: 'tem_garagem', emoji: '🚗', label: 'Garagem' },
  { field: 'tem_exterior', emoji: '🌿', label: 'Exterior' },
  { field: 'tem_varanda', emoji: '🌸', label: 'Varanda' },
  { field: 'tem_piscina', emoji: '🏊', label: 'Piscina' },
  { field: 'tem_porteiro', emoji: '🔒', label: 'Porteiro' },
  { field: 'tem_arrumos', emoji: '📦', label: 'Arrumos' },
  { field: 'tem_carregamento_ev', emoji: '🔌', label: 'Carregamento EV' },
  { field: 'tem_praia', emoji: '🏖️', label: 'Praia' },
  { field: 'tem_quintal', emoji: '🌳', label: 'Quintal' },
  { field: 'tem_terraco', emoji: '☀️', label: 'Terraço' },
  { field: 'tem_jardim', emoji: '🌻', label: 'Jardim' },
  { field: 'tem_mobilado', emoji: '🛋️', label: 'Mobilado' },
  { field: 'tem_arrecadacao', emoji: '🗄️', label: 'Arrecadação' },
  { field: 'tem_aquecimento', emoji: '🔥', label: 'Aquecimento' },
  { field: 'tem_cozinha_equipada', emoji: '🍳', label: 'Cozinha Eq.' },
  { field: 'tem_campo', emoji: '🌾', label: 'Campo' },
  { field: 'tem_urbano', emoji: '🏙️', label: 'Urbano' },
  { field: 'tem_ar_condicionado', emoji: '❄️', label: 'AC' },
  { field: 'tem_energias_renovaveis', emoji: '♻️', label: 'Renováveis' },
  { field: 'tem_gas', emoji: '🔵', label: 'Gás' },
  { field: 'tem_seguranca', emoji: '🛡️', label: 'Segurança' },
  { field: 'tem_transportes', emoji: '🚇', label: 'Transportes' },
  { field: 'tem_vistas', emoji: '🏔️', label: 'Vistas' },
]

function DetalhesTab({
  negocio,
  form,
  tipo,
  isBuyerType,
  onPipelineStageChange,
  onTemperaturaChange,
  onSaveObservations,
  onOpenAiFill,
}: {
  negocio: any
  form: Record<string, unknown>
  tipo: string
  isBuyerType: boolean
  onPipelineStageChange: (stage: { id: string; name: string }) => void
  onTemperaturaChange: (t: Temperatura) => void
  onSaveObservations: (next: string | null) => Promise<void>
  onOpenAiFill: () => void
}) {
  const lead = negocio.lead
  const clientName = lead?.full_name || lead?.nome || 'Cliente'
  const phone = lead?.telemovel || lead?.telefone || null
  const email = lead?.email || null
  const estado = (form.estado as string) || negocio.estado || 'Aberto'
  const pipelineStageId =
    (form.pipeline_stage_id as string) || (negocio.pipeline_stage_id as string | undefined) || null
  const temperatura = (form.temperatura as Temperatura) || null
  const observacoes = (form.observacoes as string | null) ?? null

  const isArrendatario = tipo === 'Arrendatário'
  const isArrendador = tipo === 'Arrendador'

  const priceLabel = isArrendatario
    ? 'Renda máxima'
    : isArrendador
      ? 'Renda pretendida'
      : isBuyerType
        ? 'Orçamento'
        : 'Preço pretendido'

  const price = (() => {
    if (isArrendatario) return formatRange(null, (form.renda_max_mensal as number) ?? null, '/mês')
    if (isArrendador) return formatRange(null, (form.renda_pretendida as number) ?? null, '/mês')
    if (isBuyerType) return formatRange((form.orcamento as number) ?? null, (form.orcamento_max as number) ?? null)
    return formatRange((form.preco_venda as number) ?? null, (form.preco_venda_max as number) ?? null)
  })()

  const quartosLabel = (() => {
    const min = (form.quartos_min as number | null) ?? null
    const max = (form.quartos_max as number | null) ?? null
    const exact = (form.quartos as number | null) ?? null
    if (exact != null && min == null && max == null) return `T${exact}`
    if (min == null && max == null) return null
    if (min != null && max != null) {
      if (min === max) return `T${min}`
      return `T${min} – T${max}`
    }
    if (min != null) return `T${min}+`
    return `até T${max}`
  })()

  const wc = (form.wc_min as number | null) ?? (form.num_wc as number | null) ?? (form.casas_banho as number | null) ?? null
  const areaMin = (form.area_min_m2 as number | null) ?? null
  const areaExact = (form.area_m2 as number | null) ?? null
  const areaLabel = areaMin != null ? `≥ ${areaMin} m²` : areaExact != null ? `${areaExact} m²` : null

  // Zonas chip list (also supports distrito/concelho/freguesia fallbacks)
  const zones: string[] = (() => {
    const raw = (form.localizacao as string | null) ?? ''
    const split = raw.split(',').map((z) => z.trim()).filter(Boolean)
    if (split.length > 0) return split
    const fallback = [form.distrito, form.concelho, form.freguesia]
      .filter(Boolean)
      .map((v) => String(v))
    return fallback
  })()

  const isVendaCompra = tipo === 'Compra e Venda'

  const motivacao = (form.motivacao_compra as string | null) ?? null
  const prazo = (form.prazo_compra as string | null) ?? null
  const financiamento = (form.financiamento_necessario as boolean | null) ?? null
  const situacaoProfissional = (form.situacao_profissional as string | null) ?? null
  const rendimento = (form.rendimento_mensal as number | null) ?? null
  const fiador = (form.tem_fiador as boolean | null) ?? null
  const animais = (form.aceita_animais as boolean | null) ?? null

  const estadoImovel = (form.estado_imovel as string | null) ?? null
  const classeImovel = (form.classe_imovel as string | null) ?? null

  const tipoColor = (tipo && TIPO_COLORS[tipo]) || '#64748b'
  const tempEmoji = temperaturaEmoji(temperatura ?? undefined)

  // Pre-compute sections para o novo layout unificado
  const procuraItems: { label: string; value: string }[] = []
  if (form.tipo_imovel) procuraItems.push({ label: 'Tipo', value: String(form.tipo_imovel) })
  if (quartosLabel) procuraItems.push({ label: 'Tipologia', value: quartosLabel })
  if (wc != null) procuraItems.push({ label: 'WCs', value: `≥ ${wc}` })
  if (areaLabel) procuraItems.push({ label: 'Área', value: areaLabel })
  if (estadoImovel) procuraItems.push({ label: 'Estado', value: estadoImovel })
  if (classeImovel) procuraItems.push({ label: 'Classe', value: classeImovel })

  const contextoItems: { label: string; value: string }[] = []
  if (motivacao) contextoItems.push({ label: 'Motivação', value: motivacao })
  if (prazo) contextoItems.push({ label: 'Prazo', value: prazo })
  if (financiamento !== null) {
    contextoItems.push({ label: 'Financiamento', value: financiamento ? 'Necessário' : 'Não necessário' })
  }
  if (isArrendatario) {
    if (situacaoProfissional) contextoItems.push({ label: 'Situação', value: situacaoProfissional })
    if (rendimento != null) contextoItems.push({ label: 'Rendimento', value: `${eur.format(rendimento)}/mês` })
    if (fiador !== null) contextoItems.push({ label: 'Fiador', value: fiador ? 'Sim' : 'Não' })
    if (animais !== null) contextoItems.push({ label: 'Aceita animais', value: animais ? 'Sim' : 'Não' })
  }

  const hasZones = zones.length > 0
  const hasProcura = procuraItems.length > 0
  const hasContexto = contextoItems.length > 0
  const hasImovelSection = hasZones || hasProcura || hasContexto

  const enabledAmenities = AMENITY_ITEMS.filter((a) => !!form[a.field])
  const enabledAmenitiesVenda = isVendaCompra
    ? AMENITY_ITEMS.filter((a) => !!form[`${a.field}_venda`])
    : []
  const hasFeatures = enabledAmenities.length > 0 || enabledAmenitiesVenda.length > 0

  const sectionLabel = isArrendador || tipo === 'Venda' ? 'Imóvel' : 'O que procura'

  return (
    <div className="space-y-3">
      {/* MAIN CARD — un único cartão para tudo o que descreve o negócio */}
      <div className="rounded-3xl bg-background/95 supports-[backdrop-filter]:bg-background/80 backdrop-blur-xl border border-border/50 shadow-sm overflow-hidden">
        {/* Status pills — centradas, com fundo subtil */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap px-5 py-3.5 border-b border-border/40 bg-muted/30">
          <EstadoPipelineSelector
            tipo={tipo}
            pipelineStageId={pipelineStageId}
            fallbackLabel={estado}
            onChange={onPipelineStageChange}
          />
          {tipo && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: `${tipoColor}22`, color: tipoColor }}
            >
              <Briefcase className="h-3 w-3" />
              {tipo}
            </span>
          )}
          <TemperaturaSelector value={temperatura} onChange={onTemperaturaChange} />
          <ObservationsButton observacoes={observacoes} onSave={onSaveObservations} />
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-7 text-xs gap-1"
            onClick={onOpenAiFill}
          >
            <Sparkles className="h-3 w-3" />
            IA
          </Button>
        </div>

        {/* Inner content */}
        <div className="p-5 space-y-5">
          {/* Preço + Cliente — blocos inset (sem border) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {price ? (
              <InsetBlock icon={Euro} label={priceLabel}>
                <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">{price}</p>
              </InsetBlock>
            ) : (
              <InsetBlock icon={Euro} label={priceLabel}>
                <p className="text-sm text-muted-foreground italic mt-0.5">—</p>
              </InsetBlock>
            )}
            {lead && (
              <InsetBlock icon={UserIcon} label="Cliente">
                <p className="text-sm font-semibold truncate mt-0.5">{clientName}</p>
                {lead.empresa && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {lead.empresa}
                    {lead.nipc ? ` · ${lead.nipc}` : ''}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      onClick={(e) => e.stopPropagation()}
                      title={phone}
                      className="inline-flex items-center gap-1.5 h-7 rounded-full bg-background border border-border/50 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors max-w-full"
                    >
                      <Phone className="h-3 w-3" />
                      <span className="truncate">{phone}</span>
                    </a>
                  )}
                  {email && (
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(email)}
                      className="inline-flex items-center gap-1.5 h-7 rounded-full bg-background border border-border/50 px-2.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors truncate max-w-full"
                      title="Copiar email"
                    >
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{email}</span>
                    </button>
                  )}
                </div>
              </InsetBlock>
            )}
          </div>

          {/* Imóvel / O que procura */}
          {hasImovelSection && (
            <>
              <CardDivider />
              <section>
                <SectionLabel icon={Home}>{sectionLabel}</SectionLabel>
                {hasZones && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {zones.map((z) => (
                      <span
                        key={z}
                        className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] text-foreground/80"
                      >
                        <MapPin className="h-2.5 w-2.5" />
                        {z}
                      </span>
                    ))}
                  </div>
                )}
                {hasProcura && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                    {procuraItems.map((it) => (
                      <SpecItem key={it.label} label={it.label} value={it.value} />
                    ))}
                  </div>
                )}
                {hasContexto && (
                  <>
                    <div className="my-3 h-px bg-border/30" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                      {contextoItems.map((it) => (
                        <SpecItem key={it.label} label={it.label} value={it.value} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          {/* Características */}
          {hasFeatures && (
            <>
              <CardDivider />
              <section>
                {enabledAmenities.length > 0 && (
                  <>
                    <SectionLabel>Características</SectionLabel>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {enabledAmenities.map((a) => (
                        <AmenityChip key={a.field} emoji={a.emoji} label={a.label} />
                      ))}
                    </div>
                  </>
                )}
                {enabledAmenitiesVenda.length > 0 && (
                  <>
                    {enabledAmenities.length > 0 && <div className="my-3 h-px bg-border/30" />}
                    <SectionLabel>Características (venda)</SectionLabel>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {enabledAmenitiesVenda.map((a) => (
                        <AmenityChip key={a.field} emoji={a.emoji} label={a.label} />
                      ))}
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          {/* Observações */}
          {observacoes && (
            <>
              <CardDivider />
              <section>
                <SectionLabel icon={StickyNote}>Observações</SectionLabel>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 mt-0.5">
                  {observacoes}
                </p>
              </section>
            </>
          )}

          {/* Estudos de mercado — só em angariação (Venda / Arrendador) */}
          {(tipo === 'Venda' || tipo === 'Arrendador' || tipo === 'Compra e Venda') && negocio.id && (
            <>
              <CardDivider />
              <MarketStudiesCard negocioId={negocio.id} />
            </>
          )}
        </div>
      </div>

      {/* Por fazer (tarefas pendentes) + Actividade recente — cartões separados abaixo */}
      {negocio.id && (
        <InicioExtras
          negocioId={negocio.id}
          leadId={negocio.lead_id ?? null}
        />
      )}
    </div>
  )
}

// ─── Mini helpers para o novo layout unificado ─────────────────────────

function InsetBlock({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-muted/40 px-4 py-3">
      <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      {children}
    </div>
  )
}

function CardDivider() {
  return <div className="h-px bg-border/40 -mx-5" />
}

// ─── Compact design primitives ────────────────────────────────────────

function MiniCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-background/90 border border-border/50 shadow-sm p-3.5', className)}>
      {children}
    </div>
  )
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 inline-flex items-center gap-1.5">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </p>
  )
}

function SpecItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  )
}

function AmenityChip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-foreground/80">
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  )
}

function MismatchBadgesRow({
  badges,
}: {
  badges: { type: 'positive' | 'warning' | 'info'; key: string; label: string }[]
}) {
  if (!badges || badges.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {badges.map((b) => {
        const Icon = b.type === 'warning' ? AlertTriangle : Info
        const cls =
          b.type === 'warning'
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
        return (
          <span
            key={b.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}
          >
            <Icon className="h-2.5 w-2.5" />
            {b.label}
          </span>
        )
      })}
    </div>
  )
}

// ─── Matching Tab ──────────────────────────────────────────────────────

function MatchingTab({
  negocioId,
  onDossierChanged,
  onPreviewProperty,
}: {
  negocioId: string
  onDossierChanged: () => void
  onPreviewProperty: (id: string) => void
}) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  // Filtros: 'strict' (default) limita por tipo + zona + ±15% preço.
  // 'loose' relaxa para ±30% e ignora tipo/zona — útil para abrir o leque.
  const [strict, setStrict] = useState(true)

  const fetchMatches = useCallback(
    async (withScore = false, strictOverride?: boolean) => {
      if (withScore) setScoring(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams()
        if (withScore) params.set('score', 'true')
        const useStrict = strictOverride ?? strict
        if (!useStrict) params.set('strict', 'false')
        const qs = params.toString()
        const res = await fetch(
          `/api/negocios/${negocioId}/property-matches${qs ? `?${qs}` : ''}`,
        )
        if (res.ok) {
          const json = await res.json()
          setMatches(json.data || [])
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false)
        setScoring(false)
      }
    },
    [negocioId, strict],
  )

  useEffect(() => {
    fetchMatches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId])

  const handleToggleStrict = (next: boolean) => {
    setStrict(next)
    fetchMatches(false, next)
  }

  const handleAdd = async (match: any) => {
    setAddingIds((s) => {
      const n = new Set(s)
      n.add(match.id)
      return n
    })
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: match.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Imóvel adicionado ao dossier')
      setMatches((prev) => prev.filter((m) => m.id !== match.id))
      onDossierChanged()
    } catch {
      toast.error('Erro ao adicionar imóvel')
    } finally {
      setAddingIds((s) => {
        const n = new Set(s)
        n.delete(match.id)
        return n
      })
    }
  }

  if (loading) return <ListSkeleton />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-muted-foreground">
          {matches.length > 0
            ? `${matches.length} ${matches.length === 1 ? 'compatível' : 'compatíveis'}`
            : strict
              ? 'Sem matches estritos. Tente "Solto".'
              : 'Sem matches mesmo com filtros relaxados.'}
        </p>
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Strict / Solto toggle */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/60 border border-border/40">
            <button
              type="button"
              onClick={() => handleToggleStrict(true)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all',
                strict ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Filtros estritos (tipo + zona + preço dentro do orçamento)"
            >
              Estrito
            </button>
            <button
              type="button"
              onClick={() => handleToggleStrict(false)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all',
                !strict ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Filtros relaxados (sem tipo/zona; preço continua limitado a ±15%)"
            >
              Solto
            </button>
          </div>
          {matches.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-7 text-xs"
              disabled={scoring}
              onClick={() => fetchMatches(true)}
            >
              {scoring ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Classificar IA
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-7 text-xs"
            onClick={() => fetchMatches()}
          >
            Actualizar
          </Button>
        </div>
      </div>

      {matches.length === 0 ? (
        <EmptyHint icon={Sparkles} message="Sem imóveis compatíveis com este perfil." />
      ) : (
        <div className="space-y-2">
          {matches.map((p) => {
            const cover =
              p.dev_property_media?.find((m: any) => m.is_cover)?.url ||
              p.dev_property_media?.[0]?.url
            const specs = p.dev_property_specifications
            const score = p.match_score as number | null
            const scoreColor =
              score != null
                ? score >= 80
                  ? 'bg-emerald-500 text-white'
                  : score >= 60
                    ? 'bg-amber-500 text-white'
                    : score >= 40
                      ? 'bg-orange-500 text-white'
                      : 'bg-red-500 text-white'
                : ''
            const isAdding = addingIds.has(p.id)
            return (
              <div
                key={p.id}
                className="rounded-2xl border border-border/40 bg-background shadow-sm overflow-hidden"
              >
                <div className="flex">
                  <div className="w-28 shrink-0 relative bg-muted">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                    {p.off_market && (
                      <div className="absolute top-2 left-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/90 text-white backdrop-blur-sm">
                          Off-market
                        </span>
                      </div>
                    )}
                    {score != null && (
                      <div className="absolute top-2 right-2">
                        <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full', scoreColor)}>
                          {score}%
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold truncate leading-tight">{p.title}</p>
                      <button
                        type="button"
                        onClick={() => onPreviewProperty(p.id)}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title="Pré-visualizar imóvel"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {[p.external_ref, p.city, p.zone].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                      {specs?.bedrooms != null && <span>T{specs.bedrooms}</span>}
                      {specs?.area_util != null && <span>{specs.area_util} m²</span>}
                      {p.listing_price != null && (
                        <span className="ml-auto text-sm font-semibold text-foreground tabular-nums">
                          {eur.format(p.listing_price)}
                        </span>
                      )}
                    </div>
                    {p.match_reason && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1 italic truncate">
                        {p.match_reason}
                      </p>
                    )}
                    {Array.isArray(p.badges) && p.badges.length > 0 && (
                      <MismatchBadgesRow badges={p.badges} />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 rounded-full text-xs w-full"
                      disabled={isAdding}
                      onClick={() => handleAdd(p)}
                    >
                      {isAdding ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      Adicionar ao dossier
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Imóveis Tab ───────────────────────────────────────────────────────

function ImoveisTab({
  negocioId,
  leadId,
  userId,
  onPreviewProperty,
}: {
  negocioId: string
  leadId: string | null
  userId: string | undefined
  onPreviewProperty: (id: string) => void
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showExternal, setShowExternal] = useState(false)
  const [extUrl, setExtUrl] = useState('')
  const [extTitle, setExtTitle] = useState('')
  const [extPrice, setExtPrice] = useState('')
  const [extSource, setExtSource] = useState('')
  const [addingExternal, setAddingExternal] = useState(false)
  const [showVisit, setShowVisit] = useState(false)
  const [visitPropertyId, setVisitPropertyId] = useState<string | null>(null)
  const [showSend, setShowSend] = useState(false)
  // Sequential WhatsApp send (1 mensagem por imóvel)
  const [wpProgress, setWpProgress] = useState<{ total: number; sent: number; failed: number } | null>(null)

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`)
      if (res.ok) {
        const json = await res.json()
        setItems(json.data || [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [negocioId])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  const handleUpdateStatus = async (propId: string, status: string) => {
    const res = await fetch(`/api/negocios/${negocioId}/properties/${propId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success('Estado actualizado')
      fetchProperties()
    } else {
      toast.error('Erro ao actualizar')
    }
  }

  // Sequential WhatsApp send — 1 mensagem por imóvel (com foto+caption)
  // para o telemóvel do lead. Marca status='sent' por imóvel ao sucesso.
  const handleSendDossierWhatsapp = async () => {
    const selected = items.filter((p) => selectedIds.has(p.id) && p.property_id && p.property)
    if (selected.length === 0) {
      toast.error('Selecciona imóveis do dossier (links externos não suportam envio individual)')
      return
    }
    // Fetch lead info para resolver o chat
    let leadPhone: string | null = null
    let leadName = 'Lead'
    try {
      const res = await fetch(`/api/negocios/${negocioId}`)
      if (res.ok) {
        const data = await res.json()
        leadPhone = data.lead?.telemovel || data.lead?.telefone || null
        leadName = data.lead?.nome || data.lead?.full_name || 'Lead'
      }
    } catch {
      /* silent */
    }
    if (!leadPhone) {
      toast.error('Lead sem telemóvel — não é possível enviar pelo WhatsApp')
      return
    }

    setWpProgress({ total: selected.length, sent: 0, failed: 0 })

    const chatId = await resolveLeadChat(leadPhone, leadName)
    if (!chatId) {
      setWpProgress(null)
      toast.error('Não foi possível abrir conversa WhatsApp com este contacto')
      return
    }

    let sent = 0
    let failed = 0
    for (const ap of selected) {
      const p: any = ap.property
      const specs = Array.isArray(p?.dev_property_specifications)
        ? p.dev_property_specifications[0]
        : p?.dev_property_specifications
      const cover =
        p?.dev_property_media?.find((m: any) => m.is_cover)?.url ||
        p?.dev_property_media?.[0]?.url ||
        null
      const item: PropertyToSend = {
        negocioPropertyId: ap.id,
        title: p?.title || 'Imóvel',
        slug: p?.slug || null,
        listing_price: p?.listing_price ?? null,
        typology: specs?.typology ?? null,
        area_util: specs?.area_util ?? null,
        city: p?.city ?? null,
        cover_url: cover,
      }
      const ok = await sendOneProperty(chatId, item)
      if (ok) {
        sent++
        // marca como enviado no dossier (não bloqueante)
        fetch(`/api/negocios/${negocioId}/properties/${ap.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent' }),
        }).catch(() => {})
      } else {
        failed++
      }
      setWpProgress({ total: selected.length, sent, failed })
    }

    if (failed === 0) {
      toast.success(`${sent} ${sent === 1 ? 'imóvel enviado' : 'imóveis enviados'}`)
    } else if (sent > 0) {
      toast.warning(`${sent} enviado${sent === 1 ? '' : 's'}, ${failed} ${failed === 1 ? 'falhou' : 'falharam'}`)
    } else {
      toast.error('Erro ao enviar imóveis pelo WhatsApp')
    }

    setWpProgress(null)
    setSelectedIds(new Set())
    fetchProperties()
  }

  const handleRemove = async (propId: string) => {
    const res = await fetch(`/api/negocios/${negocioId}/properties/${propId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      toast.success('Imóvel removido')
      setSelectedIds((prev) => {
        if (!prev.has(propId)) return prev
        const n = new Set(prev)
        n.delete(propId)
        return n
      })
      fetchProperties()
    } else {
      toast.error('Erro ao remover')
    }
  }

  const handleAddExternal = async () => {
    if (!extUrl.trim()) return
    setAddingExternal(true)
    try {
      const res = await fetch(`/api/negocios/${negocioId}/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_url: extUrl.trim(),
          external_title: extTitle.trim() || null,
          external_price: extPrice ? Number(extPrice) : null,
          external_source: extSource || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Link adicionado')
      setShowExternal(false)
      setExtUrl('')
      setExtTitle('')
      setExtPrice('')
      setExtSource('')
      fetchProperties()
    } catch {
      toast.error('Erro ao adicionar link externo')
    } finally {
      setAddingExternal(false)
    }
  }

  const handleCreateVisit = async (data: any) => {
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success('Visita agendada')
      setShowVisit(false)
      setVisitPropertyId(null)
      return true
    } catch {
      toast.error('Erro ao agendar visita')
      return null
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const selectedSendItems = items
    .filter((ap) => selectedIds.has(ap.id))
    .map((ap) => {
      const isExternal = !ap.property_id && ap.external_url
      const p: any = ap.property
      const price = isExternal ? ap.external_price : p?.listing_price
      const priceLabel =
        typeof price === 'number' && !Number.isNaN(price)
          ? `${Math.round(price / 1000)}k €`
          : ''
      const title = isExternal ? ap.external_title || 'Imóvel externo' : p?.title || 'Imóvel'
      const href =
        !isExternal && p?.slug
          ? `https://infinitygroup.pt/property/${p.slug}`
          : ap.external_url || '#'
      const cover = !isExternal
        ? p?.dev_property_media?.find((m: any) => m.is_cover)?.url ||
          p?.dev_property_media?.[0]?.url ||
          null
        : null
      const specsObj: any = !isExternal
        ? Array.isArray(p?.dev_property_specifications)
          ? p.dev_property_specifications[0]
          : p?.dev_property_specifications
        : null
      const specParts: string[] = []
      if (specsObj?.bedrooms) specParts.push(`${specsObj.bedrooms} quartos`)
      if (specsObj?.area_util) specParts.push(`${specsObj.area_util} m²`)
      const location = !isExternal
        ? [p?.city, p?.zone].filter(Boolean).join(' · ')
        : ap.external_source || ''
      return {
        id: ap.id,
        title,
        priceLabel,
        href,
        location,
        specs: specParts.join(' · '),
        imageUrl: cover,
        reference: !isExternal ? p?.external_ref || null : null,
      }
    })

  if (loading) return <ListSkeleton />

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {items.length === 0
            ? 'Sem imóveis no dossier'
            : `${items.length} imó${items.length === 1 ? 'vel' : 'veis'}`}
        </p>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-7 text-xs"
            onClick={() => setShowExternal(true)}
          >
            <Link2 className="mr-1 h-3 w-3" />
            Link externo
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyHint icon={Home} message="Nenhum imóvel no dossier deste negócio." />
      ) : (
        <div className="space-y-2">
          {items.map((ap) => {
            const isExternal = !ap.property_id && ap.external_url
            const p = ap.property
            const cover = p?.dev_property_media?.find((m: any) => m.is_cover)?.url || p?.dev_property_media?.[0]?.url
            const price = isExternal ? ap.external_price : p?.listing_price
            const title = isExternal ? ap.external_title || 'Link externo' : p?.title || 'Imóvel'
            const ref = p?.external_ref || null
            const href = p?.id ? `/dashboard/imoveis/${p.slug || p.id}` : ap.external_url
            const propStatus = NEGOCIO_PROPERTY_STATUS[ap.status as keyof typeof NEGOCIO_PROPERTY_STATUS]
            const isSelected = selectedIds.has(ap.id)
            return (
              <div
                key={ap.id}
                className={cn(
                  'rounded-2xl border shadow-sm bg-background overflow-hidden transition-colors',
                  isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border/40',
                )}
              >
                <div className="flex">
                  <div className="w-28 shrink-0 relative bg-muted">
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(ap.id)}
                        className="bg-background/80 border-foreground/40"
                      />
                    </div>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        {isExternal ? <Globe className="h-6 w-6 text-muted-foreground/30" /> : <Building2 className="h-6 w-6 text-muted-foreground/30" />}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold truncate leading-tight">{title}</p>
                      {p?.id ? (
                        <button
                          type="button"
                          onClick={() => onPreviewProperty(p.id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Pré-visualizar imóvel"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : href ? (
                        <Link
                          href={href}
                          target="_blank"
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          title="Abrir link externo"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {isExternal ? ap.external_source || 'Portal externo' : [ref, p?.city, p?.zone].filter(Boolean).join(' · ')}
                    </p>
                    {price != null && (
                      <p className="text-xs font-semibold tabular-nums mt-0.5">{eur.format(Number(price))}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Select value={ap.status} onValueChange={(v) => handleUpdateStatus(ap.id, v)}>
                        <SelectTrigger className="h-7 rounded-full text-[11px] px-3 w-auto min-w-[120px]">
                          <SelectValue placeholder="Estado">
                            <Badge className={cn('rounded-full text-[10px] px-2 border-0', propStatus?.bg, propStatus?.text)}>
                              {propStatus?.label || ap.status}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(NEGOCIO_PROPERTY_STATUS).map(([key, val]: any) => (
                            <SelectItem key={key} value={key}>
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        title="Agendar visita"
                        onClick={() => {
                          setVisitPropertyId(p?.id || null)
                          setShowVisit(true)
                        }}
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-muted-foreground/60 hover:text-destructive"
                        title="Remover"
                        onClick={() => handleRemove(ap.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Floating send bar (in-sheet) */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-2 z-10 flex items-center justify-between gap-2 rounded-full border bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
          <span className="text-xs">
            <span className="font-semibold">{selectedIds.size}</span> seleccionados
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {wpProgress ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>A enviar… <span className="font-semibold">{wpProgress.sent}</span> / {wpProgress.total}{wpProgress.failed > 0 ? ` · ${wpProgress.failed} falhou` : ''}</span>
              </div>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full text-xs h-7"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full text-xs h-7"
                  onClick={() => setShowSend(true)}
                  title="Email + WhatsApp em batch (mais opções)"
                >
                  Mais opções
                </Button>
                <Button
                  size="sm"
                  className="rounded-full text-xs h-7 gap-1.5"
                  onClick={handleSendDossierWhatsapp}
                  title="Envia 1 mensagem por imóvel (foto + descrição) ao lead"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Enviar pelo WhatsApp
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add external link dialog */}
      <Dialog open={showExternal} onOpenChange={setShowExternal}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Link Externo</DialogTitle>
            <DialogDescription>Imóvel de um portal externo (Idealista, Imovirtual, etc.)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">URL do imóvel *</Label>
              <Input className="rounded-xl" placeholder="https://..." value={extUrl} onChange={(e) => setExtUrl(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input className="rounded-xl" value={extTitle} onChange={(e) => setExtTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Preço (€)</Label>
                <Input className="rounded-xl" type="number" value={extPrice} onChange={(e) => setExtPrice(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Portal</Label>
                <Select value={extSource} onValueChange={setExtSource}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idealista">Idealista</SelectItem>
                    <SelectItem value="imovirtual">Imovirtual</SelectItem>
                    <SelectItem value="casa_sapo">Casa Sapo</SelectItem>
                    <SelectItem value="supercasa">Supercasa</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setShowExternal(false)}>
              Cancelar
            </Button>
            <Button className="rounded-full" disabled={!extUrl.trim() || addingExternal} onClick={handleAddExternal}>
              {addingExternal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule visit dialog */}
      <Dialog
        open={showVisit}
        onOpenChange={(o) => {
          if (!o) {
            setShowVisit(false)
            setVisitPropertyId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
          </DialogHeader>
          {leadId && (
            <VisitForm
              defaultPropertyId={visitPropertyId || undefined}
              defaultLeadId={leadId}
              defaultConsultantId={userId}
              onSubmit={handleCreateVisit}
              onCancel={() => {
                setShowVisit(false)
                setVisitPropertyId(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Send properties dialog */}
      <SendPropertiesDialog
        open={showSend}
        onOpenChange={setShowSend}
        negocioId={negocioId}
        items={selectedSendItems}
        onSuccess={() => {
          setShowSend(false)
          setSelectedIds(new Set())
          fetchProperties()
        }}
      />
    </div>
  )
}

// ─── Visitas Tab ───────────────────────────────────────────────────────

function VisitasTab({ leadId, userId }: { leadId: string; userId: string | undefined }) {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showVisit, setShowVisit] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [calDate, setCalDate] = useState<Date | undefined>(undefined)
  const [calMonth, setCalMonth] = useState<Date>(new Date())

  const fetchVisits = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/visits?lead_id=${leadId}&limit=50`)
      if (res.ok) {
        const json = await res.json()
        setVisits(json.data || [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    fetchVisits()
  }, [fetchVisits])

  const handleCreateVisit = async (data: any) => {
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success('Visita agendada')
      setShowVisit(false)
      fetchVisits()
      return true
    } catch {
      toast.error('Erro ao agendar visita')
      return null
    }
  }

  if (loading) return <ListSkeleton />

  // Mapas para vista calendário
  const visitsByDay = new Map<string, any[]>()
  for (const v of visits) {
    if (!v.visit_date) continue
    const key = String(v.visit_date).slice(0, 10)
    const arr = visitsByDay.get(key) || []
    arr.push(v)
    visitsByDay.set(key, arr)
  }
  const dayKey = calDate ? calDate.toISOString().slice(0, 10) : null
  const visitsOfSelected = dayKey ? visitsByDay.get(dayKey) || [] : []

  // Mapeia visitas para o shape CalendarEvent que o CalendarMonthGrid espera.
  // Cada visita = 1 evento de categoria 'visit'.
  const calendarEvents: CalendarEvent[] = visits.map((v: any) => {
    const date = String(v.visit_date).slice(0, 10)
    const time = (v.visit_time as string | null) || '00:00:00'
    return {
      id: `v_${v.id}`,
      title: v.visit_time
        ? `${String(v.visit_time).slice(0, 5)} · ${v.property?.title || 'Visita'}`
        : v.property?.title || 'Visita',
      category: 'visit',
      item_type: 'event',
      start_date: new Date(`${date}T${time}`).toISOString(),
      all_day: !v.visit_time,
      color: 'fuchsia',
      source: 'auto',
      is_recurring: false,
      is_overdue: false,
      status: v.status || undefined,
      property_id: v.property?.id,
      property_title: v.property?.title,
      visit_id: v.id,
    }
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/60 border border-border/40">
          <button
            type="button"
            onClick={() => setView('list')}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all',
              view === 'list'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setView('calendar')}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all',
              view === 'calendar'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Calendário
          </button>
        </div>
        <Button variant="outline" size="sm" className="rounded-full h-7 text-xs ml-auto" onClick={() => setShowVisit(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Nova visita
        </Button>
      </div>

      {view === 'calendar' ? (
        <div className="space-y-3">
          {/* Toolbar: prev / mês / next + Hoje */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setCalMonth((d) => subMonths(d, 1))}
              className="h-8 w-8 rounded-full border border-border/50 bg-background hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-sm font-semibold capitalize">
                {format(calMonth, "MMMM 'de' yyyy", { locale: pt })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCalMonth(new Date())
                setCalDate(new Date())
              }}
              className="h-8 px-3 rounded-full border border-border/50 bg-background hover:bg-muted/60 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setCalMonth((d) => addMonths(d, 1))}
              className="h-8 w-8 rounded-full border border-border/50 bg-background hover:bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Grelha mensal — mesmo componente do calendário principal da app */}
          <div className="h-[460px]">
            <CalendarMonthGrid
              currentDate={calMonth}
              events={calendarEvents}
              onEventClick={(ev) => {
                if (ev.visit_id) {
                  setCalDate(new Date(ev.start_date))
                }
              }}
              onDayClick={(d) => {
                setCalDate(d)
                if (!isSameMonth(d, calMonth)) setCalMonth(d)
              }}
            />
          </div>

          {/* Lista de visitas do dia seleccionado */}
          {dayKey && (
            <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                {format(calDate!, "EEEE, d 'de' MMMM yyyy", { locale: pt })}
              </p>
              {visitsOfSelected.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem visitas neste dia.</p>
              ) : (
                <ul className="space-y-2">
                  {visitsOfSelected.map((v: any) => {
                    const vStatus = VISIT_STATUS_COLORS[v.status as keyof typeof VISIT_STATUS_COLORS]
                    return (
                      <li key={v.id} className="flex items-center gap-3 rounded-xl bg-muted/30 px-3 py-2">
                        <span className="text-sm font-medium tabular-nums shrink-0">{v.visit_time?.slice(0, 5) || '—'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{v.property?.title || 'Visita'}</p>
                          {v.property?.city && (
                            <p className="text-[11px] text-muted-foreground truncate">{v.property.city}{v.property.zone ? `, ${v.property.zone}` : ''}</p>
                          )}
                        </div>
                        {vStatus && (
                          <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', vStatus.bg, vStatus.text)}>
                            {vStatus.label}
                          </Badge>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : visits.length === 0 ? (
        <EmptyHint icon={CalendarIcon} message="Sem visitas agendadas." />
      ) : (
        <div className="space-y-2">
          {visits.map((v) => {
            const vStatus = VISIT_STATUS_COLORS[v.status as keyof typeof VISIT_STATUS_COLORS]
            const visitDate = v.visit_date ? new Date(`${v.visit_date}T${v.visit_time || '00:00'}`) : null
            const propHref = v.property?.slug || v.property?.id ? `/dashboard/imoveis/${v.property.slug || v.property.id}` : null
            return (
              <div
                key={v.id}
                className="rounded-2xl border border-border/40 bg-background shadow-sm p-3 flex items-start gap-3"
              >
                {visitDate && (
                  <div className="flex flex-col items-center justify-center w-12 shrink-0 rounded-lg bg-muted/50 py-1">
                    <span className="text-sm font-bold tabular-nums leading-none">{format(visitDate, 'd', { locale: pt })}</span>
                    <span className="text-[9px] text-muted-foreground uppercase">{format(visitDate, 'MMM', { locale: pt })}</span>
                    <span className="text-[10px] font-medium mt-0.5">{v.visit_time?.slice(0, 5)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{v.property?.title || 'Visita'}</p>
                    {vStatus && (
                      <Badge className={cn('shrink-0 rounded-full text-[9px] px-2 border-0', vStatus.bg, vStatus.text)}>
                        {vStatus.label}
                      </Badge>
                    )}
                  </div>
                  {v.property?.city && (
                    <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {[v.property.address_street, v.property.zone, v.property.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    {v.duration_minutes != null && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {v.duration_minutes} min
                      </span>
                    )}
                    {v.consultant?.commercial_name && <span>· {v.consultant.commercial_name}</span>}
                    {propHref && (
                      <Link href={propHref} target="_blank" className="ml-auto text-primary hover:underline inline-flex items-center gap-1">
                        Ver imóvel
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={showVisit} onOpenChange={setShowVisit}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Agendar visita</DialogTitle>
          </DialogHeader>
          <VisitForm
            defaultLeadId={leadId}
            defaultConsultantId={userId}
            onSubmit={handleCreateVisit}
            onCancel={() => setShowVisit(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Interessados Tab ──────────────────────────────────────────────────

function InteressadosTab({
  negocioId,
  negocio,
  currentUserId,
}: {
  negocioId: string
  negocio: any
  currentUserId?: string | null
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [showHidden, setShowHidden] = useState(false)
  // Filtros: 'strict' (default) limita por preço ±15% + tipo + zona + quartos.
  // 'loose' relaxa para preço ±30% e ignora tipo/zona/quartos.
  const [strict, setStrict] = useState(true)
  // Sugestão a colegas (cross-consultor) — só disponível em strict.
  const [selectedColleagueIds, setSelectedColleagueIds] = useState<Set<string>>(new Set())
  const [suggestingId, setSuggestingId] = useState<string | null>(null)
  const [bulkSending, setBulkSending] = useState(false)

  // Specs derivadas do negócio actual — usadas no caption das sugestões.
  // Sem precisar de imóvel (mensagem é texto puro descrevendo a angariação).
  const negocioSpecs = useMemo(() => buildNegocioSpecs(negocio), [negocio])

  const fetchInteressados = useCallback(
    async (withScore = false, strictOverride?: boolean) => {
      if (withScore) setScoring(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams()
        if (withScore) params.set('score', 'true')
        const useStrict = strictOverride ?? strict
        if (!useStrict) params.set('strict', 'false')
        const qs = params.toString()
        const res = await fetch(`/api/negocios/${negocioId}/interessados${qs ? `?${qs}` : ''}`)
        if (res.ok) {
          const json = await res.json()
          setItems(json.data || [])
        }
      } catch {
        /* silent */
      } finally {
        setLoading(false)
        setScoring(false)
      }
    },
    [negocioId, strict],
  )

  useEffect(() => {
    fetchInteressados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId])

  const handleToggleStrict = (next: boolean) => {
    setStrict(next)
    fetchInteressados(false, next)
    // Limpar selecções ao trocar para 'solto' (a sugestão só é permitida em strict)
    if (!next) setSelectedColleagueIds(new Set())
  }

  const toggleColleagueSelection = (negId: string) => {
    setSelectedColleagueIds((prev) => {
      const n = new Set(prev)
      if (n.has(negId)) n.delete(negId)
      else n.add(negId)
      return n
    })
  }

  /** Selecciona (ou desselecciona) todos os leads de um colega em particular. */
  const toggleSelectAllForColleague = (consultantId: string, leadIds: string[]) => {
    setSelectedColleagueIds((prev) => {
      const allSelected = leadIds.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        // Desseleccionar todos
        for (const id of leadIds) next.delete(id)
      } else {
        // Seleccionar todos
        for (const id of leadIds) next.add(id)
      }
      return next
    })
  }

  const handleSuggestSingleWA = async (item: any) => {
    if (!item.phone) {
      toast.error('Colega sem telemóvel registado')
      return
    }
    setSuggestingId(item.negocioId)
    try {
      const res = await suggestNegocioToColleagueViaWhatsApp({
        specs: negocioSpecs,
        colleaguePhone: item.phone,
        colleagueFirstName: (item.colleague || '').split(' ')[0] || null,
        leadNames: [item.firstName].filter(Boolean),
      })
      if (res.ok) {
        toast.success(`Sugestão enviada a ${(item.colleague || '').split(' ')[0] || 'colega'}`)
      } else {
        toast.error(res.error || 'Erro ao enviar sugestão')
      }
    } finally {
      setSuggestingId(null)
    }
  }

  const handleBulkInternalChat = async () => {
    if (!currentUserId) {
      toast.error('Sessão expirou — recarregue a página')
      return
    }
    const selected = items.filter((i: any) => selectedColleagueIds.has(i.negocioId))
    if (selected.length === 0) return

    // Agrupar por consultantId (1 mensagem por colega, com lista de todos os
    // leads desse colega seleccionados).
    const byColleague = new Map<string, { name: string; firstName: string; leads: string[] }>()
    for (const i of selected) {
      if (!i.consultantId) continue
      const entry = byColleague.get(i.consultantId)
      if (entry) {
        entry.leads.push(i.firstName)
      } else {
        byColleague.set(i.consultantId, {
          name: i.colleague || 'Colega',
          firstName: (i.colleague || '').split(' ')[0] || 'Colega',
          leads: [i.firstName].filter(Boolean),
        })
      }
    }

    if (byColleague.size === 0) {
      toast.error('Nenhum colega válido nas selecções')
      return
    }

    setBulkSending(true)
    let sent = 0
    let failed = 0
    for (const [colleagueId, data] of byColleague.entries()) {
      const res = await suggestNegocioToColleagueViaInternalChat({
        specs: negocioSpecs,
        currentUserId,
        colleagueUserId: colleagueId,
        colleagueFirstName: data.firstName,
        leadNames: data.leads,
      })
      if (res.ok) sent++
      else failed++
    }
    setBulkSending(false)

    if (failed === 0) {
      toast.success(
        `Sugestão enviada a ${sent} ${sent === 1 ? 'colega' : 'colegas'} pelo chat interno`,
      )
    } else if (sent > 0) {
      toast.warning(`${sent} enviada${sent === 1 ? '' : 's'}, ${failed} falhou`)
    } else {
      toast.error('Erro ao enviar sugestões')
    }

    setSelectedColleagueIds(new Set())
  }

  if (loading) return <ListSkeleton />

  const visible = showHidden ? items : items.filter((i) => !hidden.has(i.negocioId))

  // Render de uma row de interessado (reusado entre "Os meus" e grupos por colega).
  const renderInteressadoRow = (i: any) => {
    const isHidden = hidden.has(i.negocioId)
    const score = i.match_score as number | null
    const scoreColor =
      score != null
        ? score >= 80
          ? 'bg-emerald-500 text-white'
          : score >= 60
            ? 'bg-amber-500 text-white'
            : score >= 40
              ? 'bg-orange-500 text-white'
              : 'bg-red-500 text-white'
        : ''
    const canSuggestToColleague = !i.isMine && strict
    const isSelectedForBulk = selectedColleagueIds.has(i.negocioId)
    return (
      <div
        key={i.negocioId}
        className={cn(
          'rounded-2xl border bg-background shadow-sm p-3 flex items-center gap-3 transition-all',
          isHidden && 'opacity-50',
          isSelectedForBulk
            ? 'border-primary/60 ring-1 ring-primary/30 bg-primary/5'
            : 'border-border/40',
        )}
      >
        {canSuggestToColleague && (
          <Checkbox
            checked={isSelectedForBulk}
            onCheckedChange={() => toggleColleagueSelection(i.negocioId)}
            className="shrink-0"
            aria-label="Seleccionar para sugestão em lote"
          />
        )}
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{i.firstName || '—'}</p>
            {score != null && (
              <span className={cn('inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full', scoreColor)}>
                {score}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
            {i.phone && (
              <a href={`tel:${i.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="h-2.5 w-2.5" />
                {i.phone}
              </a>
            )}
            {i.email && (
              <a href={`mailto:${i.email}`} className="inline-flex items-center gap-1 hover:text-foreground truncate">
                <Mail className="h-2.5 w-2.5" />
                {i.email}
              </a>
            )}
          </div>
          {Array.isArray(i.badges) && i.badges.length > 0 && (
            <MismatchBadgesRow badges={i.badges} />
          )}
        </div>
        {canSuggestToColleague && i.phone && (
          <button
            type="button"
            disabled={suggestingId === i.negocioId}
            onClick={() => handleSuggestSingleWA(i)}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors disabled:opacity-50"
            title="Sugerir ao colega via WhatsApp"
          >
            {suggestingId === i.negocioId ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            )}
          </button>
        )}
        {!i.isMine && (
          <button
            type="button"
            onClick={() => {
              setHidden((prev) => {
                const n = new Set(prev)
                if (n.has(i.negocioId)) n.delete(i.negocioId)
                else n.add(i.negocioId)
                return n
              })
            }}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/60"
            title={isHidden ? 'Mostrar' : 'Ocultar'}
          >
            {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-muted-foreground">
          {items.length === 0
            ? strict
              ? 'Sem matches estritos. Tente "Solto".'
              : 'Sem matches mesmo com filtros relaxados.'
            : `${items.length} ${items.length === 1 ? 'comprador' : 'compradores'}`}
        </p>
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Strict / Solto toggle */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-muted/60 border border-border/40">
            <button
              type="button"
              onClick={() => handleToggleStrict(true)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all',
                strict ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Filtros estritos (tipo + zona + preço ±15% + quartos)"
            >
              Estrito
            </button>
            <button
              type="button"
              onClick={() => handleToggleStrict(false)}
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all',
                !strict ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              title="Filtros relaxados (preço ±30%, sem tipo/zona/quartos)"
            >
              Solto
            </button>
          </div>
          {hidden.size > 0 && (
            <Button variant="ghost" size="sm" className="rounded-full h-7 text-xs" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
              {showHidden ? 'Esconder ocultos' : `${hidden.size} ocult${hidden.size === 1 ? 'o' : 'os'}`}
            </Button>
          )}
          {items.length > 0 && (
            <Button variant="outline" size="sm" className="rounded-full h-7 text-xs" disabled={scoring} onClick={() => fetchInteressados(true)}>
              {scoring ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Classificar IA
            </Button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyHint icon={Users} message="Nenhum comprador compatível." />
      ) : (
        <div className="space-y-3 pb-12">
          {(() => {
            // Computa grupos para visual organizado: mine primeiro, depois por colega
            const mineList = visible.filter((i: any) => i.isMine)
            const colleagueList = visible.filter((i: any) => !i.isMine)
            const byColleague = new Map<string, any[]>()
            for (const i of colleagueList) {
              const key = i.consultantId || `__name:${i.colleague || 'Sem consultor'}`
              const arr = byColleague.get(key) || []
              arr.push(i)
              byColleague.set(key, arr)
            }
            const sortedGroups = Array.from(byColleague.entries()).sort(([, a], [, b]) =>
              (b.length - a.length) ||
              ((a[0]?.colleague || '').localeCompare(b[0]?.colleague || '')),
            )
            return (
              <>
                {mineList.length > 0 && (
                  <section className="space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                      Os meus compradores
                    </p>
                    {mineList.map((i: any) => renderInteressadoRow(i))}
                  </section>
                )}
                {sortedGroups.map(([key, group]) => {
                  const colleagueName = group[0]?.colleague || 'Sem consultor'
                  const consultantId = group[0]?.consultantId
                  const groupIds = group.map((g: any) => g.negocioId)
                  const allSelected = groupIds.every((id: string) => selectedColleagueIds.has(id))
                  const someSelected = groupIds.some((id: string) => selectedColleagueIds.has(id))
                  const canBulk = strict && consultantId
                  return (
                    <section key={key} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                          Compradores de {colleagueName}{group.length > 1 ? ` · ${group.length}` : ''}
                        </p>
                        {canBulk && group.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleSelectAllForColleague(consultantId, groupIds)}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            {allSelected ? 'Desseleccionar todos' : someSelected ? `Seleccionar restantes` : 'Seleccionar todos'}
                          </button>
                        )}
                      </div>
                      {group.map((i: any) => renderInteressadoRow(i))}
                    </section>
                  )
                })}
              </>
            )
          })()}

        </div>
      )}


      {/* Hint quando não está em strict — explica porque não há sugestões */}
      {!strict && items.some((i: any) => !i.isMine) && (
        <p className="text-[11px] text-muted-foreground italic px-1">
          Active <span className="font-medium">Estrito</span> para sugerir aos colegas.
        </p>
      )}

      {/* Bulk action bar — sticky bottom dentro da tab */}
      {selectedColleagueIds.size > 0 && (
        <div className="sticky bottom-0 -mx-2 px-2 py-2 bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-xl border-t border-border/40 flex items-center gap-2 flex-wrap">
          <span className="text-sm">
            <span className="font-semibold">{selectedColleagueIds.size}</span> seleccionado{selectedColleagueIds.size === 1 ? '' : 's'}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-7 text-xs"
            onClick={() => setSelectedColleagueIds(new Set())}
            disabled={bulkSending}
          >
            Limpar
          </Button>
          <Button
            size="sm"
            className="rounded-full h-7 text-xs gap-1.5 ml-auto"
            onClick={handleBulkInternalChat}
            disabled={bulkSending}
            title="Envia 1 mensagem por colega no chat interno, com a lista dos seus clientes seleccionados"
          >
            {bulkSending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MessageSquare className="h-3 w-3" />
            )}
            Sugerir via chat interno
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Shared small UI helpers ───────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle?: string
  icon?: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  )
}

function CopyableRow({
  icon: Icon,
  label,
  value,
  onCopy,
  href,
}: {
  icon: React.ElementType
  label: string
  value: string
  onCopy: () => void
  href?: string
}) {
  return (
    <div className="flex items-center gap-3 py-1 -mx-1 px-1 rounded-lg hover:bg-muted/40 transition-colors group/row">
      <div className="h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        {href ? (
          <a href={href} className="text-sm font-medium truncate block hover:text-primary transition-colors">
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium truncate">{value}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onCopy}
        title="Copiar"
        className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-colors opacity-0 group-hover/row:opacity-100"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
      <Skeleton className="h-10 w-64 mx-auto rounded-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  )
}

function EmptyHint({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-8 flex flex-col items-center text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

// ─── Imóveis Tab — agrupa Matching + Dossier em sub-tabs internas ──────
type ImoveisSubTab = 'matching' | 'dossier'

function ImoveisGroupedTab({
  negocioId,
  leadId,
  userId,
  onDossierChanged,
  onPreviewProperty,
}: {
  negocioId: string
  leadId: string | null
  userId: string | undefined
  onDossierChanged: () => void
  onPreviewProperty: (id: string | null) => void
}) {
  const [sub, setSub] = useState<ImoveisSubTab>('matching')

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-muted/60 border border-border/40">
          <button
            type="button"
            onClick={() => setSub('matching')}
            className={cn(
              'px-4 py-1 rounded-full text-xs font-medium transition-all',
              sub === 'matching'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Matching
          </button>
          <button
            type="button"
            onClick={() => setSub('dossier')}
            className={cn(
              'px-4 py-1 rounded-full text-xs font-medium transition-all',
              sub === 'dossier'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Dossier
          </button>
        </div>
      </div>

      {sub === 'matching' && (
        <MatchingTab
          negocioId={negocioId}
          onDossierChanged={onDossierChanged}
          onPreviewProperty={onPreviewProperty}
        />
      )}
      {sub === 'dossier' && (
        <ImoveisTab
          negocioId={negocioId}
          leadId={leadId}
          userId={userId}
          onPreviewProperty={onPreviewProperty}
        />
      )}
    </div>
  )
}

// ─── Propostas Tab — wrapper para o componente NegocioProposalsTab ─────

function PropostasTab({ negocioId }: { negocioId: string }) {
  return <NegocioProposalsTab negocioId={negocioId} />
}

// ─── Fecho Tab — fechos de negócio ligados a este negócio (Compra side) ──

function FechoTab({
  negocioId,
  negocio,
}: {
  negocioId: string
  negocio: any
}) {
  const router = useRouter()
  const [deals, setDeals] = useState<any[]>([])
  const [dossier, setDossier] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const leadName = negocio?.lead?.full_name || negocio?.lead?.nome || null
  const leadEmail = negocio?.lead?.email || null
  const leadPhone = negocio?.lead?.telemovel || negocio?.lead?.telefone || null

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const [dealsRes, dossierRes] = await Promise.all([
        fetch(`/api/deals?negocio_id=${negocioId}`),
        fetch(`/api/negocios/${negocioId}/properties`),
      ])
      if (dealsRes.ok) {
        const json = await dealsRes.json()
        setDeals(Array.isArray(json) ? json : json.data || [])
      }
      if (dossierRes.ok) {
        const json = await dossierRes.json()
        setDossier(json.data || [])
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [negocioId])

  useEffect(() => { void refetch() }, [refetch])

  // Identifica o imóvel "óbvio" para o fecho — o que está no dossier marcado
  // como `interested` ou `proposed`, ou (fallback) o único imóvel do dossier.
  const obviousProperty = (() => {
    const ranked = (dossier || [])
      .filter((d: any) => d.property_id && d.property)
      .sort((a: any, b: any) => {
        const order: Record<string, number> = { interested: 0, proposed: 1, visited: 2, sent: 3, pending: 4 }
        return (order[a.status] ?? 99) - (order[b.status] ?? 99)
      })
    return ranked[0]?.property || null
  })()
  const dealPrefill = buildDealPropertyContextFromNegocio(negocio, obviousProperty
    ? {
        id: obviousProperty.id,
        title: obviousProperty.title,
        external_ref: obviousProperty.external_ref,
        listing_price: obviousProperty.listing_price,
        city: obviousProperty.city,
        business_type: null,
      }
    : null)

  if (loading) return <ListSkeleton />

  const drafts = deals.filter((d) => d.status === 'draft')
  const submitted = deals.filter((d) => d.status !== 'draft')
  const hasAny = deals.length > 0

  return (
    <div className="space-y-3">
      {!hasAny ? (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-6 flex flex-col items-center text-center">
          <Briefcase className="h-7 w-7 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Sem fecho de negócio</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
            O fecho regista o contrato e despacha as comissões. A proposta é opcional — podes criar o fecho directamente.
          </p>
          <Button
            type="button"
            size="sm"
            className="rounded-full mt-4 gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Criar fecho
          </Button>
        </div>
      ) : (
        <>
          {/* Rascunhos */}
          {drafts.map((d: any) => (
            <div
              key={d.id}
              className="rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 shadow-sm p-4 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              onClick={() => router.push(`/dashboard/financeiro/deals/${d.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <Briefcase className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {d.property?.title || 'Fecho em curso'}
                    </p>
                    <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                      Rascunho
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Criado a {format(new Date(d.created_at || Date.now()), "d 'de' MMM, HH:mm", { locale: pt })} · Continua para finalizar
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
              </div>
            </div>
          ))}

          {/* Fechos submetidos */}
          {submitted.map((d: any) => {
            const status = d.status || 'unknown'
            const statusMeta: Record<string, { label: string; bg: string; text: string }> = {
              submitted: { label: 'Submetido', bg: 'bg-blue-500/15', text: 'text-blue-700' },
              under_review: { label: 'Em revisão', bg: 'bg-amber-500/15', text: 'text-amber-700' },
              approved: { label: 'Aprovado', bg: 'bg-emerald-500/15', text: 'text-emerald-700' },
              completed: { label: 'Concluído', bg: 'bg-emerald-600/15', text: 'text-emerald-700' },
              rejected: { label: 'Rejeitado', bg: 'bg-red-500/15', text: 'text-red-700' },
              cancelled: { label: 'Cancelado', bg: 'bg-slate-500/15', text: 'text-slate-700' },
            }
            const meta = statusMeta[status] || { label: status, bg: 'bg-muted', text: 'text-muted-foreground' }
            return (
              <div
                key={d.id}
                className="rounded-2xl bg-background border border-border/50 shadow-sm p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => router.push(`/dashboard/financeiro/deals/${d.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">
                        {d.property?.title || 'Fecho de negócio'}
                      </p>
                      <span className={cn('inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full', meta.bg, meta.text)}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                      {d.deal_value != null && (
                        <span className="font-medium tabular-nums">
                          {eur.format(d.deal_value)}
                        </span>
                      )}
                      {d.deal_date && (
                        <span>· {format(new Date(d.deal_date), "d 'de' MMM yyyy", { locale: pt })}</span>
                      )}
                      {d.consultant?.commercial_name && (
                        <span>· {d.consultant.commercial_name}</span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                </div>
              </div>
            )
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full w-full gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo fecho
          </Button>
        </>
      )}

      {/* DealDialog com contexto do negócio (pré-preenche clientes + property) */}
      <DealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        negocioContext={{
          id: negocioId,
          leadName,
          leadEmail,
          leadPhone,
        }}
        propertyContext={dealPrefill.propertyContext}
        onComplete={() => {
          setCreateOpen(false)
          toast.success('Fecho criado')
          refetch()
        }}
      />
    </div>
  )
}

// ─── Angariação Tab — processo de angariação do negócio ─────────────────

function AngariacaoTab({ negocioId, negocio }: { negocioId: string; negocio: any }) {
  const router = useRouter()
  const [processes, setProcesses] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  const acquisitionPrefill = buildAcquisitionPrefillFromNegocio(negocio)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      // Processos finalizados (não-rascunho) ligados ao negócio
      const procRes = await fetch(`/api/processes?negocio_id=${negocioId}`)
      if (procRes.ok) {
        const json = await procRes.json()
        setProcesses(json.data || [])
      }
      // Rascunhos pendentes
      const draftRes = await fetch('/api/acquisitions/drafts')
      if (draftRes.ok) {
        const json = await draftRes.json()
        const filtered = (json.data || json || []).filter(
          (d: any) => d.negocio_id === negocioId,
        )
        setDrafts(filtered)
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [negocioId])

  useEffect(() => { void refetch() }, [refetch])

  if (loading) return <ListSkeleton />

  const hasAny = processes.length > 0 || drafts.length > 0

  return (
    <div className="space-y-3">
      {!hasAny ? (
        <div className="rounded-2xl bg-background border border-border/50 shadow-sm p-6 flex flex-col items-center text-center">
          <Briefcase className="h-7 w-7 text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Sem processo de angariação</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[300px]">
            Cria a angariação a partir deste negócio. Quando concluída, o imóvel passa a estar disponível.
          </p>
          <Button
            type="button"
            size="sm"
            className="rounded-full mt-4 gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Criar angariação
          </Button>
        </div>
      ) : (
        <>
          {/* Drafts em curso */}
          {drafts.map((d: any) => (
            <div
              key={d.id}
              className="rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 shadow-sm p-4 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
              onClick={() => router.push(`/dashboard/processos/novo?draft=${d.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                  <Briefcase className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{d.title || 'Rascunho de angariação'}</p>
                    <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
                      Rascunho
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Criado a {format(new Date(d.created_at || d.updated_at || Date.now()), "d 'de' MMM, HH:mm", { locale: pt })} · Continua para finalizar
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
              </div>
            </div>
          ))}

          {/* Processos formalizados */}
          {processes.map((p: any) => {
            const status = p.current_status || 'unknown'
            const statusMeta: Record<string, { label: string; bg: string; text: string }> = {
              draft: { label: 'Rascunho', bg: 'bg-amber-500/15', text: 'text-amber-700' },
              pending_approval: { label: 'Pendente aprovação', bg: 'bg-amber-500/15', text: 'text-amber-700' },
              active: { label: 'Activo', bg: 'bg-emerald-500/15', text: 'text-emerald-700' },
              on_hold: { label: 'Pausado', bg: 'bg-slate-500/15', text: 'text-slate-700' },
              completed: { label: 'Concluído', bg: 'bg-blue-500/15', text: 'text-blue-700' },
              cancelled: { label: 'Cancelado', bg: 'bg-red-500/15', text: 'text-red-700' },
              rejected: { label: 'Rejeitado', bg: 'bg-red-500/15', text: 'text-red-700' },
            }
            const meta = statusMeta[status] || { label: status, bg: 'bg-muted', text: 'text-muted-foreground' }
            const propertyTitle = p.dev_properties?.title || 'Imóvel'
            const isCompleted = status === 'completed'
            return (
              <div
                key={p.id}
                className={cn(
                  'rounded-2xl border bg-background shadow-sm p-4 cursor-pointer transition-colors',
                  'hover:bg-muted/30',
                  'border-border/50',
                )}
                onClick={() => router.push(`/dashboard/processos/${p.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{p.external_ref || 'Processo'}</p>
                      <span className={cn('inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full', meta.bg, meta.text)}>
                        {meta.label}
                      </span>
                      {p.percent_complete != null && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {p.percent_complete}%
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{propertyTitle}</p>
                    {isCompleted && p.property_id && (
                      <Link
                        href={`/dashboard/imoveis?property=${p.property_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5"
                      >
                        Ver imóvel
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                </div>
              </div>
            )
          })}

          {/* CTA — criar outra (raro mas possível) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full w-full gap-1.5"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova angariação
          </Button>
        </>
      )}

      {/* Dialog de criação — pré-preenchido com o negocioId + specs do imóvel + owner=lead */}
      <AcquisitionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        negocioId={negocioId}
        prefillData={acquisitionPrefill}
        onComplete={(procInstanceId) => {
          setCreateOpen(false)
          toast.success('Angariação criada com sucesso')
          refetch()
          router.push(`/dashboard/processos/${procInstanceId}`)
        }}
      />
    </div>
  )
}
