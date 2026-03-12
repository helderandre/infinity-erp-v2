import { NextResponse } from 'next/server'
import { glimpse } from '@/components/kibo-ui/glimpse/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'URL é obrigatório' }, { status: 400 })
  }

  try {
    new URL(url) // validate URL
  } catch {
    return NextResponse.json({ error: 'URL inválido' }, { status: 400 })
  }

  try {
    const data = await glimpse(url)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
    })
  } catch {
    return NextResponse.json({ title: null, description: null, image: null })
  }
}
