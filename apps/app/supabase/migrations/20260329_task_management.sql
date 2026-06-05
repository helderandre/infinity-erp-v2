-- ============================================================================
-- Migration: Task Management Module (Todoist-style)
-- - tasks: main task table with sub-tasks, recurrence, entity linking
-- - task_comments: comments thread per task
-- - task_attachments: file attachments per task
-- ============================================================================

-- 1. Main tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Hierarchy (sub-tasks)
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,

  -- Assignment
  assigned_to UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,

  -- Priority: 1=urgente, 2=alta, 3=média, 4=normal
  priority INT NOT NULL DEFAULT 4 CHECK (priority BETWEEN 1 AND 4),

  -- Due date & recurrence
  due_date TIMESTAMPTZ,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,  -- iCal RRULE format e.g. "FREQ=WEEKLY;BYDAY=MO"

  -- Completion
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,

  -- Polymorphic link to ERP entities
  entity_type TEXT CHECK (entity_type IN ('property', 'lead', 'process', 'owner', 'negocio')),
  entity_id UUID,

  -- Ordering within a list/parent
  order_index INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Task comments
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Task attachments
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Tasks: fast lookups by assignee (pending tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_completed
  ON tasks(assigned_to, is_completed) WHERE NOT is_completed;

-- Tasks: entity linking
CREATE INDEX IF NOT EXISTS idx_tasks_entity
  ON tasks(entity_type, entity_id) WHERE entity_type IS NOT NULL;

-- Tasks: sub-tasks of a parent
CREATE INDEX IF NOT EXISTS idx_tasks_parent
  ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Tasks: due date for overdue/upcoming queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks(due_date) WHERE due_date IS NOT NULL AND NOT is_completed;

-- Tasks: created_by for "my created tasks"
CREATE INDEX IF NOT EXISTS idx_tasks_created_by
  ON tasks(created_by);

-- Comments: by task
CREATE INDEX IF NOT EXISTS idx_task_comments_task
  ON task_comments(task_id);

-- Attachments: by task
CREATE INDEX IF NOT EXISTS idx_task_attachments_task
  ON task_attachments(task_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Tasks: service role full access
CREATE POLICY tasks_service_all ON tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tasks: authenticated users can see tasks assigned to them or created by them
CREATE POLICY tasks_select_own ON tasks
  FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- Tasks: authenticated users can insert tasks
CREATE POLICY tasks_insert_auth ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Tasks: assignee or creator can update
CREATE POLICY tasks_update_own ON tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid());

-- Tasks: creator can delete
CREATE POLICY tasks_delete_own ON tasks
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Comments: service role full access
CREATE POLICY task_comments_service_all ON task_comments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Comments: anyone who can see the task can see comments
CREATE POLICY task_comments_select ON task_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_comments.task_id
    AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
  ));

-- Comments: authenticated users can insert
CREATE POLICY task_comments_insert ON task_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Attachments: service role full access
CREATE POLICY task_attachments_service_all ON task_attachments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Attachments: anyone who can see the task can see attachments
CREATE POLICY task_attachments_select ON task_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = task_attachments.task_id
    AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
  ));

-- Attachments: authenticated users can insert
CREATE POLICY task_attachments_insert ON task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- Attachments: uploader can delete
CREATE POLICY task_attachments_delete ON task_attachments
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- ============================================================================
-- Updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();
