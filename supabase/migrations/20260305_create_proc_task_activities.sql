CREATE TABLE proc_task_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proc_task_id UUID NOT NULL REFERENCES proc_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES dev_users(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proc_task_activities_task ON proc_task_activities(proc_task_id);
CREATE INDEX idx_proc_task_activities_created ON proc_task_activities(created_at DESC);

-- RLS
ALTER TABLE proc_task_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read activities"
  ON proc_task_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert activities"
  ON proc_task_activities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
