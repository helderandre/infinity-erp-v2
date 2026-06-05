-- ─────────────────────────────────────────────────────────────────────────
-- ai_jobs — server-side job queue para trabalho assíncrono que sobrevive ao
-- fecho do tab/browser do utilizador. Usado por:
--   • image_stage          — decoração virtual em batch
--   • image_enhance        — melhoramento de imagens
--   • planta_3d            — geração 3D de plantas
--   • video_compress       — compressão de vídeo via ffmpeg
--
-- Fluxo:
--   1. Cliente faz POST /api/ai-jobs com { type, payload } → status='pending'
--   2. Cron Coolify (every 30s) chama /api/cron/process-ai-jobs → escolhe 1
--      pending, marca 'running', dispatcha o handler do tipo, actualiza
--      progress periodicamente, marca 'completed' ou 'failed' no fim.
--   3. Em 'completed', um trigger insere uma row em `notifications` com
--      `notification_type='ai_job_completed'` para que o cron de push
--      (`dispatch-pending-push`) entregue ao utilizador no mobile/desktop.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.dev_properties(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image_stage', 'image_enhance', 'planta_3d', 'video_compress')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  progress_done int NOT NULL DEFAULT 0,
  progress_total int NOT NULL DEFAULT 1,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  -- pickup token usado pelo worker para evitar dupla picagem em concurrent
  -- crons (compare-and-set: só pega o job se locked_at IS NULL OR < now() - 5min)
  locked_at timestamptz,
  locked_by text
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_user ON public.ai_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_property ON public.ai_jobs (property_id, created_at DESC);
-- Index parcial para o worker pickar pendentes rapidamente.
CREATE INDEX IF NOT EXISTS idx_ai_jobs_pending
  ON public.ai_jobs (created_at ASC)
  WHERE status = 'pending';

-- RLS: utilizador vê apenas os seus próprios jobs. O service_role (worker)
-- bypassa RLS naturalmente.
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_jobs_self_select ON public.ai_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ai_jobs_self_insert ON public.ai_jobs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Trigger: ao marcar status='completed' ou 'failed', INSERT em
-- `notifications` para o utilizador. O cron `dispatch-pending-push` faz o
-- envio do push. `notification_type='ai_job_completed'` é o slug.
CREATE OR REPLACE FUNCTION public.fn_ai_jobs_notify_on_done()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text;
  v_body text;
  v_action_url text;
BEGIN
  -- Só notifica em transição para terminal state.
  IF NEW.status NOT IN ('completed', 'failed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Title/body por tipo de job.
  IF NEW.type = 'image_stage' THEN
    v_title := CASE WHEN NEW.status = 'completed' THEN 'Decoração concluída' ELSE 'Decoração falhou' END;
    v_body := COALESCE((NEW.result->>'summary')::text,
              CASE WHEN NEW.status = 'completed'
                   THEN format('%s/%s imagens decoradas', NEW.progress_done, NEW.progress_total)
                   ELSE 'Falha ao decorar imagens' END);
  ELSIF NEW.type = 'planta_3d' THEN
    v_title := CASE WHEN NEW.status = 'completed' THEN 'Render 3D pronto' ELSE 'Render 3D falhou' END;
    v_body := COALESCE((NEW.result->>'summary')::text,
              CASE WHEN NEW.status = 'completed' THEN 'A planta 3D foi gerada' ELSE 'Falha ao gerar render 3D' END);
  ELSIF NEW.type = 'video_compress' THEN
    v_title := CASE WHEN NEW.status = 'completed' THEN 'Vídeo processado' ELSE 'Compressão falhou' END;
    v_body := COALESCE((NEW.result->>'summary')::text,
              CASE WHEN NEW.status = 'completed' THEN 'O vídeo foi comprimido e está pronto' ELSE 'Falha a comprimir vídeo' END);
  ELSIF NEW.type = 'image_enhance' THEN
    v_title := CASE WHEN NEW.status = 'completed' THEN 'Melhoria concluída' ELSE 'Melhoria falhou' END;
    v_body := COALESCE((NEW.result->>'summary')::text,
              CASE WHEN NEW.status = 'completed'
                   THEN format('%s/%s imagens melhoradas', NEW.progress_done, NEW.progress_total)
                   ELSE 'Falha ao melhorar imagens' END);
  ELSE
    v_title := 'Trabalho concluído';
    v_body := 'O processamento terminou.';
  END IF;

  -- Action URL: tab Media do imóvel quando há property_id.
  v_action_url := CASE
    WHEN NEW.property_id IS NOT NULL THEN format('/dashboard/imoveis/%s?tab=media', NEW.property_id)
    ELSE '/dashboard'
  END;

  INSERT INTO public.notifications (
    user_id, sender_id, notification_type, entity_type, entity_id,
    title, body, action_url, metadata
  ) VALUES (
    NEW.user_id, NEW.user_id, 'ai_job_completed', 'ai_job', NEW.id,
    v_title, v_body, v_action_url,
    jsonb_build_object('job_type', NEW.type, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_jobs_notify_on_done ON public.ai_jobs;
CREATE TRIGGER trg_ai_jobs_notify_on_done
  AFTER UPDATE OF status ON public.ai_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_ai_jobs_notify_on_done();

COMMENT ON TABLE public.ai_jobs IS
  'Server-side job queue para trabalho assíncrono (decorar, planta 3D, video compress). Sobrevive ao fecho do tab; notifica via push no fim.';
