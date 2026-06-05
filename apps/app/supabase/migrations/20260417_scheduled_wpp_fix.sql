-- Fix process_scheduled_wpp_messages() so pg_cron actually sends messages.
--
-- Problem: the previous version read auth config from DB settings
-- (current_setting('app.settings.*')) but those require superuser and were
-- never set on the managed Supabase instance, so the function silently
-- exited every minute without doing anything.
--
-- Fix: store the service role key in supabase_vault and read it from
-- vault.decrypted_secrets. The project URL is public so we hardcode it.
--
-- One-time setup (NOT in this migration because the secret value must not
-- be committed):
--   SELECT vault.create_secret('<service_role_key>', 'pg_cron_service_role_key');

CREATE OR REPLACE FUNCTION process_scheduled_wpp_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  msg RECORD;
  edge_url text := 'https://umlndumjfamfsswwjgoo.supabase.co/functions/v1';
  service_key text;
BEGIN
  SELECT decrypted_secret
    INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'pg_cron_service_role_key'
    LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING '[process_scheduled_wpp_messages] vault secret pg_cron_service_role_key missing';
    RETURN;
  END IF;

  FOR msg IN
    SELECT sm.id, sm.instance_id, sm.chat_id, sm.message_type,
           sm.text, sm.media_url, sm.media_file_name,
           wc.wa_chat_id
    FROM wpp_scheduled_messages sm
    JOIN auto_wpp_instances wi ON wi.id = sm.instance_id
    JOIN wpp_chats wc ON wc.id = sm.chat_id
    WHERE sm.status = 'pending'
      AND sm.scheduled_at <= now()
    ORDER BY sm.scheduled_at
    LIMIT 10
  LOOP
    -- Flip to 'sent' before the HTTP call to avoid double-sends on retry
    UPDATE wpp_scheduled_messages
    SET status = 'sent', sent_at = now(), updated_at = now()
    WHERE id = msg.id;

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
