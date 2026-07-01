'use client'

/**
 * Humaniza as respostas de um formulário Meta (form_data.raw_fields) contra a
 * definição do formulário, buscada por form_id e cacheada por form_id ao nível
 * do módulo (as definições são pequenas e estáveis). É a versão client-side do
 * que /api/lead-entries/[id] faz server-side — usada em superfícies que já têm o
 * form_data em mão (cartão de origem do negócio, etc.) e não voltam ao servidor.
 *
 * Devolve null enquanto carrega, quando desactivado, ou quando não é um form
 * Meta com raw_fields — nesse caso o caller deve cair para o seu rendering cru.
 */

import { useEffect, useState } from 'react'

import {
  humanizeMetaFormAnswers,
  type HumanizedFormAnswer,
  type MetaFormQuestion,
} from '@/lib/meta/humanize-form-answers'

const questionsCache = new Map<string, MetaFormQuestion[]>()
const inflight = new Map<string, Promise<MetaFormQuestion[]>>()

function fetchQuestions(formId: string): Promise<MetaFormQuestion[]> {
  const cached = questionsCache.get(formId)
  if (cached) return Promise.resolve(cached)
  const existing = inflight.get(formId)
  if (existing) return existing

  const p = fetch(`/api/analise-meta/forms/${encodeURIComponent(formId)}/questions`)
    .then((r) => (r.ok ? r.json() : { questions: [] }))
    .then((j) => {
      const qs = (j.questions ?? []) as MetaFormQuestion[]
      questionsCache.set(formId, qs)
      inflight.delete(formId)
      return qs
    })
    .catch(() => {
      inflight.delete(formId)
      return [] as MetaFormQuestion[]
    })

  inflight.set(formId, p)
  return p
}

function extractFormId(formData: Record<string, unknown> | null | undefined): string | null {
  const fid = formData?.form_id
  return typeof fid === 'string' || typeof fid === 'number' ? String(fid) : null
}

function extractRawFields(
  formData: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const rf = formData?.raw_fields
  return rf && typeof rf === 'object' ? (rf as Record<string, unknown>) : null
}

export function useMetaFormAnswers(
  formData: Record<string, unknown> | null | undefined,
  options?: { enabled?: boolean },
): HumanizedFormAnswer[] | null {
  const enabled = options?.enabled ?? true
  const formId = extractFormId(formData)
  const rawFields = extractRawFields(formData)
  const hasRawFields = !!rawFields

  const [questions, setQuestions] = useState<MetaFormQuestion[] | null>(
    formId ? questionsCache.get(formId) ?? null : null,
  )

  useEffect(() => {
    if (!enabled || !formId || !hasRawFields) return
    const cached = questionsCache.get(formId)
    if (cached) {
      setQuestions(cached)
      return
    }
    let active = true
    fetchQuestions(formId).then((qs) => {
      if (active) setQuestions(qs)
    })
    return () => {
      active = false
    }
  }, [enabled, formId, hasRawFields])

  if (!enabled || !formId || !rawFields || !questions) return null
  const answers = humanizeMetaFormAnswers(rawFields, questions)
  return answers.length > 0 ? answers : null
}
