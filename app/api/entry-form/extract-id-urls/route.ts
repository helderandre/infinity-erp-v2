import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { front_url, back_url } = await request.json()

    if (!front_url && !back_url) {
      return NextResponse.json({ error: "Nenhum documento enviado" }, { status: 400 })
    }

    // Fetch images and convert to base64 for reliable GPT-4o processing
    async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
      try {
        const res = await fetch(url)
        if (!res.ok) return null
        const buffer = Buffer.from(await res.arrayBuffer())
        const mimeType = res.headers.get('content-type') || 'image/jpeg'
        return { base64: buffer.toString('base64'), mimeType }
      } catch {
        return null
      }
    }

    const images: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []

    if (front_url) {
      const img = await urlToBase64(front_url)
      if (img) {
        images.push(
          { type: "text", text: "FRENTE do Cartão de Cidadão (contém: nome, número do CC, data de nascimento, validade, data de emissão, foto):" },
          { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" } },
        )
      }
    }

    if (back_url) {
      const img = await urlToBase64(back_url)
      if (img) {
        images.push(
          { type: "text", text: "VERSO do Cartão de Cidadão (contém: NIF/número de contribuinte, NISS/segurança social, naturalidade/freguesia, filiação, estado civil):" },
          { type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" } },
        )
      }
    }

    if (images.length === 0) {
      return NextResponse.json({ error: "Não foi possível descarregar as imagens do documento." }, { status: 400 })
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Extrais dados de documentos de identificação portugueses (Cartão de Cidadão).
Vais receber DUAS imagens: a FRENTE e o VERSO do mesmo cartão. Cada lado tem informações diferentes.

FRENTE do CC contém: nome completo, número do documento, data de nascimento, data de validade, data de emissão.
VERSO do CC contém: NIF (número de contribuinte), NISS (segurança social), naturalidade/freguesia, nomes dos pais, estado civil.

Extrai todos os campos possíveis de AMBOS os lados e retorna como JSON. Usa null para campos que não consigas ler.

Formato JSON obrigatório:
{
  "full_name": string | null,
  "document_type": "Cartão de Cidadão" | "Bilhete de Identidade" | "Passaporte",
  "cc_number": string | null,
  "cc_expiry": string | null,
  "cc_issue_date": string | null,
  "date_of_birth": string | null,
  "nif": string | null,
  "niss": string | null,
  "naturalidade": string | null,
  "estado_civil": string | null
}

Para document_type: identifica o tipo de documento nas imagens. Se for um Cartão de Cidadão português usa "Cartão de Cidadão". Se for um BI antigo usa "Bilhete de Identidade". Se for passaporte usa "Passaporte".

Para datas usa formato YYYY-MM-DD.
Retorna APENAS o JSON, sem markdown, sem explicações.`,
        },
        {
          role: "user",
          content: images,
        },
      ],
      max_tokens: 1000,
      temperature: 0,
      response_format: { type: "json_object" },
    })

    const content = response.choices[0]?.message?.content?.trim() ?? ""
    console.log('[Extract ID URLs] GPT response:', content.substring(0, 500))

    let extracted: Record<string, string | null>
    try {
      // Try multiple cleaning strategies
      let jsonStr = content
      // Remove markdown code fences
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      // Try to find JSON object in the response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonStr = jsonMatch[0]
      }
      extracted = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('[Extract ID URLs] Parse error:', parseErr, 'Raw:', content)
      return NextResponse.json(
        { error: "Não foi possível extrair dados do documento. A IA não retornou dados estruturados." },
        { status: 422 }
      )
    }

    return NextResponse.json({ extracted })
  } catch (error) {
    console.error("[Extract ID URLs] Error:", error)
    return NextResponse.json(
      { error: "Erro ao processar documento" },
      { status: 500 }
    )
  }
}
