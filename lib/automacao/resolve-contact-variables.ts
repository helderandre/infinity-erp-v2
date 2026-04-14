import type { SupabaseClient } from "@supabase/supabase-js"
import { TZDate } from "@date-fns/tz"

export class ContactVariablesError extends Error {}

function pad2(n: number) {
  return n.toString().padStart(2, "0")
}

function formatDatePt(iso: string | null | undefined): string {
  if (!iso) return ""
  const [y, m, d] = iso.split("T")[0].split("-")
  if (!y || !m || !d) return ""
  return `${d}/${m}/${y}`
}

function formatCurrencyEur(value: number | null | undefined): string {
  if (value === null || value === undefined) return ""
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function firstName(fullName: string | null | undefined): string {
  if (!fullName) return ""
  return fullName.trim().split(/\s+/)[0] ?? ""
}

function deriveDealName(deal: {
  tipo?: string | null
  localizacao?: string | null
  tipo_imovel?: string | null
  localizacao_venda?: string | null
  tipo_imovel_venda?: string | null
}): string {
  const tipo = deal.tipo ?? ""
  const loc = deal.localizacao || deal.localizacao_venda || deal.tipo_imovel || deal.tipo_imovel_venda || ""
  if (tipo && loc) return `${tipo} — ${loc}`
  return tipo || loc || "Negócio"
}

function computeYearsSinceClose(closingDateIso: string | null | undefined, now: Date): number | null {
  if (!closingDateIso) return null
  const [y, m, d] = closingDateIso.split("T")[0].split("-").map(Number)
  if (!y || !m || !d) return null
  let years = now.getUTCFullYear() - y
  const hasHadAnniversaryThisYear =
    now.getUTCMonth() + 1 > m || (now.getUTCMonth() + 1 === m && now.getUTCDate() >= d)
  if (!hasHadAnniversaryThisYear) years -= 1
  return Math.max(0, years)
}

export interface ResolveContactVariablesOptions {
  contactId: string
  dealId?: string | null
  timezone?: string
  now?: Date
}

export async function resolveContactVariables(
  supabase: SupabaseClient,
  options: ResolveContactVariablesOptions,
): Promise<Record<string, string>> {
  const { contactId, dealId, timezone = "Europe/Lisbon" } = options
  const now = options.now ?? new Date()

  const { data: contact, error: contactErr } = await supabase
    .from("leads")
    .select(
      "id, nome, full_name, email, telemovel, telefone, data_nascimento, origem, estado, temperatura, agent_id",
    )
    .eq("id", contactId)
    .maybeSingle()

  if (contactErr) {
    throw new ContactVariablesError(`Erro ao carregar contacto: ${contactErr.message}`)
  }
  if (!contact) {
    throw new ContactVariablesError("Contacto não encontrado")
  }

  const displayName = (contact.nome ?? contact.full_name ?? "") as string
  const phone = (contact.telemovel ?? "") as string
  const birthday = (contact.data_nascimento ?? null) as string | null
  const email = (contact.email ?? "") as string

  const vars: Record<string, string> = {
    // Aliases `contact_*` (usado por templates mais antigos)
    contact_name: displayName,
    contact_first_name: firstName(displayName),
    contact_email: email,
    contact_phone: phone,
    contact_birthday: formatDatePt(birthday),

    // Chaves canónicas `lead_*` expostas pelo variable picker (tpl_variables)
    lead_nome: displayName,
    lead_email: email,
    lead_telemovel: phone,
    lead_telefone: (contact.telefone ?? "") as string,
    lead_origem: (contact.origem ?? "") as string,
    lead_estado: (contact.estado ?? "") as string,
    lead_temperatura: (contact.temperatura ?? "") as string,

    // Aliases em inglês (tolerância a chaves escritas como `lead_name`/`lead_phone`)
    lead_name: displayName,
    lead_phone: phone,

    // Estáticas / derivadas
    empresa_nome: "Infinity Group",
  }

  // Consultor atribuído (agent_id → dev_users.commercial_name)
  if (contact.agent_id) {
    const { data: agent } = await supabase
      .from("dev_users")
      .select("commercial_name, professional_email")
      .eq("id", contact.agent_id)
      .maybeSingle()
    if (agent) {
      vars.consultor_nome = (agent.commercial_name ?? "") as string
      vars.consultor_email = (agent.professional_email ?? "") as string
    } else {
      vars.consultor_nome = ""
      vars.consultor_email = ""
    }
  } else {
    vars.consultor_nome = ""
    vars.consultor_email = ""
  }

  if (dealId) {
    const { data: deal } = await supabase
      .from("negocios")
      .select(
        "id, tipo, localizacao, tipo_imovel, localizacao_venda, tipo_imovel_venda, expected_close_date, preco_venda, orcamento, renda_pretendida",
      )
      .eq("id", dealId)
      .maybeSingle()

    if (deal) {
      vars.deal_name = deriveDealName(deal)
      vars.deal_closing_date = formatDatePt(deal.expected_close_date)
      const years = computeYearsSinceClose(deal.expected_close_date, now)
      vars.deal_years_since_close = years === null ? "" : String(years)
      const value = deal.preco_venda ?? deal.orcamento ?? deal.renda_pretendida ?? null
      vars.deal_value = formatCurrencyEur(value)
    } else {
      vars.deal_name = ""
      vars.deal_closing_date = ""
      vars.deal_years_since_close = ""
      vars.deal_value = ""
    }
  }

  const zoned = new TZDate(now, timezone)
  vars.today_date = `${pad2(zoned.getDate())}/${pad2(zoned.getMonth() + 1)}/${zoned.getFullYear()}`
  vars.current_year = String(zoned.getFullYear())

  return vars
}
