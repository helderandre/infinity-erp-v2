import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import OpenAI from 'openai'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    await params // validate param exists

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serviço de IA não configurado' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio')

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Ficheiro de áudio em falta' },
        { status: 400 }
      )
    }

    const openai = new OpenAI({ apiKey })

    // Converter Blob para File
    const file = new File([audioFile], 'audio.webm', { type: 'audio/webm' })

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'pt',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (error) {
    console.error('Erro na transcrição:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
