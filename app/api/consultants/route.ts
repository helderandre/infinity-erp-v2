import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { consultantUserSchema } from '@/lib/validations/consultant'
import { CONSULTANT_ROLES, PROPERTY_RESPONSIBLE_ROLES } from '@/lib/auth/roles'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('consultants')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const status = searchParams.get('status') // 'active' | 'inactive' | 'all'
    const consultantOnly = searchParams.get('consultant_only') !== 'false' // default true
    const includeBrokers = searchParams.get('include_brokers') === 'true'
    const limit = Math.min(Number(searchParams.get('per_page')) || 50, 100)
    const page = Math.max(Number(searchParams.get('page')) || 1, 1)
    const offset = (page - 1) * limit

    let query = supabase
      .from('dev_users')
      .select(
        `*,
        dev_consultant_profiles(*),
        user_roles!user_roles_user_id_fkey(role_id, roles(id, name))`,
        { count: 'exact' }
      )
      .order('commercial_name', { ascending: true })
      .range(offset, offset + limit - 1)

    // Filter by active status — DEFAULT to active only
    // Deactivated users should NEVER appear except when explicitly requesting 'inactive' or 'all'
    if (status === 'inactive') {
      query = query.eq('is_active', false)
    } else if (status === 'all') {
      // Show all (for admin consultores page with filters)
    } else {
      // Default: only active users (covers status=active, status=undefined, active=true, etc.)
      query = query.eq('is_active', true)
    }

    if (search) {
      query = query.or(
        `commercial_name.ilike.%${search}%,professional_email.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filtrar por roles de consultores (importado de lib/auth/roles.ts)

    let filtered = data || []

    // By default, only show consultants (not admin, office manager, etc.)
    if (consultantOnly) {
      const allowedRoles: readonly string[] = includeBrokers
        ? PROPERTY_RESPONSIBLE_ROLES
        : CONSULTANT_ROLES
      filtered = filtered.filter((c: any) =>
        c.user_roles?.some((ur: any) => allowedRoles.includes(ur.roles?.name))
      )
    }

    // Additional role filter
    if (role && role !== 'all') {
      filtered = filtered.filter((c: any) =>
        c.user_roles?.some((ur: any) => ur.roles?.name === role)
      )
    }

    return NextResponse.json({
      data: filtered,
      total: filtered.length,
      page,
      per_page: limit,
    })
  } catch (error) {
    console.error('Erro ao listar consultores:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('consultants')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const admin = createAdminClient()

    const body = await request.json()
    const { user, profile, private_data, role_id, email, password } = body

    // Validate user data
    const validation = consultantUserSchema.safeParse(user)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e password são obrigatórios para criar conta' },
        { status: 400 }
      )
    }

    // Create auth user via admin
    const { data: newAuthUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json(
        { error: 'Erro ao criar utilizador', details: createError.message },
        { status: 500 }
      )
    }

    const userId = newAuthUser.user.id

    // Create dev_users record
    const { error: userError } = await admin
      .from('dev_users')
      .insert({
        id: userId,
        commercial_name: validation.data.commercial_name,
        professional_email: validation.data.professional_email || email,
        is_active: validation.data.is_active ?? true,
        display_website: validation.data.display_website ?? false,
      })

    if (userError) {
      return NextResponse.json(
        { error: 'Erro ao criar consultor', details: userError.message },
        { status: 500 }
      )
    }

    // Create profile
    const { error: profileError } = await admin
      .from('dev_consultant_profiles')
      .insert({ user_id: userId, ...profile })

    if (profileError) {
      console.error('Erro ao criar perfil:', profileError)
    }

    // Create private data
    if (private_data && Object.keys(private_data).length > 0) {
      const { error: privateError } = await admin
        .from('dev_consultant_private_data')
        .insert({ user_id: userId, ...private_data })

      if (privateError) {
        console.error('Erro ao criar dados privados:', privateError)
      }
    }

    // Assign role
    if (role_id) {
      const { error: roleError } = await admin
        .from('user_roles')
        .insert({ user_id: userId, role_id, assigned_by: auth.user.id })

      if (roleError) {
        console.error('Erro ao atribuir role:', roleError)
      }
    }

    return NextResponse.json({ id: userId }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar consultor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
