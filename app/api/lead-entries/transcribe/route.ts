import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Ficheiro de audio obrigatorio' }, { status: 400 })
    }

    // Step 1: Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      language: 'pt',
    })

    const text = transcription.text

    // Step 2: Extract structured data with GPT
    const extraction = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `Extrai dados de contacto de uma transcricao de voz em portugues. Responde APENAS com JSON valido, sem markdown.
Campos a extrair:
- name: nome completo da pessoa
- email: email (null se nao mencionado)
- phone: numero de telefone/telemovel (null se nao mencionado)
- source: origem do lead se mencionada (ex: "facebook", "instagram", "site", "referencia") — null se nao mencionada
- notes: qualquer informacao adicional relevante (interesses, observacoes, contexto)

Formato: { "name": "...", "email": "...", "phone": "...", "source": "...", "notes": "..." }`
        },
        { role: 'user', content: text },
      ],
    })

    let extracted: Record<string, unknown> = {}
    try {
      const content = extraction.choices[0]?.message?.content || '{}'
      extracted = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
    } catch {
      extracted = { name: '', notes: text }
    }

    return NextResponse.json({
      transcription: text,
      extracted,
    })
  } catch (error) {
    console.error('Erro na transcricao:', error)
    return NextResponse.json({ error: 'Erro ao transcrever audio' }, { status: 500 })
  }
}
