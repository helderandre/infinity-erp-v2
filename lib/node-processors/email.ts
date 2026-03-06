import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, EmailNodeData } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext, DeliveryEntry } from "./index"
import { resolveVariablesInString } from "./index"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

export const processEmail: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string }
) => Promise<NodeProcessResult> = async (supabase, node, context, flowMeta) => {
  const start = Date.now()
  const d = node.data as EmailNodeData
  const vars = context.variables

  // Strip {{}} if present (legacy data may have wrapped keys)
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

  let subject = d.subject || ""
  let bodyHtml = d.bodyHtml || ""

  // Load template if configured
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

  const resendKey = process.env.RESEND
  if (!resendKey) throw new Error("RESEND API key não configurada")

  const delivery: DeliveryEntry = {
    channel: "email",
    recipientAddress: recipientEmail,
    messageType: "email",
    finalContent: subject,
    status: "sent",
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "ERP Infinity <noreply@infinitygroup.pt>",
        to: [recipientEmail],
        subject,
        html: bodyHtml,
      }),
    })

    const resData = await response.json().catch(() => ({}))
    delivery.externalMessageId = resData?.id
    if (!response.ok) {
      delivery.status = "failed"
      delivery.errorMessage = resData?.message || `HTTP ${response.status}`
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

  // Log in log_emails (existing table)
  await (supabase as SA).from("log_emails").insert({
    recipient_email: recipientEmail,
    subject,
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
