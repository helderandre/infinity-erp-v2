# PRD — M08: Módulo de Documentos — Pesquisa de Base de Código

**Data:** 2026-02-20
**Objectivo:** Resumo de toda a pesquisa realizada antes de implementar o M08.
Contém: ficheiros relevantes da base de código, trechos de documentações, achados da BD, padrões de implementação a reutilizar, e componente externo de file upload.

---

## 1. Estado da Base de Dados — Achados Críticos

> **Resultado da pesquisa directa ao Supabase (via MCP).**
> Muitas migrações que a SPEC-M08 menciona como "necessárias" JÁ FORAM APLICADAS.

### 1.1 `doc_registry` — Colunas Existentes

```
id, property_id, doc_type_id, file_url, file_name, uploaded_by,
valid_until, status, metadata, created_at, owner_id
```

- **`owner_id` JÁ EXISTE** → Migração 1 da SPEC NÃO é necessária.
- **Falta:** `updated_at`, `notes` (mencionados na SPEC mas não existem).

### 1.2 `owners` — 38 Colunas (KYC Completo Já Existe)

```
id, person_type, name, email, phone, nif, nationality, naturality,
marital_status, address, observations, legal_representative_name,
legal_representative_nif, company_cert_url, created_at, updated_at,

-- KYC Singular (já existem!)
birth_date, id_doc_type, id_doc_number, id_doc_expiry, id_doc_issued_by,
is_pep, pep_position, funds_origin, profession, last_profession,
is_portugal_resident, residence_country, postal_code, city,
marital_regime, legal_rep_id_doc,

-- KYC Colectiva (já existem!)
company_object, company_branches, legal_nature, country_of_incorporation,
cae_code, rcbe_code
```

- **TODOS os campos KYC da SPEC já existem na tabela** → Nenhuma migração de owners necessária.
- Basta expandir o formulário frontend para usar estes campos.

### 1.3 `owner_beneficiaries` — JÁ EXISTE

```
id, owner_id (FK → owners.id), full_name, position, share_percentage,
id_doc_type, id_doc_number, id_doc_expiry, id_doc_issued_by, nif, created_at
```

- **Tabela completa** → Nenhuma migração necessária.

### 1.4 `consultant_documents` — NÃO EXISTE ❌

- **Esta é a ÚNICA migração de tabela nova necessária.**
- Criar conforme SPEC secção 2.2.

### 1.5 `doc_types` — 22 Tipos Seedados

| category        | count |
|-----------------|-------|
| certificacao    | 2     |
| fiscal          | 3     |
| identificacao   | 3     |
| imovel          | 6     |
| legal           | 3     |
| proprietario    | 5     |

Tipos já existem e cobrem as necessidades do formulário de angariações.

### 1.6 Migração Necessária — Resumo

```sql
-- ÚNICA migração de tabela nova
CREATE TABLE consultant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES dev_users(id),
  doc_type_id UUID REFERENCES doc_types(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID REFERENCES dev_users(id),
  valid_until DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'expired')),
  metadata JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_consultant_documents_consultant ON consultant_documents(consultant_id);

-- Colunas opcionais em doc_registry (qualidade de vida)
ALTER TABLE doc_registry ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE doc_registry ADD COLUMN IF NOT EXISTS notes TEXT;
```

---

## 2. Ficheiros R2 / Upload — Estado Actual

### 2.1 Route Handlers de Upload — NÃO EXISTEM AINDA

A pasta `app/api/r2/` **está vazia** no projecto Next.js. Os ficheiros em `.temp/r2/` são referências **Nuxt.js** (usam `defineEventHandler`, `useRuntimeConfig`, `readMultipartFormData`). Precisam de ser convertidos para **Next.js Route Handlers**.

### 2.2 Dependências — JÁ INSTALADAS ✅

```json
"@aws-sdk/client-s3": "^3.x",
"@aws-sdk/s3-request-presigner": "^3.x"
```

### 2.3 Padrão de Conexão R2 para Next.js (a criar em `lib/r2/client.ts`)

Baseado nos ficheiros de referência `.temp/r2/`, convertido para Next.js:

```typescript
// lib/r2/client.ts
import { S3Client } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

export function getR2Client(): S3Client {
  if (s3Client) return s3Client

  const accountId = process.env.R2_ACCOUNT_ID
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 config missing. Definir R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.')
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })

  return s3Client
}

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'public'
export const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || ''
```

### 2.4 Helper de Upload de Documentos (a criar em `lib/r2/documents.ts`)

```typescript
// lib/r2/documents.ts
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'

type DocumentContext =
  | { type: 'property'; propertyId: string }
  | { type: 'owner'; ownerId: string }
  | { type: 'consultant'; consultantId: string }

function getBasePath(ctx: DocumentContext): string {
  switch (ctx.type) {
    case 'property': return `imoveis/${ctx.propertyId}`
    case 'owner': return `proprietarios/${ctx.ownerId}`
    case 'consultant': return `consultores/${ctx.consultantId}`
  }
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '-')                  // espaços/especiais → hífens
    .replace(/-+/g, '-')                                 // hífens consecutivos
    .toLowerCase()
}

export async function uploadDocumentToR2(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  ctx: DocumentContext
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const key = `${getBasePath(ctx)}/${Date.now()}-${sanitized}`

  const s3 = getR2Client()
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  }))

  return {
    url: R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key,
    key,
  }
}
```

### 2.5 Referência: Upload Nuxt.js Original (`.temp/r2/upload.post.ts`)

Pontos-chave do padrão existente:
- Dual mode: verifica binding Cloudflare primeiro, fallback S3 API
- Path: `{basePath}/{entityId}/{Date.now()}-{fileName}.webp`
- Content type fixo `image/webp` (para docs precisa ser dinâmico)
- Endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`
- Region: `'auto'`

```typescript
// Padrão de detecção de binding (referência — não aplicável em Vercel)
const cloudflare = (event.context as any)?._platform?.cloudflare
  ?? (event.context as any)?.cloudflare
const r2Bucket = cloudflare?.env?.R2_BUCKET
  ?? cloudflare?.env?.BUCKET
  ?? cloudflare?.env?.MEDIA

if (r2Bucket && typeof r2Bucket.put === 'function') {
  await r2Bucket.put(filePath, fileData.data, {
    httpMetadata: { contentType: 'image/webp' }
  })
} else {
  // Fallback S3 API
  await S3.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }))
}
```

> **Nota:** Como o deploy é Vercel, o dual mode pode ser simplificado para S3 API only.

---

## 3. Componente de File Upload — @diceui/file-upload

### 3.1 Instalação

```bash
npx shadcn@latest add @diceui/file-upload
```

O componente ainda **NÃO está instalado** no projecto (não existe `components/ui/file-upload.tsx`).

### 3.2 Layout Base

```tsx
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemProgress,
  FileUploadItemDelete,
  FileUploadClear,
} from "@/components/ui/file-upload"

<FileUpload>
  <FileUploadDropzone />
  <FileUploadTrigger />
  <FileUploadList>
    <FileUploadItem>
      <FileUploadItemPreview />
      <FileUploadItemMetadata />
      <FileUploadItemProgress />
      <FileUploadItemDelete />
    </FileUploadItem>
  </FileUploadList>
  <FileUploadClear />
</FileUpload>
```

### 3.3 Props Importantes (da documentação)

**`FileUpload` (Root):**
- `accept` — MIME types ou extensões aceites (ex: `{ 'application/pdf': ['.pdf'] }`)
- `maxFiles` — número máximo de ficheiros
- `maxSize` — tamanho máximo em bytes (20MB = `20 * 1024 * 1024`)
- `onUpload` — callback de upload directo `(files: File[]) => Promise<void>`
- `onFileValidate` — validação custom `(file: File) => string | null` (retorna erro ou null)
- `value` / `onValueChange` — controlled mode para react-hook-form
- `disabled` — desactivar todo o componente

**`FileUploadDropzone`:**
- Zona de drag-and-drop
- Data attributes: `[data-disabled]`, `[data-dragging]`, `[data-invalid]`

**`FileUploadItemProgress`:**
- `circular` — indicador circular em vez de linear
- `fill` — indicador de preenchimento (hold-to-delete style)

### 3.4 Integração com react-hook-form

Usar `value` e `onValueChange` props:

```tsx
<FileUpload
  value={field.value}
  onValueChange={field.onChange}
  onUpload={handleUpload}
  maxFiles={1}
  maxSize={20 * 1024 * 1024}
  accept={{
    'application/pdf': ['.pdf'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
  }}
>
  <FileUploadDropzone>
    <p>Arraste ficheiros ou clique para seleccionar</p>
  </FileUploadDropzone>
  <FileUploadList>
    <FileUploadItem>
      <FileUploadItemPreview />
      <FileUploadItemMetadata />
      <FileUploadItemProgress />
      <FileUploadItemDelete />
    </FileUploadItem>
  </FileUploadList>
</FileUpload>
```

### 3.5 Mapeamento extensões → accept MIME types

Converter `doc_types.allowed_extensions` para o formato `accept` do componente:

```typescript
// Mapa de extensão → MIME type
const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function extensionsToAccept(extensions: string[]): Record<string, string[]> {
  const accept: Record<string, string[]> = {}
  for (const ext of extensions) {
    const mime = EXTENSION_MIME_MAP[ext.toLowerCase()]
    if (mime) {
      if (!accept[mime]) accept[mime] = []
      accept[mime].push(`.${ext.toLowerCase()}`)
    }
  }
  return accept
}
```

---

## 4. Formulário de Angariações — Estado Actual

### 4.1 Estrutura do Multi-Step Form

**Ficheiro:** `components/acquisitions/acquisition-form.tsx` (260 linhas)

```typescript
const STEPS = [
  { value: 'property', title: 'Dados do Imóvel', fields: ['title', 'property_type', ...] },
  { value: 'location', title: 'Localização', fields: ['city', 'address_street', ...] },
  { value: 'owners', title: 'Proprietários', fields: ['owners'] },
  { value: 'contract', title: 'Contrato', fields: ['contract_regime', 'commission_agreed'] },
  { value: 'documents', title: 'Documentos', fields: [] },  // ← SEM validação
]
```

**Padrão de validação por step:**

```typescript
const onValidate = async (_value, direction) => {
  if (direction === 'prev') return true
  const currentStepData = STEPS.find((s) => s.value === step)
  if (!currentStepData || currentStepData.fields.length === 0) return true
  const isValid = await form.trigger(currentStepData.fields as any)
  if (!isValid) toast.error('Por favor, preencha todos os campos obrigatórios')
  return isValid
}
```

**Componente Stepper:** Usa `@/components/ui/stepper` (componente custom, instalado).

### 4.2 Step 3 — Proprietários (ACTUAL — A EXPANDIR)

**Ficheiro:** `components/acquisitions/step-3-owners.tsx` (248 linhas)

**Campos actuais** (apenas básicos):
- `person_type` (Select: singular/coletiva)
- `name`
- `email`, `phone`
- `nif`, `ownership_percentage`
- `is_main_contact` (Checkbox)

**Padrão de array dinâmico** (NÃO usa useFieldArray, usa form.setValue directamente):

```typescript
const owners = form.watch('owners') || []

const addOwner = () => {
  const newOwner = {
    person_type: 'singular',
    name: '', email: '', phone: '', nif: '',
    ownership_percentage: 100,
    is_main_contact: owners.length === 0,
  }
  form.setValue('owners', [...owners, newOwner])
}

const removeOwner = (index: number) => {
  const updated = owners.filter((_: any, i: number) => i !== index)
  if (owners[index]?.is_main_contact && updated.length > 0) {
    updated[0].is_main_contact = true
  }
  form.setValue('owners', updated)
}
```

**UI por proprietário:**
- Card com header (Badge "Proprietário {n}" + "Contacto Principal")
- Botão delete no canto
- Grid de campos FormField com react-hook-form control
- FormField name pattern: `owners.${index}.fieldName`

### 4.3 Step 5 — Documentos (ACTUAL — PLACEHOLDER)

**Ficheiro:** `components/acquisitions/step-5-documents.tsx` (47 linhas)

```tsx
// Componente actual — apenas placeholder
export function StepDocuments({ form }: StepDocumentsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Documentos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O upload de documentos é opcional nesta fase.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p>Upload de documentos será implementado numa versão futura</p>
        </CardContent>
      </Card>
      <div className="rounded-lg border bg-muted/50 p-4">
        <h4>Documentos sugeridos:</h4>
        <ul>
          <li>• Caderneta Predial</li>
          <li>• Certificado Energético</li>
          <li>• Documento de Identificação do Proprietário</li>
          <li>• CMI</li>
          <li>• Certidão Permanente (se pessoa colectiva)</li>
        </ul>
      </div>
    </div>
  )
}
```

### 4.4 Validação Zod — Schema Actual

**Ficheiro:** `lib/validations/acquisition.ts` (110 linhas)

Campos relevantes do owner no schema actual:

```typescript
owners: z.array(z.object({
  id: z.string().uuid().optional(),
  person_type: z.enum(['singular', 'coletiva']),
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  nif: z.string().min(9).max(9).optional().or(z.literal('')),
  nationality: z.string().optional(),
  naturality: z.string().optional(),
  marital_status: z.string().optional(),
  address: z.string().optional(),
  observations: z.string().optional(),
  ownership_percentage: z.number().min(0).max(100),
  is_main_contact: z.boolean(),
  legal_representative_name: z.string().optional(),
  legal_representative_nif: z.string().optional(),
})).min(1, 'Deve ter pelo menos um proprietário'),
```

**Novos campos KYC a adicionar ao schema:**

```typescript
// Singular — adicionar ao schema do owner
birth_date: z.string().optional(),                    // DatePicker → string ISO
id_doc_type: z.string().optional(),                   // Select: CC, BI, Passaporte, Outro
id_doc_number: z.string().optional(),
id_doc_expiry: z.string().optional(),                 // DatePicker
id_doc_issued_by: z.string().optional(),
is_pep: z.boolean().default(false),
pep_position: z.string().optional(),
funds_origin: z.array(z.string()).default([]),         // Checkboxes → array
profession: z.string().optional(),
last_profession: z.string().optional(),
is_portugal_resident: z.boolean().default(true),
residence_country: z.string().optional(),
postal_code: z.string().optional(),
city: z.string().optional(),
marital_regime: z.string().optional(),
legal_rep_id_doc: z.string().optional(),

// Colectiva — adicionar ao schema do owner
company_object: z.string().optional(),
company_branches: z.string().optional(),
legal_nature: z.string().optional(),
country_of_incorporation: z.string().default('Portugal'),
cae_code: z.string().optional(),
rcbe_code: z.string().optional(),

// Beneficiários (só para colectiva sem rcbe_code)
beneficiaries: z.array(z.object({
  full_name: z.string().min(2),
  position: z.string().optional(),
  share_percentage: z.string().optional(),
  id_doc_type: z.string().optional(),
  id_doc_number: z.string().optional(),
  id_doc_expiry: z.string().optional(),
  id_doc_issued_by: z.string().optional(),
  nif: z.string().optional(),
})).optional(),
```

**Padrão de validação condicional** (existente em `lib/validations/owner.ts`):

```typescript
.refine(
  (data) => {
    if (data.person_type === 'coletiva') {
      return data.legal_representative_name && data.legal_representative_nif
    }
    return true
  },
  {
    message: 'Para pessoas colectivas, o nome e NIF do representante legal são obrigatórios',
    path: ['legal_representative_name'],
  }
)
```

### 4.5 API de Angariações — Tratamento de Documentos

**Ficheiro:** `app/api/acquisitions/route.ts` (232 linhas)

O handler POST **já suporta documentos** se enviados com URL:

```typescript
// Secção 5 da API — já existe!
if (data.documents && data.documents.length > 0) {
  const docInserts = data.documents
    .filter((doc) => doc.file_url && doc.file_name)
    .map((doc) => ({
      property_id: property.id,
      doc_type_id: doc.doc_type_id,
      file_url: doc.file_url!,
      file_name: doc.file_name!,
      uploaded_by: user.id,
      valid_until: doc.valid_until || null,
      status: 'active',
      metadata: (doc.metadata || {}) as any,
    }))

  if (docInserts.length > 0) {
    await supabase.from('doc_registry').insert(docInserts)
  }
}
```

**Para M08:** A API precisa de ser expandida para:
1. Suportar `owner_id` nos documentos de proprietário
2. Criar registos de beneficiários em `owner_beneficiaries`
3. Aceitar campos KYC expandidos no `owners` insert

O insert de owners actual (a expandir com KYC):

```typescript
const { data: newOwner, error: ownerError } = await supabase
  .from('owners')
  .insert({
    person_type: ownerData.person_type,
    name: ownerData.name,
    email: ownerData.email || null,
    phone: ownerData.phone || null,
    nif: ownerData.nif || null,
    nationality: ownerData.nationality || null,
    marital_status: ownerData.marital_status || null,
    address: ownerData.address || null,
    observations: ownerData.observations || null,
    legal_representative_name: ownerData.legal_representative_name || null,
    legal_representative_nif: ownerData.legal_representative_nif || null,
    // ↓ ADICIONAR campos KYC ↓
    // birth_date, id_doc_type, id_doc_number, etc.
  })
  .select('id')
  .single()
```

---

## 5. Processos — Integração com Upload de Tarefas

### 5.1 Auto-Complete de Tarefas UPLOAD

**Ficheiro:** `lib/process-engine.ts` (209 linhas)

A função `autoCompleteTasks()` já procura documentos existentes e auto-completa:

```typescript
export async function autoCompleteTasks(procInstanceId: string, propertyId: string) {
  // 1. Busca tarefas UPLOAD pendentes
  const { data: tasks } = await supabase
    .from('proc_tasks')
    .select('id, config')
    .eq('proc_instance_id', procInstanceId)
    .eq('action_type', 'UPLOAD')
    .eq('status', 'pending')

  // 2. Busca docs do imóvel
  const { data: propertyDocs } = await supabase
    .from('doc_registry')
    .select('id, doc_type_id, valid_until, owner_id')
    .eq('property_id', propertyId)
    .eq('status', 'active')

  // 3. Busca docs dos owners (reutilizáveis!)
  const { data: ownerDocs } = await supabase
    .from('doc_registry')
    .select('id, doc_type_id, valid_until, owner_id')
    .in('owner_id', ownerIds)
    .is('property_id', null)  // ← Documentos reutilizáveis
    .eq('status', 'active')

  // 4. Match por doc_type_id + validade
  const matchingDoc = allDocs.find((doc) => {
    if (doc.doc_type_id !== docTypeId) return false
    if (!doc.valid_until) return true
    return new Date(doc.valid_until) > new Date()
  })

  // 5. Completa tarefa com resultado
  if (matchingDoc) {
    await supabase.from('proc_tasks').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      task_result: {
        doc_registry_id: matchingDoc.id,
        auto_completed: true,
        source: matchingDoc.owner_id ? 'owner_existing_document' : 'acquisition_form',
      },
    }).eq('id', task.id)
  }
}
```

### 5.2 Tarefas de Processo — UI Actual

**Ficheiro:** `components/processes/process-tasks-section.tsx` (332 linhas)

**Para tarefas UPLOAD completadas** mostra indicador:

```tsx
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

**Para tarefas UPLOAD pendentes** — **NÃO TEM UI de upload manual!**
O dropdown só tem "Iniciar", "Marcar como Concluída", "Dispensar", "Atribuir".
Falta: `task-upload-action.tsx` com área de upload integrada.

### 5.3 API de Tarefas — Acção Complete

**Ficheiro:** `app/api/processes/[id]/tasks/[taskId]/route.ts` (177 linhas)

A acção `complete` já aceita `task_result`:

```typescript
const taskUpdateSchema = z.object({
  action: z.enum(['complete', 'bypass', 'assign', 'start', 'reset']),
  bypass_reason: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  task_result: z.record(z.string(), z.any()).optional(),  // ← Aceita qualquer JSON
})

// Na acção 'complete':
case 'complete':
  updateData.status = 'completed'
  updateData.completed_at = new Date().toISOString()
  if (task_result) {
    updateData.task_result = task_result  // ← Já guarda doc_registry_id
  }
  break
```

**Fluxo para M08:** Upload → cria doc_registry → chama `PUT .../tasks/{id}` com `{ action: 'complete', task_result: { doc_registry_id } }` → recalcula progresso.

---

## 6. APIs Existentes — Padrões a Reutilizar

### 6.1 Padrão de Route Handler (GET com filtros)

**Ficheiro:** `app/api/owners/route.ts`

```typescript
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const nif = searchParams.get('nif')

  let query = supabase.from('owners').select('*').order('created_at', { ascending: false })

  if (nif) {
    query = query.eq('nif', nif)
  } else if (search) {
    query = query.or(`name.ilike.%${search}%,nif.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await query.limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 6.2 Padrão de Route Handler (POST com Zod)

**Ficheiro:** `app/api/owners/route.ts`

```typescript
export async function POST(request: Request) {
  const supabase = await createClient()

  const body = await request.json()
  const validation = ownerSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  // Verificar duplicata
  if (data.nif) {
    const { data: existing } = await supabase.from('owners').select('id').eq('nif', data.nif).single()
    if (existing) return NextResponse.json({ error: 'Já existe...' }, { status: 400 })
  }

  // Inserir
  const { data: owner, error } = await supabase.from('owners').insert(data).select().single()
  if (error) return NextResponse.json({ error: '...', details: error.message }, { status: 500 })
  return NextResponse.json(owner, { status: 201 })
}
```

### 6.3 Padrão de Route Handler (GET simples — doc-types)

**Ficheiro:** `app/api/libraries/doc-types/route.ts`

```typescript
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('doc_types')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 6.4 Clientes Supabase

**Server client** (`lib/supabase/server.ts`): Para Route Handlers com autenticação via cookies.
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

**Admin client** (`lib/supabase/admin.ts`): Para bypass RLS em funções internas.
```typescript
import { createAdminClient } from '@/lib/supabase/admin'
const supabase = createAdminClient()
```

---

## 7. Mapa de Ficheiros Afectados

### A CRIAR (novos)

| Ficheiro | Propósito |
|----------|-----------|
| `lib/r2/client.ts` | Cliente S3 singleton para R2 |
| `lib/r2/documents.ts` | Helper upload/delete de documentos |
| `lib/validations/document.ts` | Schemas Zod para upload e doc-types |
| `types/document.ts` | Types: Document, DocType, ConsultantDocument |
| `app/api/documents/upload/route.ts` | POST — rota central de upload (multipart) |
| `app/api/documents/[id]/route.ts` | GET detalhe, DELETE arquivar |
| `app/api/documents/route.ts` | GET listagem com filtros |
| `app/api/properties/[id]/documents/route.ts` | GET documentos do imóvel |
| `app/api/owners/[id]/documents/route.ts` | GET documentos do proprietário |
| `components/documents/document-uploader.tsx` | Wrapper do @diceui/file-upload |
| `components/documents/document-list.tsx` | Lista genérica de documentos |
| `components/documents/document-card.tsx` | Card individual de documento |
| `components/documents/document-preview-dialog.tsx` | Preview de PDF inline |
| `components/documents/document-upload-dialog.tsx` | Dialog de upload com select de tipo |
| `components/acquisitions/owner-kyc-singular.tsx` | Campos KYC pessoa singular |
| `components/acquisitions/owner-kyc-coletiva.tsx` | Campos KYC pessoa colectiva |
| `components/acquisitions/owner-beneficiaries-list.tsx` | Lista de beneficiários efectivos |
| `components/processes/task-upload-action.tsx` | Upload manual em tarefas de processo |

### A MODIFICAR (existentes)

| Ficheiro | Modificação |
|----------|-------------|
| `components/acquisitions/step-3-owners.tsx` | Integrar sub-formulários KYC condicionais |
| `components/acquisitions/step-5-documents.tsx` | Substituir placeholder por upload funcional |
| `lib/validations/acquisition.ts` | Adicionar campos KYC ao schema do owner |
| `lib/validations/owner.ts` | Expandir com campos KYC + refine condicional |
| `app/api/acquisitions/route.ts` | Passar campos KYC ao insert de owners + beneficiários |
| `app/api/libraries/doc-types/route.ts` | Adicionar POST e filtro por ?category= |
| `components/processes/process-tasks-section.tsx` | Integrar task-upload-action.tsx para UPLOAD tasks |

### A INSTALAR (dependências)

```bash
npx shadcn@latest add @diceui/file-upload
```

---

## 8. Padrão de Upload Multipart em Next.js Route Handlers

Next.js App Router lê multipart form data nativamente:

```typescript
// app/api/documents/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const docTypeId = formData.get('doc_type_id') as string
  const propertyId = formData.get('property_id') as string | null
  const ownerId = formData.get('owner_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
  }

  // Validar tamanho
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'Ficheiro demasiado grande. Máximo: 20MB' }, { status: 400 })
  }

  // Buscar extensões permitidas
  const { data: docType } = await supabase
    .from('doc_types')
    .select('allowed_extensions')
    .eq('id', docTypeId)
    .single()

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!docType?.allowed_extensions?.includes(ext)) {
    return NextResponse.json({
      error: `Formato não permitido. Aceite: ${docType?.allowed_extensions?.join(', ')}`
    }, { status: 400 })
  }

  // Converter File → Buffer
  const buffer = Buffer.from(await file.arrayBuffer())

  // Upload ao R2
  const ctx = propertyId
    ? { type: 'property' as const, propertyId }
    : ownerId
    ? { type: 'owner' as const, ownerId }
    : null

  const { url, key } = await uploadDocumentToR2(buffer, file.name, file.type, ctx!)

  // Registar na BD
  const { data: doc } = await supabase.from('doc_registry').insert({
    property_id: propertyId || null,
    owner_id: ownerId || null,
    doc_type_id: docTypeId,
    file_url: url,
    file_name: file.name,
    uploaded_by: user.id,
    status: 'active',
    metadata: { size: file.size, mimetype: file.type },
  }).select('id').single()

  return NextResponse.json({ id: doc.id, url, file_name: file.name })
}
```

---

## 9. Fluxo de Upload no Step 5 (Angariações)

```
Step 5 carrega
  │
  ├─ GET /api/libraries/doc-types → lista tipos por categoria
  │
  ├─ Proprietários do Step 3 → para cada owner, buscar docs existentes
  │  GET /api/owners/{id}/documents (se owner existente com id)
  │
  ├─ Para cada doc_type relevante, mostrar:
  │  ├─ "Já existe (válido)" → badge verde, link para doc, botão "Substituir"
  │  ├─ "Já existe (expirado)" → badge laranja, área de upload visível
  │  └─ Sem doc → <DocumentUploader /> visível
  │
  ├─ Ao fazer upload:
  │  1. POST /api/documents/upload (FormData: file + doc_type_id + owner_id/null)
  │  2. API retorna { id, url, file_name }
  │  3. Guardar em estado local: documents[].file_url = url, documents[].file_name = ...
  │
  └─ No submit final (POST /api/acquisitions):
     Os documentos vão no payload como:
     documents: [{ doc_type_id, file_url, file_name, owner_id?, metadata }]
     A API cria o property_id e regista tudo em doc_registry
```

---

## 10. Fluxo de Upload em Tarefas de Processo

```
Tarefa UPLOAD (status: pending/in_progress)
  │
  ├─ Componente task-upload-action.tsx verifica:
  │  ├─ task.task_result?.doc_registry_id → "Documento já anexado" + link
  │  │
  │  ├─ Busca doc existente do owner com mesmo doc_type_id → "Já existe documento válido"
  │  │  └─ Botão "Usar este documento" → PUT .../tasks/{id} { action: 'complete', task_result: { doc_registry_id } }
  │  │
  │  └─ Nenhum doc → <DocumentUploader /> com doc_type_id da tarefa
  │     └─ Upload → POST /api/documents/upload → doc_registry_id
  │        └─ PUT .../tasks/{id} { action: 'complete', task_result: { doc_registry_id } }
  │
  └─ Após complete → recalculateProgress() (já chamado automaticamente pela API)
```

---

## 11. Labels PT-PT Obrigatórias

```typescript
// Adicionar a lib/constants.ts
export const DOC_LABELS = {
  upload: 'Carregar documento',
  archive: 'Arquivar',
  replace: 'Substituir documento',
  use_existing: 'Usar este documento',
  select_file: 'Seleccionar ficheiro',
  drag_drop: 'Arraste ficheiros ou clique para seleccionar',
  valid_until: 'Válido até',
  issued_by: 'Emitido por',
  doc_type: 'Tipo de documento',
  already_exists_valid: 'Já existe (válido)',
  already_exists_expired: 'Já existe (expirado)',
  no_documents: 'Nenhum documento encontrado',
  max_size: 'Tamanho máximo: 20MB',
  format_error: 'Formato não permitido',
  upload_success: 'Documento carregado com sucesso',
  upload_error: 'Erro ao carregar documento',
  archive_confirm: 'Tem a certeza de que pretende arquivar este documento?',
} as const
```

---

## 12. Ordem de Implementação Recomendada

| Fase | Descrição | Ficheiros |
|------|-----------|-----------|
| **1** | Migração BD + R2 client + doc-types API | `consultant_documents` migration, `lib/r2/client.ts`, `lib/r2/documents.ts`, expand `doc-types` route |
| **2** | Rota central de upload | `app/api/documents/upload/route.ts`, `lib/validations/document.ts` |
| **3** | Componente de upload | Instalar @diceui/file-upload, `components/documents/document-uploader.tsx` |
| **4** | KYC no formulário de angariações | `owner-kyc-singular.tsx`, `owner-kyc-coletiva.tsx`, `owner-beneficiaries-list.tsx`, expandir `step-3-owners.tsx`, expandir `acquisition.ts` schema |
| **5** | Step 5 documentos funcional | Expandir `step-5-documents.tsx`, expandir `acquisitions/route.ts` |
| **6** | Upload em tarefas de processo | `task-upload-action.tsx`, modificar `process-tasks-section.tsx` |
| **7** | Rotas de leitura | `GET /api/documents`, `GET .../properties/[id]/documents`, `GET .../owners/[id]/documents` |
| **8** | Componentes de listagem | `document-list.tsx`, `document-card.tsx`, `document-preview-dialog.tsx`, `document-upload-dialog.tsx` |

> **Fases 9-10 (consultores + admin tipos)** dependem de M09 e M14 — adiar.
