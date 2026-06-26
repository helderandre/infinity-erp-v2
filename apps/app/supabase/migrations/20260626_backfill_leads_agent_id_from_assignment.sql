-- Backfill leads.agent_id (the "contact owner") so distributed/qualified
-- contacts show up in the working consultant's "Meus Contactos".
--
-- Root cause: entry-based distribution (gestora reassign, ingest) and
-- qualification wrote leads_entries.assigned_consultant_id /
-- negocios.assigned_consultant_id but never leads.agent_id. The "Meus Contactos"
-- page filters strictly on leads.agent_id, so contacts ended up either ownerless
-- (agent_id NULL) or stuck on whoever first created/imported them (typically the
-- gestora). Code paths are fixed going forward; this is the one-time repair.
--
-- Owner signal (most authoritative first):
--   1) the most-recent négocio's assigned consultant — the strongest "who works
--      this" signal (someone qualified it);
--   2) otherwise the most-recent assigned entry's consultant.
-- We align agent_id to that target whenever it's NULL or points elsewhere.
--
-- Why négocio-first matters: a contact can have a stale extra entry routed to a
-- different consultant while its négocio (and rightful owner) belongs to someone
-- who is actively working it. Using the négocio owner first avoids stealing the
-- contact from that owner on the strength of a stray entry.
--
-- Idempotent: re-running converges to the same state. No clean revert (we can't
-- distinguish backfilled values from organic ones afterwards); restore from
-- backup if ever needed.

WITH last_entry AS (
  SELECT DISTINCT ON (e.contact_id)
    e.contact_id,
    e.assigned_consultant_id AS assignee
  FROM leads_entries e
  WHERE e.assigned_consultant_id IS NOT NULL
  ORDER BY e.contact_id, e.created_at DESC
),
last_negocio AS (
  SELECT DISTINCT ON (n.lead_id)
    n.lead_id,
    n.assigned_consultant_id AS owner
  FROM negocios n
  WHERE n.assigned_consultant_id IS NOT NULL
    AND n.lead_id IS NOT NULL
  ORDER BY n.lead_id, n.created_at DESC
),
target AS (
  SELECT
    l.id AS lead_id,
    COALESCE(ln.owner, le.assignee) AS new_owner
  FROM leads l
  LEFT JOIN last_negocio ln ON ln.lead_id = l.id
  LEFT JOIN last_entry le ON le.contact_id = l.id
)
UPDATE leads l
SET agent_id = t.new_owner
FROM target t
WHERE l.id = t.lead_id
  AND t.new_owner IS NOT NULL
  AND l.agent_id IS DISTINCT FROM t.new_owner;
