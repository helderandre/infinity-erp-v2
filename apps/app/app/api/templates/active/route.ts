import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Buscar template ativo com todas as stages e tasks
    const { data: template, error } = await supabase
      .from('tpl_processes')
      .select(`
        id,
        name,
        description,
        is_active,
        created_at,
        tpl_stages (
          id,
          name,
          description,
          order_index,
          tpl_tasks (
            id,
            title,
            description,
            action_type,
            is_mandatory,
            sla_days,
            assigned_role,
            config,
            order_index
          )
        )
      `)
      .eq('is_active', true)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Nenhum template activo encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Ordenar stages e tasks
    if (template?.tpl_stages) {
      template.tpl_stages.sort(
        (a: any, b: any) => a.order_index - b.order_index
      )
      template.tpl_stages.forEach((stage: any) => {
        if (stage.tpl_tasks) {
          stage.tpl_tasks.sort(
            (a: any, b: any) => a.order_index - b.order_index
          )
        }
      })
    }

    return NextResponse.json(template)
  } catch (error) {
    console.error('Error fetching active template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
