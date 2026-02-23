# SPEC — Redesign da Página de Detalhe de Processo (Kanban + Lista)

**Data:** 2026-02-23
**Tipo:** Redesign / Melhoria
**Prioridade:** Alta
**Dependências:** M06 (Processos), M07 (Templates)

---

## 1. Resumo

Redesenhar a página de detalhe de processo (`/dashboard/processos/[id]`) para suportar duas vistas: **Kanban** (principal) e **Lista**, com tarefas clicáveis, prioridade visual, filtros, e barra de progresso global. O drawer de detalhe da tarefa **não** faz parte desta spec — será tratado separadamente.

---

## 2. Migrações Aplicadas

Duas migrações já foram aplicadas ao Supabase:

| # | Migration | Descrição |
|---|-----------|-----------|
| 1 | `add_priority_and_timestamps_to_tasks` | `priority` em `tpl_tasks` + `proc_tasks` (enum: `urgent`/`normal`/`low`), `started_at` e `created_at` em `proc_tasks` |
| 2 | `update_populate_process_tasks_with_priority` | Trigger `populate_process_tasks` actualizada para copiar `priority` do template |

### Novos Campos

**`tpl_tasks`:**
```
priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low'))
```

**`proc_tasks`:**
```
priority    text NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low'))
started_at  timestamptz
created_at  timestamptz DEFAULT now()
```

---

## 3. Arquitectura da Página

### 3.1 Estrutura da Página

```
┌─────────────────────────────────────────────────────────┐
│ ← PROC-2026-0006   [● Em Andamento]                    │
│ Apartamento de Verão · Alcochete · 700 000 €            │
├─────────────────────────────────────────────────────────┤
│ Progresso Global ████████░░░░░░░ 35%                    │
│ ✅ 5 concluídas  ⏳ 22 pendentes  🔴 2 em atraso       │
│                                                         │
│ [Estado ▾]  [Prioridade ▾]  [Responsável ▾]  [≡] [⊞]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Vista Kanban (colunas por estágio)                     │
│  OU                                                     │
│  Vista Lista (agrupada por estágio)                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Vistas Disponíveis

| Vista | Descrição | Quando usar |
|-------|-----------|-------------|
| **Kanban** (default) | Colunas horizontais por estágio, cards de tarefa | Visualização rápida do estado geral |
| **Lista** | Tabela agrupada por estágio, 1 linha por tarefa | Gestão detalhada, filtragem avançada |

### 3.3 Filtros (comuns a ambas as vistas)

| Filtro | Tipo | Opções |
|--------|------|--------|
| Estado | Select único | Todos, Pendente, Em Progresso, Concluída, Dispensada |
| Prioridade | Select único | Todas, Urgente, Normal, Baixa |
| Responsável | Select único | Todos, Sem atribuição, {lista de users} |

---

## 4. Componentes a Criar/Modificar

### 4.1 Mapa de Ficheiros

#### Ficheiros a CRIAR (3)

| # | Ficheiro | Função | Linhas est. |
|---|----------|--------|-------------|
| 1 | `components/processes/process-kanban-view.tsx` | Vista Kanban com colunas por estágio | ~200 |
| 2 | `components/processes/process-list-view.tsx` | Vista Lista agrupada por estágio | ~150 |
| 3 | `components/processes/process-task-card.tsx` | Card de tarefa reutilizado em ambas as vistas | ~120 |

#### Ficheiros a MODIFICAR (4)

| # | Ficheiro | Modificação | Complexidade |
|---|----------|-------------|-------------|
| 1 | `app/dashboard/processos/[id]/page.tsx` | Refactor completo: novo layout, toggle vistas, filtros | Complexo |
| 2 | `app/api/processes/[id]/route.ts` | Adicionar `priority`, `started_at`, `created_at`, owner join | Simples |
| 3 | `app/api/processes/[id]/tasks/[taskId]/route.ts` | Suportar `priority` update + `started_at` ao iniciar | Simples |
| 4 | `types/process.ts` | Adicionar campos `priority`, `started_at`, `created_at` | Simples |

#### Ficheiros a MANTER (sem alteração)

| Ficheiro | Razão |
|----------|-------|
| `process-review-section.tsx` | Funciona bem para `pending_approval`/`returned` |
| `process-stepper.tsx` | **Removido** desta página — substituído pela barra de progresso + vista kanban |
| `process-task-assign-dialog.tsx` | Reutilizado como está |
| `task-upload-action.tsx` | Reutilizado dentro do card de tarefa ou inline na lista |

#### Ficheiros OBSOLETOS (podem ser removidos mais tarde)

| Ficheiro | Razão |
|----------|-------|
| `process-tasks-section.tsx` | Substituído pelas novas vistas Kanban + Lista |

---

## 5. Detalhe dos Componentes

### 5.1 `process-task-card.tsx` — Card de Tarefa

Componente reutilizável para representar uma tarefa, usado tanto no Kanban como na Lista.

**Props:**

```typescript
interface ProcessTaskCardProps {
  task: ProcessTask
  variant: 'kanban' | 'list'
  onClick: (task: ProcessTask) => void
}
```

**Informação exibida:**

| Elemento | Kanban | Lista |
|----------|--------|-------|
| Ícone de status (✅ ▶ ○ ⛔) | ✅ | ✅ |
| Ícone de action_type (Upload/Mail/Manual) | ✅ | ✅ |
| Título da tarefa | ✅ | ✅ |
| Badge prioridade (flag colorida) | ✅ | ✅ |
| Badge "Obrigatória" | ✅ | ✅ |
| Badge proprietário (👤 nome ou 🏢 nome) | ✅ | ✅ |
| Prazo (com highlight se vencido) | ✅ | ✅ |
| Avatar do responsável | ✅ | ✅ |
| Badge de status textual | ❌ | ✅ |

**Cores de prioridade:**

```typescript
const PRIORITY_CONFIG = {
  urgent: { label: 'Urgente', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
  normal: { label: 'Normal', color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
  low:    { label: 'Baixa', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
}
```

**Ícone de prioridade:** Usar `Flag` do Lucide com a cor correspondente.

**Comportamento:**
- Hover: elevação sutil (`shadow-sm` → `shadow-md`)
- Click: chama `onClick(task)` — a página pai decide o que fazer (futuro drawer/dialog)
- Prazo vencido: data em `text-red-500 font-semibold`

**Estrutura Kanban:**

```tsx
<div className="bg-card rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow">
  {/* Row 1: icon status + título + flag prioridade */}
  <div className="flex items-start justify-between gap-2 mb-1.5">
    <div className="flex items-center gap-1.5">
      <StatusIcon status={task.status} />
      <span className="text-sm font-medium leading-tight">{task.title}</span>
    </div>
    <PriorityFlag priority={task.priority} />
  </div>

  {/* Row 2: owner badge (se existir) */}
  {task.owner && (
    <Badge variant="outline" className="text-xs gap-1 mb-1.5">
      {task.owner.person_type === 'coletiva' ? <Building2 /> : <User />}
      {task.owner.name}
    </Badge>
  )}

  {/* Row 3: mandatory + prazo + avatar */}
  <div className="flex items-center justify-between mt-2">
    <div className="flex items-center gap-1.5">
      {task.is_mandatory && (
        <Badge variant="secondary" className="text-[10px] px-1.5">Obrig.</Badge>
      )}
      {task.due_date && (
        <span className={cn("text-xs flex items-center gap-1",
          isOverdue(task) ? "text-red-500 font-semibold" : "text-muted-foreground"
        )}>
          <Calendar className="h-3 w-3" />
          {formatShortDate(task.due_date)}
        </span>
      )}
    </div>
    <UserAvatar name={task.assigned_to_user?.commercial_name} size="sm" />
  </div>
</div>
```

### 5.2 `process-kanban-view.tsx` — Vista Kanban

**Props:**

```typescript
interface ProcessKanbanViewProps {
  stages: ProcessStageWithTasks[]
  onTaskClick: (task: ProcessTask) => void
}
```

**Estrutura:**

```tsx
<div className="flex gap-3 overflow-x-auto pb-4">
  {stages.map((stage, index) => (
    <KanbanColumn key={stage.name} stage={stage} colorIndex={index} onTaskClick={onTaskClick} />
  ))}
</div>
```

**Cada coluna (`KanbanColumn`):**

```tsx
<div className="min-w-[280px] max-w-[320px] flex-1 flex flex-col rounded-xl border bg-muted/30"
     style={{ maxHeight: 'calc(100vh - 260px)' }}>
  {/* Header com cor accent */}
  <div className="p-3 border-b" style={{ backgroundColor: stageColor.headerBg }}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stageColor.accent }} />
        <span className="text-sm font-semibold">{stage.name}</span>
      </div>
      <Badge variant="outline" className="text-xs">
        {stats.completed}/{stats.total}
      </Badge>
    </div>
    {/* Progress bar */}
    <Progress value={stats.pct} className="h-1" />
  </div>

  {/* Lista de tarefas (scrollable) */}
  <ScrollArea className="flex-1 p-2">
    <div className="space-y-1.5">
      {stage.tasks.map(task => (
        <ProcessTaskCard key={task.id} task={task} variant="kanban" onClick={onTaskClick} />
      ))}
    </div>
  </ScrollArea>
</div>
```

**Cores por estágio (6 cores cíclicas):**

```typescript
const STAGE_COLORS = [
  { accent: '#6366f1', headerBg: 'rgba(99,102,241,0.06)' },   // Indigo
  { accent: '#0ea5e9', headerBg: 'rgba(14,165,233,0.06)' },   // Sky
  { accent: '#8b5cf6', headerBg: 'rgba(139,92,246,0.06)' },   // Violet
  { accent: '#f59e0b', headerBg: 'rgba(245,158,11,0.06)' },   // Amber
  { accent: '#10b981', headerBg: 'rgba(16,185,129,0.06)' },   // Emerald
  { accent: '#ec4899', headerBg: 'rgba(236,72,153,0.06)' },   // Pink
]
```

### 5.3 `process-list-view.tsx` — Vista Lista

**Props:**

```typescript
interface ProcessListViewProps {
  stages: ProcessStageWithTasks[]
  onTaskClick: (task: ProcessTask) => void
}
```

**Estrutura:** Collapsible por estágio, usando shadcn `Collapsible`.

```tsx
<div className="space-y-1 bg-card rounded-xl border">
  {stages.map((stage, index) => (
    <Collapsible key={stage.name} defaultOpen>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 rounded-lg">
          <ChevronRight className="h-4 w-4 transition-transform" />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stageColor.accent }} />
          <span className="text-sm font-semibold flex-1 text-left">{stage.name}</span>
          <span className="text-xs text-muted-foreground">{stats.completed}/{stats.total}</span>
          <Progress value={stats.pct} className="h-1 w-16" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {stage.tasks.map(task => (
          <ProcessTaskCard key={task.id} task={task} variant="list" onClick={onTaskClick} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  ))}
</div>
```

**Variante `list` do card:** Uma linha horizontal compacta:

```tsx
<div className="flex items-center gap-3 px-4 py-2 pl-10 hover:bg-accent/30 cursor-pointer rounded-md">
  <StatusIcon status={task.status} className="shrink-0" />
  <ActionTypeIcon type={task.action_type} className="shrink-0" />
  <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
  {task.owner && <OwnerBadge owner={task.owner} />}
  {task.is_mandatory && <Badge variant="secondary" className="text-[10px]">Obrig.</Badge>}
  <PriorityFlag priority={task.priority} />
  {task.due_date && <DueDateLabel date={task.due_date} status={task.status} />}
  <UserAvatar name={task.assigned_to_user?.commercial_name} size="sm" />
  <StatusBadge status={task.status} type="task" showDot={false} />
</div>
```

### 5.4 `page.tsx` — Refactor da Página de Detalhe

**Estrutura reorganizada:**

```tsx
export default function ProcessoDetailPage() {
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')

  // ... load process data ...

  // Filtrar tarefas dentro dos stages
  const filteredStages = useMemo(() => {
    return stages.map(stage => ({
      ...stage,
      tasks: stage.tasks.filter(task => {
        if (filterStatus !== 'all' && task.status !== filterStatus) return false
        if (filterPriority !== 'all' && task.priority !== filterPriority) return false
        if (filterAssignee === 'unassigned' && task.assigned_to) return false
        if (filterAssignee !== 'all' && filterAssignee !== 'unassigned' && task.assigned_to !== filterAssignee) return false
        return true
      })
    })).filter(stage => stage.tasks.length > 0)
  }, [stages, filterStatus, filterPriority, filterAssignee])

  // Stats globais (calculados sobre stages originais, não filtrados)
  const stats = useMemo(() => {
    const all = stages.flatMap(s => s.tasks)
    return {
      total: all.length,
      completed: all.filter(t => t.status === 'completed').length,
      pending: all.filter(t => t.status === 'pending').length,
      inProgress: all.filter(t => t.status === 'in_progress').length,
      overdue: all.filter(t => !['completed','skipped'].includes(t.status) && isOverdue(t.due_date)).length,
      pct: instance.percent_complete || 0,
    }
  }, [stages, instance])

  return (
    <div className="space-y-4">
      {/* === HEADER === */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/processos">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{instance.external_ref}</h1>
            <StatusBadge status={instance.current_status} type="process" />
          </div>
          <p className="text-sm text-muted-foreground">
            {property?.title} · {property?.city} · {formatCurrency(property?.listing_price)}
          </p>
        </div>
      </div>

      {/* === REVIEW SECTION (pending_approval / returned) === */}
      {['pending_approval', 'returned'].includes(instance.current_status) && (
        <ProcessReviewSection ... />
      )}

      {/* === PROGRESS + STATS + FILTERS + VIEW TOGGLE === */}
      {['active', 'on_hold', 'completed'].includes(instance.current_status) && (
        <>
          <Card>
            <CardContent className="py-4 space-y-3">
              {/* Row 1: Progress bar */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">Progresso Global</span>
                    <span className="font-bold text-primary">{stats.pct}%</span>
                  </div>
                  <Progress value={stats.pct} className="h-1.5" />
                </div>
                <div className="flex gap-4 text-sm">
                  <span><strong className="text-emerald-600">{stats.completed}</strong> concluídas</span>
                  <span><strong>{stats.pending + stats.inProgress}</strong> pendentes</span>
                  {stats.overdue > 0 && (
                    <span className="text-red-500 font-semibold">{stats.overdue} em atraso</span>
                  )}
                </div>
              </div>

              {/* Row 2: Filters + View Toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filtro Estado */}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os estados</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="in_progress">Em Progresso</SelectItem>
                    <SelectItem value="completed">Concluídas</SelectItem>
                    <SelectItem value="skipped">Dispensadas</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro Prioridade */}
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas prioridades</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Baixa</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro Responsável */}
                <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="Responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="unassigned">Sem atribuição</SelectItem>
                    {/* Dinâmico: users únicos das tarefas */}
                  </SelectContent>
                </Select>

                <div className="ml-auto" />

                {/* View Toggle (ToggleGroup shadcn) */}
                <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v)}>
                  <ToggleGroupItem value="kanban" size="sm">
                    <LayoutGrid className="h-4 w-4 mr-1" /> Kanban
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" size="sm">
                    <List className="h-4 w-4 mr-1" /> Lista
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardContent>
          </Card>

          {/* === CONTENT VIEW === */}
          {view === 'kanban' ? (
            <ProcessKanbanView
              stages={filteredStages}
              onTaskClick={handleTaskClick}
            />
          ) : (
            <ProcessListView
              stages={filteredStages}
              onTaskClick={handleTaskClick}
            />
          )}
        </>
      )}

      {/* === INFO CARDS (Imóvel + Localização + Proprietários) === */}
      {/* Mover para baixo ou para um tab/collapsible */}
      ...
    </div>
  )
}
```

---

## 6. Alterações na API

### 6.1 `GET /api/processes/[id]` — Adicionar campos

Na query de `proc_tasks`, adicionar os novos campos e o join a `owners`:

```typescript
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`
    *,
    assigned_to_user:users!proc_tasks_assigned_to_fkey (id, commercial_name),
    owner:owners!proc_tasks_owner_id_fkey (id, name, person_type)
  `)
  .eq('proc_instance_id', processId)
  .order('stage_order_index')
  .order('order_index')
```

**Campos novos que já estão no `*`:** `priority`, `started_at`, `created_at`, `owner_id`

O join a `owner` resolve o nome e tipo para o badge de proprietário.

### 6.2 `PUT /api/processes/[id]/tasks/[taskId]` — Novos actions

Adicionar suporte para:

**Action `start` — gravar `started_at`:**

```typescript
case 'start':
  await supabase.from('proc_tasks').update({
    status: 'in_progress',
    started_at: new Date().toISOString(),
  }).eq('id', taskId)
  break
```

**Action `update_priority` — alterar prioridade:**

```typescript
case 'update_priority':
  const { priority } = body
  if (!['urgent', 'normal', 'low'].includes(priority)) {
    return NextResponse.json({ error: 'Prioridade inválida' }, { status: 400 })
  }
  await supabase.from('proc_tasks').update({ priority }).eq('id', taskId)
  break
```

**Action `update_due_date` — alterar prazo:**

```typescript
case 'update_due_date':
  await supabase.from('proc_tasks').update({
    due_date: body.due_date || null
  }).eq('id', taskId)
  break
```

---

## 7. Tipos TypeScript

### `types/process.ts` — Adicionar campos

```typescript
export interface ProcessTask {
  id: string
  proc_instance_id: string
  tpl_task_id: string | null
  title: string
  action_type: ActionType
  config: Record<string, any>
  status: TaskStatus
  is_mandatory: boolean
  is_bypassed: boolean
  bypass_reason: string | null
  assigned_to: string | null
  assigned_role: string | null
  due_date: string | null
  completed_at: string | null
  started_at: string | null         // ← NOVO
  created_at: string | null         // ← NOVO
  priority: TaskPriority            // ← NOVO
  owner_id: string | null           // ← NOVO (já adicionado antes)
  owner?: {                         // ← NOVO (join)
    id: string
    name: string
    person_type: 'singular' | 'coletiva'
  }
  task_result: Record<string, any>
  stage_name: string
  stage_order_index: number
  order_index: number
  assigned_to_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export type TaskPriority = 'urgent' | 'normal' | 'low'
```

### `lib/constants.ts` — Labels PT-PT

```typescript
export const TASK_PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Urgente',
  normal: 'Normal',
  low: 'Baixa',
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  in_progress: 'Em Progresso',
  completed: 'Concluída',
  skipped: 'Dispensada',
}

export const ACTION_TYPE_LABELS: Record<string, string> = {
  UPLOAD: 'Upload Documento',
  EMAIL: 'Envio de Email',
  GENERATE_DOC: 'Gerar Documento',
  MANUAL: 'Tarefa Manual',
}
```

---

## 8. Componentes shadcn/ui Necessários

Verificar se estão instalados antes de implementar:

```bash
# Provavelmente já instalados:
npx shadcn@latest add progress         # Barra de progresso
npx shadcn@latest add select           # Filtros
npx shadcn@latest add scroll-area      # Scroll nas colunas kanban
npx shadcn@latest add collapsible      # Agrupamento na lista
npx shadcn@latest add toggle-group     # Switch kanban/lista
npx shadcn@latest add badge            # Já instalado
npx shadcn@latest add avatar           # Já instalado
```

---

## 9. Interacção com o Click na Tarefa

Como o drawer **não** faz parte desta spec, o `onTaskClick` deve ter uma implementação temporária:

```typescript
const handleTaskClick = (task: ProcessTask) => {
  // TEMPORÁRIO: até o drawer ser implementado,
  // abrir o dropdown de acções ou um toast informativo
  console.log('Task clicked:', task.id, task.title)
  // Futuro: setSelectedTask(task) → abrir drawer
}
```

**Acções que devem continuar a funcionar** (via dropdown `...` em cada tarefa):
- Iniciar tarefa
- Marcar como Concluída
- Dispensar (com motivo)
- Atribuir a Utilizador
- Reactivar

O dropdown `MoreHorizontal` deve estar presente em **ambas** as vistas (Kanban e Lista).

---

## 10. Template Builder — Prioridade

No builder de templates (`components/templates/template-task-dialog.tsx`), adicionar campo de prioridade default:

```tsx
<div className="space-y-2">
  <Label>Prioridade</Label>
  <Select value={priority} onValueChange={setPriority}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="urgent">🔴 Urgente</SelectItem>
      <SelectItem value="normal">🟡 Normal</SelectItem>
      <SelectItem value="low">⚪ Baixa</SelectItem>
    </SelectContent>
  </Select>
</div>
```

E no `POST/PUT /api/templates`, incluir `priority` nas tarefas.

---

## 11. Ordem de Implementação

```
1. types/process.ts                    — adicionar TaskPriority, novos campos
2. lib/constants.ts                    — labels PT-PT
3. app/api/processes/[id]/route.ts     — join owner, novos campos
4. app/api/processes/[id]/tasks/[taskId]/route.ts — novos actions
5. Instalar componentes shadcn em falta (toggle-group, collapsible, scroll-area)
6. components/processes/process-task-card.tsx    — CRIAR
7. components/processes/process-kanban-view.tsx  — CRIAR
8. components/processes/process-list-view.tsx    — CRIAR
9. app/dashboard/processos/[id]/page.tsx        — REFACTOR
10. components/templates/template-task-dialog.tsx — adicionar campo priority
11. npm run build — verificar zero erros
```

---

## 12. Critérios de Sucesso

### Vista Kanban

- [ ] 6 colunas visíveis (1 por estágio) com scroll horizontal
- [ ] Cada coluna mostra header com nome, contagem, barra de progresso
- [ ] Cards com: título, ícone status, flag prioridade, owner badge, prazo, avatar
- [ ] Prazo vencido em vermelho
- [ ] Scroll vertical dentro de cada coluna
- [ ] Sem drag-and-drop

### Vista Lista

- [ ] Agrupamento por estágio com collapsible
- [ ] 1 linha por tarefa com todos os dados visíveis
- [ ] Clicar no header do estágio colapsa/expande

### Filtros

- [ ] Filtro por estado funcional
- [ ] Filtro por prioridade funcional
- [ ] Filtro por responsável funcional (incluindo "Sem atribuição")
- [ ] Filtros afectam ambas as vistas simultaneamente
- [ ] Estágios vazios (após filtro) são ocultados

### Progresso Global

- [ ] Barra de progresso com percentagem
- [ ] Contadores: concluídas, pendentes, em atraso
- [ ] Valor de "em atraso" só aparece se > 0

### Toggle de Vista

- [ ] Switch entre Kanban e Lista sem perder filtros
- [ ] Vista Kanban é a default

### Labels PT-PT

- [ ] "Urgente", "Normal", "Baixa"
- [ ] "Pendente", "Em Progresso", "Concluída", "Dispensada"
- [ ] "Obrig." (abreviado)
- [ ] "em atraso"
- [ ] "concluídas", "pendentes"
- [ ] "Todos os estados", "Todas prioridades", "Sem atribuição"

### Build

- [ ] `npm run build` sem erros
