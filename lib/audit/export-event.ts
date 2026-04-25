import type { NextRequest } from 'next/server'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'

type ExportType =
  | 'contacts'
  | 'leads'
  | 'properties'
  | 'consultants'
  | 'processes'
  | 'negocios'
  | 'commissions'
  | 'candidates'

type Options = {
  rowCount?: number | null
  metadata?: Record<string, unknown>
}

export async function logExportEvent(
  req: NextRequest | Request,
  userId: string,
  exportType: ExportType,
  options: Options = {},
): Promise<void> {
  const headers = req.headers
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headers.get('x-real-ip')
    || null
  const userAgent = headers.get('user-agent') || null

  try {
    await createCrmAdminClient().from('consultant_export_events').insert({
      user_id: userId,
      export_type: exportType,
      row_count: options.rowCount ?? null,
      ip_address: ip,
      user_agent: userAgent,
      metadata: options.metadata ?? {},
    })
  } catch (e) {
    console.error(`[logExportEvent] failed to record ${exportType} export`, e)
  }
}
