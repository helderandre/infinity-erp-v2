import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { VOICE_TOOLS, buildConfirmText, type VoiceToolName } from '@/lib/voice/tools'

const SYSTEM_PROMPT = `És um assistente por voz do ERP imobiliário "Infinity Group".
Recebes uma transcrição em português de Portugal e deves escolher a ferramenta (tool) mais adequada e extrair os parâmetros com precisão.

REGRAS:
- Responde sempre em português de Portugal.
- Não inventes dados. Se um campo não foi referido, deixa-o por preencher.
- Para datas relativas ("amanhã", "sexta"), converte para ISO 8601 usando o contexto temporal fornecido.
- "Contacto" e "lead" são a mesma entidade — usa create_lead.
- Nunca traduzas nomes próprios.

CONFIANÇA (obrigatório):
- Sempre que chamares uma tool, inclui o campo "confidence" com valor "alta", "media" ou "baixa":
  - "alta": tens a certeza da intenção E os parâmetros-chave foram referidos.
  - "media": a intenção está clara mas faltam detalhes úteis.
  - "baixa": a mensagem é ambígua — preferes NÃO chamar a tool.
- Se não corresponder a nenhuma tool disponível, NÃO chames nenhuma — responde em texto.`

const REFINE_PROMPT = `És um assistente por voz a REFINAR os argumentos de uma acção já escolhida.
A tool está fixa — não a mudes. Tens os argumentos actuais e uma nova frase do utilizador.
Actualiza/completa os argumentos, preservando os existentes excepto quando o utilizador corrigir explicitamente.
Devolve SEMPRE os args completos (existentes + novos/alterados) numa única chamada à tool, incluindo o campo "confidence".
Responde em português de Portugal.`

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
