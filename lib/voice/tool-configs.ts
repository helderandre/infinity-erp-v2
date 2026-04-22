import type { useRouter } from 'next/navigation'
import type { VoiceToolName } from './tools'
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

export interface SubmitContext {
  router: Router
  /** Current auth user's ID — filled by the overlay from useUser(). */
  userId?: string
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
  kind?: 'document' | 'design' | 'property'
  /**
   * Pre-resolved recipients to auto-fill the Compose panel. Populated by
   * tools that captured names via voice (e.g. send_property).
   */
  initialRecipients?: VoiceSearchRecipient[]
  /** Optional intro message captured by voice; used as default in Compose. */
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
  ],
  submit: async (args, { router }) => {
    // 1) Create lead
    const leadPayload: Record<string, unknown> = { nome: args.nome }
    if (args.email) leadPayload.email = args.email
    if (args.telemovel) leadPayload.telemovel = args.telemovel
    if (args.observacoes) leadPayload.observacoes = args.observacoes

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

    // 2) Optionally create inline negócio
    let negocioCreated = false
    if (args.negocio_tipo) {
      const negocioPayload: Record<string, unknown> = {
        lead_id: leadId,
        tipo: args.negocio_tipo,
      }
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
    return {
      detailPath: path,
      message: negocioCreated ? 'Contacto e negócio criados' : 'Contacto criado',
    }
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
  submit: async (args, { router }) => {
    const payload: Record<string, unknown> = { title: args.title }
    if (args.description) payload.description = args.description
    if (args.priority !== undefined && args.priority !== '') payload.priority = Number(args.priority)
    if (args.due_date) payload.due_date = args.due_date

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
  submit: async (args, { router }) => {
    const payload: Record<string, unknown> = { title: args.title }
    if (args.due_date) payload.due_date = args.due_date

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
        body: JSON.stringify({ prefillData }),
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
function buildDealPayload(args: Record<string, any>) {
  const payload: Record<string, unknown> = {
    scenario: args.scenario || 'pleno',
  }
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
  submit: async (args, { router }) => {
    const name = String(args.contact_name ?? '').trim()
    if (!name) throw new Error('Contacto em falta')

    const lookup = await fetch(`/api/leads?nome=${encodeURIComponent(name)}&limit=3`)
    if (!lookup.ok) throw new Error('Falha ao procurar contacto')
    const ldata = await lookup.json()
    const list: any[] = Array.isArray(ldata) ? ldata : ldata?.data || []
    if (list.length === 0) {
      throw new Error(`Contacto "${name}" não encontrado. Cria-o primeiro.`)
    }
    const exact = list.find(
      (l) => String(l.nome ?? '').trim().toLowerCase() === name.toLowerCase()
    )
    const match = exact || list[0]
    const contactId = String(match.id)

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
      message: `Chamada registada${exact ? '' : ` (${match.nome})`}`,
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

    // Resolve property
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
    const property = plist[0]

    // Resolve contact (optional — fall back to client_name if no match)
    const contactName = String(args.contact_name ?? '').trim()
    let lead_id: string | undefined
    let fallbackClientName: string | undefined = contactName
    if (contactName) {
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
      property_id: String(property.id),
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

const sendProperty: ToolConfig = {
  title: 'Enviar imóvel',
  submitLabel: 'Procurar e preparar envio',
  fields: [
    { key: 'property_query', label: 'Imóvel', required: true, placeholder: 'Título, referência, zona…' },
    {
      key: 'contact_names_text',
      label: 'Destinatários',
      placeholder: 'Nomes separados por vírgulas (opcional)',
    },
    { key: 'message', label: 'Mensagem', inputType: 'textarea' },
  ],
  submit: async (args) => {
    const q = String(args.property_query ?? '').trim()
    if (!q) throw new Error('Imóvel em falta')

    const propsRes = await fetch(
      `/api/properties?search=${encodeURIComponent(q)}&per_page=5`
    )
    if (!propsRes.ok) throw new Error('Falha ao procurar imóvel')
    const pdata = await propsRes.json()
    const plist: any[] = Array.isArray(pdata?.data) ? pdata.data : []
    if (plist.length === 0) {
      throw new Error(`Imóvel "${q}" não encontrado`)
    }

    // Resolve recipient names (accept either voice-provided array or a
    // comma-separated string edited in the overlay).
    const rawNames: string[] = Array.isArray(args.contact_names)
      ? args.contact_names.map((n: unknown) => String(n).trim()).filter(Boolean)
      : String(args.contact_names_text ?? '')
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)

    const seen = new Set<string>()
    const initialRecipients: VoiceSearchRecipient[] = []
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
        if (pick && !seen.has(String(pick.id))) {
          seen.add(String(pick.id))
          initialRecipients.push({
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

    // Build a result card per property (top match + up to 3 alternatives).
    const priceFmt = (v: unknown) => {
      const n = Number(v)
      if (isNaN(n)) return ''
      return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n)
    }

    const results: VoiceSearchResult[] = plist.slice(0, 4).map((p: any, idx: number) => {
      const slug = String(p.slug || p.id)
      const url = buildPublicPropertyUrl(slug)
      const metaParts = [
        priceFmt(p.listing_price),
        p.city || p.zone,
        p.external_ref,
      ].filter(Boolean)
      return {
        id: `property:${p.id}`,
        title: String(p.title || 'Imóvel'),
        subtitle: p.address_street ? String(p.address_street) : undefined,
        url,
        meta: metaParts.join(' · ') || undefined,
        kind: 'property',
        // Only the top match inherits the voice-resolved recipients and custom
        // message — alternatives are just for picking a different property.
        initialRecipients: idx === 0 ? initialRecipients : undefined,
        defaultMessage:
          idx === 0 && args.message
            ? String(args.message).trim() || undefined
            : undefined,
      }
    })

    return {
      results,
      message: `${results.length} imóvel${results.length !== 1 ? 'is' : ''} encontrado${results.length !== 1 ? 's' : ''}`,
    }
  },
}

const searchDocument: ToolConfig = {
  title: 'Procurar documentos e designs',
  submitLabel: 'Procurar',
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
    const list: Array<{ nome?: string; telemovel?: string; email?: string }> =
      Array.isArray(args.leads) ? args.leads : []
    const assignedTo: string | undefined = args.assigned_consultant_id
      ? String(args.assigned_consultant_id)
      : undefined
    let created = 0
    let failed = 0
    for (const lead of list) {
      const nome = (lead?.nome || '').toString().trim()
      if (!nome) continue
      const payload: Record<string, unknown> = {
        source: 'voice',
        raw_name: nome,
      }
      if (lead.telemovel) payload.raw_phone = String(lead.telemovel).trim()
      if (lead.email) payload.raw_email = String(lead.email).trim()
      if (assignedTo) payload.assigned_consultant_id = assignedTo
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
