// ─── Moloni idempotency ──────────────────────────────────────────────────────
// Fiscal documents must never be emitted twice on a retry / double-click.
// `withIdempotency` records each logical operation in `moloni_idempotency_keys`
// keyed by a stable `key` (e.g. `moloni:issue_draft:<payment_id>`):
//
//   • completed + same input  → return the cached result (no second API call)
//   • completed + new input   → a genuinely new operation → run again
//   • pending  + recent       → reject (in flight)
//   • pending  + stale / failed → retry
//
// This mirrors MUBE CRM's `moloni_idempotency_keys` table.

import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

const PENDING_TTL_MS = 90_000

function hashInput(input: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(input ?? {})).digest('hex')
}

export async function withIdempotency<T>(
  key: string,
  op: string,
  input: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const admin = createAdminClient() as any
  const inputHash = hashInput(input)

  const { data: existing } = await admin
    .from('moloni_idempotency_keys')
    .select('status, input_hash, result, created_at')
    .eq('key', key)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'completed' && existing.input_hash === inputHash) {
      return existing.result as T
    }
    if (existing.status === 'pending') {
      const ageMs = Date.now() - new Date(existing.created_at).getTime()
      if (ageMs < PENDING_TTL_MS) {
        throw new Error('Operação Moloni já em curso — aguarde uns segundos.')
      }
    }
    // failed, stale-pending, or new input → reset to pending and re-run.
    await admin
      .from('moloni_idempotency_keys')
      .update({ op, input_hash: inputHash, status: 'pending', result: null, error: null, updated_at: new Date().toISOString() })
      .eq('key', key)
  } else {
    const { error: insErr } = await admin
      .from('moloni_idempotency_keys')
      .insert({ key, op, input_hash: inputHash, status: 'pending' })
    // Unique violation on `key` means a concurrent request beat us here.
    if (insErr) throw new Error('Operação Moloni já em curso — aguarde uns segundos.')
  }

  try {
    const result = await fn()
    await admin
      .from('moloni_idempotency_keys')
      .update({ status: 'completed', result: result as any, error: null, updated_at: new Date().toISOString() })
      .eq('key', key)
    return result
  } catch (e: any) {
    await admin
      .from('moloni_idempotency_keys')
      .update({ status: 'failed', error: e?.message ?? String(e), updated_at: new Date().toISOString() })
      .eq('key', key)
    throw e
  }
}

/** Forget an idempotency key so the same logical op can run fresh (e.g. after deleting a draft). */
export async function clearIdempotency(key: string): Promise<void> {
  const admin = createAdminClient() as any
  await admin.from('moloni_idempotency_keys').delete().eq('key', key)
}
