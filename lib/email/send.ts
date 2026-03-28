/**
 * Send an email via Supabase Edge Function (Resend).
 * Used for transactional emails (welcome, notifications, etc.)
 */

const LOGO_URL = 'https://pub-bef71a0a79874613a953a43eb1ba58be.r2.dev/landing-page/43f87d7c-92b5-4403-b7bb-618c8d4a2b9e.png'

interface SendEmailParams {
  to: string
  subject: string
  bodyHtml: string
  from?: string
  fromName?: string
}

/**
 * Wraps body HTML in a branded email template with Infinity Group header/footer.
 */
export function wrapInBrandedTemplate(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    .fallback-font { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 32px 16px;">
    <!-- Header -->
    <div style="text-align: center; padding: 32px 24px; background-color: #0a0a0a; border-radius: 16px 16px 0 0;">
      <img src="${LOGO_URL}" alt="Infinity Group" style="height: 48px; margin-bottom: 8px;" />
    </div>

    <!-- Body -->
    <div style="background-color: #ffffff; padding: 32px 28px; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5;">
      ${bodyHtml}
    </div>

    <!-- Footer -->
    <div style="background-color: #fafafa; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 16px 16px; padding: 24px 28px; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #737373;">
        Infinity Group — Mediação Imobiliária
      </p>
      <p style="margin: 0; font-size: 11px; color: #a3a3a3;">
        Este email foi enviado automaticamente. Por favor não responda directamente a este email.
      </p>
      <p style="margin: 8px 0 0; font-size: 11px; color: #a3a3a3;">
        © ${new Date().getFullYear()} Infinity Group. Todos os direitos reservados.
      </p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Replaces {{variables}} in a string with values from a map.
 */
export function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => variables[key] || match)
}

/**
 * Send a branded email via the Supabase Edge Function.
 */
export async function sendEmail({
  to,
  subject,
  bodyHtml,
  from = 'geral@infinitygroup.pt',
  fromName = 'Infinity Group',
}: SendEmailParams): Promise<{ success: boolean; error?: string; id?: string }> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'SUPABASE_URL ou SUPABASE_ANON_KEY não configuradas' }
  }

  const wrappedHtml = wrapInBrandedTemplate(bodyHtml)

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        senderName: fromName,
        senderEmail: from,
        recipientEmail: to,
        subject,
        body: wrappedHtml,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data?.success) {
      return { success: false, error: data?.error || data?.message || `HTTP ${response.status}` }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}
