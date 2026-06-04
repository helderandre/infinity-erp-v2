import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { ADMIN_ROLES } from '@/lib/auth/roles'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isAdminRoles(roles: string[]): boolean {
  return roles.some((r) => ADMIN_ROLES.some((ar) => ar.toLowerCase() === r.toLowerCase()))
}

// Buyer perspective depends on the sale; figure direction so we can set
// depends_on_negocio_id on the purchase pointing at the sale.
const BUYER_TIPOS = new Set(['Comprador', 'Compra', 'Arrendatário'])
const SELLER_TIPOS = new Set(['Vendedor', 'Venda', 'Senhorio', 'Arrendador'])

/**
 * POST — link this négocio to another one of the SAME contact (compra depende
 * da venda, or any related-deal grouping). Both end up sharing a deal_group_id;
 * the purchase gets depends_on_negocio_id pointing at the sale when the pair is
 * a buyer + seller. Merges groups if either side already belongs to one.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const targetId = String(body?.target_negocio_id || '')

    if (!UUID_RE.test(id) || !UUID_RE.test(targetId)) {
      return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 })
    }
    if (id === targetId) {
      return NextResponse.json({ error: 'Não é possível ligar um negócio a si próprio' }, { status: 400 })
    }

    const { data: rows, error } = await supabase
      .from('negocios')
      .select('id, lead_id, deal_group_id, tipo, assigned_consultant_id')
      .in('id', [id, targetId])

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const source = (rows ?? []).find((r: any) => r.id === id)
    const target = (rows ?? []).find((r: any) => r.id === targetId)
    if (!source || !target) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    // Authorisation — must own (or be admin on) the source deal.
    const isOwner = source.assigned_consultant_id === auth.user.id
    if (!isAdminRoles(auth.roles) && !isOwner) {
      return NextResponse.json({ error: 'Sem permissão para ligar este negócio' }, { status: 403 })
    }

    // Only deals of the SAME contact can be linked — the link models "this
    // person's purchase depends on this person's sale".
    if (source.lead_id !== target.lead_id) {
      return NextResponse.json(
        { error: 'Só é possível ligar negócios do mesmo contacto' },
        { status: 400 },
      )
    }

    // Resolve / merge the group id.
    const groupId: string = source.deal_group_id || target.deal_group_id || crypto.randomUUID()
    const oldGroups = [source.deal_group_id, target.deal_group_id].filter(Boolean) as string[]

    // Every row that should end up in the group: the two deals + any existing
    // members of either side's prior group.
    const idsToGroup = new Set<string>([id, targetId])
    if (oldGroups.length > 0) {
      const { data: members } = await supabase
        .from('negocios')
        .select('id')
        .in('deal_group_id', oldGroups)
      for (const m of (members ?? []) as any[]) idsToGroup.add(m.id)
    }

    await supabase
      .from('negocios')
      .update({ deal_group_id: groupId })
      .in('id', Array.from(idsToGroup))

    // Direction: the buyer-side deal depends on the seller-side deal.
    let dependsApplied: { buyer: string; seller: string } | null = null
    const sourceBuyer = BUYER_TIPOS.has(source.tipo)
    const targetBuyer = BUYER_TIPOS.has(target.tipo)
    const sourceSeller = SELLER_TIPOS.has(source.tipo)
    const targetSeller = SELLER_TIPOS.has(target.tipo)
    if (sourceBuyer && targetSeller) {
      await supabase.from('negocios').update({ depends_on_negocio_id: target.id }).eq('id', source.id)
      dependsApplied = { buyer: source.id, seller: target.id }
    } else if (targetBuyer && sourceSeller) {
      await supabase.from('negocios').update({ depends_on_negocio_id: source.id }).eq('id', target.id)
      dependsApplied = { buyer: target.id, seller: source.id }
    }

    return NextResponse.json({ deal_group_id: groupId, depends: dependsApplied })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

/**
 * DELETE — unlink this négocio from its group. Clears its own group + any
 * dependency, clears dependencies that pointed at it, and dissolves the group
 * if only one member would remain.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { data: source } = await supabase
      .from('negocios')
      .select('id, deal_group_id, assigned_consultant_id')
      .eq('id', id)
      .maybeSingle()
    if (!source) return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })

    const isOwner = (source as any).assigned_consultant_id === auth.user.id
    if (!isAdminRoles(auth.roles) && !isOwner) {
      return NextResponse.json({ error: 'Sem permissão para desligar este negócio' }, { status: 403 })
    }

    const groupId = (source as any).deal_group_id as string | null

    // Detach this deal + clear any dependency pointing to it.
    await supabase
      .from('negocios')
      .update({ deal_group_id: null, depends_on_negocio_id: null })
      .eq('id', id)
    await supabase
      .from('negocios')
      .update({ depends_on_negocio_id: null })
      .eq('depends_on_negocio_id', id)

    // Dissolve the group if a lone member remains.
    if (groupId) {
      const { data: remaining } = await supabase
        .from('negocios')
        .select('id')
        .eq('deal_group_id', groupId)
      if ((remaining ?? []).length <= 1) {
        await supabase
          .from('negocios')
          .update({ deal_group_id: null, depends_on_negocio_id: null })
          .eq('deal_group_id', groupId)
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
