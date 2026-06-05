import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ nipc: string }> }
) {
  try {
    const { nipc } = await params

    // Normalizar: remover nao-digitos e validar 9 digitos
    const normalized = nipc.replace(/\D/g, '')
    if (normalized.length !== 9) {
      return NextResponse.json(
        { error: 'NIPC inválido. Deve conter 9 dígitos.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.NIF_PT_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serviço de lookup NIPC não configurado' },
        { status: 503 }
      )
    }

    const res = await fetch(
      `https://www.nif.pt/?json=1&q=${normalized}&key=${apiKey}`
    )

    if (res.status === 429) {
      return NextResponse.json(
        { error: 'Demasiados pedidos. Tente novamente mais tarde.' },
        { status: 429 }
      )
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Erro ao consultar NIPC' },
        { status: 502 }
      )
    }

    const data = await res.json()

    if (!data.records || Object.keys(data.records).length === 0) {
      return NextResponse.json(
        { error: 'NIPC não encontrado' },
        { status: 404 }
      )
    }

    // Extrair o primeiro resultado
    const record = Object.values(data.records)[0] as Record<string, unknown>

    const contacts = record.contacts as Record<string, unknown> | undefined

    return NextResponse.json({
      nipc: normalized,
      nome: record.title || null,
      morada: record.address || null,
      telefone: contacts?.phone || null,
      email: contacts?.email || null,
      website: contacts?.website || null,
    })
  } catch (error) {
    console.error('Erro ao consultar NIPC:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
