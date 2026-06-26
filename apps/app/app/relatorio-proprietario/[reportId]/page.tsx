import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { OwnerReportDocument } from '@/components/reports/owner-report-document'
import type {
  OwnerReportConfig,
  OwnerReportData,
} from '@/lib/reports/owner-activity-report'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Relatório de Atividade — Infinity Group',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ reportId: string }>
  searchParams: Promise<{ print?: string }>
}

export default async function OwnerReportPage({ params, searchParams }: PageProps) {
  const { reportId } = await params
  const sp = await searchParams
  const print = sp.print === 'true' || sp.print === '1'

  const admin = createAdminClient() as any
  const { data: report } = await admin
    .from('owner_activity_reports')
    .select('config, data_snapshot')
    .eq('id', reportId)
    .maybeSingle()

  if (!report || !report.data_snapshot) notFound()

  const data = report.data_snapshot as OwnerReportData
  const config = report.config as OwnerReportConfig

  return <OwnerReportDocument data={data} config={config} print={print} />
}
