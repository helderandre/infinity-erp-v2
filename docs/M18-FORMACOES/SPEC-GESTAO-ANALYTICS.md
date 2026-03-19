# SPEC: Gestão de Formações — Analytics & Feedback

**Data**: 2026-03-19
**PRD**: [PRD-GESTAO-ANALYTICS.md](PRD-GESTAO-ANALYTICS.md)
**Branch**: `master`

---

## Resumo

Adicionar 5 painéis de gestão/admin ao módulo de formações:
1. **Reports de bug** — visualizar, filtrar e resolver lesson reports
2. **Comentários** — visualizar, responder e resolver comentários de todas as lições
3. **Taxa de conclusão geral** — KPIs + gráfico por curso
4. **Taxa de conclusão por utilizador** — tabela com progresso individual
5. **Downloads de material** — tracking de eventos + painel de analytics

A infraestrutura do aluno (tabelas, APIs, componentes) já existe. Este spec cobre **apenas o lado admin/gestão**.

---

## Arquitectura Geral

### Namespace de APIs

Todas as novas APIs admin ficam em `app/api/training/admin/`. Usam `requirePermission('training')` para autorização.

### Navegação

A página `gestao/page.tsx` ganha novas tabs no pill toggle. O conteúdo de cada tab é um componente separado em `components/training/admin/`.

### DB

- Tabelas `temp_training_lesson_reports`, `temp_training_lesson_ratings`, `temp_training_comments` já existem.
- Tabela `temp_training_material_downloads` precisa ser criada.
- Views SQL para aggregações de conclusão e downloads.

---

## FASE 1: Migração SQL + Types + Validações

### 1.1 `supabase/migrations/ — create_material_downloads_table`

**Acção**: Criar migração via Supabase MCP (`apply_migration`)

```sql
-- Tabela de tracking de downloads (append-only)
CREATE TABLE temp_training_material_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES temp_training_lesson_materials(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  lesson_id UUID NOT NULL,
  course_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES dev_users(id),
  file_size_bytes BIGINT,
  file_type TEXT,
  downloaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_material_downloads_material ON temp_training_material_downloads(material_id);
CREATE INDEX idx_material_downloads_user ON temp_training_material_downloads(user_id);
CREATE INDEX idx_material_downloads_course ON temp_training_material_downloads(course_id);
CREATE INDEX idx_material_downloads_date ON temp_training_material_downloads(downloaded_at);

-- RLS
ALTER TABLE temp_training_material_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert downloads"
  ON temp_training_material_downloads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Training admins can read all downloads"
  ON temp_training_material_downloads FOR SELECT
  TO authenticated
  USING (true);
```

### 1.2 `supabase/migrations/ — create_analytics_views`

**Acção**: Criar migração via Supabase MCP

```sql
-- View: taxa de conclusão por curso
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

-- View: taxa de conclusão por utilizador
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

-- View: stats de downloads de material
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

### 1.3 `types/training.ts`

**Acção**: Adicionar os seguintes tipos ao final do ficheiro

```typescript
// === ADMIN ANALYTICS TYPES ===

export interface AdminReportWithDetails extends TrainingLessonReport {
  user?: { commercial_name: string; profile_photo_url?: string }
  lesson?: { title: string }
  course?: { id: string; title: string }
}

export interface AdminCommentWithDetails extends TrainingComment {
  lesson?: { title: string }
  course?: { id: string; title: string }
}

export interface CourseCompletionStats {
  course_id: string
  title: string
  status: string
  total_enrolled: number
  total_completed: number
  completion_rate: number
  avg_progress: number
}

export interface UserCompletionStats {
  user_id: string
  commercial_name: string
  profile_photo_url?: string
  courses_enrolled: number
  courses_completed: number
  avg_progress: number
  last_activity?: string
}

export interface UserCourseDetail {
  enrollment_id: string
  course_id: string
  course_title: string
  status: string
  progress_percent: number
  enrolled_at: string
  completed_at?: string
  lessons: {
    lesson_id: string
    title: string
    status: string
    completed_at?: string
    time_spent_seconds: number
  }[]
}

export interface MaterialDownloadStats {
  material_id: string
  material_name: string
  course_id: string
  lesson_id: string
  total_downloads: number
  unique_users: number
  last_download?: string
}

export interface MaterialDownloadEvent {
  id: string
  material_id: string
  material_name: string
  lesson_id: string
  course_id: string
  user_id: string
  file_size_bytes?: number
  file_type?: string
  downloaded_at: string
  user?: { commercial_name: string; profile_photo_url?: string }
}

export interface AdminOverviewStats {
  total_reports_open: number
  total_comments_unresolved: number
  avg_completion_rate: number
  total_downloads: number
}
```

### 1.4 `lib/validations/training.ts`

**Acção**: Adicionar schemas ao final do ficheiro

```typescript
// === ADMIN SCHEMAS ===

export const updateReportStatusSchema = z.object({
  status: z.enum(['in_review', 'resolved', 'dismissed']),
  resolution_note: z.string().max(1000).optional(),
})

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>
```

---

## FASE 2: APIs Admin

### 2.1 `app/api/training/admin/reports/route.ts` — CRIAR

**Método**: GET
**Auth**: `requirePermission('training')`

**Query params**: `page`, `limit`, `status` (open|in_review|resolved|dismissed), `course_id`, `reason`, `search`

**Implementação**:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status') || ''
  const courseId = searchParams.get('course_id') || ''
  const reason = searchParams.get('reason') || ''
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('temp_training_lesson_reports' as any)
    .select(`
      *,
      user:dev_users!user_id(commercial_name, id),
      lesson:temp_training_lessons!lesson_id(
        title,
        module:temp_training_modules!module_id(
          course:temp_training_courses!course_id(id, title)
        )
      )
    `, { count: 'exact' })

  if (status) query = query.eq('status', status)
  if (reason) query = query.eq('reason', reason)
  // courseId filter: usar inner join no lesson → module → course
  // Se courseId fornecido, filtrar no lado do JS após query (ou usar RPC)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten nested structure para facilitar no frontend
  const reports = (data || []).map((r: any) => ({
    ...r,
    lesson_title: r.lesson?.title,
    course_id: r.lesson?.module?.course?.id,
    course_title: r.lesson?.module?.course?.title,
    user_name: r.user?.commercial_name,
  }))

  // Filtrar por course_id se fornecido (post-query)
  const filtered = courseId
    ? reports.filter((r: any) => r.course_id === courseId)
    : reports

  return NextResponse.json({ data: filtered, total: courseId ? filtered.length : count })
}
```

### 2.2 `app/api/training/admin/reports/[id]/route.ts` — CRIAR

**Método**: PUT
**Auth**: `requirePermission('training')`

**Body**: `{ status, resolution_note? }` — validado com `updateReportStatusSchema`

**Implementação**:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { updateReportStatusSchema } from '@/lib/validations/training'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const { id } = await params
  const body = await request.json()
  const validation = updateReportStatusSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = createClient()
  const updateData: any = {
    status: validation.data.status,
    updated_at: new Date().toISOString(),
  }

  if (validation.data.status === 'resolved' || validation.data.status === 'dismissed') {
    updateData.resolved_by = auth.user.id
    updateData.resolved_at = new Date().toISOString()
    if (validation.data.resolution_note) {
      updateData.resolution_note = validation.data.resolution_note
    }
  }

  const { data, error } = await supabase
    .from('temp_training_lesson_reports' as any)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
```

### 2.3 `app/api/training/admin/comments/route.ts` — CRIAR

**Método**: GET
**Auth**: `requirePermission('training')`

**Query params**: `page`, `limit`, `course_id`, `is_resolved` (true|false), `search`

**Implementação**:
```typescript
export async function GET(request: Request) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const isResolved = searchParams.get('is_resolved')
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('temp_training_comments')
    .select(`
      *,
      user:dev_users!user_id(commercial_name, profile_photo_url:dev_consultant_profiles(profile_photo_url)),
      lesson:temp_training_lessons!lesson_id(
        title,
        module:temp_training_modules!module_id(
          course:temp_training_courses!course_id(id, title)
        )
      ),
      replies:temp_training_comments!parent_id(
        id, content, created_at,
        user:dev_users!user_id(commercial_name)
      )
    `, { count: 'exact' })
    .is('parent_id', null) // Apenas top-level comments

  if (isResolved === 'true') query = query.eq('is_resolved', true)
  if (isResolved === 'false') query = query.eq('is_resolved', false)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten
  const comments = (data || []).map((c: any) => ({
    ...c,
    lesson_title: c.lesson?.title,
    course_id: c.lesson?.module?.course?.id,
    course_title: c.lesson?.module?.course?.title,
    user_name: c.user?.commercial_name,
  }))

  return NextResponse.json({ data: comments, total: count })
}
```

> **Nota**: Para responder a um comentário como admin, usar o POST existente em `/api/training/courses/[id]/lessons/[lessonId]/comments` com `parent_id`. O frontend mostra badge de "Instrutor" baseado no role do user.

### 2.4 `app/api/training/admin/stats/route.ts` — CRIAR

**Método**: GET
**Auth**: `requirePermission('training')`

**Retorna**: Stats agregadas de conclusão + overview

```typescript
export async function GET(request: Request) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const supabase = createClient()

  // 1. Course completion stats (da view)
  const { data: courseStats } = await supabase
    .from('training_course_completion_stats' as any)
    .select('*')
    .order('total_enrolled', { ascending: false })

  // 2. Overview KPIs
  const { count: openReports } = await supabase
    .from('temp_training_lesson_reports' as any)
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open')

  const { count: unresolvedComments } = await supabase
    .from('temp_training_comments')
    .select('id', { count: 'exact', head: true })
    .eq('is_resolved', false)
    .is('parent_id', null)

  const { count: totalDownloads } = await supabase
    .from('temp_training_material_downloads' as any)
    .select('id', { count: 'exact', head: true })

  // 3. Completion by month (últimos 6 meses)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const { data: recentCompletions } = await supabase
    .from('temp_training_enrollments')
    .select('completed_at')
    .eq('status', 'completed')
    .gte('completed_at', sixMonthsAgo.toISOString())

  // Agrupar por mês no JS
  const completionByMonth = groupByMonth(recentCompletions || [])

  // 4. Avg completion rate
  const avgRate = courseStats?.length
    ? courseStats.reduce((sum: number, c: any) => sum + (c.completion_rate || 0), 0) / courseStats.length
    : 0

  return NextResponse.json({
    course_stats: courseStats || [],
    overview: {
      total_reports_open: openReports || 0,
      total_comments_unresolved: unresolvedComments || 0,
      avg_completion_rate: Math.round(avgRate * 10) / 10,
      total_downloads: totalDownloads || 0,
    },
    completion_by_month: completionByMonth,
  })
}

function groupByMonth(completions: { completed_at: string }[]) {
  const months: Record<string, number> = {}
  for (const c of completions) {
    const month = c.completed_at.slice(0, 7) // YYYY-MM
    months[month] = (months[month] || 0) + 1
  }
  return Object.entries(months)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
```

### 2.5 `app/api/training/admin/users/route.ts` — CRIAR

**Método**: GET
**Auth**: `requirePermission('training')`

**Query params**: `page`, `limit`, `search`, `course_id`

```typescript
export async function GET(request: Request) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('training_user_completion_stats' as any)
    .select('*', { count: 'exact' })

  if (search) query = query.ilike('commercial_name', `%${search}%`)

  const { data, error, count } = await query
    .order('last_activity', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count })
}
```

### 2.6 `app/api/training/admin/users/[id]/route.ts` — CRIAR

**Método**: GET
**Auth**: `requirePermission('training')`

**Retorna**: Detalhe de progresso de um utilizador — enrollments com lesson-level breakdown.

```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const { id: userId } = await params
  const supabase = createClient()

  // Enrollments do user
  const { data: enrollments } = await supabase
    .from('temp_training_enrollments')
    .select(`
      id,
      course_id,
      status,
      progress_percent,
      enrolled_at,
      completed_at,
      course:temp_training_courses!course_id(title)
    `)
    .eq('user_id', userId)
    .order('enrolled_at', { ascending: false })

  // Lesson progress do user
  const { data: lessonProgress } = await supabase
    .from('temp_training_lesson_progress')
    .select(`
      lesson_id,
      enrollment_id,
      status,
      completed_at,
      time_spent_seconds,
      lesson:temp_training_lessons!lesson_id(title)
    `)
    .eq('user_id', userId)

  // User info
  const { data: user } = await supabase
    .from('dev_users')
    .select('commercial_name, professional_email')
    .eq('id', userId)
    .single()

  // Merge lesson progress into enrollments
  const result = (enrollments || []).map((e: any) => ({
    enrollment_id: e.id,
    course_id: e.course_id,
    course_title: e.course?.title,
    status: e.status,
    progress_percent: e.progress_percent,
    enrolled_at: e.enrolled_at,
    completed_at: e.completed_at,
    lessons: (lessonProgress || [])
      .filter((lp: any) => lp.enrollment_id === e.id)
      .map((lp: any) => ({
        lesson_id: lp.lesson_id,
        title: lp.lesson?.title,
        status: lp.status,
        completed_at: lp.completed_at,
        time_spent_seconds: lp.time_spent_seconds,
      })),
  }))

  return NextResponse.json({ user, courses: result })
}
```

### 2.7 `app/api/training/admin/downloads/route.ts` — CRIAR

**Método**: GET
**Auth**: `requirePermission('training')`

**Query params**: `page`, `limit`, `course_id`, `material_id`, `view` (events|stats)

```typescript
export async function GET(request: Request) {
  const auth = await requirePermission('training')
  if (!auth.authorized) return auth.response

  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const view = searchParams.get('view') || 'stats'
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const courseId = searchParams.get('course_id') || ''
  const from = (page - 1) * limit
  const to = from + limit - 1

  if (view === 'stats') {
    // Aggregated stats da view
    let query = supabase
      .from('training_material_download_stats' as any)
      .select('*', { count: 'exact' })

    if (courseId) query = query.eq('course_id', courseId)

    const { data, error, count } = await query
      .order('total_downloads', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, total: count })
  }

  // view === 'events' — lista de eventos individuais
  let query = supabase
    .from('temp_training_material_downloads' as any)
    .select(`
      *,
      user:dev_users!user_id(commercial_name)
    `, { count: 'exact' })

  if (courseId) query = query.eq('course_id', courseId)

  const { data, error, count } = await query
    .order('downloaded_at', { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: count })
}
```

### 2.8 `app/api/training/materials/[id]/download/route.ts` — CRIAR

**Método**: POST
**Auth**: `requireAuth()`

**Body**: `{ course_id }` (para desnormalizar na tabela)

Registar evento de download. Chamado pelo componente `LessonMaterials` antes de abrir o link.

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { id: materialId } = await params
  const body = await request.json()
  const supabase = createClient()

  // Buscar info do material
  const { data: material } = await supabase
    .from('temp_training_lesson_materials')
    .select('id, lesson_id, file_name, link_title, file_size_bytes, file_mime_type, material_type')
    .eq('id', materialId)
    .single()

  if (!material) {
    return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
  }

  const materialName = material.file_name || material.link_title || 'Material sem nome'

  // Insert event (append-only, fire-and-forget — não bloquear o download)
  await supabase
    .from('temp_training_material_downloads' as any)
    .insert({
      material_id: materialId,
      material_name: materialName,
      lesson_id: material.lesson_id,
      course_id: body.course_id,
      user_id: auth.user.id,
      file_size_bytes: material.file_size_bytes || null,
      file_type: material.file_mime_type || material.material_type,
    })

  return NextResponse.json({ tracked: true })
}
```

---

## FASE 3: Hooks Admin

### 3.1 `hooks/use-training-admin-reports.ts` — CRIAR

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import type { AdminReportWithDetails } from '@/types/training'

interface UseAdminReportsParams {
  status?: string
  courseId?: string
  reason?: string
  page?: number
  limit?: number
}

export function useTrainingAdminReports(params: UseAdminReportsParams = {}) {
  const [reports, setReports] = useState<AdminReportWithDetails[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    try {
      const sp = new URLSearchParams()
      if (params.status) sp.set('status', params.status)
      if (params.courseId) sp.set('course_id', params.courseId)
      if (params.reason) sp.set('reason', params.reason)
      sp.set('page', String(params.page || 1))
      sp.set('limit', String(params.limit || 20))

      const res = await fetch(`/api/training/admin/reports?${sp}`)
      const json = await res.json()
      setReports(json.data || [])
      setTotal(json.total || 0)
    } finally {
      setIsLoading(false)
    }
  }, [params.status, params.courseId, params.reason, params.page, params.limit])

  useEffect(() => { fetchReports() }, [fetchReports])

  const updateStatus = useCallback(async (
    reportId: string,
    status: string,
    resolutionNote?: string
  ) => {
    const res = await fetch(`/api/training/admin/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolution_note: resolutionNote }),
    })
    if (!res.ok) throw new Error('Erro ao actualizar report')
    await fetchReports()
  }, [fetchReports])

  return { reports, total, isLoading, refetch: fetchReports, updateStatus }
}
```

### 3.2 `hooks/use-training-admin-comments.ts` — CRIAR

Mesmo padrão do hook de reports. Params: `isResolved`, `courseId`, `page`, `limit`.

Expõe: `comments`, `total`, `isLoading`, `refetch`, `replyToComment(commentId, content, courseId, lessonId)`, `toggleResolved(commentId)`.

- `replyToComment`: POST para `/api/training/courses/{courseId}/lessons/{lessonId}/comments` com `parent_id`
- `toggleResolved`: PUT para `/api/training/comments/{commentId}/resolve`

### 3.3 `hooks/use-training-admin-stats.ts` — CRIAR

Fetch simples de `/api/training/admin/stats`. Expõe: `courseStats`, `overview`, `completionByMonth`, `isLoading`, `refetch`.

### 3.4 `hooks/use-training-admin-downloads.ts` — CRIAR

Mesmo padrão. Params: `courseId`, `view` (stats|events), `page`, `limit`.

Expõe: `data`, `total`, `isLoading`, `refetch`.

---

## FASE 4: Componentes Admin

### 4.1 `components/training/admin/reports-table.tsx` — CRIAR

**Descrição**: Tabela de reports com filtros inline e acções por linha.

**Props**: nenhuma (auto-contido, usa hook `useTrainingAdminReports`)

**Estado interno**: `statusFilter`, `reasonFilter`, `page`, `selectedReport` (para dialog detalhe)

**UI**:
- Filtros inline: Select de status (Todos, Aberto, Em Revisão, Resolvido, Dispensado) + Select de motivo (6 opções)
- Tabela `<Table>` com colunas: Aula, Curso, Motivo, Estado, Utilizador, Data, Acções
- Badge de status com cores:
  ```typescript
  const REPORT_STATUS_BADGE: Record<string, string> = {
    open: 'bg-red-500/15 text-red-600',
    in_review: 'bg-amber-500/15 text-amber-600',
    resolved: 'bg-emerald-500/15 text-emerald-600',
    dismissed: 'bg-slate-500/15 text-slate-500',
  }
  ```
- Labels de motivo PT-PT:
  ```typescript
  const REASON_LABELS: Record<string, string> = {
    video_corrupted: 'Vídeo corrompido',
    audio_issues: 'Problemas de áudio',
    wrong_content: 'Conteúdo errado',
    file_corrupted: 'Ficheiro corrompido',
    broken_link: 'Link partido',
    other: 'Outro',
  }
  ```
- Acções (DropdownMenu): "Marcar em revisão", "Resolver", "Dispensar" — cada uma abre dialog com textarea opcional para `resolution_note`
- Paginação: mesmo padrão de gestao/page.tsx (Previous/Next + indicator)
- Empty state: "Nenhum report encontrado"

### 4.2 `components/training/admin/report-detail-dialog.tsx` — CRIAR

**Props**: `report: AdminReportWithDetails | null`, `open: boolean`, `onOpenChange`, `onUpdateStatus`

**UI**:
- Dialog com header (motivo badge + data)
- Info: Utilizador, Aula, Curso, Comentário do utilizador
- Status actual com badge
- Se status != resolved/dismissed: botões "Marcar em Revisão", "Resolver", "Dispensar"
- Textarea para `resolution_note` (aparece quando clica resolver/dispensar)
- Botão confirmar com Loader2 durante submit

### 4.3 `components/training/admin/comments-table.tsx` — CRIAR

**Props**: nenhuma (auto-contido)

**Estado**: `resolvedFilter` (all|resolved|unresolved), `page`, `replyingTo` (commentId)

**UI**:
- Filtro: toggle pill (Todos, Não Resolvidos, Resolvidos)
- Lista estilo card (não tabela pura) — cada comentário mostra:
  - Avatar + nome do utilizador + data
  - Aula + Curso (em badge/texto muted)
  - Conteúdo do comentário
  - Replies expandíveis (collapsible)
  - Acções: "Responder", "Marcar como resolvido" / "Reabrir"
- Inline reply form: textarea + botão "Enviar resposta" (usa API de comments existente com `parent_id`)
- Badge "Instrutor" nas replies de utilizadores com ADMIN_ROLES
- Paginação

### 4.4 `components/training/admin/completion-overview.tsx` — CRIAR

**Props**: nenhuma (auto-contido, usa `useTrainingAdminStats`)

**UI**:
- 4 KPI Cards (grid md:grid-cols-4, padrão de `training-stats-overview.tsx`):
  1. Reports Abertos (AlertTriangle icon, red)
  2. Comentários Pendentes (MessageSquare icon, amber)
  3. Taxa de Conclusão Média (TrendingUp icon, emerald)
  4. Total Downloads (Download icon, blue)
- Gráfico de barras: "Conclusões por Mês" (últimos 6 meses)
  - Usar `ChartContainer` + `BarChart` do recharts/shadcn
  - Instalar chart: `npx shadcn@latest add chart` (se não existir)
- Tabela: "Conclusão por Curso"
  - Colunas: Curso, Inscritos, Concluídos, Taxa (%), Progresso Médio (%)
  - Ordenada por total_enrolled desc
  - Progress bar visual na coluna Taxa

### 4.5 `components/training/admin/user-progress-table.tsx` — CRIAR

**Props**: nenhuma (auto-contido, usa `useTrainingAdminStats` para users ou hook dedicado)

**Estado**: `search`, `page`, `selectedUserId` (para sheet/dialog de detalhe)

**UI**:
- Search input (debounced)
- Tabela com colunas:
  - Avatar + Nome
  - Cursos Inscritos
  - Cursos Concluídos
  - Progresso Médio (%) — com progress bar visual
  - Última Actividade (formatDate)
  - Acção: "Ver detalhe"
- Sheet lateral (ou Dialog) para detalhe do utilizador:
  - Lista de cursos com status + progress_percent
  - Breakdown por lição (expandível)
  - Tempo total gasto
- Paginação
- Empty state: "Nenhum utilizador inscrito"

### 4.6 `components/training/admin/downloads-table.tsx` — CRIAR

**Props**: nenhuma (auto-contido)

**Estado**: `viewMode` (stats|events), `courseFilter`, `page`

**UI**:
- Toggle pill: "Por Material" (stats) | "Eventos" (individual downloads)
- **Vista Stats**:
  - Tabela: Material, Curso, Downloads Totais, Utilizadores Únicos, Último Download
  - Ordenada por total_downloads desc
- **Vista Eventos**:
  - Tabela: Material, Utilizador, Curso, Tamanho, Data
  - Ordenada por downloaded_at desc
- Paginação
- Empty state: "Nenhum download registado"

---

## FASE 5: Página de Gestão (Integração)

### 5.1 `app/dashboard/formacoes/gestao/page.tsx` — MODIFICAR

**O que modificar**:

1. **Adicionar tabs ao STATUS_TABS** (renomear para MAIN_TABS ou manter separação):

```typescript
// Adicionar novo nível de navegação no topo — ACIMA das tabs de status
const GESTAO_TABS = [
  { key: 'cursos', label: 'Cursos', icon: BookOpen },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: AlertTriangle },
  { key: 'comentarios', label: 'Comentários', icon: MessageSquare },
  { key: 'downloads', label: 'Downloads', icon: Download },
  { key: 'utilizadores', label: 'Utilizadores', icon: Users },
] as const
```

2. **Adicionar estado de tab principal**:
```typescript
const [mainTab, setMainTab] = useState<string>('cursos')
```

3. **Renderizar pill toggle PRINCIPAL** logo abaixo do Hero card (usando o padrão pill toggle existente).

4. **Condicionar conteúdo**:
```tsx
{mainTab === 'cursos' && (
  // Conteúdo actual: status tabs + search + tabela de cursos
)}
{mainTab === 'analytics' && <CompletionOverview />}
{mainTab === 'reports' && <ReportsTable />}
{mainTab === 'comentarios' && <CommentsTable />}
{mainTab === 'downloads' && <DownloadsTable />}
{mainTab === 'utilizadores' && <UserProgressTable />}
```

5. **Imports novos**:
```typescript
import { BarChart3, AlertTriangle, MessageSquare, Download, Users } from 'lucide-react'
import { ReportsTable } from '@/components/training/admin/reports-table'
import { CommentsTable } from '@/components/training/admin/comments-table'
import { CompletionOverview } from '@/components/training/admin/completion-overview'
import { UserProgressTable } from '@/components/training/admin/user-progress-table'
import { DownloadsTable } from '@/components/training/admin/downloads-table'
```

### 5.2 `components/training/lesson-materials.tsx` — MODIFICAR

**O que modificar**: Adicionar tracking de download ao clicar "Descarregar" ou "Abrir".

**Antes** (actual):
```tsx
<a href={material.file_url} target="_blank">
  <Download /> Descarregar
</a>
```

**Depois**:
```tsx
// Adicionar prop courseId ao componente
interface LessonMaterialsProps {
  lessonId: string
  courseId: string  // ← NOVO
}

// Handler de download com tracking
const handleDownload = async (material: TrainingLessonMaterial) => {
  // Fire-and-forget tracking
  fetch(`/api/training/materials/${material.id}/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_id: courseId }),
  }).catch(() => {}) // Silenciar erros de tracking — não impedir download

  // Abrir link normalmente
  const url = material.material_type === 'file' ? material.file_url : material.link_url
  window.open(url!, '_blank')
}

// Substituir <a> por <Button onClick={handleDownload}>
```

**Ficheiros que passam courseId ao LessonMaterials** (verificar e actualizar):
- `app/dashboard/formacoes/cursos/[id]/licoes/[lessonId]/page.tsx` — adicionar prop `courseId={params.id}`

---

## FASE 6: Instalar shadcn chart (se necessário)

### 6.1 Verificar e instalar

```bash
npx shadcn@latest add chart
```

Isto adiciona `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend` e a dependência `recharts`.

---

## Ficheiros — Resumo Completo

### Ficheiros a CRIAR (16)

| # | Path | Descrição |
|---|------|-----------|
| 1 | `app/api/training/admin/reports/route.ts` | GET reports com filtros |
| 2 | `app/api/training/admin/reports/[id]/route.ts` | PUT status do report |
| 3 | `app/api/training/admin/comments/route.ts` | GET comments com filtros |
| 4 | `app/api/training/admin/stats/route.ts` | GET stats agregadas |
| 5 | `app/api/training/admin/users/route.ts` | GET users com progresso |
| 6 | `app/api/training/admin/users/[id]/route.ts` | GET detalhe user |
| 7 | `app/api/training/admin/downloads/route.ts` | GET downloads stats/events |
| 8 | `app/api/training/materials/[id]/download/route.ts` | POST tracking download |
| 9 | `components/training/admin/reports-table.tsx` | Tabela reports + filtros |
| 10 | `components/training/admin/report-detail-dialog.tsx` | Dialog detalhe report |
| 11 | `components/training/admin/comments-table.tsx` | Lista comentários + reply |
| 12 | `components/training/admin/completion-overview.tsx` | KPIs + gráfico conclusão |
| 13 | `components/training/admin/user-progress-table.tsx` | Tabela users + detalhe |
| 14 | `components/training/admin/downloads-table.tsx` | Tabela downloads |
| 15 | `hooks/use-training-admin-reports.ts` | Hook reports admin |
| 16 | `hooks/use-training-admin-comments.ts` | Hook comments admin |
| 17 | `hooks/use-training-admin-stats.ts` | Hook stats admin |
| 18 | `hooks/use-training-admin-downloads.ts` | Hook downloads admin |

### Ficheiros a MODIFICAR (4)

| # | Path | Modificação |
|---|------|-------------|
| 1 | `app/dashboard/formacoes/gestao/page.tsx` | Adicionar tabs principais + import componentes admin |
| 2 | `components/training/lesson-materials.tsx` | Adicionar tracking de download + prop courseId |
| 3 | `types/training.ts` | Adicionar tipos admin (AdminReportWithDetails, etc.) |
| 4 | `lib/validations/training.ts` | Adicionar updateReportStatusSchema |

### Migrações SQL (2)

| # | Nome | Descrição |
|---|------|-----------|
| 1 | `create_material_downloads_table` | Tabela + indexes + RLS |
| 2 | `create_analytics_views` | 3 views de aggregação |

### Dependências

| Pacote | Acção |
|--------|-------|
| `recharts` | Instalar via `npx shadcn@latest add chart` (se não existir) |

---

## Ordem de Implementação Recomendada

```
FASE 1 → Migrações SQL + Types + Validações
  ↓
FASE 2 → APIs Admin (podem ser testadas com curl/Postman)
  ↓
FASE 3 → Hooks (dependem das APIs)
  ↓
FASE 4 → Componentes Admin (dependem dos hooks)
  ↓
FASE 5 → Integração na página de gestão
  ↓
FASE 6 → shadcn chart (se necessário para FASE 4.4)
```

Dentro de cada fase, os items são independentes e podem ser implementados em paralelo.

---

## Verificação Manual

Após implementação completa, verificar:

- [ ] Tab "Cursos" mantém comportamento actual (zero regressão)
- [ ] Tab "Analytics" mostra KPIs e gráfico com dados reais
- [ ] Tab "Reports" lista reports, filtros funcionam, resolver/dispensar actualiza status
- [ ] Tab "Comentários" lista comments, reply inline funciona, toggle resolved funciona
- [ ] Tab "Downloads" mostra stats e eventos
- [ ] Tab "Utilizadores" lista users com progresso, detalhe mostra breakdown
- [ ] Download de material em `/formacoes/cursos/[id]/licoes/[lessonId]` regista evento
- [ ] Paginação funciona em todas as tabelas
- [ ] Empty states aparecem quando não há dados
- [ ] Loading skeletons aparecem durante fetch
