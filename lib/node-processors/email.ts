import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, EmailNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext, DeliveryEntry } from "./index"
import { resolveVariablesInString } from "./index"
import { resolveEmailAccountById } from "@/lib/email/resolve-account-admin"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

function wrapEmailForCompatibility(bodyHtml: string): string {
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
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    ${bodyHtml}
  </div>
</body>
</html>`
}

export const processEmail: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (supabase, node, context, flowMeta) => {
  const start = Date.now()
  const d = node.data as EmailNodeData & {
    smtpAccountId?: string | null
    overrideSubject?: string
    overrideBodyHtml?: string
  }
  const vars = context.variables

  // --- Sender config ---
  // Contact automations passam smtpAccountId — resolvemos a conta do consultor
  // e enviamos via Edge Function smtp-send. Caso contrário, fallback legacy.
  const useConsultantSmtp = !!d.smtpAccountId
  let senderName = d.senderName || "Infinity Group"
  let senderEmail = d.senderEmail || "info@infinitygroup.pt"
  let smtpCreds:
    | { host: string; port: number; secure: boolean; user: string; pass: string }
    | null = null

  if (useConsultantSmtp) {
    const resolved = await resolveEmailAccountById(supabase, d.smtpAccountId as string)
    if (!resolved.ok) {
      throw new Error(`SMTP: ${resolved.error}`)
    }
    senderName = resolved.data.account.display_name
    senderEmail = resolved.data.account.email_address
    smtpCreds = {
      host: resolved.data.account.smtp_host,
      port: resolved.data.account.smtp_port,
      secure: resolved.data.account.smtp_secure,
      user: resolved.data.account.email_address,
      pass: resolved.data.password,
    }
  } else if (!senderEmail.endsWith("@infinitygroup.pt")) {
    throw new Error(`Email do remetente invalido: "${senderEmail}". Deve usar @infinitygroup.pt`)
  }

  // --- Recipient ---
  let recipientVar = d.recipientVariable || ""
  recipientVar = recipientVar.replace(/^\{\{/, "").replace(/\}\}$/, "").trim()

  let recipientEmail = ""
  if (recipientVar) {
    if (vars[recipientVar]) {
      recipientEmail = vars[recipientVar]
    } else {
      recipientEmail = resolveVariablesInString(d.recipientVariable || "", vars)
    }
  }
  if (!recipientEmail) {
    recipientEmail = vars.lead_email || vars.proprietario_email || ""
  }
  if (!recipientEmail) {
    if (recipientVar) {
      throw new Error(`A variavel "${recipientVar}" esta vazia. Verifica se o webhook enviou o email.`)
    }
    throw new Error("Destinatario nao configurado no node Email. Abre o node e selecciona o campo 'Enviar para'.")
  }

  // --- Subject & Body ---
  let subject = d.subject || ""
  let bodyHtml = d.bodyHtml || ""

  if (d.emailTemplateId) {
    const { data: template } = await (supabase as SA)
      .from("tpl_email_library")
      .select("subject, body_html")
      .eq("id", d.emailTemplateId)
      .single()
    if (template) {
      subject = template.subject || subject
      bodyHtml = template.body_html || bodyHtml
    }
  }

  // Overrides per-instância (contact_automations.template_overrides)
  if (d.overrideSubject) subject = d.overrideSubject
  if (d.overrideBodyHtml) bodyHtml = d.overrideBodyHtml

  subject = resolveVariablesInString(subject, vars)
  bodyHtml = resolveVariablesInString(bodyHtml, vars)

  // Wrap for Gmail/Outlook compatibility
  const wrappedHtml = wrapEmailForCompatibility(bodyHtml)

  // --- Send via Supabase Edge Function (has RESEND_API_KEY configured) ---
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL ou SUPABASE_ANON_KEY nao configuradas")
  }

  const delivery: DeliveryEntry = {
    channel: "email",
    recipientAddress: recipientEmail,
    messageType: "email",
    finalContent: subject,
    status: "sent",
  }

  try {
    if (smtpCreds) {
      // Envio via SMTP do consultor (Edge Function smtp-send)
      const edgeSecret = process.env.EDGE_SMTP_SECRET || ""
      const response = await fetch(`${SUPABASE_URL}/functions/v1/smtp-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(edgeSecret ? { "x-edge-secret": edgeSecret } : {}),
        },
        body: JSON.stringify({
          smtp: smtpCreds,
          from: { name: senderName, address: senderEmail },
          to: [recipientEmail],
          subject,
          html: wrappedHtml,
        }),
      })
      const resData = await response.json().catch(() => ({}))
      delivery.externalMessageId = resData?.messageId || resData?.id
      if (!response.ok || resData?.success === false) {
        delivery.status = "failed"
        delivery.errorMessage = resData?.error || resData?.message || `HTTP ${response.status}`
      }
    } else {
      // Envio via send-email (Resend, sender @infinitygroup.pt)
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          senderName,
          senderEmail,
          recipientEmail,
          subject,
          body: wrappedHtml,
        }),
      })
      const resData = await response.json().catch(() => ({}))
      delivery.externalMessageId = resData?.id
      if (!response.ok || !resData?.success) {
        delivery.status = "failed"
        delivery.errorMessage = resData?.error || resData?.message || `HTTP ${response.status}`
      }
    }
  } catch (err) {
    delivery.status = "failed"
    delivery.errorMessage = err instanceof Error ? err.message : "Erro desconhecido"
  }

  // Log in auto_delivery_log (non-critical — must not fail the step)
  try {
    const { error: deliveryLogErr } = await (supabase as SA).from("auto_delivery_log").insert({
      run_id: flowMeta.runId,
      flow_id: flowMeta.flowId,
      channel: "email",
      recipient_address: recipientEmail,
      message_type: "email",
      final_content: subject,
      status: delivery.status === "sent" ? "sent" : "failed",
      external_message_id: delivery.externalMessageId,
      error_message: delivery.errorMessage,
      sent_at: delivery.status === "sent" ? new Date().toISOString() : null,
    })
    if (deliveryLogErr) console.error("[EMAIL] Erro ao registar delivery log:", deliveryLogErr.message)
  } catch (e) {
    console.error("[EMAIL] Delivery log exception:", e)
  }

  // Log in log_emails (non-critical)
  try {
    const { error: emailLogErr } = await (supabase as SA).from("log_emails").insert({
      sender_name: senderName,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      subject,
      body_html: bodyHtml,
      delivery_status: delivery.status === "sent" ? "sent" : "failed",
      provider_id: delivery.externalMessageId,
      sent_at: new Date().toISOString(),
      metadata: { source: "automation", flow_id: flowMeta.flowId, run_id: flowMeta.runId },
    })
    if (emailLogErr) console.error("[EMAIL] Erro ao registar email log:", emailLogErr.message)
  } catch (e) {
    console.error("[EMAIL] Email log exception:", e)
  }

  if (delivery.status === "failed") throw new Error(delivery.errorMessage || "Falha ao enviar email")

  return {
    output: { emailId: delivery.externalMessageId, recipient: recipientEmail },
    deliveries: [delivery],
    durationMs: Date.now() - start,
  }
}
