import { NextResponse } from 'next/server'

// Resolve uma freguesia portuguesa por nome para Concelho + Distrito.
// Usa o endpoint público da geoapi.pt (mesmo provider que /api/postal-code).
//
// Resposta: array de matches (já normalizados):
//   [{ freguesia, concelho, distrito }]
//
// Múltiplos matches são possíveis (ex: "São Pedro" existe em vários
// concelhos) — a UI lida com isso e só auto-preenche quando o array tem
// exactamente 1 entrada. Cache de 7 dias porque a divisão administrativa
// não muda com frequência.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nome: string }> },
) {
  try {
    const { nome } = await params
    const trimmed = decodeURIComponent(nome).trim()
    if (!trimmed || trimmed.length < 2) {
      return NextResponse.json([], { status: 200 })
    }

    const url = `https://json.geoapi.pt/freguesia/${encodeURIComponent(trimmed)}?json=1`
    const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } })

    if (!res.ok) {
      // 404 da geoapi → ausência de match, devolvemos array vazio (não erro).
      if (res.status === 404) return NextResponse.json([], { status: 200 })
      return NextResponse.json(
        { error: 'Erro ao consultar divisão administrativa' },
        { status: 502 },
      )
    }

    const data = await res.json().catch(() => null)
    if (!data) return NextResponse.json([], { status: 200 })

    // A geoapi pode devolver um objecto único OU um array conforme houver 1
    // ou várias matches. Normalizamos para array.
    const list = Array.isArray(data) ? data : [data]

    const normalised = list
      .map((entry: any) => {
        const freguesia = entry?.nome || entry?.freguesia || entry?.Freguesia || null
        const concelho = entry?.concelho || entry?.Concelho || entry?.municipio || entry?.Municipio || null
        const distrito = entry?.distrito || entry?.Distrito || null
        if (!freguesia || !concelho || !distrito) return null
        return {
          freguesia: String(freguesia),
          concelho: String(concelho),
          distrito: String(distrito),
        }
      })
      .filter(Boolean) as Array<{ freguesia: string; concelho: string; distrito: string }>

    return NextResponse.json(normalised)
  } catch (error) {
    console.error('Erro ao consultar freguesia:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
