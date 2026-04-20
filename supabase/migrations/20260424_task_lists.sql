-- ============================================================================
-- Migration: Task Lists (Todoist-style projects with sharing)
-- - task_lists: named bucket of tasks (personal organisation, optional sharing)
-- - task_list_shares: members of a list (owner_id lives on task_lists)
-- - tasks.task_list_id + tasks.section: link task to a list + sub-grouping
-- ============================================================================

-- 1. task_lists
CREATE TABLE IF NOT EXISTS task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  color TEXT CHECK (color IN ('neutral', 'red', 'orange', 'amber', 'emerald', 'blue', 'violet', 'pink')) DEFAULT 'neutral',
  owner_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. task_list_shares (members)
CREATE TABLE IF NOT EXISTS task_list_shares (
  task_list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES dev_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_list_id, user_id)
);

-- 3. Extend tasks with task_list_id + section
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_list_id UUID REFERENCES task_lists(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section TEXT;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_task_lists_owner
  ON task_lists(owner_id);

CREATE INDEX IF NOT EXISTS idx_task_list_shares_user
  ON task_list_shares(user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_task_list
  ON tasks(task_list_id) WHERE task_list_id IS NOT NULL;

-- ============================================================================
-- updated_at trigger for task_lists
-- ============================================================================

CREATE OR REPLACE FUNCTION set_task_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_lists_updated_at ON task_lists;
CREATE TRIGGER trg_task_lists_updated_at
  BEFORE UPDATE ON task_lists
  FOR EACH ROW EXECUTE FUNCTION set_task_lists_updated_at();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_list_shares ENABLE ROW LEVEL SECURITY;

-- ── task_lists ──────────────────────────────────────────────────────────────

CREATE POLICY task_lists_service_all ON task_lists
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Owner OR member (via shares) can see the list
CREATE POLICY task_lists_select_visible ON task_lists
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_list_shares s
      WHERE s.task_list_id = task_lists.id
        AND s.user_id = auth.uid()
    )
  );

-- Only the creator themselves becomes the owner on insert
CREATE POLICY task_lists_insert_auth ON task_lists
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Only owner can rename / change color
CREATE POLICY task_lists_update_owner ON task_lists
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- Only owner can delete
CREATE POLICY task_lists_delete_owner ON task_lists
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ── task_list_shares ────────────────────────────────────────────────────────

CREATE POLICY task_list_shares_service_all ON task_list_shares
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Members see their own share rows + owner sees all shares of their lists
CREATE POLICY task_list_shares_select ON task_list_shares
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_lists l
      WHERE l.id = task_list_shares.task_list_id
        AND l.owner_id = auth.uid()
    )
  );

-- Only list owner can add members
CREATE POLICY task_list_shares_insert_owner ON task_list_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_lists l
      WHERE l.id = task_list_shares.task_list_id
        AND l.owner_id = auth.uid()
    )
  );

-- Owner can remove any member; member can remove themselves (leave)
CREATE POLICY task_list_shares_delete ON task_list_shares
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM task_lists l
      WHERE l.id = task_list_shares.task_list_id
        AND l.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Extend tasks RLS so shared-list members can see/edit tasks in shared lists
-- (Additive — existing policies tasks_select_own / tasks_update_own stay intact;
--  PostgreSQL OR's multiple PERMISSIVE policies together.)
-- ============================================================================

CREATE POLICY tasks_select_via_list ON tasks
  FOR SELECT TO authenticated
  USING (
    task_list_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM task_lists l
        WHERE l.id = tasks.task_list_id AND l.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM task_list_shares s
        WHERE s.task_list_id = tasks.task_list_id AND s.user_id = auth.uid()
      )
    )
  );

CREATE POLICY tasks_update_via_list ON tasks
  FOR UPDATE TO authenticated
  USING (
    task_list_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM task_lists l
        WHERE l.id = tasks.task_list_id AND l.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM task_list_shares s
        WHERE s.task_list_id = tasks.task_list_id AND s.user_id = auth.uid()
      )
    )
  );

-- Delete intentionally NOT extended — only the task creator or list owner can
-- delete tasks in a shared list. Covered by the existing tasks_delete_own
-- policy plus (optionally) a future policy if the product decides list owners
-- should delete others' tasks.

-- ============================================================================
-- task_comments / task_attachments: extend SELECT so shared members can read
-- comments and attachments on tasks inside a shared list.
-- ============================================================================

CREATE POLICY task_comments_select_via_list ON task_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
        AND t.task_list_id IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM task_lists l WHERE l.id = t.task_list_id AND l.owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM task_list_shares s WHERE s.task_list_id = t.task_list_id AND s.user_id = auth.uid())
        )
    )
  );

CREATE POLICY task_attachments_select_via_list ON task_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_attachments.task_id
        AND t.task_list_id IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM task_lists l WHERE l.id = t.task_list_id AND l.owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM task_list_shares s WHERE s.task_list_id = t.task_list_id AND s.user_id = auth.uid())
        )
    )
  );
