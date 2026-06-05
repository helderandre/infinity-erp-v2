import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { z } from 'zod'

const passwordSchema = z.object({
  new_password: z.string().min(8, 'A palavra-passe deve ter no mínimo 8 caracteres'),
})

/**
 * POST /api/perfil/password — change own password
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = passwordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
      password: validation.data.new_password,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao alterar palavra-passe:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
