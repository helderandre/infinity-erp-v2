ALTER TABLE log_emails
  ADD COLUMN IF NOT EXISTS proc_subtask_id UUID REFERENCES proc_subtasks(id),
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS cc TEXT[],
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS last_event TEXT DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS parent_email_id UUID REFERENCES log_emails(id),
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Índices para webhook lookup e queries
CREATE INDEX IF NOT EXISTS idx_log_emails_resend_id ON log_emails(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_log_emails_task ON log_emails(proc_task_id);
CREATE INDEX IF NOT EXISTS idx_log_emails_subtask ON log_emails(proc_subtask_id);

-- RLS: webhook handler usa admin client (bypass RLS), mas leitura precisa de policy
ALTER TABLE log_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read log_emails"
  ON log_emails FOR SELECT
  TO authenticated
  USING (true);
