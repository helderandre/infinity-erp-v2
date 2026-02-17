# FASE 02 — Templates de Processo, Angariação & Gestão Processual

**Data:** 2026-02-17 | **Status:** 🔵 A IMPLEMENTAR | **Depende de:** Fase 01

---

## 📋 Resumo

1. **Template Builder** — Drag-and-drop para criar/editar templates de processo
2. **Formulário de Angariação** — Multi-step, cria imóvel (invisível) + processo
3. **Fluxo de Aprovação** — Responsável revê → aprova / devolve / rejeita
4. **Motor de Processos** — Tarefas criadas SÓ na aprovação, auto-complete, gestão
5. **Visualização** — Stepper por fases, acções por tipo de tarefa, atribuição

---

## 🔄 FLUXO PRINCIPAL

```
Consultor preenche "Nova Angariação" (5 steps)
  ↓
Submit → Cria:
  • dev_properties (status: 'pending_approval') ← INVISÍVEL
  • dev_property_specifications + dev_property_internal
  • owners (se novo) + property_owners
  • doc_registry (documentos enviados)
  • proc_instances (current_status: 'pending_approval')
  ⚠️ TAREFAS NÃO SÃO CRIADAS
  ↓
Responsável abre solicitação → revê todos os dados
  ↓
┌─────────────────────────────────────────────────────────┐
│ ✅ APROVAR                                               │
│   proc_instances → 'active'                              │
│   dev_properties → 'in_process'                          │
│   → populate_process_tasks() — tarefas criadas           │
│   → auto-complete com docs existentes                    │
│   → responsável atribui tarefas                          │
│                                                          │
│ 🔄 DEVOLVER PARA CORRECÇÃO                               │
│   proc_instances → 'returned' (motivo obrigatório)       │
│   consultor corrige → resubmete → 'pending_approval'    │
│                                                          │
│ ❌ REJEITAR                                               │
│   proc_instances → 'rejected' (motivo obrigatório)       │
│   dev_properties → 'cancelled'                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🔴 MIGRATIONS

### M1: action_type + config em proc_tasks

```sql
ALTER TABLE proc_tasks
  ADD COLUMN IF NOT EXISTS action_type text,
  ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;
```

### M2: Remover trigger, criar função callable

```sql
DROP TRIGGER IF EXISTS trg_populate_tasks ON proc_instances;

CREATE OR REPLACE FUNCTION populate_process_tasks(p_instance_id uuid)
RETURNS void AS $$
DECLARE v_tpl_process_id uuid;
BEGIN
    SELECT tpl_process_id INTO v_tpl_process_id
    FROM proc_instances WHERE id = p_instance_id;

    IF v_tpl_process_id IS NULL THEN
        RAISE EXCEPTION 'Instância % não encontrada ou sem template', p_instance_id;
    END IF;

    INSERT INTO proc_tasks (
        proc_instance_id, tpl_task_id, title, action_type, config,
        status, is_mandatory, assigned_role, due_date, stage_name, stage_order_index
    )
    SELECT
        p_instance_id, t.id, t.title, t.action_type, t.config,
        'pending', t.is_mandatory, t.assigned_role,
        CASE WHEN t.sla_days IS NOT NULL THEN NOW() + (t.sla_days * interval '1 day') ELSE NULL END,
        s.name, s.order_index
    FROM tpl_tasks t
    JOIN tpl_stages s ON t.tpl_stage_id = s.id
    WHERE s.tpl_process_id = v_tpl_process_id
    ORDER BY s.order_index, t.order_index;
END;
$$ LANGUAGE plpgsql;
```

### M3: owner_id em doc_registry

```sql
ALTER TABLE doc_registry ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES owners(id);
CREATE INDEX IF NOT EXISTS idx_doc_registry_owner_id ON doc_registry(owner_id);
```

Regra: `property_id` + `owner_id NULL` = doc do imóvel | `owner_id` + `property_id NULL` = doc do proprietário reutilizável | ambos = doc do owner naquele imóvel

### M4: Status systems

```sql
ALTER TABLE dev_properties ALTER COLUMN status SET DEFAULT 'pending_approval';

ALTER TABLE proc_instances
  ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES dev_users(id),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES dev_users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_reason text,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS notes text;
```

### M5: description + assigned_role

```sql
ALTER TABLE tpl_stages ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tpl_tasks ADD COLUMN IF NOT EXISTS assigned_role text;
ALTER TABLE proc_tasks ADD COLUMN IF NOT EXISTS assigned_role text;
```

### M6: Novos doc_types

```sql
INSERT INTO doc_types (name, category, description, is_system, default_validity_months) VALUES
  ('Comprovativo de Estado Civil', 'Proprietário', 'Certidão casamento/divórcio/óbito', true, NULL),
  ('Ficha de Branqueamento de Capitais', 'Proprietário', 'Prevenção de branqueamento', true, 12),
  ('Certidão Permanente da Empresa', 'Proprietário Empresa', 'Certidão comercial permanente', true, NULL),
  ('Pacto Social / Estatutos', 'Proprietário Empresa', 'Estatutos da empresa', true, NULL),
  ('Ata de Poderes para Venda', 'Proprietário Empresa', 'Poderes para venda/angariação', true, NULL),
  ('RCBE', 'Proprietário Empresa', 'Registo Central Beneficiário Efetivo', true, 12),
  ('Ficha de Branqueamento (Empresa)', 'Proprietário Empresa', 'Identificação empresarial', true, 12),
  ('Habilitação de Herdeiros', 'Jurídico Especial', 'Heranças indivisas', true, NULL),
  ('Certidão de Óbito', 'Jurídico Especial', 'Processos de herança', true, NULL),
  ('Autorização do Tribunal', 'Jurídico Especial', 'Menores ou incapazes', true, NULL),
  ('Contrato de Mediação (CMI)', 'Contratual', 'CMI assinado', true, NULL),
  ('Título Constitutivo', 'Imóvel', 'Propriedade horizontal', true, NULL),
  ('Regulamento do Condomínio', 'Imóvel', 'Regulamento condomínio', true, NULL),
  ('Contrato de Arrendamento', 'Imóvel', 'Imóvel arrendado', true, NULL)
ON CONFLICT (name) DO NOTHING;
```

---

## 📊 STATUS

### dev_properties.status (visibilidade)

| Status | Label | Cor | Visível? |
|--------|-------|-----|----------|
| `pending_approval` | Pendente Aprovação | amber | ❌ |
| `in_process` | Em Processo | yellow | ❌ |
| `active` | Activo | emerald | ✅ |
| `reserved` | Reservado | purple | ❌ |
| `sold` | Vendido | blue | ❌ |
| `rented` | Arrendado | indigo | ❌ |
| `suspended` | Suspenso | slate | ❌ |
| `cancelled` | Cancelado | red | ❌ |

### proc_instances.current_status (processo)

| Status | Label | Cor |
|--------|-------|-----|
| `pending_approval` | Pendente Aprovação | amber |
| `returned` | Devolvido | orange |
| `active` | Em Andamento | blue |
| `on_hold` | Pausado | slate |
| `completed` | Concluído | emerald |
| `rejected` | Rejeitado | red |
| `cancelled` | Cancelado | red |

### Transições

```
SUBMISSÃO:     property='pending_approval'  process='pending_approval'
DEVOLUÇÃO:     property=sem mudança         process='returned'
RESUBMISSÃO:   property=sem mudança         process='pending_approval'
APROVAÇÃO:     property='in_process'        process='active' → tarefas criadas
REJEIÇÃO:      property='cancelled'         process='rejected'
CONCLUSÃO:     process='completed' → broker aprova → property='active'
```

### Constantes (lib/constants.ts)

```typescript
export const PROPERTY_STATUS = {
  pending_approval: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Pendente Aprovação' },
  in_process: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Em Processo' },
  active: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Activo' },
  reserved: { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500', label: 'Reservado' },
  sold: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Vendido' },
  rented: { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500', label: 'Arrendado' },
  suspended: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500', label: 'Suspenso' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Cancelado' },
} as const

export const PROCESS_STATUS = {
  pending_approval: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Pendente Aprovação' },
  returned: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Devolvido' },
  active: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Em Andamento' },
  on_hold: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500', label: 'Pausado' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Concluído' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Rejeitado' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Cancelado' },
} as const

export const TASK_STATUS = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-400', label: 'Pendente' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Em Progresso' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Concluída' },
  skipped: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Dispensada' },
} as const
```

---

## 🧩 BLOCO A — Template Builder

### action_type

| Tipo | Ícone | config |
|------|-------|--------|
| `UPLOAD` | 📄 | `{ doc_type_id: uuid }` |
| `EMAIL` | 📧 | `{ email_library_id: uuid }` |
| `GENERATE_DOC` | 📝 | `{ doc_library_id: uuid }` |
| `MANUAL` | ✋ | `{}` |

### Endpoints

```
GET  /api/templates           → Lista com stages_count, tasks_count
GET  /api/templates/[id]      → Detalhe com fases + tarefas + config resolvido
GET  /api/templates/active    → Template activo (p/ formulário)
POST /api/templates           → Criar (processo + fases + tarefas)
PUT  /api/templates/[id]      → Editar (delete+recreate fases/tarefas)
DELETE /api/templates/[id]    → Soft delete (is_active=false)
GET  /api/libraries/doc-types → Para dropdowns no builder
GET  /api/libraries/emails    → Para dropdowns no builder
GET  /api/libraries/docs      → Para dropdowns no builder
GET  /api/libraries/roles     → Para dropdown assigned_role
```

### Componentes

```
components/templates/
├── template-list.tsx              # Cards de templates
├── template-builder.tsx           # Container principal
├── template-builder-header.tsx    # Nome + descrição editáveis
├── stage-column.tsx               # Fase (drag horizontal)
├── stage-header.tsx               # Nome, edit, delete
├── task-card.tsx                  # Tarefa (drag vertical + entre fases)
├── task-config-dialog.tsx         # Config dinâmica por action_type
├── task-type-selector.tsx         # 4 botões visuais
├── add-stage-button.tsx
├── add-task-button.tsx
└── template-preview-dialog.tsx
```

**Dep npm:** `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

### Validação Zod

```typescript
const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  action_type: z.enum(['UPLOAD', 'EMAIL', 'GENERATE_DOC', 'MANUAL']),
  is_mandatory: z.boolean().default(true),
  sla_days: z.number().int().positive().optional(),
  assigned_role: z.string().optional(),
  config: z.record(z.any()).default({}),
  order_index: z.number().int().min(0),
}).refine((t) => {
  if (t.action_type === 'UPLOAD') return !!t.config?.doc_type_id
  if (t.action_type === 'EMAIL') return !!t.config?.email_library_id
  if (t.action_type === 'GENERATE_DOC') return !!t.config?.doc_library_id
  return true
})

const stageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  order_index: z.number().int().min(0),
  tasks: z.array(taskSchema).min(1),
})

const templateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  stages: z.array(stageSchema).min(1),
})
```

Quando o utilizador selecciona um doc_type no dialog, o `doc_type_id` é gravado em `config`. Na instanciação, a trigger copia para `proc_tasks.config`. Na execução, o sistema sabe que tipo de documento esperar.

---

## 🏠 BLOCO B — Formulário de Angariação

### Steps

1. **Dados do Imóvel** — título, tipo, negócio, preço (obrigatórios)
2. **Localização** — morada, cidade (obrigatórios), Mapbox para lat/lng
3. **Proprietário** — pesquisa por NIF ou criar novo, múltiplos owners
4. **Dados Contratuais** — regime, comissão (obrigatórios)
5. **Documentos Iniciais** — upload opcional, mostra docs do owner que já existem

### Step 5 — Detalhe

Lista baseada no template activo. Para cada tarefa UPLOAD:
- Se owner já tem doc válido: "✅ Já existe (válido até...)"
- Senão: file picker para upload

### Endpoints

```
POST /api/acquisitions          → Submissão completa
PUT  /api/acquisitions/[id]     → Edição (quando returned/pending)
GET  /api/acquisitions/[id]     → Detalhe para revisão
```

### POST /api/acquisitions — Sequência

```typescript
// 1. Resolver owners (buscar existentes ou criar novos)
// 2. INSERT dev_properties (status: 'pending_approval')
// 3. INSERT dev_property_specifications (vazio)
// 4. INSERT dev_property_internal (contract data)
// 5. INSERT property_owners (ligações)
// 6. INSERT doc_registry (documentos enviados)
// 7. INSERT proc_instances (status: 'pending_approval', SEM TAREFAS)
```

### PUT /api/acquisitions/[id] — Edição

Só permitido quando `current_status` in `['pending_approval', 'returned']`.
Se estava `returned`, volta automaticamente a `pending_approval`.

### Componentes

```
components/acquisitions/
├── acquisition-form.tsx           # Container multi-step
├── step-property-data.tsx
├── step-location.tsx
├── step-owner.tsx
├── step-contract.tsx
├── step-documents.tsx
├── owner-search-or-create.tsx     # Pesquisa NIF + criação
├── owner-documents-preview.tsx    # Docs existentes
└── acquisition-stepper.tsx        # Indicador de progresso
```

---

Continua em **FASE-02-IMPLEMENTACAO.md** (endpoints de aprovação, gestão de processos, seed do template, estrutura de ficheiros, e ordem de implementação).
