# SPEC — Documentos por Proprietário (Implementação Táctica)

**Data:** 2026-02-23
**Baseado em:** `PRD-OWNER-DOCS.md`
**Objectivo:** Permitir upload de docs de proprietário no Step 3 da angariação, filtrar categorias owner do Step 5, e mostrar owner nas tarefas do processo.

---

## Ficheiros a CRIAR (1)

### 1. `components/acquisitions/owner-documents-inline.tsx`

**O que fazer:** Criar componente inline de upload de documentos por proprietário, para ser usado dentro do card de cada owner no Step 3.

**Props:**
```tsx
interface OwnerDocumentsInlineProps {
  form: UseFormReturn<any>
  ownerIndex: number               // índice no array form.owners
  personType: 'singular' | 'coletiva'
}
```

**Comportamento:**
1. Usar `personType` para decidir qual categoria de `doc_types` buscar:
   - `singular` → `GET /api/libraries/doc-types?category=Proprietário`
   - `coletiva` → `GET /api/libraries/doc-types?category=Proprietário%20Empresa`

2. Fazer fetch dos doc_types no `useEffect` com `personType` como dependência.

3. Para cada `DocType` retornado, renderizar uma linha com:
   - Nome do tipo de documento
   - `<input type="file">` (botão simples, não UploadZone)
   - Se já houver um ficheiro no `form.getValues('documents')` para esse `doc_type_id` + `owner_index`, mostrar badge "Seleccionado" com nome do ficheiro e botão de remover

4. Quando o utilizador selecciona ficheiro, adicionar ao array `documents` do form state (mesmo array do Step 5):
   ```tsx
   const currentDocs = form.getValues('documents') || []
   form.setValue('documents', [
     ...currentDocs,
     {
       doc_type_id: docType.id,
       doc_type_category: docType.category,
       file: file,
       file_name: file.name,
       file_size: file.size,
       file_type: file.type,
       owner_index: ownerIndex,     // ← índice do owner neste form
       metadata: {},
     },
   ])
   ```

5. Para remover, filtrar o array `documents` excluindo a entrada com esse `doc_type_id` + `owner_index`.

**Padrão visual:** Collapsible, seguindo o mesmo padrão de `owner-kyc-singular.tsx`:
```tsx
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger asChild>
    <Button variant="ghost" size="sm" className="w-full justify-between" type="button">
      Documentos — {personType === 'singular' ? 'Pessoa Singular' : 'Pessoa Colectiva'}
      <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent className="space-y-3 pt-4">
    {/* Lista de doc types com input file */}
  </CollapsibleContent>
</Collapsible>
```

**Imports necessários:**
```tsx
import { useState, useEffect, useMemo } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, FileText, X, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import type { DocType } from '@/types/document'
```

---

## Ficheiros a MODIFICAR (5)

### 2. `components/acquisitions/step-3-owners.tsx`

**O que fazer:** Importar e renderizar `<OwnerDocumentsInline>` após os blocos de KYC/Beneficiários, dentro do card de cada proprietário.

**Onde inserir:** Após a linha 257 (fecho do bloco condicional coletiva `</>`), antes do fecho do `</div>` (linha 258).

**Código a adicionar:**

Adicionar import no topo:
```tsx
import { OwnerDocumentsInline } from './owner-documents-inline'
```

Inserir após o bloco condicional de KYC (após linha 257, antes de `</div>` na linha 258):
```tsx
{/* Documentos do Proprietário */}
{form.watch(`owners.${index}.person_type`) && (
  <OwnerDocumentsInline
    form={form}
    ownerIndex={index}
    personType={form.watch(`owners.${index}.person_type`)}
  />
)}
```

**Resultado visual no card:**
```
Card Proprietário [index]
├── Campos básicos (nome, NIF, email, phone, %)
├── Checkbox contacto principal
├── KYC Singular/Coletiva (Collapsible)
├── Beneficiários (se coletiva + sem RCBE)
└── Documentos do Proprietário (Collapsible) ← NOVO
```

---

### 3. `components/acquisitions/step-5-documents.tsx`

**O que fazer:** Remover as categorias `Proprietário` e `Proprietário Empresa` do Step 5, porque esses docs são agora tratados no Step 3.

**Alteração exacta — linha 11-18:**

Substituir:
```tsx
const ACQUISITION_DOC_CATEGORIES = [
  'Contratual',
  'Imóvel',
  'Jurídico',
  'Jurídico Especial',
  'Proprietário',
  'Proprietário Empresa',
]
```

Por:
```tsx
const ACQUISITION_DOC_CATEGORIES = [
  'Contratual',
  'Imóvel',
  'Jurídico',
  'Jurídico Especial',
]
```

**Nota:** A constante `OWNER_DOC_CATEGORIES` (linha 21) e a lógica de `handleFileSelected` que resolve `owner_index` podem permanecer — não causam erro e servem de fallback se por alguma razão um doc de owner aparecer neste step.

---

### 4. `app/api/processes/[id]/route.ts`

**O que fazer:** Adicionar join com `owners` na query de `proc_tasks` para trazer `owner.name` e `owner.person_type`.

**Alteração exacta — linhas 56-66:**

Substituir a query de tasks:
```tsx
const { data: tasks, error: tasksError } = await supabase
  .from('proc_tasks')
  .select(
    `
    *,
    assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name)
  `
  )
  .eq('proc_instance_id', id)
  .order('stage_order_index', { ascending: true })
  .order('order_index', { ascending: true })
```

Por:
```tsx
const { data: tasks, error: tasksError } = await supabase
  .from('proc_tasks')
  .select(
    `
    *,
    assigned_to_user:dev_users!proc_tasks_assigned_to_fkey(id, commercial_name),
    owner:owners!proc_tasks_owner_id_fkey(id, name, person_type)
  `
  )
  .eq('proc_instance_id', id)
  .order('stage_order_index', { ascending: true })
  .order('order_index', { ascending: true })
```

**Justificação:** A coluna `proc_tasks.owner_id` e a FK `proc_tasks_owner_id_fkey` já existem na BD. Este join traz os dados do owner para cada tarefa, permitindo mostrar badges no frontend.

---

### 5. `types/process.ts`

**O que fazer:** Adicionar campos `owner_id` e `owner` ao tipo `ProcessTask`.

**Alteração exacta — linhas 19-21:**

Substituir:
```tsx
export interface ProcessTask extends ProcTask {
  assigned_to_user?: Pick<DevUser, 'id' | 'commercial_name'>
}
```

Por:
```tsx
export interface ProcessTask extends ProcTask {
  assigned_to_user?: Pick<DevUser, 'id' | 'commercial_name'>
  owner_id?: string | null
  owner?: {
    id: string
    name: string
    person_type: 'singular' | 'coletiva'
  } | null
}
```

---

### 6. `components/processes/process-tasks-section.tsx`

**O que fazer:** Duas alterações:

#### 6a. Usar `task.owner_id` em vez de `mainOwnerId` fixo

**Alteração exacta — linhas 292-302:**

Substituir:
```tsx
{task.action_type === 'UPLOAD' &&
  ['pending', 'in_progress'].includes(task.status) &&
  task.config?.doc_type_id && (
    <TaskUploadAction
      taskId={task.id}
      processId={processId}
      propertyId={propertyId}
      docTypeId={task.config.doc_type_id}
      docTypeName={task.title}
      allowedExtensions={task.config?.allowed_extensions || ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']}
      existingDocs={processDocuments}
      ownerId={mainOwnerId}
      onCompleted={onTaskUpdate}
    />
  )}
```

Por:
```tsx
{task.action_type === 'UPLOAD' &&
  ['pending', 'in_progress'].includes(task.status) &&
  task.config?.doc_type_id && (
    <TaskUploadAction
      taskId={task.id}
      processId={processId}
      propertyId={propertyId}
      docTypeId={task.config.doc_type_id}
      docTypeName={task.title}
      allowedExtensions={task.config?.allowed_extensions || ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']}
      existingDocs={processDocuments}
      ownerId={task.owner_id || mainOwnerId}
      onCompleted={onTaskUpdate}
    />
  )}
```

**Diferença:** `ownerId={mainOwnerId}` → `ownerId={task.owner_id || mainOwnerId}`

#### 6b. Mostrar badge com nome do owner na tarefa

**Onde inserir:** Após a linha 192 (badge "Obrigatória"), antes do bloco `assigned_to_user`.

**Código a adicionar:**
```tsx
{task.owner && (
  <Badge variant="outline" className="text-xs gap-1">
    {task.owner.person_type === 'coletiva' ? (
      <Building2 className="h-3 w-3" />
    ) : (
      <User className="h-3 w-3" />
    )}
    {task.owner.name}
  </Badge>
)}
```

**Import adicional no topo:**
```tsx
import { Building2 } from 'lucide-react'
```

Nota: `User` já está importado em `lucide-react` — verificar. Se não, adicionar ao import existente. Na verdade, `User` não está importado neste ficheiro. Usar o icon que já existe ou adicionar `User` ao import.

Actualizar import de lucide-react (linha 9-19) adicionando `User` e `Building2`:
```tsx
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Ban,
  FileText,
  Mail,
  Upload,
  MoreHorizontal,
  UserPlus,
  ExternalLink,
  User,
  Building2,
} from 'lucide-react'
```

---

## Ficheiros a NÃO ALTERAR (confirmados)

| Ficheiro | Razão |
|----------|-------|
| `components/acquisitions/acquisition-form.tsx` | Upload loop já resolve `owner_index` → `owner_id` (linhas 189-194). Nenhuma alteração necessária. |
| `components/processes/task-upload-action.tsx` | Já aceita prop `ownerId` e passa ao `DocumentUploader`. Nenhuma alteração necessária. |
| `app/api/documents/upload/route.ts` | Já aceita `owner_id` no FormData. |
| `app/api/libraries/doc-types/route.ts` | Já suporta `?category=X`. |
| `app/api/owners/[id]/documents/route.ts` | Já lista docs de um owner. |
| `types/document.ts` | `DeferredDocument` já tem `owner_index`. |
| `lib/validations/acquisition.ts` | Schema docs já tem `owner_id`. |

---

## Ordem de Execução

```
1. types/process.ts                       → Adicionar owner ao ProcessTask
2. owner-documents-inline.tsx             → Criar componente novo
3. step-3-owners.tsx                      → Integrar componente no card
4. step-5-documents.tsx                   → Remover categorias owner
5. app/api/processes/[id]/route.ts        → Join owners nas tasks
6. process-tasks-section.tsx              → Badge owner + task.owner_id no upload
```

---

## Verificação Final

Após implementar, correr `npm run build` e confirmar:
- [ ] Zero erros de TypeScript
- [ ] Step 3 mostra docs condicionais por `person_type`
- [ ] Step 5 não mostra categorias `Proprietário` / `Proprietário Empresa`
- [ ] Ficheiros seleccionados no Step 3 aparecem no form state (`documents`)
- [ ] Upload pós-submit resolve `owner_index` → `owner_id` (já funciona)
- [ ] API `/api/processes/[id]` retorna `owner` em cada task
- [ ] Tarefas com owner mostram badge com nome + ícone
- [ ] Upload de tarefa usa `task.owner_id` quando disponível
