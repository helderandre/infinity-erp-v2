/**
 * Pub/sub leve em memória para invalidar listas do CRM após mutações.
 *
 * Problema que resolve: quando se qualifica um lead_entry (cria négocio +
 * marca entry como `converted`) ou se cria uma referência (move ownership +
 * cria audit row), múltiplas vistas montadas na app — kanban principal,
 * caixa "Tens X leads" no topo, página Referências, listagem de contactos —
 * têm de re-fazer fetch para reflectir o novo estado. Antes deste módulo,
 * cada parent passava o seu próprio `onSuccess`/`onMutated` e arriscava-se
 * a esquecer um.
 *
 * Padrão: hooks de listagem registam-se em `subscribe(topic, fn)` no mount;
 * sites de mutação chamam `invalidate(topic)` (ou um helper agregado como
 * `invalidateAfterQualify()`) ao concluir a acção. Não há cache TTL nem
 * deduplicação — `invalidate()` chama todos os listeners imediatamente e
 * cada listener decide o que fazer (refetch silencioso é o caso comum).
 *
 * Não usa Supabase Realtime — esse caminho está reservado para tabelas
 * onde o pattern já existe (notifications, chat, etc.). Para CRM continuamos
 * em invalidation client-side, suficiente para o caso "fiz a acção, quero
 * ver o efeito imediatamente".
 */

export type CrmInvalidationTopic =
  | 'kanban'
  | 'lead-entries'
  | 'contacts'
  | 'referrals'
  | 'negocios'

const listeners = new Map<CrmInvalidationTopic, Set<() => void>>()

/**
 * Regista um listener para um tópico. Devolve uma função `unsubscribe` que
 * o hook deve chamar no cleanup do `useEffect`. Idempotente: chamar com a
 * mesma função duas vezes só regista uma.
 */
export function subscribe(topic: CrmInvalidationTopic, fn: () => void): () => void {
  let bucket = listeners.get(topic)
  if (!bucket) {
    bucket = new Set()
    listeners.set(topic, bucket)
  }
  bucket.add(fn)
  return () => {
    listeners.get(topic)?.delete(fn)
  }
}

/**
 * Dispara todos os listeners de um (ou vários) tópico(s). Síncrono. Erros
 * num listener são apanhados e logged — não impedem os outros listeners
 * do mesmo tópico nem os tópicos seguintes.
 */
export function invalidate(topics: CrmInvalidationTopic | CrmInvalidationTopic[]): void {
  const list = Array.isArray(topics) ? topics : [topics]
  for (const topic of list) {
    const bucket = listeners.get(topic)
    if (!bucket) continue
    bucket.forEach((fn) => {
      try {
        fn()
      } catch (err) {
        console.error('[crm-invalidator]', topic, err)
      }
    })
  }
}

// ── Helpers de cenário — uma chamada por mutação ────────────────────────────

/**
 * Qualificar lead_entry → negócio. A entry sai da caixa "Tens X leads"
 * (status='converted'), aparece um novo card no kanban, e o contacto pode
 * ter ganho lifecycle stage. Chamar depois do POST /api/crm/negocios + do
 * PATCH /api/lead-entries/[id] resolverem com sucesso.
 */
export function invalidateAfterQualify(): void {
  invalidate(['kanban', 'lead-entries', 'negocios', 'contacts'])
}

/**
 * Referência interna criada (entry, négocio ou contact-only). Mexe em:
 * - lead_entries (entry_id flips assigned_consultant_id)
 * - negocios (negocio_id flips assigned_consultant_id + sets referrer_*)
 * - leads_referrals (audit row nova)
 * Tudo é invalidado por defeito porque o callsite não distingue subject.kind.
 */
export function invalidateAfterReferral(): void {
  invalidate(['kanban', 'lead-entries', 'negocios', 'referrals', 'contacts'])
}

/**
 * Stage move dentro do kanban / temperatura / outros patches a um négocio.
 */
export function invalidateAfterNegocioMutation(): void {
  invalidate(['kanban', 'negocios', 'referrals'])
}

/**
 * Mutações em contactos (criar, editar, eliminar).
 */
export function invalidateAfterContactMutation(): void {
  invalidate(['contacts', 'kanban'])
}
