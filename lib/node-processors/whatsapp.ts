import type { SupabaseClient } from "@supabase/supabase-js"
import type { AutomationNode, WhatsAppNodeData, WhatsAppMessage } from "@/lib/types/automation-flow"
import type { NodeProcessResult, ExecutionContext, DeliveryEntry } from "./index"
import { resolveVariablesInString } from "./index"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

const MIN_DELAY_MS = 1500

export const processWhatsApp: (
  supabase: SupabaseClient,
  node: AutomationNode,
  context: ExecutionContext,
  flowMeta: { flowId: string; runId: string; wppInstanceId?: string | null }
) => Promise<NodeProcessResult> = async (supabase, node, context, flowMeta) => {
  const start = Date.now()
  const d = node.data as WhatsAppNodeData
  const vars = context.variables

  // Get recipient number — prefer recipientVariable from node config
  // Strip {{}} if present (legacy data may have wrapped keys)
  let recipientVar = d.recipientVariable || ""
  recipientVar = recipientVar.replace(/^\{\{/, "").replace(/\}\}$/, "").trim()

  let recipientNumber = ""
  if (recipientVar) {
    // If it looks like a variable key (no spaces, no +), resolve from context
    if (vars[recipientVar]) {
      recipientNumber = vars[recipientVar]
    } else {
      // Try resolving as template string (may contain {{}} or be a literal number)
      recipientNumber = resolveVariablesInString(d.recipientVariable || "", vars)
    }
  }
  if (!recipientNumber) {
    recipientNumber = vars.lead_telemovel || vars.lead_telefone ||
      vars.proprietario_telefone || vars.recipient_phone || ""
  }
  if (!recipientNumber) {
    if (recipientVar) {
      throw new Error(`A variavel "${recipientVar}" esta vazia. Verifica se o webhook enviou o numero de telefone.`)
    }
    throw new Error("Destinatario nao configurado no node WhatsApp. Abre o node e selecciona o campo 'Enviar para'.")
  }

  // Get instance token
  const instanceId = flowMeta.wppInstanceId
  if (!instanceId) throw new Error("Nenhuma instância WhatsApp configurada no fluxo")

  const { data: instance } = await (supabase as SA)
    .from("auto_wpp_instances")
    .select("name, uazapi_token, connection_status")
    .eq("id", instanceId)
    .single()
  if (!instance?.uazapi_token) throw new Error("Token da instância WhatsApp não encontrado. Verifica se a instância ainda existe.")
  if (instance.connection_status !== "connected") {
    throw new Error(`A instância "${instance.name}" não está conectada (estado: ${instance.connection_status}). Conecta-a antes de enviar.`)
  }

  // Resolve messages — from template or inline
  let messages: WhatsAppMessage[] = d.messages || []
  if (d.templateId && (!messages || messages.length === 0)) {
    const { data: template } = await (supabase as SA)
      .from("auto_wpp_templates")
      .select("messages")
      .eq("id", d.templateId)
      .single()
    if (template?.messages) messages = template.messages
  }

  if (!messages.length) throw new Error("Nenhuma mensagem WhatsApp configurada")

  const baseUrl = process.env.UAZAPI_URL
  if (!baseUrl) throw new Error("UAZAPI_URL não configurado")

  const deliveries: DeliveryEntry[] = []
  const messageIds: string[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const content = resolveVariablesInString(msg.content || "", vars)

    // Rate limiting between messages
    if (i > 0) await sleep(Math.max(MIN_DELAY_MS, (msg.delay || 2) * 1000))

    const delivery: DeliveryEntry = {
      channel: "whatsapp",
      recipientAddress: recipientNumber,
      messageType: msg.type,
      finalContent: content,
      mediaUrl: msg.mediaUrl,
      status: "sent",
    }

    try {
      let response: Response

      if (msg.type === "text") {
        response = await fetch(`${baseUrl}/send/text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: instance.uazapi_token,
          },
          body: JSON.stringify({
            number: recipientNumber,
            text: content,
            delay: msg.delay || 2,
            readchat: true,
            track_source: "erp_infinity",
            track_id: flowMeta.runId,
          }),
        })
      } else {
        // Media types: image, video, audio, ptt, document
        const mediaBody: SA = {
          number: recipientNumber,
          type: msg.type,
          file: msg.mediaUrl || "",
          delay: msg.delay || 2,
          readchat: true,
          track_source: "erp_infinity",
          track_id: flowMeta.runId,
        }
        if (msg.type === "image" || msg.type === "video") mediaBody.text = content
        if (msg.type === "document") mediaBody.docName = msg.docName || "documento"
        response = await fetch(`${baseUrl}/send/media`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: instance.uazapi_token,
          },
          body: JSON.stringify(mediaBody),
        })
      }

      const resData = await response.json().catch(() => ({}))
      delivery.externalMessageId = resData?.key?.id || resData?.id || undefined
      if (!response.ok) {
        delivery.status = "failed"
        delivery.errorMessage = resData?.error || `HTTP ${response.status}`
      }
    } catch (err) {
      delivery.status = "failed"
      delivery.errorMessage = err instanceof Error ? err.message : "Erro desconhecido"
    }

    deliveries.push(delivery)
    if (delivery.externalMessageId) messageIds.push(delivery.externalMessageId)
  }

  // Log deliveries
  for (const del of deliveries) {
    await (supabase as SA).from("auto_delivery_log").insert({
      step_run_id: null, // Will be set by the worker
      run_id: flowMeta.runId,
      flow_id: flowMeta.flowId,
      channel: "whatsapp",
      recipient_address: del.recipientAddress,
      message_type: del.messageType,
      final_content: del.finalContent,
      media_url: del.mediaUrl,
      status: del.status === "sent" ? "sent" : "failed",
      external_message_id: del.externalMessageId,
      error_message: del.errorMessage,
      sent_at: del.status === "sent" ? new Date().toISOString() : null,
    })
  }

  const failedCount = deliveries.filter(d => d.status === "failed").length
  if (failedCount === deliveries.length) throw new Error("Todas as mensagens falharam")

  return {
    output: { messageIds, sent: deliveries.length - failedCount, failed: failedCount },
    deliveries,
    durationMs: Date.now() - start,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
