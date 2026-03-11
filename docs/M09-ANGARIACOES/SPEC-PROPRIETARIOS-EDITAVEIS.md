# SPEC: Proprietários Editáveis no Processo + Roles + Cônjuge

**Data:** 2026-03-11
**Estado:** Implementado (parcial — falta "Adicionar Novo Proprietário")

---

## 1. Resumo

Transformação da vista de proprietários dentro de um processo de **leitura apenas** para **edição completa** via Sheet lateral. Adição de sistema de **roles** (proprietário, cônjuge, sócio, herdeiro, etc.) com tabela de lookup, **registo automático de cônjuge**, **barra de resumo de propriedade**, e **vinculação de representante legal** a pessoa existente no banco.

---

## 2. Migração de Base de Dados

### 2a. Tabela `owner_role_types` (NOVA)

```sql
CREATE TABLE owner_role_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT,
  is_active BOOLEAN DEFAULT true,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed inicial
INSERT INTO owner_role_types (name, label, color, order_index) VALUES
  ('proprietario', 'Proprietário', 'blue', 0),
  ('conjuge', 'Cônjuge', 'pink', 1),
  ('socio', 'Sócio', 'amber', 2),
  ('herdeiro', 'Herdeiro', 'purple', 3),
  ('usufrutuario', 'Usufrutuário', 'emerald', 4),
  ('nu_proprietario', 'Nu-Proprietário', 'slate', 5);

-- RLS
ALTER TABLE owner_role_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON owner_role_types
  FOR SELECT TO authenticated USING (true);
```

### 2b. FK em `property_owners`

```sql
ALTER TABLE property_owners
  ADD COLUMN owner_role_id UUID REFERENCES owner_role_types(id);

-- Preencher existentes com 'proprietario'
UPDATE property_owners
SET owner_role_id = (SELECT id FROM owner_role_types WHERE name = 'proprietario');

-- Tornar NOT NULL
ALTER TABLE property_owners
  ALTER COLUMN owner_role_id SET NOT NULL;
```

### 2c. Types regenerados

`types/database.ts` regenerado com `npx supabase gen types typescript`.

---

## 3. Types (TypeScript)

### `types/owner.ts`

```typescript
export type OwnerRoleTypeRow = Database['public']['Tables']['owner_role_types']['Row']

export interface OwnerRoleType {
  id: string
  name: string
  label: string
  color?: string | null
  order_index?: number
}

export interface OwnerWithRole extends OwnerRow {
  ownership_percentage?: number | null
  is_main_contact?: boolean
  owner_role_id?: string | null
  owner_role?: OwnerRoleType | null
}
```

---

## 4. Constantes

### `lib/constants.ts` — Adições

```typescript
export const MARITAL_REGIMES = {
  comunhao_adquiridos: 'Comunhão de Adquiridos',
  comunhao_geral: 'Comunhão Geral de Bens',
  separacao_bens: 'Separação de Bens',
  uniao_facto: 'União de Facto',
} as const

export const MARRIED_STATUSES = ['casado', 'uniao_facto'] as const

export const OWNER_ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  proprietario: { bg: 'bg-blue-100', text: 'text-blue-800' },
  conjuge: { bg: 'bg-pink-100', text: 'text-pink-800' },
  socio: { bg: 'bg-amber-100', text: 'text-amber-800' },
  herdeiro: { bg: 'bg-purple-100', text: 'text-purple-800' },
  usufrutuario: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  nu_proprietario: { bg: 'bg-slate-100', text: 'text-slate-800' },
} as const
```

---

## 5. Validações (Zod)

### `lib/validations/owner.ts`

- `ownerSchema` — schema completo do proprietário (singular + colectiva)
- `propertyOwnerSchema` — schema da junction table (inclui `owner_role_id`)

```typescript
export const propertyOwnerSchema = z.object({
  property_id: z.string().uuid(),
  owner_id: z.string().uuid(),
  ownership_percentage: z.number().min(0).max(100).default(100),
  is_main_contact: z.boolean().default(false),
  owner_role_id: z.string().uuid().optional(),
})
```

---

## 6. APIs (Route Handlers)

### 6a. `GET /api/owner-role-types` (NOVO)

**Ficheiro:** `app/api/owner-role-types/route.ts`

Lista todos os `owner_role_types` activos, ordenados por `order_index`.

**Response:** `OwnerRoleType[]`

---

### 6b. `POST /api/properties/[id]/owners` (NOVO)

**Ficheiro:** `app/api/properties/[id]/owners/route.ts`

Adiciona proprietário a um imóvel. Suporta dois modos:

1. **Vincular existente:** `{ owner_id, ownership_percentage, is_main_contact, owner_role_id }`
2. **Criar inline:** `{ owner: { person_type, name, nif, ... }, ownership_percentage, is_main_contact, owner_role_id }`

Validações:
- Verifica NIF duplicado ao criar inline
- Verifica se já está associado ao imóvel (409 se sim)
- Limpa strings vazias para `null`

---

### 6c. `PUT /api/properties/[id]/owners` (NOVO)

**Ficheiro:** `app/api/properties/[id]/owners/route.ts`

Batch update dos dados da junction table.

**Body:**
```json
{
  "owners": [
    {
      "owner_id": "uuid",
      "ownership_percentage": 50,
      "is_main_contact": true,
      "owner_role_id": "uuid"
    }
  ]
}
```

Validações:
- Mínimo 1 proprietário
- Exactamente 1 `is_main_contact = true`

---

### 6d. `DELETE /api/properties/[id]/owners/[ownerId]` (NOVO)

**Ficheiro:** `app/api/properties/[id]/owners/[ownerId]/route.ts`

Remove proprietário do imóvel (apenas junction, não apaga o owner).

Validações:
- Não permite remover o último proprietário
- Valida UUIDs

---

### 6e. `GET /api/processes/[id]` (ACTUALIZADO)

**Ficheiro:** `app/api/processes/[id]/route.ts`

Select de `property_owners` actualizado para incluir:
```
owner_role_id,
owner_role:owner_role_types(id, name, label, color),
owner:owners(*)
```

O response mapeia `owner_role` para cada proprietário.

---

## 7. Componentes

### 7a. `DatePicker` (NOVO)

**Ficheiro:** `components/ui/date-picker.tsx`

Componente reutilizável que combina Popover + Calendar (shadcn) com:
- Aceita/emite ISO strings (`YYYY-MM-DD`)
- Display em `dd/MM/yyyy` com locale PT
- Dropdown de mês/ano para navegação rápida
- Range de anos: 1920–2040

Substitui todos os `<input type="date">` nativos nos formulários de proprietário.

---

### 7b. `ProcessOwnerCard` (ACTUALIZADO)

**Ficheiro:** `components/processes/process-owner-card.tsx`

- Badge colorido por role (Proprietário azul, Cônjuge rosa, Sócio amber, etc.)
- Usa `OWNER_ROLE_COLORS` para cores
- Mantém badges existentes (Principal, percentagem)

---

### 7c. `OwnerEditSheet` (NOVO)

**Ficheiro:** `components/processes/owner-edit-sheet.tsx`

Sheet lateral (max-width 800px) com:

**Estrutura:**
- Header fixo com `border-b`
- Conteúdo scrollável (`flex-1 overflow-y-auto`)
- Footer fixo com `border-t` e botões (Cancelar / Guardar)
- Form submit via `form="owner-edit-form"` (footer fora do form)

**Secções:**
1. **Relação com o Imóvel** — Papel (Select com role types), Percentagem (Input number), Contacto Principal (Switch)
2. **Tipo de Pessoa** — Select singular/colectiva
3. **Dados Gerais** — Nome, NIF, Email, Telefone, Morada, Código Postal, Localidade
4. **Identificação** (singular) — Data Nascimento (DatePicker), Nacionalidade, Naturalidade, Estado Civil (Select), Regime Matrimonial (Select com `MARITAL_REGIMES`)
5. **Documento de Identificação** (singular) — Tipo (Select), Número, Validade (DatePicker), Emitido por
6. **Profissão e Residência** (singular) — Profissão, Última Profissão, Residente PT (Switch), País de Residência
7. **PEP** (singular) — Switch + Cargo PEP
8. **Representante Legal** (colectiva) — **OwnerSearch** para vincular pessoa existente + campos manuais (Nome, NIF, Documento)
9. **Dados da Empresa** (colectiva) — Objecto Social, Natureza Jurídica, País de Constituição, CAE, RCBE, Sucursais
10. **Observações** — Textarea

**Comportamento ao guardar:**
1. `PUT /api/owners/[id]` — actualiza dados do proprietário
2. `PUT /api/properties/[propertyId]/owners` — actualiza dados da junction
3. Se estado civil = casado/união de facto → trigger `onSpousePrompt`

---

### 7d. `SpouseRegistrationDialog` (NOVO)

**Ficheiro:** `components/processes/spouse-registration-dialog.tsx`

Dialog com 2 tabs:
1. **Pesquisar Existente** — Input de pesquisa → lista de resultados → seleccionar
2. **Criar Novo** — Nome, NIF, Email, Telefone, Data Nascimento (DatePicker), Tipo Doc, Nº Doc

Funcionalidades:
- Percentagem de propriedade ajustável (default 50%)
- Auto-atribui role `cônjuge`
- `POST /api/properties/[propertyId]/owners` com owner existente ou inline

---

### 7e. `OwnershipSummaryBar` (NOVO)

**Ficheiro:** `components/processes/ownership-summary-bar.tsx`

Barra no topo da secção de proprietários:
- Contagem de proprietários
- Progress bar da percentagem alocada (verde se 100%, amber se diferente, vermelho se >100%)
- Pills com primeiro nome + percentagem + cor do role
- Warnings: percentagem ≠ 100%, sem contacto principal
- Botão "Adicionar" (para futuro uso)

---

### 7f. `ProcessOwnersTab` (REESCRITO)

**Ficheiro:** `components/processes/process-owners-tab.tsx`

Integra todos os componentes:
- `OwnershipSummaryBar` no topo
- Cards expandidos por proprietário com DisplayFields + DocumentsSection
- Botão "Editar" → abre `OwnerEditSheet`
- Botão "Remover" → AlertDialog de confirmação (só visível se >1 proprietário)
- `SpouseRegistrationDialog` trigger após edição com estado civil casado

**Props:**
```typescript
interface ProcessOwnersTabProps {
  owners: any[]
  documents: ProcessDocument[]
  propertyId: string
  onDocumentUploaded?: () => void
  onOwnersChanged?: () => void
}
```

---

### 7g. `OwnerForm` (ACTUALIZADO)

**Ficheiro:** `components/owners/owner-form.tsx`

- Regime Matrimonial: `Input` → `Select` com `MARITAL_REGIMES`
- Data Nascimento + Validade Doc: `Input type="date"` → `DatePicker`
- Representante Legal (colectiva): adicionado `OwnerSearch` para vincular pessoa existente

---

### 7h. Página do Processo (ACTUALIZADA)

**Ficheiro:** `app/dashboard/processos/[id]/page.tsx`

- `ProcessOwnersTab` recebe `propertyId={instance.property_id}`
- Callback `onOwnersChanged={loadProcess}` para refetch

---

## 8. Ficheiros Criados/Modificados

| Ficheiro | Estado | Descrição |
|---|---|---|
| `components/ui/date-picker.tsx` | **NOVO** | DatePicker reutilizável (Popover + Calendar) |
| `components/processes/owner-edit-sheet.tsx` | **NOVO** | Sheet lateral de edição completa |
| `components/processes/spouse-registration-dialog.tsx` | **NOVO** | Dialog para registar cônjuge |
| `components/processes/ownership-summary-bar.tsx` | **NOVO** | Barra resumo com progress |
| `app/api/owner-role-types/route.ts` | **NOVO** | GET roles activos |
| `app/api/properties/[id]/owners/route.ts` | **NOVO** | POST (adicionar) + PUT (batch update) |
| `app/api/properties/[id]/owners/[ownerId]/route.ts` | **NOVO** | DELETE (remover do imóvel) |
| `components/processes/process-owner-card.tsx` | Actualizado | Badge de role colorido |
| `components/processes/process-owners-tab.tsx` | Reescrito | Integração de todos os componentes |
| `components/owners/owner-form.tsx` | Actualizado | DatePicker, Select regime, OwnerSearch rep. legal |
| `app/api/processes/[id]/route.ts` | Actualizado | Join de owner_role_types no select |
| `app/dashboard/processos/[id]/page.tsx` | Actualizado | Props propertyId + onOwnersChanged |
| `lib/constants.ts` | Actualizado | MARITAL_REGIMES, MARRIED_STATUSES, OWNER_ROLE_COLORS |
| `lib/validations/owner.ts` | Actualizado | owner_role_id no propertyOwnerSchema |
| `types/owner.ts` | Actualizado | OwnerRoleType, OwnerWithRole |
| `types/database.ts` | Regenerado | Inclui owner_role_types + owner_role_id |

---

## 9. Dependências

Nenhuma nova dependência adicionada. Usa componentes já existentes:
- `react-day-picker` (via shadcn Calendar)
- `date-fns` + `date-fns/locale/pt`
- Todos os componentes shadcn já instalados (Calendar, Popover, Sheet, Select, Badge, etc.)

---

## 10. Adicionar Novo Proprietário + Integração com Fluxo de Tarefas

### 10a. API: `POST /api/processes/[id]/owners/populate-tasks` (NOVO)

**Ficheiro:** `app/api/processes/[id]/owners/populate-tasks/route.ts`

Cria tarefas (e subtarefas) no processo para um proprietário específico, baseado no template.

**Lógica:**
1. Busca o `tpl_process_id` do processo
2. Busca todas as `tpl_tasks` do template
3. Filtra tarefas onde `config.owner_type` = `person_type` do owner (ex: `singular` ou `coletiva`)
4. Para cada tarefa correspondente, cria `proc_task` com:
   - `title` = `"Titulo Original — Nome do Owner"`
   - `owner_id` = ID do proprietário
   - `config` = config original + `{ owner_id: ... }`
5. Para cada tarefa com subtarefas (`tpl_subtasks`), cria `proc_subtasks` com resolução de variantes por `person_type`
6. Executa `autoCompleteTasks()` (docs existentes) e `recalculateProgress()`

**Validações:**
- Processo deve ter template (já aprovado)
- Owner deve estar associado ao imóvel
- Não duplica: retorna 409 se já existem tarefas para este owner
- Retorna `{ tasks_created: N, owner_name: "..." }`

---

### 10b. `AddOwnerDialog` (NOVO)

**Ficheiro:** `components/processes/add-owner-dialog.tsx`

Dialog com 2 tabs (Pesquisar Existente / Criar Novo):
- **Tab Pesquisar:** Reutiliza `OwnerSearch` com `excludeIds` dos owners já associados
- **Tab Criar:** Formulário simples (Tipo de Pessoa, Nome, NIF, Email, Telefone)
- **Campos comuns:** Papel (Select com role types), Percentagem (Input number)
- Após adicionar via `POST /api/properties/[id]/owners`:
  - Se `processId` está definido → abre **AlertDialog de confirmação**: "Deseja criar as tarefas correspondentes no fluxo do processo?"
  - **Sim** → chama `POST /api/processes/[id]/owners/populate-tasks`
  - **Não** → apenas adiciona o owner sem tarefas

---

### 10c. Botão "Adicionar ao fluxo de tarefas" (NOVO)

**No `ProcessOwnersTab`:** cada card de proprietário que **não tem tarefas** no processo mostra um botão:
```
[📋 Adicionar ao fluxo de tarefas]
```
- Visível apenas quando `processId` está definido e `ownerHasTasksMap[owner.id]` é `false`
- Ao clicar, chama `POST /api/processes/[id]/owners/populate-tasks` directamente
- Toast com resultado: "X tarefa(s) criada(s) para Nome"

---

### 10d. Props actualizadas do `ProcessOwnersTab`

```typescript
interface ProcessOwnersTabProps {
  owners: any[]
  documents: ProcessDocument[]
  propertyId: string
  processId?: string                          // NOVO
  ownerHasTasksMap?: Record<string, boolean>  // NOVO
  onDocumentUploaded?: () => void
  onOwnersChanged?: () => void
}
```

### 10e. Página do Processo (ACTUALIZADA)

- Computa `ownerHasTasksMap` a partir de `process.stages[].tasks[].owner_id`
- Passa `processId={instance.id}` e `ownerHasTasksMap` ao `ProcessOwnersTab`

---

## 11. Ficheiros Adicionais (Fase 2)

| Ficheiro | Estado | Descrição |
|---|---|---|
| `app/api/processes/[id]/owners/populate-tasks/route.ts` | **NOVO** | Cria tarefas do template para um owner específico |
| `components/processes/add-owner-dialog.tsx` | **NOVO** | Dialog para adicionar proprietário com opção de criar tarefas |
| `components/processes/process-owners-tab.tsx` | Actualizado | Integra AddOwnerDialog + botão "Adicionar ao fluxo" |
| `app/dashboard/processos/[id]/page.tsx` | Actualizado | Passa processId + ownerHasTasksMap |

---

## 12. Pendente / Próximos Passos

- [ ] Testar fluxo completo: adicionar owner → criar tarefas → verificar no pipeline
- [ ] Considerar também adicionar subtarefas em tarefas existentes que fazem fan-out por owner (subtarefas com `owner_scope`)
