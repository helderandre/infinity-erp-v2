import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cp: string }> }
) {
  try {
    const { cp } = await params

    // Normalizar: aceitar "4000-001" ou "4000001"
    const normalized = cp.replace(/[^0-9]/g, '')
    const match = normalized.match(/^(\d{4})(\d{3})$/)

    if (!match) {
      // Tentar formato com hifen
      const withHyphen = cp.match(/^(\d{4})-?(\d{3})$/)
      if (!withHyphen) {
        return NextResponse.json(
          { error: 'Formato de código postal inválido. Use XXXX-XXX ou XXXXXXX.' },
          { status: 400 }
        )
      }
    }

    const cp4 = match ? match[1] : cp.split('-')[0]
    const cp3 = match ? match[2] : cp.split('-')[1]

    const res = await fetch(
      `https://json.geoapi.pt/cp/${cp4}-${cp3}?json=1`,
      { next: { revalidate: 86400 } } // cache 24h
    )

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: 'Código postal não encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Erro ao consultar código postal' },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao consultar código postal:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
