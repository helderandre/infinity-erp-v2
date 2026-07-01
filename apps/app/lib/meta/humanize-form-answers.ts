/**
 * Humaniza as respostas de um lead Meta.
 *
 * A Meta entrega as respostas como pares { name, values } onde `name` é a chave
 * normalizada da pergunta e `values[0]` é, para perguntas de escolha, a CHAVE da
 * opção (ex.: `t1_-_desde_€305.000_`), não o texto humano. A definição do
 * formulário (meta.meta_forms_raw → payload.form.questions) tem, por pergunta, o
 * `label` legível e as `options: [{ key, value }]` para resolver a chave → valor.
 *
 * Este helper é a fonte única desse mapeamento — a secção CRM → Análise → Meta
 * fá-lo inline no <LeadDetailSheet>; a ficha do leads_entries (<LeadEntrySheet>)
 * consome-o via o bundle de /api/lead-entries/[id] para mostrar EXACTAMENTE as
 * mesmas perguntas/respostas humanizadas (e não as chaves cruas).
 */

export interface MetaFormQuestionOption {
  key: string
  value: string
}

export interface MetaFormQuestion {
  id?: string
  key: string
  label: string
  type?: string | null
  options?: MetaFormQuestionOption[]
}

export interface HumanizedFormAnswer {
  /** Chave crua do campo (field_data.name / raw_fields key). */
  name: string
  /** Label legível da pergunta (cai para o nome cru se a pergunta não existir). */
  label: string
  /** Tipo da pergunta Meta (FULL_NAME, EMAIL, CUSTOM, …) ou null. */
  type: string | null
  /** Resposta humanizada (opção resolvida quando aplicável). */
  value: string
}

/**
 * Resolve uma resposta crua para o `value` humano quando a pergunta declara
 * opções (escolha múltipla); caso contrário devolve o valor tal como está.
 */
export function resolveMetaAnswerValue(
  rawValue: string,
  question: MetaFormQuestion | undefined,
): string {
  if (!question?.options?.length) return rawValue
  return question.options.find((o) => o.key === rawValue)?.value ?? rawValue
}

/**
 * Humaniza `form_data.raw_fields` (mapa { name → value }, tal como é guardado na
 * ingestão) contra a definição do formulário. Preserva a ordem de inserção de
 * raw_fields (= ordem do field_data original) e ignora respostas vazias.
 */
export function humanizeMetaFormAnswers(
  rawFields: Record<string, unknown> | null | undefined,
  questions: MetaFormQuestion[] | null | undefined,
): HumanizedFormAnswer[] {
  if (!rawFields) return []
  const byKey = new Map((questions ?? []).map((q) => [q.key, q]))
  const out: HumanizedFormAnswer[] = []
  for (const [name, raw] of Object.entries(rawFields)) {
    const value = raw == null ? '' : String(raw)
    if (value.trim() === '') continue
    const q = byKey.get(name)
    out.push({
      name,
      label: q?.label ?? name,
      type: q?.type ?? null,
      value: resolveMetaAnswerValue(value, q),
    })
  }
  return out
}
