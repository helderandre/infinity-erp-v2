# SPEC — Aprimoramento da Gestão de Aulas (M18 v2)

**Data:** 2026-03-19
**PRD de referência:** [PRD-GESTAO-AULAS-V2.md](PRD-GESTAO-AULAS-V2.md)

---

## Resumo

5 funcionalidades: materiais de download, extracção automática de duração YouTube, refactor do dialog de aula com tabs, upload de materiais para R2, quizzes por aula. Esta spec detalha **cada ficheiro** a criar ou modificar e **o que fazer** em cada um.

---

## FASE 1 — Infra & DB

---

### 1.1 SQL Migration (Supabase Dashboard ou MCP)

**O que fazer:**

```sql
-- 1. Nova tabela de materiais por aula
CREATE TABLE temp_training_lesson_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES temp_training_lessons(id) ON DELETE CASCADE,
  material_type TEXT NOT NULL CHECK (material_type IN ('file', 'link')),
  file_url TEXT,
  file_name TEXT,
  file_extension TEXT,
  file_size_bytes BIGINT,
  file_mime_type TEXT,
  link_url TEXT,
  link_title TEXT,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_materials_lesson ON temp_training_lesson_materials(lesson_id);

ALTER TABLE temp_training_lesson_materials ADD CONSTRAINT material_content_check CHECK (
  (material_type = 'file' AND file_url IS NOT NULL AND file_name IS NOT NULL) OR
  (material_type = 'link' AND link_url IS NOT NULL AND link_title IS NOT NULL)
);

-- 2. Adicionar lesson_id à tabela de quizzes
ALTER TABLE temp_training_quizzes
  ADD COLUMN lesson_id UUID REFERENCES temp_training_lessons(id) ON DELETE CASCADE;

ALTER TABLE temp_training_quizzes
  DROP CONSTRAINT quiz_parent_check;

ALTER TABLE temp_training_quizzes
  ADD CONSTRAINT quiz_parent_check CHECK (
    (
      (module_id IS NOT NULL)::int +
      (course_id IS NOT NULL)::int +
      (lesson_id IS NOT NULL)::int
    ) = 1
  );

CREATE INDEX idx_training_quizzes_lesson_id
  ON temp_training_quizzes(lesson_id) WHERE lesson_id IS NOT NULL;

CREATE UNIQUE INDEX idx_training_quizzes_lesson_unique
  ON temp_training_quizzes(lesson_id) WHERE lesson_id IS NOT NULL;
```

---

### 1.2 CRIAR `lib/youtube.ts`

**O que fazer:** Funções server-side para extracção de duração de vídeos YouTube via Data API v3.

```typescript
// 3 funções exportadas:

export function extractYouTubeId(url: string): string | null
// Copiar lógica de youtube-custom-player.tsx:24-34
// Adicionar pattern para /shorts/: /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/

export function parseISO8601Duration(duration: string): number
// Parse "PT1H2M10S" → 3730 (segundos)
// Regex: /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/

export async function getYouTubeDuration(videoUrl: string): Promise<number | null>
// 1. extractYouTubeId(videoUrl) → videoId
// 2. Ler process.env.YOUTUBE_API_KEY — se não existe, console.warn e return null
// 3. fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${apiKey}`)
// 4. Parse response → parseISO8601Duration(data.items[0].contentDetails.duration)
// 5. try/catch com console.error, return null em caso de erro
```

---

### 1.3 CRIAR `lib/r2/training.ts`

**O que fazer:** Upload e delete de materiais de formação no R2. Seguir padrão de `lib/r2/documents.ts`.

```typescript
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'
import { sanitizeFileName } from './documents'  // reutilizar

const TRAINING_MATERIALS_PATH = 'formacoes/materiais'

export const ALLOWED_MATERIAL_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'zip', 'rar', '7z',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'mp3', 'mp4', 'webm',
] as const

export const MAX_MATERIAL_SIZE = 50 * 1024 * 1024 // 50MB

export async function uploadTrainingMaterial(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  lessonId: string
): Promise<{ url: string; key: string }>
// Path: formacoes/materiais/{lessonId}/{timestamp}-{sanitizedFileName}
// Padrão idêntico a uploadDocumentToR2

export async function deleteTrainingMaterial(fileUrl: string): Promise<void>
// Extrair key do URL, enviar DeleteObjectCommand
// Padrão idêntico a deleteDocumentFromR2
```

---

### 1.4 CRIAR `app/api/training/youtube-duration/route.ts`

**O que fazer:** API Route GET para detectar duração de vídeo YouTube.

```typescript
import { getYouTubeDuration } from '@/lib/youtube'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'URL obrigatório' }, { status: 400 })

  const duration = await getYouTubeDuration(url)
  return NextResponse.json({ duration_seconds: duration })
}
```

**Nota:** Não requer auth — é apenas um lookup público. Mas se quiser restringir, adicionar `requirePermission('training')`.

---

### 1.5 MODIFICAR `types/training.ts`

**O que fazer:** Adicionar type `TrainingLessonMaterial`, adicionar `lesson_id` ao `TrainingQuiz`, adicionar campos opcionais ao `TrainingLesson`.

**Adicionar (no final do ficheiro ou agrupado com lesson types):**

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
```

**Modificar `TrainingLesson` (linhas 96-114):**
- Adicionar ao final da interface:
```typescript
  materials?: TrainingLessonMaterial[]  // ADD
  quiz?: TrainingQuiz | null            // ADD
```

**Modificar `TrainingQuiz` (linhas 118-135):**
- Adicionar após `course_id`:
```typescript
  lesson_id?: string | null             // ADD
```

---

### 1.6 MODIFICAR `lib/validations/training.ts`

**O que fazer:** Adicionar schema de materiais, adicionar `lesson_id` ao `createQuizSchema`.

**Adicionar (após `createLessonSchema`):**

```typescript
// ─── Lesson Material ──────────────────────────────────
export const createLessonMaterialSchema = z.object({
  material_type: z.enum(['file', 'link']),
  link_url: z.string().url('URL inválido').optional().or(z.literal('')),
  link_title: z.string().min(1).max(200).optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
})

export type CreateLessonMaterialInput = z.infer<typeof createLessonMaterialSchema>
```

**Modificar `createQuizSchema` (linhas 69-79):**
- Adicionar campo `lesson_id` ao objecto:
```typescript
  lesson_id: z.string().regex(uuidRegex).optional().or(z.literal('')),  // ADD após course_id
```

---

## FASE 2 — API de Materiais

---

### 2.1 CRIAR `app/api/training/lessons/[id]/materials/route.ts`

**O que fazer:** GET (listar materiais) + POST (upload ficheiro ou criar link).

```typescript
// GET — Listar materiais da aula
// 1. Extrair lessonId dos params
// 2. supabase.from('temp_training_lesson_materials').select('*').eq('lesson_id', lessonId).order('order_index')
// 3. Retornar { data }

// POST — Criar material (ficheiro ou link)
// 1. requirePermission('training')
// 2. const formData = await request.formData()
// 3. const materialType = formData.get('material_type') as string
//
// Se materialType === 'file':
//   a. const file = formData.get('file') as File
//   b. Validar extensão contra ALLOWED_MATERIAL_EXTENSIONS
//   c. Validar tamanho contra MAX_MATERIAL_SIZE (50MB)
//   d. const buffer = Buffer.from(await file.arrayBuffer())
//   e. const { url } = await uploadTrainingMaterial(buffer, file.name, file.type, lessonId)
//   f. Extrair extensão: file.name.split('.').pop()?.toLowerCase()
//   g. Contar materiais existentes para order_index
//   h. Insert em temp_training_lesson_materials:
//      { lesson_id, material_type: 'file', file_url: url, file_name: file.name,
//        file_extension, file_size_bytes: file.size, file_mime_type: file.type,
//        description, order_index }
//
// Se materialType === 'link':
//   a. const linkUrl = formData.get('link_url') as string
//   b. const linkTitle = formData.get('link_title') as string
//   c. Validar com createLessonMaterialSchema
//   d. Insert em temp_training_lesson_materials:
//      { lesson_id, material_type: 'link', link_url, link_title, description, order_index }
//
// 4. Retornar { data } com status 201
```

---

### 2.2 CRIAR `app/api/training/lessons/[id]/materials/[materialId]/route.ts`

**O que fazer:** DELETE individual de material.

```typescript
// DELETE
// 1. requirePermission('training')
// 2. Extrair lessonId e materialId dos params
// 3. Buscar material para obter file_url (se for tipo 'file')
// 4. Se material_type === 'file' e file_url existe:
//    await deleteTrainingMaterial(file_url)  // apagar do R2
// 5. supabase.from('temp_training_lesson_materials').delete().eq('id', materialId)
// 6. Retornar { message: 'Material eliminado com sucesso' }
```

---

### 2.3 MODIFICAR `app/api/training/modules/[id]/lessons/route.ts`

**O que fazer:** Após criar a lição, se `content_type === 'video'` e `video_provider === 'youtube'`, extrair duração automaticamente.

**Adicionar após o insert (após linha ~50, quando `data` é retornado):**

```typescript
import { getYouTubeDuration } from '@/lib/youtube'

// ... após insert com sucesso e antes de retornar ...

// Auto-detectar duração YouTube se não fornecida
if (
  data.content_type === 'video' &&
  data.video_provider === 'youtube' &&
  data.video_url &&
  !data.video_duration_seconds
) {
  const duration = await getYouTubeDuration(data.video_url)
  if (duration) {
    await supabase
      .from('temp_training_lessons')
      .update({ video_duration_seconds: duration })
      .eq('id', data.id)
    data.video_duration_seconds = duration
  }
}
```

---

### 2.4 MODIFICAR `app/api/training/lessons/[id]/route.ts`

**O que fazer:** No PUT handler, mesma lógica de auto-detectar duração YouTube quando o URL muda.

**Adicionar após o update (após obter `data` de volta):**

```typescript
import { getYouTubeDuration } from '@/lib/youtube'

// ... após update com sucesso ...

// Auto-detectar duração YouTube se URL mudou e duração não foi fornecida manualmente
if (
  data.content_type === 'video' &&
  data.video_provider === 'youtube' &&
  data.video_url &&
  !validation.data.video_duration_seconds &&  // user não enviou duração manualmente
  !data.video_duration_seconds
) {
  const duration = await getYouTubeDuration(data.video_url)
  if (duration) {
    await supabase
      .from('temp_training_lessons')
      .update({ video_duration_seconds: duration })
      .eq('id', data.id)
    data.video_duration_seconds = duration
  }
}
```

---

## FASE 3 — API de Quiz por Aula

---

### 3.1 MODIFICAR `app/api/training/quizzes/route.ts`

**O que fazer:** Suportar `lesson_id` no POST (criar quiz) e adicionar GET handler para filtrar por `lesson_id`.

**No POST handler (após linha 38, bloco de course_id):**

```typescript
if (validation.data.lesson_id && validation.data.lesson_id !== '') {
  insertData.lesson_id = validation.data.lesson_id
}
```

**Adicionar GET handler:**

```typescript
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    let query = supabase
      .from('temp_training_quizzes')
      .select('*, questions:temp_training_quiz_questions(count)')

    if (searchParams.get('module_id')) {
      query = query.eq('module_id', searchParams.get('module_id'))
    }
    if (searchParams.get('course_id')) {
      query = query.eq('course_id', searchParams.get('course_id'))
    }
    if (searchParams.get('lesson_id')) {
      query = query.eq('lesson_id', searchParams.get('lesson_id'))
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Erro ao listar questionários:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

---

### 3.2 MODIFICAR `app/api/training/quizzes/[id]/attempt/route.ts`

**O que fazer:** Adicionar resolução de `courseId` via `lesson_id → module_id → course_id`.

**Localizar o bloco de resolução de courseId (linhas ~44-60) e adicionar após o bloco de module_id:**

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

**Também:** O SELECT inicial do quiz (que busca `quiz.course_id, quiz.module_id`) precisa incluir `quiz.lesson_id`:

```typescript
// Alterar a query que busca o quiz para incluir lesson_id no select
.select('*, lesson_id')  // ou se já usa *, está OK
```

---

## FASE 4 — Refactor do Dialog de Aula

---

### 4.1 MODIFICAR `components/training/course-builder.tsx`

**O que fazer:** Refactorizar o dialog de lição (linhas 525-761) para usar tabs (Conteúdo, Materiais, Quiz). Expandir para `max-w-2xl`.

**Alterações concretas:**

1. **Imports novos** (adicionar no topo):
```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LessonMaterialUpload } from './lesson-material-upload'
```

2. **Dialog size** — mudar `max-w-lg` para `max-w-2xl`

3. **Estrutura do DialogContent** — envolver o conteúdo em Tabs:

```tsx
<DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
  <DialogHeader>
    <DialogTitle>{editingLesson ? 'Editar Lição' : 'Nova Lição'}</DialogTitle>
  </DialogHeader>

  <Tabs defaultValue="conteudo">
    <TabsList className="grid w-full grid-cols-3">
      <TabsTrigger value="conteudo">Conteúdo</TabsTrigger>
      <TabsTrigger value="materiais" disabled={!editingLesson}>
        Materiais
      </TabsTrigger>
      <TabsTrigger value="quiz" disabled={!editingLesson}>
        Quiz
      </TabsTrigger>
    </TabsList>

    <TabsContent value="conteudo">
      {/* Mover todo o form actual para aqui (campos título, tipo, URL, etc.) */}
      {/* Adicionar detecção automática de provider + duração YouTube */}
    </TabsContent>

    <TabsContent value="materiais">
      {editingLesson && (
        <LessonMaterialUpload lessonId={editingLesson.id} />
      )}
    </TabsContent>

    <TabsContent value="quiz">
      {editingLesson && (
        <QuizBuilder
          lessonId={editingLesson.id}
          onSave={onRefresh}
          onCancel={() => {}}
        />
      )}
    </TabsContent>
  </Tabs>

  <DialogFooter>
    <Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Cancelar</Button>
    <Button onClick={lessonForm.handleSubmit(handleSaveLesson)} disabled={isSubmitting}>
      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      Guardar
    </Button>
  </DialogFooter>
</DialogContent>
```

4. **Detecção automática de duração YouTube na tab Conteúdo:**

Adicionar lógica de debounce no campo `video_url`:

```typescript
// Novo state
const [isDetectingDuration, setIsDetectingDuration] = useState(false)
const [durationDetected, setDurationDetected] = useState(false)

// useEffect que observa video_url
const watchVideoUrl = lessonForm.watch('video_url')
const watchProvider = lessonForm.watch('video_provider')

useEffect(() => {
  if (!watchVideoUrl || watchProvider !== 'youtube') return
  setDurationDetected(false)

  const timer = setTimeout(async () => {
    // Auto-detectar provider
    if (watchVideoUrl.includes('youtube') || watchVideoUrl.includes('youtu.be')) {
      lessonForm.setValue('video_provider', 'youtube')
    } else if (watchVideoUrl.includes('vimeo')) {
      lessonForm.setValue('video_provider', 'vimeo')
    }

    // Detectar duração
    if (watchVideoUrl.includes('youtube') || watchVideoUrl.includes('youtu.be')) {
      setIsDetectingDuration(true)
      try {
        const res = await fetch(`/api/training/youtube-duration?url=${encodeURIComponent(watchVideoUrl)}`)
        const data = await res.json()
        if (data.duration_seconds) {
          lessonForm.setValue('video_duration_seconds', data.duration_seconds)
          setDurationDetected(true)
        }
      } catch {} finally {
        setIsDetectingDuration(false)
      }
    }
  }, 500) // debounce 500ms

  return () => clearTimeout(timer)
}, [watchVideoUrl])
```

5. **Badge visual no campo de duração:**

```tsx
{/* Junto ao campo video_duration_seconds */}
{isDetectingDuration && (
  <Badge variant="secondary" className="text-xs">
    <Loader2 className="h-3 w-3 animate-spin mr-1" />
    A detectar...
  </Badge>
)}
{durationDetected && (
  <Badge variant="secondary" className="text-xs text-emerald-700">
    ✓ Detectado
  </Badge>
)}
```

6. **Tabs Materiais e Quiz desactivadas** quando estiver a criar (não editar) — porque o `lessonId` ainda não existe. Mostrar tooltip: "Guarde a lição primeiro para adicionar materiais/quiz."

---

### 4.2 CRIAR `components/training/lesson-material-upload.tsx`

**O que fazer:** Componente para a tab "Materiais" do dialog de aula. Permite fazer upload de ficheiros e adicionar links.

```typescript
interface LessonMaterialUploadProps {
  lessonId: string
}

// Estado:
// - materials: TrainingLessonMaterial[] (lista actual)
// - isUploading: boolean
// - showLinkForm: boolean (toggle formulário de link)

// Ao montar:
// GET /api/training/lessons/{lessonId}/materials → popular lista

// Upload de ficheiro:
// 1. Input type="file" com accept baseado em ALLOWED_MATERIAL_EXTENSIONS
// 2. Validar tamanho (MAX_MATERIAL_SIZE = 50MB)
// 3. FormData com file + material_type='file'
// 4. POST /api/training/lessons/{lessonId}/materials
// 5. toast.promise com loading/success/error PT-PT
// 6. Refresh lista

// Adicionar link:
// 1. Formulário inline com link_url + link_title
// 2. FormData com material_type='link' + link_url + link_title
// 3. POST /api/training/lessons/{lessonId}/materials
// 4. toast.success, refresh lista

// Eliminar material:
// 1. Botão de delete em cada item
// 2. DELETE /api/training/lessons/{lessonId}/materials/{materialId}
// 3. toast.success, refresh lista

// UI:
// [+ Ficheiro] [+ Link]  ← botões no topo
// Lista de materiais com:
//   - Ícone por extensão (FileText para pdf/doc, FileSpreadsheet para xls, etc.)
//   - Nome do ficheiro ou título do link
//   - Tamanho (formatado) para ficheiros
//   - Botão de eliminar (Trash2)
//   - Para links: ícone ExternalLink
```

**Ícones por extensão:**
```typescript
import { FileText, FileSpreadsheet, Presentation, FileArchive, Video, Music, File, ExternalLink } from 'lucide-react'

const FILE_ICONS: Record<string, LucideIcon> = {
  pdf: FileText, doc: FileText, docx: FileText,
  xls: FileSpreadsheet, xlsx: FileSpreadsheet,
  ppt: Presentation, pptx: Presentation,
  zip: FileArchive, rar: FileArchive, '7z': FileArchive,
  mp4: Video, webm: Video,
  mp3: Music,
}
// fallback: File

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

---

### 4.3 MODIFICAR `components/training/quiz-builder.tsx`

**O que fazer:** Adicionar prop `lessonId` à interface `QuizBuilderProps`.

**Modificar interface (linha 49-55):**

```typescript
interface QuizBuilderProps {
  quizId?: string
  moduleId?: string
  courseId?: string
  lessonId?: string  // ADD
  onSave: () => void
  onCancel: () => void
}
```

**Modificar lógica de save** para enviar `lesson_id` quando definido:

```typescript
// No onSubmit, ao montar o body para POST/PUT:
if (lessonId) {
  body.lesson_id = lessonId
}
```

**Modificar fetch inicial** (se `quizId` não for passado mas `lessonId` sim) para buscar quiz existente da lição:

```typescript
// Se não tem quizId mas tem lessonId, tentar encontrar quiz existente:
if (!quizId && lessonId) {
  const res = await fetch(`/api/training/quizzes?lesson_id=${lessonId}`)
  const data = await res.json()
  if (data.data?.length > 0) {
    // Carregar quiz existente para edição
    existingQuizId = data.data[0].id
  }
}
```

---

## FASE 5 — UI na Página de Lição

---

### 5.1 CRIAR `components/training/lesson-materials.tsx`

**O que fazer:** Componente de cards de download de materiais na página pública da lição.

```typescript
interface LessonMaterialsProps {
  lessonId: string
}

// Ao montar:
// GET /api/training/lessons/{lessonId}/materials
// Se não há materiais, não renderizar nada (return null)

// UI — Card com título "Materiais de Apoio":
// Lista de items, cada um:
//   Para ficheiros:
//     - Ícone por extensão (mesmo map de lesson-material-upload.tsx)
//     - file_name
//     - file_size formatado
//     - Botão/link "Descarregar" → abre file_url em nova tab
//   Para links:
//     - Ícone ExternalLink
//     - link_title
//     - Botão "Abrir" → abre link_url em nova tab
//   Se tem description, mostrar em text-muted-foreground text-sm

// Usar Card do shadcn com CardHeader + CardContent
// Ícone: Download do lucide no botão
```

---

### 5.2 CRIAR `components/training/lesson-quiz.tsx`

**O que fazer:** Quiz inline na página de lição, abaixo do conteúdo. Reutiliza `QuizPlayer` e `QuizResults` existentes.

```typescript
interface LessonQuizProps {
  lessonId: string
  courseId: string
  onQuizPassed?: () => void
}

type QuizMode = 'collapsed' | 'start' | 'playing' | 'results'

// Estado:
// - quiz: TrainingQuiz | null
// - mode: QuizMode (default: 'collapsed')
// - loading: boolean
// - lastAttempt: resultado do último attempt

// Ao montar:
// GET /api/training/quizzes?lesson_id={lessonId}
// Se data vazio → return null (não renderizar nada)
// Se data[0] existe → set quiz, carregar question_count

// UI — Máquina de estados:
//
// 'collapsed':
//   Card collapsible (Collapsible do shadcn ou simples toggle)
//   Header: "Quiz: {quiz.title}" + Badge com N perguntas
//   Expandir mostra: descrição, nota mínima, max tentativas, botão "Iniciar Quiz"
//
// 'start':
//   Mesma info + botão "Iniciar Quiz" → muda para 'playing'
//
// 'playing':
//   Renderizar QuizPlayer existente (import de quiz-player.tsx?)
//   Ou reimplementar inline com perguntas uma a uma
//   onSubmit → POST /api/training/quizzes/{quizId}/attempt
//   Após resposta → muda para 'results'
//
// 'results':
//   Mostrar score, passed/failed
//   Se passed: badge verde, chamar onQuizPassed()
//   Se failed e tem tentativas restantes: botão "Tentar Novamente" → volta a 'start'
//   Se failed sem tentativas: mensagem "Tentativas esgotadas"

// Nota: verificar se já existe QuizPlayer component reutilizável.
// Se sim, importar e usar. Se não, implementar inline.
```

---

### 5.3 MODIFICAR `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx`

**O que fazer:** Integrar `LessonMaterials` e `LessonQuiz` no layout da página de lição.

**Imports novos:**
```typescript
import { LessonMaterials } from '@/components/training/lesson-materials'
import { LessonQuiz } from '@/components/training/lesson-quiz'
```

**Inserir no JSX** — entre o conteúdo (player/pdf/text) e o rating/navegação (por volta da linha 242):

```tsx
{/* Após o bloco de conteúdo condicional (video/pdf/text/link) */}

{/* Materiais de Apoio */}
<LessonMaterials lessonId={lessonId} />

{/* Quiz da Lição */}
<LessonQuiz
  lessonId={lessonId}
  courseId={id}
  onQuizPassed={() => {
    // Opcional: marcar lição como concluída automaticamente
    if (!localCompleted) handleMarkCompleted()
  }}
/>

{/* Rating + Navegação (já existente) */}
<LessonRating ... />
```

**Ordem visual final:**
1. Header (título + descrição)
2. Conteúdo (player/pdf/text/link)
3. **Materiais de Apoio** ← NOVO
4. **Quiz da Lição** ← NOVO
5. Rating + Navegação
6. Comentários

---

## Resumo de Ficheiros

| # | Acção | Path | O que fazer |
|---|-------|------|-------------|
| 1 | SQL | Supabase migration | Criar `temp_training_lesson_materials` + `lesson_id` em `temp_training_quizzes` + constraints + indexes |
| 2 | CRIAR | `lib/youtube.ts` | `extractYouTubeId()`, `parseISO8601Duration()`, `getYouTubeDuration()` server-side |
| 3 | CRIAR | `lib/r2/training.ts` | `uploadTrainingMaterial()`, `deleteTrainingMaterial()`, constantes de extensões e tamanho |
| 4 | CRIAR | `app/api/training/youtube-duration/route.ts` | GET handler — recebe URL, retorna `{ duration_seconds }` |
| 5 | MODIFICAR | `types/training.ts` | Adicionar `TrainingLessonMaterial` interface, `lesson_id` ao `TrainingQuiz`, `materials` e `quiz` ao `TrainingLesson` |
| 6 | MODIFICAR | `lib/validations/training.ts` | Adicionar `createLessonMaterialSchema`, adicionar `lesson_id` ao `createQuizSchema` |
| 7 | CRIAR | `app/api/training/lessons/[id]/materials/route.ts` | GET (listar) + POST (upload ficheiro / criar link) |
| 8 | CRIAR | `app/api/training/lessons/[id]/materials/[materialId]/route.ts` | DELETE (apagar material do R2 + DB) |
| 9 | MODIFICAR | `app/api/training/modules/[id]/lessons/route.ts` | Auto-detectar duração YouTube após criar aula |
| 10 | MODIFICAR | `app/api/training/lessons/[id]/route.ts` | Auto-detectar duração YouTube após editar aula |
| 11 | MODIFICAR | `app/api/training/quizzes/route.ts` | Adicionar GET handler com filtro `lesson_id` + suportar `lesson_id` no POST |
| 12 | MODIFICAR | `app/api/training/quizzes/[id]/attempt/route.ts` | Resolução de courseId via `lesson_id → module_id → course_id` |
| 13 | MODIFICAR | `components/training/course-builder.tsx` | Refactor dialog: `max-w-2xl`, Tabs (Conteúdo/Materiais/Quiz), auto-detectar duração YouTube com debounce |
| 14 | CRIAR | `components/training/lesson-material-upload.tsx` | Tab Materiais: upload ficheiros + links, listagem com ícones, delete |
| 15 | MODIFICAR | `components/training/quiz-builder.tsx` | Adicionar prop `lessonId`, buscar quiz existente por `lesson_id`, enviar `lesson_id` no save |
| 16 | CRIAR | `components/training/lesson-materials.tsx` | Cards de download na página de lição (ficheiros + links) |
| 17 | CRIAR | `components/training/lesson-quiz.tsx` | Quiz inline collapsible na página de lição (collapsed→start→playing→results) |
| 18 | MODIFICAR | `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx` | Integrar `LessonMaterials` + `LessonQuiz` entre conteúdo e rating |

---

## Variáveis de Ambiente

```env
# .env.local — adicionar:
YOUTUBE_API_KEY=AIza...
```

---

## Ordem de Implementação

```
FASE 1 (Infra):  1 → 2 → 3 → 4 → 5 → 6     (SQL, lib/youtube, lib/r2/training, API duration, types, validations)
FASE 2 (APIs):   7 → 8 → 9 → 10              (materials CRUD, auto-detect duration)
FASE 3 (Quiz):   11 → 12                      (quiz API lesson_id support)
FASE 4 (Dialog): 13 → 14 → 15                 (course-builder refactor, material upload, quiz-builder update)
FASE 5 (UI):     16 → 17 → 18                 (lesson-materials, lesson-quiz, page integration)
```

Cada fase é independente e testável antes de avançar para a seguinte.
