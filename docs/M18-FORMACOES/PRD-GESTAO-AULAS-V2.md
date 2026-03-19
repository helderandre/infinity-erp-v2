# PRD — Aprimoramento da Gestão de Aulas (M18 v2)

**Data:** 2026-03-19
**Escopo:** 5 funcionalidades de aprimoramento do dialog de gestão de aulas
**Módulo:** M18 — Formações

---

## Resumo Executivo

| # | Funcionalidade | Resumo |
|---|---------------|--------|
| 1 | Materiais de download | Anexar ficheiros (PDF, DOCX, etc.) e links externos a cada aula |
| 2 | Extracção automática de duração YouTube | Obter duração do vídeo a partir do URL YouTube |
| 3 | Refactor do dialog de aula | Redesenhar completamente o dialog para comportar materiais, links e quiz |
| 4 | Upload de materiais para R2 | Envio de ficheiros para Cloudflare R2 com metadados no Supabase |
| 5 | Quizzes por aula | Sistema de quiz inline na página de lição com nota e possibilidade de refazer |

---

## 1. Estado Actual — O Que Existe Hoje

### 1.1 Dialog de Aula (`course-builder.tsx`)

O dialog actual (linhas 525-761 de `course-builder.tsx`) é simples:

**Campos fixos:**
- Título (obrigatório)
- Tipo de Conteúdo: `video | pdf | text | external_link`
- Duração Estimada (minutos)

**Campos condicionais por tipo:**
- `video` → URL do Vídeo, Plataforma (youtube/vimeo/r2/other), Duração (segundos) — **manual**
- `pdf` → URL do PDF
- `text` → Conteúdo de Texto (textarea)
- `external_link` → URL Externa

**Limitações:**
- Não suporta materiais de download anexos
- Não suporta links de recursos adicionais
- Duração do vídeo YouTube é preenchida manualmente
- Não tem secção de quiz
- Dialog pequeno (`max-w-lg`) sem espaço para funcionalidades adicionais

### 1.2 Schema da Tabela `temp_training_lessons`

```
id, module_id, title, description, content_type, video_url, video_provider,
video_duration_seconds, pdf_url, text_content, external_url, order_index,
is_active, estimated_minutes, created_at, updated_at
```

**Não existe:** tabela de materiais/anexos por aula.

### 1.3 YouTube — Estado Actual

- `react-youtube@10.1.0` instalado e funcional
- `YouTubeCustomPlayer` (`youtube-custom-player.tsx`) já usa `player.getDuration()` **client-side**
- `extractYouTubeId()` definida em `youtube-custom-player.tsx` (linhas 24-34)
- Duração do vídeo (`video_duration_seconds`) preenchida manualmente no dialog de criação

### 1.4 Quiz — Estado Actual

- Sistema de quizzes completo para **módulos** e **cursos** (não aulas)
- Tabelas: `temp_training_quizzes`, `temp_training_quiz_questions`, `temp_training_quiz_attempts`
- Componentes: `QuizPlayer`, `QuizResults`, `QuizBuilder`
- Hook: `useTrainingQuiz`
- Constraint actual: `quiz_parent_check` exige exactamente 1 de `module_id` OU `course_id`
- **Não existe `lesson_id`** na tabela de quizzes

### 1.5 R2 Upload — Padrões Existentes

O projecto já tem upload para R2 em vários contextos:

**Infra core:**
- `lib/r2/client.ts` — S3Client singleton (`getR2Client()`, `R2_BUCKET`, `R2_PUBLIC_DOMAIN`)
- `lib/r2/images.ts` — `uploadImageToR2()` para imagens de imóveis
- `lib/r2/documents.ts` — `uploadDocumentToR2()` com contextos (property/owner/consultant)

**Padrão de upload:**
```typescript
const s3 = getR2Client()
await s3.send(new PutObjectCommand({
  Bucket: R2_BUCKET,
  Key: `${basePath}/${Date.now()}-${sanitizedFileName}`,
  Body: buffer,
  ContentType: contentType,
}))
const url = `${R2_PUBLIC_DOMAIN}/${key}`
```

**Paths existentes no R2:**
```
bucket/
├── imoveis-imagens/{propertyId}/     ← imagens WebP
├── imoveis/{propertyId}/             ← documentos
├── proprietarios/{ownerId}/          ← documentos
├── consultores/{consultantId}/       ← documentos
├── public/usuarios-fotos/{userId}/   ← fotos perfil
└── public/templates/docs/images/     ← imagens templates
```

---

## 2. Ficheiros da Base de Código Relevantes

### Ficheiros a MODIFICAR

| Ficheiro | Razão |
|----------|-------|
| [course-builder.tsx](components/training/course-builder.tsx) | Refactor total do dialog de aula |
| [types/training.ts](types/training.ts) | Adicionar `TrainingLessonMaterial`, `lesson_id` no quiz, `quiz` na lesson |
| [lib/validations/training.ts](lib/validations/training.ts) | Schemas para materiais, quiz por aula |
| [app/api/training/modules/[id]/lessons/route.ts](app/api/training/modules/[id]/lessons/route.ts) | Extrair duração YouTube ao criar aula |
| [app/api/training/lessons/[id]/route.ts](app/api/training/lessons/[id]/route.ts) | Extrair duração YouTube ao editar aula |
| [app/api/training/quizzes/route.ts](app/api/training/quizzes/route.ts) | Suportar `lesson_id` filter/create |
| [app/api/training/quizzes/[id]/attempt/route.ts](app/api/training/quizzes/[id]/attempt/route.ts) | Resolver courseId via lesson→module→course |
| [app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx](app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx) | Adicionar materiais de download + quiz inline |

### Ficheiros a CRIAR

| Ficheiro | Descrição |
|----------|-----------|
| `lib/r2/training.ts` | Funções `uploadTrainingMaterial()` e `deleteTrainingMaterial()` |
| `lib/youtube.ts` | `getYouTubeDuration()` server-side (YouTube Data API v3) |
| `app/api/training/lessons/[id]/materials/route.ts` | CRUD de materiais (GET/POST) |
| `app/api/training/lessons/[id]/materials/[materialId]/route.ts` | DELETE material individual |
| `components/training/lesson-materials.tsx` | UI de materiais na página de lição (download cards) |
| `components/training/lesson-quiz.tsx` | Quiz inline na página de lição |
| `components/training/lesson-material-upload.tsx` | Upload de materiais no dialog de gestão |

---

## 3. Base de Dados — Alterações Necessárias

### 3.1 Nova Tabela: `temp_training_lesson_materials`

```sql
CREATE TABLE temp_training_lesson_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES temp_training_lessons(id) ON DELETE CASCADE,

  -- Tipo: 'file' (R2 upload) ou 'link' (URL externa)
  material_type TEXT NOT NULL CHECK (material_type IN ('file', 'link')),

  -- Para ficheiros (R2)
  file_url TEXT,
  file_name TEXT,
  file_extension TEXT,          -- pdf, docx, xlsx, pptx, zip, etc.
  file_size_bytes BIGINT,
  file_mime_type TEXT,

  -- Para links externos
  link_url TEXT,
  link_title TEXT,

  -- Comuns
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_materials_lesson ON temp_training_lesson_materials(lesson_id);
```

**Constraint de integridade:**
```sql
ALTER TABLE temp_training_lesson_materials ADD CONSTRAINT material_content_check CHECK (
  (material_type = 'file' AND file_url IS NOT NULL AND file_name IS NOT NULL) OR
  (material_type = 'link' AND link_url IS NOT NULL AND link_title IS NOT NULL)
);
```

### 3.2 Alteração: `temp_training_quizzes` — Adicionar `lesson_id`

```sql
-- Adicionar coluna lesson_id
ALTER TABLE temp_training_quizzes
  ADD COLUMN lesson_id UUID REFERENCES temp_training_lessons(id) ON DELETE CASCADE;

-- Remover constraint antigo
ALTER TABLE temp_training_quizzes
  DROP CONSTRAINT quiz_parent_check;

-- Novo constraint: exactamente 1 de module_id, course_id, ou lesson_id
ALTER TABLE temp_training_quizzes
  ADD CONSTRAINT quiz_parent_check CHECK (
    (
      (module_id IS NOT NULL)::int +
      (course_id IS NOT NULL)::int +
      (lesson_id IS NOT NULL)::int
    ) = 1
  );

-- Index para lookup por lesson
CREATE INDEX idx_training_quizzes_lesson_id
  ON temp_training_quizzes(lesson_id) WHERE lesson_id IS NOT NULL;

-- Unique: máximo 1 quiz por aula
CREATE UNIQUE INDEX idx_training_quizzes_lesson_unique
  ON temp_training_quizzes(lesson_id) WHERE lesson_id IS NOT NULL;
```

---

## 4. Extracção de Duração YouTube — Abordagens

### 4.1 Pesquisa Realizada

| Abordagem | Retorna Duração? | Server-side? | API Key? | Rate Limit |
|-----------|:---:|:---:|:---:|---|
| **YouTube Data API v3** | Sim | Sim | Obrigatória | 10.000/dia (grátis) |
| YouTube oEmbed | Não | Sim | Não | — |
| noembed.com | Não | Sim | Não | — |
| react-youtube (IFrame API) | Sim | **Não** (client only) | Não | — |

### 4.2 Abordagem Recomendada: Híbrida

**Server-side (YouTube Data API v3)** — usado ao criar/editar aula:

```typescript
// lib/youtube.ts

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

export async function getYouTubeDuration(videoUrl: string): Promise<number | null> {
  const videoId = extractYouTubeId(videoUrl)
  if (!videoId) return null

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY não configurada — duração não extraída')
    return null
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`
    )
    if (!res.ok) return null

    const data = await res.json()
    if (!data.items?.length) return null

    return parseISO8601Duration(data.items[0].contentDetails.duration)
  } catch (error) {
    console.error('Erro ao obter duração YouTube:', error)
    return null
  }
}
```

**Documentação:** https://developers.google.com/youtube/v3/docs/videos/list

**Setup necessário:**
1. Activar "YouTube Data API v3" na Google Cloud Console
2. Criar API Key (restrita a YouTube Data API v3)
3. Adicionar `YOUTUBE_API_KEY=...` ao `.env.local`

**Fallback client-side** — já existe no `YouTubeCustomPlayer`:
```typescript
// youtube-custom-player.tsx:132
const onReady: YouTubeProps['onReady'] = (event) => {
  playerRef.current = event.target
  setDuration(event.target.getDuration())  // client-side, já funciona
}
```

Adicionar persistência: quando o player carrega e obtém a duração, enviar PATCH para actualizar `video_duration_seconds` no DB se estiver a `null`.

### 4.3 Integração no Dialog

Ao criar/editar uma aula com `content_type === 'video'` e `video_provider === 'youtube'`:

1. Ao mudar o campo `video_url`, debounce 500ms
2. Extrair o videoId do URL
3. Se válido, fazer `fetch('/api/training/youtube-duration?url=${videoUrl}')`
4. API Route chama `getYouTubeDuration()` server-side
5. Se obtiver duração, preencher automaticamente `video_duration_seconds`
6. Mostrar indicador visual: "Duração detectada: 5:23"
7. Campo continua editável (override manual)

**API Route auxiliar:**
```typescript
// app/api/training/youtube-duration/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'URL obrigatório' }, { status: 400 })

  const duration = await getYouTubeDuration(url)
  return NextResponse.json({ duration_seconds: duration })
}
```

---

## 5. Upload de Materiais para R2

### 5.1 Path no R2

```
bucket/
└── formacoes/materiais/{lessonId}/{timestamp}-{sanitizedFileName}
```

### 5.2 Função de Upload

```typescript
// lib/r2/training.ts

import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'
import { sanitizeFileName } from './documents'

const TRAINING_MATERIALS_PATH = 'formacoes/materiais'

export async function uploadTrainingMaterial(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  lessonId: string
): Promise<{ url: string; key: string }> {
  const s3 = getR2Client()
  const sanitized = sanitizeFileName(fileName)
  const key = `${TRAINING_MATERIALS_PATH}/${lessonId}/${Date.now()}-${sanitized}`

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  }))

  const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key
  return { url, key }
}

export async function deleteTrainingMaterial(fileUrl: string): Promise<void> {
  try {
    const s3 = getR2Client()
    const key = R2_PUBLIC_DOMAIN
      ? fileUrl.replace(`${R2_PUBLIC_DOMAIN}/`, '')
      : fileUrl
    await s3.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }))
  } catch (error) {
    console.error('Erro ao eliminar material do R2:', error)
  }
}
```

### 5.3 Extensões Permitidas

```typescript
const ALLOWED_MATERIAL_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'zip', 'rar', '7z',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'mp3', 'mp4', 'webm',
] as const

const MAX_MATERIAL_SIZE = 50 * 1024 * 1024 // 50MB
```

### 5.4 API Route — Materiais

```typescript
// app/api/training/lessons/[id]/materials/route.ts

// GET — listar materiais da aula
export async function GET(request, { params }) {
  const { id: lessonId } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('temp_training_lesson_materials')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true })

  return NextResponse.json({ data })
}

// POST — upload de material (ficheiro) ou criar link
export async function POST(request, { params }) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { id: lessonId } = await params
  const supabase = await createClient()
  const formData = await request.formData()

  const materialType = formData.get('material_type') as string

  if (materialType === 'file') {
    const file = formData.get('file') as File
    // Validar extensão e tamanho
    // Upload para R2
    // Inserir registo em temp_training_lesson_materials
  } else if (materialType === 'link') {
    const linkUrl = formData.get('link_url') as string
    const linkTitle = formData.get('link_title') as string
    // Inserir registo em temp_training_lesson_materials
  }
}
```

### 5.5 Metadados Armazenados no Supabase

```typescript
interface TrainingLessonMaterial {
  id: string
  lesson_id: string
  material_type: 'file' | 'link'

  // Ficheiros (R2)
  file_url?: string | null
  file_name?: string | null        // "manual-vendas.pdf"
  file_extension?: string | null    // "pdf"
  file_size_bytes?: number | null   // 2457600
  file_mime_type?: string | null    // "application/pdf"

  // Links
  link_url?: string | null          // "https://docs.google.com/..."
  link_title?: string | null        // "Manual de Vendas (Google Docs)"

  // Comuns
  description?: string | null
  order_index: number
  created_at: string
  updated_at: string
}
```

---

## 6. Refactor do Dialog de Aula

### 6.1 Novo Layout — Design com Tabs

O dialog actual (`max-w-lg`) é demasiado pequeno. Expandir para `max-w-2xl` com **tabs internas**:

```
┌─────────────────────────────────────────────────────┐
│ Nova Lição / Editar Lição                        ✕  │
├─────────────────────────────────────────────────────┤
│ [Conteúdo] [Materiais] [Quiz]                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│ TAB CONTEÚDO:                                       │
│ ┌─ Título * ──────────────────────────────────────┐ │
│ │ Cultura e Valores                               │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─ Descrição ─────────────────────────────────────┐ │
│ │ (textarea opcional)                              │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─ Tipo * ───────┐  ┌─ Duração (min) ───────────┐ │
│ │ Vídeo        ▼ │  │ 10                        │ │
│ └────────────────┘  └───────────────────────────┘ │
│                                                     │
│ ┌─ URL do Vídeo * ────────────────────────────────┐ │
│ │ https://youtube.com/watch?v=dQw4w...            │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─ Plataforma ───┐  ┌─ Duração (s) ─────────────┐ │
│ │ YouTube      ▼ │  │ 300  ✓ Detectado          │ │
│ └────────────────┘  └───────────────────────────┘ │
│                                                     │
│ TAB MATERIAIS:                                      │
│ ┌─ Materiais de Apoio ────────────────────────────┐ │
│ │ [+ Ficheiro] [+ Link]                           │ │
│ │                                                 │ │
│ │ 📄 manual-vendas.pdf (2.4 MB)           [🗑️]  │ │
│ │ 🔗 Apresentação Google Slides           [🗑️]  │ │
│ │ 📄 exercicio-pratico.docx (156 KB)      [🗑️]  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ TAB QUIZ:                                           │
│ ┌─ Quiz da Lição ────────────────────────────────┐  │
│ │ ☐ Activar quiz para esta lição                 │  │
│ │                                                 │  │
│ │ [QuizBuilder simplificado inline]               │  │
│ └─────────────────────────────────────────────────┘  │
│                                                     │
│              [Cancelar]  [■ Guardar]                │
└─────────────────────────────────────────────────────┘
```

### 6.2 Componentes shadcn/ui a Usar

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
```

### 6.3 Fluxo de Detecção Automática de Duração

```
User digita URL YouTube no campo video_url
  │
  ▼ debounce 500ms
  │
  ▼ Detectar provider automaticamente:
  │  - URL contém youtube.com ou youtu.be → set video_provider = 'youtube'
  │  - URL contém vimeo.com → set video_provider = 'vimeo'
  │
  ▼ Se YouTube:
  │  - Mostrar spinner "A detectar duração..."
  │  - GET /api/training/youtube-duration?url={videoUrl}
  │  - Se sucesso: preencher video_duration_seconds + badge "✓ Detectado"
  │  - Se falha: manter campo editável + badge "⚠ Não detectado"
  │
  ▼ Campo video_duration_seconds continua editável (override manual)
```

---

## 7. Quiz por Aula — Arquitectura

### 7.1 Relação no DB

- Relação **1:1**: máximo 1 quiz por aula (enforced por unique index)
- Quiz da aula é independente de quizzes de módulo/curso
- Reutiliza toda a infra existente: `QuizPlayer`, `QuizResults`, `useTrainingQuiz`

### 7.2 UI na Página de Lição (Padrão Udemy)

O quiz aparece **inline** abaixo do conteúdo da lição:

```
[Voltar ao Curso] [Título] [Reportar]
[Player / PDF / Texto / Link]
[Rating (estrelas)]
─────────────────────────────────
[Quiz: Título do Quiz]           ← collapsible Card
  │
  ▼ Expandido:
  │  - Descrição
  │  - N perguntas, nota mínima X%
  │  - [Iniciar Quiz]
  │
  ▼ Playing: QuizPlayer inline
  │
  ▼ Results: QuizResults inline
  │  - Score, pass/fail
  │  - [Tentar Novamente] (se não passou + tentativas restantes)
─────────────────────────────────
[← Anterior | Próxima →]
[Comentários]
```

### 7.3 Máquina de Estados do Quiz

```
collapsed → start → playing → results
               ↑                  │
               └── (retry) ───────┘
```

### 7.4 Componente `LessonQuiz`

```typescript
// components/training/lesson-quiz.tsx

interface LessonQuizProps {
  lessonId: string
  courseId: string
  onQuizPassed?: () => void
}

type QuizMode = 'collapsed' | 'start' | 'playing' | 'results'
```

**Fluxo:**
1. Ao montar, `GET /api/training/quizzes?lesson_id={lessonId}`
2. Se não há quiz → não renderiza nada
3. Se há quiz → mostra card collapsible com metadados
4. Click "Iniciar" → carrega perguntas, mostra `QuizPlayer`
5. Submit → mostra `QuizResults` com score
6. Se falhou e tem tentativas → botão "Tentar Novamente"
7. Se passou → `onQuizPassed()` (pode marcar lição como concluída)

### 7.5 Gestão no Dialog de Aula (Admin)

Na tab "Quiz" do dialog refactored:

1. Checkbox "Activar quiz para esta lição"
2. Se activo, mostrar `QuizBuilder` simplificado:
   - Título do quiz
   - Nota mínima (%) — default 70
   - Max tentativas (0 = ilimitado)
   - Lista de perguntas com opções
3. Ao guardar a aula, criar/actualizar quiz via API existente

### 7.6 Alterações na API de Quizzes

**`POST /api/training/quizzes`** — aceitar `lesson_id`:
```typescript
// Antes: converte '' para null só para module_id e course_id
// Depois: também para lesson_id
const lesson_id = validation.data.lesson_id === '' ? null : validation.data.lesson_id || null
```

**`GET /api/training/quizzes`** — filtrar por `lesson_id`:
```typescript
if (searchParams.get('lesson_id')) {
  query = query.eq('lesson_id', searchParams.get('lesson_id'))
}
```

**`POST /api/training/quizzes/[id]/attempt`** — resolver courseId via lesson:
```typescript
// Novo caminho: quiz.lesson_id → lesson.module_id → module.course_id
if (!courseId && quiz.lesson_id) {
  const { data: lesson } = await supabase
    .from('temp_training_lessons')
    .select('module_id')
    .eq('id', quiz.lesson_id)
    .single()
  if (lesson?.module_id) {
    const { data: mod } = await supabase
      .from('temp_training_modules')
      .select('course_id')
      .eq('id', lesson.module_id)
      .single()
    courseId = mod?.course_id
  }
}
```

---

## 8. Padrões de Implementação — Codebase Existente

### 8.1 Padrão de API Route Handler

```typescript
// Padrão usado em todos os route handlers do módulo de formações
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/permissions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // ... lógica
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

### 8.2 Padrão de Upload R2 (FormData)

```typescript
// Padrão de app/api/properties/[id]/media/route.ts
export async function POST(request, { params }) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // Validar tipo e tamanho
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo não suportado' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const { url } = await uploadToR2(buffer, file.name, file.type, id)

  // Registar no Supabase
  const { data, error } = await supabase
    .from('table')
    .insert({ url, file_name: file.name, file_size_bytes: file.size, ... })
    .select()
    .single()

  return NextResponse.json({ data }, { status: 201 })
}
```

### 8.3 Padrão de Zod Validation

```typescript
// Padrão de lib/validations/training.ts
export const createLessonSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  description: z.string().max(2000).optional().or(z.literal('')),
  content_type: z.enum(['video', 'pdf', 'text', 'external_link']),
  video_url: z.string().url('URL inválido').optional().or(z.literal('')),
  // ...
})
```

### 8.4 Padrão de Quiz (Existente)

```typescript
// Estrutura de opções (JSONB no DB)
options: Array<{
  id: string           // UUID gerado no cliente
  text: string         // Texto da opção
  is_correct: boolean  // Se é resposta correcta
}>

// Formato de respostas submetidas
answers: Array<{
  question_id: string
  selected_options: string[]  // IDs das opções seleccionadas
}>

// Scoring: all-or-nothing por pergunta (sem crédito parcial)
// score = (earned_points / total_points) * 100
// passed = score >= quiz.passing_score
```

### 8.5 Padrão de Toast PT-PT

```typescript
toast.success('Material adicionado com sucesso')
toast.error('Erro ao carregar material')
toast.loading('A carregar ficheiro...')
toast.promise(uploadFile(), {
  loading: 'A enviar ficheiro...',
  success: 'Ficheiro enviado com sucesso!',
  error: 'Erro ao enviar ficheiro.',
})
```

---

## 9. Padrões de Implementação Externos

### 9.1 YouTube Data API v3 — Obter Duração

**Documentação oficial:** https://developers.google.com/youtube/v3/docs/videos/list

```typescript
// GET https://www.googleapis.com/youtube/v3/videos
//   ?part=contentDetails
//   &id={VIDEO_ID}
//   &key={API_KEY}

// Resposta:
{
  "items": [{
    "id": "dQw4w9WgXcQ",
    "contentDetails": {
      "duration": "PT3M33S"  // ISO 8601
    }
  }]
}

// Parsing ISO 8601:
// PT1H2M10S → 3730 segundos
// PT5M → 300 segundos
// PT30S → 30 segundos
```

**Quota:** 1 unidade por chamada. Tier gratuito = 10.000 unidades/dia.

### 9.2 Upload Multipart com FormData (React)

```typescript
// Padrão client-side para upload de ficheiros
const uploadMaterial = async (file: File, lessonId: string) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('material_type', 'file')

  const res = await fetch(`/api/training/lessons/${lessonId}/materials`, {
    method: 'POST',
    body: formData, // NÃO definir Content-Type — o browser define com boundary
  })
  return res.json()
}
```

### 9.3 Quiz Inline — Padrão LMS (Udemy/Coursera)

**Best practices:**
1. Quiz aparece **abaixo do conteúdo** da lição (não numa página separada)
2. Card collapsible mostra metadados antes de iniciar
3. Uma pergunta por vez com progress dots
4. Resultados mostram score + breakdown por pergunta
5. Botão "Tentar Novamente" se falhou e tem tentativas
6. Relação 1:1 (um quiz por lição) para manter simples
7. Quizzes de módulo/curso são avaliações mais amplas

### 9.4 File Download Card — Padrão UI

```typescript
// Padrão de card de download com ícone por extensão
const FILE_ICONS: Record<string, LucideIcon> = {
  pdf: FileText,
  doc: FileText, docx: FileText,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet,
  ppt: Presentation, pptx: Presentation,
  zip: FileArchive, rar: FileArchive,
  mp4: Video, webm: Video,
  mp3: Music,
  default: File,
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

---

## 10. Types e Validações a Adicionar

### 10.1 Types (`types/training.ts`)

```typescript
// ─── Lesson Material ──────────────────────────────────
export type LessonMaterialType = 'file' | 'link'

export interface TrainingLessonMaterial {
  id: string
  lesson_id: string
  material_type: LessonMaterialType
  file_url?: string | null
  file_name?: string | null
  file_extension?: string | null
  file_size_bytes?: number | null
  file_mime_type?: string | null
  link_url?: string | null
  link_title?: string | null
  description?: string | null
  order_index: number
  created_at: string
  updated_at: string
}

// Actualizar TrainingLesson:
export interface TrainingLesson {
  // ... campos existentes ...
  materials?: TrainingLessonMaterial[]  // ADD
  quiz?: TrainingQuiz | null            // ADD
}

// Actualizar TrainingQuiz:
export interface TrainingQuiz {
  // ... campos existentes ...
  lesson_id?: string | null             // ADD
}
```

### 10.2 Validações Zod (`lib/validations/training.ts`)

```typescript
// ─── Lesson Material ──────────────────────────────────

export const createLessonMaterialSchema = z.object({
  material_type: z.enum(['file', 'link']),
  link_url: z.string().url('URL inválido').optional().or(z.literal('')),
  link_title: z.string().min(1).max(200).optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
})

export type CreateLessonMaterialInput = z.infer<typeof createLessonMaterialSchema>

// Actualizar createQuizSchema:
export const createQuizSchema = z.object({
  module_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
  course_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
  lesson_id: z.string().regex(uuidRegex).optional().or(z.literal('')),  // ADD
  title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  // ... restante mantém-se
})
```

---

## 11. Variáveis de Ambiente Necessárias

```env
# .env.local — adicionar:
YOUTUBE_API_KEY=AIza...  # YouTube Data API v3 key
```

**Setup da API Key:**
1. Ir a https://console.cloud.google.com/apis/library/youtube.googleapis.com
2. Activar "YouTube Data API v3"
3. Criar API Key em Credentials
4. Restringir a YouTube Data API v3
5. Copiar para `.env.local`

---

## 12. Ordem de Implementação Recomendada

### Fase 1 — Infra & DB (pré-requisitos)
1. Criar migração SQL: tabela `temp_training_lesson_materials` + alteração `temp_training_quizzes`
2. Criar `lib/youtube.ts` (extracção de duração)
3. Criar `lib/r2/training.ts` (upload de materiais)
4. Criar `app/api/training/youtube-duration/route.ts`
5. Actualizar types em `types/training.ts`
6. Actualizar validações em `lib/validations/training.ts`

### Fase 2 — API de Materiais
1. Criar `app/api/training/lessons/[id]/materials/route.ts` (GET + POST)
2. Criar `app/api/training/lessons/[id]/materials/[materialId]/route.ts` (DELETE)
3. Actualizar `app/api/training/modules/[id]/lessons/route.ts` — extrair duração YouTube
4. Actualizar `app/api/training/lessons/[id]/route.ts` — extrair duração YouTube

### Fase 3 — API de Quiz por Aula
1. Actualizar `app/api/training/quizzes/route.ts` — suportar `lesson_id`
2. Actualizar `app/api/training/quizzes/[id]/attempt/route.ts` — resolver courseId via lesson

### Fase 4 — Refactor do Dialog
1. Refactorizar dialog em `course-builder.tsx`:
   - Expandir para `max-w-2xl`
   - Adicionar Tabs (Conteúdo, Materiais, Quiz)
   - Detecção automática de provider + duração
2. Criar `components/training/lesson-material-upload.tsx` (tab Materiais)
3. Integrar QuizBuilder simplificado na tab Quiz

### Fase 5 — UI na Página de Lição
1. Criar `components/training/lesson-materials.tsx` (cards de download)
2. Criar `components/training/lesson-quiz.tsx` (quiz inline)
3. Integrar ambos na page `[lessonId]/page.tsx`

---

## 13. Resumo de Ficheiros

| # | Acção | Ficheiro | Razão |
|---|-------|---------|-------|
| 1 | SQL | Migração | `temp_training_lesson_materials` + `lesson_id` em quizzes |
| 2 | CRIAR | `lib/youtube.ts` | Extracção de duração YouTube (server-side) |
| 3 | CRIAR | `lib/r2/training.ts` | Upload/delete de materiais no R2 |
| 4 | CRIAR | `app/api/training/youtube-duration/route.ts` | API para detectar duração |
| 5 | CRIAR | `app/api/training/lessons/[id]/materials/route.ts` | GET + POST materiais |
| 6 | CRIAR | `app/api/training/lessons/[id]/materials/[materialId]/route.ts` | DELETE material |
| 7 | CRIAR | `components/training/lesson-materials.tsx` | Cards de download na página |
| 8 | CRIAR | `components/training/lesson-quiz.tsx` | Quiz inline na página |
| 9 | CRIAR | `components/training/lesson-material-upload.tsx` | Upload no dialog admin |
| 10 | MODIFICAR | `components/training/course-builder.tsx` | Refactor total do dialog |
| 11 | MODIFICAR | `types/training.ts` | Novos types |
| 12 | MODIFICAR | `lib/validations/training.ts` | Novos schemas |
| 13 | MODIFICAR | `app/api/training/modules/[id]/lessons/route.ts` | Auto-detectar duração |
| 14 | MODIFICAR | `app/api/training/lessons/[id]/route.ts` | Auto-detectar duração |
| 15 | MODIFICAR | `app/api/training/quizzes/route.ts` | Suportar lesson_id |
| 16 | MODIFICAR | `app/api/training/quizzes/[id]/attempt/route.ts` | Resolver courseId via lesson |
| 17 | MODIFICAR | `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx` | Integrar materiais + quiz |
| — | ENV | `.env.local` | `YOUTUBE_API_KEY` |

---

## 14. Referências

| Recurso | URL |
|---------|-----|
| YouTube Data API v3 — Videos: list | https://developers.google.com/youtube/v3/docs/videos/list |
| YouTube Player Parameters | https://developers.google.com/youtube/player_parameters |
| react-youtube (npm) | https://www.npmjs.com/package/react-youtube |
| Google Cloud Console — API Keys | https://console.cloud.google.com/apis/credentials |
| AWS SDK S3 — PutObjectCommand | https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/command/PutObjectCommand/ |
| shadcn/ui Tabs | https://ui.shadcn.com/docs/components/tabs |
| shadcn/ui Dialog | https://ui.shadcn.com/docs/components/dialog |
| ISO 8601 Duration | https://en.wikipedia.org/wiki/ISO_8601#Durations |
