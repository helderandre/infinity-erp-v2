import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const signupTempSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(200),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  phone: z.string().trim().min(6, 'Telefone inválido').max(20),
  password: z.string().min(8, 'Palavra-passe deve ter no mínimo 8 caracteres').max(72),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = signupTempSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, email, phone, password } = parsed.data
    const admin = createAdminClient()

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { commercial_name: name, phone },
    })

    if (createError || !created.user) {
      const isDuplicate = createError?.message?.toLowerCase().includes('already')
      return NextResponse.json(
        {
          error: isDuplicate
            ? 'Já existe uma conta com este email'
            : 'Erro ao criar utilizador',
          details: createError?.message,
        },
        { status: isDuplicate ? 409 : 500 }
      )
    }

    const userId = created.user.id

    const { error: userError } = await admin.from('dev_users').insert({
      id: userId,
      commercial_name: name,
      professional_email: email,
      is_active: true,
      display_website: false,
    })

    if (userError) {
      await admin.auth.admin.deleteUser(userId).catch(() => {})
      return NextResponse.json(
        { error: 'Erro ao criar registo do utilizador', details: userError.message },
        { status: 500 }
      )
    }

    const { error: profileError } = await admin
      .from('dev_consultant_profiles')
      .insert({ user_id: userId, phone_commercial: phone })

    if (profileError) {
      console.error('Erro ao criar perfil (signup-temp):', profileError)
    }

    const { data: consultorRole, error: roleLookupError } = await admin
      .from('roles')
      .select('id')
      .eq('name', 'Consultor')
      .maybeSingle()

    if (roleLookupError || !consultorRole) {
      console.error('Erro ao obter role Consultor (signup-temp):', roleLookupError)
    } else {
      const { error: assignRoleError } = await admin
        .from('user_roles')
        .insert({ user_id: userId, role_id: consultorRole.id, assigned_by: userId })

      if (assignRoleError) {
        console.error('Erro ao atribuir role Consultor (signup-temp):', assignRoleError)
      }
    }

    return NextResponse.json({ id: userId, email }, { status: 201 })
  } catch (error) {
    console.error('Erro no signup-temp:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
