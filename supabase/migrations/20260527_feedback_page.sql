-- Adiciona o campo `page` aos submits de feedback (tickets/ideias) para
-- saber em que zona da app o problema/ideia foi detectado. Slug livre para
-- permitir adicionar páginas novas sem migration; a UI valida contra a
-- lista canónica em types/feedback.ts.
ALTER TABLE feedback_submissions
  ADD COLUMN IF NOT EXISTS page TEXT;

-- Index para filtrar a tech pipeline por página rapidamente.
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_page
  ON feedback_submissions(page)
  WHERE page IS NOT NULL;
