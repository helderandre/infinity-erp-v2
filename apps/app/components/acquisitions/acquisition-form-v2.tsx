'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acquisitionSchema } from '@/lib/validations/acquisition'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Send, Sparkles, Save, X, AlertCircle, Briefcase, Link2,
  Home, MapPin, Users, FileSignature, Folder, FileText, Rocket,
  Check, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/kibo-ui/spinner'
import { StepIntro } from './step-intro'
import type { AcquisitionDraft } from './drafts-list'
import { StepProperty } from './step-1-property'
import { StepLocation } from './step-2-location'
import { StepOwners } from './step-3-owners'
import { StepDescription } from './step-description'
import { StepContract } from './step-4-contract'
import { StepDocuments } from './step-5-documents'
import { AcquisitionQuickFill } from './acquisition-quick-fill'
import { NegocioPickerDialog, type NegocioPickerItem } from '@/components/negocios/negocio-picker-dialog'
import { buildAcquisitionPrefillFromNegocio, mapNegocioContactsToParticipants, type PrefillParticipant } from '@/lib/negocios/prefill-from-negocio'

type AcquisitionFormData = z.infer<typeof acquisitionSchema>

const TABS = [
  { value: 'intro', label: 'Começar', icon: Rocket },
  { value: 'property', label: 'Dados do Imóvel', icon: Home },
  { value: 'location', label: 'Localização', icon: MapPin },
  { value: 'owners', label: 'Proprietários', icon: Users },
  { value: 'description', label: 'Descrição', icon: FileText },
  { value: 'contract', label: 'Contrato', icon: FileSignature },
  { value: 'documents', label: 'Documentos', icon: Folder },
] as const

// Map field keys to PT labels for error messages
const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  property_type: 'Tipo de Imóvel',
  business_type: 'Tipo de Negócio',
  listing_price: 'Preço',
  address_street: 'Morada',
  city: 'Cidade',
  postal_code: 'Código Postal',
  owners: 'Proprietários',
  contract_regime: 'Regime de Contrato',
  commission_agreed: 'Comissão',
}

// Map field key to which tab it belongs
function getTabForField(field: string): string {
  if (['title', 'property_type', 'business_type', 'listing_price', 'property_condition', 'energy_certificate'].includes(field)) return 'property'
  if (['address_street', 'city', 'postal_code', 'zone', 'address_parish', 'latitude', 'longitude'].includes(field)) return 'location'
  if (field === 'owners') return 'owners'
  if (field === 'description') return 'description'
  if (['contract_regime', 'commission_agreed', 'commission_type', 'contract_term', 'contract_expiry', 'imi_value', 'condominium_fee', 'internal_notes'].includes(field)) return 'contract'
  return 'documents'
}

/* ─── Stepper ────────────────────────────────────────────────────────────
 * Breadcrumb com círculos numerados ligados por linha. Apenas os círculos
 * são visíveis (sem labels) — o título de cada passo aparece dentro do
 * conteúdo, ao centro. Passos completos ficam verdes com check, o activo
 * a primário (ligeiramente maior), os futuros em outline. Click em qualquer
 * círculo continua a permitir random-access; Anterior/Seguinte no rodapé
 * sugerem o fluxo sequencial.
 *
 * Mobile-first: os conectores entre círculos são `flex-1` para esticarem ou
 * encolherem com o ecrã; o componente é centrado e nunca corta os círculos.
 */
function StepperHeader({
  steps,
  activeIndex,
  onStepClick,
}: {
  steps: ReadonlyArray<{ value: string; label: string }>
  activeIndex: number
  onStepClick: (value: string) => void
}) {
  return (
    <ol className="flex items-center w-full max-w-md mx-auto px-1">
      {steps.map((step, idx) => {
        const isActive = idx === activeIndex
        const isCompleted = idx < activeIndex
        const isLast = idx === steps.length - 1
        return (
          <li
            key={step.value}
            className={cn('flex items-center min-w-0', isLast ? 'shrink-0' : 'flex-1')}
          >
            <button
              type="button"
              onClick={() => onStepClick(step.value)}
              aria-label={step.label}
              aria-current={isActive ? 'step' : undefined}
              className="group focus:outline-none shrink-0"
            >
              <span
                className={cn(
                  'rounded-full flex items-center justify-center text-[11px] font-semibold border transition-all',
                  isActive
                    ? 'h-8 w-8 bg-foreground text-background border-foreground shadow-md ring-4 ring-foreground/10'
                    : 'h-7 w-7',
                  !isActive && isCompleted && 'bg-emerald-500 text-white border-emerald-500',
                  !isActive && !isCompleted && 'bg-background text-muted-foreground border-border group-hover:border-foreground/40',
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </span>
            </button>
            {!isLast && (
              <div
                className={cn(
                  'h-px flex-1 min-w-3 mx-1.5 sm:mx-2 transition-colors',
                  isCompleted ? 'bg-emerald-400' : 'bg-border',
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

export interface AcquisitionFormV2Props {
  mode: 'standalone' | 'dialog'
  draftId?: string
  prefillData?: Partial<AcquisitionFormData>
  negocioId?: string
  onComplete?: (procInstanceId: string) => void
  onClose?: () => void
  /** Called once when a draft row is created in the DB (lazy via autosave or
   *  manual save). The dialog uses it to track whether closing should prompt
   *  the consultor to discard. */
  onDraftCreated?: (procInstanceId: string) => void
  /** Fires the first time the consultor edits any field (regardless of whether
   *  the autosave debounce has resolved yet). Used by the dialog to decide
   *  if closing should prompt save/discard — covers the race where the user
   *  types and immediately clicks outside before the 1.5s debounce fires. */
  onUserFirstEdit?: () => void
  /** Called once on mount with imperative actions the dialog can invoke from
   *  the close-confirmation dialog. `flushSave` cancels any pending debounce
   *  and forces a synchronous save (useful when the user picks "Guardar" but
   *  the latest edits haven't been autosaved yet). `discard` cancels the
   *  pending debounce and DELETEs the draft if it already exists. */
  onRegisterActions?: (actions: {
    flushSave: () => Promise<void>
    discard: () => Promise<void>
  }) => void
  /** Bubble-up: o consultor escolheu retomar um rascunho específico a partir
   *  do passo "Começar". O dialog deve trocar `resumeId` para este id e
   *  fazer remount da form (via `key`) para carregar os dados do draft. */
  onResumeDraft?: (draftId: string) => void
}

export function AcquisitionFormV2({
  mode,
  draftId,
  prefillData,
  negocioId,
  onComplete,
  onClose,
  onDraftCreated,
  onUserFirstEdit,
  onRegisterActions,
  onResumeDraft,
}: AcquisitionFormV2Props) {
  const router = useRouter()
  // Se já vimos com um negocioId (vindo de um deal) ou estamos a retomar
  // um draft, saltamos directamente para "Dados do Imóvel" — o intro só
  // existe para a entrada nova, sem contexto.
  const [activeTab, setActiveTab] = useState<string>(
    negocioId || draftId ? 'property' : 'intro',
  )
  // Escolha de origem feita no passo intro — persistida durante a sessão
  // para que voltar ao intro mostre a mesma vista (cards iniciais, picker
  // inline, lista de rascunhos, ou confirmação "Começar do zero").
  const [originChoice, setOriginChoice] = useState<'opportunity' | 'fresh' | 'draft' | null>(
    negocioId ? 'opportunity' : null,
  )
  // Rascunhos guardados pelo consultor — só relevantes no passo intro de uma
  // nova angariação (sem `negocioId` nem `draftId`). Excluímos sempre o
  // próprio `procInstanceId` para o consultor não ver o rascunho que está
  // a editar.
  const [savedDrafts, setSavedDrafts] = useState<AcquisitionDraft[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInitializing, setIsInitializing] = useState(!!draftId)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [quickFillOpen, setQuickFillOpen] = useState(false)

  // Draft state
  const [procInstanceId, setProcInstanceId] = useState<string | null>(draftId || null)
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const draftCreated = useRef(false)
  // Singleton-promise guard so concurrent autosave triggers don't create
  // multiple drafts before setProcInstanceId propagates through state.
  const draftPromiseRef = useRef<Promise<{ procId: string; propId: string }> | null>(null)
  // Debounce timer for autosave subscription.
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<Date | null>(null)
  // Flips true on the consultor's first edit. Used to (a) gate close
  // confirmation race-free (set immediately, doesn't depend on the 1.5s
  // debounce having already fired), (b) trigger `onUserFirstEdit` exactly
  // once.
  const userEditedRef = useRef(false)
  // Microtask flag — flips true after the init useEffect settles (loadDraft
  // resume OR prefill reset OR plain mount). Programmatic resets during init
  // emit setValue events with `name`, which would otherwise be confused with
  // user input.
  const autosaveReadyRef = useRef(false)

  // Picker "É de um negócio existente?" — só em standalone (sem prop negocioId,
  // sem draft a retomar). O pick override fica em estado interno e é usado nas
  // chamadas de API em vez do prop.
  const [effectiveNegocioId, setEffectiveNegocioId] = useState<string | undefined>(negocioId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickedNegocio, setPickedNegocio] = useState<NegocioPickerItem | null>(null)
  const isStandaloneCtx = !negocioId && !draftId
  const linkedLabel = pickedNegocio
    ? `${pickedNegocio.lead?.full_name || pickedNegocio.lead?.nome || 'Lead'} · ${pickedNegocio.tipo}`
    : null

  const form = useForm({
    resolver: zodResolver(acquisitionSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      property_type: '',
      business_type: 'venda',
      // null para o campo arrancar vazio (não obriga o consultor a apagar
      // um "0" antes de digitar). Submit manual rejeita null/<=0.
      listing_price: null,
      city: '',
      zone: '',
      address_parish: '',
      address_street: '',
      postal_code: '',
      latitude: null,
      longitude: null,
      property_condition: '',
      energy_certificate: '',
      owners: [],
      contract_regime: 'exclusivo',
      // 5% é a taxa-padrão da casa — o consultor pode editar livremente.
      commission_agreed: 5,
      commission_type: 'percentage',
      contract_term: '6 meses',
      contract_term_custom_reason: null,
      contract_expiry: '',
      imi_value: undefined,
      condominium_fee: undefined,
      internal_notes: '',
      documents: [] as Array<{ doc_type_id: string; file?: File; file_url?: string; file_name?: string; owner_index?: number }>,
      // Numéricos das especificações arrancam null (campo vazio na UI).
      // No submit final são normalizados a 0 — excepto construction_year, que
      // mantemos null porque é opcional e não faz sentido "0" como ano.
      specifications: {
        typology: '',
        bedrooms: null,
        bathrooms: null,
        area_gross: null,
        area_util: null,
        construction_year: null,
        parking_spaces: null,
        garage_spaces: null,
        has_elevator: false,
        features: [],
      },
    },
  })

  const applyPickedNegocio = useCallback(
    async (n: NegocioPickerItem) => {
      setPickedNegocio(n)
      setEffectiveNegocioId(n.id)
      // Contactos associados da oportunidade → proprietários adicionais.
      let participants: PrefillParticipant[] = []
      try {
        const res = await fetch(`/api/crm/negocios/${n.id}/contactos`)
        if (res.ok) participants = mapNegocioContactsToParticipants((await res.json()).data)
      } catch { /* sem associados → só o titular */ }
      // Reusa o helper partilhado entre tab Angariação e picker standalone.
      const prefill = buildAcquisitionPrefillFromNegocio(n as any, participants)
      const current = form.getValues()
      form.reset({ ...current, ...prefill } as any)
      toast.success('Pré-preenchido a partir do negócio')
      // Picar uma oportunidade conta como intent de criar — sinalizamos
      // edição ao dialog para que o prompt "guardar / descartar" apareça
      // se o utilizador fechar antes de gravar.
      onUserFirstEdit?.()
      // Após escolher uma oportunidade, saltamos directamente para
      // Dados do Imóvel — o passo intro já cumpriu o seu papel.
      setOriginChoice('opportunity')
      setActiveTab('property')
    },
    [form, onUserFirstEdit],
  )

  const clearPickedNegocio = useCallback(() => {
    setPickedNegocio(null)
    setEffectiveNegocioId(negocioId)
  }, [negocioId])

  // Fetch other drafts the consultor has — excluímos o draft que estamos a
  // editar para não aparecer como uma opção de "retomar para si próprio".
  // Apenas relevante no passo intro de uma nova entrada (sem context).
  useEffect(() => {
    if (negocioId) return // origem já decidida pelo caller
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/acquisitions/drafts')
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const list: AcquisitionDraft[] = json.data || []
        setSavedDrafts(list.filter((d) => d.proc_instance_id !== procInstanceId))
      } catch {
        // silencioso — sem drafts é equivalente a card escondido
      }
    })()
    return () => {
      cancelled = true
    }
  }, [negocioId, procInstanceId])

  const handleDraftDeleted = useCallback((id: string) => {
    setSavedDrafts((prev) => {
      const next = prev.filter((d) => d.proc_instance_id !== id)
      // Se a lista ficou vazia, voltamos automaticamente ao grid de cards.
      if (next.length === 0) setOriginChoice(null)
      return next
    })
  }, [])

  const handleResumeDraft = useCallback(
    (id: string) => {
      // Bubble up — o dialog (parent) faz remount da form com o novo draftId.
      onResumeDraft?.(id)
    },
    [onResumeDraft],
  )

  // Watch required fields for submit button state
  const title = form.watch('title')
  const propertyType = form.watch('property_type')
  const businessType = form.watch('business_type')
  const listingPrice = form.watch('listing_price')

  const canSubmit = !!(title && propertyType && businessType && (listingPrice ?? 0) > 0)

  // Track required fields for missing count
  const addressStreet = form.watch('address_street')
  const city = form.watch('city')
  const contractRegime = form.watch('contract_regime')
  const commissionAgreed = form.watch('commission_agreed')
  const owners = form.watch('owners') || []
  const hasOwners = owners.some((o: any) => o.name?.trim())

  const requiredFields = [
    { field: 'title', filled: !!title },
    { field: 'property_type', filled: !!propertyType },
    { field: 'business_type', filled: !!businessType },
    { field: 'listing_price', filled: (listingPrice ?? 0) > 0 },
    { field: 'address_street', filled: !!addressStreet },
    { field: 'city', filled: !!city },
    { field: 'owners', filled: hasOwners },
    { field: 'contract_regime', filled: !!contractRegime },
    { field: 'commission_agreed', filled: (commissionAgreed ?? 0) > 0 },
  ]
  const missingCount = requiredFields.filter(f => !f.filled).length
  const nextMissingField = requiredFields.find(f => !f.filled)?.field

  // Click no badge "campos em falta" leva ao tab do primeiro campo por
  // preencher (se já estiveres no tab certo, leva ao seguinte por preencher).
  const handleJumpToNextMissing = () => {
    if (!nextMissingField) return
    const targetTab = getTabForField(nextMissingField)
    if (targetTab !== activeTab) {
      setActiveTab(targetTab)
    } else {
      // Já estamos neste tab — saltar para o próximo missing, se houver.
      const fallback = requiredFields.find(f => !f.filled && getTabForField(f.field) !== activeTab)
      if (fallback) setActiveTab(getTabForField(fallback.field))
    }
  }

  // Apply prefill data locally on mount (no DB write)
  useEffect(() => {
    if (draftCreated.current) return
    draftCreated.current = true

    if (draftId) {
      // Resume existing draft — load saved data from DB
      const loadDraft = async () => {
        try {
          const res = await fetch(`/api/acquisitions/${draftId}`)
          if (!res.ok) throw new Error('Erro ao carregar rascunho')
          const data = await res.json()

          setProcInstanceId(data.proc_instance_id)
          setPropertyId(data.property_id)
          // Avisar o dialog que já há rascunho activo (para o prompt
          // "guardar/descartar" no fecho).
          onDraftCreated?.(data.proc_instance_id)

          const fd = data.formData
          const currentValues = form.getValues()
          const merged = { ...currentValues } as Record<string, unknown>
          for (const [key, value] of Object.entries(fd)) {
            if (value !== undefined && value !== null) {
              merged[key] = value
            }
          }
          form.reset(merged as any)
        } catch (error) {
          console.error('Erro na inicialização:', error)
          toast.error('Erro ao carregar rascunho')
        } finally {
          setIsInitializing(false)
        }
      }
      loadDraft()
    } else if (prefillData) {
      // New form with prefill — apply to form locally only
      const currentValues = form.getValues()
      const merged = { ...currentValues } as Record<string, unknown>
      for (const [key, value] of Object.entries(prefillData)) {
        if (value !== undefined && value !== null) {
          merged[key] = value
        }
      }
      form.reset(merged as any)
    }
  }, [draftId, prefillData, negocioId, form])

  // Create draft in DB (called lazily on first save/submit). Uses a singleton
  // promise ref so that concurrent callers (autosave + manual save) reuse the
  // same in-flight POST instead of racing into two drafts.
  const ensureDraft = useCallback(async (): Promise<{ procId: string; propId: string }> => {
    if (procInstanceId && propertyId) {
      return { procId: procInstanceId, propId: propertyId }
    }
    if (draftPromiseRef.current) {
      return draftPromiseRef.current
    }

    draftPromiseRef.current = (async () => {
      try {
        const values = form.getValues()
        const res = await fetch('/api/acquisitions/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prefillData: {
              title: values.title || prefillData?.title,
              property_type: values.property_type || prefillData?.property_type,
              business_type: values.business_type || prefillData?.business_type,
              listing_price: values.listing_price || prefillData?.listing_price,
              description: values.description || prefillData?.description,
              property_condition: values.property_condition || prefillData?.property_condition,
              city: values.city || prefillData?.city,
              zone: values.zone || prefillData?.zone,
              specifications: values.specifications || prefillData?.specifications,
            },
            negocioId: effectiveNegocioId || null,
          }),
        })
        if (!res.ok) throw new Error('Erro ao criar rascunho')
        const data = await res.json()
        setProcInstanceId(data.proc_instance_id)
        setPropertyId(data.property_id)
        onDraftCreated?.(data.proc_instance_id)
        return { procId: data.proc_instance_id, propId: data.property_id }
      } catch (err) {
        // Clear so a retry can re-attempt.
        draftPromiseRef.current = null
        throw err
      }
    })()
    return draftPromiseRef.current
  }, [procInstanceId, propertyId, form, prefillData, effectiveNegocioId, onDraftCreated])

  // Save step data to API
  const saveStep = useCallback(
    async (stepNumber: number, procId: string) => {
      const values = form.getValues()
      let stepData: Record<string, any> = {}

      switch (stepNumber) {
        case 1:
          stepData = {
            title: values.title,
            property_type: values.property_type,
            business_type: values.business_type,
            listing_price: values.listing_price,
            description: values.description,
            property_condition: values.property_condition,
            energy_certificate: values.energy_certificate,
            specifications: values.specifications,
          }
          break
        case 2:
          stepData = {
            address_street: values.address_street,
            city: values.city,
            address_parish: values.address_parish,
            postal_code: values.postal_code,
            zone: values.zone,
            latitude: values.latitude,
            longitude: values.longitude,
          }
          break
        case 3:
          stepData = { owners: values.owners }
          break
        case 4:
          stepData = {
            contract_regime: values.contract_regime,
            commission_agreed: values.commission_agreed,
            commission_type: values.commission_type,
            contract_term: values.contract_term,
            contract_term_custom_reason: values.contract_term_custom_reason ?? null,
            contract_expiry: values.contract_expiry,
            imi_value: values.imi_value,
            condominium_fee: values.condominium_fee,
            internal_notes: values.internal_notes,
          }
          break
        case 5:
          stepData = { documents: values.documents }
          break
      }

      const res = await fetch(`/api/acquisitions/${procId}/step/${stepNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stepData),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error(`Erro ao guardar step ${stepNumber}:`, err)
        throw new Error(`Erro no passo ${stepNumber}: ${err.error || 'erro desconhecido'}`)
      }
    },
    [form]
  )

  // Save all steps to DB
  const saveAllSteps = useCallback(
    async (procId: string) => {
      for (let i = 1; i <= 5; i++) {
        await saveStep(i, procId)
      }
    },
    [saveStep]
  )

  // Mark autosave-ready in a microtask after init completes — this lets any
  // synchronous form.reset() (loadDraft / prefill) inside the init useEffect
  // settle before we start treating watch events as user input.
  useEffect(() => {
    if (isInitializing) return
    queueMicrotask(() => { autosaveReadyRef.current = true })
  }, [isInitializing])

  // Auto-save: assim que o consultor começa a preencher, criamos o rascunho
  // (lazy via ensureDraft) e gravamos com debounce 1.5s. Aceitamos qualquer
  // watch event com `name` definido (RHF emite `name` em setValue e em onChange
  // de inputs registados; reset emite sem `name`). O ref `autosaveReadyRef`
  // protege contra resets programáticos que ocorram fora do isInitializing.
  useEffect(() => {
    if (isInitializing) return
    if (isSubmitting) return

    const subscription = form.watch((_values, info) => {
      if (!info.name) return
      if (!autosaveReadyRef.current) return

      // Primeira edição do consultor — sinalizar ao dialog antes mesmo do save
      // resolver, para que o prompt de fecho funcione mesmo se o utilizador
      // sair em <1.5s.
      if (!userEditedRef.current) {
        userEditedRef.current = true
        onUserFirstEdit?.()
      }

      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = setTimeout(async () => {
        try {
          setIsAutoSaving(true)
          const { procId } = await ensureDraft()
          await saveAllSteps(procId)
          setLastAutoSaveAt(new Date())
        } catch (err) {
          // Falhas de autosave são silenciosas — o utilizador pode sempre
          // re-tentar editando outro campo.
          console.error('[acquisition-form-v2] autosave failed:', err)
        } finally {
          setIsAutoSaving(false)
        }
      }, 1500)
    })

    return () => {
      subscription.unsubscribe()
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [form, isInitializing, isSubmitting, ensureDraft, saveAllSteps, onUserFirstEdit])

  // Expose imperative actions to the parent dialog so it can flush or discard
  // from the close-confirmation prompt. We re-register on every render where
  // a relevant dependency changes — the parent stores it in a ref and only
  // calls into the latest version.
  useEffect(() => {
    if (!onRegisterActions) return
    onRegisterActions({
      flushSave: async () => {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current)
          autosaveTimerRef.current = null
        }
        if (!userEditedRef.current && !procInstanceId) return
        try {
          setIsAutoSaving(true)
          const { procId } = await ensureDraft()
          await saveAllSteps(procId)
          setLastAutoSaveAt(new Date())
        } finally {
          setIsAutoSaving(false)
        }
      },
      discard: async () => {
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current)
          autosaveTimerRef.current = null
        }
        // Se já tínhamos o draft em DB, o caller (dialog) trata do DELETE
        // via /api/acquisitions/[id] — aqui apenas paramos qualquer save
        // pendente. Se um save está in-flight, ele resolverá com sucesso
        // e o DELETE depois apaga a linha — semanticamente OK.
      },
    })
  }, [onRegisterActions, procInstanceId, ensureDraft, saveAllSteps])

  const handleSubmit = async () => {
    // Validate all fields
    // Manual validation of required fields (Zod resolver can't handle File objects and extra keys)
    const values = form.getValues()
    const missing: string[] = []

    if (!values.title?.trim()) missing.push('Título')
    if (!values.property_type) missing.push('Tipo de imóvel')
    if (!values.business_type) missing.push('Tipo de negócio')
    if (!values.listing_price || values.listing_price <= 0) missing.push('Preço')
    if (!values.address_street?.trim()) missing.push('Morada')
    if (!values.city?.trim()) missing.push('Cidade')
    if (!values.contract_regime) missing.push('Regime contratual')
    if (!values.commission_agreed || values.commission_agreed <= 0) missing.push('Comissão')

    const ownersArr = values.owners || []
    if (ownersArr.length === 0) {
      missing.push('Proprietários (mín. 1)')
    } else {
      ownersArr.forEach((o: any, idx: number) => {
        if (!o.name?.trim()) missing.push(`Proprietário ${idx + 1}: nome`)
        if (!o.phone?.trim()) missing.push(`Proprietário ${idx + 1}: telemóvel`)
      })
    }

    if (missing.length > 0) {
      toast.error(`Campos em falta: ${missing.join(', ')}`)
      return
    }

    setIsSubmitting(true)
    try {
      // Normalizar numéricos: campo vazio (null) -> 0 nos campos onde o
      // domínio exige um número (quartos, casas de banho, áreas, lugares).
      // construction_year mantém null — ano em branco é semanticamente
      // diferente de "ano 0".
      const specs = (form.getValues('specifications') as any) || {}
      form.setValue('specifications', {
        ...specs,
        bedrooms: specs.bedrooms ?? 0,
        bathrooms: specs.bathrooms ?? 0,
        area_gross: specs.area_gross ?? 0,
        area_util: specs.area_util ?? 0,
        parking_spaces: specs.parking_spaces ?? 0,
        garage_spaces: specs.garage_spaces ?? 0,
      })

      // Create draft if it doesn't exist yet, then save all steps
      const { procId, propId } = await ensureDraft()
      await saveAllSteps(procId)

      // Upload pending files
      const documents = form.getValues('documents') || []
      const pendingFiles: Array<{ file: File; doc_type_id: string; owner_index?: number }> = []
      for (const doc of documents) {
        if (doc.file instanceof File) {
          pendingFiles.push({
            file: doc.file,
            doc_type_id: doc.doc_type_id,
            owner_index: doc.owner_index,
          })
        }
      }

      if (pendingFiles.length > 0) {
        let uploaded = 0
        for (const pending of pendingFiles) {
          setUploadProgress(`A carregar documentos... (${uploaded + 1}/${pendingFiles.length})`)
          try {
            const formData = new FormData()
            formData.append('file', pending.file)
            formData.append('doc_type_id', pending.doc_type_id)
            formData.append('property_id', propId)
            const uploadRes = await fetch('/api/documents/upload', {
              method: 'POST',
              body: formData,
            })
            if (uploadRes.ok) uploaded++
          } catch (err) {
            console.error('Erro no upload:', err)
          }
        }
      }

      // Finalize the draft
      const res = await fetch(`/api/acquisitions/${procId}/finalize`, {
        method: 'POST',
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Erro ao finalizar angariação')
      }

      toast.success('Angariação submetida com sucesso!')

      if (onComplete) {
        onComplete(procId)
      } else {
        router.push(`/dashboard/processos/${procId}`)
      }
    } catch (error: any) {
      console.error('Erro no submit:', error)
      toast.error(error.message || 'Erro ao criar angariação')
    } finally {
      setIsSubmitting(false)
      setUploadProgress(null)
    }
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center py-12 flex-1">
        <Spinner variant="infinite" size={32} className="text-muted-foreground" />
      </div>
    )
  }

  // Banner reutilizado entre standalone e dialog modes.
  // Banner "É de um negócio existente?" foi removido — o passo intro trata
  // dessa decisão e mostra um chip discreto quando há um negócio ligado.
  // Mantemos apenas a confirmação visual (sem CTA de re-escolher) acima do
  // form para o consultor saber sempre o que está vinculado.
  const linkBanner = isStandaloneCtx && pickedNegocio ? (
    <div className="rounded-2xl px-4 py-2.5 border border-border/40 bg-card/60 flex items-center gap-2 flex-wrap">
      <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">Vinculado a</span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-background border border-border/60 px-2.5 py-1 text-xs font-medium">
        <Link2 className="h-3 w-3 text-muted-foreground" />
        {linkedLabel}
      </span>
      <button
        type="button"
        onClick={clearPickedNegocio}
        className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline ml-auto"
      >
        Limpar
      </button>
    </div>
  ) : null

  // Step counter — current tab index (1-based) and total
  const currentStepIndex = Math.max(0, TABS.findIndex((t) => t.value === activeTab))
  const stepLabel = `Passo ${currentStepIndex + 1}/${TABS.length}`
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === TABS.length - 1
  const goPrev = () => {
    const prev = Math.max(0, currentStepIndex - 1)
    setActiveTab(TABS[prev].value)
  }
  const goNext = () => {
    const next = Math.min(TABS.length - 1, currentStepIndex + 1)
    setActiveTab(TABS[next].value)
  }

  // Standalone mode (full page)
  if (mode === 'standalone') {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <AcquisitionQuickFill form={form} open={quickFillOpen} onOpenChange={setQuickFillOpen} />
            {linkBanner}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3">
              <div className="px-1 py-2">
                <StepperHeader
                  steps={TABS}
                  activeIndex={currentStepIndex}
                  onStepClick={setActiveTab}
                />
              </div>
              <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 sm:p-5">
                <div className="flex justify-end mb-3">
                  <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {stepLabel}
                  </span>
                </div>
                <TabsContent value="intro" className="mt-0">
                  <StepIntro
                    hasLinkedNegocio={!!negocioId}
                    originChoice={originChoice}
                    pickedNegocioName={pickedNegocio?.lead?.full_name || pickedNegocio?.lead?.nome || null}
                    onChooseFresh={() => {
                      setOriginChoice('fresh')
                      goNext()
                    }}
                    onChooseOpportunity={() => setOriginChoice('opportunity')}
                    onChooseDrafts={() => setOriginChoice('draft')}
                    onResetChoice={() => setOriginChoice(null)}
                    onPickNegocio={applyPickedNegocio}
                    onResumeDraft={handleResumeDraft}
                    drafts={savedDrafts}
                    onDraftDeleted={handleDraftDeleted}
                    onContinue={goNext}
                  />
                </TabsContent>
                <TabsContent value="property" className="mt-0"><StepProperty form={form} /></TabsContent>
                <TabsContent value="location" className="mt-0"><StepLocation form={form} /></TabsContent>
                <TabsContent value="owners" className="mt-0"><StepOwners form={form} /></TabsContent>
                <TabsContent value="description" className="mt-0"><StepDescription form={form} /></TabsContent>
                <TabsContent value="contract" className="mt-0"><StepContract form={form} /></TabsContent>
                <TabsContent value="documents" className="mt-0"><StepDocuments form={form} /></TabsContent>
              </div>
            </Tabs>
            <div className="flex justify-center items-center gap-3 flex-wrap relative">
              {missingCount > 0 ? (
                <button
                  type="button"
                  onClick={handleJumpToNextMissing}
                  className="absolute left-0 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium px-3 py-1.5 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors cursor-pointer"
                  title="Ir para o próximo campo em falta"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{missingCount}</span>
                  <span>{' '}campo{missingCount > 1 ? 's' : ''} em falta</span>
                </button>
              ) : (isAutoSaving || lastAutoSaveAt) ? (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  {isAutoSaving ? (
                    <>
                      <Spinner variant="infinite" size={12} />
                      <span>A guardar…</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Rascunho guardado</span>
                    </>
                  )}
                </span>
              ) : null}

              {/* Anterior — esquerda. Escondido no primeiro passo. */}
              <Button
                type="button"
                variant="ghost"
                onClick={goPrev}
                disabled={isFirstStep}
                className={cn(
                  'rounded-full gap-1.5 h-10 px-4 text-sm',
                  isFirstStep && 'invisible',
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>

              {/* Centro — Seguinte (passos intermédios) ou Fazer pedido (último). */}
              {isLastStep ? (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canSubmit}
                  className={cn(
                    'rounded-full font-semibold gap-2 px-8 h-12 text-base shadow-md transition-all',
                    canSubmit && !isSubmitting && missingCount === 0 && 'animate-pulse-cta',
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Spinner variant="infinite" size={18} />
                      {uploadProgress || 'A enviar…'}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Fazer pedido
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={goNext}
                  className="rounded-full gap-1.5 h-12 px-7 text-base shadow-md"
                >
                  Seguinte
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </Form>
        <NegocioPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          title="Escolher negócio existente"
          description="Pré-preenche tipo, valor e tipo de imóvel a partir do negócio."
          filterTipos={['Vendedor', 'Senhorio', 'Venda', 'Arrendador']}
          onSelect={applyPickedNegocio}
        />
      </div>
    )
  }

  // Dialog (Sheet) mode
  return (
    <Form {...form}>
      <form onSubmit={(e) => e.preventDefault()} className="flex flex-col h-full overflow-hidden">
        <AcquisitionQuickFill form={form} open={quickFillOpen} onOpenChange={setQuickFillOpen} />

        {/* Glass header — matches feedback dialog's design language */}
        <div className="px-6 pt-6 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Briefcase className="h-5 w-5" />
                {draftId ? 'Retomar Angariação' : 'Nova Angariação'}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickFillOpen(true)}
                className="rounded-full h-8 text-xs gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Preencher com IA</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Fechar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Banner de oportunidade vinculada — só aparece DEPOIS de escolhida.
            A pergunta "é de uma oportunidade existente?" vive agora no passo
            intro, por isso o card no topo desapareceu. */}
        {isStandaloneCtx && pickedNegocio && (
          <div className="shrink-0 px-6 pt-3">
            <div className="rounded-2xl bg-card border border-border/40 shadow-sm px-4 py-2.5 flex items-center gap-2 flex-wrap">
              <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Vinculado a</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                <Link2 className="h-3 w-3 text-muted-foreground" />
                {linkedLabel}
              </span>
              <button
                type="button"
                onClick={clearPickedNegocio}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline ml-auto"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* Content with pill tabs + white card wrapper for each tab */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full gap-0">
            {/* Stepper — círculos numerados ligados; substitui as pill tabs. */}
            <div className="flex-shrink-0 px-6 pt-4 pb-2">
              <StepperHeader
                steps={TABS}
                activeIndex={currentStepIndex}
                onStepClick={setActiveTab}
              />
            </div>

            {/* Tab content — wrapped in a white card with step counter inside */}
            <div className="flex-1 overflow-y-auto px-6 pt-2 pb-5">
              <div className="rounded-2xl bg-card border border-border/50 shadow-sm p-4 sm:p-5">
                <div className="flex justify-end mb-3">
                  <span className="inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
                    {stepLabel}
                  </span>
                </div>
                <TabsContent value="intro" className="mt-0">
                  <StepIntro
                    hasLinkedNegocio={!!negocioId}
                    originChoice={originChoice}
                    pickedNegocioName={pickedNegocio?.lead?.full_name || pickedNegocio?.lead?.nome || null}
                    onChooseFresh={() => {
                      setOriginChoice('fresh')
                      goNext()
                    }}
                    onChooseOpportunity={() => setOriginChoice('opportunity')}
                    onChooseDrafts={() => setOriginChoice('draft')}
                    onResetChoice={() => setOriginChoice(null)}
                    onPickNegocio={applyPickedNegocio}
                    onResumeDraft={handleResumeDraft}
                    drafts={savedDrafts}
                    onDraftDeleted={handleDraftDeleted}
                    onContinue={goNext}
                  />
                </TabsContent>
                <TabsContent value="property" className="mt-0"><StepProperty form={form} /></TabsContent>
                <TabsContent value="location" className="mt-0"><StepLocation form={form} /></TabsContent>
                <TabsContent value="owners" className="mt-0"><StepOwners form={form} /></TabsContent>
                <TabsContent value="description" className="mt-0"><StepDescription form={form} /></TabsContent>
                <TabsContent value="contract" className="mt-0"><StepContract form={form} /></TabsContent>
                <TabsContent value="documents" className="mt-0"><StepDocuments form={form} /></TabsContent>
              </div>
            </div>
          </Tabs>
        </div>

        {/* Footer translúcido — auto-save activo, sem botão "Guardar rascunho".
         *  CTA "Fazer pedido" centrado e maior; pulsa subtilmente quando todos
         *  os campos obrigatórios estão preenchidos. */}
        <div className="shrink-0 border-t border-border/40 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md px-6 py-3 flex items-center justify-center gap-3 flex-wrap relative">
          {/* Status de auto-save / campos em falta — alinhado à esquerda */}
          <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden sm:flex items-center">
            {missingCount > 0 ? (
              <button
                type="button"
                onClick={handleJumpToNextMissing}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium px-2.5 py-1 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors cursor-pointer"
                title="Ir para o próximo campo em falta"
              >
                <AlertCircle className="h-3 w-3" />
                <span className="tabular-nums">{missingCount}</span>
                <span>{' '}campo{missingCount > 1 ? 's' : ''} em falta</span>
              </button>
            ) : (isAutoSaving || lastAutoSaveAt) ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {isAutoSaving ? (
                  <>
                    <Spinner variant="infinite" size={10} />
                    <span>A guardar…</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3" />
                    <span>Rascunho guardado</span>
                  </>
                )}
              </span>
            ) : null}
          </div>

          {/* Versão mobile — badge de campos em falta acima do CTA */}
          {missingCount > 0 && (
            <button
              type="button"
              onClick={handleJumpToNextMissing}
              className="sm:hidden inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium px-2.5 py-1 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors w-full justify-center"
            >
              <AlertCircle className="h-3 w-3" />
              <span className="tabular-nums">{missingCount}</span>
              <span>{' '}campo{missingCount > 1 ? 's' : ''} em falta — tocar para ir</span>
            </button>
          )}

          {/* Anterior — esquerda */}
          <Button
            type="button"
            variant="ghost"
            onClick={goPrev}
            disabled={isFirstStep}
            className={cn(
              'rounded-full gap-1.5 h-10 px-4 text-sm',
              isFirstStep && 'invisible',
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          {/* Centro — Seguinte (passos intermédios) ou Fazer pedido (último). */}
          {isLastStep ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !canSubmit}
              className={cn(
                'rounded-full font-semibold gap-2 px-7 h-11 text-sm shadow-md transition-all',
                canSubmit && !isSubmitting && missingCount === 0 && 'animate-pulse-cta',
              )}
            >
              {isSubmitting ? (
                <>
                  <Spinner variant="infinite" size={16} />
                  {uploadProgress || 'A enviar…'}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Fazer pedido
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              className="rounded-full gap-1.5 h-11 px-6 text-sm shadow-md"
            >
              Seguinte
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
      <NegocioPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Escolher oportunidade existente"
        description="Pré-preenche tipo, valor e tipo de imóvel a partir da oportunidade."
        filterTipos={['Venda', 'Arrendador']}
        onSelect={applyPickedNegocio}
      />
    </Form>
  )
}
