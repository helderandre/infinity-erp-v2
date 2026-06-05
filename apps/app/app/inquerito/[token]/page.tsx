import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { SatisfactionSurveyForm } from '@/components/inquerito/satisfaction-survey-form'
import { CheckCircle2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function InqueritoPage({ params }: PageProps) {
  const { token } = await params

  if (!token || token.length < 16) notFound()

  const admin = createAdminClient()
  const adminDb = admin as unknown as { from: (t: string) => ReturnType<typeof admin.from> }

  const { data: row } = await adminDb
    .from('client_satisfaction_surveys')
    .select(`
      id, token, completed_at,
      deal:deals!client_satisfaction_surveys_deal_id_fkey(
        id, reference,
        property:dev_properties!deals_property_id_fkey(address_street, city)
      ),
      consultant:dev_users!client_satisfaction_surveys_consultant_id_fkey(commercial_name)
    `)
    .eq('token', token)
    .maybeSingle()

  if (!row) notFound()

  const survey = row as {
    id: string
    token: string
    completed_at: string | null
    deal?: {
      id: string
      reference: string | null
      property?: { address_street: string | null; city: string | null } | null
    } | null
    consultant?: { commercial_name: string | null } | null
  }

  const propertyAddress = survey.deal?.property
    ? [survey.deal.property.address_street, survey.deal.property.city].filter(Boolean).join(', ') || null
    : null

  // Already completed — show thank-you state
  if (survey.completed_at) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4 py-12">
          <div className="inline-flex h-16 w-16 rounded-full bg-emerald-100 items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Inquérito já submetido</h1>
          <p className="text-sm text-muted-foreground">
            Obrigado pela sua opinião. As suas respostas foram registadas com sucesso.
          </p>
          <p className="text-xs text-muted-foreground">— Equipa Infinity Group</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <SatisfactionSurveyForm
        token={token}
        consultantName={survey.consultant?.commercial_name ?? null}
        propertyAddress={propertyAddress}
        dealReference={survey.deal?.reference ?? null}
      />
    </div>
  )
}
