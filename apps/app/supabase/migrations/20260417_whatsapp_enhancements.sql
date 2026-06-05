-- WhatsApp Enhancements Migration
-- 1. Scheduled messages with pg_cron
-- 2. Activity session tracking
-- 3. CRM settings table

-- =============================================================================
-- 1. Create wpp_scheduled_messages table
-- =============================================================================
CREATE TABLE IF NOT EXISTS wpp_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES wpp_chats(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'document', 'audio')),
  text text,
  media_url text,
  media_file_name text,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_by uuid NOT NULL REFERENCES dev_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_scheduled_pending ON wpp_scheduled_messages(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_wpp_scheduled_user ON wpp_scheduled_messages(created_by, status);

-- =============================================================================
-- 3. Create wpp_activity_sessions table
-- =============================================================================
CREATE TABLE IF NOT EXISTS wpp_activity_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES wpp_contacts(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES auto_wpp_instances(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES wpp_chats(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES dev_users(id),
  message_count int NOT NULL DEFAULT 1,
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound', 'both')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wpp_activity_lead ON wpp_activity_sessions(lead_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wpp_activity_chat ON wpp_activity_sessions(chat_id, started_at DESC);

-- =============================================================================
-- 4. Create crm_settings table
-- =============================================================================
CREATE TABLE IF NOT EXISTS crm_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES dev_users(id)
);

-- Seed the default activity gap setting (18 hours in seconds)
INSERT INTO crm_settings (key, value, description)
VALUES ('whatsapp_activity_gap_hours', '18', 'Intervalo em horas entre sessões de actividade WhatsApp')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 5. Enable pg_cron and pg_net extensions
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =============================================================================
-- 6. Create pg_cron job to send scheduled messages
-- =============================================================================

-- Create a function to process scheduled messages
CREATE OR REPLACE FUNCTION process_scheduled_wpp_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  msg RECORD;
  edge_url text;
  service_key text;
BEGIN
  -- Get the project URL for edge function calls
  edge_url := current_setting('app.settings.edge_function_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- If settings not available, skip
  IF edge_url IS NULL OR service_key IS NULL THEN
    RETURN;
  END IF;

  FOR msg IN
    SELECT sm.*, wi.uazapi_token, wc.wa_chat_id
    FROM wpp_scheduled_messages sm
    JOIN auto_wpp_instances wi ON wi.id = sm.instance_id
    JOIN wpp_chats wc ON wc.id = sm.chat_id
    WHERE sm.status = 'pending'
      AND sm.scheduled_at <= now()
    ORDER BY sm.scheduled_at
    LIMIT 10
  LOOP
    -- Mark as processing to avoid double-sends
    UPDATE wpp_scheduled_messages SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = msg.id;

    -- Call edge function via pg_net
    PERFORM net.http_post(
      url := edge_url || '/whatsapp-messaging',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'action', CASE WHEN msg.message_type = 'text' THEN 'send_text' ELSE 'send_media' END,
        'instance_id', msg.instance_id::text,
        'wa_chat_id', msg.wa_chat_id,
        'text', COALESCE(msg.text, ''),
        'media_url', msg.media_url,
        'file_name', msg.media_file_name,
        'media_type', msg.message_type
      )
    );
  END LOOP;
END;
$$;

-- Schedule the cron job to run every minute
SELECT cron.schedule(
  'process-scheduled-wpp-messages',
  '* * * * *',
  $$SELECT process_scheduled_wpp_messages()$$
);
