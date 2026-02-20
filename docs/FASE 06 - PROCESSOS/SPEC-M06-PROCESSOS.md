# SPEC — M06: Gestao de Processos (Instancias)

**Data:** 2026-02-20
**Baseado em:** PRD-M06-PROCESSOS.md
**Modulo:** M06 — Processos (Instancias)

---

## Indice

1. [Resumo das Alteracoes](#1-resumo-das-alteracoes)
2. [Fase A — Migracoes de Base de Dados](#2-fase-a--migracoes-de-base-de-dados)
3. [Fase B — Correcoes de Tipos TypeScript](#3-fase-b--correcoes-de-tipos-typescript)
4. [Fase C — Melhorias nos API Route Handlers](#4-fase-c--melhorias-nos-api-route-handlers)
5. [Fase D — Melhorias no Frontend (Listagem)](#5-fase-d--melhorias-no-frontend-listagem)
6. [Fase E — Melhorias no Frontend (Detalhe)](#6-fase-e--melhorias-no-frontend-detalhe)
7. [Fase F — Novos Componentes](#7-fase-f--novos-componentes)
8. [Fase G — Process Engine Melhorias](#8-fase-g--process-engine-melhorias)
9. [Fase H — Instalacao de Componentes shadcn/ui](#9-fase-h--instalacao-de-componentes-shadcnui)
10. [Ficheiros Modificados vs Criados (Resumo)](#10-ficheiros-modificados-vs-criados-resumo)
11. [Criterios de Sucesso](#11-criterios-de-sucesso)
12. [Fora de Escopo](#12-fora-de-escopo)

---

## 1. Resumo das Alteracoes

### O Que Ja Existe e Funciona
- Listagem de processos com search e cards de progresso
- Pagina de detalhe com stepper, review section, task management
- APIs completas: GET list, GET detail, PUT approve/return/reject, PUT task actions
- Process engine: autoCompleteTasks + recalculateProgress
- Tipos TypeScript, constantes PT-PT, StatusBadge

### O Que Precisa Ser Feito (8 gaps + 5 problemas tecnicos)

**Prioridade Alta:**
1. Migracoes DB: adicionar `returned_by`, `rejected_by`, `order_index` em proc_tasks
2. Filtros por status na listagem (Select dropdown)
3. Pausa/reactivacao de processo (on_hold <-> active)
4. Atribuicao de tarefas a utilizadores (Select de user)

**Prioridade Media:**
5. Nome do consultor na listagem
6. Barra de progresso geral no detalhe
7. Documentos linkados em tarefas UPLOAD completadas
8. Substituir tipos `any` por tipos concretos

**Prioridade Baixa (fora de escopo imediato):**
- Supabase Realtime
- Timeline/historico
- Vista Kanban

---

## 2. Fase A — Migracoes de Base de Dados

### Ficheiro: MIGRACAO via Supabase MCP `apply_migration`

**Nome:** `add_proc_instances_audit_columns`

**Problema:** As colunas `returned_by` e `rejected_by` nao existem em `proc_instances`. O return handler ja tenta gravar `returned_by: user.id` (linha 90 de `app/api/processes/[id]/return/route.ts`) e o reject handler ja tenta gravar `rejected_by: user.id` (linha 90 de `app/api/processes/[id]/reject/route.ts`), mas as colunas nao existem no schema real — o Supabase simplesmente ignora colunas desconhecidas, causando perda silenciosa de dados de auditoria.

**SQL:**
```sql
-- Adicionar colunas de auditoria para returned_by e rejected_by
ALTER TABLE proc_instances
  ADD COLUMN IF NOT EXISTS returned_by uuid REFERENCES dev_users(id),
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES dev_users(id);

-- Comentarios de documentacao
COMMENT ON COLUMN proc_instances.returned_by IS 'UUID do utilizador que devolveu o processo';
COMMENT ON COLUMN proc_instances.rejected_by IS 'UUID do utilizador que rejeitou o processo';
```

---

### Ficheiro: MIGRACAO via Supabase MCP `apply_migration`

**Nome:** `add_proc_tasks_order_index`

**Problema:** A coluna `order_index` nao existe em `proc_tasks`. A API de detalhe (`app/api/processes/[id]/route.ts`, linha 58) ja faz `.order('order_index', { ascending: true })`, mas como a coluna nao existe, a ordenacao dentro de cada fase nao funciona — as tarefas aparecem numa ordem arbitraria.

**SQL:**
```sql
-- Adicionar order_index para manter a ordem das tarefas dentro de cada fase
ALTER TABLE proc_tasks
  ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;

-- Popular order_index nas tarefas existentes, baseando na ordem do template
UPDATE proc_tasks pt
SET order_index = COALESCE(
  (SELECT tt.order_index FROM tpl_tasks tt WHERE tt.id = pt.tpl_task_id),
  0
);

-- Comentario
COMMENT ON COLUMN proc_tasks.order_index IS 'Ordem da tarefa dentro da fase, copiada do template';
```

---

### Ficheiro: MIGRACAO via Supabase MCP `apply_migration`

**Nome:** `add_performance_indexes_proc`

**Problema:** Nao existem indexes de performance alem das PKs. Queries frequentes filtram por `proc_instance_id`, `current_status`, e `property_id`.

**SQL:**
```sql
-- Indexes para performance em queries frequentes
CREATE INDEX IF NOT EXISTS idx_proc_tasks_instance_id ON proc_tasks(proc_instance_id);
CREATE INDEX IF NOT EXISTS idx_proc_tasks_status ON proc_tasks(status);
CREATE INDEX IF NOT EXISTS idx_proc_instances_status ON proc_instances(current_status);
CREATE INDEX IF NOT EXISTS idx_proc_instances_property ON proc_instances(property_id);
```

---

### Ficheiro: MIGRACAO via Supabase MCP `apply_migration`

**Nome:** `update_populate_process_tasks_fn`

**Problema:** A funcao callable `populate_process_tasks(p_instance_id)` nao copia o `order_index` da `tpl_tasks` para `proc_tasks`. Quando criamos a nova coluna `order_index` em proc_tasks, precisamos que a funcao a popule.

**SQL:**
```sql
CREATE OR REPLACE FUNCTION public.populate_process_tasks(p_instance_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE v_tpl_process_id uuid;
BEGIN
    SELECT tpl_process_id INTO v_tpl_process_id
    FROM proc_instances WHERE id = p_instance_id;

    IF v_tpl_process_id IS NULL THEN
        RAISE EXCEPTION 'Instancia % nao encontrada ou sem template', p_instance_id;
    END IF;

    INSERT INTO proc_tasks (
        proc_instance_id, tpl_task_id, title, action_type, config,
        status, is_mandatory, assigned_role, due_date,
        stage_name, stage_order_index, order_index
    )
    SELECT
        p_instance_id, t.id, t.title, t.action_type, t.config,
        'pending', t.is_mandatory, t.assigned_role,
        CASE WHEN t.sla_days IS NOT NULL THEN NOW() + (t.sla_days * interval '1 day') ELSE NULL END,
        s.name, s.order_index, t.order_index
    FROM tpl_tasks t
    JOIN tpl_stages s ON t.tpl_stage_id = s.id
    WHERE s.tpl_process_id = v_tpl_process_id
    ORDER BY s.order_index, t.order_index;
END;
$function$;
```

---

## 3. Fase B — Correcoes de Tipos TypeScript

### Ficheiro a MODIFICAR: `types/process.ts`

**Caminho:** `types/process.ts`

**Problema:** Os tipos actuais nao incluem `returned_by`, `rejected_by`, `returned_by_user`, `rejected_by_user` no ProcessInstance. O ProcessDetail nao inclui tipos concretos para owners (usa `any[]`). O ProcessTask nao inclui `order_index`, `action_type`, `config`, `assigned_role`.

**Conteudo completo apos modificacao:**

```typescript
import type { Database } from './database'

type ProcInstance = Database['public']['Tables']['proc_instances']['Row']
type ProcTask = Database['public']['Tables']['proc_tasks']['Row']
type DevProperty = Database['public']['Tables']['dev_properties']['Row']
type DevUser = Database['public']['Tables']['dev_users']['Row']

export interface ProcessInstance extends ProcInstance {
  property?: Pick<
    DevProperty,
    'id' | 'title' | 'slug' | 'city' | 'listing_price' | 'status' | 'property_type'
  >
  requested_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  approved_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  returned_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
  rejected_by_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export interface ProcessTask extends ProcTask {
  assigned_to_user?: Pick<DevUser, 'id' | 'commercial_name'>
}

export interface ProcessStageWithTasks {
  name: string
  order_index: number
  status: 'completed' | 'in_progress' | 'pending'
  tasks_completed: number
  tasks_total: number
  tasks: ProcessTask[]
}

export interface ProcessOwner {
  id: string
  name: string
  nif: string | null
  person_type: 'singular' | 'coletiva'
  ownership_percentage: number
  is_main_contact: boolean
}

export interface ProcessDocument {
  id: string
  doc_type: { id: string; name: string; category: string }
  file_name: string
  file_url: string
  status: string
  created_at: string
}

export interface ProcessDetail {
  instance: ProcessInstance
  stages: ProcessStageWithTasks[] | null
  owners: ProcessOwner[]
  documents: ProcessDocument[]
}

export type ProcessStatus =
  | 'pending_approval'
  | 'returned'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'

export type TaskAction =
  | 'complete'
  | 'bypass'
  | 'assign'
  | 'start'
  | 'reset'

export type ActionType = 'UPLOAD' | 'EMAIL' | 'GENERATE_DOC' | 'MANUAL'
```

**O que muda:**
- Adicionados `returned_by_user` e `rejected_by_user` ao `ProcessInstance`
- Criada interface `ProcessOwner` concreta (substitui `any[]`)
- Criada interface `ProcessDocument` concreta (substitui `any[]`)
- Atualizado `ProcessDetail` para usar `ProcessOwner[]` e `ProcessDocument[]`
- Adicionado export `ActionType`

---

### Ficheiro a MODIFICAR: `types/database.ts`

**Caminho:** `types/database.ts`

**Accao:** Regenerar com `npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > types/database.ts` APOS as migracoes da Fase A. Isto garante que `ProcInstance` inclui `returned_by`, `rejected_by` e `ProcTask` inclui `order_index`.

---

## 4. Fase C — Melhorias nos API Route Handlers

### Ficheiro a MODIFICAR: `app/api/processes/route.ts`

**Caminho:** `app/api/processes/route.ts`

**Problema:** A listagem nao inclui o nome do consultor que submeteu (requested_by_user). O campo `requested_by` e retornado como UUID, mas a UI precisa do nome.

**Alteracao:** Adicionar join com `dev_users` para `requested_by`:

```typescript
// ANTES (linha 22-47):
let query = supabase
  .from('proc_instances')
  .select(`
    id,
    external_ref,
    current_status,
    percent_complete,
    started_at,
    updated_at,
    requested_by,
    approved_at,
    notes,
    dev_properties (...),
    tpl_processes (...)
  `)

// DEPOIS:
let query = supabase
  .from('proc_instances')
  .select(`
    id,
    external_ref,
    current_status,
    percent_complete,
    started_at,
    updated_at,
    requested_by,
    approved_at,
    notes,
    dev_properties (
      id,
      title,
      city,
      zone,
      business_type,
      listing_price,
      property_type,
      status
    ),
    tpl_processes (
      id,
      name
    ),
    requested_by_user:dev_users!proc_instances_requested_by_fkey(
      id,
      commercial_name
    )
  `)
  .order('updated_at', { ascending: false, nullsFirst: false })
```

**Alteracao adicional:** Expandir o filtro de search para incluir o nome do consultor:

```typescript
// ANTES (linha 68-74):
results = results.filter(
  (p: any) =>
    p.external_ref?.toLowerCase().includes(term) ||
    p.dev_properties?.title?.toLowerCase().includes(term) ||
    p.dev_properties?.city?.toLowerCase().includes(term)
)

// DEPOIS:
results = results.filter(
  (p: any) =>
    p.external_ref?.toLowerCase().includes(term) ||
    p.dev_properties?.title?.toLowerCase().includes(term) ||
    p.dev_properties?.city?.toLowerCase().includes(term) ||
    p.requested_by_user?.commercial_name?.toLowerCase().includes(term)
)
```

---

### Ficheiro a MODIFICAR: `app/api/processes/[id]/route.ts`

**Caminho:** `app/api/processes/[id]/route.ts`

**Problema 1:** Nao inclui `returned_by_user` e `rejected_by_user` no join.

**Alteracao no select principal (linhas 14-35):**

```typescript
// ANTES:
.select(`
  *,
  property:dev_properties(...),
  requested_by_user:dev_users!proc_instances_requested_by_fkey(id, commercial_name),
  approved_by_user:dev_users!proc_instances_approved_by_fkey(id, commercial_name)
`)

// DEPOIS:
.select(`
  *,
  property:dev_properties(
    id, title, slug, city, listing_price, status, property_type
  ),
  requested_by_user:dev_users!proc_instances_requested_by_fkey(
    id, commercial_name
  ),
  approved_by_user:dev_users!proc_instances_approved_by_fkey(
    id, commercial_name
  ),
  returned_by_user:dev_users!proc_instances_returned_by_fkey(
    id, commercial_name
  ),
  rejected_by_user:dev_users!proc_instances_rejected_by_fkey(
    id, commercial_name
  )
`)
```

**Problema 2:** Documentos nao incluem `doc_type.id`, necessario para cruzar com tarefas UPLOAD.

**Alteracao no select de documentos (linhas 119-133):**

```typescript
// ANTES:
.select(`
  id, file_name, file_url, status, created_at,
  doc_type:doc_types(name, category)
`)

// DEPOIS:
.select(`
  id, file_name, file_url, status, created_at,
  doc_type:doc_types(id, name, category)
`)
```

**Problema 3:** Owners nao incluem `existing_documents` (documentos ja associados ao owner na doc_registry).

**Adicionar apos obter owners (apos linha 116):**

```typescript
// Obter proprietarios
const { data: ownerData } = await supabase
  .from('property_owners')
  .select(`
    ownership_percentage,
    is_main_contact,
    owner:owners(id, name, nif, person_type)
  `)
  .eq('property_id', data.property?.id)

// Buscar documentos dos owners (para mostrar docs reutilizaveis)
const ownerIds = ownerData?.map((po: any) => po.owner?.id).filter(Boolean) || []
let ownerDocuments: any[] = []
if (ownerIds.length > 0) {
  const { data: ownerDocs } = await supabase
    .from('doc_registry')
    .select(`
      id, file_name, file_url, status, owner_id,
      doc_type:doc_types(id, name, category)
    `)
    .in('owner_id', ownerIds)
    .eq('status', 'active')

  ownerDocuments = ownerDocs || []
}

// Formatar owners com documentos existentes
const formattedOwners = ownerData?.map((po: any) => ({
  ...po.owner,
  ownership_percentage: po.ownership_percentage,
  is_main_contact: po.is_main_contact,
  existing_documents: ownerDocuments.filter((d: any) => d.owner_id === po.owner?.id),
})) || []
```

---

### Ficheiro a CRIAR: `app/api/processes/[id]/hold/route.ts`

**Caminho:** `app/api/processes/[id]/hold/route.ts`

**Funcao:** Pausar (on_hold) e reactivar (active) processos activos.

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const holdSchema = z.object({
  action: z.enum(['pause', 'resume']),
  reason: z.string().optional(),
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

    // Verificar permissoes
    const { data: devUser } = await supabase
      .from('dev_users')
      .select(`
        *,
        user_roles!user_roles_user_id_fkey!inner(
          role:roles(name)
        )
      `)
      .eq('id', user.id)
      .single()

    const roleName = (devUser as any)?.user_roles?.[0]?.role?.name
    const canHold = ['Broker/CEO', 'Gestora Processual'].includes(roleName)

    if (!canHold) {
      return NextResponse.json(
        { error: 'Sem permissao para pausar/reactivar processos' },
        { status: 403 }
      )
    }

    // Parse e validacao
    const body = await request.json()
    const validation = holdSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { action, reason } = validation.data

    // Verificar estado actual do processo
    const { data: proc, error: procError } = await supabase
      .from('proc_instances')
      .select('current_status')
      .eq('id', id)
      .single()

    if (procError || !proc) {
      return NextResponse.json(
        { error: 'Processo nao encontrado' },
        { status: 404 }
      )
    }

    if (action === 'pause') {
      if (proc.current_status !== 'active') {
        return NextResponse.json(
          { error: 'Apenas processos activos podem ser pausados' },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('proc_instances')
        .update({
          current_status: 'on_hold',
          notes: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Erro ao pausar processo', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Processo pausado com sucesso',
      })
    }

    if (action === 'resume') {
      if (proc.current_status !== 'on_hold') {
        return NextResponse.json(
          { error: 'Apenas processos pausados podem ser reactivados' },
          { status: 400 }
        )
      }

      const { error: updateError } = await supabase
        .from('proc_instances')
        .update({
          current_status: 'active',
          notes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json(
          { error: 'Erro ao reactivar processo', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Processo reactivado com sucesso',
      })
    }
  } catch (error) {
    console.error('Erro ao pausar/reactivar processo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
```

---

### Ficheiro a CRIAR: `app/api/users/consultants/route.ts`

**Caminho:** `app/api/users/consultants/route.ts`

**Funcao:** Endpoint leve para listar utilizadores activos (para o Select de atribuicao de tarefas).

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('dev_users')
      .select('id, commercial_name')
      .eq('is_active', true)
      .order('commercial_name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
```

---

## 5. Fase D — Melhorias no Frontend (Listagem)

### Ficheiro a MODIFICAR: `app/dashboard/processos/page.tsx`

**Caminho:** `app/dashboard/processos/page.tsx`

**Alteracoes necessarias:**

#### 1. Adicionar import do Select e do PROCESS_STATUS

```typescript
// Adicionar imports (no topo)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PROCESS_STATUS } from '@/lib/constants'
import { User } from 'lucide-react'
import type { ProcessStatus } from '@/types/process'
```

#### 2. Adicionar estado de filtro por status

```typescript
// Adicionar apos a declaracao de search (linha 21)
const [statusFilter, setStatusFilter] = useState<string>('')
```

#### 3. Atualizar loadProcesses para enviar status

```typescript
// Atualizar loadProcesses (linha 23-40)
const loadProcesses = useCallback(async () => {
  setIsLoading(true)
  try {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (statusFilter) params.set('status', statusFilter)

    const res = await fetch(`/api/processes?${params.toString()}`)
    if (!res.ok) throw new Error('Erro ao carregar processos')

    const data = await res.json()
    setProcesses(data)
  } catch (error) {
    console.error('Erro ao carregar processos:', error)
    setProcesses([])
  } finally {
    setIsLoading(false)
  }
}, [debouncedSearch, statusFilter])
```

#### 4. Adicionar dropdown de filtro por status na toolbar

Substituir o bloco `<div className="flex items-center gap-4">` (linhas 67-77):

```tsx
<div className="flex items-center gap-4">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Pesquisar por referencia, imovel, cidade ou consultor..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      className="pl-9"
    />
  </div>
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectTrigger className="w-[200px]">
      <SelectValue placeholder="Todos os estados" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos os estados</SelectItem>
      {Object.entries(PROCESS_STATUS).map(([key, config]) => (
        <SelectItem key={key} value={key}>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${config.dot}`} />
            {config.label}
          </div>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Nota:** Quando o utilizador selecciona "all", limpar o filtro:

```typescript
// Ajustar o onValueChange do Select:
onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}
```

#### 5. Adicionar nome do consultor nos cards

Dentro do card de cada processo, apos a info do imovel (linhas 130-144), adicionar:

```tsx
{/* Info do consultor */}
{proc.requested_by_user?.commercial_name && (
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <User className="h-3 w-3" />
    <span>{proc.requested_by_user.commercial_name}</span>
  </div>
)}
```

#### 6. Adicionar nome do template no card

Abaixo da referencia (`proc.external_ref`), adicionar:

```tsx
{proc.tpl_processes?.name && (
  <p className="text-xs text-muted-foreground">
    {proc.tpl_processes.name}
  </p>
)}
```

---

## 6. Fase E — Melhorias no Frontend (Detalhe)

### Ficheiro a MODIFICAR: `app/dashboard/processos/[id]/page.tsx`

**Caminho:** `app/dashboard/processos/[id]/page.tsx`

**Alteracoes necessarias:**

#### 1. Adicionar imports

```typescript
// Adicionar imports
import { Progress } from '@/components/ui/progress'
import { Pause, Play, Clock } from 'lucide-react'
import type { ProcessDetail } from '@/types/process'
```

#### 2. Substituir tipo `any` por `ProcessDetail`

```typescript
// ANTES (linha 20):
const [process, setProcess] = useState<any>(null)

// DEPOIS:
const [process, setProcess] = useState<ProcessDetail | null>(null)
```

#### 3. Adicionar handlers de pausa/reactivacao

Adicionar apos `handleReject` (apos linha 101):

```typescript
const handleHold = async (action: 'pause' | 'resume', reason?: string) => {
  try {
    const response = await fetch(`/api/processes/${params.id}/hold`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `Erro ao ${action === 'pause' ? 'pausar' : 'reactivar'} processo`)
    }

    toast.success(
      action === 'pause'
        ? 'Processo pausado com sucesso!'
        : 'Processo reactivado com sucesso!'
    )
    loadProcess()
  } catch (error: any) {
    toast.error(error.message)
  }
}
```

#### 4. Adicionar barra de progresso geral apos o header

Inserir entre o header e o stepper (apos linha 135):

```tsx
{/* Barra de Progresso Geral */}
<Card>
  <CardContent className="pt-6">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Progresso Geral</span>
      </div>
      <span className="text-sm font-semibold">{instance.percent_complete}%</span>
    </div>
    <Progress value={instance.percent_complete} className="h-3" />
    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
      <span>
        {instance.started_at ? `Iniciado: ${formatDate(instance.started_at)}` : 'Nao iniciado'}
      </span>
      {instance.completed_at && (
        <span>Concluido: {formatDate(instance.completed_at)}</span>
      )}
    </div>
  </CardContent>
</Card>
```

#### 5. Adicionar botoes de pausa/reactivacao

Inserir no header, apos o StatusBadge (linha 132):

```tsx
{/* Botoes de Pausa/Reactivacao */}
{instance.current_status === 'active' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => handleHold('pause')}
  >
    <Pause className="mr-2 h-4 w-4" />
    Pausar
  </Button>
)}
{instance.current_status === 'on_hold' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => handleHold('resume')}
  >
    <Play className="mr-2 h-4 w-4" />
    Reactivar
  </Button>
)}
```

#### 6. Adicionar info do consultor e aprovador nos cards de info

No card de "Imovel" (`CardContent`, apos linha 177), adicionar:

```tsx
{instance.requested_by_user && (
  <div className="flex justify-between">
    <span className="text-muted-foreground">Consultor</span>
    <span className="font-medium">{instance.requested_by_user.commercial_name}</span>
  </div>
)}
{instance.approved_by_user && (
  <div className="flex justify-between">
    <span className="text-muted-foreground">Aprovado por</span>
    <span className="font-medium">{instance.approved_by_user.commercial_name}</span>
  </div>
)}
```

#### 7. Exibir motivo de devolucao/rejeicao (fora da review section)

Adicionar apos os cards de info (apos linha 204), visivel quando `rejected` ou `returned`:

```tsx
{instance.current_status === 'rejected' && instance.rejected_reason && (
  <Card className="border-red-200 bg-red-50/50">
    <CardContent className="pt-6">
      <p className="text-sm font-medium text-red-800 mb-1">Motivo da Rejeicao:</p>
      <p className="text-sm text-red-700">{instance.rejected_reason}</p>
      {instance.rejected_by_user && (
        <p className="text-xs text-red-600 mt-2">
          Por: {instance.rejected_by_user.commercial_name} em {formatDate(instance.rejected_at)}
        </p>
      )}
    </CardContent>
  </Card>
)}

{instance.current_status === 'on_hold' && instance.notes && (
  <Card className="border-slate-200 bg-slate-50/50">
    <CardContent className="pt-6">
      <p className="text-sm font-medium text-slate-800 mb-1">Processo Pausado</p>
      <p className="text-sm text-slate-700">{instance.notes}</p>
    </CardContent>
  </Card>
)}
```

---

## 7. Fase F — Novos Componentes

### Ficheiro a CRIAR: `components/processes/process-task-assign-dialog.tsx`

**Caminho:** `components/processes/process-task-assign-dialog.tsx`

**Funcao:** Dialog para atribuir uma tarefa a um utilizador especifico.

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import { UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface User {
  id: string
  commercial_name: string
}

interface ProcessTaskAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskId: string
  taskTitle: string
  processId: string
  currentAssignedTo?: string | null
  onAssigned: () => void
}

export function ProcessTaskAssignDialog({
  open,
  onOpenChange,
  taskId,
  taskTitle,
  processId,
  currentAssignedTo,
  onAssigned,
}: ProcessTaskAssignDialogProps) {
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>(currentAssignedTo || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      loadUsers()
      setSelectedUserId(currentAssignedTo || '')
    }
  }, [open, currentAssignedTo])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/users/consultants')
      if (!res.ok) throw new Error('Erro ao carregar utilizadores')
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      toast.error('Erro ao carregar lista de utilizadores')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedUserId) return

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/processes/${processId}/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'assign',
            assigned_to: selectedUserId,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao atribuir tarefa')
      }

      toast.success('Tarefa atribuida com sucesso!')
      onOpenChange(false)
      onAssigned()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir Tarefa</DialogTitle>
          <DialogDescription>
            Seleccione o utilizador responsavel por esta tarefa
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm font-medium mb-3">{taskTitle}</p>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar utilizadores...
            </div>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar utilizador" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedUserId}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Ficheiro a MODIFICAR: `components/processes/process-tasks-section.tsx`

**Caminho:** `components/processes/process-tasks-section.tsx`

**Alteracoes necessarias:**

#### 1. Adicionar imports

```typescript
// Adicionar imports
import { ProcessTaskAssignDialog } from './process-task-assign-dialog'
import { UserPlus, ExternalLink } from 'lucide-react'
import type { ProcessStageWithTasks, ProcessTask } from '@/types/process'
```

#### 2. Tipar as props correctamente

```typescript
// ANTES (linhas 36-40):
interface ProcessTasksSectionProps {
  processId: string
  stages: any[]
  onTaskUpdate: () => void
}

// DEPOIS:
interface ProcessTasksSectionProps {
  processId: string
  stages: ProcessStageWithTasks[]
  processDocuments?: Array<{
    id: string
    doc_type: { id: string; name: string; category: string }
    file_name: string
    file_url: string
  }>
  onTaskUpdate: () => void
}
```

#### 3. Adicionar estado para dialog de atribuicao

```typescript
// Adicionar apos isProcessing (linha 50)
const [assignDialogOpen, setAssignDialogOpen] = useState(false)
const [assignTask, setAssignTask] = useState<ProcessTask | null>(null)
```

#### 4. Adicionar item "Atribuir" no DropdownMenu de cada tarefa

Dentro do `<DropdownMenuContent>`, apos o item "Iniciar" e antes do bloco de complete (apos linha 191):

```tsx
{/* Atribuir a utilizador */}
{['pending', 'in_progress'].includes(task.status) && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      onClick={() => {
        setAssignTask(task)
        setAssignDialogOpen(true)
      }}
    >
      <UserPlus className="mr-2 h-4 w-4" />
      Atribuir a Utilizador
    </DropdownMenuItem>
  </>
)}
```

#### 5. Mostrar utilizador atribuido em cada tarefa

Dentro de cada tarefa, apos `task.title` e a badge "Obrigatoria" (apos linha 168):

```tsx
{task.assigned_to_user && (
  <span className="text-xs text-muted-foreground">
    ({task.assigned_to_user.commercial_name})
  </span>
)}
```

#### 6. Mostrar link para documento em tarefas UPLOAD completadas

Apos o bloco de bypass_reason (apos linha 173):

```tsx
{/* Documento linkado em tarefas UPLOAD completadas */}
{task.action_type === 'UPLOAD' && task.status === 'completed' && task.task_result?.doc_registry_id && (
  <div className="flex items-center gap-1 mt-1">
    <ExternalLink className="h-3 w-3 text-emerald-600" />
    <span className="text-xs text-emerald-700">
      {task.task_result.auto_completed
        ? 'Documento auto-detectado'
        : 'Documento anexado'}
    </span>
  </div>
)}
```

#### 7. Renderizar o dialog de atribuicao

Antes do `</>` final do componente (apos o Dialog de bypass, antes de linha 279):

```tsx
{/* Dialog de Atribuicao */}
{assignTask && (
  <ProcessTaskAssignDialog
    open={assignDialogOpen}
    onOpenChange={setAssignDialogOpen}
    taskId={assignTask.id}
    taskTitle={assignTask.title}
    processId={processId}
    currentAssignedTo={assignTask.assigned_to}
    onAssigned={onTaskUpdate}
  />
)}
```

---

### Ficheiro a MODIFICAR: `components/processes/process-review-section.tsx`

**Caminho:** `components/processes/process-review-section.tsx`

**Alteracao:** Tipar as props correctamente.

```typescript
// ANTES (linhas 19-27):
interface ProcessReviewSectionProps {
  process: any
  property: any
  owners: any[]
  documents: any[]
  onApprove: () => Promise<void>
  onReturn: (reason: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

// DEPOIS:
import type { ProcessInstance, ProcessOwner, ProcessDocument } from '@/types/process'

interface ProcessReviewSectionProps {
  process: ProcessInstance
  property: ProcessInstance['property']
  owners: ProcessOwner[]
  documents: ProcessDocument[]
  onApprove: () => Promise<void>
  onReturn: (reason: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}
```

---

### Ficheiro a MODIFICAR: `components/processes/process-stepper.tsx`

**Caminho:** `components/processes/process-stepper.tsx`

**Problema:** O stepper nao e responsivo em ecras pequenos. As fases ficam sobrepostas em mobile.

**Alteracao:** Adicionar overflow-x-auto e min-width para suportar scroll horizontal:

```typescript
// ANTES (linha 13):
<ol className="flex items-center justify-between">

// DEPOIS:
<ol className="flex items-center justify-between overflow-x-auto pb-2 min-w-0 gap-2">
```

E no `<li>`:
```typescript
// ANTES (linha 21):
<li key={index} className="relative flex-1">

// DEPOIS:
<li key={index} className="relative flex-1 min-w-[100px]">
```

---

## 8. Fase G — Process Engine Melhorias

### Ficheiro a MODIFICAR: `lib/process-engine.ts`

**Caminho:** `lib/process-engine.ts`

**Problema:** A funcao `recalculateProgress` nao actualiza `current_stage_id` no `proc_instances`. Isto significa que o processo nao sabe em que fase esta — informacao necessaria para o stepper.

**Alteracao em `recalculateProgress`:** Adicionar logica para determinar e gravar a fase actual.

Substituir o bloco de updates (linhas 142-158):

```typescript
// 4. Determinar a fase actual (primeira fase nao-completa)
// Agrupar por stage para descobrir qual e a actual
const stageProgress = new Map<number, { total: number; completed: number }>()
for (const t of tasks) {
  const stageIdx = t.stage_order_index ?? 0
  if (!stageProgress.has(stageIdx)) {
    stageProgress.set(stageIdx, { total: 0, completed: 0 })
  }
  const sp = stageProgress.get(stageIdx)!
  sp.total++
  if (t.status === 'completed' || t.is_bypassed) {
    sp.completed++
  }
}

// Encontrar a primeira fase nao-completa
const sortedStages = Array.from(stageProgress.entries()).sort(([a], [b]) => a - b)
let currentStageIdx: number | null = null
for (const [idx, progress] of sortedStages) {
  if (progress.completed < progress.total) {
    currentStageIdx = idx
    break
  }
}

// 5. Verificar se esta completo
const isCompleted = percentComplete === 100

// 6. Buscar stage_id real da tpl_stages (se tivermos o index)
let currentStageId: string | null = null
if (currentStageIdx !== null && !isCompleted) {
  // Buscar o tpl_process_id da instancia
  const { data: inst } = await supabase
    .from('proc_instances')
    .select('tpl_process_id')
    .eq('id', procInstanceId)
    .single()

  if (inst?.tpl_process_id) {
    const { data: stage } = await supabase
      .from('tpl_stages')
      .select('id')
      .eq('tpl_process_id', inst.tpl_process_id)
      .eq('order_index', currentStageIdx)
      .single()

    currentStageId = stage?.id || null
  }
}

// 7. Atualizar processo
const updates: any = {
  percent_complete: percentComplete,
  current_stage_id: currentStageId,
  updated_at: new Date().toISOString(),
}

if (isCompleted) {
  updates.current_status = 'completed'
  updates.completed_at = new Date().toISOString()
}

const { error: updateError } = await supabase
  .from('proc_instances')
  .update(updates)
  .eq('id', procInstanceId)

if (updateError) throw updateError

return {
  percent_complete: percentComplete,
  current_stage_index: currentStageIdx,
  current_stage_id: currentStageId,
  is_completed: isCompleted,
}
```

---

## 9. Fase H — Instalacao de Componentes shadcn/ui

### Componentes a instalar via CLI

Os seguintes componentes shadcn/ui sao necessarios e ainda nao estao instalados:

```bash
# Select — para filtro de status e atribuicao de utilizador
npx shadcn@latest add select

# Progress — para barra de progresso no detalhe
npx shadcn@latest add progress

# Tooltip — para info adicional em icones (opcional, util para UX)
npx shadcn@latest add tooltip
```

**Verificacao:** Antes de instalar, confirmar que nao existem ja em `components/ui/`:

```bash
ls components/ui/select.tsx
ls components/ui/progress.tsx
ls components/ui/tooltip.tsx
```

---

## 10. Ficheiros Modificados vs Criados (Resumo)

### Ficheiros a MODIFICAR (7)

| # | Ficheiro | Tipo | Descricao da Alteracao |
|---|----------|------|----------------------|
| 1 | `types/process.ts` | Tipos | Adicionar ProcessOwner, ProcessDocument, returned/rejected_by_user, ActionType |
| 2 | `types/database.ts` | Tipos | Regenerar apos migracoes |
| 3 | `app/api/processes/route.ts` | API | Adicionar join requested_by_user, expandir search |
| 4 | `app/api/processes/[id]/route.ts` | API | Adicionar returned/rejected_by_user, doc_type.id, owner documents |
| 5 | `app/dashboard/processos/page.tsx` | Pagina | Filtro por status (Select), nome consultor, nome template |
| 6 | `app/dashboard/processos/[id]/page.tsx` | Pagina | Progress bar, pausa/reactivacao, tipar ProcessDetail, info consultor |
| 7 | `components/processes/process-tasks-section.tsx` | Componente | Atribuicao de tarefa, docs linkados, tipar props |
| 8 | `components/processes/process-review-section.tsx` | Componente | Tipar props correctamente |
| 9 | `components/processes/process-stepper.tsx` | Componente | Responsividade mobile |
| 10 | `lib/process-engine.ts` | Engine | Actualizar current_stage_id no recalculateProgress |

### Ficheiros a CRIAR (2)

| # | Ficheiro | Tipo | Descricao |
|---|----------|------|-----------|
| 1 | `app/api/processes/[id]/hold/route.ts` | API | Endpoint pausa/reactivacao (on_hold <-> active) |
| 2 | `components/processes/process-task-assign-dialog.tsx` | Componente | Dialog de atribuicao de tarefa com Select de utilizadores |
| 3 | `app/api/users/consultants/route.ts` | API | Lista utilizadores activos para Select |

### Migracoes DB (4)

| # | Nome | Descricao |
|---|------|-----------|
| 1 | `add_proc_instances_audit_columns` | Adicionar returned_by, rejected_by |
| 2 | `add_proc_tasks_order_index` | Adicionar order_index, popular existentes |
| 3 | `add_performance_indexes_proc` | Indexes de performance |
| 4 | `update_populate_process_tasks_fn` | Actualizar funcao para incluir order_index |

### Componentes shadcn/ui a Instalar (2-3)

| # | Componente | Necessidade |
|---|-----------|-------------|
| 1 | `select` | Filtro status, atribuicao utilizador |
| 2 | `progress` | Barra de progresso no detalhe |
| 3 | `tooltip` | Opcional: info adicional |

---

## 11. Criterios de Sucesso

### Verificacao Automatizada

- [ ] Migracoes aplicadas sem erro via Supabase MCP
- [ ] `npx supabase gen types typescript` executa sem erros
- [ ] `npm run build` compila sem erros de TypeScript
- [ ] Todos os endpoints respondem 200 (GET /api/processes, GET /api/processes/[id], PUT /api/processes/[id]/hold)
- [ ] GET /api/users/consultants retorna lista de utilizadores activos

### Verificacao Manual

- [ ] Listagem mostra filtro de status funcional (dropdown com 7 opcoes + "Todos")
- [ ] Ao filtrar por "Pendente Aprovacao", apenas processos nesse estado aparecem
- [ ] Nome do consultor aparece nos cards da listagem
- [ ] Pagina de detalhe mostra barra de progresso no topo
- [ ] Botao "Pausar" aparece em processos activos, muda status para on_hold
- [ ] Botao "Reactivar" aparece em processos on_hold, muda status para active
- [ ] No dropdown de tarefa, opcao "Atribuir a Utilizador" abre dialog com Select
- [ ] Apos atribuir, nome do utilizador aparece junto ao titulo da tarefa
- [ ] Tarefas UPLOAD completadas automaticamente mostram "Documento auto-detectado"
- [ ] Stepper e legivel em ecras pequenos (scroll horizontal)
- [ ] Processo rejeitado mostra card com motivo e nome de quem rejeitou

---

## 12. Fora de Escopo

As seguintes funcionalidades foram identificadas na PRD como prioridade baixa e **NAO serao implementadas nesta spec**:

1. **Supabase Realtime** — actualizacoes live via websocket
2. **Timeline/historico** — log de todas as accoes (log_audit)
3. **Notificacoes push** — para tarefas atribuidas
4. **Vista Kanban** — alternativa a listagem por cards
5. **RLS Policies** — decisao arquitectural; o projecto inteiro opera sem RLS (usa service role onde necessario)
6. **Upload de documentos** via M06 — o upload e responsabilidade do M08 (Documentos) e da angariacao

---

## Ordem de Execucao Recomendada

```
1. Fase H — Instalar componentes shadcn/ui (Select, Progress)
2. Fase A — Aplicar 4 migracoes DB
3. Regenerar types/database.ts
4. Fase B — Actualizar types/process.ts
5. Fase G — Melhorar process-engine.ts
6. Fase C — Modificar API route handlers + criar novos
7. Fase F — Criar novo componente (process-task-assign-dialog.tsx)
8. Fase D — Melhorar listagem
9. Fase E — Melhorar detalhe
10. Verificacao final (build + testes manuais)
```
