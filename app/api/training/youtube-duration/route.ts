import { getYouTubeDuration } from '@/lib/youtube'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'URL obrigatório' }, { status: 400 })
  }

  const duration = await getYouTubeDuration(url)
  return NextResponse.json({ duration_seconds: duration })
}
