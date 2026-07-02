/**
 * Emails a PARCEIRO (dev_users com role 'Parceiro') quando recebe algo novo no
 * portal de Parceiros:
 *   • uma nova lead referenciada a partir dele (leads_referrals from = parceiro),
 *   • um novo pedido de campanha (marketing_campaigns.partner_id = parceiro).
 *
 * Best-effort: NUNCA lança — não pode bloquear a acção que o despoletou
 * (ingestão de lead / criação de pedido). Usa o sender de sistema (Resend via
 * edge function). Os CTAs apontam para o portal de Parceiros.
 */

import { sendEmail } from '@/lib/email/send'
import { isPartner } from '@/lib/auth/roles'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

const PARCEIROS_URL = (
  process.env.NEXT_PUBLIC_PARCEIROS_URL || 'https://parceiros.infinitygroup.pt'
).replace(/\/$/, '')

/**
 * Resolve o email de contacto de um PARCEIRO. Devolve null (silenciosamente)
 * quando o `partnerId` não existe, está inactivo, não tem email, ou NÃO tem o
 * role 'Parceiro' — garante que consultores/utilizadores nunca recebem estes
 * emails do portal de Parceiros, mesmo que o call-site não faça o gate.
 */
async function partnerContact(
  db: Db,
  partnerId: string | null | undefined,
): Promise<{ email: string; name: string } | null> {
  if (!partnerId) return null
  const { data } = await db
    .from('dev_users')
    .select('professional_email, commercial_name, is_active, user_roles!user_roles_user_id_fkey(role:roles(name))')
    .eq('id', partnerId)
    .maybeSingle()
  if (!data || data.is_active === false || !data.professional_email) return null
  const roleNames: Array<string | null> = (data.user_roles || []).map(
    (ur: { role?: { name?: string | null } | null }) => ur.role?.name ?? null,
  )
  if (!isPartner(roleNames)) return null
  return {
    email: data.professional_email as string,
    name: (data.commercial_name as string) || 'Parceiro',
  }
}

function buildBody(
  name: string,
  intro: string,
  rows: Array<[string, string]>,
  ctaLabel: string,
  ctaPath: string,
): string {
  const detail = rows.length
    ? `<div style="background:#f8f9fa;border-radius:8px;padding:12px 16px;margin:16px 0;">
        ${rows
          .map(
            ([k, v]) =>
              `<p style="margin:0 0 4px;color:#333;font-size:14px;"><strong>${k}:</strong> ${v}</p>`,
          )
          .join('')}
       </div>`
    : ''
  return `
    <p style="margin:0 0 16px;color:#333;">Olá ${name.split(' ')[0]},</p>
    <p style="margin:0 0 8px;color:#333;">${intro}</p>
    ${detail}
    <a href="${PARCEIROS_URL}${ctaPath}" style="display:inline-block;background:#0a0a0a;color:#fff;padding:10px 24px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:500;margin-top:8px;">${ctaLabel}</a>
  `
}

export async function notifyPartnerNewLead(
  db: Db,
  args: {
    partnerId: string | null | undefined
    leadName?: string | null
    contactPhone?: string | null
    contactEmail?: string | null
  },
): Promise<void> {
  try {
    const p = await partnerContact(db, args.partnerId)
    if (!p) return
    const rows: Array<[string, string]> = []
    if (args.leadName) rows.push(['Contacto', args.leadName])
    if (args.contactPhone) rows.push(['Telefone', args.contactPhone])
    if (args.contactEmail) rows.push(['Email', args.contactEmail])
    await sendEmail({
      to: p.email,
      subject: '🔔 Nova lead recebida',
      bodyHtml: buildBody(
        p.name,
        'Recebeu uma nova lead no portal de parceiros.',
        rows,
        'Ver as minhas leads',
        '/leads',
      ),
    })
  } catch (err) {
    console.error('[notify-partner] new-lead email failed', err)
  }
}

export async function notifyPartnerNewCampaignRequest(
  db: Db,
  args: {
    partnerId: string | null | undefined
    objective?: string | null
    campaignType?: string | null
    requesterName?: string | null
    totalCost?: number | null
    currency?: string | null
  },
): Promise<void> {
  try {
    const p = await partnerContact(db, args.partnerId)
    if (!p) return
    const rows: Array<[string, string]> = []
    if (args.objective) rows.push(['Objectivo', args.objective])
    if (args.campaignType) rows.push(['Tipo', args.campaignType])
    if (args.totalCost != null)
      rows.push(['Orçamento', `${args.totalCost} ${args.currency || '€'}`])
    if (args.requesterName) rows.push(['Pedido por', args.requesterName])
    await sendEmail({
      to: p.email,
      subject: '📣 Novo pedido de campanha',
      bodyHtml: buildBody(
        p.name,
        'Tem um novo pedido de campanha para tratar no portal de parceiros.',
        rows,
        'Ver pedidos',
        '/meta',
      ),
    })
  } catch (err) {
    console.error('[notify-partner] campaign-request email failed', err)
  }
}
