# SPEC — Dropdown Selectivo de Tarefas por Proprietário

**Data:** 2026-03-11
**Módulo:** M09 — Angariações
**Tipo:** Especificação

---

## Contexto

Anteriormente, cada card de proprietário tinha um botão largo "Adicionar ao fluxo de tarefas" que adicionava **todas** as tarefas do template de uma vez. Não havia forma de adicionar tarefas individualmente, nem de ver quais já tinham sido criadas.

## Objectivo

Substituir o botão por um **dropdown compacto** (ícone) que permite:
1. Adicionar todas as tarefas ao fluxo de uma vez
2. Adicionar tarefas específicas (por tarefa ou por subtarefa individual)
3. Visualizar quais tarefas/subtarefas já foram criadas (desactivadas com checkmark)

---

## Arquitectura — Dois Níveis de Multiplicação

O template "Processo de Angariações" usa multiplicação a **nível de subtarefa**, não de tarefa:

| Nível | Campo | Significado |
|-------|-------|-------------|
| `tpl_tasks.config.owner_type` | `singular` / `coletiva` | Cria `proc_tasks` separadas por owner (Estratégia A) |
| `tpl_subtasks.config.owner_scope` | `all_owners` / `main_contact_only` / `none` | Cria `proc_subtasks` dentro de `proc_tasks` existentes (Estratégia B) |
| `tpl_subtasks.config.person_type_filter` | `all` / `singular` / `coletiva` | Filtra por tipo de pessoa |
| `tpl_subtasks.config.has_person_type_variants` | `boolean` | Merge de `singular_config` / `coletiva_config` |

No template actual, todas as `proc_tasks` têm `owner_id = NULL` e a ownership é rastreada via `proc_subtasks.owner_id`.

---

## Componentes

### 1. `OwnerTasksDropdown`

**Ficheiro:** `components/processes/owner-tasks-dropdown.tsx`

Dropdown menu compacto (ícone `ClipboardList`, 28x28px) com:

#### Props

```typescript
interface OwnerTasksDropdownProps {
  processId: string
  ownerId: string
  ownerName: string
  existingSubtaskIds: Set<string>   // tpl_subtask_ids já criados
  allPopulated: boolean             // todas as tarefas já criadas
  onTasksPopulated?: () => void     // callback após criação
}
```

#### Estrutura do Dropdown

```
┌──────────────────────────────────┐
│ Tarefas para {ownerName}         │
├──────────────────────────────────┤
│ ≡ Adicionar todas ao fluxo       │
├──────────────────────────────────┤
│ 📄 Enviar e-mail ao cliente...  >│
│ 📄 Armazenar documentos        >│
│ 📄 Geração do CMI              >│
│ 📄 Enviar CMI ao proprietário   >│
└──────────────────────────────────┘
        │
        ▼ (submenu ao expandir tarefa)
┌──────────────────────────────────┐
│ ≡ Adicionar todas                │
├──────────────────────────────────┤
│ ✓ Subtask A       (desactivada) │
│ > Subtask B       (disponível)  │
│ > Subtask C       (disponível)  │
└──────────────────────────────────┘
```

#### Comportamento

- **Lazy load**: Tarefas do template são carregadas apenas quando o dropdown abre (GET endpoint)
- **Cache**: Não recarrega se já carregou (`templateTasks.length > 0`)
- **Validação visual**: Items já criados mostram `✓` verde e ficam `disabled`
- **Loading individual**: Cada item mostra spinner próprio durante criação

### 2. `ProcessOwnerCard` (actualizado)

**Ficheiro:** `components/processes/process-owner-card.tsx`

- Card com classe `relative` para posicionar o dropdown
- `OwnerTasksDropdown` posicionado `absolute top-3 right-3`
- `onClick` no dropdown tem `e.stopPropagation()` para não abrir o detalhe do owner

### 3. `ProcessOwnersTab` (actualizado)

**Ficheiro:** `components/processes/process-owners-tab.tsx`

- Botão largo removido, substituído pelo `OwnerTasksDropdown` inline na `CardHeader` junto dos botões de edição e eliminação
- Removido estado `populatingTasksFor` e função `handlePopulateTasks`
- Nova prop `ownerExistingSubtaskIds: Record<string, Set<string>>`

---

## API Endpoints

### GET `/api/processes/[id]/owners/template-tasks`

**Ficheiro:** `app/api/processes/[id]/owners/template-tasks/route.ts`

Retorna as tarefas do template filtradas para um proprietário específico.

**Query params:** `owner_id` (UUID)

**Lógica de filtragem:**
1. Busca o processo e o owner (com `is_main_contact` da junction)
2. Carrega `tpl_tasks` com `tpl_subtasks` do template
3. Filtra tarefas onde `config.owner_type` corresponde (ou não tem `owner_type`)
4. Filtra subtarefas por:
   - `owner_scope !== 'none'` e `owner_scope` existe
   - `owner_scope === 'main_contact_only'` → só se `is_main_contact`
   - `person_type_filter` → corresponde ao `person_type` do owner

**Response:**
```json
{
  "tasks": [
    {
      "id": "tpl_task_uuid",
      "title": "Pedido de Documentação",
      "config": {},
      "stage_name": "Angariação",
      "tpl_subtasks": [
        { "id": "tpl_subtask_uuid", "title": "Enviar e-mail...", "config": {...}, "order_index": 0 }
      ]
    }
  ]
}
```

### POST `/api/processes/[id]/owners/populate-tasks` (actualizado)

**Ficheiro:** `app/api/processes/[id]/owners/populate-tasks/route.ts`

Agora suporta **modo selectivo** além do modo "adicionar todas".

**Body:**
```json
{
  "owner_id": "uuid",
  "tpl_task_id": "uuid",           // opcional — modo selectivo
  "tpl_subtask_ids": ["uuid", ...]  // opcional — subtarefas específicas
}
```

**Modo selectivo** (`tpl_task_id` presente):
- Salta verificação de duplicados global
- Filtra `genericTasks` por `tpl_task_id`
- Se `tpl_subtask_ids` presente, filtra também as subtarefas
- Verifica duplicados individuais via `existingOwnerSubtasks: Set<string>`

**Duas estratégias:**
- **Estratégia A** — `tpl_tasks.config.owner_type` corresponde → cria novas `proc_tasks` com `owner_id`
- **Estratégia B** — Tasks genéricas (sem `owner_type`) → cria `proc_subtasks` nas `proc_tasks` existentes (onde `owner_id IS NULL`)

---

## Dados — Mapa de Subtarefas Existentes

**Ficheiro:** `app/dashboard/processos/[id]/page.tsx`

```typescript
const { ownerHasTasksMap, ownerExistingSubtaskIds } = useMemo(() => {
  const hasMap: Record<string, boolean> = {}
  const subMap: Record<string, Set<string>> = {}
  if (process?.stages) {
    for (const stage of process.stages) {
      for (const task of stage.tasks || []) {
        if (task.owner_id) hasMap[task.owner_id] = true
        for (const subtask of task.subtasks || []) {
          if (subtask.owner_id) {
            hasMap[subtask.owner_id] = true
            if (subtask.tpl_subtask_id) {
              if (!subMap[subtask.owner_id]) subMap[subtask.owner_id] = new Set()
              subMap[subtask.owner_id].add(subtask.tpl_subtask_id)
            }
          }
        }
      }
    }
  }
  return { ownerHasTasksMap: hasMap, ownerExistingSubtaskIds: subMap }
}, [process?.stages])
```

**Fix necessário:** A API `GET /api/processes/[id]` foi actualizada para retornar `tpl_subtask_id` no select das `proc_subtasks`. Sem este campo, o mapa ficava sempre vazio.

---

## Ficheiros Alterados

| Ficheiro | Tipo | Alteração |
|----------|------|-----------|
| `components/processes/owner-tasks-dropdown.tsx` | **Novo** | Componente dropdown selectivo |
| `app/api/processes/[id]/owners/template-tasks/route.ts` | **Novo** | Endpoint GET de tarefas filtradas |
| `app/api/processes/[id]/owners/populate-tasks/route.ts` | **Reescrito** | Modo selectivo + duas estratégias |
| `app/api/processes/[id]/route.ts` | **Alterado** | Adicionado `tpl_subtask_id` ao select de subtasks |
| `components/processes/process-owner-card.tsx` | **Alterado** | Card `relative`, dropdown no canto superior direito |
| `components/processes/process-owners-tab.tsx` | **Alterado** | Botão largo substituído por dropdown inline, nova prop `ownerExistingSubtaskIds` |
| `app/dashboard/processos/[id]/page.tsx` | **Alterado** | Mapa `ownerExistingSubtaskIds`, props passadas aos componentes |
