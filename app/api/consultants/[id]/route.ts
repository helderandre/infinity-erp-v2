import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { updateConsultantSchema } from '@/lib/validations/consultant'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('consultants')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('dev_users')
      .select(
        `*,
        dev_consultant_profiles(*),
        dev_consultant_private_data(*),
        user_roles!user_roles_user_id_fkey(role_id, roles(id, name, description))`
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count properties assigned to this consultant — mirror the filters used
    // by GET /api/properties so the badge matches the listed rows.
    const { count: propertiesCount } = await supabase
      .from('dev_properties')
      .select('id', { count: 'exact', head: true })
      .eq('consultant_id', id)
      .neq('status', 'cancelled')
      .neq('status', 'draft')

    return NextResponse.json({
      ...data,
      properties_count: propertiesCount || 0,
    })
  } catch (error) {
    console.error('Erro ao obter consultor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('consultants')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = updateConsultantSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { user, profile, private_data } = validation.data

    // Update dev_users
    if (user && Object.keys(user).length > 0) {
      const { error } = await supabase
        .from('dev_users')
        .update(user)
        .eq('id', id)

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar consultor', details: error.message },
          { status: 500 }
        )
      }
    }

    // Upsert profile
    if (profile && Object.keys(profile).length > 0) {
      const { error } = await supabase
        .from('dev_consultant_profiles')
        .upsert({ user_id: id, ...profile })

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar perfil', details: error.message },
          { status: 500 }
        )
      }
    }

    // Upsert private data
    if (private_data && Object.keys(private_data).length > 0) {
      const { error } = await supabase
        .from('dev_consultant_private_data')
        .upsert({ user_id: id, ...private_data })

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar dados privados', details: error.message },
          { status: 500 }
        )
      }
    }

    // Handle role update if provided
    if (body.role_id) {
      const admin = createAdminClient()
      // Remove existing roles
      await admin.from('user_roles').delete().eq('user_id', id)
      // Assign new role
      const { error: roleError } = await admin
        .from('user_roles')
        .insert({ user_id: id, role_id: body.role_id, assigned_by: auth.user.id })

      if (roleError) {
        console.error('Erro ao actualizar role:', roleError)
      }
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar consultor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
