// Stub for Meta/Instagram integration notifications
// TODO: Implement real notification logic (email, push, etc.)

interface NotifyAdminsParams {
  type: string
  title: string
  body: string
  action_url?: string
  metadata?: Record<string, unknown>
}

export async function notifyAdmins(params: NotifyAdminsParams) {
  console.log(`[Notify] ${params.title}: ${params.body}`)
}

export async function emailNewLead(
  name: string,
  source: string,
  email?: string | null,
  phone?: string | null,
  leadId?: string | null,
) {
  console.log(`[Notify] Novo lead: ${name} via ${source}${email ? ` (${email})` : ''}`)
}
