import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const frontFile = formData.get("front") as File | null
    const backFile = formData.get("back") as File | null

    if (!frontFile && !backFile) {
      return NextResponse.json({ error: "Nenhum documento enviado" }, { status: 400 })
    }

    const images: OpenAI.Chat.Completions.ChatCompletionContentPart[] = []

    if (frontFile) {
      const buffer = Buffer.from(await frontFile.arrayBuffer())
      const base64 = buffer.toString("base64")
      const mimeType = frontFile.type || "image/jpeg"
      images.push(
        { type: "text", text: "FRENTE do Cartão de Cidadão (contém: nome, número do CC, data de nascimento, validade, data de emissão, foto):" },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
      )
    }

    if (backFile) {
      const buffer = Buffer.from(await backFile.arrayBuffer())
      const base64 = buffer.toString("base64")
      const mimeType = backFile.type || "image/jpeg"
      images.push(
        { type: "text", text: "VERSO do Cartão de Cidadão (contém: NIF/número de contribuinte, NISS/segurança social, naturalidade/freguesia, filiação, estado civil):" },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } },
      )
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
  "cc_number": string | null,
  "cc_expiry": string | null,
  "cc_issue_date": string | null,
  "date_of_birth": string | null,
  "nif": string | null,
  "niss": string | null,
  "naturalidade": string | null,
  "estado_civil": string | null
}

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
    })

    const content = response.choices[0]?.message?.content?.trim() ?? ""

    // Parse JSON from response (handle potential markdown wrapping)
    let extracted: Record<string, string | null>
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      extracted = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: "Não foi possível extrair dados do documento. Tente com uma imagem mais clara." },
        { status: 422 }
      )
    }

    return NextResponse.json({ extracted })
  } catch (error) {
    console.error("[Extract ID] Error:", error)
    return NextResponse.json(
      { error: "Erro ao processar documento" },
      { status: 500 }
    )
  }
}
