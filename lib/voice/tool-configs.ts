import type { useRouter } from 'next/navigation'
import type { VoiceToolName } from './tools'
import type { PropertyCardInput } from '@/lib/email/property-card-html'
import { PARTNER_CATEGORY_COLORS } from '@/lib/constants'
import { setPrefill } from './prefill'

type Router = ReturnType<typeof useRouter>

export type FieldInputType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'textarea'
  | 'select'
  | 'datetime-local'
  /** Dynamic select that fetches the active consultants from /api/users/consultants. */
  | 'consultant-select'

/**
 * Shared vocabulary for lead origin. Keeps UI labels aligned between
 * single-lead and batch flows. Values match the leads_entries.source enum
 * so batch creation is valid server-side without translation.
 */
export const LEAD_SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'social_media', label: 'Redes Sociais' },
  { value: 'website', label: 'Website / Portal' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'partner', label: 'Parceiro' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone_call', label: 'Chamada Telefónica' },
  { value: 'other', label: 'Outro' },
]

export interface FieldConfig {
  key: string
  label: string
  /** Required for submission. Missing required fields are highlighted in red. */
  required?: boolean
  /**
   * If set, this field counts as required only when NO other field in the same
   * group is filled. Use for "one-of" requirements (e.g. telemóvel OR email).
   */
  requiredGroup?: string
  /** Custom display formatter; defaults to String(value). Used only when rendering in read-only mode. */
  format?: (value: unknown) => string
  /** Input type for inline editing. Defaults to 'text'. */
  inputType?: FieldInputType
  /** Options for 'select' inputs. */
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

/**
 * Entity context derived from the current pathname at invocation time.
 * Tools that accept an `entity_type`/`entity_id` link use this to auto-
 * attach notes, tasks, reminders and call logs without the user having
 * to name the entity by voice.
 */
export interface EntityContext {
  type: 'lead' | 'negocio' | 'property' | 'process'
  id: string
  /** Optional display label ("Lead: João Silva") — used for the hint chip. */
  label?: string
}

/** Parse `/dashboard/<module>/<id>` paths into an entity hint. */
export function parseEntityFromPath(pathname: string): EntityContext | null {
  if (!pathname) return null
  const m = pathname.match(
    /^\/dashboard\/(leads|negocios|imoveis|processos)\/([^/?#]+)/
  )
  if (!m) return null
  const [, slug, id] = m
  // Reject "novo" / "templates" / other non-UUID segments.
  if (id === 'novo' || id === 'templates' || id === 'importar') return null
  const map: Record<string, EntityContext['type']> = {
    leads: 'lead',
    negocios: 'negocio',
    imoveis: 'property',
    processos: 'process',
  }
  return { type: map[slug], id }
}

export interface SubmitContext {
  router: Router
  /** Current auth user's ID — filled by the overlay from useUser(). */
  userId?: string
  /** Entity derived from the current URL at submit time, if any. */
  entity?: EntityContext | null
}

export interface VoiceSearchRecipient {
  id: string
  nome: string
  telemovel?: string
  email?: string
  nif?: string
}

export interface VoiceSearchResult {
  id: string
  title: string
  subtitle?: string
  /** URL to open when the card is clicked. */
  url: string
  /** Small meta text (e.g. category, extension, date). */
  meta?: string
  /** Which source surfaced this result — used to tint/label the card. */
  kind?: 'document' | 'design' | 'property' | 'partner' | 'link'
  /**
   * When true the result card shows only an "Abrir" action — email/WhatsApp
   * send buttons are hidden. Used by open_link so Acessos links behave like
   * direct shortcuts, not share-to-contact flows.
   */
  openOnly?: boolean
  /**
   * Pre-resolved recipients to auto-fill the Compose panel. Populated by
   * tools that captured names via voice (e.g. send_property).
   */
  initialRecipients?: VoiceSearchRecipient[]
  /** Optional intro message captured by voice; used as default in Compose. */
  defaultMessage?: string
  /**
   * Rich property-card data (cover image, price, specs). Present only on
   * results of kind 'property' so the multi-send flow can render the
   * Outlook-safe grid via renderPropertyGrid().
   */
  card?: PropertyCardInput
  /**
   * Rich partner-card data — lets the results view paint a card that
   * mirrors the /dashboard/parceiros grid (cover/category hero, recomendado
   * badge, category dot + city + contact person).
   */
  partnerCard?: VoicePartnerCardData
}

export interface VoicePartnerCardData {
  coverImageUrl?: string | null
  isRecommended?: boolean
  categoryLabel: string
  /** Tailwind bg-*, text-*, dot-* classes for the category — matches PARTNER_CATEGORY_COLORS. */
  categoryColor: { bg: string; text: string; dot: string }
  city?: string
  ratingAvg?: number | null
  contactPerson?: string
  /** Partner's own contact info — used by defaultMessage() to compose
   *  "Segue o contacto do nosso parceiro..." when sharing by email/WhatsApp. */
  phone?: string
  phoneSecondary?: string
  email?: string
  website?: string
}

export interface PropertyBasket {
  /** Properties currently in the basket (will all be sent). */
  selected: VoiceSearchResult[]
  /** Alternative matches surfaced from the initial searches. */
  suggestions: VoiceSearchResult[]
  /** Recipients pre-resolved from voice. */
  recipients: VoiceSearchRecipient[]
  /** Optional custom intro/message captured by voice. */
  defaultMessage?: string
}

export interface SubmitResult {
  detailPath?: string
  message?: string
  /**
   * If present, the overlay switches to a results view instead of navigating
   * or closing. Used for search tools like `search_document`.
   */
  results?: VoiceSearchResult[]
  /**
   * If present, the overlay switches to a multi-property basket view.
   * Used by `send_property` when the user wants to send several imóveis.
   */
  basket?: PropertyBasket
  /**
   * If present, the overlay opens the DirectMessagePanel so the user can
   * confirm/adjust + send (or schedule) a message to a single contact.
   * Used by `send_message`.
   */
  directMessage?: DirectMessage
  /**
   * Triggered when the tool can't pin the contact unambiguously (no match
   * or multiple fuzzy hits). The overlay opens a picker with the
   * candidates + live search; on pick we resume the original action.
   */
  contactPicker?: ContactPickerRequest
  /**
   * Opens the AddNotePanel. Resolved contact + the lead's negócios are
   * pre-loaded so the user can pick the scope (contacto vs negócio X).
   */
  leadNote?: LeadNote
  /**
   * Opens the FollowUpPanel. Same contact + negócios pre-load as the
   * note panel; adds channel + due_date + optional description.
   */
  followUp?: FollowUp
  /**
   * Opens the PropertyDescriptionPanel. The panel streams the generated
   * description from the server and lets the user edit + save back to the
   * property. Used by `generate_property_description`.
   */
  propertyDescription?: PropertyDescriptionRequest
  /**
   * Opens the AttachDocumentPanel so the user can snap a photo (mobile) or
   * pick a file and attach it to a resolved imóvel's documents. Used by
   * `attach_document`.
   */
  attachDocument?: AttachDocumentRequest
}

export interface DirectMessage {
  recipient: VoiceSearchRecipient
  /** Pre-selected channel; user can toggle in the panel. */
  initialChannel: 'whatsapp' | 'email'
  initialMessage: string
  initialSubject?: string
  /** ISO string; when present the panel opens in "scheduled" mode. */
  initialScheduledAt?: string
}

/**
 * Request shape returned when a tool can't resolve a contact deterministically.
 * The overlay renders the picker, and on pick it calls the follow-up flow
 * embedded in `follow` (currently direct-message or note).
 */
export interface ContactPickerRequest {
  /** The free-text term the user originally said (seeds the search input). */
  query: string
  /** Pre-fetched candidates from the initial search. */
  candidates: VoiceSearchRecipient[]
  follow:
    | {
        kind: 'directMessage'
        /** Payload to combine with the picked recipient. */
        partial: Omit<DirectMessage, 'recipient'>
      }
    | {
        kind: 'leadNote'
        /** Payload to combine with the picked contact (negocios fetched on pick). */
        partial: Omit<LeadNote, 'contact' | 'negocios'>
      }
    | {
        kind: 'followUp'
        /** Payload to combine with the picked contact (negocios fetched on pick). */
        partial: Omit<FollowUp, 'contact' | 'negocios'>
      }
}

/** Minimal shape of a negócio surfaced to the scope selector. */
export interface LeadNoteNegocioOption {
  id: string
  label: string
  tipo?: string
  localizacao?: string
}

export interface LeadNote {
  contact: VoiceSearchRecipient
  /** Empty array when the contact has no deals — selector is then hidden. */
  negocios: LeadNoteNegocioOption[]
  initialNote: string
}

export type FollowUpChannel = 'call' | 'whatsapp' | 'email' | 'meeting'

export interface FollowUp {
  contact: VoiceSearchRecipient
  negocios: LeadNoteNegocioOption[]
  /** ISO string; empty when GPT didn't capture a date — user fills on the panel. */
  initialDueDate: string
  /** Defaults to 'call' on the panel when omitted. */
  initialChannel?: FollowUpChannel
  initialNotes?: string
}

export interface PropertyDescriptionRequest {
  propertyId: string
  /** Display info for the card at the top of the panel. */
  title: string
  meta?: string
  /** The existing description stored on the property (to seed the textarea
   *  AND to be passed as "improve existing" context if the user opts for it). */
  currentDescription: string
  /** Tone passed to the generate endpoint on first load. */
  tone?: 'professional' | 'premium' | 'cozy'
  /** Optional notes captured by voice, forwarded to the endpoint. */
  additionalNotes?: string
}

export interface AttachDocumentDocType {
  id: string
  name: string
  /** comma-separated like "pdf,jpg,png" — the panel turns this into an
   *  accept="…" attribute on the file input. */
  allowedExtensions: string[]
}

export interface AttachDocumentRequest {
  propertyId: string
  propertyTitle: string
  propertyMeta?: string
  docTypes: AttachDocumentDocType[]
  /** Pre-selected doc_type.id resolved from the voice hint; empty when no
   *  hint was given or no match was found. */
  initialDocTypeId: string
  initialNotes: string
}

export interface ToolConfig {
  title: string
  fields: FieldConfig[]
  /** Label for the submit button, e.g. "Criar contacto". */
  submitLabel: string
  submit: (args: Record<string, any>, ctx: SubmitContext) => Promise<SubmitResult>
  /** Override the default "all required fields filled" submission check. */
  canSubmit?: (args: Record<string, any>) => boolean
  /**
   * When true and the args already satisfy canSubmit, the overlay skips the
   * review screen and calls submit() immediately. Meant for pure search
   * tools (search_document, open_link, search_partner) where the user
   * refines inline on the results screen instead of editing a form first.
   */
  autoSubmit?: boolean
  /**
   * Which field key to surface as an editable search input on the results
   * screen. Only used when `autoSubmit` is true. Typing in that input
   * mutates the args and re-runs submit() debounced.
   */
  searchFieldKey?: string
  /**
   * Optional "save as draft" action — if provided, the overlay shows a
   * secondary button that works even when required fields are still missing.
   */
  draft?: {
    label?: string
    submit: (args: Record<string, any>, ctx: SubmitContext) => Promise<SubmitResult>
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Urgente',
  2: 'Alta',
  3: 'Média',
  4: 'Baixa',
}

function formatPriority(v: unknown): string {
  const n = Number(v)
  return PRIORITY_LABELS[n] ?? String(v)
}

function formatDate(v: unknown): string {
  try {
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return String(v)
    return d.toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(v)
  }
}

function formatEuro(v: unknown): string {
  const n = Number(v)
  if (isNaN(n)) return String(v)
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

// ── Per-tool configs ──────────────────────────────────────────────────────

const createLead: ToolConfig = {
  title: 'Criar contacto',
  submitLabel: 'Criar',
  fields: [
    // Contacto
    { key: 'nome', label: 'Nome', required: true },
    // Telemóvel OU email: pelo menos um tem de estar preenchido
    { key: 'telemovel', label: 'Telemóvel', inputType: 'tel', requiredGroup: 'contact-channel' },
    { key: 'email', label: 'Email', inputType: 'email', requiredGroup: 'contact-channel' },
    { key: 'observacoes', label: 'Notas', inputType: 'textarea' },
    // Negócio inline (opcional — só se negocio_tipo estiver definido)
    {
      key: 'negocio_tipo',
      label: 'Negócio',
      inputType: 'select',
      options: [
        { value: 'Compra', label: 'Compra' },
        { value: 'Venda', label: 'Venda' },
        { value: 'Arrendatário', label: 'Arrendatário' },
        { value: 'Arrendador', label: 'Arrendador' },
      ],
    },
    { key: 'tipo_imovel', label: 'Tipo imóvel' },
    { key: 'localizacao', label: 'Localização' },
    { key: 'orcamento', label: 'Orçamento', inputType: 'number', format: formatEuro },
    { key: 'orcamento_max', label: 'Orçamento máx.', inputType: 'number', format: formatEuro },
    { key: 'quartos_min', label: 'Quartos mín.', inputType: 'number' },
    // Imóvel / angariação específica (opcional). O <PropertyMatchHint> resolve
    // o termo livre contra /api/properties (incluindo external_ref / RE/MAX id).
    { key: 'property_query', label: 'Imóvel (angariação)', placeholder: 'Ex: 103 (sufixo) ou T2 Av. Liberdade' },
    // Atribuição / origem (opcionais — o GPT extrai quando referidos)
    { key: 'origem', label: 'Origem', inputType: 'select', options: LEAD_SOURCE_OPTIONS },
    { key: 'assigned_consultant_id', label: 'Atribuir a', inputType: 'consultant-select' },
  ],
  submit: async (args, { router }) => {
    // 1) Create lead
    const leadPayload: Record<string, unknown> = { nome: args.nome }
    if (args.email) leadPayload.email = args.email
    if (args.telemovel) leadPayload.telemovel = args.telemovel
    if (args.observacoes) leadPayload.observacoes = args.observacoes
    if (args.origem) leadPayload.origem = args.origem
    if (args.assigned_consultant_id) leadPayload.agent_id = args.assigned_consultant_id

    const leadRes = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadPayload),
    })
    if (!leadRes.ok) {
      const err = await leadRes.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao criar contacto')
    }
    const { id: leadId } = await leadRes.json()

    // 2) Optionally create inline negócio. Either the user picked a property
    // (resolved_property_id) — in which case we link it as an angariação and
    // default to "Compra" when no explicit tipo was said — or they referred a
    // negocio_tipo without a specific property.
    const resolvedPropertyId = args.resolved_property_id ? String(args.resolved_property_id) : ''
    const hasProperty = Boolean(resolvedPropertyId)
    const tipo = args.negocio_tipo || (hasProperty ? 'Compra' : null)

    let negocioCreated = false
    if (tipo) {
      const negocioPayload: Record<string, unknown> = {
        lead_id: leadId,
        tipo,
      }
      if (resolvedPropertyId) negocioPayload.property_id = resolvedPropertyId
      if (args.tipo_imovel) negocioPayload.tipo_imovel = args.tipo_imovel
      if (args.localizacao) negocioPayload.localizacao = args.localizacao
      if (args.orcamento !== undefined && args.orcamento !== '') {
        negocioPayload.orcamento = Number(args.orcamento)
      }
      if (args.orcamento_max !== undefined && args.orcamento_max !== '') {
        negocioPayload.orcamento_max = Number(args.orcamento_max)
      }
      if (args.quartos_min !== undefined && args.quartos_min !== '') {
        negocioPayload.quartos_min = Number(args.quartos_min)
      }

      const negRes = await fetch('/api/negocios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(negocioPayload),
      })
      if (negRes.ok) {
        negocioCreated = true
      }
      // If negócio fails we keep the lead and let the user fix it from the
      // detail page — better partial success than losing the contact data.
    }

    const path = `/dashboard/leads/${leadId}`
    router.push(path)
    const message = negocioCreated
      ? hasProperty
        ? 'Contacto criado e ligado à angariação'
        : 'Contacto e negócio criados'
      : 'Contacto criado'
    return { detailPath: path, message }
  },
}

const createTodo: ToolConfig = {
  title: 'Criar tarefa',
  submitLabel: 'Criar tarefa',
  fields: [
    { key: 'title', label: 'Título', required: true },
    { key: 'description', label: 'Descrição', inputType: 'textarea' },
    {
      key: 'priority',
      label: 'Prioridade',
      inputType: 'select',
      options: [
        { value: '1', label: 'Urgente' },
        { value: '2', label: 'Alta' },
        { value: '3', label: 'Média' },
        { value: '4', label: 'Baixa' },
      ],
      format: formatPriority,
    },
    { key: 'due_date', label: 'Prazo', inputType: 'datetime-local', format: formatDate },
  ],
  submit: async (args, { router, entity }) => {
    const payload: Record<string, unknown> = { title: args.title }
    if (args.description) payload.description = args.description
    if (args.priority !== undefined && args.priority !== '') payload.priority = Number(args.priority)
    if (args.due_date) payload.due_date = args.due_date
    // Auto-link to the entity surfaced by the current URL (e.g. /leads/[id])
    // so "lembra-me de ligar amanhã" said on a lead page attaches to that lead.
    if (entity) {
      payload.entity_type = entity.type
      payload.entity_id = entity.id
    }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao criar tarefa')
    }
    router.push('/dashboard/tarefas')
    return { detailPath: '/dashboard/tarefas', message: 'Tarefa criada' }
  },
}

const createReminder: ToolConfig = {
  title: 'Criar lembrete',
  submitLabel: 'Criar lembrete',
  fields: [
    { key: 'title', label: 'Título', required: true },
    { key: 'due_date', label: 'Quando', required: true, inputType: 'datetime-local', format: formatDate },
  ],
  submit: async (args, { router, entity }) => {
    const payload: Record<string, unknown> = { title: args.title }
    if (args.due_date) payload.due_date = args.due_date
    if (entity) {
      payload.entity_type = entity.type
      payload.entity_id = entity.id
    }

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao criar lembrete')
    }
    router.push('/dashboard/tarefas')
    return { detailPath: '/dashboard/tarefas', message: 'Lembrete criado' }
  },
}

// Builds a payload for /api/acquisitions from voice args. Includes a minimal
// single-owner array — user can add more in the full dialog if needed.
function buildAcquisitionPayload(args: Record<string, any>, full: boolean) {
  const specs: Record<string, unknown> = {}
  if (args.typology) specs.typology = String(args.typology)
  if (args.bedrooms !== undefined && args.bedrooms !== '') specs.bedrooms = Number(args.bedrooms)
  if (args.bathrooms !== undefined && args.bathrooms !== '') specs.bathrooms = Number(args.bathrooms)
  if (args.area_util !== undefined && args.area_util !== '') specs.area_util = Number(args.area_util)
  if (args.area_gross !== undefined && args.area_gross !== '') specs.area_gross = Number(args.area_gross)
  if (args.parking_spaces !== undefined && args.parking_spaces !== '') specs.parking_spaces = Number(args.parking_spaces)

  const payload: Record<string, unknown> = {
    title: args.title,
    property_type: args.property_type,
    business_type: args.business_type,
    listing_price: args.listing_price !== undefined && args.listing_price !== ''
      ? Number(args.listing_price)
      : undefined,
    description: args.description,
    property_condition: args.property_condition,
    energy_certificate: args.energy_certificate,
    address_street: args.address_street,
    address_parish: args.address_parish,
    city: args.city,
    zone: args.zone,
    postal_code: args.postal_code,
    contract_regime: args.contract_regime,
    commission_agreed:
      args.commission_agreed !== undefined && args.commission_agreed !== ''
        ? Number(args.commission_agreed)
        : undefined,
    commission_type: 'percentage',
  }
  if (Object.keys(specs).length > 0) payload.specifications = specs

  if (full) {
    // The full-creation endpoint requires at least one owner with name + phone.
    if (args.main_owner_name || args.main_owner_phone) {
      payload.owners = [
        {
          person_type: 'singular',
          name: String(args.main_owner_name || '').trim(),
          phone: String(args.main_owner_phone || '').trim(),
          email: args.main_owner_email ? String(args.main_owner_email).trim() : undefined,
          nif: args.main_owner_nif ? String(args.main_owner_nif).trim() : undefined,
          ownership_percentage: 100,
          is_main_contact: true,
        },
      ]
    }
  }

  return payload
}

// Nova angariação: overlay IS the form — all mandatory scalar fields rendered
// inline, editable by voice or keyboard, directly POSTs to /api/acquisitions
// on submit or /api/acquisitions/draft on "Guardar rascunho".
const createAngariacao: ToolConfig = {
  title: 'Pedido de angariação',
  submitLabel: 'Criar angariação',
  fields: [
    // Imóvel
    { key: 'title', label: 'Título', required: true, placeholder: 'Ex: Apartamento T3 em Lisboa' },
    {
      key: 'property_type',
      label: 'Tipo',
      required: true,
      inputType: 'select',
      options: [
        { value: 'Apartamento', label: 'Apartamento' },
        { value: 'Moradia', label: 'Moradia' },
        { value: 'Terreno', label: 'Terreno' },
        { value: 'Loja', label: 'Loja' },
        { value: 'Escritório', label: 'Escritório' },
        { value: 'Armazém', label: 'Armazém' },
        { value: 'Garagem', label: 'Garagem' },
        { value: 'Quintinha', label: 'Quintinha' },
        { value: 'Outro', label: 'Outro' },
      ],
    },
    {
      key: 'business_type',
      label: 'Negócio',
      required: true,
      inputType: 'select',
      options: [
        { value: 'venda', label: 'Venda' },
        { value: 'arrendamento', label: 'Arrendamento' },
        { value: 'trespasse', label: 'Trespasse' },
      ],
    },
    { key: 'listing_price', label: 'Preço', required: true, inputType: 'number', format: formatEuro },
    // Especificações — todas obrigatórias
    { key: 'typology', label: 'Tipologia', required: true, placeholder: 'T1, T2, T3, …' },
    { key: 'bedrooms', label: 'Quartos', required: true, inputType: 'number' },
    { key: 'bathrooms', label: 'WC', required: true, inputType: 'number' },
    { key: 'area_util', label: 'Área útil (m²)', required: true, inputType: 'number' },
    { key: 'area_gross', label: 'Área bruta (m²)', required: true, inputType: 'number' },
    { key: 'parking_spaces', label: 'Estacionamento', required: true, inputType: 'number' },
    // Localização
    { key: 'address_street', label: 'Morada', required: true },
    { key: 'city', label: 'Cidade', required: true },
    { key: 'zone', label: 'Zona', required: true },
    { key: 'postal_code', label: 'Cód. postal', required: true },
    { key: 'address_parish', label: 'Freguesia', required: true },
    // Estado/energia
    {
      key: 'property_condition',
      label: 'Estado',
      required: true,
      inputType: 'select',
      options: [
        { value: 'new', label: 'Novo' },
        { value: 'used', label: 'Usado' },
        { value: 'under_construction', label: 'Em construção' },
        { value: 'to_renovate', label: 'Para renovar' },
        { value: 'renovated', label: 'Renovado' },
        { value: 'ruin', label: 'Ruína' },
      ],
    },
    {
      key: 'energy_certificate',
      label: 'Certificado energ.',
      required: true,
      inputType: 'select',
      options: ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F', 'Isento'].map((v) => ({ value: v, label: v })),
    },
    // Proprietário principal — todos obrigatórios
    { key: 'main_owner_name', label: 'Proprietário', required: true, placeholder: 'Nome do proprietário' },
    { key: 'main_owner_phone', label: 'Telemóvel prop.', required: true, inputType: 'tel' },
    { key: 'main_owner_email', label: 'Email prop.', required: true, inputType: 'email' },
    { key: 'main_owner_nif', label: 'NIF prop.', required: true },
    // Contrato
    {
      key: 'contract_regime',
      label: 'Regime',
      required: true,
      inputType: 'select',
      options: [
        { value: 'exclusivo', label: 'Exclusivo' },
        { value: 'semi_exclusivo', label: 'Semi-exclusivo' },
        { value: 'aberto', label: 'Aberto' },
      ],
    },
    { key: 'commission_agreed', label: 'Comissão (%)', required: true, inputType: 'number' },
  ],
  submit: async (args, { router }) => {
    // Quando o utilizador escolheu um negócio existente no picker, usamos a
    // rota de draft (única que aceita `negocioId`) para preservar o link e
    // mandamos o utilizador para o resume do diálogo, exactamente como o
    // form-v2 faz no fluxo standalone com picker.
    if (args.negocio_id) {
      const prefillData = buildAcquisitionPayload(args, false)
      const res = await fetch('/api/acquisitions/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefillData, negocioId: args.negocio_id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao criar angariação')
      }
      const { proc_instance_id } = await res.json()
      const path = proc_instance_id
        ? `/dashboard/processos?resume=${proc_instance_id}`
        : '/dashboard/processos'
      router.push(path)
      return { detailPath: path, message: 'Angariação vinculada ao negócio' }
    }

    const payload = buildAcquisitionPayload(args, true)
    const res = await fetch('/api/acquisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao criar angariação')
    }
    const out = await res.json()
    const procId = out?.proc_instance_id || out?.id
    const path = procId ? `/dashboard/processos/${procId}` : '/dashboard/processos'
    router.push(path)
    return { detailPath: path, message: 'Angariação criada' }
  },
  draft: {
    label: 'Guardar rascunho',
    submit: async (args, { router }) => {
      const prefillData = buildAcquisitionPayload(args, false)
      const res = await fetch('/api/acquisitions/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefillData,
          negocioId: args.negocio_id || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao guardar rascunho')
      }
      const { proc_instance_id } = await res.json()
      const path = proc_instance_id
        ? `/dashboard/processos?resume=${proc_instance_id}`
        : '/dashboard/processos'
      router.push(path)
      return { detailPath: path, message: 'Rascunho guardado' }
    },
  },
}

// Pedido de fecho de negócio. A UI final do fecho vive no DealDialog (multi-step);
// o overlay captura tudo que o utilizador disser e oferece duas saídas:
//  - Submit: posta para /api/deals (cria deal em estado 'draft') e abre o diálogo
//    com draftId para o utilizador completar os passos restantes;
//  - Guardar rascunho: idêntico, mas mantém o utilizador no ecrã de rascunhos.
/**
 * Achata o prefill produzido por `buildAcquisitionPrefillFromNegocio` para o
 * shape de args plano que o overlay de voz usa em `create_angariacao`. Os
 * campos do owner principal viram `main_owner_*` e as specs sobem ao topo.
 *
 * Devolve apenas as chaves preenchidas — o caller faz `{...prev, ...delta}`
 * para preservar o que o utilizador já tinha ditado.
 */
export function buildAngariacaoArgsFromPrefill(
  prefill: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = {}
  const direct = [
    'title',
    'property_type',
    'business_type',
    'listing_price',
    'description',
    'property_condition',
    'city',
    'zone',
  ]
  for (const k of direct) {
    if (prefill[k] !== undefined && prefill[k] !== null && prefill[k] !== '') out[k] = prefill[k]
  }
  const specs = prefill.specifications || {}
  const specMap: Record<string, string> = {
    typology: 'typology',
    bedrooms: 'bedrooms',
    bathrooms: 'bathrooms',
    area_util: 'area_util',
    area_gross: 'area_gross',
    parking_spaces: 'parking_spaces',
  }
  for (const [src, dst] of Object.entries(specMap)) {
    const v = specs[src]
    if (v !== undefined && v !== null && v !== '' && v !== 0) out[dst] = v
  }
  const owner = Array.isArray(prefill.owners) && prefill.owners.length > 0 ? prefill.owners[0] : null
  if (owner) {
    if (owner.name) out.main_owner_name = owner.name
    if (owner.phone) out.main_owner_phone = owner.phone
    if (owner.email) out.main_owner_email = owner.email
    if (owner.nif) out.main_owner_nif = owner.nif
  }
  return out
}

/** Mapeia um negócio do picker para os args do overlay de `create_fecho`. */
export function buildFechoArgsFromNegocio(n: {
  tipo?: string | null
  preco_venda?: number | null
  orcamento_max?: number | null
  orcamento?: number | null
  renda_pretendida?: number | null
  renda_max_mensal?: number | null
  tipo_imovel?: string | null
  localizacao?: string | null
  lead?: { full_name?: string | null; nome?: string | null } | null
}): Record<string, any> {
  const tipo = n.tipo || ''
  const isArrendatario = tipo === 'Arrendatário' || tipo === 'Arrendador'
  const businessType = isArrendatario ? 'arrendamento' : 'venda'
  const dealValue =
    n.preco_venda ?? n.orcamento_max ?? n.orcamento ?? n.renda_pretendida ?? n.renda_max_mensal ?? null
  const out: Record<string, any> = { business_type: businessType }
  if (typeof dealValue === 'number' && dealValue > 0) out.deal_value = dealValue
  const clientName = n.lead?.full_name || n.lead?.nome || ''
  if (clientName) out.client_name = clientName
  const propertyTitleParts: string[] = []
  if (n.tipo_imovel) propertyTitleParts.push(n.tipo_imovel)
  if (n.localizacao) {
    const firstLoc = n.localizacao.split(',').map((s) => s.trim()).filter(Boolean)[0]
    if (firstLoc) propertyTitleParts.push(firstLoc)
  }
  const propertyTitle = propertyTitleParts.join(' em ')
  if (propertyTitle) out.property_title = propertyTitle
  return out
}

function buildDealPayload(args: Record<string, any>) {
  const payload: Record<string, unknown> = {
    scenario: args.scenario || 'pleno',
  }
  if (args.negocio_id) payload.negocio_id = args.negocio_id
  if (args.external_consultant_name) payload.external_consultant_name = args.external_consultant_name
  if (args.external_consultant_phone) payload.external_consultant_phone = args.external_consultant_phone
  if (args.external_consultant_email) payload.external_consultant_email = args.external_consultant_email
  if (args.partner_agency_name) payload.partner_agency_name = args.partner_agency_name
  if (args.external_property_link) payload.external_property_link = args.external_property_link
  if (args.share_notes) payload.share_notes = args.share_notes
  return payload
}

const createFecho: ToolConfig = {
  title: 'Pedido de fecho de negócio',
  submitLabel: 'Criar fecho',
  fields: [
    {
      key: 'scenario',
      label: 'Cenário',
      required: true,
      inputType: 'select',
      options: [
        { value: 'pleno', label: 'Pleno (angariação + comprador)' },
        { value: 'comprador_externo', label: 'Apenas comprador' },
        { value: 'pleno_agencia', label: 'Pleno (agência)' },
        { value: 'angariacao_externa', label: 'Apenas angariação' },
      ],
    },
    {
      key: 'business_type',
      label: 'Negócio',
      required: true,
      inputType: 'select',
      options: [
        { value: 'venda', label: 'Venda' },
        { value: 'arrendamento', label: 'Arrendamento' },
        { value: 'trespasse', label: 'Trespasse' },
      ],
    },
    { key: 'deal_value', label: 'Valor do negócio', required: true, inputType: 'number', format: formatEuro },
    { key: 'property_title', label: 'Imóvel (ref.)', required: true },
    { key: 'client_name', label: 'Cliente', required: true },
    { key: 'partner_agency_name', label: 'Agência parceira', required: true },
    { key: 'external_consultant_name', label: 'Consultor externo', required: true },
    { key: 'external_consultant_phone', label: 'Tel. externo', required: true, inputType: 'tel' },
    { key: 'external_consultant_email', label: 'Email externo', required: true, inputType: 'email' },
    { key: 'external_property_link', label: 'Link do anúncio', required: true },
    { key: 'observacoes', label: 'Notas', required: true, inputType: 'textarea' },
  ],
  submit: async (args, { router }) => {
    const payload = buildDealPayload(args)
    const res = await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao criar fecho')
    }
    const { id } = await res.json()
    const path = `/dashboard/deals/${id}`
    router.push(path)
    return { detailPath: path, message: 'Fecho criado' }
  },
  draft: {
    label: 'Guardar rascunho',
    submit: async (args, { router }) => {
      const payload = buildDealPayload(args)
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || 'Falha ao guardar rascunho')
      }
      router.push('/dashboard/processos')
      return { detailPath: '/dashboard/processos', message: 'Rascunho guardado' }
    },
  },
}

// ── Call logging ─────────────────────────────────────────────────────────

const createCallLog: ToolConfig = {
  title: 'Registar chamada',
  submitLabel: 'Registar chamada',
  fields: [
    { key: 'contact_name', label: 'Contacto', required: true },
    {
      key: 'direction',
      label: 'Direcção',
      required: true,
      inputType: 'select',
      options: [
        { value: 'outbound', label: 'Fui eu que liguei' },
        { value: 'inbound', label: 'Recebi a chamada' },
      ],
    },
    {
      key: 'outcome',
      label: 'Resultado',
      required: true,
      inputType: 'select',
      options: [
        { value: 'success', label: 'Atendeu / falámos' },
        { value: 'no_answer', label: 'Não atendeu' },
        { value: 'busy', label: 'Linha ocupada' },
        { value: 'voicemail', label: 'Voicemail' },
        { value: 'failed', label: 'Falhou' },
      ],
    },
    { key: 'notes', label: 'Notas', inputType: 'textarea' },
  ],
  canSubmit: (args) => {
    // contact_name is only strictly required when we have no entity context —
    // the overlay injects entity={type:'lead',id} when invoked on /leads/[id],
    // so the submit can short-circuit by id and skip the name lookup.
    if (!args.direction || !args.outcome) return false
    return true
  },
  submit: async (args, { router, entity }) => {
    const name = String(args.contact_name ?? '').trim()

    let contactId: string | null = null
    let displayName = name
    let exact = true

    if (entity?.type === 'lead') {
      // On a lead page → use the entity directly, skip the name lookup.
      contactId = entity.id
    } else {
      if (!name) throw new Error('Contacto em falta')
      const lookup = await fetch(`/api/leads?nome=${encodeURIComponent(name)}&limit=3`)
      if (!lookup.ok) throw new Error('Falha ao procurar contacto')
      const ldata = await lookup.json()
      const list: any[] = Array.isArray(ldata) ? ldata : ldata?.data || []
      if (list.length === 0) {
        throw new Error(`Contacto "${name}" não encontrado. Cria-o primeiro.`)
      }
      const exactMatch = list.find(
        (l) => String(l.nome ?? '').trim().toLowerCase() === name.toLowerCase()
      )
      const match = exactMatch || list[0]
      contactId = String(match.id)
      displayName = match.nome
      exact = Boolean(exactMatch)
    }

    const res = await fetch(`/api/crm/contacts/${contactId}/call-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome: args.outcome,
        direction: args.direction,
        notes: args.notes || undefined,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao registar chamada')
    }

    const path = `/dashboard/leads/${contactId}`
    router.push(path)
    return {
      detailPath: path,
      message: `Chamada registada${exact || entity?.type === 'lead' ? '' : ` (${displayName})`}`,
    }
  },
}

// ── Visit scheduling ─────────────────────────────────────────────────────

const createVisit: ToolConfig = {
  title: 'Marcar visita',
  submitLabel: 'Marcar visita',
  fields: [
    { key: 'property_query', label: 'Imóvel', required: true, placeholder: 'Título, referência, zona…' },
    { key: 'contact_name', label: 'Cliente', required: true },
    { key: 'client_phone', label: 'Telemóvel', inputType: 'tel' },
    { key: 'client_email', label: 'Email', inputType: 'email' },
    { key: 'visit_datetime', label: 'Data/hora', required: true, inputType: 'datetime-local' },
    { key: 'duration_minutes', label: 'Duração (min)', inputType: 'number' },
    { key: 'notes', label: 'Notas', inputType: 'textarea' },
  ],
  canSubmit: (args) => {
    return Boolean(
      args.property_query &&
        args.contact_name &&
        args.visit_datetime
    )
  },
  submit: async (args, { router, userId }) => {
    if (!userId) throw new Error('Utilizador actual não identificado')

    // Resolve property — prefer the id the user adopted during review, fall
    // back to re-searching by property_query if none was picked.
    let propertyId: string | undefined = args.resolved_property_id
      ? String(args.resolved_property_id)
      : undefined
    if (!propertyId) {
      const q = String(args.property_query ?? '').trim()
      const propsRes = await fetch(
        `/api/properties?search=${encodeURIComponent(q)}&per_page=3`
      )
      if (!propsRes.ok) throw new Error('Falha ao procurar imóvel')
      const pdata = await propsRes.json()
      const plist: any[] = Array.isArray(pdata?.data) ? pdata.data : []
      if (plist.length === 0) {
        throw new Error(`Imóvel "${q}" não encontrado.`)
      }
      propertyId = String(plist[0].id)
    }

    // Resolve contact — prefer adopted id, fall back to name lookup. If still
    // nothing we send client_name as a free-text fallback.
    const contactName = String(args.contact_name ?? '').trim()
    let lead_id: string | undefined = args.resolved_lead_id
      ? String(args.resolved_lead_id)
      : undefined
    let fallbackClientName: string | undefined = lead_id ? undefined : contactName
    if (!lead_id && contactName) {
      const lres = await fetch(
        `/api/leads?nome=${encodeURIComponent(contactName)}&limit=3`
      )
      if (lres.ok) {
        const ldata = await lres.json()
        const llist: any[] = Array.isArray(ldata) ? ldata : ldata?.data || []
        const match =
          llist.find(
            (l) => String(l.nome ?? '').trim().toLowerCase() === contactName.toLowerCase()
          ) || llist[0]
        if (match) {
          lead_id = String(match.id)
          fallbackClientName = undefined
        }
      }
    }

    // Split ISO into date + time
    const dt = String(args.visit_datetime ?? '')
    const [datePart, timePartRaw] = dt.split('T')
    const timePart = (timePartRaw || '').slice(0, 5) // HH:MM
    if (!datePart || !timePart) {
      throw new Error('Data/hora inválida')
    }

    const payload: Record<string, unknown> = {
      property_id: propertyId,
      consultant_id: userId,
      visit_date: datePart,
      visit_time: timePart,
    }
    if (lead_id) payload.lead_id = lead_id
    if (fallbackClientName) payload.client_name = fallbackClientName
    if (args.client_phone) payload.client_phone = String(args.client_phone).trim()
    if (args.client_email) payload.client_email = String(args.client_email).trim()
    if (args.duration_minutes !== undefined && args.duration_minutes !== '') {
      payload.duration_minutes = Number(args.duration_minutes)
    }
    if (args.notes) payload.notes = String(args.notes).trim()

    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao marcar visita')
    }
    const out = await res.json()
    const status = out?.data?.status || 'scheduled'

    const path = '/dashboard/calendario'
    router.push(path)
    return {
      detailPath: path,
      message:
        status === 'proposal'
          ? 'Proposta de visita enviada ao consultor'
          : 'Visita marcada',
    }
  },
}

// ── Send property ────────────────────────────────────────────────────────
//
// Voice: "enviar imóvel T3 em Lisboa ao João Silva por email"
//   → resolve property (first match) + resolve recipients (by name)
//   → return as a VoiceSearchResult so the ResultsPanel shows the property
//     card with Email / WhatsApp send buttons pre-wired.
//   → ComposePanel opens with the resolved recipients pre-selected, default
//     message already tailored for properties, and the public property link
//     already in the body.

const PUBLIC_WEBSITE_URL =
  process.env.NEXT_PUBLIC_WEBSITE_URL?.replace(/\/+$/, '') || 'https://infinitygroup.pt'

function buildPublicPropertyUrl(slug: string): string {
  return `${PUBLIC_WEBSITE_URL}/property/${slug}`
}

// Shared helper so UI code can format prices without duplicating Intl config.
export function formatEuroPt(v: unknown): string {
  const n = Number(v)
  if (isNaN(n)) return ''
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

/** Build a single basket-ready property card from a /api/properties row. */
export function propertyRowToResult(p: any): VoiceSearchResult {
  const slug = String(p.slug || p.id)
  const url = buildPublicPropertyUrl(slug)
  const metaParts = [
    formatEuroPt(p.listing_price),
    p.city || p.zone,
    p.external_ref,
  ].filter(Boolean)

  // Rich card for renderPropertyGrid — cover image + primary specs.
  const specs = Array.isArray(p.dev_property_specifications)
    ? p.dev_property_specifications[0]
    : p.dev_property_specifications
  const mediaList = Array.isArray(p.dev_property_media)
    ? [...p.dev_property_media].sort(
        (a, b) => (a.order_index ?? 999) - (b.order_index ?? 999)
      )
    : []
  const cover = mediaList.find((m) => m.is_cover) ?? mediaList[0]
  const specParts: string[] = []
  if (specs?.bedrooms) specParts.push(`${specs.bedrooms} quartos`)
  if (specs?.area_util) specParts.push(`${specs.area_util} m²`)
  const location = [p.city, p.zone].filter(Boolean).join(' · ')

  return {
    id: `property:${p.id}`,
    title: String(p.title || 'Imóvel'),
    subtitle: p.address_street ? String(p.address_street) : undefined,
    url,
    meta: metaParts.join(' · ') || undefined,
    kind: 'property',
    card: {
      title: String(p.title || 'Imóvel'),
      priceLabel: formatEuroPt(p.listing_price),
      location,
      specs: specParts.join(' · '),
      imageUrl: cover?.url ?? null,
      href: url,
      reference: p.external_ref ?? null,
    },
  }
}

// Direct message to a contact (WhatsApp or email, immediate or scheduled).
// Resolves the contact by name and hands off to DirectMessagePanel so the
// user tweaks + confirms before dispatch.
const sendMessage: ToolConfig = {
  title: 'Enviar mensagem',
  submitLabel: 'Preparar envio',
  autoSubmit: true,
  fields: [
    { key: 'contact_name', label: 'Destinatário', required: true },
    {
      key: 'channel',
      label: 'Canal',
      inputType: 'select',
      options: [
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'email', label: 'Email' },
      ],
    },
    { key: 'subject', label: 'Assunto (email)' },
    { key: 'message', label: 'Mensagem', inputType: 'textarea' },
    { key: 'scheduled_at', label: 'Agendar para', inputType: 'datetime-local', format: formatDate },
  ],
  canSubmit: (args) => Boolean(String(args.contact_name ?? '').trim()),
  submit: async (args) => {
    const name = String(args.contact_name ?? '').trim()
    if (!name) throw new Error('Indica o destinatário')

    const res = await fetch(`/api/leads?nome=${encodeURIComponent(name)}&limit=10`)
    if (!res.ok) throw new Error('Falha ao procurar contacto')
    const data = await res.json()
    const list: any[] = Array.isArray(data) ? data : data?.data || []

    const candidates: VoiceSearchRecipient[] = list.map((l: any) => ({
      id: String(l.id),
      nome: String(l.nome ?? ''),
      email: l.email ? String(l.email) : undefined,
      telemovel: l.telemovel ? String(l.telemovel) : undefined,
      nif: l.nif ? String(l.nif) : undefined,
    }))

    // Channel resolution (shared by picker + direct path)
    const voiceChannel = String(args.channel ?? '').trim().toLowerCase()
    const resolveChannel = (r: VoiceSearchRecipient): 'whatsapp' | 'email' => {
      if (voiceChannel === 'email' || voiceChannel === 'whatsapp') {
        return voiceChannel as 'whatsapp' | 'email'
      }
      return r.telemovel ? 'whatsapp' : r.email ? 'email' : 'whatsapp'
    }

    const partial: Omit<DirectMessage, 'recipient'> = {
      initialChannel: 'whatsapp', // refined below when recipient is known
      initialMessage: args.message ? String(args.message) : '',
      initialSubject: args.subject ? String(args.subject) : undefined,
      initialScheduledAt: args.scheduled_at ? String(args.scheduled_at) : undefined,
    }

    const needle = name.toLowerCase()
    const exactMatches = candidates.filter((r) => r.nome.toLowerCase() === needle)

    // Only auto-adopt on an EXACT full-name match. Fuzzy/substring hits
    // always go through the picker so the user confirms we picked the
    // right person — "Maria" shouldn't silently bind to "Maria Silva".
    if (exactMatches.length === 1) {
      const r = exactMatches[0]
      return {
        directMessage: { recipient: r, ...partial, initialChannel: resolveChannel(r) },
      }
    }

    // No exact match OR multiple exact matches → picker. If there are
    // multiple exact matches we surface only those; otherwise show the
    // fuzzy candidates so the user can confirm.
    return {
      contactPicker: {
        query: name,
        candidates: exactMatches.length > 1 ? exactMatches : candidates,
        follow: { kind: 'directMessage', partial },
      },
    }
  },
}

// Shared helper: fetches the negócios attached to a lead and normalises
// them into the compact shape the AddNotePanel scope selector expects.
async function fetchLeadNegocios(leadId: string): Promise<LeadNoteNegocioOption[]> {
  try {
    const res = await fetch(`/api/negocios?lead_id=${encodeURIComponent(leadId)}&limit=20`)
    if (!res.ok) return []
    const d = await res.json()
    const list: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
    return list.map((n: any) => {
      const tipo = n.tipo ? String(n.tipo) : undefined
      const loc = n.localizacao ? String(n.localizacao) : undefined
      const tipoImovel = n.tipo_imovel ? String(n.tipo_imovel) : undefined
      const parts = [tipoImovel || tipo, loc].filter(Boolean)
      return {
        id: String(n.id),
        label: parts.join(' · ') || 'Negócio',
        tipo,
        localizacao: loc,
      }
    })
  } catch {
    return []
  }
}

// Add a note to a lead's activity history. Resolves the contact (with the
// same fuzzy/picker flow as send_message) and pre-fetches the lead's
// negócios so the user can optionally scope the note to a specific deal.
const addLeadNote: ToolConfig = {
  title: 'Adicionar nota',
  submitLabel: 'Preparar nota',
  autoSubmit: true,
  fields: [
    { key: 'contact_name', label: 'Contacto', required: true },
    { key: 'note', label: 'Nota', required: true, inputType: 'textarea' },
  ],
  canSubmit: (args) =>
    Boolean(String(args.contact_name ?? '').trim()) &&
    Boolean(String(args.note ?? '').trim()),
  submit: async (args) => {
    const name = String(args.contact_name ?? '').trim()
    const note = String(args.note ?? '').trim()
    if (!name) throw new Error('Indica o contacto')
    if (!note) throw new Error('Indica o conteúdo da nota')

    const res = await fetch(`/api/leads?nome=${encodeURIComponent(name)}&limit=10`)
    if (!res.ok) throw new Error('Falha ao procurar contacto')
    const data = await res.json()
    const list: any[] = Array.isArray(data) ? data : data?.data || []

    const candidates: VoiceSearchRecipient[] = list.map((l: any) => ({
      id: String(l.id),
      nome: String(l.nome ?? ''),
      email: l.email ? String(l.email) : undefined,
      telemovel: l.telemovel ? String(l.telemovel) : undefined,
      nif: l.nif ? String(l.nif) : undefined,
    }))

    const needle = name.toLowerCase()
    const exactMatches = candidates.filter((r) => r.nome.toLowerCase() === needle)

    const buildResult = async (contact: VoiceSearchRecipient): Promise<SubmitResult> => {
      const negocios = await fetchLeadNegocios(contact.id)
      return { leadNote: { contact, negocios, initialNote: note } }
    }

    // Only auto-adopt on an EXACT full-name match. Anything else goes to
    // the picker so the user explicitly confirms which "Maria" or "João".
    if (exactMatches.length === 1) {
      return buildResult(exactMatches[0])
    }
    return {
      contactPicker: {
        query: name,
        candidates: exactMatches.length > 1 ? exactMatches : candidates,
        follow: {
          kind: 'leadNote',
          partial: { initialNote: note },
        },
      },
    }
  },
}

// Attach a document (usually a photo taken on mobile) to a property. The
// panel handles the actual upload via FormData to /api/documents/upload;
// this submit just resolves the imóvel + fetches doc types + pre-selects
// one when the voice hint matches.
const attachDocument: ToolConfig = {
  title: 'Anexar documento',
  submitLabel: 'Preparar upload',
  autoSubmit: true,
  fields: [
    { key: 'property_query', label: 'Imóvel', required: true },
    { key: 'doc_type_hint', label: 'Tipo' },
    { key: 'notes', label: 'Notas', inputType: 'textarea' },
  ],
  canSubmit: (args) => Boolean(String(args.property_query ?? '').trim()),
  submit: async (args) => {
    const q = String(args.property_query ?? '').trim()
    if (!q) throw new Error('Indica o imóvel')

    const [propRes, typeRes] = await Promise.all([
      fetch(`/api/properties?search=${encodeURIComponent(q)}&per_page=5`),
      fetch('/api/libraries/doc-types?applies_to=properties'),
    ])
    if (!propRes.ok) throw new Error('Falha ao procurar imóvel')
    const propData = await propRes.json()
    const propList: any[] = Array.isArray(propData?.data) ? propData.data : []
    if (propList.length === 0) {
      throw new Error(`Imóvel "${q}" não encontrado.`)
    }
    const needle = q.toLowerCase()
    const property =
      propList.find((p: any) => String(p.external_ref ?? '').toLowerCase() === needle) ||
      propList.find((p: any) => String(p.title ?? '').toLowerCase() === needle) ||
      propList[0]

    let docTypes: AttachDocumentDocType[] = []
    if (typeRes.ok) {
      const d = await typeRes.json()
      const raw: any[] = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []
      docTypes = raw
        .filter((t: any) => t && t.id && t.name)
        .map((t: any) => ({
          id: String(t.id),
          name: String(t.name),
          allowedExtensions: Array.isArray(t.allowed_extensions)
            ? t.allowed_extensions.map((e: unknown) => String(e))
            : ['pdf', 'jpg', 'jpeg', 'png'],
        }))
    }

    // Resolve the voice hint to a docType id via substring match.
    const hint = String(args.doc_type_hint ?? '').trim().toLowerCase()
    let initialDocTypeId = ''
    if (hint) {
      const hit =
        docTypes.find((t) => t.name.toLowerCase() === hint) ||
        docTypes.find((t) => t.name.toLowerCase().includes(hint)) ||
        docTypes.find((t) => hint.includes(t.name.toLowerCase()))
      if (hit) initialDocTypeId = hit.id
    }

    const metaParts = [
      formatEuroPt(property.listing_price),
      property.city || property.zone,
      property.external_ref,
    ].filter(Boolean)

    return {
      attachDocument: {
        propertyId: String(property.id),
        propertyTitle: String(property.title || 'Imóvel'),
        propertyMeta: metaParts.join(' · ') || undefined,
        docTypes,
        initialDocTypeId,
        initialNotes: args.notes ? String(args.notes) : '',
      },
    }
  },
}

// Generate a marketing description for a property from its specs.
// Resolves the property by search term, then hands off to
// PropertyDescriptionPanel which streams the GPT output via the existing
// /api/properties/[id]/generate-description endpoint.
const generatePropertyDescription: ToolConfig = {
  title: 'Gerar descrição de imóvel',
  submitLabel: 'Preparar descrição',
  autoSubmit: true,
  fields: [
    { key: 'property_query', label: 'Imóvel', required: true },
    {
      key: 'tone',
      label: 'Tom',
      inputType: 'select',
      options: [
        { value: 'professional', label: 'Profissional' },
        { value: 'premium', label: 'Premium' },
        { value: 'cozy', label: 'Acolhedor' },
      ],
    },
    { key: 'additional_notes', label: 'Notas extra', inputType: 'textarea' },
  ],
  canSubmit: (args) => Boolean(String(args.property_query ?? '').trim()),
  submit: async (args) => {
    const q = String(args.property_query ?? '').trim()
    if (!q) throw new Error('Indica o imóvel')

    const res = await fetch(`/api/properties?search=${encodeURIComponent(q)}&per_page=5`)
    if (!res.ok) throw new Error('Falha ao procurar imóvel')
    const d = await res.json()
    const list: any[] = Array.isArray(d?.data) ? d.data : []
    if (list.length === 0) {
      throw new Error(`Imóvel "${q}" não encontrado.`)
    }
    // Prefer an exact ref match, else first result.
    const needle = q.toLowerCase()
    const pick =
      list.find(
        (p: any) => String(p.external_ref ?? '').toLowerCase() === needle
      ) ||
      list.find(
        (p: any) => String(p.title ?? '').toLowerCase() === needle
      ) ||
      list[0]

    const metaParts = [
      formatEuroPt(pick.listing_price),
      pick.city || pick.zone,
      pick.external_ref,
    ].filter(Boolean)

    const voiceTone = String(args.tone ?? '').trim().toLowerCase()
    const tone: PropertyDescriptionRequest['tone'] =
      voiceTone === 'premium' || voiceTone === 'cozy' || voiceTone === 'professional'
        ? (voiceTone as 'professional' | 'premium' | 'cozy')
        : undefined

    return {
      propertyDescription: {
        propertyId: String(pick.id),
        title: String(pick.title || 'Imóvel'),
        meta: metaParts.join(' · ') || undefined,
        currentDescription: typeof pick.description === 'string' ? pick.description : '',
        tone,
        additionalNotes: args.additional_notes ? String(args.additional_notes) : undefined,
      },
    }
  },
}

// Schedule a follow-up tied to a contact (optionally scoped to a negócio).
// Writes to /api/tasks with entity_type='lead'|'negocio' and a channel prefix
// encoded in the title.
const scheduleFollowUp: ToolConfig = {
  title: 'Agendar follow-up',
  submitLabel: 'Preparar follow-up',
  autoSubmit: true,
  fields: [
    { key: 'contact_name', label: 'Contacto', required: true },
    { key: 'due_date', label: 'Quando', required: true, inputType: 'datetime-local' },
    {
      key: 'channel',
      label: 'Canal',
      inputType: 'select',
      options: [
        { value: 'call', label: 'Chamada' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'email', label: 'Email' },
        { value: 'meeting', label: 'Reunião' },
      ],
    },
    { key: 'notes', label: 'Notas', inputType: 'textarea' },
  ],
  canSubmit: (args) => Boolean(String(args.contact_name ?? '').trim()),
  submit: async (args) => {
    const name = String(args.contact_name ?? '').trim()
    if (!name) throw new Error('Indica o contacto')

    const res = await fetch(`/api/leads?nome=${encodeURIComponent(name)}&limit=10`)
    if (!res.ok) throw new Error('Falha ao procurar contacto')
    const data = await res.json()
    const list: any[] = Array.isArray(data) ? data : data?.data || []

    const candidates: VoiceSearchRecipient[] = list.map((l: any) => ({
      id: String(l.id),
      nome: String(l.nome ?? ''),
      email: l.email ? String(l.email) : undefined,
      telemovel: l.telemovel ? String(l.telemovel) : undefined,
      nif: l.nif ? String(l.nif) : undefined,
    }))

    const voiceChannel = String(args.channel ?? '').trim().toLowerCase()
    const ch: FollowUpChannel | undefined =
      voiceChannel === 'call' ||
      voiceChannel === 'whatsapp' ||
      voiceChannel === 'email' ||
      voiceChannel === 'meeting'
        ? (voiceChannel as FollowUpChannel)
        : undefined

    const partial: Omit<FollowUp, 'contact' | 'negocios'> = {
      initialDueDate: args.due_date ? String(args.due_date) : '',
      initialChannel: ch,
      initialNotes: args.notes ? String(args.notes) : undefined,
    }

    const needle = name.toLowerCase()
    const exactMatches = candidates.filter((r) => r.nome.toLowerCase() === needle)

    const buildResult = async (contact: VoiceSearchRecipient): Promise<SubmitResult> => {
      const negocios = await fetchLeadNegocios(contact.id)
      return { followUp: { contact, negocios, ...partial } }
    }

    // Only auto-adopt on EXACT full-name match; fuzzy/substring hits go to
    // the picker so the user confirms.
    if (exactMatches.length === 1) return buildResult(exactMatches[0])
    return {
      contactPicker: {
        query: name,
        candidates: exactMatches.length > 1 ? exactMatches : candidates,
        follow: { kind: 'followUp', partial },
      },
    }
  },
}

const sendProperty: ToolConfig = {
  title: 'Enviar imóveis',
  submitLabel: 'Procurar e preparar envio',
  fields: [
    {
      key: 'property_queries_text',
      label: 'Imóveis',
      required: true,
      inputType: 'textarea',
      placeholder: 'Um por linha — título, referência ou últimos dígitos',
    },
    {
      key: 'contact_names_text',
      label: 'Destinatários',
      placeholder: 'Nomes separados por vírgulas (opcional)',
    },
    { key: 'message', label: 'Mensagem', inputType: 'textarea' },
  ],
  submit: async (args) => {
    // Normalise queries: voice array > textarea > legacy single field.
    const queriesFromArray: string[] = Array.isArray(args.property_queries)
      ? args.property_queries.map((q: unknown) => String(q).trim()).filter(Boolean)
      : []
    const queriesFromText: string[] = String(args.property_queries_text ?? '')
      .split(/\n|[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
    const legacy = args.property_query ? [String(args.property_query).trim()] : []
    // Text-area value is authoritative once the user has edited it; fall back
    // to the voice-provided array and finally to the legacy single field.
    const queries = queriesFromText.length > 0
      ? queriesFromText
      : queriesFromArray.length > 0
        ? queriesFromArray
        : legacy
    if (queries.length === 0) throw new Error('Indica pelo menos um imóvel')

    // One search per query. Pick best match per query, accumulate alternatives
    // from the other matches as "suggestions" the basket can offer.
    const selected: VoiceSearchResult[] = []
    const suggestions: VoiceSearchResult[] = []
    const seen = new Set<string>()
    const notFound: string[] = []

    for (const q of queries) {
      try {
        const r = await fetch(
          `/api/properties?search=${encodeURIComponent(q)}&per_page=5`
        )
        if (!r.ok) continue
        const d = await r.json()
        const arr: any[] = Array.isArray(d?.data) ? d.data : []
        if (arr.length === 0) {
          notFound.push(q)
          continue
        }
        const [best, ...rest] = arr
        if (best && !seen.has(best.id)) {
          seen.add(best.id)
          selected.push(propertyRowToResult(best))
        }
        for (const alt of rest.slice(0, 2)) {
          if (!seen.has(alt.id)) {
            seen.add(alt.id)
            suggestions.push(propertyRowToResult(alt))
          }
        }
      } catch {
        notFound.push(q)
      }
    }

    if (selected.length === 0) {
      throw new Error(
        notFound.length > 0
          ? `Nenhum imóvel encontrado para: ${notFound.join(', ')}`
          : 'Nenhum imóvel encontrado'
      )
    }

    // Recipient resolution (unchanged behaviour — accepts voice array or
    // comma-separated text).
    const rawNames: string[] = Array.isArray(args.contact_names)
      ? args.contact_names.map((n: unknown) => String(n).trim()).filter(Boolean)
      : String(args.contact_names_text ?? '')
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)

    const recSeen = new Set<string>()
    const recipients: VoiceSearchRecipient[] = []
    for (const name of rawNames) {
      try {
        const r = await fetch(`/api/leads?nome=${encodeURIComponent(name)}&limit=3`)
        if (!r.ok) continue
        const d = await r.json()
        const arr: any[] = Array.isArray(d) ? d : d?.data || []
        const pick =
          arr.find(
            (l) => String(l.nome ?? '').trim().toLowerCase() === name.toLowerCase()
          ) || arr[0]
        if (pick && !recSeen.has(String(pick.id))) {
          recSeen.add(String(pick.id))
          recipients.push({
            id: String(pick.id),
            nome: String(pick.nome ?? ''),
            telemovel: pick.telemovel ? String(pick.telemovel) : undefined,
            email: pick.email ? String(pick.email) : undefined,
            nif: pick.nif ? String(pick.nif) : undefined,
          })
        }
      } catch {
        // ignore individual lookup failures
      }
    }

    const parts: string[] = [
      `${selected.length} imóv${selected.length !== 1 ? 'eis' : 'el'} encontrado${selected.length !== 1 ? 's' : ''}`,
    ]
    if (notFound.length > 0) parts.push(`sem resultado: ${notFound.join(', ')}`)

    return {
      basket: {
        selected,
        suggestions,
        recipients,
        defaultMessage: args.message ? String(args.message).trim() || undefined : undefined,
      },
      message: parts.join(' · '),
    }
  },
}

const searchDocument: ToolConfig = {
  title: 'Procurar documentos e designs',
  submitLabel: 'Procurar',
  autoSubmit: true,
  searchFieldKey: 'query',
  fields: [
    { key: 'query', label: 'Termo', required: true },
  ],
  submit: async (args) => {
    const q = String(args.query || '').trim()
    if (!q) {
      return { results: [], message: 'Sem termo de pesquisa' }
    }

    // Parallel fetch: corporate docs + team marketing designs.
    // design-templates doesn't accept `search`, so we filter client-side.
    const [docsRes, designsRes] = await Promise.all([
      fetch(`/api/company-documents?search=${encodeURIComponent(q)}`).catch(() => null),
      fetch(`/api/marketing/design-templates?team=true`).catch(() => null),
    ])

    const toArray = async (res: Response | null): Promise<any[]> => {
      if (!res || !res.ok) return []
      try {
        const raw = await res.json()
        return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
      } catch {
        return []
      }
    }

    const [docs, designs] = await Promise.all([toArray(docsRes), toArray(designsRes)])
    const needle = q.toLowerCase()

    const docResults: VoiceSearchResult[] = docs.slice(0, 6).map((r) => {
      const ext = r.file_extension ? String(r.file_extension).toUpperCase() : null
      const category = r.category ? String(r.category) : null
      const meta = ['Documento', ext, category].filter(Boolean).join(' · ')
      return {
        id: `doc:${r.id}`,
        title: String(r.name || r.file_name || 'Documento'),
        subtitle: r.description ? String(r.description) : undefined,
        url: String(r.file_path || ''),
        meta,
        kind: 'document',
      }
    })

    const designResults: VoiceSearchResult[] = designs
      .filter((d) => {
        const hay = [d.name, d.description, d.category, d.subcategory]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
      .slice(0, 6)
      .map((d) => {
        const url = String(d.canva_url || d.file_url || '')
        const meta = ['Design', d.category, d.subcategory].filter(Boolean).join(' · ')
        return {
          id: `design:${d.id}`,
          title: String(d.name || 'Design'),
          subtitle: d.description ? String(d.description) : undefined,
          url,
          meta,
          kind: 'design',
        }
      })

    const results = [...docResults, ...designResults]
    return {
      results,
      message: results.length
        ? `${results.length} resultado${results.length !== 1 ? 's' : ''}`
        : 'Sem resultados',
    }
  },
}

// Static category list for the review-screen dropdown. Mirrors
// PARTNER_CATEGORY_OPTIONS in lib/constants.ts — duplicated here so the
// voice module stays free of UI-only dependencies.
const PARTNER_CATEGORY_VOICE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'supplier', label: 'Fornecedor' },
  { value: 'lawyer', label: 'Advogado' },
  { value: 'notary', label: 'Notário' },
  { value: 'bank', label: 'Banco' },
  { value: 'photographer', label: 'Fotógrafo' },
  { value: 'constructor', label: 'Empreiteiro' },
  { value: 'insurance', label: 'Seguros' },
  { value: 'energy_cert', label: 'Cert. Energética' },
  { value: 'cleaning', label: 'Limpezas' },
  { value: 'moving', label: 'Mudanças' },
  { value: 'appraiser', label: 'Avaliador' },
  { value: 'architect', label: 'Arquitecto' },
  { value: 'home_staging', label: 'Home Staging' },
  { value: 'credit_broker', label: 'Interm. Crédito' },
  { value: 'interior_design', label: 'Design Interior' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Outro' },
]
const PARTNER_CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PARTNER_CATEGORY_VOICE_OPTIONS.map((o) => [o.value, o.label])
)

const searchPartner: ToolConfig = {
  title: 'Procurar parceiro',
  submitLabel: 'Procurar',
  autoSubmit: true,
  searchFieldKey: 'name_query',
  fields: [
    {
      key: 'name_query',
      label: 'Nome / termo',
      placeholder: 'Nome, pessoa, cidade, NIF (opcional)',
    },
    {
      key: 'category',
      label: 'Categoria',
      inputType: 'select',
      options: PARTNER_CATEGORY_VOICE_OPTIONS,
    },
  ],
  // Must have at least one of name_query or category — enforced here so
  // the submit button stays disabled until the user (or voice) provides one.
  canSubmit: (args) => {
    const hasName = Boolean(String(args.name_query ?? '').trim())
    const hasCategory = Boolean(String(args.category ?? '').trim())
    return hasName || hasCategory
  },
  submit: async (args) => {
    const name = String(args.name_query ?? '').trim()
    const rawCategory = String(args.category ?? '').trim()
    if (!name && !rawCategory) throw new Error('Indica um nome ou uma categoria')

    // Resolve the free-form category string to a real slug from the
    // dynamic catalogue in partner_categories. This catches:
    //  - custom categories the admin added via the dialog (e.g. "Canalizador")
    //  - PT labels ("Advogado" → slug "lawyer")
    //  - slugs passed through verbatim
    // If nothing matches, demote the term to the name/city search so we
    // still return results instead of a dead filter.
    let resolvedSlug = ''
    let demotedCategoryAsSearch: string | null = null
    if (rawCategory) {
      try {
        const catRes = await fetch('/api/partners/categories')
        if (catRes.ok) {
          const catJson = await catRes.json()
          const cats: any[] = Array.isArray(catJson?.data) ? catJson.data : []
          const needle = rawCategory.toLowerCase()
          // 1) exact slug match
          const slugHit = cats.find((c) => String(c.slug).toLowerCase() === needle)
          if (slugHit) {
            resolvedSlug = String(slugHit.slug)
          } else {
            // 2) label contains needle OR needle contains label (handles
            // "advogado" vs "Advogados" and singular/plural variants).
            const labelHit =
              cats.find((c) => String(c.label).toLowerCase() === needle) ||
              cats.find((c) => String(c.label).toLowerCase().includes(needle)) ||
              cats.find((c) => needle.includes(String(c.label).toLowerCase()))
            if (labelHit) {
              resolvedSlug = String(labelHit.slug)
            } else {
              demotedCategoryAsSearch = rawCategory
            }
          }
        }
      } catch {
        // ignore — we'll demote to search below
        demotedCategoryAsSearch = rawCategory
      }
    }

    const params = new URLSearchParams()
    // Combine name_query with the demoted category term when applicable.
    const searchTerm = [name, demotedCategoryAsSearch].filter(Boolean).join(' ').trim()
    if (searchTerm) params.set('search', searchTerm)
    if (resolvedSlug) params.set('category', resolvedSlug)
    params.set('is_active', 'true')
    params.set('limit', '10')

    const res = await fetch(`/api/partners?${params.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao procurar parceiros')
    }
    const json = await res.json()
    const list: any[] = Array.isArray(json?.data) ? json.data : []

    // Fallback colours when a partner sits outside the known category map.
    const FALLBACK_COLOR = { bg: 'bg-slate-500/15', text: 'text-slate-600', dot: 'bg-slate-500' }

    const results: VoiceSearchResult[] = list.map((p: any) => {
      const catLabel = PARTNER_CATEGORY_LABEL_MAP[p.category] || 'Parceiro'
      const catColor = PARTNER_CATEGORY_COLORS[p.category] || FALLBACK_COLOR
      const metaParts = [
        catLabel,
        p.is_recommended ? '★ Recomendado' : null,
        p.city || null,
        p.phone || null,
      ].filter(Boolean)
      const hasContact = Boolean(p.email || p.phone)
      return {
        id: `partner:${p.id}`,
        title: String(p.name || 'Parceiro'),
        subtitle: p.contact_person ? `Contacto: ${p.contact_person}` : undefined,
        // Opens the listing page with the detail sheet auto-expanded via
        // the ?partner= query param (replaces the old /[id] page).
        url: `/dashboard/parceiros?partner=${p.id}`,
        meta: metaParts.join(' · ') || undefined,
        kind: 'partner',
        partnerCard: {
          coverImageUrl: p.cover_image_url ? String(p.cover_image_url) : null,
          isRecommended: Boolean(p.is_recommended),
          categoryLabel: catLabel,
          categoryColor: catColor,
          city: p.city ? String(p.city) : undefined,
          ratingAvg: typeof p.rating_avg === 'number' ? p.rating_avg : null,
          contactPerson: p.contact_person ? String(p.contact_person) : undefined,
          phone: p.phone ? String(p.phone) : undefined,
          phoneSecondary: p.phone_secondary ? String(p.phone_secondary) : undefined,
          email: p.email ? String(p.email) : undefined,
          website: p.website ? String(p.website) : undefined,
        },
        initialRecipients: hasContact
          ? [
              {
                id: String(p.id),
                nome: String(p.name ?? ''),
                email: p.email ? String(p.email) : undefined,
                telemovel: p.phone ? String(p.phone) : undefined,
              },
            ]
          : undefined,
      }
    })

    const summary = [
      resolvedSlug
        ? PARTNER_CATEGORY_LABEL_MAP[resolvedSlug] || resolvedSlug
        : rawCategory || null,
      name ? `"${name}"` : null,
    ]
      .filter(Boolean)
      .join(' ')

    return {
      results,
      message: results.length
        ? `${results.length} parceiro${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`
        : `Nenhum parceiro para ${summary || 'esta pesquisa'}`,
    }
  },
}

// ── Quick-open links (Acessos page shortcuts) ────────────────────────────
//
// Static catalog mirrors the hardcoded atalhos/websites in
// app/dashboard/acessos/page.tsx. At runtime we also merge the dynamic
// acessos_custom_sites and user_links tables so every link that appears in
// the Acessos page is reachable by voice.
//
// Each entry gets a list of `aliases` so common variations (e.g. "chat gpt"
// vs "chatgpt") all score the same query.

type StaticAcessosLink = {
  id: string
  title: string
  url: string
  section: string
  aliases?: string[]
}

const STATIC_ACESSOS_LINKS: StaticAcessosLink[] = [
  // Atalhos RE/MAX
  { id: 'remax-maxwork', title: 'MaxWork', url: 'https://app.maxwork.pt/home', section: 'RE/MAX', aliases: ['max work'] },
  { id: 'remax-contactos', title: 'Contactos RE/MAX', url: 'https://app.maxwork.pt/contact/list', section: 'RE/MAX' },
  { id: 'remax-site', title: 'Imóveis RE/MAX', url: 'https://remax.pt/pt', section: 'RE/MAX', aliases: ['remax site', 'site remax'] },
  { id: 'remax-convictus', title: 'Convictus', url: 'https://remax.pt/pt/comprar/imoveis/h/r/r/r/t?s=%7B%22of%22%3A%2212149%22%2C%22nm%22%3A%22RE%2FMAX%20ConviCtus%22%2C%22os%22%3A%22false%22%7D&p=1&o=-PublishDate', section: 'RE/MAX' },
  // Portais imobiliários
  { id: 'portal-idealista', title: 'Idealista', url: 'https://www.idealista.pt/', section: 'Portais' },
  { id: 'portal-casayes', title: 'CasaYes', url: 'https://casayes.pt/pt', section: 'Portais' },
  { id: 'portal-imovirtual', title: 'ImoVirtual', url: 'https://www.imovirtual.com/', section: 'Portais', aliases: ['imo virtual'] },
  // Notícias
  { id: 'news-ci', title: 'Confidencial Imobiliário', url: 'https://www.confidencialimobiliario.com/novidades/', section: 'Notícias', aliases: ['ci', 'confidencial'] },
  { id: 'news-idealista', title: 'Idealista News', url: 'https://www.idealista.pt/news/', section: 'Notícias' },
  { id: 'news-eco', title: 'Eco Sapo Imobiliário', url: 'https://eco.sapo.pt/topico/imobiliario/', section: 'Notícias', aliases: ['eco sapo'] },
  // Websites
  { id: 'web-microsir', title: 'MicroSIR', url: 'https://sir.confidencialimobiliario.com/', section: 'Websites', aliases: ['sir', 'micro sir'] },
  { id: 'web-casafari', title: 'Casafari', url: 'https://pt.casafari.com/login?next=%2Faccount%2Fstarting-page', section: 'Websites' },
]

/** Simple token-based scorer: query tokens that hit title+aliases bump rank. */
function scoreLink(query: string, title: string, aliases: string[] = []): number {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const hay = [title, ...aliases].join(' ').toLowerCase()
  if (hay === q) return 1000
  if (hay.startsWith(q) || title.toLowerCase().startsWith(q)) return 800
  if (hay.includes(q)) return 600
  const qTokens = q.split(/\s+/).filter(Boolean)
  let tokenScore = 0
  for (const t of qTokens) {
    if (hay.includes(t)) tokenScore += 100
  }
  return tokenScore
}

const openLink: ToolConfig = {
  title: 'Abrir link',
  submitLabel: 'Procurar',
  autoSubmit: true,
  searchFieldKey: 'query',
  fields: [
    {
      key: 'query',
      label: 'Nome',
      required: true,
      placeholder: 'Ex: canva, idealista, maxwork…',
    },
  ],
  submit: async (args) => {
    const q = String(args.query ?? '').trim()
    if (!q) throw new Error('Indica o nome do link')

    // Single dynamic source: custom sites from Acessos > Websites > Outros
    // (global sites from admins + personal sites per user). The separate
    // "Os Meus Links" tab was retired in favour of this unified surface.
    const customRes = await fetch('/api/acessos/custom-sites').catch(() => null)

    const toArray = async (res: Response | null): Promise<any[]> => {
      if (!res || !res.ok) return []
      try {
        const raw = await res.json()
        return Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []
      } catch {
        return []
      }
    }

    const customSites = await toArray(customRes)

    type CandidateLink = {
      id: string
      title: string
      url: string
      section: string
      aliases?: string[]
    }

    const candidates: CandidateLink[] = [
      ...STATIC_ACESSOS_LINKS,
      ...customSites.map((s: any) => ({
        id: `custom:${s.id}`,
        title: String(s.title || 'Site'),
        url: String(s.url || ''),
        section: s.scope === 'personal' ? 'Os Meus Sites' : 'Outros Sites',
      })),
    ].filter((c) => c.url && c.title)

    // Score + sort
    const scored = candidates
      .map((c) => ({ c, score: scoreLink(q, c.title, c.aliases) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    const results: VoiceSearchResult[] = scored.map(({ c }) => ({
      id: `link:${c.id}`,
      title: c.title,
      url: c.url,
      meta: c.section,
      kind: 'link',
      openOnly: true,
    }))

    return {
      results,
      message: results.length
        ? `${results.length} resultado${results.length !== 1 ? 's' : ''} para "${q}"`
        : `Nenhum link para "${q}"`,
    }
  },
}

// Batch lead creation: several lead *entries* at once (table `leads_entries`).
// Each entry auto-matches/creates a contacto (leads table) server-side.
// Rendering is special-cased in the overlay because the row count is variable.
const createLeadsBatch: ToolConfig = {
  title: 'Criar vários leads',
  submitLabel: 'Criar leads',
  fields: [],
  canSubmit: (args) => {
    const list = Array.isArray(args.leads) ? args.leads : []
    return list.length > 0 && list.every((l: any) => l?.nome && String(l.nome).trim())
  },
  submit: async (args, { router }) => {
    type BatchEntry = {
      nome?: string
      telemovel?: string
      email?: string
      source?: string
      assigned_consultant_id?: string
      resolved_property_id?: string
    }
    const list: BatchEntry[] = Array.isArray(args.leads) ? args.leads : []
    const defaultAssignee: string | undefined = args.assigned_consultant_id
      ? String(args.assigned_consultant_id)
      : undefined
    const defaultSource: string | undefined = args.default_source
      ? String(args.default_source)
      : undefined
    const defaultPropertyId: string | undefined = args.resolved_default_property_id
      ? String(args.resolved_default_property_id)
      : undefined
    let created = 0
    let failed = 0
    for (const lead of list) {
      const nome = (lead?.nome || '').toString().trim()
      if (!nome) continue
      // Per-row overrides take precedence; fall back to batch defaults; finally
      // to 'voice' so the row is always a valid lead_entries insertion.
      const source = lead.source || defaultSource || 'voice'
      const assignee = lead.assigned_consultant_id || defaultAssignee
      const propertyId = lead.resolved_property_id || defaultPropertyId
      const payload: Record<string, unknown> = {
        source,
        raw_name: nome,
      }
      if (lead.telemovel) payload.raw_phone = String(lead.telemovel).trim()
      if (lead.email) payload.raw_email = String(lead.email).trim()
      if (assignee) payload.assigned_consultant_id = assignee
      if (propertyId) payload.property_id = propertyId
      try {
        const res = await fetch('/api/lead-entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) created += 1
        else failed += 1
      } catch {
        failed += 1
      }
    }
    if (created === 0) {
      throw new Error('Falha ao criar leads')
    }
    router.push('/dashboard/leads')
    return {
      detailPath: '/dashboard/leads',
      message:
        failed > 0
          ? `${created} criado${created !== 1 ? 's' : ''}, ${failed} com erro`
          : `${created} lead${created !== 1 ? 's' : ''} criado${created !== 1 ? 's' : ''}`,
    }
  },
}

export const TOOL_CONFIGS: Record<VoiceToolName, ToolConfig> = {
  create_lead: createLead,
  create_leads_batch: createLeadsBatch,
  create_angariacao: createAngariacao,
  create_fecho: createFecho,
  create_todo: createTodo,
  create_reminder: createReminder,
  create_call_log: createCallLog,
  create_visit: createVisit,
  send_property: sendProperty,
  search_document: searchDocument,
  search_partner: searchPartner,
  open_link: openLink,
  send_message: sendMessage,
  add_lead_note: addLeadNote,
  schedule_follow_up: scheduleFollowUp,
  generate_property_description: generatePropertyDescription,
  attach_document: attachDocument,
}

/**
 * Whether a field should currently be treated as required — honours both the
 * strict `required` flag and the "one-of" `requiredGroup` relationship (a
 * grouped field is required only while no sibling in the group is filled).
 */
export function isRequiredField(
  field: FieldConfig,
  allFields: FieldConfig[],
  args: Record<string, any>
): boolean {
  if (field.required === true) return true
  if (field.requiredGroup) {
    const siblings = allFields.filter((f) => f.requiredGroup === field.requiredGroup)
    const anyFilled = siblings.some((f) => !isEmpty(args[f.key]))
    return !anyFilled
  }
  return false
}

/** Field keys whose required value is missing/empty in the provided args. */
export function getMissingRequired(
  tool: VoiceToolName,
  args: Record<string, any>
): string[] {
  const cfg = TOOL_CONFIGS[tool]
  if (!cfg) return []
  return cfg.fields
    .filter((f) => isRequiredField(f, cfg.fields, args))
    .filter((f) => isEmpty(args[f.key]))
    .map((f) => f.key)
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === ''
}

export function formatFieldValue(field: FieldConfig, value: unknown): string {
  if (isEmpty(value)) return ''
  return field.format ? field.format(value) : String(value)
}
