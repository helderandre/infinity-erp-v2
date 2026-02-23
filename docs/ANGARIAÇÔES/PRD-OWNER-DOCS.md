# PRD — Documentos por Proprietário nas Angariações e Processos

**Data:** 2026-02-23
**Baseado em:** `SPEC-OWNER-DOCS-ANGARIACOES-PROCESSOS.md`
**Tipo:** Pesquisa de Codebase + Padrões de Implementação

---

## 1. Mapa de Ficheiros Afectados

### 1.1 Ficheiros a CRIAR (1)

| Ficheiro | Linhas Est. | Função |
|----------|-------------|--------|
| `components/acquisitions/owner-documents-inline.tsx` | ~120 | Upload de docs condicionais por `person_type` no Step 3 |

### 1.2 Ficheiros a MODIFICAR (6)

| # | Ficheiro | Linhas Actuais | Modificação | Complexidade |
|---|----------|----------------|-------------|--------------|
| 1 | `components/acquisitions/step-3-owners.tsx` | 264 | Adicionar `<OwnerDocumentsInline>` após KYC | Simples |
| 2 | `components/acquisitions/step-5-documents.tsx` | 140 | Filtrar categorias `Proprietário` / `Proprietário Empresa` | Simples |
| 3 | `components/acquisitions/acquisition-form.tsx` | 332 | Upload loop já envia `owner_id` — **verificar apenas** | Verificar |
| 4 | `components/processes/process-tasks-section.tsx` | 270 | Mostrar badge com `task.owner` (nome + tipo) | Simples |
| 5 | `components/processes/task-upload-action.tsx` | 134 | Usar `task.owner_id` em vez de `mainOwnerId` | Simples |
| 6 | `app/api/processes/[id]/route.ts` | 163 | Join de `owners` na query de `proc_tasks` | Simples |

### 1.3 Ficheiros a VERIFICAR (sem alteração provável)

| # | Ficheiro | Linhas | Verificação | Estado |
|---|----------|--------|-------------|--------|
| 1 | `app/api/acquisitions/route.ts` | 281 | Retorna `owner_ids` | **JA RETORNA** |
| 2 | `app/api/documents/upload/route.ts` | 195 | Aceita `owner_id` no FormData | **JA ACEITA** |
| 3 | `app/api/libraries/doc-types/route.ts` | 74 | Suporta `?category=X` | **JA SUPORTA** |
| 4 | `app/api/owners/[id]/documents/route.ts` | 32 | Lista docs de um owner | **JA EXISTE** |
| 5 | `types/document.ts` | 79 | `DeferredDocument` tem `owner_index` | **JA TEM** |
| 6 | `types/process.ts` | 65 | `ProcessOwner` com `person_type` | **JA TEM** |
| 7 | `lib/validations/acquisition.ts` | 147 | Schema docs tem `owner_id` | **JA TEM** |

---

## 2. Estado Actual da BD (Confirmado via SQL)

### 2.1 Categorias de `doc_types`

```
Contratual | Imóvel | Jurídico | Jurídico Especial | Proprietário | Proprietário Empresa
```

### 2.2 Doc Types de Proprietário (Singular)

| ID | Nome | Categoria |
|----|------|-----------|
| `16706cb5-1a27-413d-ad75-ec6aee1c3674` | Cartao de Cidadao | Proprietário |
| `0898d9ba-890f-4877-8f56-c370b22af8d9` | Comprovativo de Estado Civil | Proprietário |
| `02b63b46-d5ed-4314-9e83-1447095f8a15` | Ficha de Branqueamento de Capitais | Proprietário |

### 2.3 Doc Types de Proprietário Empresa (Coletiva)

| ID | Nome | Categoria |
|----|------|-----------|
| `e433c9f1-b323-43ac-9607-05b31f72bbb9` | Certidao Permanente da Empresa | Proprietário Empresa |
| `2f911296-a215-407b-b826-dba2a17424ad` | Pacto Social / Estatutos | Proprietário Empresa |
| `425ee306-2e33-4cf6-aa35-5e32359c4927` | Ata de Poderes para Venda | Proprietário Empresa |
| `6dd8bf4c-d354-4e0e-8098-eda5a8767fd1` | RCBE | Proprietário Empresa |
| `f9a3ee8f-04a6-40f0-aae0-021ae7c48c6d` | Ficha de Branqueamento (Empresa) | Proprietário Empresa |

### 2.4 Colunas `owner_id` (JA EXISTEM)

| Tabela | Coluna | FK | Estado |
|--------|--------|----|--------|
| `proc_tasks` | `owner_id` (uuid, nullable) | `proc_tasks_owner_id_fkey → owners.id` | Existe, todas 58 rows com NULL |
| `doc_registry` | `owner_id` (uuid, nullable) | `doc_registry_owner_id_fkey → owners.id` | Existe, 1 row com owner_id preenchido |

### 2.5 Template Tasks com `owner_type` no config

**Singular (3 tasks):**
```json
{ "doc_type_id": "16706cb5-...", "owner_type": "singular" }  // CC
{ "doc_type_id": "0898d9ba-...", "owner_type": "singular" }  // Estado Civil
{ "doc_type_id": "02b63b46-...", "owner_type": "singular" }  // Branqueamento
```

**Coletiva (5 tasks):**
```json
{ "doc_type_id": "e433c9f1-...", "owner_type": "coletiva" }  // Certidão Permanente
{ "doc_type_id": "2f911296-...", "owner_type": "coletiva" }  // Pacto Social
{ "doc_type_id": "425ee306-...", "owner_type": "coletiva" }  // Ata poderes
{ "doc_type_id": "6dd8bf4c-...", "owner_type": "coletiva" }  // RCBE
{ "doc_type_id": "f9a3ee8f-...", "owner_type": "coletiva" }  // Branqueamento Emp.
```

### 2.6 Triggers na BD (JA ACTIVOS)

| Trigger | Tabela | Quando | Função |
|---------|--------|--------|--------|
| `trg_auto_complete_tasks_on_doc_insert` | `doc_registry` | AFTER INSERT | Completa tarefas UPLOAD matching por `doc_type_id` + `owner_id` |
| `trg_auto_resolve_owner_id` | `doc_registry` | BEFORE INSERT | Auto-resolve `owner_id` quando categoria começa com "Proprietário" |

**`populate_process_tasks()`** — Chamada explicitamente pelo endpoint de aprovação. Multiplica tarefas por proprietário quando `config.owner_type` está definido. Append ` -- {nome}` ao título.

**`auto_complete_tasks_on_doc_insert()`** — Matching preciso: `pt.owner_id IS NULL OR pt.owner_id = NEW.owner_id`.

---

## 3. Padrões de Implementação Existentes

### 3.1 Padrão: Rendering Condicional por `person_type`

**Ficheiro:** `components/acquisitions/step-3-owners.tsx` (linhas 246-257)

```tsx
{/* KYC Condicional */}
{form.watch(`owners.${index}.person_type`) === 'singular' && (
  <OwnerKycSingular form={form} index={index} />
)}

{form.watch(`owners.${index}.person_type`) === 'coletiva' && (
  <>
    <OwnerKycColetiva form={form} index={index} />
    {!form.watch(`owners.${index}.rcbe_code`) && (
      <OwnerBeneficiariesList form={form} ownerIndex={index} />
    )}
  </>
)}
```

**Reutilizar para:** Colocar `<OwnerDocumentsInline>` logo após estes blocos, com a mesma lógica condicional.

### 3.2 Padrão: Secção Collapsible (KYC Singular)

**Ficheiro:** `components/acquisitions/owner-kyc-singular.tsx` (linhas 39-51)

```tsx
export function OwnerKycSingular({ form, index }: OwnerKycSingularProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between" type="button">
          Dados KYC — Pessoa Singular
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Campos */}
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Reutilizar para:** O `OwnerDocumentsInline` pode seguir o mesmo padrão Collapsible, ou ser sempre visível (mais directo).

### 3.3 Padrão: Gestão de Array no Form State

**Ficheiro:** `components/acquisitions/step-3-owners.tsx` (linhas 32-63)

```tsx
const owners = form.watch('owners') || []

const addOwner = () => {
  form.setValue('owners', [...owners, { person_type: 'singular', name: '', ... }])
}

const removeOwner = (index: number) => {
  const updated = owners.filter((_: any, i: number) => i !== index)
  if (owners[index]?.is_main_contact && updated.length > 0) {
    updated[0].is_main_contact = true
  }
  form.setValue('owners', updated)
}
```

**Reutilizar para:** Manipulação do array `documents` no form state quando docs de proprietário são adicionados/removidos.

### 3.4 Padrão: Upload Deferred (Step 5 Actual)

**Ficheiro:** `components/acquisitions/step-5-documents.tsx` (linhas 65-100)

```tsx
const handleFileSelected = useCallback(
  (file: File, docTypeId: string) => {
    const category = docTypeCategoryMap[docTypeId] || ''
    const isOwnerDoc = OWNER_DOC_CATEGORIES.some((c) => category.startsWith(c))

    let ownerIndex: number | undefined
    if (isOwnerDoc && owners.length > 0) {
      if (owners.length === 1) {
        ownerIndex = 0
      } else {
        const mainIdx = owners.findIndex((o) => o.is_main_contact)
        ownerIndex = mainIdx >= 0 ? mainIdx : 0
      }
    }

    const currentDocs = form.getValues('documents') || []
    form.setValue('documents', [
      ...currentDocs,
      {
        doc_type_id: docTypeId,
        doc_type_category: category,
        file,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        owner_index: ownerIndex,
        metadata: {},
      },
    ])
    toast.success(`Ficheiro "${file.name}" seleccionado`)
  },
  [form, docTypeCategoryMap, owners]
)
```

**Reutilizar para:** O `OwnerDocumentsInline` no Step 3 usará EXACTAMENTE o mesmo padrão — guardar `File` no array `documents` do form state com `owner_index` explícito.

### 3.5 Padrão: Upload Loop Pós-Criação

**Ficheiro:** `components/acquisitions/acquisition-form.tsx` (linhas 175-212)

```tsx
// Separar File objects das URLs já uploaded
const pendingFiles: Array<{ file: File; doc_type_id: string; owner_index?: number }> = []

for (const doc of (data.documents || [])) {
  if (doc.file instanceof File) {
    pendingFiles.push({ file: doc.file, doc_type_id: doc.doc_type_id, owner_index: doc.owner_index })
  } else if (doc.file_url) {
    jsonDocuments.push(doc)
  }
}

// Após API retornar property_id + owner_ids:
for (const pending of pendingFiles) {
  const formData = new FormData()
  formData.append('file', pending.file)
  formData.append('doc_type_id', pending.doc_type_id)
  formData.append('property_id', result.property_id)

  if (pending.owner_index !== undefined && result.owner_ids?.[pending.owner_index]) {
    formData.append('owner_id', result.owner_ids[pending.owner_index])
  }

  await fetch('/api/documents/upload', { method: 'POST', body: formData })
}
```

**Estado:** JA IMPLEMENTADO. O upload loop já resolve `owner_index` → `owner_id`. **Nenhuma alteração necessária.**

### 3.6 Padrão: Componentes de Upload Existentes

**Hierarquia de componentes de documentos:**

```
DocumentsSection.tsx  — Orquestra upload por categoria
  └── DocCategoryCard.tsx  — Card com progress ring por categoria
       └── DocRow.tsx  — Linha individual por doc_type (expandível)
            └── UploadZone.tsx  — Drag-and-drop com validação
```

**UploadZone** suporta dois modos:
- `deferred=true` → chama `onFileSelected(file, docTypeId)` (guarda File no state)
- `deferred=false` → upload imediato para `/api/documents/upload`

**Reutilizar para:** O `OwnerDocumentsInline` pode usar `<UploadZone>` directamente em modo deferred, ou usar um `<input type="file">` mais simples (como na spec). A decisão depende da consistência visual desejada.

### 3.7 Padrão: Owner ID no Task Upload

**Ficheiro:** `components/processes/process-tasks-section.tsx` (linhas 64-68, 292-302)

```tsx
// Extrair mainOwnerId dos owners do processo
const mainOwnerId = useMemo(() => {
  const main = owners.find((o) => o.is_main_contact)
  return main?.id || owners[0]?.id || undefined
}, [owners])

// Passar ao TaskUploadAction
<TaskUploadAction
  taskId={task.id}
  processId={processId}
  propertyId={propertyId}
  docTypeId={task.config.doc_type_id}
  ownerId={mainOwnerId}    // ← Sempre o main contact
  onCompleted={onTaskUpdate}
/>
```

**Problema:** Actualmente usa `mainOwnerId` para TODAS as tarefas — não distingue qual owner pertence a qual tarefa.

**Solução:** Usar `task.owner_id` (da nova coluna) quando disponível, fallback para `mainOwnerId`:

```tsx
const taskOwnerId = task.owner_id || mainOwnerId
<TaskUploadAction ownerId={taskOwnerId} ... />
```

### 3.8 Padrão: API Process Detail (GET)

**Ficheiro:** `app/api/processes/[id]/route.ts` (linhas 47-108)

**Query actual de proc_tasks:**
```typescript
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`
    *,
    assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name)
  `)
  .eq('proc_instance_id', processId)
  .order('stage_order_index')
  .order('order_index')
```

**Falta:** Join com `owners` para trazer `owner.name` e `owner.person_type`:

```typescript
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`
    *,
    assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name),
    owner:owners!proc_tasks_owner_id_fkey(id, name, person_type)
  `)
  .eq('proc_instance_id', processId)
  .order('stage_order_index')
  .order('order_index')
```

---

## 4. Tipos TypeScript Relevantes

### 4.1 `types/document.ts` — Interfaces Actuais

```typescript
// DeferredDocument (usado no Step 5)
export interface DeferredDocument {
  id: string                    // crypto.randomUUID()
  doc_type_id: string
  doc_type_name: string
  doc_type_category: string
  file: File
  file_name: string
  file_size: number
  file_type: string
  owner_id?: string
  owner_index?: number          // ← JA EXISTE
}

// PendingDocument
export interface PendingDocument {
  doc_type_id: string
  doc_type_name: string
  doc_type_category: string
  file_url?: string
  file_name?: string
  valid_until?: string
  metadata?: Record<string, any>
  owner_id?: string
  existing_doc?: Document | null
  is_uploaded: boolean
}

// Document (doc_registry row)
export interface Document {
  id: string
  property_id: string | null
  owner_id: string | null       // ← JA EXISTE
  doc_type_id: string
  file_url: string
  file_name: string
  uploaded_by: string
  valid_until: string | null
  status: 'active' | 'archived' | 'expired'
  metadata: { size?: number; mimetype?: string } | null
  notes: string | null
  created_at: string
  updated_at: string | null
  doc_type?: DocType
  uploaded_by_user?: { id: string; commercial_name: string }
}

// DocType
export interface DocType {
  id: string
  name: string
  description: string | null
  category: string
  allowed_extensions: string[]
  default_validity_months: number | null
  is_system: boolean
}
```

### 4.2 `types/process.ts` — Interfaces Actuais

```typescript
export interface ProcessOwner {
  id: string
  name: string
  nif: string | null
  person_type: 'singular' | 'coletiva'
  ownership_percentage: number
  is_main_contact: boolean
}

export interface ProcessDetail {
  instance: ProcessInstance
  stages: ProcessStageWithTasks[] | null
  owners: ProcessOwner[]
  documents: ProcessDocument[]
}
```

**A adicionar ao tipo de ProcessTask:**
```typescript
// No interface da tarefa (ProcTask ou equivalente):
owner_id: string | null
owner?: {
  id: string
  name: string
  person_type: 'singular' | 'coletiva'
}
```

### 4.3 `lib/validations/acquisition.ts` — Schema de Documentos

```typescript
documents: z
  .array(
    z.object({
      doc_type_id: z.string(),
      file_url: z.string().optional(),
      file_name: z.string().optional(),
      file_size: z.number().optional(),
      file_type: z.string().optional(),
      valid_until: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      owner_id: z.string().optional(),  // ← JA TEM
    })
  )
  .optional(),
```

**Falta:** `owner_index` no schema Zod. Verificar se é necessário ou se só é usado no runtime.

### 4.4 `lib/constants.ts` — Constantes Relevantes

```typescript
export const DOC_CATEGORIES: Record<string, string> = {
  'Contratual': 'Contratual',
  'Imóvel': 'Imóvel',
  'Jurídico': 'Jurídico',
  'Jurídico Especial': 'Jurídico Especial',
  'Proprietário': 'Proprietário',
  'Proprietário Empresa': 'Proprietário Empresa',
}

export const PERSON_TYPES = {
  singular: 'Singular',
  coletiva: 'Coletiva',
} as const

export const DOC_LABELS = {
  upload: 'Carregar documento',
  already_exists_valid: 'Ja existe (valido)',
  already_exists_expired: 'Ja existe (expirado)',
  // ...
} as const
```

---

## 5. Componentes UI Reutilizáveis

### 5.1 Para o `OwnerDocumentsInline`

| Componente | Import | Uso |
|------------|--------|-----|
| `UploadZone` | `@/components/documents/UploadZone` | Drag-and-drop com validação (modo deferred) |
| `Badge` | `@/components/ui/badge` | Status de documento existente |
| `Skeleton` | `@/components/ui/skeleton` | Loading state |
| `Collapsible` | `@/components/ui/collapsible` | Secção expansível (opcional) |
| `FileText, Check, AlertTriangle, Upload` | `lucide-react` | Ícones |

### 5.2 Para o Badge de Owner nas Tarefas

| Componente | Import | Uso |
|------------|--------|-----|
| `Badge` | `@/components/ui/badge` | Badge com nome do proprietário |
| `User, Building2` | `lucide-react` | Ícone singular/coletiva |

---

## 6. APIs Existentes que Servem a Implementação

### 6.1 Fetch de Doc Types por Categoria

```
GET /api/libraries/doc-types?category=Proprietário
GET /api/libraries/doc-types?category=Proprietário%20Empresa
```

**Resposta:** Array de `DocType` filtrado.

### 6.2 Fetch de Docs de um Owner

```
GET /api/owners/{ownerId}/documents
```

**Resposta:** Array de `Document` com joins (`doc_type`, `uploaded_by_user`), excluindo archived.

### 6.3 Upload de Documento

```
POST /api/documents/upload
FormData: file, doc_type_id, property_id?, owner_id?, consultant_id?, valid_until?
```

**Auto-resolve:** Se `owner_id` não fornecido mas `property_id` + categoria "Proprietário*" → resolve para main_contact.

### 6.4 Criação de Angariação

```
POST /api/acquisitions
Response: { property_id, proc_instance_id, owner_ids: string[], ... }
```

**`owner_ids`** já retornado na mesma ordem do input.

---

## 7. Decisões de Implementação

### 7.1 Onde colocar os docs de owner?

**Decisão:** Após os blocos de KYC no Step 3, dentro do card de cada proprietário. O `OwnerDocumentsInline` aparece imediatamente abaixo do KYC.

```
Card Proprietário [index]
├── Campos básicos (nome, NIF, email, phone, %)
├── KYC Singular/Coletiva (Collapsible)
├── Beneficiários (se coletiva + sem RCBE)
└── **Documentos do Proprietário** ← NOVO
```

### 7.2 Como filtrar categorias no Step 5?

**Decisão:** O Step 5 já importa `ACQUISITION_DOC_CATEGORIES` e `OWNER_DOC_CATEGORIES`. Basta filtrar:

```typescript
// step-5-documents.tsx (actual)
const ACQUISITION_DOC_CATEGORIES = [
  'Contratual', 'Imóvel', 'Jurídico', 'Jurídico Especial',
  'Proprietário', 'Proprietário Empresa',  // ← REMOVER ESTAS
]

// Novo:
const STEP5_DOC_CATEGORIES = ['Contratual', 'Imóvel', 'Jurídico', 'Jurídico Especial']
```

### 7.3 Como guardar docs no form state?

**Decisão:** Reutilizar o array `documents` do form state. O `OwnerDocumentsInline` adiciona entradas com `owner_index` explícito (o índice do proprietário no array `owners`).

### 7.4 Como mostrar owner nas tarefas?

**Decisão:** Adicionar join na API + badge visual. O título já inclui ` -- {nome}` via trigger, mas o badge melhora a UX.

### 7.5 Usar `UploadZone` ou `<input>` simples?

**Decisão:** Usar `<input type="file">` simples (como na spec) para manter o componente leve e inline. O `UploadZone` é mais pesado e orientado a drag-and-drop full-width.

---

## 8. Ordem de Execução Recomendada

```
1. types/process.ts                       (adicionar owner ao ProcessTask)
2. owner-documents-inline.tsx             (criar componente novo)
3. step-3-owners.tsx                      (integrar componente)
4. step-5-documents.tsx                   (filtrar categorias owner)
5. app/api/processes/[id]/route.ts        (join owners nas tasks)
6. process-tasks-section.tsx              (badge owner + task.owner_id)
7. task-upload-action.tsx                 (usar task.owner_id)
8. npm run build                          (verificar zero erros)
```

---

## 9. Riscos e Notas

1. **Schema Zod:** O schema `documents` no Zod NÃO tem `owner_index` — só tem `owner_id`. Mas o form state usa `owner_index` em runtime. Verificar se o Zod rejeita campos extra ou se `.passthrough()` está activo.

2. **Docs existentes:** Quando um owner já existe na BD com docs, a API `GET /api/owners/{id}/documents` retorna os docs. O componente deve cruzar com os `doc_types` da categoria para mostrar "Já existe (válido)".

3. **Multiple owners:** Cada `OwnerDocumentsInline` tem `ownerIndex` fixo. Os docs no form state usam `owner_index` para resolver `owner_id` no upload loop.

4. **Trigger auto-complete:** Quando um doc é uploaded para `doc_registry` com `owner_id`, a trigger `auto_complete_tasks_on_doc_insert` completa automaticamente tarefas matching. Isto funciona independentemente do frontend.

5. **Existing proc_tasks:** Actualmente todas as 58 `proc_tasks` têm `owner_id = NULL` porque foram criadas antes das migrações. Novos processos terão `owner_id` preenchido pela `populate_process_tasks()`.
