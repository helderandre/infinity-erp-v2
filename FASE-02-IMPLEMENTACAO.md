# FASE 02 — Implementação (Parte 2: Aprovação, Processos, Seed)

Continuação de **FASE-02-TEMPLATES-PROCESSOS.md**

---

## ✅ BLOCO C — Fluxo de Aprovação

### Página de Revisão (`/processos/[id]` quando status = pending_approval|returned)

O responsável vê TODOS os dados submetidos: imóvel, localização (mapa), proprietários (com docs existentes), dados contratuais, documentos enviados. Três botões: Aprovar, Devolver, Rejeitar.

Se `returned`, mostra também o motivo da devolução anterior e as alterações feitas.

### PUT /api/processes/[id]/approve

```typescript
async function approveProcess(procInstanceId, userId, notes) {
  const proc = await getProc(procInstanceId)
  if (proc.current_status !== 'pending_approval') throw Error('Não está pendente')

  // 1. Actualizar processo
  await update('proc_instances', procInstanceId, {
    current_status: 'active',
    approved_by: userId,
    approved_at: now(),
    notes
  })

  // 2. Mudar status do imóvel
  await update('dev_properties', proc.property_id, { status: 'in_process' })

  // 3. ⭐ CRIAR TAREFAS (chamar função SQL)
  await supabase.rpc('populate_process_tasks', { p_instance_id: procInstanceId })

  // 4. Auto-completar tarefas
  await autoCompleteTasks(procInstanceId, proc.property_id)

  // 5. Recalcular progresso
  await recalculateProgress(procInstanceId)
}
```

### PUT /api/processes/[id]/return

```typescript
async function returnProcess(procInstanceId, userId, reason) {
  if (!reason?.trim()) throw Error('Motivo obrigatório')

  await update('proc_instances', procInstanceId, {
    current_status: 'returned',
    returned_at: now(),
    returned_reason: reason
  })
  // TODO: Notificar consultor
}
```

### PUT /api/processes/[id]/reject

```typescript
async function rejectProcess(procInstanceId, userId, reason) {
  if (!reason?.trim()) throw Error('Motivo obrigatório')
  const proc = await getProc(procInstanceId)

  await update('proc_instances', procInstanceId, {
    current_status: 'rejected',
    rejected_at: now(),
    rejected_reason: reason
  })

  await update('dev_properties', proc.property_id, { status: 'cancelled' })
}
```

### Auto-Complete de Tarefas (pós-aprovação)

```typescript
async function autoCompleteTasks(procInstanceId, propertyId) {
  // Buscar tarefas UPLOAD criadas
  const tasks = await getTasksByType(procInstanceId, 'UPLOAD')

  // Buscar docs do imóvel
  const propertyDocs = await getDocsByProperty(propertyId)

  // Buscar owners do imóvel
  const ownerIds = await getOwnerIds(propertyId)

  // Buscar docs dos owners (reutilizáveis)
  const ownerDocs = await getDocsByOwners(ownerIds)

  const allDocs = [...propertyDocs, ...ownerDocs]

  for (const task of tasks) {
    const docTypeId = task.config?.doc_type_id
    if (!docTypeId) continue

    const matchingDoc = allDocs.find(d =>
      d.doc_type_id === docTypeId &&
      (!d.valid_until || new Date(d.valid_until) > new Date())
    )

    if (matchingDoc) {
      await update('proc_tasks', task.id, {
        status: 'completed',
        completed_at: now(),
        task_result: {
          doc_registry_id: matchingDoc.id,
          auto_completed: true,
          source: matchingDoc.owner_id ? 'owner_existing_document' : 'acquisition_form'
        }
      })
    }
  }
}
```

### Recálculo de Progresso

```typescript
async function recalculateProgress(procInstanceId) {
  const tasks = await getAllTasks(procInstanceId)
  const total = tasks.length
  const completed = tasks.filter(t => t.status === 'completed' || t.is_bypassed).length
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  // Determinar fase actual (primeira com tarefas pendentes)
  const pendingStageIndex = tasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => a.stage_order_index - b.stage_order_index)[0]
    ?.stage_order_index

  const update = {
    percent_complete: percent,
    updated_at: now(),
    ...(percent === 100 ? { current_status: 'completed', completed_at: now() } : {})
  }

  await updateProc(procInstanceId, update)
}
```

---

## 📋 BLOCO D — Gestão de Processos (pós-aprovação)

### Endpoints

```
GET  /api/processes                      → Lista com filtros + tabs
GET  /api/processes/[id]                 → Detalhe (stages + tasks quando aprovado)
PUT  /api/processes/[id]/tasks/[taskId]  → Acções na tarefa
PUT  /api/processes/[id]/status          → on_hold, cancel, reactivate
```

### GET /api/processes/[id] — Response

```typescript
{
  instance: {
    id, external_ref, current_status, percent_complete, notes,
    returned_reason, rejected_reason,
    property: { id, title, slug, city, listing_price, status, property_type },
    requested_by: { id, commercial_name },
    approved_by: { id, commercial_name } | null,
    approved_at, started_at, completed_at
  },
  // STAGES + TASKS — NULL se não aprovado
  stages: [
    {
      name, order_index,
      status: 'completed' | 'in_progress' | 'pending', // calculado
      tasks_completed, tasks_total,
      tasks: [
        {
          id, title, action_type, status, is_mandatory,
          is_bypassed, bypass_reason,
          assigned_to: { id, commercial_name } | null,
          assigned_role, due_date, completed_at,
          config, task_result
        }
      ]
    }
  ] | null,
  owners: [{ id, name, nif, person_type, existing_documents: [...] }],
  documents: [{ id, doc_type: { name, category }, file_name, file_url, status }]
}
```

### PUT /api/processes/[id]/tasks/[taskId]

```typescript
// Request
{ action: 'complete' | 'bypass' | 'assign' | 'start' | 'reset', ...params }

// Lógica:
// complete → status='completed', completed_at=now(), task_result={doc_registry_id?}
// bypass   → is_bypassed=true, bypass_reason (obrigatório), status='skipped'
// assign   → assigned_to=user_id
// start    → status='in_progress'
// reset    → status='pending', limpa completed_at, task_result, is_bypassed

// SEMPRE recalcular progresso após qualquer acção
```

### Acções por Tipo de Tarefa

| action_type | UI | Acção |
|-------------|-----|-------|
| `UPLOAD` | "📄 Carregar" | File picker → R2 → doc_registry → complete |
| `EMAIL` | "📧 Enviar" | Preview → confirmar → complete |
| `GENERATE_DOC` | "📝 Gerar" | Preview → download → complete |
| `MANUAL` | "✅ Concluir" | Nota opcional → complete |

Todas têm: "⏭ Dispensar" (bypass + motivo) e "👤 Atribuir" (user selector)

### Componentes

```
components/processes/
├── process-list.tsx               # Lista com tabs
├── process-card.tsx               # Card na lista
├── process-filters.tsx            # Filtros status/consultor
├── process-detail.tsx             # Router: review vs active view
├── process-review-view.tsx        # Para pending_approval/returned
├── process-active-view.tsx        # Para active/on_hold/completed
├── process-header.tsx             # Ref, status, progresso
├── process-stepper.tsx            # Stepper horizontal por fases
├── process-stage-section.tsx      # Secção com tarefas
├── process-task-card.tsx          # Card individual
├── task-upload-action.tsx         # Upload inline
├── task-bypass-dialog.tsx         # Motivo obrigatório
├── task-assign-dialog.tsx         # Selector de utilizador
├── process-approve-dialog.tsx     # Confirmação
├── process-return-dialog.tsx      # Motivo obrigatório
└── process-reject-dialog.tsx      # Motivo + confirmação dupla
```

### Tabs na Listagem

- **Pendentes** — `pending_approval` + `returned` (para Broker/Processual)
- **Em Andamento** — `active` + `on_hold`
- **Concluídos** — `completed`
- **Todos**

---

## 🗂️ BLOCO E — Seed do Template Padrão

Eliminar template existente (`7e109251-...`, 2 fases, 3 tarefas com typos) e criar completo:

### Fases e Tarefas

```
"Captação da Angariação" — 6 fases, 28 tarefas

── Fase 1: Contrato de Mediação (CMI) ── order: 0
  ├── Upload CMI assinado        UPLOAD→"Contrato de Mediação (CMI)" mandatory sla:3 role:Processual
  └── Verificar outorgantes CMI  MANUAL mandatory role:Processual

── Fase 2: Identificação Proprietários ── order: 1
  ├── Doc Identificação (CC)     UPLOAD→"Cartão de Cidadão" mandatory role:Processual
  ├── Verificar morada           MANUAL mandatory role:Processual
  ├── Verificar nacionalidade    MANUAL optional role:Processual
  ├── Comprovativo Estado Civil  UPLOAD→"Comprovativo de Estado Civil" optional sla:5 role:Processual
  └── Ficha Branqueamento        UPLOAD→"Ficha de Branqueamento de Capitais" mandatory sla:5 role:Processual

── Fase 3: Identificação Empresa (Pessoa Coletiva) ── order: 2
  ├── Certidão Permanente Empresa UPLOAD→"Certidão Permanente da Empresa" optional role:Processual
  ├── Pacto Social / Estatutos   UPLOAD→"Pacto Social / Estatutos" optional role:Processual
  ├── Ata poderes venda          UPLOAD→"Ata de Poderes para Venda" optional role:Processual
  ├── RCBE                       UPLOAD→"RCBE" optional role:Processual
  └── Ficha Branqueamento Emp.   UPLOAD→"Ficha de Branqueamento (Empresa)" optional role:Processual

── Fase 4: Documentação do Imóvel ── order: 3
  ├── Caderneta Predial          UPLOAD→"Caderneta Predial (CMI)" mandatory sla:5 role:Processual
  ├── Certidão Permanente CRP    UPLOAD→"Certidão Permanente (CRP)" mandatory sla:5 role:Processual
  ├── Licença Utilização         UPLOAD→"Licença de Utilização" mandatory sla:10 role:Processual
  ├── Certificado Energético     UPLOAD→"Certificado Energético" mandatory sla:10 role:Processual
  ├── Planta Imóvel              UPLOAD→"Planta do Imóvel" optional role:Consultor
  └── Ficha Técnica (pós-2004)   UPLOAD→"Ficha Técnica de Habitação" optional role:Processual

── Fase 5: Situações Específicas ── order: 4
  ├── Título Constitutivo        UPLOAD→"Título Constitutivo" optional role:Processual
  ├── Regulamento Condomínio     UPLOAD→"Regulamento do Condomínio" optional role:Processual
  ├── Contrato Arrendamento      UPLOAD→"Contrato de Arrendamento" optional role:Processual
  ├── Escritura                  UPLOAD→"Escritura" optional role:Processual
  └── Procuração                 UPLOAD→"Procuração" optional role:Processual

── Fase 6: Validação Final ── order: 5
  ├── Validar checklist 100%     MANUAL mandatory role:Processual
  ├── Doc validada processual    MANUAL mandatory role:Processual
  ├── Aprovação Jurídica         MANUAL mandatory role:Broker/CEO
  └── Autorização DRAFT          MANUAL mandatory role:Broker/CEO
```

**No SQL de seed, usar subqueries para doc_type_id:**
```sql
config = jsonb_build_object('doc_type_id',
  (SELECT id FROM doc_types WHERE name = 'Caderneta Predial (CMI)'))
```

---

## 📁 Estrutura de Ficheiros

```
src/app/(dashboard)/
├── processos/
│   ├── page.tsx                       # Lista processos (tabs)
│   ├── [id]/page.tsx                  # Detalhe (review OU active view)
│   └── templates/
│       ├── page.tsx                   # Lista templates
│       ├── novo/page.tsx              # Builder criação
│       └── [id]/editar/page.tsx       # Builder edição
├── angariacoes/
│   ├── nova/page.tsx                  # Formulário multi-step
│   └── [id]/editar/page.tsx           # Edição (returned/pending)

src/app/api/
├── templates/
│   ├── route.ts                       # GET list, POST create
│   ├── active/route.ts                # GET template activo
│   └── [id]/route.ts                  # GET, PUT, DELETE
├── processes/
│   ├── route.ts                       # GET list
│   └── [id]/
│       ├── route.ts                   # GET detail
│       ├── approve/route.ts           # PUT
│       ├── return/route.ts            # PUT
│       ├── reject/route.ts            # PUT
│       ├── status/route.ts            # PUT on_hold/cancel/reactivate
│       └── tasks/[taskId]/route.ts    # PUT complete/bypass/assign/start/reset
├── acquisitions/
│   ├── route.ts                       # POST submit
│   └── [id]/route.ts                  # PUT edit, GET detail
└── libraries/
    ├── doc-types/route.ts
    ├── emails/route.ts
    ├── docs/route.ts
    └── roles/route.ts

src/components/
├── templates/                         # 11 componentes (ver BLOCO A)
├── processes/                         # 16 componentes (ver BLOCO D)
├── acquisitions/                      # 9 componentes (ver BLOCO B)
└── shared/
    └── document-upload-slot.tsx       # Reutilizável

src/lib/
├── process-engine.ts                  # autoCompleteTasks, recalculateProgress
└── validations/
    ├── template.ts
    └── acquisition.ts

src/types/
├── template.ts
├── process.ts
└── acquisition.ts
```

---

## 🔄 Ordem de Implementação

### Semana 1: Fundação
```
1. Migrations M1-M6
2. Limpar template existente + seed completo (28 tarefas)
3. GET /api/libraries/* (4 endpoints)
4. GET /api/templates + GET /api/templates/[id]
```

### Semana 2: Template Builder
```
5. POST /api/templates
6. PUT /api/templates/[id]
7. Componentes builder (@dnd-kit)
8. Páginas listagem + builder
```

### Semana 3: Formulário de Angariação
```
9. POST /api/acquisitions
10. PUT /api/acquisitions/[id]
11. Formulário multi-step (5 steps)
12. Owner search/create
13. Document upload slots
```

### Semana 4: Aprovação e Gestão
```
14. PUT /api/processes/[id]/approve (populate + auto-complete)
15. PUT /api/processes/[id]/return
16. PUT /api/processes/[id]/reject
17. process-review-view
18. GET /api/processes + GET /api/processes/[id]
19. PUT /api/processes/[id]/tasks/[taskId]
20. process-active-view (stepper + tasks)
21. PUT /api/processes/[id]/status
```

---

## ⚠️ Notas Importantes

### Trigger removida
`trg_populate_tasks` é REMOVIDA na M2. A função `populate_process_tasks(uuid)` é chamada via `supabase.rpc()` APENAS no endpoint de aprovação. A trigger `trg_generate_proc_ref` mantém-se.

### Permissões

| Acção | Roles |
|-------|-------|
| Submeter angariação | Consultor, Consultora Executiva, Team Leader, Broker/CEO |
| Editar solicitação | Qualquer com permissão `properties` |
| Aprovar | Broker/CEO, Gestora Processual |
| Devolver | Broker/CEO, Gestora Processual |
| Rejeitar | Broker/CEO |
| Executar tarefas | Conforme assigned_role/assigned_to |
| Bypass | Broker/CEO, Gestora Processual |
| Atribuir | Broker/CEO, Gestora Processual, Team Leader |
| Criar/editar templates | Broker/CEO |

### Labels PT-PT
Guardar, Eliminar, Carregar (upload), Dispensar (bypass), Devolver (return), Pendente, Concluído, Fase (não "Etapa").

### Campos opcionais ≠ dispensáveis
Opcionais no formulário = serão solicitados depois no processo. O consultor não é obrigado a tê-los na submissão.

### @dnd-kit
`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — moderno, React 18/19 compatível.
