# PRD: Gestão de Formações — Analytics & Feedback

**Data**: 2026-03-19
**Git Commit**: `411cab56ad017010edb1a67602a0f548a47560a6`
**Branch**: `master`

## Pergunta de Pesquisa

Adicionar à estrutura de gestão de formações existente:
1. Visualização de reportes de bug (lesson reports)
2. Comentários das aulas e resposta a eles
3. Taxa de conclusão geral
4. Taxa de conclusão por utilizador
5. Quantidade de downloads do material e quem baixou

---

## Resumo

O módulo de formações já tem **a maioria da infraestrutura necessária implementada** no lado do aluno (rating, report, comments, progress tracking, materials). O que falta é **a interface de gestão/admin** para visualizar e gerir esses dados. Abaixo documenta-se tudo o que existe, o que falta, e os padrões externos recomendados.

---

## 1. Arquivos Relevantes da Base de Código

### 1.1 Estrutura de Tabelas Existentes (Supabase)

Todas as tabelas usam prefixo `temp_training_`:

| Tabela | Existe no DB? | Usada em API? | Descrição |
|--------|:---:|:---:|-----------|
| `temp_training_courses` | ✅ | ✅ | Cursos |
| `temp_training_modules` | ✅ | ✅ | Módulos do curso |
| `temp_training_lessons` | ✅ | ✅ | Lições |
| `temp_training_enrollments` | ✅ | ✅ | Inscrições (status, progress_percent) |
| `temp_training_lesson_progress` | ✅ | ✅ | Progresso por lição/utilizador |
| `temp_training_comments` | ✅ | ✅ | Comentários com `parent_id` (threaded) |
| `temp_training_lesson_ratings` | ⚠️ Verificar | ✅ | Avaliações 1-5 estrelas |
| `temp_training_lesson_reports` | ⚠️ Verificar | ✅ | Reports de problemas |
| `temp_training_lesson_materials` | ⚠️ Verificar | ✅ | Materiais de apoio (ficheiros/links) |
| `temp_training_quizzes` | ✅ | ✅ | Quizzes |
| `temp_training_quiz_attempts` | ✅ | ✅ | Tentativas de quiz |

### 1.2 Página de Gestão (onde adicionar os novos painéis)

**Ficheiro principal:** [app/dashboard/formacoes/gestao/page.tsx](app/dashboard/formacoes/gestao/page.tsx)
- Hero card com título "Gestão de Formações"
- Tabs por status: Todos, Rascunhos, Publicados, Arquivados
- Tabela com cursos + acções (editar, publicar, arquivar)
- **PAGE_SIZE = 20**, paginação offset-based
- Padrão de filtro: `useDebounce(search, 300)` + status tabs

**Ficheiro de edição:** [app/dashboard/formacoes/gestao/[id]/editar/page.tsx](app/dashboard/formacoes/gestao/%5Bid%5D/editar/page.tsx)
- 3 tabs: Detalhes, Conteúdo, Configuração
- Padrão pill toggle navigation

### 1.3 APIs Existentes (já implementadas no lado do aluno)

#### Reports — `app/api/training/lessons/[id]/report/route.ts`
```typescript
// POST — Submeter report
// Validation: reportLessonSchema
// Reasons: video_corrupted, audio_issues, wrong_content, file_corrupted, broken_link, other
// Duplicate check: max 1 open report per (user_id, lesson_id) → 409
// Fields: user_id, lesson_id, reason, comment, status='open'
```

#### Ratings — `app/api/training/lessons/[id]/rate/route.ts`
```typescript
// GET — { user_rating, average_rating, total_ratings }
// POST — { rating: 1-5 } → UPSERT on (user_id, lesson_id)
```

#### Comments — `app/api/training/courses/[id]/lessons/[lessonId]/comments/route.ts`
```typescript
// GET — Threaded comments (adjacency list com parent_id)
// POST — { content, parent_id? } → createCommentSchema
// Threading: top-level separados de replies, nested structure retornada
```

#### Materials — `app/api/training/lessons/[id]/materials/route.ts`
```typescript
// GET — Lista materiais ordered by order_index
// POST — FormData (file ou link), max 50MB
// DELETE — Remove de R2 + DB
```

#### Progress — `app/api/training/courses/[id]/lessons/[lessonId]/progress/route.ts`
```typescript
// PUT — Upsert progress (video_watched_seconds, video_watch_percent, time_spent_seconds)
// Auto-complete at 90% watch
// Recalcula enrollment progress_percent e status
// Verifica quizzes passados para marcar curso completo
```

### 1.4 Componentes Existentes (lado do aluno)

| Componente | Ficheiro | O que faz |
|-----------|----------|-----------|
| `LessonRating` | [components/training/lesson-rating.tsx](components/training/lesson-rating.tsx) | 5 estrelas + avg + count |
| `LessonReportDialog` | [components/training/lesson-report-dialog.tsx](components/training/lesson-report-dialog.tsx) | Dialog com RadioGroup de motivos |
| `LessonMaterials` | [components/training/lesson-materials.tsx](components/training/lesson-materials.tsx) | Lista materiais com download/abrir |
| `LessonMaterialUpload` | [components/training/lesson-material-upload.tsx](components/training/lesson-material-upload.tsx) | Upload ficheiro/link (admin) |
| `LessonSidebar` | [components/training/lesson-sidebar.tsx](components/training/lesson-sidebar.tsx) | Sidebar com progresso por módulo |

### 1.5 Types Existentes — `types/training.ts`

```typescript
// Já definidos:
export interface TrainingLessonRating {
  id: string; user_id: string; lesson_id: string;
  rating: number; // 1-5
  created_at: string; updated_at: string;
}

export type LessonReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed'

export interface TrainingLessonReport {
  id: string; user_id: string; lesson_id: string;
  reason: string; comment?: string | null;
  status: LessonReportStatus;
  resolved_by?: string | null; resolved_at?: string | null;
  resolution_note?: string | null;
  created_at: string; updated_at: string;
}

export interface TrainingLessonMaterial {
  id: string; lesson_id: string;
  material_type: 'file' | 'link';
  file_url?: string; file_name?: string; file_extension?: string;
  file_size_bytes?: number; file_mime_type?: string;
  link_url?: string; link_title?: string;
  description?: string; order_index: number;
  created_at: string; updated_at: string;
}

export interface TrainingLessonProgress {
  id: string; user_id: string; lesson_id: string; enrollment_id: string;
  status: LessonProgressStatus; // 'not_started' | 'in_progress' | 'completed'
  video_watched_seconds: number; video_watch_percent: number;
  started_at?: string; completed_at?: string; last_accessed_at?: string;
  time_spent_seconds: number;
}

export interface TrainingEnrollment {
  id: string; user_id: string; course_id: string;
  status: EnrollmentStatus; // 'enrolled' | 'in_progress' | 'completed' | 'failed' | 'expired'
  progress_percent: number;
  enrolled_at: string; started_at?: string; completed_at?: string;
  deadline?: string;
  // ... certificate fields
}

export interface TrainingComment {
  id: string; lesson_id: string; user_id: string;
  content: string; parent_id?: string | null;
  is_resolved?: boolean;
  created_at: string; updated_at: string;
  replies?: TrainingComment[];
  user?: { commercial_name: string; profile_photo_url?: string };
}

export interface TrainingOverviewStats {
  total_courses: number; published_courses: number;
  total_enrollments: number; active_enrollments: number;
  completed_enrollments: number; average_completion_rate: number;
  total_lessons: number; total_modules: number;
  total_certificates_issued: number;
  completion_by_month: { month: string; count: number }[];
}
```

### 1.6 Validações Existentes — `lib/validations/training.ts`

```typescript
// Já definidos:
export const rateLessonSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Avaliação deve ser entre 1 e 5'),
})

export const reportLessonSchema = z.object({
  reason: z.enum([
    'video_corrupted', 'audio_issues', 'wrong_content',
    'file_corrupted', 'broken_link', 'other',
  ], { required_error: 'Seleccione um motivo' }),
  comment: z.string().max(1000).optional(),
})

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  parent_id: z.string().uuid().optional(),
})
```

### 1.7 Hooks Existentes

| Hook | Ficheiro | Relevância |
|------|----------|-----------|
| `useTrainingCourses` | [hooks/use-training-courses.ts](hooks/use-training-courses.ts) | Listagem com filtros (search, status, category, etc.) |
| `useTrainingLesson` | [hooks/use-training-lesson.ts](hooks/use-training-lesson.ts) | `updateProgress`, `markCompleted`, `rateLesson`, `reportIssue` |

### 1.8 Padrão de Auth/Permissões

```typescript
// Para endpoints de gestão (admin/instrutor):
const auth = await requirePermission('training')
if (!auth.authorized) return auth.response

// Para endpoints de aluno:
const auth = await requireAuth()
if (!auth.authorized) return auth.response

// ADMIN_ROLES constante usada em comments/[id]/route.ts para delete
```

---

## 2. O que Precisa Ser Criado

### 2.1 FEATURE 1: Painel de Reports de Bug (Gestão)

**O que existe:** API POST para criar report + componente LessonReportDialog (aluno)
**O que falta:**
- API GET para listar todos os reports (admin) com filtros (status, curso, motivo)
- API PUT para actualizar status do report (in_review, resolved, dismissed)
- Página/tab de gestão com tabela de reports
- Componente de detalhe do report com acção de resolver/dispensar

**Tabela necessária (verificar se existe):**
```sql
-- temp_training_lesson_reports
-- Campos existentes no type: id, user_id, lesson_id, reason, comment, status,
--   resolved_by, resolved_at, resolution_note, created_at, updated_at
```

### 2.2 FEATURE 2: Painel de Comentários (Gestão)

**O que existe:** API GET/POST comments + threaded display (aluno)
**O que falta:**
- API GET para listar todos os comentários (admin) com filtros
- API PUT/PATCH para responder como admin (com badge de "instrutor")
- Interface de gestão para ver e responder a comentários de todas as lições
- Marcar comentário como resolvido (`is_resolved` já existe na tabela)

**Tabela existente:** `temp_training_comments` com campos: `id, lesson_id, user_id, content, parent_id, is_resolved, created_at, updated_at`

### 2.3 FEATURE 3: Taxa de Conclusão Geral

**O que existe:** `temp_training_enrollments.progress_percent` e `status` por utilizador/curso
**O que falta:**
- API GET para stats agregadas (conclusão geral de todos os cursos)
- View ou query SQL para agregar dados
- Cards de KPI na página de gestão

### 2.4 FEATURE 4: Taxa de Conclusão por Utilizador

**O que existe:** `temp_training_enrollments` + `temp_training_lesson_progress`
**O que falta:**
- API GET para listar utilizadores com progresso por curso
- Tabela com: nome, foto, cursos inscritos, % conclusão, último acesso
- Detalhe com breakdown por lição

### 2.5 FEATURE 5: Downloads de Material

**O que existe:** API GET/POST materials + componente LessonMaterials (download directo)
**O que falta:**
- Tabela `temp_training_material_downloads` (event log)
- API de tracking (registar cada download)
- API GET para listar downloads com filtros
- Painel com: total downloads, downloads por material, quem baixou

---

## 3. Padrões de Implementação Externos

### 3.1 Comments — Adjacency List (Padrão Recomendado)

O projecto **já usa** este padrão. A tabela `temp_training_comments` tem `parent_id` para replies.

**Padrão de threading no GET existente:**
```typescript
// app/api/training/courses/[id]/lessons/[lessonId]/comments/route.ts
// Separar top-level (parent_id = null) de replies
// Construir nested structure: [{ ...comment, replies: [...] }]
const topLevel = comments.filter(c => !c.parent_id)
const replies = comments.filter(c => c.parent_id)
const threaded = topLevel.map(c => ({
  ...c,
  replies: replies.filter(r => r.parent_id === c.id)
}))
```

**Para o admin responder** — usar o mesmo POST endpoint mas com indicador visual de "instrutor":
```typescript
// O user.role pode ser verificado no frontend para mostrar badge
// Ou adicionar campo `is_instructor_reply` na tabela
```

**Referência:** PostgreSQL recursive queries — https://www.postgresql.org/docs/current/queries-with.html

### 3.2 Bug Reports — Triage Workflow (Padrão Externo)

**Workflow recomendado:**
```
Aluno submete → status: 'open'
  ↓
Admin revê → status: 'in_review' + assigned_to
  ↓
├── Válido → status: 'resolved' + resolution_note + resolved_at
└── Inválido/duplicado → status: 'dismissed' + resolution_note
```

**API de gestão (a criar):**
```typescript
// GET /api/training/admin/reports
// Filtros: status, course_id, reason, date_range
// Paginação: page + limit
// Join com: lesson (titulo), course (titulo), user (nome)

// PUT /api/training/admin/reports/[id]
// Body: { status, resolution_note?, assigned_to? }
// Regra: apenas admin pode mudar status
```

### 3.3 Completion Tracking — Views PostgreSQL (Padrão Recomendado)

**View para taxa de conclusão geral:**
```sql
CREATE OR REPLACE VIEW training_course_completion_stats AS
SELECT
  c.id AS course_id,
  c.title,
  c.status,
  COUNT(DISTINCT e.user_id) AS total_enrolled,
  COUNT(DISTINCT e.user_id) FILTER (WHERE e.status = 'completed') AS total_completed,
  ROUND(
    (COUNT(DISTINCT e.user_id) FILTER (WHERE e.status = 'completed')::NUMERIC
    / NULLIF(COUNT(DISTINCT e.user_id), 0)) * 100, 1
  ) AS completion_rate,
  ROUND(AVG(e.progress_percent), 1) AS avg_progress
FROM temp_training_courses c
LEFT JOIN temp_training_enrollments e ON e.course_id = c.id
WHERE c.status = 'published'
GROUP BY c.id, c.title, c.status;
```

**View para taxa de conclusão por utilizador:**
```sql
CREATE OR REPLACE VIEW training_user_completion_stats AS
SELECT
  e.user_id,
  u.commercial_name,
  cp.profile_photo_url,
  COUNT(DISTINCT e.course_id) AS courses_enrolled,
  COUNT(DISTINCT e.course_id) FILTER (WHERE e.status = 'completed') AS courses_completed,
  ROUND(AVG(e.progress_percent), 1) AS avg_progress,
  MAX(lp.last_accessed_at) AS last_activity
FROM temp_training_enrollments e
JOIN dev_users u ON e.user_id = u.id
LEFT JOIN dev_consultant_profiles cp ON e.user_id = cp.user_id
LEFT JOIN temp_training_lesson_progress lp ON lp.enrollment_id = e.id
GROUP BY e.user_id, u.commercial_name, cp.profile_photo_url;
```

**Referência:** Supabase Views — https://supabase.com/docs/guides/database/tables#views
**Referência:** PostgreSQL Aggregates — https://www.postgresql.org/docs/current/functions-aggregate.html

### 3.4 Download Tracking — Event Log (Padrão Recomendado)

**Tabela de tracking (a criar):**
```sql
CREATE TABLE temp_training_material_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES temp_training_lesson_materials(id),
  material_name TEXT NOT NULL,  -- desnormalizado para queries rápidas
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES dev_users(id),
  file_size_bytes BIGINT,
  file_type TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_downloads_material ON temp_training_material_downloads(material_id);
CREATE INDEX idx_downloads_user ON temp_training_material_downloads(user_id);
CREATE INDEX idx_downloads_course ON temp_training_material_downloads(course_id);
CREATE INDEX idx_downloads_date ON temp_training_material_downloads(downloaded_at);
```

**Padrão de tracking (registar download na API):**
```typescript
// Modificar o componente LessonMaterials para chamar API de tracking antes do download
// Ou: criar endpoint GET /api/training/materials/[id]/download que:
//   1. Regista o evento (INSERT append-only)
//   2. Redireciona para file_url
```

**View de analytics:**
```sql
CREATE OR REPLACE VIEW training_material_download_stats AS
SELECT
  md.material_id,
  md.material_name,
  md.course_id,
  md.lesson_id,
  COUNT(*) AS total_downloads,
  COUNT(DISTINCT md.user_id) AS unique_users,
  MAX(md.downloaded_at) AS last_download
FROM temp_training_material_downloads md
GROUP BY md.material_id, md.material_name, md.course_id, md.lesson_id;
```

### 3.5 UI Analytics — shadcn/ui Charts (Recharts)

**Instalação:**
```bash
npx shadcn@latest add chart
```

**Componentes disponíveis:** `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`

**Padrão de stats cards (já usado no projecto):**
```tsx
// Padrão existente em components/training/training-stats-overview.tsx
<div className="grid gap-4 md:grid-cols-4">
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</div>
```

**Padrão de gráfico de barras:**
```tsx
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis } from "recharts"

const chartConfig = {
  completions: { label: "Conclusões", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

<ChartContainer config={chartConfig} className="h-[300px]">
  <BarChart data={monthlyData}>
    <XAxis dataKey="month" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="completions" fill="var(--chart-1)" radius={4} />
  </BarChart>
</ChartContainer>
```

**Referência:** shadcn/ui Charts — https://ui.shadcn.com/docs/components/chart
**Referência:** Recharts — https://recharts.org/en-US/

---

## 4. Padrões da Base de Código a Reutilizar

### 4.1 Padrão de Pill Toggle (para tabs na gestão)

```tsx
// Usado em: formacoes/page.tsx, gestao/page.tsx, editar/page.tsx
<div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-muted/40 border border-border/30">
  {tabs.map(tab => (
    <button
      key={tab.key}
      onClick={() => setActiveTab(tab.key)}
      className={cn(
        'inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-colors',
        isActive
          ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
          : 'bg-transparent text-muted-foreground hover:bg-muted/50'
      )}
    >
      <Icon className="h-4 w-4" />
      {tab.label}
    </button>
  ))}
</div>
```

### 4.2 Padrão de Hero Card

```tsx
<div className="relative overflow-hidden bg-neutral-900 rounded-xl">
  <div className="absolute inset-0 bg-gradient-to-r from-neutral-900/95 via-neutral-900/80 to-neutral-900/60" />
  <div className="relative z-10 px-8 py-10">
    <h2 className="text-2xl sm:text-3xl font-bold text-white">{title}</h2>
    <p className="text-neutral-400 mt-1.5 text-sm">{description}</p>
  </div>
</div>
```

### 4.3 Padrão de Status Badge

```typescript
// Status colours from gestao/page.tsx
const STATUS_BADGE: Record<string, string> = {
  published: 'bg-emerald-500/15 text-emerald-600',
  draft: 'bg-slate-500/15 text-slate-500',
  archived: 'bg-amber-500/15 text-amber-600',
}

// Report status (a criar):
const REPORT_STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-500/15 text-red-600',
  in_review: 'bg-amber-500/15 text-amber-600',
  resolved: 'bg-emerald-500/15 text-emerald-600',
  dismissed: 'bg-slate-500/15 text-slate-500',
}
```

### 4.4 Padrão de Tabela com Filtros (gestao/page.tsx)

```tsx
// Estrutura: Search input + Status tabs + Table + Pagination
// Search: <Input> com useDebounce(300ms)
// Status tabs: inline-flex pill toggle
// Table: shadcn <Table> com <TableHeader> + <TableBody>
// Acções: <DropdownMenu> com DropdownMenuTrigger={MoreHorizontal}
// Paginação: Previous/Next buttons com page state
```

### 4.5 Padrão de API Route Handler

```typescript
// app/api/training/courses/route.ts — padrão GET com filtros
export async function GET(request: Request) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase.from('temp_training_courses').select('*', { count: 'exact' })

  if (search) query = query.ilike('title', `%${search}%`)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count })
}
```

### 4.6 Padrão de Hook de Listagem

```typescript
// hooks/use-training-courses.ts — padrão com debounce + filtros
export function useTrainingCourses(params: Params) {
  const [courses, setCourses] = useState([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const debouncedSearch = useDebounce(params.search, 300)

  const fetchCourses = useCallback(async () => {
    setIsLoading(true)
    try {
      const searchParams = new URLSearchParams()
      if (debouncedSearch) searchParams.set('search', debouncedSearch)
      // ... other filters
      const res = await fetch(`/api/training/courses?${searchParams}`)
      const json = await res.json()
      setCourses(json.data)
      setTotal(json.total)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, /* other deps */])

  useEffect(() => { fetchCourses() }, [fetchCourses])
  return { courses, total, isLoading, refetch: fetchCourses }
}
```

---

## 5. Ficheiros que Vão Ser Afectados/Criados

### 5.1 APIs Novas (a criar)

| Ficheiro | Método | Descrição |
|----------|--------|-----------|
| `app/api/training/admin/reports/route.ts` | GET | Listar todos os reports com filtros |
| `app/api/training/admin/reports/[id]/route.ts` | PUT | Actualizar status do report |
| `app/api/training/admin/comments/route.ts` | GET | Listar todos os comentários com filtros |
| `app/api/training/admin/stats/route.ts` | GET | Stats agregadas (conclusão geral) |
| `app/api/training/admin/users/route.ts` | GET | Lista utilizadores com progresso |
| `app/api/training/admin/users/[id]/route.ts` | GET | Detalhe progresso de um utilizador |
| `app/api/training/admin/downloads/route.ts` | GET | Lista downloads com filtros |
| `app/api/training/materials/[id]/download/route.ts` | POST | Registar evento de download |

### 5.2 Componentes Novos (a criar)

| Ficheiro | Descrição |
|----------|-----------|
| `components/training/admin/reports-table.tsx` | Tabela de reports com filtros e acções |
| `components/training/admin/report-detail-dialog.tsx` | Dialog para ver/resolver report |
| `components/training/admin/comments-table.tsx` | Tabela de comentários com reply inline |
| `components/training/admin/completion-overview.tsx` | Cards KPI + gráfico de conclusão |
| `components/training/admin/user-progress-table.tsx` | Tabela de utilizadores com progresso |
| `components/training/admin/downloads-table.tsx` | Tabela de downloads com stats |
| `components/training/admin/stats-cards.tsx` | Cards de KPI reutilizáveis |

### 5.3 Hooks Novos (a criar)

| Ficheiro | Descrição |
|----------|-----------|
| `hooks/use-training-admin-reports.ts` | Listagem de reports com filtros |
| `hooks/use-training-admin-comments.ts` | Listagem de comentários com filtros |
| `hooks/use-training-admin-stats.ts` | Stats agregadas |
| `hooks/use-training-admin-downloads.ts` | Downloads com filtros |

### 5.4 Ficheiros Existentes a Modificar

| Ficheiro | Modificação |
|----------|-------------|
| `app/dashboard/formacoes/gestao/page.tsx` | Adicionar tabs/links para Reports, Comentários, Analytics, Downloads |
| `components/training/lesson-materials.tsx` | Chamar API de tracking ao clicar "Descarregar" |
| `types/training.ts` | Adicionar tipos para download tracking e stats de admin |
| `lib/validations/training.ts` | Adicionar schemas para update de report status |

### 5.5 Migrações SQL (a criar)

| Migração | Descrição |
|----------|-----------|
| `create_material_downloads_table` | Tabela `temp_training_material_downloads` |
| `create_completion_views` | Views `training_course_completion_stats` e `training_user_completion_stats` |
| `create_download_stats_view` | View `training_material_download_stats` |
| Verificar existência de `temp_training_lesson_reports` e `temp_training_lesson_ratings` | Se não existirem, criar |

---

## 6. Referências de Documentação

| Tema | URL |
|------|-----|
| Supabase Views | https://supabase.com/docs/guides/database/tables#views |
| Supabase RPC (funções SQL) | https://supabase.com/docs/reference/javascript/rpc |
| Supabase Realtime | https://supabase.com/docs/guides/realtime |
| PostgreSQL Recursive Queries | https://www.postgresql.org/docs/current/queries-with.html |
| PostgreSQL Aggregate Functions | https://www.postgresql.org/docs/current/functions-aggregate.html |
| shadcn/ui Charts (Recharts) | https://ui.shadcn.com/docs/components/chart |
| shadcn/ui Data Table | https://ui.shadcn.com/docs/components/data-table |
| TanStack Table | https://tanstack.com/table/latest |
| Recharts | https://recharts.org/en-US/ |

---

## 7. Decisões Arquitecturais Recomendadas

1. **Namespace `/admin/`** nas APIs — separar endpoints de gestão dos endpoints de aluno para clareza e permissões distintas.

2. **Views PostgreSQL** em vez de queries complexas no código — melhor performance e manutenibilidade. As views são consultáveis via `supabase.from('view_name')`.

3. **Event log append-only** para downloads — nunca UPDATE/DELETE, apenas INSERT. Garante auditoria completa.

4. **Tracking de download no componente** — modificar `LessonMaterials` para chamar API de tracking antes de abrir o link. Alternativa: criar endpoint de redirect.

5. **Mesma página de gestão** com mais tabs — adicionar os novos painéis como tabs na página `gestao/page.tsx` existente, mantendo o padrão pill toggle.

6. **shadcn/ui chart** para gráficos — já integrado com o design system, não precisa de configuração extra. Instalar com `npx shadcn@latest add chart`.
