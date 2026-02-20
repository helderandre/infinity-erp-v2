# PRD — Upload Diferido de Documentos no Formulário de Angariações

**Data:** 2026-02-20
**Autor:** Claude Code (pesquisa automatizada)
**Problema:** Ao inserir um documento no Step 5 do formulário de angariações, o ficheiro é enviado imediatamente para o R2 via `/api/documents/upload`, que exige `property_id` ou `owner_id`. Como estes IDs ainda não existem (são criados apenas no submit final), o upload falha e/ou dispara o submit do formulário prematuramente.

---

## 1. Diagnóstico do Problema Actual

### Fluxo Actual (Problemático)

```
Step 5: Utilizador selecciona ficheiro
  ↓
  UploadZone.handleFile() → POST /api/documents/upload (FormData)
  ↓
  API valida: "Deve indicar property_id, owner_id ou consultant_id"
  ↓
  ❌ ERRO 400 — nenhum ID existe ainda (propriedade e owners criados no submit)
```

### Causa Raiz

O componente `UploadZone` faz upload **imediato** ao R2 no momento da selecção do ficheiro. No contexto do formulário de angariação, os IDs de `property` e `owner` ainda não existem — são criados apenas quando o utilizador clica "Criar Angariação" (submit final via `POST /api/acquisitions`).

### Ficheiros que Causam o Problema

| Ficheiro | Linha(s) | O que faz |
|----------|----------|-----------|
| `components/documents/UploadZone.tsx` | 50-66 | Faz `fetch('/api/documents/upload')` imediatamente ao seleccionar ficheiro |
| `components/documents/DocRow.tsx` | 95-102 | Passa `propertyId`/`ownerId` (ambos `undefined`) ao `UploadZone` |
| `components/documents/DocumentsSection.tsx` | 30-43 | Não passa `propertyId`/`ownerId` (não tem) |
| `components/acquisitions/step-5-documents.tsx` | 91-95 | Chama `DocumentsSection` sem IDs |
| `app/api/documents/upload/route.ts` | 70-86 | Exige pelo menos um de: `property_id`, `owner_id`, `consultant_id` |

---

## 2. Solução Proposta: Upload Diferido (Deferred Upload)

### Conceito

Em vez de enviar o ficheiro imediatamente para o R2, **manter o objecto `File` no estado do browser** (dentro do React Hook Form). O upload real ao R2 acontece **apenas após o submit** do formulário, quando os IDs de `property` e `owner` já existem.

### Fluxo Novo (Corrigido)

```
Step 5: Utilizador selecciona ficheiro
  ↓
  UploadZone (modo deferred) → NÃO faz fetch
  ↓
  Guarda File no form state: form.setValue('documents', [..., { file: File, doc_type_id, ... }])
  ↓
  UI mostra preview local (nome do ficheiro + ícone + tamanho)
  ↓
  Utilizador clica "Criar Angariação"
  ↓
  onSubmit() → POST /api/acquisitions (JSON, sem ficheiros)
  ↓
  API retorna { property_id, proc_instance_id, owner_ids: [...] }
  ↓
  Para cada documento pendente:
    POST /api/documents/upload (FormData com file + property_id)
  ↓
  Todos concluídos → registar em doc_registry → redirect para processo
```

---

## 3. Arquivos Afetados

### Alterações Obrigatórias

| # | Ficheiro | Tipo | Descrição da Alteração |
|---|----------|------|------------------------|
| 1 | `components/documents/UploadZone.tsx` | **Modificar** | Adicionar modo `deferred` que guarda `File` em vez de fazer upload |
| 2 | `components/documents/DocRow.tsx` | **Modificar** | Propagar prop `deferred` + mostrar estado "ficheiro seleccionado" (não "carregado") |
| 3 | `components/documents/DocCategoryCard.tsx` | **Modificar** | Reconhecer documentos com `file` (pendente) vs `file_url` (uploaded) |
| 4 | `components/documents/DocumentsSection.tsx` | **Modificar** | Propagar prop `deferred` |
| 5 | `components/acquisitions/step-5-documents.tsx` | **Modificar** | Passar `deferred={true}`, handler que guarda `File` no form |
| 6 | `components/acquisitions/acquisition-form.tsx` | **Modificar** | `onSubmit`: após criar propriedade/owners, fazer upload dos ficheiros pendentes |
| 7 | `lib/validations/acquisition.ts` | **Modificar** | Schema `documents[]` aceitar `File` object (ou removê-lo da validação Zod do JSON) |
| 8 | `app/api/acquisitions/route.ts` | **Modificar** | Retornar `owner_ids` no response para uso no upload posterior |
| 9 | `types/document.ts` | **Modificar** | Adicionar/actualizar interface `DeferredDocument` |

### Sem Alteração Necessária

| Ficheiro | Razão |
|----------|-------|
| `app/api/documents/upload/route.ts` | Continua igual — receberá `property_id`/`owner_id` válidos após o submit |
| `lib/r2/documents.ts` | Sem alteração — lógica de upload ao R2 permanece igual |
| `lib/r2/client.ts` | Sem alteração |
| `components/ui/file-upload.tsx` | Sem alteração — não é usado no Step 5 |
| `lib/validations/document.ts` | Sem alteração |

---

## 4. Trechos de Código Relevantes da Base de Código

### 4.1. UploadZone — Upload Imediato Actual (A MODIFICAR)

**Ficheiro:** `components/documents/UploadZone.tsx:34-86`

```typescript
const handleFile = useCallback(
  async (file: File) => {
    // Validações de tamanho e extensão (MANTER)
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Ficheiro excede o tamanho máximo de 20MB')
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext && !allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
      toast.error(`Extensão .${ext} não é permitida`)
      return
    }

    // ❌ PROBLEMA: Upload imediato sem IDs
    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('doc_type_id', docTypeId)
    if (propertyId) formData.append('property_id', propertyId)  // undefined no contexto de angariação!
    if (ownerId) formData.append('owner_id', ownerId)            // undefined no contexto de angariação!

    const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
    // ...
  },
  [docTypeId, allowedExtensions, onUploaded, propertyId, ownerId, consultantId]
)
```

### 4.2. Step 5 — Handler de Upload Concluído (A MODIFICAR)

**Ficheiro:** `components/acquisitions/step-5-documents.tsx:45-59`

```typescript
// Actualmente: guarda URL do R2 (resultado do upload imediato)
const handleUploaded = useCallback(
  (result: UploadResult, docTypeId: string) => {
    const currentDocs = form.getValues('documents') || []
    form.setValue('documents', [
      ...currentDocs,
      {
        doc_type_id: docTypeId,
        file_url: result.url,      // ← URL do R2 (upload já feito)
        file_name: result.file_name,
        metadata: {},
      },
    ])
  },
  [form]
)

// NOVO: guardar File object em vez de URL
const handleFileSelected = useCallback(
  (file: File, docTypeId: string) => {
    const currentDocs = form.getValues('documents') || []
    form.setValue('documents', [
      ...currentDocs,
      {
        doc_type_id: docTypeId,
        file: file,                 // ← File object (browser memory)
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        metadata: {},
      },
    ])
  },
  [form]
)
```

### 4.3. Acquisition Form Submit — Fluxo Actual (A MODIFICAR)

**Ficheiro:** `components/acquisitions/acquisition-form.tsx:133-158`

```typescript
const onSubmit = async (data: any) => {
  setIsSubmitting(true)
  try {
    // 1. Criar angariação (propriedade + owners + processo)
    const response = await fetch('/api/acquisitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),  // ← envia documents[] com file_url (se upload imediato funcionasse)
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)

    // ✅ Neste ponto, property_id e owner_ids JÁ EXISTEM
    // → AQUI é onde devemos fazer o upload dos ficheiros pendentes

    toast.success('Angariação criada com sucesso!')
    router.push(`/dashboard/processos/${result.proc_instance_id}`)
  } catch (error: any) {
    toast.error(error.message || 'Erro ao criar angariação')
  } finally {
    setIsSubmitting(false)
  }
}
```

### 4.4. API de Angariações — Registo de Documentos (A MODIFICAR)

**Ficheiro:** `app/api/acquisitions/route.ts:220-245`

```typescript
// Actualmente: regista documentos que JÁ têm file_url (upload imediato anterior)
if (data.documents && data.documents.length > 0) {
  const docInserts = data.documents
    .filter((doc) => doc.file_url && doc.file_name)  // ← Filtra docs sem URL
    .map((doc) => ({
      property_id: property.id,
      owner_id: doc.owner_id || null,
      doc_type_id: doc.doc_type_id,
      file_url: doc.file_url!,
      file_name: doc.file_name!,
      uploaded_by: user.id,
      // ...
    }))
  // INSERT em doc_registry
}

// NOVO: Não registar documentos aqui — o upload+registo será feito pelo frontend
// após receber o response com property_id
```

### 4.5. Response da API Acquisitions (A MODIFICAR)

**Ficheiro:** `app/api/acquisitions/route.ts:267-272`

```typescript
// Actualmente:
return NextResponse.json({
  success: true,
  property_id: property.id,
  proc_instance_id: procInstance.id,
  message: 'Angariação criada com sucesso',
})

// NOVO: incluir owner_ids para upload de documentos de proprietário
return NextResponse.json({
  success: true,
  property_id: property.id,
  proc_instance_id: procInstance.id,
  owner_ids: ownerIds,  // ← Array de UUIDs dos owners criados/reutilizados
  message: 'Angariação criada com sucesso',
})
```

### 4.6. API de Upload — Sem Alteração

**Ficheiro:** `app/api/documents/upload/route.ts:70-86`

```typescript
// Esta API continua IGUAL — o frontend passará property_id/owner_id VÁLIDOS
let ctx: DocumentContext
if (propertyId) {
  ctx = { type: 'property', propertyId }
} else if (ownerId) {
  ctx = { type: 'owner', ownerId }
} else if (consultantId) {
  ctx = { type: 'consultant', consultantId }
} else {
  return NextResponse.json(
    { error: 'Deve indicar property_id, owner_id ou consultant_id' },
    { status: 400 }
  )
}
```

### 4.7. Validação Zod — Schema de Documentos (A MODIFICAR)

**Ficheiro:** `lib/validations/acquisition.ts:121-133`

```typescript
// Actualmente: espera file_url (string do R2)
documents: z.array(z.object({
  doc_type_id: z.string().uuid(),
  file_url: z.string().optional(),   // URL do R2
  file_name: z.string().optional(),
  valid_until: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  owner_id: z.string().optional(),
})).optional(),

// NOVO: File objects não passam pelo JSON — separar dados do formulário dos ficheiros
// Opção A: remover documents do schema Zod (não serializar ficheiros no JSON)
// Opção B: manter schema mas ignorar file_url vazio (o frontend faz upload separado)
```

### 4.8. PendingDocument Type (EXISTENTE — aproveitar)

**Ficheiro:** `types/document.ts:52-65`

```typescript
// Já existe um tipo para documentos pendentes!
export interface PendingDocument {
  doc_type_id: string
  doc_type_name: string
  doc_type_category: string
  file_url?: string        // Preenchido após upload
  file_name?: string
  valid_until?: string
  metadata?: Record<string, any>
  owner_id?: string
  existing_doc?: Document | null
  is_uploaded: boolean      // ← Flag de estado!
}
```

---

## 5. Padrões Encontrados na Base de Código

### 5.1. Padrão de State em Array (Step 3 — Owners)

Os owners já usam o padrão de "guardar no form state e criar na API". Este é o modelo para documentos.

**Ficheiro:** `components/acquisitions/step-3-owners.tsx`

```typescript
// Owners são mantidos como array no form state
const owners = form.watch('owners') || []

// Adicionar owner
const addOwner = () => {
  form.setValue('owners', [...owners, { person_type: 'singular', name: '', ... }])
}

// Remover owner
const removeOwner = (index: number) => {
  form.setValue('owners', owners.filter((_, i) => i !== index))
}

// No submit: owners são enviados como JSON, API cria no DB
```

### 5.2. Padrão de File Preview (file-upload.tsx)

**Ficheiro:** `components/ui/file-upload.tsx` (WeakMap cache)

```typescript
// Cache de URLs de preview usando WeakMap (evita memory leaks)
const urlCache = new WeakMap<File, string>()

function getPreviewUrl(file: File): string {
  let url = urlCache.get(file)
  if (!url) {
    url = URL.createObjectURL(file)
    urlCache.set(file, url)
  }
  return url
}

// Cleanup no unmount:
URL.revokeObjectURL(cachedUrl)
```

### 5.3. Padrão de Upload com Progress (UploadZone)

**Ficheiro:** `components/documents/UploadZone.tsx:58-68`

```typescript
// Simular progress durante upload (manter este padrão)
const progressInterval = setInterval(() => {
  setProgress((prev) => Math.min(prev + 10, 90))
}, 200)

const res = await fetch('/api/documents/upload', { method: 'POST', body: formData })
clearInterval(progressInterval)
setProgress(100)
```

### 5.4. Padrão de Validação de Ficheiro (UploadZone)

**Ficheiro:** `components/documents/UploadZone.tsx:35-45`

```typescript
// Validação client-side (MANTER no modo deferred)
if (file.size > MAX_FILE_SIZE) {
  toast.error('Ficheiro excede o tamanho máximo de 20MB')
  return
}
const ext = file.name.split('.').pop()?.toLowerCase()
if (ext && !allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
  toast.error(`Extensão .${ext} não é permitida`)
  return
}
```

---

## 6. Snippets de Documentação Relevante

### 6.1. React Hook Form — Guardar File Objects no State

```typescript
// File objects podem ser guardados directamente no form state do React Hook Form
// NÃO podem ser serializados em JSON — devem ser extraídos antes do fetch

interface DocumentEntry {
  doc_type_id: string
  file: File          // Objecto nativo do browser
  file_name: string
  file_size: number
  file_type: string
}

// No form:
form.setValue('documents', [...currentDocs, newEntry])

// No submit — extrair ficheiros ANTES de JSON.stringify:
const pendingFiles = data.documents.filter(d => d.file instanceof File)
const jsonData = {
  ...data,
  documents: [] // Remover ficheiros do payload JSON
}
await fetch('/api/acquisitions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(jsonData)
})

// Depois do submit — upload individual:
for (const doc of pendingFiles) {
  const formData = new FormData()
  formData.append('file', doc.file)
  formData.append('doc_type_id', doc.doc_type_id)
  formData.append('property_id', result.property_id)
  await fetch('/api/documents/upload', { method: 'POST', body: formData })
}
```

### 6.2. URL.createObjectURL — Preview Local

```typescript
// Criar preview local de ficheiro (sem enviar ao servidor)
const previewUrl = URL.createObjectURL(file)
// <img src={previewUrl} /> ou apenas mostrar nome/tamanho

// IMPORTANTE: Revogar quando não for mais necessário
URL.revokeObjectURL(previewUrl)

// Padrão com useEffect cleanup:
useEffect(() => {
  return () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url))
  }
}, [])
```

### 6.3. FormData — Upload de Múltiplos Ficheiros

```typescript
// Upload sequencial de múltiplos ficheiros
async function uploadPendingDocuments(
  documents: DocumentEntry[],
  propertyId: string
): Promise<UploadResult[]> {
  const results: UploadResult[] = []

  for (const doc of documents) {
    const formData = new FormData()
    formData.append('file', doc.file)
    formData.append('doc_type_id', doc.doc_type_id)
    formData.append('property_id', propertyId)

    // NÃO definir Content-Type — o browser define automaticamente com boundary
    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json()
      console.error(`Erro no upload de ${doc.file_name}:`, err)
      continue // Continuar com os restantes
    }

    results.push(await res.json())
  }

  return results
}
```

### 6.4. Gotchas Importantes

| Problema | Solução |
|----------|---------|
| `File` não serializa em JSON | Extrair ficheiros do payload antes de `JSON.stringify()` |
| `FileList` é read-only | Converter para array: `Array.from(fileList)` |
| `URL.createObjectURL` causa memory leak | Chamar `URL.revokeObjectURL()` no cleanup/unmount |
| Revogar URL demasiado cedo quebra `<img>` | Só revogar após unmount do elemento que usa a URL |
| `Content-Type` manual quebra `FormData` | NUNCA definir `Content-Type` ao usar `FormData` |
| `form.reset()` não limpa `<input type="file">` | Reset manual: `inputRef.current.value = ''` |
| Ficheiro perdido ao navegar entre steps | State no React Hook Form persiste entre steps (OK) |
| `z.uuid()` rejeita alguns UUIDs Supabase | Usar `z.string().regex(/^[0-9a-f-]{36}$/)` |
| Mesmo ficheiro não re-seleccionável | Reset input: `e.target.value = ''` após onChange |

---

## 7. Arquitectura da Solução

### 7.1. Novo Tipo: DeferredDocument

```typescript
// types/document.ts — NOVO
export interface DeferredDocument {
  id: string                    // crypto.randomUUID() — para keying no React
  doc_type_id: string
  doc_type_name: string
  file: File                    // Objecto nativo do browser
  file_name: string
  file_size: number
  file_type: string
  owner_id?: string             // Se for documento de proprietário
  previewUrl?: string           // URL.createObjectURL para preview
}
```

### 7.2. UploadZone — Modo Deferred

```typescript
interface UploadZoneProps {
  docTypeId: string
  allowedExtensions: string[]
  // Modo normal (upload imediato)
  onUploaded?: (result: UploadResult, docTypeId: string) => void
  propertyId?: string
  ownerId?: string
  consultantId?: string
  // Modo deferred (guardar File)
  deferred?: boolean
  onFileSelected?: (file: File, docTypeId: string) => void
}
```

### 7.3. Fluxo de Submit Actualizado

```
1. Utilizador preenche Steps 1-4 (propriedade, localização, owners, contrato)
2. Step 5: selecciona ficheiros → File objects guardados no form state
3. Clica "Criar Angariação"
4. onSubmit():
   a. Extrair pendingFiles do form data
   b. Limpar documents[] do payload (não serializar Files)
   c. POST /api/acquisitions → receber { property_id, owner_ids, proc_instance_id }
   d. Para cada pendingFile: POST /api/documents/upload com property_id
   e. Mostrar progress (X de Y documentos)
   f. Redirect para /dashboard/processos/{proc_instance_id}
```

### 7.4. UX durante Upload Pós-Submit

```
[Criar Angariação] clicado
  ↓
  Botão: "A criar angariação..." (Loader2 spinner)
  ↓
  Angariação criada ✓
  ↓
  Botão: "A carregar documentos... (2/5)" (progress)
  ↓
  Todos concluídos → toast.success + redirect
  ↓
  Se algum falhar → toast.warning("X documento(s) não carregados — pode adicioná-los depois")
  → Redirect mesmo assim (documentos podem ser adicionados depois na página do processo)
```

---

## 8. Ordem de Implementação Sugerida

| Passo | Descrição | Ficheiro(s) |
|-------|-----------|-------------|
| 1 | Criar type `DeferredDocument` | `types/document.ts` |
| 2 | Adicionar modo `deferred` ao `UploadZone` | `components/documents/UploadZone.tsx` |
| 3 | Propagar `deferred` por `DocRow` → `DocCategoryCard` → `DocumentsSection` | 3 ficheiros |
| 4 | Actualizar `StepDocuments` para usar modo deferred | `components/acquisitions/step-5-documents.tsx` |
| 5 | Actualizar `DocCategoryCard` para reconhecer ficheiros pendentes vs uploaded | `components/documents/DocCategoryCard.tsx` |
| 6 | Actualizar schema Zod (documentos aceitar File ou remover do JSON) | `lib/validations/acquisition.ts` |
| 7 | Actualizar `onSubmit` no `AcquisitionForm` para upload pós-submit | `components/acquisitions/acquisition-form.tsx` |
| 8 | API retornar `owner_ids` no response | `app/api/acquisitions/route.ts` |
| 9 | Testar fluxo completo | Manual |

---

## 9. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Ficheiros grandes em memória do browser | Lentidão em devices fracos | Manter limite de 20MB por ficheiro, máx ~5 ficheiros simultâneos |
| Falha de upload após submit (rede instável) | Documentos não registados | Toast de aviso + documentos podem ser adicionados depois na página do processo |
| Utilizador fecha tab durante upload pós-submit | Ficheiros perdidos | Upload é rápido (ficheiros pequenos); dados da angariação já estão salvos |
| File objects perdidos entre steps | UX quebrada | React Hook Form mantém state entre steps — sem risco |
| Componentes de documentos usados noutros contextos | Regressão | Modo `deferred` é opt-in (prop booleana) — comportamento por defeito não muda |

---

## 10. Fontes e Referências

### Documentação Oficial
- [MDN: URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static)
- [MDN: URL.revokeObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static)
- [MDN: FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData)

### React Hook Form + File Upload
- [ClarityDev: React Hook Form Multipart Form Data](https://claritydev.net/blog/react-hook-form-multipart-form-data-file-uploads)
- [Refine: How to Multipart File Upload with RHF](https://refine.dev/blog/how-to-multipart-file-upload-with-react-hook-form/)
- [Common Ninja: Handling Multiple Uploads with RHF](https://www.commoninja.com/blog/handling-multiple-uploads-react-hook-form)

### Padrões da Base de Código
- `components/ui/file-upload.tsx` — WeakMap para cache de preview URLs
- `components/acquisitions/step-3-owners.tsx` — Padrão de array no form state
- `components/documents/UploadZone.tsx` — Validação client-side de ficheiros
- `lib/r2/documents.ts` — Sanitização de nomes + upload ao R2
