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
      images.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
      })
    }

    if (backFile) {
      const buffer = Buffer.from(await backFile.arrayBuffer())
      const base64 = buffer.toString("base64")
      const mimeType = backFile.type || "image/jpeg"
      images.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
      })
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a document data extraction assistant. You extract information from Portuguese identity documents (Cartão de Cidadão, BI, or Passport).

Extract the following fields and return them as JSON. Use null for any field you cannot find or read clearly.

Required JSON format:
{
  "full_name": string | null,
  "cc_number": string | null,  // Full number including final check digits
  "cc_expiry": string | null,  // Format: YYYY-MM-DD
  "cc_issue_date": string | null,  // Format: YYYY-MM-DD
  "date_of_birth": string | null,  // Format: YYYY-MM-DD
  "nif": string | null,  // Número de Identificação Fiscal / Contribuinte
  "niss": string | null,  // Número de Segurança Social
  "naturalidade": string | null,  // Place of birth / Naturalidade / Freguesia
  "estado_civil": string | null  // Marital status in Portuguese (Solteiro/a, Casado/a, Divorciado/a, Viúvo/a, União de facto)
}

Return ONLY the JSON object, no markdown, no explanation.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all available information from this Portuguese identity document (front and/or back).",
            },
            ...images,
          ],
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
