/**
 * scripts/backfill-lead-estados.ts
 *
 * One-shot back-fill that recomputes `leads.estado` for every existing
 * contact in the database, so they reflect the new auto-managed mapping
 * (Lead / Contactado / Potencial Cliente / Cliente Activo / 1 Negocio
 * Fechado / Cliente Recorrente / Cliente Premium).
 *
 * Idempotent — uses the same `syncLeadEstado()` helper that the negocio
 * mutation endpoints call, which:
 *   - skips contacts whose current estado is one of the manually-managed
 *     values (Qualificado / Perdido / Inactivo);
 *   - is a no-op if the computed value already matches.
 *
 * ══════════════════════════════════════════════════════════════════
 * RUN-BOOK
 * ══════════════════════════════════════════════════════════════════
 *
 * 1. Ensure `.env.local` has SUPABASE_SERVICE_ROLE_KEY and
 *    NEXT_PUBLIC_SUPABASE_URL pointing at the right project.
 *
 * 2. From the repo root:
 *
 *      pnpm dlx tsx scripts/backfill-lead-estados.ts
 *
 *    (or `npx tsx ...` without pnpm)
 *
 * 3. The script prints progress every 50 contacts and a summary at the end.
 *    Safe to abort with Ctrl+C — already-updated rows are not reverted and
 *    rerunning is idempotent.
 *
 * 4. Verification:
 *
 *      SELECT estado, count(*) FROM leads GROUP BY estado ORDER BY 2 DESC;
 *
 *    The distribution should look reasonable; manual estados (Qualificado,
 *    Perdido, Inactivo) stay untouched.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { syncLeadEstado } from '../lib/crm/sync-lead-estado'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const PAGE_SIZE = 200

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let offset = 0
  let total = 0
  let updated = 0
  let failed = 0
  const failedIds: string[] = []

  console.log('Backfilling leads.estado...')

  for (;;) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, estado')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('Page fetch error:', error)
      process.exit(1)
    }

    if (!data || data.length === 0) break

    for (const lead of data) {
      total++
      const before = lead.estado
      try {
        await syncLeadEstado(supabase as any, lead.id)
        // Cheap re-read to count updates accurately.
        const { data: after } = await supabase
          .from('leads')
          .select('estado')
          .eq('id', lead.id)
          .maybeSingle()
        if (after && after.estado !== before) updated++
      } catch (err) {
        failed++
        failedIds.push(lead.id)
        console.warn(
          `lead ${lead.id} failed:`,
          err instanceof Error ? err.message : err
        )
      }
      if (total % 50 === 0) {
        console.log(`  processed ${total} (updated ${updated}, failed ${failed})`)
      }
    }

    offset += PAGE_SIZE
  }

  console.log('\n──────────────────────────────────────')
  console.log(`Total processed: ${total}`)
  console.log(`Updated:         ${updated}`)
  console.log(`Failed:          ${failed}`)
  if (failedIds.length) {
    console.log('Failed lead ids:', failedIds.slice(0, 20).join(', '))
    if (failedIds.length > 20) console.log(`...and ${failedIds.length - 20} more`)
  }
}

main().catch((err) => {
  console.error('fatal:', err)
  process.exit(1)
})
