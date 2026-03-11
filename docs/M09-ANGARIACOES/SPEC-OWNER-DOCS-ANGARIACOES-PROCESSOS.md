# SPEC — Documentos por Proprietário nas Angariações e Processos

**Data:** 2026-02-23
**Tipo:** Aprimoramento / Refactoring
**Prioridade:** Alta
**Dependências:** M06 (Processos), M08 (Documentos), SPEC-FIX-OWNER-ID-DOCUMENTS

---

## 1. Resumo das Alterações

### Problema Actual

1. No formulário de angariação, os documentos de proprietário estão no Step 5 (Documentos) em vez de estarem junto ao proprietário no Step 3
2. Os documentos não são condicionais ao `person_type` — não distinguem entre pessoa singular e colectiva
3. Quando existem múltiplos proprietários, não há forma de associar cada documento ao proprietário correcto
4. Nas tarefas de processo, as tarefas de documentos de proprietário são criadas "flat" — sem considerar quantos proprietários existem nem o seu tipo

### Solução Implementada (BD)

4 migrações já foram aplicadas ao Supabase:

| # | Migration | Descrição |
|---|-----------|-----------|
| 1 | `add_owner_id_to_proc_tasks` | Coluna `owner_id` (FK → owners) na `proc_tasks` |
| 2 | `add_owner_type_to_tpl_tasks_config` | `owner_type: "singular"/"coletiva"` no `config` das tpl_tasks de proprietário |
| 3 | `rewrite_populate_process_tasks_with_owner_multiplication` | Trigger reescrita: multiplica tarefas por proprietário |
| 4 | `update_auto_complete_tasks_with_owner_id_matching` | Auto-complete usa `proc_tasks.owner_id` para matching preciso |

### O Que Falta (Frontend)

| Fase | Descrição | Complexidade |
|------|-----------|-------------|
| **Fase B** | Documentos de proprietário no Step 3 do formulário de angariação | Médio |
| **Fase C** | Actualizar UI de processos para mostrar owner_id nas tarefas | Simples |

---

## 2. Estado Actual da BD (Pós-Migrações)

### `tpl_tasks.config` — Tarefas de Proprietário Singular

```json
// Doc Identificação (CC)
{ "doc_type_id": "16706cb5-...", "owner_type": "singular" }

// Comprovativo Estado Civil
{ "doc_type_id": "0898d9ba-...", "owner_type": "singular" }

// Ficha Branqueamento
{ "doc_type_id": "02b63b46-...", "owner_type": "singular" }
```

### `tpl_tasks.config` — Tarefas de Proprietário Empresa

```json
// Certidão Permanente Empresa
{ "doc_type_id": "e433c9f1-...", "owner_type": "coletiva" }

// Pacto Social / Estatutos
{ "doc_type_id": "2f911296-...", "owner_type": "coletiva" }

// Ata poderes venda
{ "doc_type_id": "425ee306-...", "owner_type": "coletiva" }

// RCBE
{ "doc_type_id": "6dd8bf4c-...", "owner_type": "coletiva" }

// Ficha Branqueamento Emp.
{ "doc_type_id": "f9a3ee8f-...", "owner_type": "coletiva" }
```

### `proc_tasks` — Nova Coluna

```
proc_tasks.owner_id (uuid, FK → owners.id, nullable)
```

Quando uma tarefa é instanciada para um proprietário específico, esta coluna é preenchida. O título da tarefa inclui " — {nome do proprietário}".

### Comportamento da Trigger `populate_process_tasks`

Quando um processo é instanciado:

1. **Tarefas SEM `owner_type`** (imóvel, contratuais, manuais) → criadas 1 vez, normalmente
2. **Tarefas COM `owner_type: "singular"`** → criadas N vezes, 1 por cada proprietário com `person_type = 'singular'`
3. **Tarefas COM `owner_type: "coletiva"`** → criadas N vezes, 1 por cada proprietário com `person_type = 'coletiva'`

**Exemplo:** Imóvel com João (singular) + Empresa XPTO (coletiva):

```
Fase "Identificação Proprietários":
  ✅ "Doc Identificação (CC) — João Silva"         owner_id: uuid-joao
  ✅ "Comprovativo Estado Civil — João Silva"       owner_id: uuid-joao
  ✅ "Ficha Branqueamento — João Silva"             owner_id: uuid-joao

Fase "Identificação Empresa":
  ✅ "Certidão Permanente Empresa — Empresa XPTO"   owner_id: uuid-xpto
  ✅ "Pacto Social / Estatutos — Empresa XPTO"      owner_id: uuid-xpto
  ✅ "Ata poderes venda — Empresa XPTO"             owner_id: uuid-xpto
  ✅ "RCBE — Empresa XPTO"                          owner_id: uuid-xpto
  ✅ "Ficha Branqueamento Emp. — Empresa XPTO"      owner_id: uuid-xpto

Fase "Documentação do Imóvel":
  (sem owner_id — criadas normalmente)
```

Se o imóvel tivesse 2 proprietários singulares (João + Maria), cada tarefa singular apareceria 2 vezes (1 para cada).

---

## 3. Fase B — Documentos no Step 3 (Angariações)

### 3.1 Nova Estrutura dos Steps

```
Step 1: Dados do Imóvel        (sem alteração)
Step 2: Localização             (sem alteração)
Step 3: Proprietários           (+ documentos de cada proprietário)
Step 4: Dados Contratuais       (sem alteração)
Step 5: Documentos do Imóvel    (SEM docs de proprietário — só Imóvel + Contratual + Jurídico)
```

### 3.2 Componente a CRIAR: `owner-documents-inline.tsx`

**Localização:** `components/acquisitions/owner-documents-inline.tsx`

**Função:** Secção de documentos inline dentro do card de cada proprietário no Step 3. Mostra os doc_types filtrados pelo `person_type` do proprietário, com área de upload para cada um.

**Props:**

```typescript
interface OwnerDocumentsInlineProps {
  form: UseFormReturn<AcquisitionFormData>
  ownerIndex: number
  personType: 'singular' | 'coletiva'
  existingOwnerId?: string  // Se proprietário já existe na BD
}
```

**Lógica:**

1. **Carregar doc_types** filtrados por categoria:
   - `person_type === 'singular'` → `GET /api/libraries/doc-types?category=Proprietário`
   - `person_type === 'coletiva'` → `GET /api/libraries/doc-types?category=Proprietário Empresa`

2. **Se `existingOwnerId` existe**, verificar docs existentes:
   - `GET /api/owners/{existingOwnerId}/documents`
   - Para cada doc_type, se existe doc activo e válido → mostrar "✅ Já existe (válido)"
   - Se existe mas expirado → mostrar "⚠️ Expirado" + área de upload

3. **Upload:** Cada ficheiro é guardado no estado do formulário como `PendingDocument` com:
   - `doc_type_id`
   - `doc_type_category`
   - `owner_index` (índice do proprietário no array do form)
   - `file` (File object)

**UI:**

```
─── Documentos do Proprietário ─────────────────────

📄 Cartão de Cidadão
   ✅ Já existe (válido até 12/2028)
   
📄 Comprovativo de Estado Civil
   [Carregar ficheiro] ou arraste aqui
   
📄 Ficha de Branqueamento de Capitais
   ⬆️ documento_branqueamento.pdf (1.2 MB)  [✕ Remover]
```

**Estrutura do componente (~120 linhas):**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { FileUpload, FileUploadDropzone, FileUploadList, FileUploadItem } from '@/components/ui/file-upload'
import { Badge } from '@/components/ui/badge'
import { FileText, Check, AlertTriangle, Upload } from 'lucide-react'

interface DocTypeWithStatus {
  id: string
  name: string
  category: string
  allowed_extensions: string[]
  existing_doc?: {
    id: string
    status: string
    valid_until: string | null
    file_name: string
  }
}

export function OwnerDocumentsInline({ 
  form, ownerIndex, personType, existingOwnerId 
}: OwnerDocumentsInlineProps) {
  const [docTypes, setDocTypes] = useState<DocTypeWithStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDocTypes()
  }, [personType, existingOwnerId])

  async function loadDocTypes() {
    setLoading(true)
    const category = personType === 'singular' ? 'Proprietário' : 'Proprietário Empresa'
    
    // 1. Buscar doc_types da categoria
    const typesRes = await fetch(`/api/libraries/doc-types?category=${encodeURIComponent(category)}`)
    const types = await typesRes.json()
    
    // 2. Se owner existe, buscar docs existentes
    let existingDocs: any[] = []
    if (existingOwnerId) {
      const docsRes = await fetch(`/api/owners/${existingOwnerId}/documents`)
      existingDocs = await docsRes.json()
    }
    
    // 3. Cruzar
    const merged = types.map((dt: any) => ({
      ...dt,
      existing_doc: existingDocs.find(
        (d: any) => d.doc_type_id === dt.id && d.status === 'active'
      )
    }))
    
    setDocTypes(merged)
    setLoading(false)
  }

  function handleFileSelected(docTypeId: string, file: File) {
    // Adicionar ao array de pending documents no form state
    const currentDocs = form.getValues('documents') || []
    const docType = docTypes.find(dt => dt.id === docTypeId)
    
    form.setValue('documents', [
      ...currentDocs.filter((d: any) => 
        !(d.doc_type_id === docTypeId && d.owner_index === ownerIndex)
      ),
      {
        doc_type_id: docTypeId,
        doc_type_name: docType?.name || '',
        doc_type_category: docType?.category || '',
        owner_index: ownerIndex,
        file,
        file_name: file.name,
        is_uploaded: false,
      }
    ])
  }

  function handleRemoveFile(docTypeId: string) {
    const currentDocs = form.getValues('documents') || []
    form.setValue('documents', 
      currentDocs.filter((d: any) => 
        !(d.doc_type_id === docTypeId && d.owner_index === ownerIndex)
      )
    )
  }

  // Verificar se já tem ficheiro pendente para este doc_type
  function getPendingFile(docTypeId: string): File | undefined {
    const docs = form.getValues('documents') || []
    const pending = docs.find((d: any) => 
      d.doc_type_id === docTypeId && d.owner_index === ownerIndex
    )
    return pending?.file
  }

  if (loading) return <Skeleton className="h-32 w-full" />

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <FileText className="h-4 w-4" />
        {personType === 'singular' 
          ? 'Documentos do Proprietário' 
          : 'Documentos da Empresa'
        }
      </h4>

      {docTypes.map((dt) => {
        const pendingFile = getPendingFile(dt.id)
        const hasExisting = dt.existing_doc != null
        const isExpired = hasExisting && dt.existing_doc!.valid_until && 
          new Date(dt.existing_doc!.valid_until) < new Date()

        return (
          <div key={dt.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{dt.name}</p>
              
              {hasExisting && !isExpired && (
                <div className="flex items-center gap-1 mt-1">
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600">
                    Já existe (válido{dt.existing_doc!.valid_until 
                      ? ` até ${new Date(dt.existing_doc!.valid_until).toLocaleDateString('pt-PT')}` 
                      : ''})
                  </span>
                </div>
              )}
              
              {hasExisting && isExpired && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  <span className="text-xs text-amber-600">Expirado — carregue nova versão</span>
                </div>
              )}
              
              {pendingFile && (
                <div className="flex items-center gap-1 mt-1">
                  <Upload className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-blue-600 truncate">
                    {pendingFile.name}
                  </span>
                  <button 
                    type="button"
                    onClick={() => handleRemoveFile(dt.id)}
                    className="text-xs text-destructive ml-1"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>

            {/* Área de upload: mostrar se não tem doc existente válido, ou se expirado */}
            {(!hasExisting || isExpired) && !pendingFile && (
              <label className="cursor-pointer text-xs text-primary hover:underline shrink-0">
                Carregar
                <input
                  type="file"
                  className="hidden"
                  accept={dt.allowed_extensions?.map((e: string) => `.${e}`).join(',')}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelected(dt.id, file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

### 3.3 Modificar: `step-3-owners.tsx`

**Estado actual:** ~248 linhas. Mostra campos básicos + KYC condicional por proprietário.

**Modificação:** Adicionar `<OwnerDocumentsInline>` após o KYC de cada proprietário.

```tsx
// Dentro do Card de cada owner, APÓS o KYC:

{/* Documentos condicionais ao person_type */}
<OwnerDocumentsInline
  form={form}
  ownerIndex={index}
  personType={form.watch(`owners.${index}.person_type`) || 'singular'}
  existingOwnerId={form.watch(`owners.${index}.owner_id`)}
/>
```

**Import a adicionar:**

```typescript
import { OwnerDocumentsInline } from './owner-documents-inline'
```

### 3.4 Modificar: `step-5-documents.tsx`

**Estado actual:** ~47 linhas ou versão funcional com upload.

**Modificação:** Filtrar para mostrar APENAS documentos do Imóvel + Contratual + Jurídico. Remover qualquer referência a docs de proprietário.

**Categorias a mostrar no Step 5:**

```typescript
const STEP5_CATEGORIES = ['Imóvel', 'Contratual', 'Jurídico', 'Jurídico Especial']
```

**Categorias a NÃO mostrar (agora estão no Step 3):**

```typescript
const OWNER_CATEGORIES = ['Proprietário', 'Proprietário Empresa']
```

**Alteração no fetch de doc_types:**

```typescript
// Actual: busca todos os doc_types
const { data: docTypes } = await fetch('/api/libraries/doc-types')

// Novo: filtrar categorias de proprietário
const filteredDocTypes = docTypes.filter(
  (dt: DocType) => !OWNER_CATEGORIES.includes(dt.category)
)
```

### 3.5 Modificar: `acquisition-form.tsx` (loop de upload pós-criação)

**Modificação:** No loop de upload após criar a angariação, usar o `owner_index` do `PendingDocument` para resolver o `owner_id` real.

```typescript
// Após POST /api/acquisitions retornar { property_id, owner_ids }

for (const pending of pendingDocuments) {
  const formData = new FormData()
  formData.append('file', pending.file)
  formData.append('doc_type_id', pending.doc_type_id)
  formData.append('property_id', result.property_id)

  // Resolver owner_id a partir do owner_index
  if (pending.owner_index !== undefined && result.owner_ids?.[pending.owner_index]) {
    formData.append('owner_id', result.owner_ids[pending.owner_index])
  }

  await fetch('/api/documents/upload', { method: 'POST', body: formData })
}
```

**Nota:** A API `POST /api/acquisitions` deve retornar `owner_ids` na resposta. Verificar se já retorna; se não, adicionar ao response.

### 3.6 Verificar: `POST /api/acquisitions` retorna `owner_ids`

No response handler do endpoint, garantir que o array de `owner_ids` é retornado na mesma ordem dos owners do request:

```typescript
// No final do endpoint, retornar:
return NextResponse.json({
  property_id: property.id,
  owner_ids: ownerIds,  // array na mesma ordem dos owners do input
  process_id: process?.id,
  message: 'Angariação criada com sucesso'
})
```

---

## 4. Fase C — Processos: Mostrar Owner nas Tarefas

### 4.1 Modificar: `process-tasks-section.tsx`

**Estado actual:** Mostra tarefas agrupadas por fase com título, status, e acções.

**Modificação 1 — Dados:** A query de `proc_tasks` já deve retornar `owner_id`. Verificar o SELECT na API `GET /api/processes/[id]`:

```typescript
// Na query de proc_tasks, adicionar join ao owner
const { data: tasks } = await supabase
  .from('proc_tasks')
  .select(`
    *,
    owner:owners!proc_tasks_owner_id_fkey (
      id, name, person_type
    )
  `)
  .eq('proc_instance_id', processId)
  .order('stage_order_index')
  .order('order_index')
```

**Modificação 2 — UI:** No componente que renderiza cada tarefa, se `task.owner` existe:

```tsx
// No card/item de cada tarefa:
<div className="flex items-center gap-2">
  <span className="font-medium">{task.title}</span>
  {task.owner && (
    <Badge variant="outline" className="text-xs">
      {task.owner.person_type === 'singular' ? '👤' : '🏢'} {task.owner.name}
    </Badge>
  )}
</div>
```

**Nota:** O título da tarefa já inclui " — {nome}" (adicionado pela trigger), mas o badge visual melhora a UX. Se preferires não duplicar a informação, podes remover o sufixo " — {nome}" do título na trigger e usar apenas o badge.

### 4.2 Modificar: `task-upload-action.tsx`

**Estado actual:** Envia `property_id` e `doc_type_id` mas não envia `owner_id`.

**Modificação:** Se a tarefa tem `owner_id` (ou `config.owner_id`), enviar no FormData:

```typescript
const formData = new FormData()
formData.append('file', file)
formData.append('doc_type_id', docTypeId)
formData.append('property_id', propertyId)

// Enviar owner_id se a tarefa está associada a um proprietário
const taskOwnerId = task.owner_id || task.config?.owner_id
if (taskOwnerId) {
  formData.append('owner_id', taskOwnerId)
}
```

**Nota:** Com as 3 camadas de fallback (frontend → API → trigger BD), mesmo que isto falhe, o `owner_id` é resolvido automaticamente. Mas é boa prática enviar correctamente.

### 4.3 Modificar: `GET /api/processes/[id]/route.ts`

Garantir que o response de detalhe do processo inclui o owner nas tarefas:

```typescript
// Ao construir a resposta, incluir owner data nas tasks
// Se a query já faz join (ponto 4.1), isto vem automaticamente
```

---

## 5. Tipos TypeScript a Actualizar

### `types/document.ts`

Garantir que `PendingDocument` inclui `owner_index`:

```typescript
export interface PendingDocument {
  doc_type_id: string
  doc_type_name: string
  doc_type_category: string
  file?: File
  file_url?: string
  file_name?: string
  owner_id?: string
  owner_index?: number  // índice no array de owners do formulário
  is_uploaded: boolean
}
```

### `types/process.ts` (ou equivalente)

Adicionar owner à interface de ProcessTask:

```typescript
export interface ProcessTask {
  id: string
  proc_instance_id: string
  tpl_task_id: string | null
  title: string
  action_type: string
  config: Record<string, any>
  status: string
  is_mandatory: boolean
  owner_id: string | null     // ← ADICIONAR
  owner?: {                   // ← ADICIONAR (do join)
    id: string
    name: string
    person_type: 'singular' | 'coletiva'
  }
  // ... restantes campos
}
```

---

## 6. Mapa Completo de Ficheiros

### Ficheiros a CRIAR (1)

| # | Ficheiro | Função | Linhas estimadas |
|---|----------|--------|------------------|
| 1 | `components/acquisitions/owner-documents-inline.tsx` | Upload de docs por proprietário no Step 3 | ~120 |

### Ficheiros a MODIFICAR (6)

| # | Ficheiro | Modificação | Complexidade |
|---|----------|-------------|-------------|
| 1 | `components/acquisitions/step-3-owners.tsx` | Adicionar `<OwnerDocumentsInline>` após KYC | Simples |
| 2 | `components/acquisitions/step-5-documents.tsx` | Filtrar categorias de proprietário | Simples |
| 3 | `components/acquisitions/acquisition-form.tsx` | Enviar `owner_id` no loop de upload | Simples |
| 4 | `components/processes/process-tasks-section.tsx` | Badge com nome do proprietário | Simples |
| 5 | `components/processes/task-upload-action.tsx` | Enviar `owner_id` no FormData | Simples |
| 6 | `app/api/processes/[id]/route.ts` | Join de `owners` na query de `proc_tasks` | Simples |

### Ficheiros a VERIFICAR (2)

| # | Ficheiro | Verificação |
|---|----------|-------------|
| 1 | `app/api/acquisitions/route.ts` | Retorna `owner_ids` no response |
| 2 | `types/document.ts` | `PendingDocument` tem `owner_index` |

---

## 7. Ordem de Execução Recomendada

```
1. owner-documents-inline.tsx          (criar — componente novo)
2. step-3-owners.tsx                   (integrar componente)
3. step-5-documents.tsx                (filtrar categorias)
4. acquisition-form.tsx                (upload loop com owner_id)
5. app/api/acquisitions/route.ts       (verificar owner_ids no response)
6. app/api/processes/[id]/route.ts     (join owners nas tasks)
7. process-tasks-section.tsx           (badge owner)
8. task-upload-action.tsx              (enviar owner_id)
9. types/                              (actualizar interfaces)
10. npm run build                      (verificar zero erros)
```

---

## 8. Critérios de Sucesso

### Formulário de Angariação

- [ ] Step 3: ao seleccionar `person_type = 'singular'`, aparecem docs "Proprietário" (CC, Estado Civil, Branqueamento)
- [ ] Step 3: ao seleccionar `person_type = 'coletiva'`, aparecem docs "Proprietário Empresa" (Certidão, Pacto, Ata, RCBE, Branqueamento Emp.)
- [ ] Step 3: ao mudar `person_type`, os docs actualizam automaticamente
- [ ] Step 3: múltiplos proprietários → cada um com a sua secção de docs
- [ ] Step 3: proprietário existente com CC válido → "✅ Já existe (válido)"
- [ ] Step 5: NÃO mostra docs de proprietário (apenas Imóvel + Contratual + Jurídico)
- [ ] Upload pós-criação envia `owner_id` correcto para cada doc

### Processos

- [ ] Novo processo com 1 proprietário singular → tarefas de CC, Estado Civil, Branqueamento criadas com `owner_id` e nome no título
- [ ] Novo processo com 1 proprietário colectivo → tarefas de Certidão, Pacto, etc. criadas com `owner_id`
- [ ] Novo processo com 2 proprietários singulares → tarefas duplicadas (1 set por proprietário)
- [ ] Novo processo misto (singular + colectiva) → tarefas de cada tipo criadas apenas para os owners correspondentes
- [ ] Upload de doc numa tarefa com `owner_id` → envia `owner_id` correcto
- [ ] Auto-complete de tarefa por doc upload → respeita `owner_id` da tarefa

### Labels PT-PT

- [ ] "Documentos do Proprietário"
- [ ] "Documentos da Empresa"
- [ ] "Já existe (válido)"
- [ ] "Expirado — carregue nova versão"
- [ ] "Carregar"
- [ ] "Remover"

### Build

- [ ] `npm run build` sem erros

---

## 9. Cenários de Teste

### Cenário A: Angariação com 1 proprietário singular

```
1. Consultor preenche Step 3: João Silva (singular)
2. Secção "Documentos do Proprietário" aparece:
   - CC: [Carregar]
   - Estado Civil: [Carregar]
   - Branqueamento: [Carregar]
3. Consultor carrega CC e Branqueamento
4. Step 5: mostra apenas docs do Imóvel (Caderneta, CRP, etc.)
5. Submit → API cria angariação
6. Loop upload: CC e Branqueamento enviados com owner_id do João
7. Processo criado: tarefas singular com "— João Silva"
8. CC auto-completada pela trigger
```

### Cenário B: Angariação com proprietário colectivo

```
1. Consultor preenche Step 3: Empresa XPTO (coletiva)
2. Secção "Documentos da Empresa" aparece:
   - Certidão Permanente: [Carregar]
   - Pacto Social: [Carregar]
   - Ata Poderes: [Carregar]
   - RCBE: [Carregar]
   - Branqueamento (Empresa): [Carregar]
3. Fase "Identificação Proprietários" no processo: vazia (sem singulares)
4. Fase "Identificação Empresa": 5 tarefas "— Empresa XPTO"
```

### Cenário C: Angariação mista (singular + colectiva)

```
1. Proprietário 1: João Silva (singular, 50%)
   → Docs: CC, Estado Civil, Branqueamento
2. Proprietário 2: XPTO Lda (coletiva, 50%)
   → Docs: Certidão, Pacto, Ata, RCBE, Branqueamento Emp.
3. Processo criado:
   Fase "Identificação Proprietários":
     - CC — João Silva
     - Estado Civil — João Silva
     - Branqueamento — João Silva
   Fase "Identificação Empresa":
     - Certidão — XPTO Lda
     - Pacto Social — XPTO Lda
     - Ata — XPTO Lda
     - RCBE — XPTO Lda
     - Branqueamento Emp. — XPTO Lda
```

### Cenário D: Proprietário existente com docs válidos

```
1. João Silva já existe na BD com CC válido
2. No Step 3, consultor pesquisa e selecciona João
3. Secção docs mostra: CC → "✅ Já existe (válido até 12/2028)"
4. Branqueamento → [Carregar] (não existe)
5. Consultor carrega Branqueamento
6. Ao criar processo: tarefa CC é auto-completada (doc já existe)
```
