# SPEC — Seleccao de Template no Workflow de Aprovacao

**Data:** 2026-02-20
**Modulo:** M06 — Processos (Instancias) + M07 — Templates
**Dependencia:** SPEC-M06-PROCESSOS.md, SPEC-M07-TEMPLATES-PROCESSO.md (ambos implementados)

---

## 1. Problema

Actualmente, quando uma angariacao e criada (`POST /api/acquisitions`), o sistema:

1. Selecciona automaticamente o template activo mais recente (linha 200-206 de `app/api/acquisitions/route.ts`)
2. Associa-o ao `proc_instances.tpl_process_id`
3. Popula as tarefas imediatamente via `populate_process_tasks()`
4. Executa `autoCompleteTasks()` e `recalculateProgress()`

**O problema:** O responsavel pela aprovacao (Broker/CEO ou Gestora Processual) nao tem a oportunidade de escolher qual template de processo documental deve ser aplicado. O template e decidido automaticamente pelo sistema.

**O que deveria acontecer:** Ao aprovar um processo (`pending_approval` → `active`), o aprovador deve seleccionar o template adequado a partir da lista de templates activos. So apos a aprovacao e que as tarefas sao populadas.

---

## 2. Fluxo Actual vs Fluxo Desejado

### Fluxo Actual (problematico)

```
Consultor cria angariacao
  │
  ├── Cria dev_properties + owners + docs
  ├── Auto-selecciona template (primeiro activo)      ← PROBLEMA
  ├── Cria proc_instances COM tpl_process_id           ← PROBLEMA
  ├── Popula proc_tasks via populate_process_tasks()   ← PROBLEMA
  ├── Auto-completa tarefas UPLOAD
  └── Recalcula progresso
  │
  ▼
Processo fica em pending_approval (COM tarefas ja populadas)
  │
  ▼
Aprovador clica "Aprovar Processo"
  │
  ├── Muda current_status → active
  ├── NAO selecciona template                          ← PROBLEMA
  └── NAO repopula tarefas
```

### Fluxo Desejado

```
Consultor cria angariacao
  │
  ├── Cria dev_properties + owners + docs
  ├── Cria proc_instances SEM tpl_process_id (null)
  ├── NAO popula tarefas
  └── NAO executa autoComplete/recalculate
  │
  ▼
Processo fica em pending_approval (SEM tarefas, SEM template)
  │
  ▼
Aprovador ve o processo:
  ├── Revê informacoes do imovel, owners, documentos
  ├── Selecciona template de processo (Select com templates activos)
  └── Clica "Aprovar Processo"
  │
  ▼
API de aprovacao:
  ├── Valida tpl_process_id enviado
  ├── Actualiza proc_instances.tpl_process_id
  ├── Muda current_status → active
  ├── Popula proc_tasks via populate_process_tasks()
  ├── Auto-completa tarefas UPLOAD com docs existentes
  └── Recalcula progresso
```

**Nota importante:** A seccao de tarefas (`ProcessTasksSection`) so e renderizada para processos `active`, `on_hold` ou `completed` — portanto a ausencia de tarefas em `pending_approval` nao causa problemas visuais.

---

## 3. Ficheiros a Modificar

| # | Ficheiro | Tipo | Descricao |
|---|----------|------|-----------|
| 1 | `app/api/acquisitions/route.ts` | API | Remover seleccao automatica de template e populacao de tarefas |
| 2 | `app/api/processes/[id]/approve/route.ts` | API | Aceitar `tpl_process_id`, popular tarefas, autoComplete, recalculate |
| 3 | `components/processes/process-review-section.tsx` | Componente | Adicionar Select de templates activos |
| 4 | `app/(dashboard)/processos/[id]/page.tsx` | Pagina | Passar `tpl_process_id` ao `handleApprove` |

**Nenhum ficheiro novo a criar.**
**Nenhuma migracao de base de dados necessaria** — a coluna `tpl_process_id` ja existe em `proc_instances` e aceita `null`.

---

## 4. Ficheiro #1 — `app/api/acquisitions/route.ts` (MODIFICAR)

**Caminho:** `app/api/acquisitions/route.ts`

**Problema:** Linhas 200-256 seleccionam template, criam proc_instances com `tpl_process_id`, populam tarefas, auto-completam e recalculam progresso.

**Alteracao:** Remover toda a logica de template/tarefas. O processo e criado SEM template e SEM tarefas.

### Antes (linhas 200-256):

```typescript
// 6. Obter template activo (o mais recente se houver multiplos)
const { data: templates, error: templateError } = await supabase
  .from('tpl_processes')
  .select('id, name')
  .eq('is_active', true)
  .order('created_at', { ascending: false })
  .limit(1)

if (templateError || !templates || templates.length === 0) {
  return NextResponse.json(
    {
      error: 'Nenhum template de processo activo encontrado',
      details: templateError?.message,
    },
    { status: 500 }
  )
}

const template = templates[0]
console.log(`Template seleccionado: ${template.name} (${template.id})`)

// 7. Criar instancia de processo
const { data: procInstance, error: procError } = await supabase
  .from('proc_instances')
  .insert({
    property_id: property.id,
    tpl_process_id: template.id,
    current_status: 'pending_approval',
    requested_by: user.id,
    percent_complete: 0,
  })
  .select('id')
  .single()

if (procError || !procInstance) {
  return NextResponse.json(
    { error: 'Erro ao criar processo', details: procError?.message },
    { status: 500 }
  )
}

// 8. Popular tarefas do template (callable function)
const { error: populateError } = await (supabase as any).rpc('populate_process_tasks', {
  p_instance_id: procInstance.id,
})

if (populateError) {
  console.error('Erro ao popular tarefas:', populateError)
}

// 9. Auto-completar tarefas com documentos existentes
const autoCompleteResult = await autoCompleteTasks(procInstance.id, property.id)
console.log('Auto-complete result:', autoCompleteResult)

// 10. Recalcular progresso
const progressResult = await recalculateProgress(procInstance.id)
console.log('Progress result:', progressResult)
```

### Depois:

```typescript
// 6. Criar instancia de processo (SEM template — sera seleccionado na aprovacao)
const { data: procInstance, error: procError } = await supabase
  .from('proc_instances')
  .insert({
    property_id: property.id,
    tpl_process_id: null,
    current_status: 'pending_approval',
    requested_by: user.id,
    percent_complete: 0,
  })
  .select('id')
  .single()

if (procError || !procInstance) {
  return NextResponse.json(
    { error: 'Erro ao criar processo', details: procError?.message },
    { status: 500 }
  )
}
```

**O que muda:**
- Removidos passos 6 (seleccao de template), 8 (populate tasks), 9 (autoComplete), 10 (recalculate)
- `tpl_process_id` e `null` — sera preenchido na aprovacao
- Removido import de `autoCompleteTasks` e `recalculateProgress` (ja nao necessarios neste ficheiro)
- A resposta mantém-se igual (retorna `property_id` e `proc_instance_id`)

**Nota:** O import `import { autoCompleteTasks, recalculateProgress } from '@/lib/process-engine'` (linha 4) pode ser removido deste ficheiro.

---

## 5. Ficheiro #2 — `app/api/processes/[id]/approve/route.ts` (MODIFICAR)

**Caminho:** `app/api/processes/[id]/approve/route.ts`

**Problema:** A API de aprovacao apenas muda o `current_status` para `active`. Nao aceita `tpl_process_id`, nao popula tarefas, nao executa autoComplete.

**Alteracao completa (substituir conteudo integral):**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { autoCompleteTasks, recalculateProgress } from '@/lib/process-engine'
import { z } from 'zod'

const approveSchema = z.object({
  tpl_process_id: z.string().uuid('Template invalido'),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Verificar autenticacao
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // Verificar permissoes (apenas Broker/CEO ou Gestora Processual)
    const { data: devUser } = await supabase
      .from('dev_users')
      .select(
        `
        *,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name, permissions)
        )
      `
      )
      .eq('id', user.id)
      .single()

    const userRoles = ((devUser as any)?.user_roles || []).map(
      (ur: any) => ur.role?.name
    ) as string[]
    const canApprove = userRoles.some((role) =>
      ['Broker/CEO', 'Gestora Processual', 'admin'].includes(role)
    )

    if (!canApprove) {
      return NextResponse.json(
        { error: 'Sem permissao para aprovar processos' },
        { status: 403 }
      )
    }

    // Parse e validacao do body
    const body = await request.json()
    const validation = approveSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Template de processo obrigatorio', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { tpl_process_id } = validation.data

    // Verificar se o template existe e esta activo
    const { data: template, error: templateError } = await supabase
      .from('tpl_processes')
      .select('id, name, is_active')
      .eq('id', tpl_process_id)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template nao encontrado' },
        { status: 404 }
      )
    }

    if (!template.is_active) {
      return NextResponse.json(
        { error: 'O template seleccionado esta inactivo' },
        { status: 400 }
      )
    }

    // Verificar se o processo existe e esta em pending_approval ou returned
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('*, property:dev_properties(id)')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo nao encontrado' },
        { status: 404 }
      )
    }

    if (
      !proc.current_status ||
      !['pending_approval', 'returned'].includes(proc.current_status)
    ) {
      return NextResponse.json(
        { error: 'Apenas processos pendentes ou devolvidos podem ser aprovados' },
        { status: 400 }
      )
    }

    // Se o processo ja tem tarefas (re-aprovacao apos devolucao com template diferente),
    // apagar tarefas antigas antes de repopular
    if (proc.tpl_process_id) {
      const { error: deleteTasksError } = await supabase
        .from('proc_tasks')
        .delete()
        .eq('proc_instance_id', id)

      if (deleteTasksError) {
        console.error('Erro ao limpar tarefas antigas:', deleteTasksError)
      }
    }

    // Actualizar processo: associar template e mudar para active
    const { error: updateError } = await supabase
      .from('proc_instances')
      .update({
        tpl_process_id,
        current_status: 'active',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        started_at: proc.started_at || new Date().toISOString(),
        returned_reason: null,
        percent_complete: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao aprovar processo', details: updateError.message },
        { status: 500 }
      )
    }

    // Popular tarefas do template seleccionado
    const { error: populateError } = await (supabase as any).rpc(
      'populate_process_tasks',
      { p_instance_id: id }
    )

    if (populateError) {
      console.error('Erro ao popular tarefas:', populateError)
      // Nao falhar a aprovacao — as tarefas podem ser repopuladas manualmente
    }

    // Auto-completar tarefas UPLOAD que ja tem documentos existentes
    try {
      const autoCompleteResult = await autoCompleteTasks(id, proc.property.id)
      console.log('Auto-complete result:', autoCompleteResult)
    } catch (autoError) {
      console.error('Erro no auto-complete:', autoError)
    }

    // Recalcular progresso
    try {
      const progressResult = await recalculateProgress(id)
      console.log('Progress result:', progressResult)
    } catch (progressError) {
      console.error('Erro ao recalcular progresso:', progressError)
    }

    // Actualizar status do imovel para in_process
    const { error: propertyError } = await supabase
      .from('dev_properties')
      .update({ status: 'in_process' })
      .eq('id', proc.property.id)

    if (propertyError) {
      console.error('Erro ao actualizar status do imovel:', propertyError)
    }

    return NextResponse.json({
      success: true,
      message: 'Processo aprovado com sucesso',
      template_name: template.name,
    })
  } catch (error) {
    console.error('Erro ao aprovar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
```

**O que muda em relacao ao actual:**
- Aceita body JSON com `tpl_process_id` (obrigatorio, validado com Zod)
- Valida que o template existe e esta activo
- Se o processo ja tinha tarefas (caso de re-aprovacao apos devolucao), apaga-as antes de repopular
- Define `tpl_process_id` no `proc_instances`
- Chama `populate_process_tasks()` para criar as tarefas do template
- Chama `autoCompleteTasks()` para completar automaticamente tarefas UPLOAD com documentos existentes
- Chama `recalculateProgress()` para calcular percentagem
- Retorna `template_name` na resposta para feedback

---

## 6. Ficheiro #3 — `components/processes/process-review-section.tsx` (MODIFICAR)

**Caminho:** `components/processes/process-review-section.tsx`

**Problema:** O botao "Aprovar Processo" nao permite seleccionar um template. Clica e aprova directamente.

**Alteracao:** Adicionar um Select de templates activos. O botao "Aprovar" so fica habilitado quando um template e seleccionado. A assinatura de `onApprove` muda para receber o `tpl_process_id`.

**Conteudo completo apos modificacao:**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Check, X, Undo2, AlertCircle, FileStack, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ProcessInstance, ProcessOwner, ProcessDocument } from '@/types/process'

interface TemplateOption {
  id: string
  name: string
  description: string | null
  stages_count: number
  tasks_count: number
}

interface ProcessReviewSectionProps {
  process: ProcessInstance
  property: ProcessInstance['property']
  owners: ProcessOwner[]
  documents: ProcessDocument[]
  onApprove: (tplProcessId: string) => Promise<void>
  onReturn: (reason: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

export function ProcessReviewSection({
  process,
  property,
  owners,
  documents,
  onApprove,
  onReturn,
  onReject,
}: ProcessReviewSectionProps) {
  const [returnDialogOpen, setReturnDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Estado do template
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)

  // Carregar templates activos ao montar
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Erro ao carregar templates')
      const data = await res.json()
      // Filtrar apenas templates activos
      const activeTemplates = data.filter((t: TemplateOption) => t.is_active !== false)
      setTemplates(activeTemplates)

      // Se so houver 1 template activo, pre-seleccionar
      if (activeTemplates.length === 1) {
        setSelectedTemplateId(activeTemplates[0].id)
      }
    } catch (error) {
      console.error('Erro ao carregar templates:', error)
      setTemplates([])
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId)

  const handleApproveClick = async () => {
    if (!selectedTemplateId) return

    setIsProcessing(true)
    try {
      await onApprove(selectedTemplateId)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturnSubmit = async () => {
    if (returnReason.length < 10) {
      return
    }

    setIsProcessing(true)
    try {
      await onReturn(returnReason)
      setReturnDialogOpen(false)
      setReturnReason('')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectSubmit = async () => {
    if (rejectReason.length < 10) {
      return
    }

    setIsProcessing(true)
    try {
      await onReject(rejectReason)
      setRejectDialogOpen(false)
      setRejectReason('')
    } finally {
      setIsProcessing(false)
    }
  }

  const isReturned = process.current_status === 'returned'

  return (
    <>
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            {isReturned ? 'Processo Devolvido' : 'Aguarda Aprovacao'}
          </CardTitle>
          <CardDescription>
            {isReturned
              ? 'Este processo foi devolvido e aguarda correccoes'
              : 'Reveja as informacoes, seleccione o template e aprove ou devolva o processo'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isReturned && process.returned_reason && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Motivo da devolucao:</strong>
                <p className="mt-1">{process.returned_reason}</p>
              </AlertDescription>
            </Alert>
          )}

          {/* Seleccao de Template */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileStack className="h-4 w-4" />
              Template de Processo *
            </Label>
            {isLoadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                A carregar templates...
              </div>
            ) : templates.length === 0 ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum template de processo activo encontrado.
                  Crie um template antes de aprovar.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar template de processo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <div className="flex items-center gap-2">
                          <span>{tpl.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({tpl.stages_count} fases, {tpl.tasks_count} tarefas)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Info do template seleccionado */}
                {selectedTemplate && selectedTemplate.description && (
                  <p className="text-xs text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Botoes de accao */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleApproveClick}
              disabled={isProcessing || !selectedTemplateId || templates.length === 0}
              className="flex-1 min-w-[120px]"
            >
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Aprovar Processo
            </Button>

            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(true)}
              disabled={isProcessing}
              className="flex-1 min-w-[120px]"
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Devolver
            </Button>

            {!isReturned && (
              <Button
                variant="destructive"
                onClick={() => setRejectDialogOpen(true)}
                disabled={isProcessing}
                className="flex-1 min-w-[120px]"
              >
                <X className="mr-2 h-4 w-4" />
                Rejeitar
              </Button>
            )}
          </div>

          <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
            <p><strong>Consultor:</strong> {process.requested_by_user?.commercial_name || '—'}</p>
            {process.started_at && (
              <p><strong>Data de Inicio:</strong> {new Date(process.started_at).toLocaleDateString('pt-PT')}</p>
            )}
            {owners?.length > 0 && (
              <p><strong>Proprietarios:</strong> {owners.length}</p>
            )}
            {documents?.length > 0 && (
              <p><strong>Documentos:</strong> {documents.length} anexado{documents.length > 1 ? 's' : ''}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Devolucao */}
      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver Processo</DialogTitle>
            <DialogDescription>
              Indique o motivo da devolucao (minimo 10 caracteres)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Falta caderneta predial, documentos de identificacao..."
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReturnSubmit}
              disabled={isProcessing || returnReason.length < 10}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              Devolver Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Rejeicao */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Processo</DialogTitle>
            <DialogDescription>
              Esta accao e irreversivel. Indique o motivo da rejeicao (minimo 10 caracteres)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ex: Imovel nao cumpre requisitos, documentacao irregular..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectSubmit}
              disabled={isProcessing || rejectReason.length < 10}
            >
              <X className="mr-2 h-4 w-4" />
              Rejeitar Processo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**O que muda em relacao ao actual:**

1. **Novos imports:** `useEffect`, `Label`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue`, `FileStack`, `Loader2`
2. **Interface `TemplateOption`** — tipo para os templates carregados da API
3. **Assinatura de `onApprove`** — agora recebe `(tplProcessId: string)` em vez de `()`
4. **Estado do template:** `templates`, `selectedTemplateId`, `isLoadingTemplates`
5. **`useEffect`** — carrega templates activos via `GET /api/templates` ao montar o componente
6. **Pre-seleccao** — se so existe 1 template activo, e pre-seleccionado automaticamente
7. **Select de template** — dropdown com nome, contagem de fases/tarefas, descricao
8. **Botao "Aprovar" desabilitado** — ate um template ser seleccionado
9. **Alerta** — se nao existem templates activos, mostra mensagem de erro
10. **Spinner** — no botao de aprovar durante processamento

---

## 7. Ficheiro #4 — `app/(dashboard)/processos/[id]/page.tsx` (MODIFICAR)

**Caminho:** `app/(dashboard)/processos/[id]/page.tsx`

**Problema:** O `handleApprove` (linhas 47-63) nao envia body na requisicao — apenas faz `PUT` sem dados.

**Alteracao:** Modificar `handleApprove` para aceitar `tplProcessId` e envia-lo no body.

### Antes (linhas 47-63):

```typescript
const handleApprove = async () => {
  try {
    const response = await fetch(`/api/processes/${params.id}/approve`, {
      method: 'PUT',
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao aprovar processo')
    }

    toast.success('Processo aprovado com sucesso!')
    loadProcess()
  } catch (error: any) {
    toast.error(error.message)
  }
}
```

### Depois:

```typescript
const handleApprove = async (tplProcessId: string) => {
  try {
    const response = await fetch(`/api/processes/${params.id}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tpl_process_id: tplProcessId }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Erro ao aprovar processo')
    }

    const result = await response.json()
    toast.success(
      result.template_name
        ? `Processo aprovado com template "${result.template_name}"!`
        : 'Processo aprovado com sucesso!'
    )
    loadProcess()
  } catch (error: any) {
    toast.error(error.message)
  }
}
```

**O que muda:**
- `handleApprove` agora recebe `tplProcessId: string` como parametro
- Envia body JSON com `{ tpl_process_id: tplProcessId }`
- Adiciona header `Content-Type: application/json`
- Toast de sucesso inclui o nome do template (se retornado pela API)
- O JSX que renderiza `<ProcessReviewSection>` nao precisa de alteracao — o `onApprove={handleApprove}` ja passa a funcao correctamente, e a assinatura e compativel com a nova prop `onApprove: (tplProcessId: string) => Promise<void>`

---

## 8. Impacto nos Dados Existentes

### Processos existentes na base de dados:

| external_ref | tpl_process_id | current_status | Accao necessaria |
|---|---|---|---|
| PROC-2026-0005 | `0d84bb5e-...` (processo de venda normal) | `active` | **Nenhuma** — ja aprovado, ja tem tarefas |
| PROC-2026-0004 | `0d84bb5e-...` (processo de venda normal) | `pending_approval` | **Atentar** — ja tem template e tarefas. Na proxima aprovacao, sera solicitado template de novo |

O PROC-2026-0004 ja tem tarefas populadas. Quando o aprovador seleccionar um template e aprovar:
- O API detecta que `proc.tpl_process_id` ja existe
- Apaga as tarefas antigas (`proc_tasks`)
- Repopula com o template seleccionado
- Isto garante consistencia mesmo com dados legados

**Nao e necessaria nenhuma migracao para limpar dados existentes.**

---

## 9. Cenarios a Considerar

### Cenario 1: Aprovacao normal (fluxo principal)
1. Consultor cria angariacao → `proc_instances` criado com `tpl_process_id = null`
2. Aprovador abre processo → ve Select de templates
3. Selecciona template → clica "Aprovar"
4. API: define `tpl_process_id`, popula tarefas, autoComplete, recalculate
5. Processo fica `active` com tarefas

### Cenario 2: Re-aprovacao apos devolucao
1. Aprovador devolve processo → status `returned`
2. Consultor corrige e reenvia
3. Aprovador abre processo → ve Select de templates (pode mudar template)
4. Selecciona template (possivelmente diferente) → clica "Aprovar"
5. API: apaga tarefas antigas (se existiam), define novo `tpl_process_id`, repopula

### Cenario 3: Processo legado (ja tem template e tarefas)
1. PROC-2026-0004 ja tem `tpl_process_id` e tarefas
2. Aprovador abre → ve Select (nenhum pre-seleccionado)
3. Selecciona template → clica "Aprovar"
4. API: detecta `proc.tpl_process_id` existente → apaga tarefas → repopula

### Cenario 4: Apenas 1 template activo
1. So existe 1 template activo
2. Select pre-selecciona automaticamente
3. Aprovador pode aprovar imediatamente (sem accao extra)

### Cenario 5: Nenhum template activo
1. Nao existem templates activos
2. Alert de erro aparece no lugar do Select
3. Botao "Aprovar" fica desabilitado
4. Aprovador precisa criar template primeiro (via "Gerir Templates")

---

## 10. Resumo de Alteracoes

| # | Ficheiro | Linhas Afectadas | Tipo |
|---|----------|------------------|------|
| 1 | `app/api/acquisitions/route.ts` | 200-256 | Remover 56 linhas, substituir por ~15 |
| 2 | `app/api/processes/[id]/approve/route.ts` | Ficheiro completo (112 linhas) | Substituir por ~170 linhas |
| 3 | `components/processes/process-review-section.tsx` | Ficheiro completo (230 linhas) | Substituir por ~260 linhas |
| 4 | `app/(dashboard)/processos/[id]/page.tsx` | Linhas 47-63 | Modificar funcao handleApprove |

**Total:** 4 ficheiros modificados, 0 ficheiros criados, 0 migracoes.

---

## 11. Criterios de Sucesso

### Automatizados
- [ ] `npm run build` — sem erros de TypeScript
- [ ] `POST /api/acquisitions` — cria processo SEM template (tpl_process_id = null)
- [ ] `PUT /api/processes/[id]/approve` sem body — retorna 400 (template obrigatorio)
- [ ] `PUT /api/processes/[id]/approve` com `tpl_process_id` invalido — retorna 404
- [ ] `PUT /api/processes/[id]/approve` com template inactivo — retorna 400
- [ ] `PUT /api/processes/[id]/approve` com template valido — retorna 200, processo fica active

### Manuais
- [ ] Pagina de detalhe de processo `pending_approval` mostra Select de templates
- [ ] Select lista apenas templates activos com contagem de fases/tarefas
- [ ] Se so existe 1 template, e pre-seleccionado automaticamente
- [ ] Se nao existem templates activos, mostra mensagem de erro e botao "Aprovar" desabilitado
- [ ] Ao seleccionar template e clicar "Aprovar", processo muda para `active`
- [ ] Tarefas sao populadas correctamente apos aprovacao
- [ ] Barra de progresso actualiza apos aprovacao
- [ ] Stepper mostra fases do template seleccionado
- [ ] Tarefas UPLOAD com documentos existentes sao auto-completadas
- [ ] Toast de sucesso mostra nome do template seleccionado
- [ ] Devolucao e rejeicao continuam a funcionar normalmente (sem alteracoes)
- [ ] Processos ja activos (PROC-2026-0005) nao sao afectados

---

## 12. Ordem de Execucao

```
1. Modificar app/api/acquisitions/route.ts (remover logica de template/tarefas)
2. Modificar app/api/processes/[id]/approve/route.ts (adicionar logica completa)
3. Modificar components/processes/process-review-section.tsx (adicionar Select)
4. Modificar app/(dashboard)/processos/[id]/page.tsx (handleApprove com parametro)
5. Verificacao: npm run build
6. Teste manual: criar angariacao → aprovar com template → verificar tarefas
```
