import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { VOICE_TOOLS, buildConfirmText, type VoiceToolName } from '@/lib/voice/tools'

const SYSTEM_PROMPT = `És um assistente por voz do ERP imobiliário "Infinity Group".
Recebes uma transcrição em português de Portugal e deves escolher a ferramenta (tool) mais adequada e extrair os parâmetros com precisão.

REGRAS DE COMPORTAMENTO (CRÍTICAS):
- SE uma tool corresponde à intenção, CHAMA SEMPRE a tool — mesmo com argumentos parciais ou em falta. O utilizador completa o que faltar no ecrã de confirmação (review screen).
- NUNCA respondas em texto a pedir detalhes como data, hora, nome do cliente, referência, etc. — esses campos são preenchidos visualmente pelo utilizador; tu só tens de chamar a tool.
- SÓ respondes em texto quando a transcrição é absolutamente ambígua ou não corresponde a NENHUMA tool disponível.
- Não inventes dados. Se um campo não foi referido, deixa-o OMITIDO da chamada à tool (não inventes valores).

REGRAS DE EXTRACÇÃO:
- Responde sempre em português de Portugal.
- Para datas relativas ("amanhã", "sexta"), converte para ISO 8601 usando o contexto temporal fornecido.
- "Contacto" e "lead" são a mesma entidade — usa create_lead.
- Nunca traduzas nomes próprios.

CONFIANÇA (obrigatório):
- Sempre que chamares uma tool, inclui o campo "confidence" com valor "alta", "media" ou "baixa":
  - "alta": tens a certeza da intenção E os parâmetros-chave foram referidos.
  - "media": a intenção está clara mas faltam detalhes úteis (NORMAL — chama a tool na mesma).
  - "baixa": a mensagem é verdadeiramente ambígua ou não indica nenhuma intenção clara.`

const REFINE_PROMPT = `És um assistente por voz a REFINAR os argumentos de uma acção já escolhida.
A tool está fixa — não a mudes. Tens os argumentos actuais e uma nova frase do utilizador.

REGRAS DE INTERPRETAÇÃO (CRÍTICAS):
- A frase do utilizador é uma INSTRUÇÃO de modificação — NÃO é conteúdo para copiar literalmente.
- Identifica o verbo/intenção e aplica ao campo certo:
  * "diz também que X", "acrescenta que X", "adiciona X" → MODIFICA o conteúdo (ex: message) para incorporar X; NÃO metas "diz também que X" literalmente no campo.
  * "remove essa parte", "tira a última frase" → apaga do conteúdo existente.
  * "muda para email", "afinal por WhatsApp" → altera o canal/metadata; conteúdo inalterado.
  * "agenda para amanhã às 9h", "manda sexta às 15h" → preenche scheduled_at; message inalterada.
  * "afinal manda à Maria", "muda o destinatário para o Pedro" → altera contact_name.
  * "muda o assunto para X" → altera subject (só email).

EXEMPLOS (send_message):
- args.message="chego amanhã às 18h." + utilizador diz "diz também que não estou preparado e vou chegar atrasado"
  → message="Chego amanhã às 18h. Não estou preparado e vou chegar atrasado."
  (NÃO: message="chego amanhã às 18h. Diz também que não estou preparado...")
- args.message="Olá João" + utilizador diz "acrescenta que a reunião é na sala 3"
  → message="Olá João. A reunião é na sala 3."
- args.channel="whatsapp" + utilizador diz "afinal manda por email"
  → channel="email" (restantes campos preservados)

REGRAS GERAIS:
- Preserva TODOS os campos que o utilizador não alterou explicitamente.
- Devolve SEMPRE os args completos (existentes + alterados) numa única chamada à tool, incluindo o campo "confidence".
- Se a instrução for ambígua, devolve o state actual sem alterações.
- Responde em português de Portugal.`

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Serviço de IA não configurado' }, { status: 503 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const transcript: string = (body?.transcript ?? '').toString().trim()
    const pathname: string = (body?.context?.pathname ?? '/').toString()
    const existingTool: VoiceToolName | undefined = body?.context?.existingTool
    const existingArgs: Record<string, any> | undefined = body?.context?.existingArgs

    if (!transcript) {
      return NextResponse.json({ tool: null, message: 'Transcrição vazia.' })
    }

    const now = new Date().toISOString()
    const openai = new OpenAI({ apiKey })

    const isRefine = Boolean(existingTool)
    const toolList = isRefine
      ? VOICE_TOOLS.filter((t) => t.type === 'function' && t.function.name === existingTool)
      : VOICE_TOOLS

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: isRefine ? REFINE_PROMPT : SYSTEM_PROMPT },
      { role: 'system', content: `Contexto actual — página: ${pathname}; data/hora: ${now}.` },
    ]

    if (isRefine && existingArgs) {
      messages.push({
        role: 'system',
        content: `Tool fixa: ${existingTool}. Argumentos já conhecidos: ${JSON.stringify(
          existingArgs
        )}. Preserva estes valores e adiciona/corrige com base no que o utilizador disser a seguir.`,
      })
    }

    messages.push({ role: 'user', content: transcript })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages,
      tools: toolList,
      tool_choice: isRefine
        ? { type: 'function', function: { name: existingTool as string } }
        : 'auto',
    })

    const msg = completion.choices[0]?.message
    const toolCall = msg?.tool_calls?.[0]

    if (!toolCall || toolCall.type !== 'function') {
      return NextResponse.json({
        tool: null,
        message: msg?.content?.trim() || 'Não percebi. Podes repetir?',
        transcript,
      })
    }

    let args: Record<string, any> = {}
    try {
      args = JSON.parse(toolCall.function.arguments || '{}')
    } catch {
      args = {}
    }

    const confidence = (args.confidence as string | undefined)?.toLowerCase()
    delete args.confidence

    // Low confidence on INITIAL intent → ask for clarification.
    // For refine, still return the updated args so the user can review.
    if (!isRefine && confidence === 'baixa') {
      return NextResponse.json({
        tool: null,
        message: 'Não tenho a certeza do que pretendes. Podes ser mais específico?',
        transcript,
      })
    }

    const tool = toolCall.function.name

    return NextResponse.json({
      tool,
      args,
      confirmText: buildConfirmText(tool, args),
      confidence: confidence ?? null,
      transcript,
    })
  } catch (error) {
    console.error('Erro em voice-intent:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
