'use client'

/**
 * Hook que regista um listener no `lib/crm/invalidator` para um (ou vários)
 * tópico(s). Quando outra parte da app dispara `invalidate(topic)`, o
 * `onInvalidate` passado é chamado — tipicamente um `refetch()` silencioso.
 *
 * Implementação usa um ref para a callback de modo a permitir mudar o
 * closure sem re-subscrever ao(s) tópico(s) (caso contrário re-criar um
 * listener por re-render do parent ficaria caro e furava o `Set`).
 *
 * Uso:
 *   useCrmInvalidator('kanban', () => fetchBoard({ silent: true }))
 *   useCrmInvalidator(['kanban', 'negocios'], handleRefresh)
 */

import { useEffect, useRef } from 'react'
import { subscribe, type CrmInvalidationTopic } from '@/lib/crm/invalidator'

export function useCrmInvalidator(
  topic: CrmInvalidationTopic | CrmInvalidationTopic[],
  onInvalidate: () => void,
): void {
  const fnRef = useRef(onInvalidate)
  useEffect(() => {
    fnRef.current = onInvalidate
  }, [onInvalidate])

  // O dep do effect é a lista de tópicos serializada para string; mudar de
  // tópico re-subscreve, mudar a callback NÃO re-subscreve (a chamada vai
  // sempre ao último closure via ref).
  const topicKey = Array.isArray(topic) ? [...topic].sort().join(',') : topic

  useEffect(() => {
    const list = Array.isArray(topic) ? topic : [topic]
    const handler = () => fnRef.current()
    const unsubs = list.map((t) => subscribe(t, handler))
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicKey])
}
