import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_URL = 'https://api.resend.com/emails'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface EmailAttachment {
  /** Display filename for the attachment (e.g. "contrato.pdf") */
  filename: string
  /** Publicly accessible URL to the file — Resend will fetch and attach it */
  path: string
}

interface SendEmailPayload {
  senderName: string
  senderEmail: string
  recipientEmail: string
  cc?: string[]
  subject: string
  body: string
  /** Optional file attachments — each must have a publicly accessible URL */
  attachments?: EmailAttachment[]
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY não configurada.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let payload: SendEmailPayload

  try {
    payload = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Body inválido. Envie um JSON válido.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { senderName, senderEmail, recipientEmail, cc, subject, body, attachments } = payload

  // Validação dos campos obrigatórios
  if (!senderName || !senderEmail || !recipientEmail || !subject || !body) {
    return new Response(
      JSON.stringify({
        error: 'Campos obrigatórios em falta.',
        required: ['senderName', 'senderEmail', 'recipientEmail', 'subject', 'body'],
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Construir payload do Resend
  const resendPayload: Record<string, unknown> = {
    from: `${senderName} <${senderEmail}>`,
    to: [recipientEmail],
    subject,
    html: body,
  }

  if (cc && Array.isArray(cc) && cc.length > 0) {
    resendPayload.cc = cc
  }

  if (attachments && Array.isArray(attachments) && attachments.length > 0) {
    resendPayload.attachments = attachments
  }

  // Enviar via Resend API
  let resendResponse: Response
  try {
    resendResponse = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Erro ao contactar a API do Resend.', details: String(err) }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const resendData = await resendResponse.json()

  if (!resendResponse.ok) {
    return new Response(
      JSON.stringify({
        error: 'Falha ao enviar email.',
        resend: resendData,
      }),
      { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Email enviado com sucesso.',
      id: resendData.id,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
