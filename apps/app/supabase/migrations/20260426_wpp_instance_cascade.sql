-- ============================================================================
-- Migration: Cascade delete for all wpp_* tables on auto_wpp_instances removal
-- ============================================================================
-- Until now, only wpp_debug_log, wpp_activity_sessions and wpp_scheduled_messages
-- cascaded when an instance was deleted. The remaining wpp_* tables
-- (wpp_chats, wpp_messages, wpp_contacts, wpp_message_media, wpp_labels)
-- kept NO ACTION on their instance_id FK, which caused two problems:
--
--  1. Either the DELETE silently left orphaned rows, or
--  2. The DELETE errored when there was history, leaving the UI reporting
--     success while the instance remained behind.
--
-- A delete is an explicit, irreversible "remove this WhatsApp account and all
-- its data" operation (vs. the reversible "disconnect" which just stops the
-- Uazapi session). Cascade the FK so a single DELETE on auto_wpp_instances
-- cleans up all derived data in one transaction.
--
-- This migration also tightens the inner FKs so cascading flows end-to-end:
--   wpp_messages.chat_id  → wpp_chats(id)        ON DELETE CASCADE
--   wpp_message_media.message_id → wpp_messages(id) ON DELETE CASCADE
--   wpp_chats.contact_id  → wpp_contacts(id)      ON DELETE SET NULL
-- (contact removal should not delete the chat — the chat will still be
--  reachable via instance_id cascade.)
-- ============================================================================

-- ── wpp_chats.instance_id → auto_wpp_instances(id) ON DELETE CASCADE ──
ALTER TABLE wpp_chats
  DROP CONSTRAINT IF EXISTS wpp_chats_instance_id_fkey;
ALTER TABLE wpp_chats
  ADD CONSTRAINT wpp_chats_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES auto_wpp_instances(id)
  ON DELETE CASCADE;

-- ── wpp_chats.contact_id → wpp_contacts(id) ON DELETE SET NULL ──
ALTER TABLE wpp_chats
  DROP CONSTRAINT IF EXISTS wpp_chats_contact_id_fkey;
ALTER TABLE wpp_chats
  ADD CONSTRAINT wpp_chats_contact_id_fkey
  FOREIGN KEY (contact_id)
  REFERENCES wpp_contacts(id)
  ON DELETE SET NULL;

-- ── wpp_messages.instance_id → auto_wpp_instances(id) ON DELETE CASCADE ──
ALTER TABLE wpp_messages
  DROP CONSTRAINT IF EXISTS wpp_messages_instance_id_fkey;
ALTER TABLE wpp_messages
  ADD CONSTRAINT wpp_messages_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES auto_wpp_instances(id)
  ON DELETE CASCADE;

-- ── wpp_messages.chat_id → wpp_chats(id) ON DELETE CASCADE ──
ALTER TABLE wpp_messages
  DROP CONSTRAINT IF EXISTS wpp_messages_chat_id_fkey;
ALTER TABLE wpp_messages
  ADD CONSTRAINT wpp_messages_chat_id_fkey
  FOREIGN KEY (chat_id)
  REFERENCES wpp_chats(id)
  ON DELETE CASCADE;

-- ── wpp_contacts.instance_id → auto_wpp_instances(id) ON DELETE CASCADE ──
ALTER TABLE wpp_contacts
  DROP CONSTRAINT IF EXISTS wpp_contacts_instance_id_fkey;
ALTER TABLE wpp_contacts
  ADD CONSTRAINT wpp_contacts_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES auto_wpp_instances(id)
  ON DELETE CASCADE;

-- ── wpp_message_media.instance_id → auto_wpp_instances(id) ON DELETE CASCADE ──
ALTER TABLE wpp_message_media
  DROP CONSTRAINT IF EXISTS wpp_message_media_instance_id_fkey;
ALTER TABLE wpp_message_media
  ADD CONSTRAINT wpp_message_media_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES auto_wpp_instances(id)
  ON DELETE CASCADE;

-- ── wpp_message_media.message_id → wpp_messages(id) ON DELETE CASCADE ──
ALTER TABLE wpp_message_media
  DROP CONSTRAINT IF EXISTS wpp_message_media_message_id_fkey;
ALTER TABLE wpp_message_media
  ADD CONSTRAINT wpp_message_media_message_id_fkey
  FOREIGN KEY (message_id)
  REFERENCES wpp_messages(id)
  ON DELETE CASCADE;

-- ── wpp_labels.instance_id → auto_wpp_instances(id) ON DELETE CASCADE ──
ALTER TABLE wpp_labels
  DROP CONSTRAINT IF EXISTS wpp_labels_instance_id_fkey;
ALTER TABLE wpp_labels
  ADD CONSTRAINT wpp_labels_instance_id_fkey
  FOREIGN KEY (instance_id)
  REFERENCES auto_wpp_instances(id)
  ON DELETE CASCADE;
