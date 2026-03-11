import type { SupabaseClient } from '@supabase/supabase-js'

export type TaskActivityType =
  | 'status_change'
  | 'assignment'
  | 'priority_change'
  | 'due_date_change'
  | 'bypass'
  | 'upload'
  | 'email_sent'
  | 'doc_generated'
  | 'started'
  | 'completed'
  | 'viewed'
  | 'draft_generated'
  | 'comment'
  | 'email_delivered'
  | 'email_opened'
  | 'email_clicked'
  | 'email_bounced'
  | 'email_failed'
  | 'email_resent'
  | 'email_delayed'
  | 'subtask_reverted'
  | 'template_reset'
  | 'document_replaced'
  | 'upload_completed'

export async function logTaskActivity(
  supabase: SupabaseClient,
  taskId: string,
  userId: string,
  activityType: TaskActivityType,
  description: string,
  metadata?: Record<string, unknown>
) {
  const db = supabase as unknown as {
    from: (table: string) => ReturnType<SupabaseClient['from']>
  }
  const { error } = await (db.from('proc_task_activities') as ReturnType<SupabaseClient['from']>)
    .insert({
      proc_task_id: taskId,
      user_id: userId,
      activity_type: activityType,
      description,
      metadata: metadata || {},
    })
  if (error) {
    console.error('[ActivityLogger] Erro ao registar actividade:', error.message)
  }
}
