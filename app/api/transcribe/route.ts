import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serviço de IA não configurado' },
        { status: 503 }
      )
    }

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
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

    const file = new File([audioFile], 'audio.webm', { type: 'audio/webm' })

    // Domain vocabulary hint — biases Whisper toward known brand and
    // real-estate terms so words like "Gmail" don't come back as "gay mail".
    const WHISPER_PROMPT =
      'Transcrição em português de Portugal. Vocabulário comum: Gmail, Outlook, WhatsApp, iPhone, Android, Instagram, LinkedIn, Facebook, Google, Apple, Microsoft, Zoom, Slack, Teams, T0, T1, T2, T3, T4, T5, Lisboa, Porto, Algarve, Cascais, Oeiras, Sintra, apartamento, moradia, terreno, comercial, arrendamento, venda, trespasse, angariação, fecho, negócio, contacto, imóvel, cliente, proprietário, consultor, comissão, CPCV, IMI, NIF, NIPC, código postal, euros.'

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'pt',
      prompt: WHISPER_PROMPT,
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
