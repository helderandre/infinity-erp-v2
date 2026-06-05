export type PrefillEntity = 'lead' | 'property' | 'task' | 'acquisition' | 'fecho'

// Module-level cache survives client-side navigation and — unlike sessionStorage —
// tolerates React Strict Mode double-invocation of effects: peeks are idempotent
// and the explicit `clear` call doesn't error when the key is already absent.
const pending = new Map<PrefillEntity, unknown>()

export function setPrefill(entity: PrefillEntity, payload: Record<string, unknown>): void {
  pending.set(entity, payload)
}

export function peekPrefill<T = Record<string, unknown>>(entity: PrefillEntity): T | null {
  const v = pending.get(entity)
  return v === undefined ? null : (v as T)
}

export function clearPrefill(entity: PrefillEntity): void {
  pending.delete(entity)
}
