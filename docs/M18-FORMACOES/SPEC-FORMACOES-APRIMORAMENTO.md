# SPEC — Melhorias ao Player de Lições (M18)

**Data:** 2026-03-19
**PRD de origem:** `docs/M18-FORMACOES/PRD-FORMCOES_APRIMORAMENTO.md`

---

## Resumo

5 funcionalidades interdependentes para o player de lições do módulo de Formações:

1. Sincronizar progresso de vídeos YouTube (hoje é zero — iframe simples)
2. Controlos customizados sobre o YouTube (esconder nativos)
3. Auto-completar lição quando o vídeo YouTube termina
4. Avaliação com estrelas (1-5) por lição
5. Reportar problema numa lição

---

## Dependência a Instalar

```bash
npm install react-youtube
```

---

## Base de Dados — Novas Tabelas

Executar via Supabase MCP (`execute_sql`) ou migration:

```sql
-- Avaliação de lições (estrelas)
CREATE TABLE temp_training_lesson_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dev_users(id),
  lesson_id UUID NOT NULL REFERENCES temp_training_lessons(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_ratings_lesson ON temp_training_lesson_ratings(lesson_id);
CREATE INDEX idx_lesson_ratings_user ON temp_training_lesson_ratings(user_id);

-- Reports de problemas
CREATE TABLE temp_training_lesson_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dev_users(id),
  lesson_id UUID NOT NULL REFERENCES temp_training_lessons(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by UUID REFERENCES dev_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_reports_lesson ON temp_training_lesson_reports(lesson_id);
CREATE INDEX idx_lesson_reports_status ON temp_training_lesson_reports(status);
```

---

## Ficheiros a CRIAR

---

### 1. `components/training/youtube-custom-player.tsx`

**O que fazer:** Componente client que substitui o `<iframe>` YouTube actual por `<YouTube>` do `react-youtube` com controlos customizados sobrepostos.

**Props:**
```typescript
interface YouTubeCustomPlayerProps {
  videoUrl: string
  lesson: TrainingLesson
  progress?: TrainingLessonProgress | null
  onProgressUpdate: (data: {
    video_watched_seconds?: number
    video_watch_percent?: number
    time_spent_seconds?: number
    status?: 'in_progress' | 'completed'
  }) => void
}
```

**Implementação detalhada:**

1. **Usar `<YouTube>` com `controls: 0`** para esconder controlos nativos:
```typescript
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube'

const playerRef = useRef<YouTubePlayer | null>(null)

const opts = {
  height: '100%',
  width: '100%',
  playerVars: {
    controls: 0,
    modestbranding: 1,
    rel: 0,
    disablekb: 1,
    iv_load_policy: 3,
    fs: 0,
    playsinline: 1,
  },
}
```

2. **Capturar player no `onReady`:**
```typescript
const onReady: YouTubeProps['onReady'] = (event) => {
  playerRef.current = event.target
  setDuration(event.target.getDuration())
  // Restaurar posição anterior
  if (progress?.video_watched_seconds && progress.video_watched_seconds > 0) {
    event.target.seekTo(progress.video_watched_seconds, true)
  }
}
```

3. **Polling a cada 250ms** (YouTube NÃO emite `timeupdate`):
```typescript
// Iniciar quando PLAYING, parar quando PAUSED/ENDED/BUFFERING
progressIntervalRef.current = setInterval(() => {
  const player = playerRef.current
  if (!player) return
  const time = player.getCurrentTime()
  const dur = player.getDuration()
  if (dur > 0) {
    setCurrentTime(time)
    setBuffered(player.getVideoLoadedFraction())
    saveProgress(time, dur) // reutiliza o throttle de 10s existente
  }
}, 250)
```

4. **Detectar fim do vídeo** — `onStateChange` verifica `ENDED`:
```typescript
const onStateChange: YouTubeProps['onStateChange'] = (event) => {
  const state = event.data
  if (state === 1) { // PLAYING
    setIsPlaying(true)
    startProgressTracking()
  } else if (state === 2) { // PAUSED
    setIsPlaying(false)
    stopProgressTracking()
  } else if (state === 0) { // ENDED
    setIsPlaying(false)
    stopProgressTracking()
    onProgressUpdate({
      status: 'completed',
      video_watch_percent: 100,
      video_watched_seconds: Math.floor(playerRef.current?.getDuration() || 0),
      time_spent_seconds: timeSpentRef.current,
    })
  }
}
```

5. **Overlay de controlos customizados** (`pointer-events-none` no YouTube):
```typescript
<div ref={containerRef} className="group relative aspect-video w-full bg-black rounded-lg overflow-hidden">
  {/* YouTube Player — sem interacção directa */}
  <YouTube
    videoId={videoId}
    opts={opts}
    onReady={onReady}
    onStateChange={onStateChange}
    className="pointer-events-none absolute inset-0"
    iframeClassName="w-full h-full"
  />

  {/* Click-to-play overlay */}
  <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} />

  {/* Controlos customizados — auto-hide após 3s */}
  <div className={cn(
    'absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent',
    'px-4 pb-3 pt-8 transition-opacity duration-300',
    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
  )}>
    {/* Progress bar — usar Slider do shadcn */}
    {/* Botões: Play/Pause, Skip -10s/+10s, Volume, Velocidade, Fullscreen */}
    {/* Display de tempo: MM:SS / MM:SS */}
  </div>
</div>
```

6. **Controlos a incluir:**
   - Play/Pause (`Play`, `Pause` icons Lucide)
   - Barra de progresso (componente `Slider` do shadcn) + indicador de buffer
   - Display de tempo (`formatTime(currentTime) / formatTime(duration)`)
   - Skip -10s / +10s (`SkipBack`, `SkipForward`)
   - Volume + mute (`Volume2`, `VolumeX`) — slider horizontal
   - Velocidade de reprodução — dropdown com 0.5x, 1x, 1.25x, 1.5x, 2x
   - Fullscreen (`Maximize`, `Minimize`)

7. **Auto-hide controlos** após 3s de inactividade (mousemove no container reseta o timer):
```typescript
const resetHideTimer = useCallback(() => {
  setShowControls(true)
  if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
  hideControlsTimeout.current = setTimeout(() => {
    if (isPlaying) setShowControls(false)
  }, 3000)
}, [isPlaying])
```

8. **Time tracking** — incrementar `timeSpentRef.current` a cada segundo quando `isPlaying`.

9. **Reutilizar `extractYouTubeId`** — mover de `lesson-player.tsx` para este ficheiro (ou para `lib/utils.ts`).

---

### 2. `components/training/video-controls.tsx`

**O que fazer:** Barra de controlos reutilizável para o YouTube custom player.

**Props:**
```typescript
interface VideoControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  buffered: number
  volume: number
  isMuted: boolean
  playbackRate: number
  isFullscreen: boolean
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onSkip: (seconds: number) => void
  onVolumeChange: (volume: number) => void
  onToggleMute: () => void
  onPlaybackRateChange: (rate: number) => void
  onToggleFullscreen: () => void
}
```

**O que incluir:**
- Função `formatTime(seconds: number): string` — converte para `MM:SS`
- Slider de progresso com buffer visual (div atrás do slider com `bg-white/30`)
- Dropdown de velocidade com `DropdownMenu` do shadcn
- Slider de volume (aparece on hover do botão de volume)
- Todos os ícones Lucide: `Play`, `Pause`, `SkipBack`, `SkipForward`, `Volume2`, `VolumeX`, `Volume1`, `Maximize`, `Minimize`

---

### 3. `components/training/lesson-rating.tsx`

**O que fazer:** Componente de avaliação com estrelas. Mostra abaixo do player na lesson page.

**Props:**
```typescript
interface LessonRatingProps {
  lessonId: string
  courseId: string
}
```

**Implementação:**

1. **State:** `userRating`, `averageRating`, `totalRatings`, `isLoading`, `isSaving`

2. **Fetch ao montar:** `GET /api/training/lessons/{lessonId}/rate` — retorna `{ user_rating, average_rating, total_ratings }`

3. **Star rating inline** — 5 estrelas com hover preview, usando ícones `Star` do Lucide:
```typescript
// Estrela preenchida: fill-amber-400 text-amber-400
// Estrela vazia: fill-transparent text-muted-foreground/40
// Hover: scale-110
```

4. **Ao clicar:** `POST /api/training/lessons/{lessonId}/rate` com `{ rating: 1-5 }`
   - `toast.success('Avaliação guardada!')`
   - Actualizar `userRating`, `averageRating`, `totalRatings` localmente

5. **Layout:** Uma `Card` pequena com:
   - Título: "Avalie esta lição"
   - Estrelas interactivas
   - Texto: "Média: 4.2 (17 avaliações)" — formato `X.X (N avaliações)`
   - Acessibilidade: `role="radiogroup"`, `aria-label` em PT-PT

---

### 4. `components/training/lesson-report-dialog.tsx`

**O que fazer:** Dialog para reportar problema numa lição. Botão discreto junto ao player.

**Props:**
```typescript
interface LessonReportDialogProps {
  lessonId: string
  courseId: string
  trigger?: React.ReactNode
}
```

**Implementação:**

1. **Motivos predefinidos** (RadioGroup):
```typescript
const REPORT_REASONS = [
  { value: 'video_corrupted', label: 'Vídeo corrompido ou não reproduz' },
  { value: 'audio_issues', label: 'Problemas de áudio' },
  { value: 'wrong_content', label: 'Conteúdo errado ou desactualizado' },
  { value: 'file_corrupted', label: 'Ficheiro corrompido (PDF/documento)' },
  { value: 'broken_link', label: 'Link partido' },
  { value: 'other', label: 'Outro problema' },
] as const
```

2. **Componentes shadcn:** `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `RadioGroup`, `RadioGroupItem`, `Label`, `Textarea`, `Button`

3. **Ao submeter:** `POST /api/training/lessons/{lessonId}/report` com `{ reason, comment? }`
   - `toast.success('Problema reportado com sucesso')`
   - Fechar dialog

4. **Botão trigger por defeito:** `<Button variant="ghost" size="sm">` com ícone `Flag` e texto "Reportar problema"

---

### 5. `app/api/training/lessons/[id]/rate/route.ts`

**O que fazer:** API para guardar/consultar rating de uma lição.

**GET** — Retorna o rating do utilizador actual + média + total:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { id: lessonId } = await params
  const supabase = await createClient()

  // Rating do utilizador
  const { data: userRating } = await supabase
    .from('temp_training_lesson_ratings')
    .select('rating')
    .eq('lesson_id', lessonId)
    .eq('user_id', auth.user.id)
    .single()

  // Média e total
  const { data: stats } = await supabase
    .from('temp_training_lesson_ratings')
    .select('rating')
    .eq('lesson_id', lessonId)

  const ratings = stats || []
  const average = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
    : 0

  return NextResponse.json({
    user_rating: userRating?.rating || null,
    average_rating: Math.round(average * 10) / 10,
    total_ratings: ratings.length,
  })
}
```

**POST** — Upsert rating (1-5):
```typescript
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { id: lessonId } = await params
  const supabase = await createClient()

  const body = await request.json()
  const validation = rateLessonSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { rating } = validation.data

  // Upsert — ON CONFLICT (user_id, lesson_id) DO UPDATE
  const { data, error } = await supabase
    .from('temp_training_lesson_ratings')
    .upsert(
      {
        user_id: auth.user.id,
        lesson_id: lessonId,
        rating,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,lesson_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
```

---

### 6. `app/api/training/lessons/[id]/report/route.ts`

**O que fazer:** API para criar report de problema numa lição.

**POST** — Criar report:
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'
import { reportLessonSchema } from '@/lib/validations/training'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { id: lessonId } = await params
  const supabase = await createClient()

  const body = await request.json()
  const validation = reportLessonSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { reason, comment } = validation.data

  // Verificar se já existe report aberto deste utilizador para esta lição
  const { data: existing } = await supabase
    .from('temp_training_lesson_reports')
    .select('id')
    .eq('user_id', auth.user.id)
    .eq('lesson_id', lessonId)
    .eq('status', 'open')
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'Já existe um problema reportado em aberto para esta lição' },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('temp_training_lesson_reports')
    .insert({
      user_id: auth.user.id,
      lesson_id: lessonId,
      reason,
      comment: comment || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
```

---

## Ficheiros a MODIFICAR

---

### 7. `components/training/lesson-player.tsx`

**Localização actual:** `components/training/lesson-player.tsx` (200 linhas)

**O que modificar:**

1. **Substituir o bloco YouTube iframe** (linhas 135-145) por `<YouTubeCustomPlayer>`:

```typescript
// ANTES (remover):
{isYouTube && (
  <div className="aspect-video w-full">
    <iframe
      src={`https://www.youtube.com/embed/${extractYouTubeId(videoUrl)}?rel=0`}
      ...
    />
  </div>
)}

// DEPOIS (substituir por):
{isYouTube && (
  <YouTubeCustomPlayer
    videoUrl={videoUrl}
    lesson={lesson}
    progress={progress}
    onProgressUpdate={onProgressUpdate}
  />
)}
```

2. **Adicionar import** no topo:
```typescript
import { YouTubeCustomPlayer } from './youtube-custom-player'
```

3. **Mover `extractYouTubeId`** para `youtube-custom-player.tsx` ou `lib/utils.ts` e importar de lá.

4. **Manter tudo o resto intacto:** `<video>` nativo, Vimeo iframe, `saveProgress`, `timeSpentRef`, badge de "Concluído", barra de progresso abaixo.

---

### 8. `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx`

**Localização actual:** `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx` (197 linhas)

**O que modificar:**

1. **Adicionar imports:**
```typescript
import { LessonRating } from '@/components/training/lesson-rating'
import { LessonReportDialog } from '@/components/training/lesson-report-dialog'
import { Flag } from 'lucide-react'
```

2. **Adicionar botão "Reportar problema"** junto ao título da lição (após linha 117):
```typescript
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-2xl font-bold">{currentLesson.title}</h1>
    {currentLesson.description && (
      <p className="text-sm text-muted-foreground mt-1">{currentLesson.description}</p>
    )}
  </div>
  <LessonReportDialog lessonId={lessonId} courseId={courseId} />
</div>
```

3. **Adicionar `<LessonRating>`** entre o player e a navegação (após o bloco do `LessonPlayer` / `LessonPdfViewer` / etc., antes da navegação prev/next):
```typescript
{/* Rating */}
<LessonRating lessonId={lessonId} courseId={courseId} />
```

**Posição no layout final:**
```
[Voltar ao Curso] [título] [Reportar problema]
[Player / PDF / Text / External]
[Rating (estrelas)]
[← Anterior | Próxima →]
[Comentários]
```

---

### 9. `types/training.ts`

**Localização actual:** `types/training.ts` (347 linhas)

**O que adicionar** ao final do ficheiro (antes do último `}`):

```typescript
// ─── Lesson Rating ──────────────────────────────────────

export interface TrainingLessonRating {
  id: string
  user_id: string
  lesson_id: string
  rating: number  // 1-5
  created_at: string
  updated_at: string
}

// ─── Lesson Report ──────────────────────────────────────

export type LessonReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed'

export interface TrainingLessonReport {
  id: string
  user_id: string
  lesson_id: string
  reason: string
  comment?: string | null
  status: LessonReportStatus
  resolved_by?: string | null
  resolved_at?: string | null
  resolution_note?: string | null
  created_at: string
  updated_at: string
}
```

---

### 10. `lib/validations/training.ts`

**Localização actual:** `lib/validations/training.ts` (177 linhas)

**O que adicionar** após o bloco `// ─── Progress ───` (após linha 107):

```typescript
// ─── Lesson Rating ──────────────────────────────────────

export const rateLessonSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Avaliação deve ser entre 1 e 5'),
})

export type RateLessonInput = z.infer<typeof rateLessonSchema>

// ─── Lesson Report ──────────────────────────────────────

export const reportLessonSchema = z.object({
  reason: z.enum([
    'video_corrupted',
    'audio_issues',
    'wrong_content',
    'file_corrupted',
    'broken_link',
    'other',
  ], { required_error: 'Seleccione um motivo' }),
  comment: z.string().max(1000).optional(),
})

export type ReportLessonInput = z.infer<typeof reportLessonSchema>
```

---

### 11. `hooks/use-training-lesson.ts`

**Localização actual:** `hooks/use-training-lesson.ts` (78 linhas)

**O que adicionar:**

1. **Adicionar `rateLesson`** ao hook:
```typescript
const rateLesson = useCallback(async (rating: number): Promise<boolean> => {
  try {
    const res = await fetch(`/api/training/lessons/${lessonId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating }),
    })
    return res.ok
  } catch (err) {
    console.error('Erro ao avaliar lição:', err)
    return false
  }
}, [lessonId])
```

2. **Adicionar `reportIssue`** ao hook:
```typescript
const reportIssue = useCallback(async (reason: string, comment?: string): Promise<boolean> => {
  try {
    const res = await fetch(`/api/training/lessons/${lessonId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, comment }),
    })
    return res.ok
  } catch (err) {
    console.error('Erro ao reportar problema:', err)
    return false
  }
}, [lessonId])
```

3. **Actualizar a interface de retorno:**
```typescript
interface UseTrainingLessonReturn {
  updateProgress: (...) => Promise<void>
  markCompleted: () => Promise<boolean>
  rateLesson: (rating: number) => Promise<boolean>
  reportIssue: (reason: string, comment?: string) => Promise<boolean>
  isSaving: boolean
}
```

4. **Retornar** `rateLesson` e `reportIssue` no return.

---

## Resumo de Ficheiros

| # | Acção | Ficheiro |
|---|-------|---------|
| 1 | CRIAR | `components/training/youtube-custom-player.tsx` |
| 2 | CRIAR | `components/training/video-controls.tsx` |
| 3 | CRIAR | `components/training/lesson-rating.tsx` |
| 4 | CRIAR | `components/training/lesson-report-dialog.tsx` |
| 5 | CRIAR | `app/api/training/lessons/[id]/rate/route.ts` |
| 6 | CRIAR | `app/api/training/lessons/[id]/report/route.ts` |
| 7 | MODIFICAR | `components/training/lesson-player.tsx` |
| 8 | MODIFICAR | `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx` |
| 9 | MODIFICAR | `types/training.ts` |
| 10 | MODIFICAR | `lib/validations/training.ts` |
| 11 | MODIFICAR | `hooks/use-training-lesson.ts` |
| — | SQL | 2 tabelas: `temp_training_lesson_ratings`, `temp_training_lesson_reports` |
| — | NPM | `npm install react-youtube` |

---

## Ordem de Implementação Recomendada

**Fase 1 — YouTube Player (Func 1 + 2 + 3)**
1. `npm install react-youtube`
2. Criar `video-controls.tsx`
3. Criar `youtube-custom-player.tsx`
4. Modificar `lesson-player.tsx` — substituir iframe por `<YouTubeCustomPlayer>`

**Fase 2 — Rating (Func 4)**
1. Executar SQL da tabela `temp_training_lesson_ratings`
2. Adicionar types em `types/training.ts`
3. Adicionar schemas em `lib/validations/training.ts`
4. Criar API `app/api/training/lessons/[id]/rate/route.ts`
5. Adicionar `rateLesson` ao `hooks/use-training-lesson.ts`
6. Criar `components/training/lesson-rating.tsx`
7. Integrar na page `[lessonId]/page.tsx`

**Fase 3 — Report (Func 5)**
1. Executar SQL da tabela `temp_training_lesson_reports`
2. Adicionar types em `types/training.ts`
3. Adicionar schemas em `lib/validations/training.ts`
4. Criar API `app/api/training/lessons/[id]/report/route.ts`
5. Adicionar `reportIssue` ao `hooks/use-training-lesson.ts`
6. Criar `components/training/lesson-report-dialog.tsx`
7. Integrar na page `[lessonId]/page.tsx`

---

## Notas Técnicas

- **Paths reais** — O projecto usa `components/` e `hooks/` na raiz (NÃO `src/components/`). O PRD menciona `src/` mas os ficheiros estão na raiz.
- **Padrão de auth** — Usar `requireAuth()` de `@/lib/auth/permissions` (mesmo padrão do `progress/route.ts`).
- **Toasts em PT-PT** — Sempre. Ex: `toast.success('Avaliação guardada!')`, `toast.error('Erro ao reportar problema')`.
- **Tabelas DB** — Prefixo `temp_training_` (mesmo padrão de `temp_training_lessons`, `temp_training_lesson_progress`, etc.).
- **`progress/route.ts` sem alterações** — A API de progresso já funciona. O `YouTubeCustomPlayer` apenas precisa de chamar `onProgressUpdate` com os dados correctos.
- **Vimeo mantém iframe** — Não mexer no Vimeo, apenas no YouTube.
