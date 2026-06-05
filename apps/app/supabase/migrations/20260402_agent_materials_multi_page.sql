-- Allow multiple pages per agent per template
ALTER TABLE agent_materials ADD COLUMN IF NOT EXISTS page_index INTEGER NOT NULL DEFAULT 1;

-- Drop old unique constraint (one file per agent+template)
ALTER TABLE agent_materials DROP CONSTRAINT IF EXISTS uq_agent_template;

-- Add new unique constraint (one file per agent+template+page)
ALTER TABLE agent_materials ADD CONSTRAINT uq_agent_template_page UNIQUE (agent_id, template_id, page_index);
