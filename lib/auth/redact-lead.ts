/**
 * PII redaction para vistas de gestão.
 *
 * Política (decidida 2026-05-22): roles em MANAGEMENT_ROLES vêem a estrutura
 * da pipeline (contagens, valores, fases, atribuições) MAS não vêem nome
 * completo nem contactos das leads. O filtro "consultor X" continua
 * disponível como slice analítico — não eleva privilégio (PII fica redacted
 * mesmo quando o manager filtra por um consultor específico).
 *
 * Helpers exportados:
 *   - shouldRedactLead(roles, ownerId, viewerId)
 *   - maskLeadName(id) — "Lead #ABCD" determinístico do UUID
 *   - redactLead(row)  — copia + masca nome, null-ify PII
 *   - redactNestedLead(row, keys?) — copia + redact em chaves nested
 *   - redactArray(rows, mapper)
 *
 * Use sites: app/api/leads, app/api/negocios, app/api/crm/contacts,
 * app/api/crm/kanban, app/api/lead-entries.
 */

import { isManagementRole } from './roles'

/**
 * Campos PII que ficam null para vistas redacted. Inclui dados pessoais,
 * contactos, identificação, dados da empresa do contacto, fragmentos de
 * morada, observações livres (podem conter PII), URLs de documentos de
 * identificação, raw_* dos lead_entries, e tags (podem conter "VIP — João").
 */
const PII_NULL_FIELDS = [
  // Pessoais
  'email',
  'telefone',
  'telemovel',
  'full_name',
  'nif',
  'data_nascimento',
  'nacionalidade',
  'morada',
  'codigo_postal',
  'localidade',
  // Identificação
  'tipo_documento',
  'numero_documento',
  'data_validade_documento',
  'pais_emissor',
  'documento_identificacao_url',
  'documento_identificacao_frente_url',
  'documento_identificacao_verso_url',
  // Empresa do contacto (não confundir com `tem_empresa boolean`)
  'empresa',
  'nipc',
  'email_empresa',
  'telefone_empresa',
  'morada_empresa',
  // Lead_entries (linhas inbound) — raw_* + notes + form_data submetido
  // pelo cliente + dados de referral externo (PII de terceiros).
  'raw_email',
  'raw_phone',
  'raw_name',
  'notes',
  'form_data',
  'referral_external_name',
  'referral_external_phone',
  'referral_external_email',
  'referral_external_agency',
  // Texto livre + tags
  'observacoes',
  'tags',
] as const

/**
 * Chaves onde uma lead vive aninhada via PostgREST join.
 * - `lead` — usado em /api/negocios/* e /api/negocios/[id]/related
 * - `leads` — usado em /api/crm/kanban (alias automático do PostgREST)
 * - `contact` — usado em /api/lead-entries e /api/crm/referrals
 */
const DEFAULT_NESTED_LEAD_KEYS = ['lead', 'leads', 'contact'] as const

/**
 * Decisão central: o caller deve redact a row para este viewer?
 *
 * Regras:
 *  - Não-management → SEMPRE PII completa (vê só os seus, é o owner).
 *  - Management → redact, EXCEPTO quando o viewer é o owner do registo
 *    (caso raro mas possível: um Broker/CEO que também trabalha leads —
 *    nas suas próprias leads vê PII completa) OU é o `referrerId`
 *    (originou a lead; mantém visibilidade plena pós hand-off).
 */
export function shouldRedactLead(
  roles: ReadonlyArray<string | null | undefined>,
  ownerId: string | null | undefined,
  viewerId: string,
  referrerId?: string | null | undefined,
): boolean {
  if (!isManagementRole(roles)) return false
  if (ownerId === viewerId) return false
  if (referrerId && referrerId === viewerId) return false
  return true
}

/**
 * Gera um label estável e não-identificador a partir do UUID da lead.
 * Determinístico → o manager vê sempre o mesmo label para o mesmo
 * registo entre páginas (continuidade visual sem expor PII).
 *
 * Quando `firstName` é passado, o label fica `"João #ABCD"` — o primeiro
 * nome dá contexto humano (mais útil do que `Lead #ABCD` puro) sem revelar
 * apelido, contactos ou identificação. Em PT-PT há tipicamente vários
 * "João" ou "Maria" por consultor, portanto o primeiro nome isolado não é
 * identificador. Sem `firstName` cai para o "Lead #ABCD" puro.
 */
export function maskLeadName(
  id: string | null | undefined,
  firstName?: string | null,
): string {
  if (!id) return firstName?.trim() || 'Lead'
  const short = id.replace(/-/g, '').slice(0, 4).toUpperCase()
  const prefix = firstName?.trim() || 'Lead'
  return `${prefix} #${short}`
}

/**
 * Devolve uma cópia rasa de `lead` com `nome → maskLeadName(id, firstName)`
 * e os campos PII a null. Pass-through para `null`/`undefined`. Não muta
 * input.
 *
 * O primeiro nome é extraído de `nome` ou `full_name` (split no primeiro
 * espaço) ANTES de o resto ser nullified — dá ao label final a forma
 * `"João #6AD4"`. Tolerante a shapes parciais — se o select só trouxer
 * {id, nome, telemovel, email}, só esses campos são tocados.
 */
export function redactLead<T extends Record<string, unknown> | null | undefined>(
  lead: T,
): T {
  if (!lead) return lead
  const clone: Record<string, unknown> = { ...(lead as Record<string, unknown>) }
  const sourceName = String(clone.nome ?? clone.full_name ?? '').trim()
  const firstName = sourceName ? sourceName.split(/\s+/)[0] : null
  if ('nome' in clone) {
    clone.nome = maskLeadName(clone.id as string | null | undefined, firstName)
  }
  for (const f of PII_NULL_FIELDS) {
    if (f in clone) clone[f] = null
  }
  return clone as T
}

/**
 * Walks the row and redacts any nested lead-shaped property listed in
 * `keys` (defaults to ['lead', 'leads', 'contact']). Returns a shallow
 * copy with redacted nested object(s); other fields preserved as-is.
 *
 * Não desce recursivamente — só redact o primeiro nível de chaves
 * conhecidas. Suficiente para os shapes de hoje (negocios.lead,
 * lead_entries.contact, kanban negocios.leads).
 */
export function redactNestedLead<T extends Record<string, unknown>>(
  row: T,
  keys: ReadonlyArray<string> = DEFAULT_NESTED_LEAD_KEYS,
): T {
  if (!row) return row
  const clone: Record<string, unknown> = { ...row }
  for (const key of keys) {
    const nested = clone[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      clone[key] = redactLead(nested as Record<string, unknown>)
    }
  }
  return clone as T
}
