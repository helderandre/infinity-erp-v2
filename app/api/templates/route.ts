import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Buscar templates com contagem de stages e tasks
    const { data: templates, error } = await supabase
      .from('tpl_processes')
      .select(`
        id,
        name,
        description,
        is_active,
        created_at,
        tpl_stages (
          id,
          tpl_tasks (id)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calcular contagens
    const templatesWithCounts = templates?.map((tpl) => {
      const stages = tpl.tpl_stages || []
      const totalTasks = stages.reduce(
        (acc, stage: any) => acc + (stage.tpl_tasks?.length || 0),
        0
      )

      return {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        is_active: tpl.is_active,
        created_at: tpl.created_at,
        stages_count: stages.length,
        tasks_count: totalTasks,
      }
    })

    return NextResponse.json(templatesWithCounts)
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
