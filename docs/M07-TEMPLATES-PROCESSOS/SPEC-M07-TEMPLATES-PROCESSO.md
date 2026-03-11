# SPEC — M07: Templates de Processo — Implementacao Detalhada

**Data:** 2026-02-20
**Modulo:** M07 — Templates de Processo
**PRD de Referencia:** [PRD-M07-TEMPLATES-PROCESSO.md](PRD-M07-TEMPLATES-PROCESSO.md)

---

## 1. Visao Geral

Implementar CRUD completo de templates de processos documentais, com builder visual tipo Kanban horizontal (drag-and-drop de fases e tarefas). Este documento detalha **exactamente** quais ficheiros criar, quais modificar, e o que colocar em cada um deles.

**O que NAO faz parte deste modulo:** Execucao de processos (instanciar templates) — isso pertence ao M06.

---

## 2. Dependencias a Instalar

```bash
# DnD Kit — arrastar e largar
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Componentes shadcn opcionais
npx shadcn@latest add switch
npx shadcn@latest add scroll-area
```

---

## 3. Mapa Completo de Ficheiros

### 3.1 Ficheiros a MODIFICAR

| # | Ficheiro | O que Modificar |
|---|----------|-----------------|
| 1 | `app/api/templates/route.ts` | Adicionar handler `POST` (criar template completo) |
| 2 | `components/layout/app-sidebar.tsx` | NAO modificar — acesso via botao na pagina de Processos |
| 3 | `app/dashboard/processos/page.tsx` | Adicionar botao "Gerir Templates" no header |
| 4 | `lib/validations/template.ts` | Relaxar validacao de config para MVP (EMAIL/GENERATE_DOC opcionais) |

### 3.2 Ficheiros a CRIAR

| # | Ficheiro | Funcao |
|---|----------|--------|
| 5 | `app/api/templates/[id]/route.ts` | GET (detalhe), PUT (editar), DELETE (desactivar) |
| 6 | `app/dashboard/processos/templates/page.tsx` | Pagina de listagem de templates |
| 7 | `app/dashboard/processos/templates/novo/page.tsx` | Pagina wrapper para criacao |
| 8 | `app/dashboard/processos/templates/[id]/editar/page.tsx` | Pagina wrapper para edicao |
| 9 | `components/templates/template-list.tsx` | Grid de cards de templates |
| 10 | `components/templates/template-builder.tsx` | Builder visual principal (DnD Kanban) |
| 11 | `components/templates/template-stage-column.tsx` | Coluna de fase (container sortable) |
| 12 | `components/templates/template-task-card.tsx` | Card de tarefa (item sortable) |
| 13 | `components/templates/template-task-dialog.tsx` | Dialog para criar/editar tarefa |
| 14 | `components/templates/template-stage-dialog.tsx` | Dialog para criar/editar fase |
| 15 | `components/templates/template-preview.tsx` | Preview read-only do template |

---

## 4. Ficheiro #1 — `app/api/templates/route.ts` (MODIFICAR)

**Estado actual:** Apenas handler `GET` que lista templates com contagem de fases/tarefas.

**Modificacao:** Adicionar handler `POST` para criar template completo (processo + fases + tarefas).

```typescript
// app/api/templates/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { templateSchema } from '@/lib/validations/template'

// GET — JA EXISTE — manter exactamente como esta (linhas 4-55)
export async function GET() {
  // ... codigo existente sem alteracao ...
}

// POST — NOVO — criar template completo
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    // 1. Validar payload
    const parsed = templateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, stages } = parsed.data

    // 2. Inserir tpl_processes
    const { data: process, error: processError } = await supabase
      .from('tpl_processes')
      .insert({ name, description })
      .select('id')
      .single()

    if (processError || !process) {
      return NextResponse.json(
        { error: processError?.message || 'Erro ao criar template' },
        { status: 500 }
      )
    }

    // 3. Inserir tpl_stages + tpl_tasks para cada fase
    for (const stage of stages) {
      const { data: insertedStage, error: stageError } = await supabase
        .from('tpl_stages')
        .insert({
          tpl_process_id: process.id,
          name: stage.name,
          description: stage.description || null,
          order_index: stage.order_index,
        })
        .select('id')
        .single()

      if (stageError || !insertedStage) {
        // Rollback manual: apagar o processo criado
        await supabase.from('tpl_processes').delete().eq('id', process.id)
        return NextResponse.json(
          { error: `Erro ao criar fase "${stage.name}": ${stageError?.message}` },
          { status: 500 }
        )
      }

      // 4. Inserir tarefas da fase
      const tasksToInsert = stage.tasks.map((task) => ({
        tpl_stage_id: insertedStage.id,
        title: task.title,
        description: task.description || null,
        action_type: task.action_type,
        is_mandatory: task.is_mandatory,
        sla_days: task.sla_days || null,
        assigned_role: task.assigned_role || null,
        config: task.config || {},
        order_index: task.order_index,
      }))

      const { error: tasksError } = await supabase
        .from('tpl_tasks')
        .insert(tasksToInsert)

      if (tasksError) {
        // Rollback manual
        await supabase.from('tpl_processes').delete().eq('id', process.id)
        return NextResponse.json(
          { error: `Erro ao criar tarefas: ${tasksError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ id: process.id }, { status: 201 })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Nota de rollback:** Supabase JS nao suporta transaccoes explicitas. Se uma insercao de stage/task falhar, o handler apaga o `tpl_processes` criado (cascade deleta stages e tasks via FK).

---

## 5. Ficheiro #4 — `lib/validations/template.ts` (MODIFICAR)

**Modificacao:** Relaxar refine de config para EMAIL e GENERATE_DOC (bibliotecas vazias no MVP).

```typescript
// lib/validations/template.ts — ALTERACAO no refine do taskSchema
// Substituir o .refine() actual por:

.refine(
  (task) => {
    // UPLOAD: doc_type_id obrigatorio
    if (task.action_type === 'UPLOAD') {
      return !!task.config?.doc_type_id
    }
    // EMAIL e GENERATE_DOC: config opcional no MVP (bibliotecas vazias)
    // Sera obrigatorio quando M13 estiver implementado
    return true
  },
  {
    message: 'Config invalido para o tipo de accao (falta doc_type_id)',
    path: ['config'],
  }
)
```

Isto permite criar tarefas EMAIL/GENERATE_DOC sem seleccionar template (bibliotecas vazias).

---

## 6. Ficheiro #3 — `app/dashboard/processos/page.tsx` (MODIFICAR)

**Modificacao:** Adicionar botao "Gerir Templates" no header, ao lado do botao existente.

Localizar o bloco `<div className="flex items-center justify-between">` (linha ~53) e adicionar:

```tsx
// Dentro do div de botoes, ANTES do botao "Nova Angariacao"
<div className="flex items-center gap-2">
  <Button variant="outline" onClick={() => router.push('/dashboard/processos/templates')}>
    <FileText className="mr-2 h-4 w-4" />
    Gerir Templates
  </Button>
  <Button onClick={() => router.push('/dashboard/angariacao')}>
    <Plus className="mr-2 h-4 w-4" />
    Nova Angariacao
  </Button>
</div>
```

Adicionar `FileText` ao import de lucide-react (ja esta importado neste ficheiro).

---

## 7. Ficheiro #5 — `app/api/templates/[id]/route.ts` (CRIAR)

CRUD individual: GET (detalhe com fases e tarefas), PUT (editar — delete-and-recreate), DELETE (soft delete).

```typescript
// app/api/templates/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { templateSchema } from '@/lib/validations/template'

// GET — Detalhe do template com fases e tarefas
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('tpl_processes')
      .select(`
        *,
        tpl_stages (
          *,
          tpl_tasks (*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Ordenar stages e tasks por order_index
    if (data.tpl_stages) {
      data.tpl_stages.sort((a: any, b: any) => a.order_index - b.order_index)
      data.tpl_stages.forEach((stage: any) => {
        if (stage.tpl_tasks) {
          stage.tpl_tasks.sort((a: any, b: any) => a.order_index - b.order_index)
        }
      })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT — Editar template (delete-and-recreate stages/tasks)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    // 1. Validar payload
    const parsed = templateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, description, stages } = parsed.data

    // 2. Verificar se template existe
    const { data: existing, error: existError } = await supabase
      .from('tpl_processes')
      .select('id')
      .eq('id', id)
      .single()

    if (existError || !existing) {
      return NextResponse.json({ error: 'Template nao encontrado' }, { status: 404 })
    }

    // 3. Verificar instancias activas (nao permitir edicao completa)
    const { count: activeInstances } = await supabase
      .from('proc_instances')
      .select('*', { count: 'exact', head: true })
      .eq('tpl_process_id', id)
      .not('current_status', 'in', '("completed","cancelled")')

    if (activeInstances && activeInstances > 0) {
      // Apenas permitir editar nome e descricao
      const { error: updateError } = await supabase
        .from('tpl_processes')
        .update({ name, description })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({
        id,
        warning: 'Template tem instancias activas. Apenas nome e descricao foram actualizados.',
      })
    }

    // 4. Update nome/descricao do processo
    const { error: updateError } = await supabase
      .from('tpl_processes')
      .update({ name, description })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 5. Buscar IDs das stages actuais para apagar tasks
    const { data: existingStages } = await supabase
      .from('tpl_stages')
      .select('id')
      .eq('tpl_process_id', id)

    if (existingStages && existingStages.length > 0) {
      const stageIds = existingStages.map((s) => s.id)

      // 6. Apagar todas as tasks das stages
      await supabase
        .from('tpl_tasks')
        .delete()
        .in('tpl_stage_id', stageIds)

      // 7. Apagar todas as stages
      await supabase
        .from('tpl_stages')
        .delete()
        .eq('tpl_process_id', id)
    }

    // 8. Inserir novas stages e tasks
    for (const stage of stages) {
      const { data: insertedStage, error: stageError } = await supabase
        .from('tpl_stages')
        .insert({
          tpl_process_id: id,
          name: stage.name,
          description: stage.description || null,
          order_index: stage.order_index,
        })
        .select('id')
        .single()

      if (stageError || !insertedStage) {
        return NextResponse.json(
          { error: `Erro ao criar fase "${stage.name}": ${stageError?.message}` },
          { status: 500 }
        )
      }

      const tasksToInsert = stage.tasks.map((task) => ({
        tpl_stage_id: insertedStage.id,
        title: task.title,
        description: task.description || null,
        action_type: task.action_type,
        is_mandatory: task.is_mandatory,
        sla_days: task.sla_days || null,
        assigned_role: task.assigned_role || null,
        config: task.config || {},
        order_index: task.order_index,
      }))

      const { error: tasksError } = await supabase
        .from('tpl_tasks')
        .insert(tasksToInsert)

      if (tasksError) {
        return NextResponse.json(
          { error: `Erro ao criar tarefas: ${tasksError.message}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Error updating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE — Soft delete (is_active = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('tpl_processes')
      .update({ is_active: false })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deactivating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## 8. Ficheiro #6 — `app/dashboard/processos/templates/page.tsx` (CRIAR)

Pagina de listagem de templates. Segue o padrao de `app/dashboard/processos/page.tsx`.

```typescript
// app/dashboard/processos/templates/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/shared/empty-state'
import { TemplateList } from '@/components/templates/template-list'
import { FileStack, Plus, Search, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useDebounce } from '@/hooks/use-debounce'
import type { TemplateWithCounts } from '@/types/template'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const loadTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Erro ao carregar templates')
      const data = await res.json()
      setTemplates(data)
    } catch (error) {
      console.error('Erro ao carregar templates:', error)
      setTemplates([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Filtrar no frontend (lista pequena)
  const filteredTemplates = templates.filter((tpl) => {
    if (!debouncedSearch) return true
    const q = debouncedSearch.toLowerCase()
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.description?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/processos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates de Processo</h1>
            <p className="text-muted-foreground">
              Crie e gira moldes reutilizaveis de processos documentais
            </p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/processos/templates/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {/* Pesquisa */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conteudo */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Nenhum template encontrado"
          description={
            search
              ? 'Tente ajustar os criterios de pesquisa'
              : 'Crie o seu primeiro template de processo'
          }
          action={
            !search
              ? {
                  label: 'Novo Template',
                  onClick: () => router.push('/dashboard/processos/templates/novo'),
                }
              : undefined
          }
        />
      ) : (
        <TemplateList
          templates={filteredTemplates}
          onRefresh={loadTemplates}
        />
      )}
    </div>
  )
}
```

---

## 9. Ficheiro #9 — `components/templates/template-list.tsx` (CRIAR)

Grid de cards para listagem de templates. Cada card mostra nome, descricao, badge activo/inactivo, contagem de fases/tarefas, e accoes.

```tsx
// components/templates/template-list.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreHorizontal, Pencil, Eye, Trash2, Layers, ListChecks } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import type { TemplateWithCounts } from '@/types/template'

interface TemplateListProps {
  templates: TemplateWithCounts[]
  onRefresh: () => void
}

export function TemplateList({ templates, onRefresh }: TemplateListProps) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeactivate = async () => {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/templates/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao desactivar template')
      toast.success('Template desactivado com sucesso')
      onRefresh()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsDeleting(false)
      setDeleteId(null)
    }
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            className="hover:bg-accent/50 transition-colors cursor-pointer h-full"
            onClick={() => router.push(`/dashboard/processos/templates/${tpl.id}/editar`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{tpl.name}</h3>
                  {tpl.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {tpl.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                    {tpl.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onClick={() => router.push(`/dashboard/processos/templates/${tpl.id}/editar`)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(tpl.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Desactivar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {tpl.stages_count} {tpl.stages_count === 1 ? 'fase' : 'fases'}
                </span>
                <span className="flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  {tpl.tasks_count} {tpl.tasks_count === 1 ? 'tarefa' : 'tarefas'}
                </span>
                <span className="ml-auto">
                  {formatDate(tpl.created_at)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de confirmacao */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza de que pretende desactivar este template? O template
              ficara inactivo mas nao sera eliminado. Processos ja instanciados
              nao serao afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'A desactivar...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

---

## 10. Ficheiro #7 — `app/dashboard/processos/templates/novo/page.tsx` (CRIAR)

Pagina wrapper para criacao de template.

```tsx
// app/dashboard/processos/templates/novo/page.tsx
'use client'

import { useRouter } from 'next/navigation'
import { TemplateBuilder } from '@/components/templates/template-builder'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function NovoTemplatePage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/processos/templates')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Template</h1>
          <p className="text-muted-foreground">
            Crie um novo template de processo documental
          </p>
        </div>
      </div>

      <TemplateBuilder mode="create" />
    </div>
  )
}
```

---

## 11. Ficheiro #8 — `app/dashboard/processos/templates/[id]/editar/page.tsx` (CRIAR)

Pagina wrapper para edicao. Carrega o template existente e passa ao builder.

```tsx
// app/dashboard/processos/templates/[id]/editar/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { TemplateBuilder } from '@/components/templates/template-builder'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import type { TemplateDetail } from '@/types/template'

export default function EditarTemplatePage() {
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string

  const [template, setTemplate] = useState<TemplateDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/templates/${templateId}`)
        if (!res.ok) throw new Error('Template nao encontrado')
        const data = await res.json()
        setTemplate(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [templateId])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/processos/templates')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Erro</h1>
        </div>
        <p className="text-muted-foreground">{error || 'Template nao encontrado'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/processos/templates')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Template</h1>
          <p className="text-muted-foreground">{template.name}</p>
        </div>
      </div>

      <TemplateBuilder mode="edit" templateId={templateId} initialData={template} />
    </div>
  )
}
```

---

## 12. Ficheiro #10 — `components/templates/template-builder.tsx` (CRIAR)

**Este e o componente central do M07.** Builder visual com DnD Kit. Contém:
- Campos de nome/descricao do template
- DndContext com multi-container (fases = containers, tarefas = items)
- Botao para adicionar fases
- Botoes para guardar/cancelar

```tsx
// components/templates/template-builder.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Plus, Loader2, Save } from 'lucide-react'
import { TemplateStageColumn } from './template-stage-column'
import { TemplateTaskCard } from './template-task-card'
import { TemplateTaskDialog } from './template-task-dialog'
import { TemplateStageDialog } from './template-stage-dialog'
import type { TemplateDetail } from '@/types/template'

// -------------------------------------------------------
// Tipos internos do builder
// -------------------------------------------------------
export interface StageData {
  id: string // UUID temporario (crypto.randomUUID())
  name: string
  description?: string
}

export interface TaskData {
  id: string // UUID temporario
  title: string
  description?: string
  action_type: 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL'
  is_mandatory: boolean
  sla_days?: number
  assigned_role?: string
  config: Record<string, any>
}

interface TemplateBuilderProps {
  mode: 'create' | 'edit'
  templateId?: string
  initialData?: TemplateDetail
}

// -------------------------------------------------------
// Componente Principal
// -------------------------------------------------------
export function TemplateBuilder({ mode, templateId, initialData }: TemplateBuilderProps) {
  const router = useRouter()

  // Campos do template
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')

  // Estado DnD: items = { stageId: [taskId1, taskId2, ...] }
  const [items, setItems] = useState<Record<string, string[]>>({})
  const [containers, setContainers] = useState<string[]>([])

  // Metadados separados do DnD
  const [stagesData, setStagesData] = useState<Record<string, StageData>>({})
  const [tasksData, setTasksData] = useState<Record<string, TaskData>>({})

  // DnD state
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [clonedItems, setClonedItems] = useState<Record<string, string[]> | null>(null)
  const lastOverId = useRef<UniqueIdentifier | null>(null)
  const recentlyMovedToNewContainer = useRef(false)

  // Dialogs
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskDialogStageId, setTaskDialogStageId] = useState<string | null>(null)
  const [taskDialogData, setTaskDialogData] = useState<TaskData | null>(null)
  const [stageDialogOpen, setStageDialogOpen] = useState(false)
  const [stageDialogData, setStageDialogData] = useState<StageData | null>(null)

  // Loading
  const [isSaving, setIsSaving] = useState(false)

  // -------------------------------------------------------
  // Inicializar com dados existentes (modo edicao)
  // -------------------------------------------------------
  useEffect(() => {
    if (!initialData?.tpl_stages) return

    const newItems: Record<string, string[]> = {}
    const newStagesData: Record<string, StageData> = {}
    const newTasksData: Record<string, TaskData> = {}
    const newContainers: string[] = []

    for (const stage of initialData.tpl_stages) {
      newContainers.push(stage.id)
      newStagesData[stage.id] = {
        id: stage.id,
        name: stage.name,
        description: stage.description || undefined,
      }

      const taskIds: string[] = []
      for (const task of stage.tpl_tasks || []) {
        taskIds.push(task.id)
        newTasksData[task.id] = {
          id: task.id,
          title: task.title,
          description: task.description || undefined,
          action_type: task.action_type as TaskData['action_type'],
          is_mandatory: task.is_mandatory,
          sla_days: task.sla_days || undefined,
          assigned_role: task.assigned_role || undefined,
          config: (task.config as Record<string, any>) || {},
        }
      }
      newItems[stage.id] = taskIds
    }

    setItems(newItems)
    setContainers(newContainers)
    setStagesData(newStagesData)
    setTasksData(newTasksData)
  }, [initialData])

  // -------------------------------------------------------
  // Sensores DnD
  // -------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // -------------------------------------------------------
  // Helper: encontrar container de um ID
  // -------------------------------------------------------
  const findContainer = useCallback(
    (id: UniqueIdentifier) => {
      if (id in items) return id as string
      return Object.keys(items).find((key) =>
        items[key].includes(id as string)
      )
    },
    [items]
  )

  // -------------------------------------------------------
  // Collision Detection (multi-container)
  // -------------------------------------------------------
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      // Ao arrastar container, so verificar containers
      if (activeId && activeId in items) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(
            (container) => container.id in items
          ),
        })
      }

      const pointerIntersections = pointerWithin(args)
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args)

      let overId = getFirstCollision(intersections, 'id')

      if (overId != null) {
        if (overId in items) {
          const containerItems = items[overId as string]
          if (containerItems.length > 0) {
            overId = closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter(
                (c) =>
                  c.id !== overId &&
                  containerItems.includes(c.id as string)
              ),
            })[0]?.id
          }
        }
        lastOverId.current = overId
        return [{ id: overId }]
      }

      if (recentlyMovedToNewContainer.current) {
        lastOverId.current = activeId
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : []
    },
    [activeId, items]
  )

  // -------------------------------------------------------
  // DnD Event Handlers
  // -------------------------------------------------------
  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id)
    setClonedItems({ ...items })
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    const overId = over?.id
    if (overId == null || active.id in items) return

    const overContainer = findContainer(overId)
    const activeContainer = findContainer(active.id)
    if (!overContainer || !activeContainer || activeContainer === overContainer) return

    setItems((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const overIndex = overItems.indexOf(overId as string)
      const activeIndex = activeItems.indexOf(active.id as string)

      const isBelowOverItem =
        over &&
        active.rect.current.translated &&
        active.rect.current.translated.top > over.rect.top + over.rect.height
      const modifier = isBelowOverItem ? 1 : 0
      const newIndex =
        overId in prev
          ? overItems.length + 1
          : overIndex >= 0
            ? overIndex + modifier
            : overItems.length + 1

      recentlyMovedToNewContainer.current = true

      return {
        ...prev,
        [activeContainer]: prev[activeContainer].filter((item) => item !== active.id),
        [overContainer]: [
          ...prev[overContainer].slice(0, newIndex),
          active.id as string,
          ...prev[overContainer].slice(newIndex),
        ],
      }
    })
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    // Arrastar containers (fases)
    if (active.id in items && over?.id) {
      setContainers((c) =>
        arrayMove(c, c.indexOf(active.id as string), c.indexOf(over.id as string))
      )
    }

    // Arrastar items (tarefas) dentro do mesmo container
    const activeContainer = findContainer(active.id)
    if (!activeContainer || !over?.id) {
      setActiveId(null)
      return
    }

    const overContainer = findContainer(over.id)
    if (overContainer) {
      const activeIndex = items[activeContainer].indexOf(active.id as string)
      const overIndex = items[overContainer].indexOf(over.id as string)
      if (activeIndex !== overIndex) {
        setItems((prev) => ({
          ...prev,
          [overContainer]: arrayMove(prev[overContainer], activeIndex, overIndex),
        }))
      }
    }
    setActiveId(null)
  }

  function handleDragCancel() {
    if (clonedItems) setItems(clonedItems)
    setActiveId(null)
    setClonedItems(null)
  }

  // -------------------------------------------------------
  // Accoes: Adicionar/Editar/Remover Fases
  // -------------------------------------------------------
  const handleAddStage = (data: { name: string; description?: string }) => {
    const id = crypto.randomUUID()
    setStagesData((prev) => ({ ...prev, [id]: { id, name: data.name, description: data.description } }))
    setItems((prev) => ({ ...prev, [id]: [] }))
    setContainers((prev) => [...prev, id])
    setStageDialogOpen(false)
  }

  const handleEditStage = (data: { name: string; description?: string }) => {
    if (!stageDialogData) return
    setStagesData((prev) => ({
      ...prev,
      [stageDialogData.id]: { ...prev[stageDialogData.id], name: data.name, description: data.description },
    }))
    setStageDialogOpen(false)
    setStageDialogData(null)
  }

  const handleRemoveStage = (stageId: string) => {
    // Remover tasks associadas
    const taskIds = items[stageId] || []
    setTasksData((prev) => {
      const next = { ...prev }
      taskIds.forEach((id) => delete next[id])
      return next
    })
    setStagesData((prev) => {
      const next = { ...prev }
      delete next[stageId]
      return next
    })
    setItems((prev) => {
      const next = { ...prev }
      delete next[stageId]
      return next
    })
    setContainers((prev) => prev.filter((id) => id !== stageId))
  }

  // -------------------------------------------------------
  // Accoes: Adicionar/Editar/Remover Tarefas
  // -------------------------------------------------------
  const handleAddTask = (data: TaskData) => {
    if (!taskDialogStageId) return
    const id = crypto.randomUUID()
    const taskWithId = { ...data, id }
    setTasksData((prev) => ({ ...prev, [id]: taskWithId }))
    setItems((prev) => ({
      ...prev,
      [taskDialogStageId]: [...(prev[taskDialogStageId] || []), id],
    }))
    setTaskDialogOpen(false)
    setTaskDialogStageId(null)
  }

  const handleEditTask = (data: TaskData) => {
    if (!taskDialogData) return
    setTasksData((prev) => ({
      ...prev,
      [taskDialogData.id]: { ...data, id: taskDialogData.id },
    }))
    setTaskDialogOpen(false)
    setTaskDialogData(null)
  }

  const handleRemoveTask = (taskId: string) => {
    const container = findContainer(taskId)
    if (!container) return
    setItems((prev) => ({
      ...prev,
      [container]: prev[container].filter((id) => id !== taskId),
    }))
    setTasksData((prev) => {
      const next = { ...prev }
      delete next[taskId]
      return next
    })
  }

  // -------------------------------------------------------
  // Guardar Template
  // -------------------------------------------------------
  const handleSave = async () => {
    // Validacao basica no frontend
    if (!name.trim()) {
      toast.error('O nome do template e obrigatorio')
      return
    }
    if (containers.length === 0) {
      toast.error('O template deve ter pelo menos uma fase')
      return
    }
    for (const stageId of containers) {
      if (!items[stageId] || items[stageId].length === 0) {
        toast.error(`A fase "${stagesData[stageId]?.name}" deve ter pelo menos uma tarefa`)
        return
      }
    }

    // Montar payload
    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      stages: containers.map((stageId, stageIndex) => ({
        name: stagesData[stageId].name,
        description: stagesData[stageId].description,
        order_index: stageIndex,
        tasks: (items[stageId] || []).map((taskId, taskIndex) => ({
          title: tasksData[taskId].title,
          description: tasksData[taskId].description,
          action_type: tasksData[taskId].action_type,
          is_mandatory: tasksData[taskId].is_mandatory,
          sla_days: tasksData[taskId].sla_days,
          assigned_role: tasksData[taskId].assigned_role,
          config: tasksData[taskId].config,
          order_index: taskIndex,
        })),
      })),
    }

    setIsSaving(true)
    try {
      const url = mode === 'create' ? '/api/templates' : `/api/templates/${templateId}`
      const method = mode === 'create' ? 'POST' : 'PUT'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Erro ao guardar template')

      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success(mode === 'create' ? 'Template criado com sucesso!' : 'Template actualizado com sucesso!')
      }
      router.push('/dashboard/processos/templates')
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Campos do template */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Nome do Template *</Label>
              <Input
                id="tpl-name"
                placeholder="Ex: Captacao da Angariacao"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-desc">Descricao</Label>
              <Textarea
                id="tpl-desc"
                placeholder="Breve descricao do template..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[40px] resize-none"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barra de accoes */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => {
            setStageDialogData(null)
            setStageDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Fase
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard/processos/templates')}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Template
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Builder DnD — colunas horizontais */}
      {containers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Comece por adicionar a primeira fase do template
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setStageDialogData(null)
                setStageDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Fase
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={containers} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-4 min-w-min">
                {containers.map((stageId) => (
                  <TemplateStageColumn
                    key={stageId}
                    id={stageId}
                    stage={stagesData[stageId]}
                    taskIds={items[stageId] || []}
                    tasksData={tasksData}
                    onEditStage={() => {
                      setStageDialogData(stagesData[stageId])
                      setStageDialogOpen(true)
                    }}
                    onRemoveStage={() => handleRemoveStage(stageId)}
                    onAddTask={() => {
                      setTaskDialogStageId(stageId)
                      setTaskDialogData(null)
                      setTaskDialogOpen(true)
                    }}
                    onEditTask={(taskId) => {
                      setTaskDialogStageId(stageId)
                      setTaskDialogData(tasksData[taskId])
                      setTaskDialogOpen(true)
                    }}
                    onRemoveTask={handleRemoveTask}
                  />
                ))}
              </div>
            </SortableContext>

            {/* DragOverlay — ghost durante drag */}
            <DragOverlay>
              {activeId ? (
                activeId in items ? (
                  // A arrastar uma fase
                  <div className="w-72 rounded-lg border bg-card shadow-lg opacity-80 p-4">
                    <p className="font-medium text-sm">{stagesData[activeId as string]?.name}</p>
                  </div>
                ) : (
                  // A arrastar uma tarefa
                  <TemplateTaskCard
                    id={activeId as string}
                    task={tasksData[activeId as string]}
                    isOverlay
                  />
                )
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Dialogs */}
      <TemplateStageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        initialData={stageDialogData}
        onSubmit={stageDialogData ? handleEditStage : handleAddStage}
      />

      <TemplateTaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open)
          if (!open) {
            setTaskDialogData(null)
            setTaskDialogStageId(null)
          }
        }}
        initialData={taskDialogData}
        onSubmit={taskDialogData ? handleEditTask : handleAddTask}
      />
    </div>
  )
}
```

---

## 13. Ficheiro #11 — `components/templates/template-stage-column.tsx` (CRIAR)

Coluna sortable que representa uma fase. Container para tarefas.

```tsx
// components/templates/template-stage-column.tsx
'use client'

import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GripVertical, MoreHorizontal, Pencil, Trash2, Plus } from 'lucide-react'
import { TemplateTaskCard } from './template-task-card'
import type { StageData, TaskData } from './template-builder'

interface TemplateStageColumnProps {
  id: string
  stage: StageData
  taskIds: string[]
  tasksData: Record<string, TaskData>
  onEditStage: () => void
  onRemoveStage: () => void
  onAddTask: () => void
  onEditTask: (taskId: string) => void
  onRemoveTask: (taskId: string) => void
}

export function TemplateStageColumn({
  id,
  stage,
  taskIds,
  tasksData,
  onEditStage,
  onRemoveStage,
  onAddTask,
  onEditTask,
  onRemoveTask,
}: TemplateStageColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { type: 'container', children: taskIds },
  })

  const style = {
    transform: CSS.Translate.toString(transform), // NOTA: Translate, nao Transform!
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-72 shrink-0 flex flex-col rounded-lg border bg-muted/30"
    >
      {/* Header da fase */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/50 rounded-t-lg">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate">{stage.name}</h3>
          {stage.description && (
            <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
          )}
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {taskIds.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEditStage}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar Fase
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onRemoveStage}>
              <Trash2 className="mr-2 h-4 w-4" />
              Remover Fase
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Lista de tarefas (sortable) */}
      <ScrollArea className="flex-1 max-h-[400px]">
        <div className="p-2 space-y-2">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {taskIds.map((taskId) => (
              <TemplateTaskCard
                key={taskId}
                id={taskId}
                task={tasksData[taskId]}
                onEdit={() => onEditTask(taskId)}
                onRemove={() => onRemoveTask(taskId)}
              />
            ))}
          </SortableContext>

          {taskIds.length === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">
              Arraste tarefas para aqui ou clique em adicionar
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer — Adicionar tarefa */}
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onAddTask}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Tarefa
        </Button>
      </div>
    </div>
  )
}
```

---

## 14. Ficheiro #12 — `components/templates/template-task-card.tsx` (CRIAR)

Card sortable que representa uma tarefa. Mostra icone por action_type, titulo, badges.

```tsx
// components/templates/template-task-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  Mail,
  FileText,
  Circle,
  GripVertical,
  Pencil,
  Trash2,
} from 'lucide-react'
import { ACTION_TYPES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { TaskData } from './template-builder'

interface TemplateTaskCardProps {
  id: string
  task: TaskData
  isOverlay?: boolean
  onEdit?: () => void
  onRemove?: () => void
}

const getTaskIcon = (actionType: string) => {
  switch (actionType) {
    case 'UPLOAD':
      return <Upload className="h-3.5 w-3.5" />
    case 'EMAIL':
      return <Mail className="h-3.5 w-3.5" />
    case 'GENERATE_DOC':
      return <FileText className="h-3.5 w-3.5" />
    default:
      return <Circle className="h-3.5 w-3.5" />
  }
}

const actionTypeColors: Record<string, string> = {
  UPLOAD: 'text-blue-600',
  EMAIL: 'text-amber-600',
  GENERATE_DOC: 'text-purple-600',
  MANUAL: 'text-slate-500',
}

export function TemplateTaskCard({
  id,
  task,
  isOverlay = false,
  onEdit,
  onRemove,
}: TemplateTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: isOverlay })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  if (!task) return null

  return (
    <div
      ref={!isOverlay ? setNodeRef : undefined}
      style={!isOverlay ? style : undefined}
      className={cn(
        'group flex items-start gap-2 rounded-md border bg-card p-2.5 text-sm',
        isOverlay && 'shadow-lg',
        !isOverlay && 'hover:bg-accent/50 transition-colors'
      )}
    >
      {/* Drag handle */}
      {!isOverlay && (
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Icone do tipo */}
      <div className={cn('mt-0.5 shrink-0', actionTypeColors[task.action_type])}>
        {getTaskIcon(task.action_type)}
      </div>

      {/* Conteudo */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium text-xs leading-tight truncate">{task.title}</p>
        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {ACTION_TYPES[task.action_type as keyof typeof ACTION_TYPES]}
          </Badge>
          {task.is_mandatory && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              Obrig.
            </Badge>
          )}
          {task.sla_days && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {task.sla_days}d
            </Badge>
          )}
          {task.assigned_role && (
            <Badge variant="outline" className="text-[10px] px-1 py-0">
              {task.assigned_role}
            </Badge>
          )}
        </div>
      </div>

      {/* Accoes (visiveis no hover) */}
      {!isOverlay && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              onRemove?.()
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

## 15. Ficheiro #13 — `components/templates/template-task-dialog.tsx` (CRIAR)

Dialog para criar/editar tarefa. Campos condicionais por action_type.

```tsx
// components/templates/template-task-dialog.tsx
'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ACTION_TYPES } from '@/lib/constants'
import type { TaskData } from './template-builder'

const ASSIGNABLE_ROLES = [
  { value: 'Processual', label: 'Gestora Processual' },
  { value: 'Consultor', label: 'Consultor' },
  { value: 'Broker/CEO', label: 'Broker/CEO' },
] as const

interface TemplateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: TaskData | null // null = criar, objecto = editar
  onSubmit: (data: TaskData) => void
}

export function TemplateTaskDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: TemplateTaskDialogProps) {
  const isEditing = !!initialData

  // Estado local do formulario
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [actionType, setActionType] = useState<TaskData['action_type']>('MANUAL')
  const [isMandatory, setIsMandatory] = useState(true)
  const [slaDays, setSlaDays] = useState<string>('')
  const [assignedRole, setAssignedRole] = useState('')
  const [docTypeId, setDocTypeId] = useState('')

  // doc_types para select (UPLOAD)
  const [docTypes, setDocTypes] = useState<Array<{ id: string; name: string; category: string }>>([])
  const [docTypesLoading, setDocTypesLoading] = useState(false)

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title)
        setDescription(initialData.description || '')
        setActionType(initialData.action_type)
        setIsMandatory(initialData.is_mandatory)
        setSlaDays(initialData.sla_days?.toString() || '')
        setAssignedRole(initialData.assigned_role || '')
        setDocTypeId(initialData.config?.doc_type_id || '')
      } else {
        setTitle('')
        setDescription('')
        setActionType('MANUAL')
        setIsMandatory(true)
        setSlaDays('')
        setAssignedRole('')
        setDocTypeId('')
      }
    }
  }, [open, initialData])

  // Carregar doc_types quando action_type = UPLOAD
  useEffect(() => {
    if (actionType === 'UPLOAD' && docTypes.length === 0) {
      setDocTypesLoading(true)
      fetch('/api/libraries/doc-types')
        .then((res) => res.json())
        .then((data) => setDocTypes(data))
        .catch(() => setDocTypes([]))
        .finally(() => setDocTypesLoading(false))
    }
  }, [actionType, docTypes.length])

  const handleSubmit = () => {
    if (!title.trim()) return

    // Validar UPLOAD: doc_type_id obrigatorio
    if (actionType === 'UPLOAD' && !docTypeId) return

    const config: Record<string, any> = {}
    if (actionType === 'UPLOAD' && docTypeId) {
      config.doc_type_id = docTypeId
    }

    onSubmit({
      id: initialData?.id || '',
      title: title.trim(),
      description: description.trim() || undefined,
      action_type: actionType,
      is_mandatory: isMandatory,
      sla_days: slaDays ? parseInt(slaDays, 10) : undefined,
      assigned_role: assignedRole || undefined,
      config,
    })
  }

  // Agrupar doc_types por categoria
  const docTypesByCategory = docTypes.reduce<Record<string, typeof docTypes>>((acc, dt) => {
    const cat = dt.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          <DialogDescription>
            Configure os detalhes da tarefa do template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Titulo */}
          <div className="space-y-2">
            <Label htmlFor="task-title">Titulo *</Label>
            <Input
              id="task-title"
              placeholder="Ex: Upload do Contrato de Mediacao"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Descricao */}
          <div className="space-y-2">
            <Label htmlFor="task-desc">Descricao</Label>
            <Textarea
              id="task-desc"
              placeholder="Descricao opcional..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>

          {/* Tipo de Accao */}
          <div className="space-y-2">
            <Label>Tipo de Accao *</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v as TaskData['action_type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Config condicional: UPLOAD -> doc_type_id */}
          {actionType === 'UPLOAD' && (
            <div className="space-y-2">
              <Label>Tipo de Documento *</Label>
              <Select value={docTypeId} onValueChange={setDocTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder={docTypesLoading ? 'A carregar...' : 'Seleccionar tipo de documento'} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(docTypesByCategory).map(([category, types]) => (
                    <SelectGroup key={category}>
                      <SelectLabel>{category}</SelectLabel>
                      {types.map((dt) => (
                        <SelectItem key={dt.id} value={dt.id}>
                          {dt.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Config condicional: EMAIL -> mensagem "Em breve" */}
          {actionType === 'EMAIL' && (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                Seleccao de template de email ficara disponivel em breve (M13).
              </p>
            </div>
          )}

          {/* Config condicional: GENERATE_DOC -> mensagem "Em breve" */}
          {actionType === 'GENERATE_DOC' && (
            <div className="rounded-md border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                Seleccao de template de documento ficara disponivel em breve (M13).
              </p>
            </div>
          )}

          {/* Role Atribuido */}
          <div className="space-y-2">
            <Label>Role Atribuido</Label>
            <Select value={assignedRole} onValueChange={setAssignedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar role..." />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SLA (dias) */}
          <div className="space-y-2">
            <Label htmlFor="task-sla">SLA (dias)</Label>
            <Input
              id="task-sla"
              type="number"
              min="1"
              placeholder="Ex: 5"
              value={slaDays}
              onChange={(e) => setSlaDays(e.target.value)}
            />
          </div>

          {/* Obrigatoria? */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="task-mandatory">Tarefa Obrigatoria</Label>
              <p className="text-xs text-muted-foreground">
                Tarefas obrigatorias nao podem ser dispensadas
              </p>
            </div>
            <Switch
              id="task-mandatory"
              checked={isMandatory}
              onCheckedChange={setIsMandatory}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || (actionType === 'UPLOAD' && !docTypeId)}
          >
            {isEditing ? 'Guardar Alteracoes' : 'Adicionar Tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 16. Ficheiro #14 — `components/templates/template-stage-dialog.tsx` (CRIAR)

Dialog simples para criar/editar nome e descricao de uma fase.

```tsx
// components/templates/template-stage-dialog.tsx
'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { StageData } from './template-builder'

interface TemplateStageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData: StageData | null // null = criar, objecto = editar
  onSubmit: (data: { name: string; description?: string }) => void
}

export function TemplateStageDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}: TemplateStageDialogProps) {
  const isEditing = !!initialData
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '')
      setDescription(initialData?.description || '')
    }
  }, [open, initialData])

  const handleSubmit = () => {
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Fase' : 'Nova Fase'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Altere os dados da fase'
              : 'Adicione uma nova fase ao template'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="stage-name">Nome da Fase *</Label>
            <Input
              id="stage-name"
              placeholder="Ex: Contrato de Mediacao (CMI)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-desc">Descricao</Label>
            <Textarea
              id="stage-desc"
              placeholder="Descricao opcional da fase..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEditing ? 'Guardar' : 'Adicionar Fase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 17. Ficheiro #15 — `components/templates/template-preview.tsx` (CRIAR)

Preview read-only do template. Util para ver o template antes de guardar ou para visualizacao em paginas de detalhe.

```tsx
// components/templates/template-preview.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, Mail, FileText, Circle } from 'lucide-react'
import { ACTION_TYPES } from '@/lib/constants'
import type { TemplateDetail } from '@/types/template'

interface TemplatePreviewProps {
  template: TemplateDetail
}

const getTaskIcon = (actionType: string) => {
  switch (actionType) {
    case 'UPLOAD':
      return <Upload className="h-4 w-4 text-blue-600" />
    case 'EMAIL':
      return <Mail className="h-4 w-4 text-amber-600" />
    case 'GENERATE_DOC':
      return <FileText className="h-4 w-4 text-purple-600" />
    default:
      return <Circle className="h-4 w-4 text-slate-500" />
  }
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const stages = [...(template.tpl_stages || [])].sort(
    (a, b) => a.order_index - b.order_index
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{template.name}</h2>
        {template.description && (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-4 min-w-min pb-2">
          {stages.map((stage, index) => {
            const tasks = [...(stage.tpl_tasks || [])].sort(
              (a, b) => a.order_index - b.order_index
            )

            return (
              <Card key={stage.id} className="w-72 shrink-0">
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">
                      {index + 1}. {stage.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="py-0 pb-3 space-y-1.5">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-2 rounded border text-xs"
                    >
                      {getTaskIcon(task.action_type)}
                      <span className="flex-1 truncate">{task.title}</span>
                      {task.is_mandatory && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          Obrig.
                        </Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

---

## 18. Resumo — Ordem de Implementacao

### Fase 1: Infraestrutura (API + Dependencias)

| Passo | Accao |
|-------|-------|
| 1.1 | Instalar dependencias: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` |
| 1.2 | Instalar componentes shadcn: `npx shadcn@latest add switch scroll-area` |
| 1.3 | Modificar `lib/validations/template.ts` — relaxar refine para MVP |
| 1.4 | Modificar `app/api/templates/route.ts` — adicionar POST |
| 1.5 | Criar `app/api/templates/[id]/route.ts` — GET, PUT, DELETE |

### Fase 2: Paginas e Listagem

| Passo | Accao |
|-------|-------|
| 2.1 | Criar `components/templates/template-list.tsx` |
| 2.2 | Criar `app/dashboard/processos/templates/page.tsx` |
| 2.3 | Modificar `app/dashboard/processos/page.tsx` — adicionar botao "Gerir Templates" |

### Fase 3: Builder Visual (DnD)

| Passo | Accao |
|-------|-------|
| 3.1 | Criar `components/templates/template-stage-dialog.tsx` |
| 3.2 | Criar `components/templates/template-task-dialog.tsx` |
| 3.3 | Criar `components/templates/template-task-card.tsx` |
| 3.4 | Criar `components/templates/template-stage-column.tsx` |
| 3.5 | Criar `components/templates/template-builder.tsx` |

### Fase 4: Paginas de Criacao/Edicao + Preview

| Passo | Accao |
|-------|-------|
| 4.1 | Criar `app/dashboard/processos/templates/novo/page.tsx` |
| 4.2 | Criar `app/dashboard/processos/templates/[id]/editar/page.tsx` |
| 4.3 | Criar `components/templates/template-preview.tsx` |

### Fase 5: Verificacao

| Passo | Accao |
|-------|-------|
| 5.1 | Verificar que `npm run build` passa sem erros |
| 5.2 | Testar fluxo completo: listar → criar → editar → desactivar |
| 5.3 | Testar DnD: arrastar tarefas entre fases, reordenar fases |
| 5.4 | Testar com dados de seed existentes (template "Captacao da Angariacao") |
| 5.5 | Verificar que processos existentes (M06) nao foram afectados |

---

## 19. Criterios de Sucesso

### Automatizados
- [ ] `npm run build` — sem erros de TypeScript
- [ ] `npm run lint` — sem warnings criticos
- [ ] GET `/api/templates` retorna lista com contagens
- [ ] POST `/api/templates` cria template com fases e tarefas
- [ ] GET `/api/templates/[id]` retorna detalhe com fases/tarefas ordenadas
- [ ] PUT `/api/templates/[id]` actualiza template (delete-and-recreate)
- [ ] DELETE `/api/templates/[id]` faz soft-delete (is_active = false)

### Manuais
- [ ] Pagina de listagem mostra cards com nome, descricao, badge activo/inactivo, contagens
- [ ] Pesquisa por nome funciona com debounce
- [ ] Builder: arrastar tarefas entre fases funciona sem flicker
- [ ] Builder: reordenar fases (colunas) horizontalmente funciona
- [ ] Dialog de tarefa: campos condicionais por action_type aparecem correctamente
- [ ] Dialog de tarefa UPLOAD: select de doc_types agrupado por categoria
- [ ] Dialog de tarefa EMAIL/GENERATE_DOC: mostra mensagem "Em breve"
- [ ] Guardar template (criar/editar) redireciona para listagem com toast de sucesso
- [ ] Template existente "Captacao da Angariacao" aparece na listagem e e editavel
- [ ] Botao "Gerir Templates" na pagina de Processos navega correctamente
- [ ] Toda a UI esta em PT-PT
