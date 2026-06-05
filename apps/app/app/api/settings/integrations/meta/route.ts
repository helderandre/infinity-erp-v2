import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    return NextResponse.json({
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/meta/leads`,
      appId: process.env.META_APP_ID ?? '',
      hasAppSecret: !!process.env.META_APP_SECRET,
      hasAccessToken: !!process.env.META_ACCESS_TOKEN,
      hasPixelId: !!process.env.META_PIXEL_ID,
      pixelId: process.env.META_PIXEL_ID ?? '',
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
