import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { ratePartnerSchema } from '@/lib/validations/partner'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = ratePartnerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient() as any

    // Insert rating
    const { error: insertError } = await admin
      .from('temp_partner_ratings')
      .insert({
        partner_id: id,
        user_id: user.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      })

    if (insertError) {
      console.error('[partners/[id]/rate POST]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate average
    const { data: ratings } = await admin
      .from('temp_partner_ratings')
      .select('rating')
      .eq('partner_id', id)

    if (ratings && ratings.length > 0) {
      const avg = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length
      await admin
        .from('temp_partners')
        .update({
          rating_avg: Math.round(avg * 10) / 10,
          rating_count: ratings.length,
        })
        .eq('id', id)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[partners/[id]/rate POST]', err)
    return NextResponse.json({ error: 'Erro interno ao avaliar parceiro.' }, { status: 500 })
  }
}
