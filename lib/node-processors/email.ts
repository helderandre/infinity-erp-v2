import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, EmailNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext, DeliveryEntry } from "./index"
import { resolveVariablesInString } from "./index"

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
  const d = node.data as EmailNodeData
  const vars = context.variables

  // --- Sender config ---
  const senderName = d.senderName || "Infinity Group"
  const senderEmail = d.senderEmail || "info@infinitygroup.pt"

  if (!senderEmail.endsWith("@infinitygroup.pt")) {
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
  } catch (err) {
    delivery.status = "failed"
    delivery.errorMessage = err instanceof Error ? err.message : "Erro desconhecido"
  }

  // Log in auto_delivery_log
  await (supabase as SA).from("auto_delivery_log").insert({
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

  // Log in log_emails
  await (supabase as SA).from("log_emails").insert({
    sender_name: senderName,
    sender_email: senderEmail,
    recipient_email: recipientEmail,
    subject,
    body_html: bodyHtml,
    delivery_status: delivery.status === "sent" ? "sent" : "failed",
    provider_id: delivery.externalMessageId,
    sent_at: new Date().toISOString(),
    metadata: { source: "automation", flow_id: flowMeta.flowId, run_id: flowMeta.runId },
  }).catch(() => {}) // Non-critical

  if (delivery.status === "failed") throw new Error(delivery.errorMessage || "Falha ao enviar email")

  return {
    output: { emailId: delivery.externalMessageId, recipient: recipientEmail },
    deliveries: [delivery],
    durationMs: Date.now() - start,
  }
}
