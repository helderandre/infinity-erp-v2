# SPEC — Upload Diferido de Documentos (Deferred Upload)

**Data:** 2026-02-20
**PRD de origem:** `docs/PRD-DEFERRED-UPLOAD.md`

---

## Resumo

No Step 5 do formulário de angariações, o `UploadZone` faz `POST /api/documents/upload` imediatamente ao seleccionar ficheiro. Esse endpoint exige `property_id` ou `owner_id`, que ainda não existem (são criados no submit final). O upload falha com 400.

**Solução:** Modo `deferred` no `UploadZone` — guarda o `File` no form state do React Hook Form. Após o submit criar a propriedade/owners, o frontend faz upload dos ficheiros pendentes com os IDs reais.

---

## Ficheiros a MODIFICAR

### 1. `types/document.ts`

**O que fazer:** Adicionar interface `DeferredDocument` para representar ficheiros pendentes de upload (guardados em memória do browser).

```typescript
// Adicionar APÓS a interface PendingDocument (linha ~65)

export interface DeferredDocument {
  id: string                    // crypto.randomUUID() — key React
  doc_type_id: string
  doc_type_name: string
  file: File                    // Objecto nativo do browser
  file_name: string
  file_size: number
  file_type: string
  owner_id?: string
}
```

---

### 2. `components/documents/UploadZone.tsx`

**O que fazer:** Adicionar modo `deferred` via props opcionais. Quando `deferred=true`, o componente NÃO faz fetch — apenas valida o ficheiro e chama `onFileSelected` com o `File` object. O comportamento por defeito (upload imediato) permanece intacto.

**Alterações na interface de props** (linha 8-15):

```typescript
interface UploadZoneProps {
  docTypeId: string
  allowedExtensions: string[]
  // Modo normal (upload imediato)
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Modo deferred (guardar File no form state)
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
}
```

**Alterações no `handleFile`** (linha 34-87): Após as validações de tamanho e extensão (manter como estão), adicionar branch:

```typescript
const handleFile = useCallback(
  async (file: File) => {
    // Validações existentes de tamanho e extensão — MANTER COMO ESTÃO
    if (file.size > MAX_FILE_SIZE) { ... }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext && !allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) { ... }

    // === NOVO: Modo deferred — guardar File em vez de upload ===
    if (deferred && onFileSelected) {
      onFileSelected(file, docTypeId)
      return
    }

    // === Modo normal (upload imediato) — código existente inalterado ===
    setIsUploading(true)
    // ... resto do código existente
  },
  [docTypeId, allowedExtensions, onUploaded, propertyId, ownerId, consultantId, deferred, onFileSelected]
)
```

Nota: `onUploaded` passa de obrigatório a opcional na interface (adicionar `?`). Manter todo o JSX de renderização inalterado.

---

### 3. `components/documents/DocRow.tsx`

**O que fazer:** Propagar as novas props `deferred` e `onFileSelected` para o `UploadZone`. Reconhecer documentos no estado "ficheiro seleccionado" (pendente, não uploaded).

**Alterações na interface** (linha 9-16):

```typescript
interface DocRowProps {
  docType: DocType
  isUploaded: boolean
  isPending?: boolean           // NOVO — ficheiro seleccionado, aguarda upload
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Deferred mode
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
}
```

**Alterações no comportamento:**
- `canToggle` (linha 44): mudar para `!isUploaded && !isPending`
- No badge de estado (linhas 69-73): adicionar variante para `isPending`:
  - Se `isPending` → Badge azul com ícone `FileCheck2` e texto "Seleccionado"
  - Se `isUploaded` → Badge verde existente "Carregado"
- No `UploadZone` (linhas 94-102): propagar `deferred` e `onFileSelected`:

```typescript
<UploadZone
  docTypeId={docType.id}
  allowedExtensions={docType.allowed_extensions}
  onUploaded={onUploaded}
  propertyId={propertyId}
  ownerId={ownerId}
  consultantId={consultantId}
  deferred={deferred}
  onFileSelected={onFileSelected}
/>
```

---

### 4. `components/documents/DocCategoryCard.tsx`

**O que fazer:** Propagar props deferred. Reconhecer documentos pendentes (têm `file_name` mas não `file_url`) para calcular correctamente o progresso e passar `isPending` ao `DocRow`.

**Alterações na interface `UploadedDoc`** (linhas 8-11):

```typescript
interface UploadedDoc {
  doc_type_id: string
  file_url?: string       // MUDAR de obrigatório para opcional
  file_name?: string      // NOVO — presente em deferred docs
}
```

**Alterações na interface `DocCategoryCardProps`** (linhas 13-21): adicionar props deferred:

```typescript
interface DocCategoryCardProps {
  category: string
  docTypes: DocType[]
  uploadedDocs: UploadedDoc[]
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Deferred
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
}
```

**Alterações na lógica de contagem** (linhas 81-84):

```typescript
// Um doc "conta" se tem file_url (uploaded) OU file_name sem file_url (pending/deferred)
const uploadedCount = docTypes.filter((dt) =>
  uploadedDocs.some((d) => d.doc_type_id === dt.id && (d.file_url || d.file_name))
).length
```

**Alterações no render de `DocRow`** (linhas 98-113): passar `isPending`, `deferred`, `onFileSelected`:

```typescript
{docTypes.map((dt) => {
  const isUploaded = uploadedDocs.some(
    (d) => d.doc_type_id === dt.id && d.file_url
  )
  const isPending = !isUploaded && uploadedDocs.some(
    (d) => d.doc_type_id === dt.id && d.file_name && !d.file_url
  )
  return (
    <DocRow
      key={dt.id}
      docType={dt}
      isUploaded={isUploaded}
      isPending={isPending}
      onUploaded={onUploaded}
      propertyId={propertyId}
      ownerId={ownerId}
      consultantId={consultantId}
      deferred={deferred}
      onFileSelected={onFileSelected}
    />
  )
})}
```

---

### 5. `components/documents/DocumentsSection.tsx`

**O que fazer:** Propagar props `deferred` e `onFileSelected` para `DocCategoryCard`.

**Alterações na interface `UploadedDoc`** (linhas 6-9):

```typescript
interface UploadedDoc {
  doc_type_id: string
  file_url?: string       // Opcional — deferred docs não têm URL
  file_name?: string      // Novo
}
```

**Alterações na interface `DocumentsSectionProps`** (linhas 11-18): adicionar:

```typescript
interface DocumentsSectionProps {
  byCategory: Record<string, DocType[]>
  uploadedDocs: UploadedDoc[]
  onUploaded?: (result: any, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Deferred
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
}
```

**Alterações no render** (linhas 30-41): propagar `deferred` e `onFileSelected` para cada `DocCategoryCard`.

---

### 6. `components/acquisitions/step-5-documents.tsx`

**O que fazer:** Trocar de modo upload imediato para modo deferred. O handler `handleUploaded` é substituído por `handleFileSelected` que guarda o `File` object no form state.

**Remover:** O callback `handleUploaded` (linhas 45-58).

**Adicionar:** Novo callback `handleFileSelected`:

```typescript
const handleFileSelected = useCallback(
  (file: File, docTypeId: string) => {
    const currentDocs = form.getValues('documents') || []
    // Encontrar o nome do docType para UX
    const dt = docTypes.find((d) => d.id === docTypeId)
    form.setValue('documents', [
      ...currentDocs,
      {
        doc_type_id: docTypeId,
        file: file,                 // File object (browser memory)
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        metadata: {},
      },
    ])
    toast.success(`Ficheiro "${file.name}" seleccionado`)
  },
  [form, docTypes]
)
```

**Alterar o render** (linhas 91-95): passar `deferred={true}` e `onFileSelected`:

```tsx
<DocumentsSection
  byCategory={byCategory}
  uploadedDocs={uploadedDocs}
  deferred={true}
  onFileSelected={handleFileSelected}
/>
```

**Adicionar import:** `toast` de `sonner`.

---

### 7. `lib/validations/acquisition.ts`

**O que fazer:** Ajustar o schema `documents` para aceitar documentos deferred (que têm `file_name` mas não `file_url`, e carregam campos extra como `file_size`/`file_type`). O `File` object em si NÃO entra no schema Zod (não é serializável) — será extraído antes do `JSON.stringify`.

**Alteração no bloco `documents`** (linhas 122-133):

```typescript
// Step 5: Documentos (podem ser uploaded OU deferred)
documents: z
  .array(
    z.object({
      doc_type_id: z.string(),
      file_url: z.string().optional(),     // Preenchido se upload imediato
      file_name: z.string().optional(),    // Sempre presente
      file_size: z.number().optional(),    // NOVO — presente no deferred
      file_type: z.string().optional(),    // NOVO — presente no deferred
      valid_until: z.string().optional(),
      metadata: z.record(z.string(), z.any()).optional(),
      owner_id: z.string().optional(),
    })
  )
  .optional(),
```

Nota: removido `.uuid()` do `doc_type_id` → usar `.string()` simples para compatibilidade (padrão do projecto — ver nota 9 do CLAUDE.md).

---

### 8. `components/acquisitions/acquisition-form.tsx`

**O que fazer:** Alterar `onSubmit` para:
1. Extrair ficheiros `File` do array `documents` antes de serializar
2. Enviar o JSON sem `File` objects para `POST /api/acquisitions`
3. Após receber `property_id`, fazer upload sequencial de cada ficheiro pendente via `POST /api/documents/upload`
4. Actualizar o texto do botão durante o processo ("A criar angariação..." → "A carregar documentos... (X/Y)")
5. Tratar falhas parciais com toast de aviso (redirect mesmo assim)

**Adicionar estado de progresso de upload** (após `isSubmitting`, ~linha 72):

```typescript
const [uploadProgress, setUploadProgress] = useState<string | null>(null)
```

**Reescrever `onSubmit`** (linhas 133-158):

```typescript
const onSubmit = async (data: any) => {
  setIsSubmitting(true)
  try {
    // 1. Extrair ficheiros pendentes do form data
    const pendingFiles: Array<{ file: File; doc_type_id: string }> = []
    const jsonDocuments: typeof data.documents = []

    for (const doc of (data.documents || [])) {
      if (doc.file instanceof File) {
        pendingFiles.push({ file: doc.file, doc_type_id: doc.doc_type_id })
      } else if (doc.file_url) {
        jsonDocuments.push(doc)
      }
    }

    // 2. Enviar JSON sem File objects
    const payload = { ...data, documents: jsonDocuments }
    // Remover campos que não serializam (File objects em qualquer nível)
    delete payload.file

    const response = await fetch('/api/acquisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Erro ao criar angariação')

    // 3. Upload dos ficheiros pendentes (com property_id real)
    if (pendingFiles.length > 0) {
      let uploaded = 0
      let failed = 0

      for (const pending of pendingFiles) {
        setUploadProgress(`A carregar documentos... (${uploaded + 1}/${pendingFiles.length})`)

        try {
          const formData = new FormData()
          formData.append('file', pending.file)
          formData.append('doc_type_id', pending.doc_type_id)
          formData.append('property_id', result.property_id)

          const uploadRes = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
          })

          if (!uploadRes.ok) {
            const err = await uploadRes.json()
            console.error(`Erro no upload de ${pending.file.name}:`, err)
            failed++
          } else {
            uploaded++
          }
        } catch (err) {
          console.error(`Erro no upload de ${pending.file.name}:`, err)
          failed++
        }
      }

      if (failed > 0) {
        toast.warning(
          `${failed} documento(s) não carregado(s). Pode adicioná-los depois na página do processo.`
        )
      }
    }

    toast.success('Angariação criada com sucesso!')
    router.push(`/dashboard/processos/${result.proc_instance_id}`)
  } catch (error: any) {
    console.error('[AcquisitionForm] Erro no submit:', error)
    toast.error(error.message || 'Erro ao criar angariação')
  } finally {
    setIsSubmitting(false)
    setUploadProgress(null)
  }
}
```

**Alterar texto do botão submit** (linhas 233-244): usar `uploadProgress` quando disponível:

```tsx
{isSubmitting ? (
  <>
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    {uploadProgress || 'A criar angariação...'}
  </>
) : (
  <>
    <Check className="mr-2 h-4 w-4" />
    Criar Angariação
  </>
)}
```

---

### 9. `app/api/acquisitions/route.ts`

**O que fazer:** Duas alterações:
1. Incluir `owner_ids` no response JSON (útil para uploads futuros de documentos de proprietário)
2. Remover ou relaxar o filtro de `documents` que exige `file_url` (documentos deferred não terão `file_url` no payload JSON — o upload é feito depois pelo frontend)

**Alteração no bloco de documentos** (linhas 220-245): O frontend já não envia documentos com `File` objects no JSON. Os `jsonDocuments` que chegam podem ter `file_url` (upload imediato noutro contexto) ou estar vazios. Manter o código existente como está — ele já faz `.filter((doc) => doc.file_url && doc.file_name)` e simplesmente não insere nada se a lista vier vazia.

**Alteração no response** (linhas 267-272): adicionar `owner_ids`:

```typescript
return NextResponse.json({
  success: true,
  property_id: property.id,
  proc_instance_id: procInstance.id,
  owner_ids: ownerIds,     // ← NOVO — Array de UUIDs dos owners criados/reutilizados
  message: 'Angariação criada com sucesso',
})
```

Nota: A variável `ownerIds` já existe (linha 97, populada no loop da linha 98-218). Basta adicioná-la ao response.

---

## Ficheiros SEM alteração

| Ficheiro | Razão |
|----------|-------|
| `app/api/documents/upload/route.ts` | Sem alteração — receberá `property_id` válido após o submit |
| `lib/r2/documents.ts` | Sem alteração — lógica de upload ao R2 permanece igual |
| `lib/r2/client.ts` | Sem alteração |
| `components/ui/file-upload.tsx` | Sem alteração — não é usado no Step 5 |
| `lib/validations/document.ts` | Sem alteração — `MAX_FILE_SIZE` continua igual |

---

## Ficheiros a NÃO criar

Não é necessário criar novos ficheiros. Toda a lógica cabe nas modificações listadas acima.

---

## Ordem de Implementação

| Passo | Ficheiro | Descrição |
|-------|----------|-----------|
| 1 | `types/document.ts` | Adicionar `DeferredDocument` interface |
| 2 | `lib/validations/acquisition.ts` | Ajustar schema `documents` (aceitar `file_size`, `file_type`) |
| 3 | `components/documents/UploadZone.tsx` | Adicionar modo `deferred` (props + branch no handleFile) |
| 4 | `components/documents/DocRow.tsx` | Propagar deferred + badge "Seleccionado" |
| 5 | `components/documents/DocCategoryCard.tsx` | Propagar deferred + lógica de contagem pendente |
| 6 | `components/documents/DocumentsSection.tsx` | Propagar deferred |
| 7 | `components/acquisitions/step-5-documents.tsx` | Trocar `handleUploaded` → `handleFileSelected` com `deferred={true}` |
| 8 | `components/acquisitions/acquisition-form.tsx` | Reescrever `onSubmit` com upload pós-submit + progress no botão |
| 9 | `app/api/acquisitions/route.ts` | Adicionar `owner_ids` ao response |

---

## Compatibilidade e Riscos

- **Modo deferred é opt-in** — activado por prop booleana. Todos os outros usos de `UploadZone` (processo, página de documentos) continuam com upload imediato.
- **File objects persistem entre steps** — React Hook Form mantém o state quando se navega entre steps do Stepper. Sem risco de perda.
- **File não serializa em JSON** — por isso extraímos os `File` objects antes de `JSON.stringify`. O schema Zod não valida `File` (validação é client-side no `UploadZone`).
- **Falha parcial de upload** — se algum ficheiro falhar, toast de aviso + redirect mesmo assim. Documentos podem ser adicionados depois na página do processo.
