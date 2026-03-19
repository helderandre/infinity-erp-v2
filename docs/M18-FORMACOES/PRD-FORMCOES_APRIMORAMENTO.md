# PRD — Melhorias ao Módulo de Formações (M18)

**Data:** 2026-03-19
**Escopo:** 5 funcionalidades de aprimoramento do player de lições

---

## Funcionalidades a Implementar

| # | Funcionalidade | Resumo |
|---|---------------|--------|
| 1 | Sincronizar progresso YouTube | Tracking real de `getCurrentTime()` / `getDuration()` do YouTube |
| 2 | Controlos customizados | Remover controles nativos do YouTube, criar UI própria |
| 3 | Auto-completar ao fim do vídeo | Ao terminar vídeo YouTube, marcar lição como concluída |
| 4 | Avaliação com estrelas | Rating 1-5 estrelas por lição |
| 5 | Reportar problema | Permitir reportar aula/ficheiro corrompido |

---

## 1. Arquitectura Actual — O Que Existe Hoje

### O Problema Central

O `LessonPlayer` actual usa um `<iframe>` nativo para YouTube (linha 138-144 de `lesson-player.tsx`), o que significa:
- **Zero acesso** a `getCurrentTime()`, `getDuration()`, ou qualquer método do player
- **Progresso de vídeo YouTube nunca é trackado** — só funciona para vídeo nativo (`<video>`)
- **Não detecta quando o vídeo termina** — auto-complete não funciona para YouTube
- **Não pode esconder controles** — o iframe do YouTube mostra sempre os controles nativos

### Ficheiros Afectados

#### Ficheiros a MODIFICAR

| Ficheiro | Razão |
|----------|-------|
| `src/components/training/lesson-player.tsx` | Refactor total: trocar iframe por `react-youtube`, adicionar controlos custom, tracking, rating, report |
| `src/hooks/use-training-lesson.ts` | Adicionar `rateLesson()` e `reportIssue()` |
| `src/app/api/training/courses/[id]/lessons/[lessonId]/progress/route.ts` | Já funciona — sem alterações necessárias |
| `src/app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx` | Adicionar componentes de rating e report abaixo do player |
| `src/types/training.ts` | Adicionar `TrainingLessonRating` e `TrainingLessonReport` interfaces |
| `src/lib/validations/training.ts` | Adicionar schemas Zod para rating e report |

#### Ficheiros a CRIAR

| Ficheiro | Razão |
|----------|-------|
| `src/components/training/youtube-custom-player.tsx` | Player YouTube com controlos customizados |
| `src/components/training/video-controls.tsx` | Barra de controlos reutilizável (play/pause, seek, volume, fullscreen) |
| `src/components/training/lesson-rating.tsx` | Componente de avaliação com estrelas |
| `src/components/training/lesson-report-dialog.tsx` | Dialog de reportar problema |
| `src/app/api/training/lessons/[id]/rate/route.ts` | API para guardar rating |
| `src/app/api/training/lessons/[id]/report/route.ts` | API para guardar report |

#### Dependências a Instalar

```bash
npm install react-youtube
```

#### Base de Dados — Novas Tabelas

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

## 2. Padrões de Implementação da Base de Código

### 2.1 Padrão de Progress Tracking (existente)

De `lesson-player.tsx:52-78` — o padrão de save com throttle de 10 segundos:

```typescript
const saveProgress = useCallback(
  (currentTime: number, duration: number, force = false) => {
    if (duration <= 0) return
    const now = Date.now()
    if (!force && now - lastSaveRef.current < 10000) return // throttle 10s
    lastSaveRef.current = now

    const percent = Math.round((currentTime / duration) * 100)
    setWatchPercent(percent)

    const updateData = {
      video_watched_seconds: Math.floor(currentTime),
      video_watch_percent: percent,
      time_spent_seconds: timeSpentRef.current,
      status: 'in_progress' as const,
    }

    if (percent >= 90 && !isCompleted) {
      updateData.status = 'completed'
      updateData.video_watch_percent = 100
      setIsCompleted(true)
      setWatchPercent(100)
    }

    onProgressUpdate(updateData)
  },
  [onProgressUpdate, isCompleted]
)
```

### 2.2 Padrão de Hook com Debounce (existente)

De `use-training-lesson.ts:34-54` — debounce de 5s nas chamadas à API:

```typescript
const updateProgress = useCallback(async (data: {
  status?: 'in_progress' | 'completed'
  video_watched_seconds?: number
  video_watch_percent?: number
  time_spent_seconds?: number
}) => {
  if (debounceTimer.current) clearTimeout(debounceTimer.current)

  debounceTimer.current = setTimeout(async () => {
    try {
      await fetch(`/api/training/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (err) {
      console.error('Erro ao actualizar progresso:', err)
    }
  }, 5000)
}, [courseId, lessonId])
```

### 2.3 Padrão de Toast PT-PT (existente)

De `lesson-comments.tsx` e outros — sempre com mensagens em Português:

```typescript
toast.success('Lição marcada como concluída!')
toast.error('Erro ao marcar como concluída')
toast.success('Comentário publicado')
toast.error('Erro ao publicar comentário')
```

### 2.4 Padrão de API Route Handler (existente)

De `progress/route.ts` — padrão completo de route handler:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: courseId, lessonId } = await params
    const userId = auth.user.id
    const supabase = await createClient()

    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // ... lógica de negócio

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

### 2.5 Padrão de Zod Validation (existente)

De `lib/validations/training.ts` — UUID via regex, mensagens PT-PT:

```typescript
export const updateLessonProgressSchema = z.object({
  status: z.enum(['in_progress', 'completed']).optional(),
  video_watched_seconds: z.number().int().min(0).optional(),
  video_watch_percent: z.number().int().min(0).max(100).optional(),
  time_spent_seconds: z.number().int().min(0).optional(),
})
```

---

## 3. Documentação Externa e Padrões de Implementação

### 3.1 YouTube IFrame Player API

**Docs oficiais:** https://developers.google.com/youtube/iframe_api_reference

#### playerVars para esconder controlos nativos

```typescript
playerVars: {
  controls: 0,        // Esconde controles nativos do YouTube
  modestbranding: 1,  // Branding mínimo
  rel: 0,             // Sem vídeos relacionados no final
  disablekb: 1,       // Desactiva atalhos de teclado nativos
  iv_load_policy: 3,  // Esconde anotações
  fs: 0,              // Esconde botão fullscreen nativo
  playsinline: 1,     // Reproduz inline em mobile
}
```

#### Métodos críticos do Player

| Método | Descrição |
|--------|-----------|
| `player.playVideo()` | Iniciar reprodução |
| `player.pauseVideo()` | Pausar |
| `player.seekTo(seconds, allowSeekAhead)` | Ir para posição |
| `player.getCurrentTime()` | Tempo actual (float, segundos) |
| `player.getDuration()` | Duração total (float, segundos) |
| `player.getPlayerState()` | Estado actual (integer) |
| `player.setVolume(0-100)` | Volume |
| `player.mute()` / `player.unMute()` | Mudo |
| `player.setPlaybackRate(rate)` | Velocidade (0.25, 0.5, 1, 1.5, 2) |
| `player.getVideoLoadedFraction()` | Buffer (0-1) |

#### Estados do Player

| Constante | Valor | Significado |
|-----------|-------|-------------|
| `YT.PlayerState.UNSTARTED` | -1 | Não iniciado |
| `YT.PlayerState.ENDED` | 0 | Terminado |
| `YT.PlayerState.PLAYING` | 1 | A reproduzir |
| `YT.PlayerState.PAUSED` | 2 | Pausado |
| `YT.PlayerState.BUFFERING` | 3 | A carregar |
| `YT.PlayerState.CUED` | 5 | Preparado |

#### Tracking de progresso — POLLING obrigatório

O YouTube IFrame API **NÃO** emite `timeupdate` como o `<video>` nativo. É obrigatório usar `setInterval`:

```typescript
// 250ms = progress bar fluida, mas save ao servidor a cada 10s (já existe)
progressIntervalRef.current = setInterval(() => {
  const player = playerRef.current
  if (!player) return
  const time = player.getCurrentTime()
  const dur = player.getDuration()
  if (dur > 0) {
    saveProgress(time, dur)
  }
}, 250)
```

#### Detecção de fim de vídeo

```typescript
const onStateChange = (event) => {
  if (event.data === YouTube.PlayerState.ENDED) {
    // Vídeo terminou → marcar como concluído
    stopProgressTracking()
    onProgressUpdate({
      status: 'completed',
      video_watch_percent: 100,
      video_watched_seconds: Math.floor(player.getDuration()),
    })
  }
}
```

### 3.2 react-youtube (React wrapper)

**npm:** https://www.npmjs.com/package/react-youtube
**GitHub:** https://github.com/tjallingt/react-youtube

#### Instalação e uso com TypeScript

```bash
npm install react-youtube
```

```typescript
import YouTube, { YouTubeProps, YouTubePlayer } from 'react-youtube'

const playerRef = useRef<YouTubePlayer | null>(null)

const onReady: YouTubeProps['onReady'] = (event) => {
  playerRef.current = event.target
  setDuration(event.target.getDuration())
}

<YouTube
  videoId={extractYouTubeId(videoUrl)}
  opts={{
    height: '100%',
    width: '100%',
    playerVars: { controls: 0, modestbranding: 1, rel: 0, disablekb: 1, fs: 0 },
  }}
  onReady={onReady}
  onStateChange={onStateChange}
  onEnd={handleVideoEnd}
  onError={handleError}
  className="aspect-video w-full"
  iframeClassName="w-full h-full rounded-lg"
/>
```

#### Props disponíveis

| Prop | Tipo | Descrição |
|------|------|-----------|
| `videoId` | `string` | ID do vídeo YouTube |
| `opts` | `object` | Opções do player (height, width, playerVars) |
| `onReady` | `(event) => void` | API carregada; `event.target` é o player |
| `onPlay` | `(event) => void` | Vídeo iniciou |
| `onPause` | `(event) => void` | Vídeo pausou |
| `onEnd` | `(event) => void` | Vídeo terminou |
| `onError` | `(event) => void` | Erro (vídeo não encontrado, etc.) |
| `onStateChange` | `(event) => void` | Qualquer mudança de estado |
| `className` | `string` | Classe do container |
| `iframeClassName` | `string` | Classe do iframe |

### 3.3 Padrão de Custom Controls (overlay sobre YouTube)

Técnica chave: `pointer-events-none` no container do YouTube + div transparente por cima para capturar cliques.

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

  {/* Click-to-play overlay (intercepta cliques) */}
  <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} />

  {/* Controlos customizados */}
  <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent
    px-4 pb-3 pt-8 transition-opacity duration-300
    ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
  >
    {/* Progress bar + botões */}
  </div>
</div>
```

#### Esconder controlos após inactividade

```typescript
const resetHideTimer = useCallback(() => {
  setShowControls(true)
  if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current)
  hideControlsTimeout.current = setTimeout(() => {
    if (isPlaying) setShowControls(false)
  }, 3000) // 3 segundos
}, [isPlaying])
```

### 3.4 Star Rating Component

**Não existe no shadcn/ui nativo.** Padrão recomendado com Lucide + Tailwind:

```typescript
'use client'

import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  max?: number
  size?: number
  readOnly?: boolean
  className?: string
}

export function StarRating({
  value, onChange, max = 5, size = 20, readOnly = false, className,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const displayValue = hoverValue ?? value

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="radiogroup"
      aria-label={`Classificação: ${value} de ${max} estrelas`}
    >
      {Array.from({ length: max }, (_, i) => {
        const starValue = i + 1
        const isFilled = starValue <= displayValue

        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={starValue === value}
            aria-label={`${starValue} estrela${starValue > 1 ? 's' : ''}`}
            disabled={readOnly}
            className={cn(
              'rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              !readOnly && 'cursor-pointer hover:scale-110 transition-transform',
            )}
            onClick={() => onChange?.(starValue)}
            onMouseEnter={() => !readOnly && setHoverValue(starValue)}
            onMouseLeave={() => !readOnly && setHoverValue(null)}
          >
            <Star
              size={size}
              className={cn(
                'transition-colors',
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-transparent text-muted-foreground/40'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
```

**Acessibilidade:** `role="radiogroup"` no container, `role="radio"` em cada estrela, `aria-label` em PT-PT, navegação por teclado (setas).

### 3.5 Report Issue Dialog

Padrão composto com componentes shadcn existentes: `Dialog` + `RadioGroup` + `Textarea` + `Button`.

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

Schema DB: tabela polimórfica com `entity_type` + `entity_id`, workflow de moderação com `status` (open → in_review → resolved/dismissed).

---

## 4. Plano de Implementação por Funcionalidade

### Func 1 + 2 + 3: YouTube Custom Player (são interdependentes)

**Ficheiro novo:** `src/components/training/youtube-custom-player.tsx`

1. Instalar `react-youtube`
2. Criar componente `YouTubeCustomPlayer` que:
   - Usa `<YouTube>` com `controls: 0` (sem controlos nativos)
   - Captura `event.target` no `onReady` para aceder ao player
   - Faz polling a cada 250ms com `setInterval` quando `PLAYING`
   - Para o polling quando `PAUSED`, `ENDED`, `BUFFERING`
   - Chama `saveProgress(currentTime, duration)` do padrão existente
   - No `ENDED`: chama `onProgressUpdate({ status: 'completed', video_watch_percent: 100 })`
3. Overlay com controlos customizados:
   - Play/Pause (ícones Lucide: `Play`, `Pause`)
   - Barra de progresso (componente `Slider` do shadcn)
   - Indicador de buffer
   - Display de tempo (`MM:SS / MM:SS`)
   - Volume + mute (`Volume2`, `VolumeX`)
   - Skip -10s / +10s (`SkipBack`, `SkipForward`)
   - Fullscreen (`Maximize`)
   - Velocidade de reprodução (`Gauge` — dropdown com 0.5x, 1x, 1.5x, 2x)
4. Auto-hide dos controlos após 3s de inactividade

**Ficheiro modificado:** `src/components/training/lesson-player.tsx`

- Substituir bloco `{isYouTube && (<iframe ...>)}` por `<YouTubeCustomPlayer>`
- Manter `<video>` nativo para vídeos não-YouTube (já funciona)
- Manter a lógica de `saveProgress` e `isCompleted` existente

### Func 4: Avaliação com Estrelas

**Tabela:** `temp_training_lesson_ratings` (schema acima)

**API:** `POST /api/training/lessons/[id]/rate` — upsert rating (1-5)

**Componente:** `src/components/training/lesson-rating.tsx`
- Usa `StarRating` com hover preview
- Mostra média de ratings e total de avaliações
- Após avaliar: `toast.success('Avaliação guardada!')`

**Integração:** Adicionar abaixo do player na lesson page, entre o conteúdo e a navegação.

### Func 5: Reportar Problema

**Tabela:** `temp_training_lesson_reports` (schema acima)

**API:** `POST /api/training/lessons/[id]/report` — criar report

**Componente:** `src/components/training/lesson-report-dialog.tsx`
- Dialog com RadioGroup de motivos + Textarea opcional
- Motivos específicos para formações (vídeo corrompido, áudio, link partido, etc.)
- Após reportar: `toast.success('Problema reportado com sucesso')` + fechar dialog

**Integração:** Botão discreto (`variant="ghost"`) com ícone `Flag` junto ao player.

---

## 5. Schemas Zod a Adicionar

```typescript
// lib/validations/training.ts — ADICIONAR

export const rateLessonSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Avaliação deve ser entre 1 e 5'),
})

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
```

---

## 6. Types a Adicionar

```typescript
// types/training.ts — ADICIONAR

export interface TrainingLessonRating {
  id: string
  user_id: string
  lesson_id: string
  rating: number  // 1-5
  created_at: string
  updated_at: string
}

export interface TrainingLessonReport {
  id: string
  user_id: string
  lesson_id: string
  reason: string
  comment?: string
  status: 'open' | 'in_review' | 'resolved' | 'dismissed'
  resolved_by?: string
  resolved_at?: string
  resolution_note?: string
  created_at: string
  updated_at: string
}
```

---

## 7. Referências

| Recurso | URL |
|---------|-----|
| YouTube IFrame API (oficial) | https://developers.google.com/youtube/iframe_api_reference |
| YouTube Player Parameters | https://developers.google.com/youtube/player_parameters |
| react-youtube (npm) | https://www.npmjs.com/package/react-youtube |
| react-youtube (GitHub) | https://github.com/tjallingt/react-youtube |
| Shadcnblocks Rating | https://www.shadcnblocks.com/components/rating |
| Shadcraft Star Rating | https://shadcraft.com/components/star-rating |
| Lucide Star Icon | https://lucide.dev/icons/star |
| Flag/Report UI Pattern | https://ui-patterns.com/patterns/flagging-and-reporting |
