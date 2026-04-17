import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { z } from 'zod'

// Schema for self-profile update (subset — no salary, commission, contract, role)
const updateProfileSchema = z.object({
  user: z.object({
    commercial_name: z.string().min(2, 'Nome comercial é obrigatório').max(200),
  }).partial().optional(),
  profile: z.object({
    bio: z.string().max(2000).nullable().optional(),
    phone_commercial: z.string().max(20).nullable().optional(),
    specializations: z.array(z.string()).nullable().optional(),
    languages: z.array(z.string()).nullable().optional(),
    instagram_handle: z.string().max(100).nullable().optional(),
    linkedin_url: z.string().url('URL inválido').or(z.literal('')).nullable().optional(),
  }).optional(),
  private_data: z.object({
    full_name: z.string().max(200).nullable().optional(),
    gender: z.string().nullable().optional(),
    birth_date: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    nif: z.string().max(20).nullable().optional(),
    address_private: z.string().max(500).nullable().optional(),
    postal_code: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    concelho: z.string().nullable().optional(),
    zone: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    // Company
    has_company: z.boolean().nullable().optional(),
    company_name: z.string().nullable().optional(),
    company_phone: z.string().nullable().optional(),
    company_email: z.string().nullable().optional(),
    company_address: z.string().nullable().optional(),
    company_nipc: z.string().nullable().optional(),
    company_website: z.string().nullable().optional(),
  }).optional(),
})

/**
 * GET /api/perfil — fetch own profile (dev_users + profile + private_data)
 */
export async function GET() {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('dev_users')
      .select(`
        *,
        dev_consultant_profiles(*),
        dev_consultant_private_data(*),
        user_roles!user_roles_user_id_fkey(role_id, roles(id, name, description))
      `)
      .eq('id', auth.user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter perfil:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * PUT /api/perfil — update own profile
 */
export async function PUT(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const body = await request.json()
    const validation = updateProfileSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const userId = auth.user.id
    const { user, profile, private_data } = validation.data

    if (user && Object.keys(user).length > 0) {
      const { error } = await supabase.from('dev_users').update(user).eq('id', userId)
      if (error) {
        return NextResponse.json({ error: 'Erro ao actualizar dados', details: error.message }, { status: 500 })
      }
    }

    if (profile && Object.keys(profile).length > 0) {
      const { error } = await supabase
        .from('dev_consultant_profiles')
        .upsert({ user_id: userId, ...profile })
      if (error) {
        return NextResponse.json({ error: 'Erro ao actualizar perfil', details: error.message }, { status: 500 })
      }
    }

    if (private_data && Object.keys(private_data).length > 0) {
      const { error } = await supabase
        .from('dev_consultant_private_data')
        .upsert({ user_id: userId, ...private_data })
      if (error) {
        return NextResponse.json({ error: 'Erro ao actualizar dados privados', details: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao actualizar perfil:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
