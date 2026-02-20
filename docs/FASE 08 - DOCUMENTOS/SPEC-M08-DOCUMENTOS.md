# SPEC — M08: Modulo de Documentos — Implementacao Detalhada

**Data:** 2026-02-20
**Modulo:** M08 — Documentos (Upload, Gestao, KYC Proprietarios)
**PRD de Referencia:** [PRD-M08 DOCUMENTOS.md](PRD-M08%20DOCUMENTOS.md)

---

## Indice

1. [Resumo das Alteracoes](#1-resumo-das-alteracoes)
2. [Dependencias a Instalar](#2-dependencias-a-instalar)
3. [Mapa Completo de Ficheiros](#3-mapa-completo-de-ficheiros)
4. [Fase A — Migracoes de Base de Dados](#4-fase-a--migracoes-de-base-de-dados)
5. [Fase B — Infraestrutura R2 e Validacoes](#5-fase-b--infraestrutura-r2-e-validacoes)
6. [Fase C — API Route Handlers (Upload e Documentos)](#6-fase-c--api-route-handlers-upload-e-documentos)
7. [Fase D — Componente de Upload e UI de Documentos](#7-fase-d--componente-de-upload-e-ui-de-documentos)
8. [Fase E — KYC no Formulario de Angariacoes (Step 3)](#8-fase-e--kyc-no-formulario-de-angariacoes-step-3)
9. [Fase F — Step 5 Documentos Funcional](#9-fase-f--step-5-documentos-funcional)
10. [Fase G — Upload em Tarefas de Processo](#10-fase-g--upload-em-tarefas-de-processo)
11. [Fase H — Rotas de Leitura e Listagem](#11-fase-h--rotas-de-leitura-e-listagem)
12. [Fase I — Constantes e Types](#12-fase-i--constantes-e-types)
13. [Ordem de Execucao Recomendada](#13-ordem-de-execucao-recomendada)
14. [Criterios de Sucesso](#14-criterios-de-sucesso)
15. [Fora de Escopo](#15-fora-de-escopo)

---

## 1. Resumo das Alteracoes

### O Que Ja Existe e Funciona

- **Base de dados:** `doc_registry`, `doc_types` (22 seedados), `owners` (38 colunas KYC ja existem), `owner_beneficiaries` — tudo criado
- **API doc-types:** `GET /api/libraries/doc-types` retorna lista por categoria
- **API acquisitions:** `POST /api/acquisitions` ja insere docs em `doc_registry` se tiverem `file_url`
- **Process engine:** `autoCompleteTasks()` ja cruza docs existentes com tarefas UPLOAD e auto-completa
- **Process UI:** `process-tasks-section.tsx` mostra "Documento auto-detectado" em tarefas completadas
- **Constantes:** STATUS_COLORS ja define cores para `received`, `validated`, `rejected`
- **Dependencias AWS SDK:** `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` ja instalados
- **Step 5 placeholder:** `step-5-documents.tsx` existe mas mostra apenas "sera implementado"
- **Step 3 owners:** `step-3-owners.tsx` funcional com campos basicos (sem KYC)

### O Que Precisa Ser Feito

**Prioridade Alta (infraestrutura):**
1. Migracao BD: criar tabela `consultant_documents` + colunas opcionais em `doc_registry`
2. Cliente R2 singleton (`lib/r2/client.ts` + `lib/r2/documents.ts`)
3. Rota central de upload multipart (`POST /api/documents/upload`)
4. Componente de upload (`@diceui/file-upload` wrapper)

**Prioridade Alta (funcionalidades):**
5. KYC completo no formulario de angariacoes (Step 3 — campos condicionais singular/colectiva)
6. Step 5 documentos funcional (upload real com select de tipo)
7. Upload manual em tarefas UPLOAD de processo
8. Expansao da API de angariacoes para campos KYC + beneficiarios

**Prioridade Media (leitura e listagem):**
9. Rotas de listagem de documentos (por imovel, por proprietario, geral)
10. Componentes de listagem e card de documento
11. Dialog de preview de PDF inline
12. Dialog de upload avulso (fora de angariacao)

---

## 2. Dependencias a Instalar

```bash
# Componente de upload — shadcn registry (@diceui)
npx shadcn@latest add @diceui/file-upload
```

**Verificacao:** Confirmar que `components/ui/file-upload.tsx` NAO existe antes de instalar.

**Nota:** `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` ja estao instalados. Nao reinstalar.

---

## 3. Mapa Completo de Ficheiros

### 3.1 Ficheiros a CRIAR (18)

| # | Ficheiro | Funcao |
|---|----------|--------|
| 1 | `lib/r2/client.ts` | Cliente S3 singleton para Cloudflare R2 |
| 2 | `lib/r2/documents.ts` | Helpers upload/delete de documentos ao R2 |
| 3 | `lib/validations/document.ts` | Schemas Zod para upload, doc-types, status |
| 4 | `types/document.ts` | Types: Document, DocType, ConsultantDocument, UploadResult |
| 5 | `app/api/documents/upload/route.ts` | POST — rota central de upload multipart |
| 6 | `app/api/documents/[id]/route.ts` | GET detalhe, PUT status, DELETE arquivar |
| 7 | `app/api/documents/route.ts` | GET listagem geral com filtros |
| 8 | `app/api/properties/[id]/documents/route.ts` | GET documentos do imovel |
| 9 | `app/api/owners/[id]/documents/route.ts` | GET documentos do proprietario |
| 10 | `components/documents/document-uploader.tsx` | Wrapper do @diceui/file-upload com logica de upload |
| 11 | `components/documents/document-list.tsx` | Lista generica de documentos (tabela) |
| 12 | `components/documents/document-card.tsx` | Card individual de documento |
| 13 | `components/documents/document-preview-dialog.tsx` | Preview de PDF/imagem inline |
| 14 | `components/documents/document-upload-dialog.tsx` | Dialog de upload avulso com select de tipo |
| 15 | `components/acquisitions/owner-kyc-singular.tsx` | Sub-formulario KYC pessoa singular |
| 16 | `components/acquisitions/owner-kyc-coletiva.tsx` | Sub-formulario KYC pessoa colectiva |
| 17 | `components/acquisitions/owner-beneficiaries-list.tsx` | Lista de beneficiarios efectivos (colectiva sem RCBE) |
| 18 | `components/processes/task-upload-action.tsx` | Upload manual em tarefas UPLOAD de processo |

### 3.2 Ficheiros a MODIFICAR (7)

| # | Ficheiro | Modificacao |
|---|----------|-------------|
| 1 | `components/acquisitions/step-3-owners.tsx` | Integrar sub-formularios KYC condicionais (singular/colectiva) |
| 2 | `components/acquisitions/step-5-documents.tsx` | Substituir placeholder por upload funcional com select de tipo |
| 3 | `lib/validations/acquisition.ts` | Adicionar campos KYC + beneficiarios ao schema do owner + documents |
| 4 | `app/api/acquisitions/route.ts` | Passar campos KYC ao insert de owners + inserir beneficiarios |
| 5 | `app/api/libraries/doc-types/route.ts` | Adicionar handler POST e filtro por ?category= no GET |
| 6 | `components/processes/process-tasks-section.tsx` | Integrar task-upload-action.tsx para tarefas UPLOAD pendentes |
| 7 | `lib/constants.ts` | Adicionar DOC_LABELS e EXTENSION_MIME_MAP |

---

## 4. Fase A — Migracoes de Base de Dados

### Migracao #1: `create_consultant_documents`

**Via Supabase MCP `apply_migration`**

**Problema:** A tabela `consultant_documents` NAO existe. E a unica tabela nova necessaria — todos os outros schemas (doc_registry, owners KYC, owner_beneficiaries) ja foram criados em migracoes anteriores.

**SQL:**

```sql
-- Tabela de documentos de consultores (contrato, ID, etc.)
CREATE TABLE IF NOT EXISTS consultant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES dev_users(id) ON DELETE CASCADE,
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

-- Index para queries frequentes
CREATE INDEX IF NOT EXISTS idx_consultant_documents_consultant
  ON consultant_documents(consultant_id);

-- Comentarios
COMMENT ON TABLE consultant_documents IS 'Documentos associados a consultores (contrato, ID, certificados)';
COMMENT ON COLUMN consultant_documents.status IS 'active | archived | expired';
```

---

### Migracao #2: `add_doc_registry_optional_columns`

**Via Supabase MCP `apply_migration`**

**Problema:** `doc_registry` nao tem `updated_at` nem `notes`. Uteis para tracking de alteracoes e notas internas.

**SQL:**

```sql
-- Colunas opcionais de qualidade de vida
ALTER TABLE doc_registry ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE doc_registry ADD COLUMN IF NOT EXISTS notes TEXT;

-- Trigger para updated_at automatico
CREATE OR REPLACE FUNCTION update_doc_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doc_registry_updated_at ON doc_registry;
CREATE TRIGGER trg_doc_registry_updated_at
  BEFORE UPDATE ON doc_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_doc_registry_updated_at();
```

---

## 5. Fase B — Infraestrutura R2 e Validacoes

### Ficheiro #1 — `lib/r2/client.ts` (CRIAR)

**Funcao:** Cliente S3 singleton para Cloudflare R2. Reutilizado por todos os handlers de upload.

```typescript
// lib/r2/client.ts
import { S3Client } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

export function getR2Client(): S3Client {
  if (s3Client) return s3Client

  const accountId = process.env.R2_ACCOUNT_ID
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'Configuracao R2 em falta. Definir R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY em .env.local'
    )
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

---

### Ficheiro #2 — `lib/r2/documents.ts` (CRIAR)

**Funcao:** Helpers de upload e delete de documentos. Sanitiza nomes, gera paths, executa PutObjectCommand/DeleteObjectCommand.

```typescript
// lib/r2/documents.ts
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'

// Contexto determina o path no R2
export type DocumentContext =
  | { type: 'property'; propertyId: string }
  | { type: 'owner'; ownerId: string }
  | { type: 'consultant'; consultantId: string }

function getBasePath(ctx: DocumentContext): string {
  switch (ctx.type) {
    case 'property':
      return `${process.env.R2_DOCUMENTS_PATH || 'imoveis'}/${ctx.propertyId}`
    case 'owner':
      return `proprietarios/${ctx.ownerId}`
    case 'consultant':
      return `consultores/${ctx.consultantId}`
  }
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '-') // espacos/especiais → hifens
    .replace(/-+/g, '-') // hifens consecutivos
    .replace(/^-|-$/g, '') // hifens no inicio/fim
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
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  )

  return {
    url: R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key,
    key,
  }
}

export async function deleteDocumentFromR2(key: string): Promise<void> {
  const s3 = getR2Client()
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  )
}
```

---

### Ficheiro #3 — `lib/validations/document.ts` (CRIAR)

**Funcao:** Schemas Zod para upload de documentos, criacao de doc-types, e actualizacao de status.

```typescript
// lib/validations/document.ts
import { z } from 'zod'

// Upload de documento (validacao do form data parseado)
export const documentUploadSchema = z.object({
  doc_type_id: z.string().min(1, 'Tipo de documento obrigatorio'),
  property_id: z.string().optional(),
  owner_id: z.string().optional(),
  consultant_id: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
})

// Actualizacao de status de documento
export const documentStatusSchema = z.object({
  status: z.enum(['active', 'archived', 'expired']),
  notes: z.string().optional(),
})

// Criacao de tipo de documento (admin)
export const docTypeCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  category: z.string().min(1, 'Categoria obrigatoria'),
  allowed_extensions: z
    .array(z.string())
    .default(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']),
  default_validity_months: z.number().int().positive().optional(),
  is_system: z.boolean().default(false),
})

// Mapa de extensao → MIME type (para o componente de upload)
export const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

// Converter allowed_extensions do doc_type para o formato accept do file-upload
export function extensionsToAccept(
  extensions: string[]
): Record<string, string[]> {
  const accept: Record<string, string[]> = {}
  for (const ext of extensions) {
    const mime = EXTENSION_MIME_MAP[ext.toLowerCase()]
    if (mime) {
      if (!accept[mime]) accept[mime] = []
      if (!accept[mime].includes(`.${ext.toLowerCase()}`)) {
        accept[mime].push(`.${ext.toLowerCase()}`)
      }
    }
  }
  return accept
}

// Tamanho maximo de ficheiro (20MB)
export const MAX_FILE_SIZE = 20 * 1024 * 1024
```

---

### Ficheiro #4 — `types/document.ts` (CRIAR)

**Funcao:** Types TypeScript para documentos, tipos de documento, e resultados de upload.

```typescript
// types/document.ts

export interface DocType {
  id: string
  name: string
  description: string | null
  category: string
  allowed_extensions: string[]
  default_validity_months: number | null
  is_system: boolean
}

export interface Document {
  id: string
  property_id: string | null
  owner_id: string | null
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
  // Joins opcionais
  doc_type?: DocType
  uploaded_by_user?: { id: string; commercial_name: string }
}

export interface ConsultantDocument {
  id: string
  consultant_id: string
  doc_type_id: string | null
  file_url: string
  file_name: string
  uploaded_by: string | null
  valid_until: string | null
  status: 'active' | 'archived' | 'expired'
  metadata: Record<string, any>
  notes: string | null
  created_at: string
  // Joins opcionais
  doc_type?: DocType
}

export interface UploadResult {
  id: string
  url: string
  file_name: string
}

// Para o Step 5 — documento pendente de upload no formulario
export interface PendingDocument {
  doc_type_id: string
  doc_type_name: string
  doc_type_category: string
  file_url?: string
  file_name?: string
  valid_until?: string
  metadata?: Record<string, any>
  owner_id?: string
  // Estado local
  existing_doc?: Document | null // doc ja existente (reutilizavel)
  is_uploaded: boolean
}
```

---

## 6. Fase C — API Route Handlers (Upload e Documentos)

### Ficheiro #5 — `app/api/documents/upload/route.ts` (CRIAR)

**Funcao:** Rota central de upload multipart. Recebe ficheiro via FormData, valida extensao contra doc_types, faz upload ao R2, regista em doc_registry.

```typescript
// app/api/documents/upload/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadDocumentToR2, type DocumentContext } from '@/lib/r2/documents'
import { MAX_FILE_SIZE } from '@/lib/validations/document'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Autenticacao
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // 2. Ler FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const docTypeId = formData.get('doc_type_id') as string | null
    const propertyId = formData.get('property_id') as string | null
    const ownerId = formData.get('owner_id') as string | null
    const consultantId = formData.get('consultant_id') as string | null
    const validUntil = formData.get('valid_until') as string | null
    const notes = formData.get('notes') as string | null

    // 3. Validacoes basicas
    if (!file) {
      return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
    }
    if (!docTypeId) {
      return NextResponse.json(
        { error: 'Tipo de documento obrigatorio' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Ficheiro demasiado grande. Maximo: 20MB' },
        { status: 400 }
      )
    }

    // 4. Validar extensao contra doc_types.allowed_extensions
    const { data: docType, error: dtError } = await supabase
      .from('doc_types')
      .select('allowed_extensions, name')
      .eq('id', docTypeId)
      .single()

    if (dtError || !docType) {
      return NextResponse.json(
        { error: 'Tipo de documento nao encontrado' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !docType.allowed_extensions?.includes(ext)) {
      return NextResponse.json(
        {
          error: `Formato nao permitido para "${docType.name}". Aceite: ${docType.allowed_extensions?.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // 5. Determinar contexto de upload (path no R2)
    let ctx: DocumentContext
    if (propertyId) {
      ctx = { type: 'property', propertyId }
    } else if (ownerId) {
      ctx = { type: 'owner', ownerId }
    } else if (consultantId) {
      ctx = { type: 'consultant', consultantId }
    } else {
      return NextResponse.json(
        {
          error:
            'Deve indicar property_id, owner_id ou consultant_id',
        },
        { status: 400 }
      )
    }

    // 6. Converter File → Buffer e upload ao R2
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url, key } = await uploadDocumentToR2(
      buffer,
      file.name,
      file.type,
      ctx
    )

    // 7. Registar na BD
    // Para consultores usa tabela propria; para property/owner usa doc_registry
    if (consultantId) {
      const { data: doc, error: insertError } = await supabase
        .from('consultant_documents')
        .insert({
          consultant_id: consultantId,
          doc_type_id: docTypeId,
          file_url: url,
          file_name: file.name,
          uploaded_by: user.id,
          valid_until: validUntil || null,
          status: 'active',
          metadata: { size: file.size, mimetype: file.type, r2_key: key },
          notes: notes || null,
        })
        .select('id')
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: 'Erro ao registar documento', details: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { id: doc!.id, url, file_name: file.name },
        { status: 201 }
      )
    }

    // doc_registry para property/owner
    const { data: doc, error: insertError } = await supabase
      .from('doc_registry')
      .insert({
        property_id: propertyId || null,
        owner_id: ownerId || null,
        doc_type_id: docTypeId,
        file_url: url,
        file_name: file.name,
        uploaded_by: user.id,
        valid_until: validUntil || null,
        status: 'active',
        metadata: { size: file.size, mimetype: file.type, r2_key: key },
        notes: notes || null,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Erro ao registar documento', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { id: doc!.id, url, file_name: file.name },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro no upload de documento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
```

---

### Ficheiro #6 — `app/api/documents/[id]/route.ts` (CRIAR)

**Funcao:** GET detalhe de um documento, PUT para alterar status, DELETE para arquivar.

```typescript
// app/api/documents/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { documentStatusSchema } from '@/lib/validations/document'

// GET — detalhe do documento com doc_type e uploaded_by
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category, allowed_extensions),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .eq('id', id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Documento nao encontrado' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — alterar status do documento (active → archived, etc.)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = documentStatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { status, notes } = parsed.data

    const { error } = await supabase
      .from('doc_registry')
      .update({ status, notes: notes || null })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao actualizar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — arquivar documento (soft delete: status → archived)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('doc_registry')
      .update({ status: 'archived' })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao arquivar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

---

### Ficheiro #7 — `app/api/documents/route.ts` (CRIAR)

**Funcao:** GET listagem geral de documentos com filtros (property_id, owner_id, doc_type_id, status, search).

```typescript
// app/api/documents/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const propertyId = searchParams.get('property_id')
    const ownerId = searchParams.get('owner_id')
    const docTypeId = searchParams.get('doc_type_id')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (propertyId) query = query.eq('property_id', propertyId)
    if (ownerId) query = query.eq('owner_id', ownerId)
    if (docTypeId) query = query.eq('doc_type_id', docTypeId)
    if (status) query = query.eq('status', status)
    if (search) query = query.ilike('file_name', `%${search}%`)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao listar documentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

---

### Ficheiro #8 — `app/api/properties/[id]/documents/route.ts` (CRIAR)

**Funcao:** GET documentos de um imovel especifico (atalho para GET /api/documents?property_id=X). Inclui documentos dos proprietarios associados.

```typescript
// app/api/properties/[id]/documents/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: propertyId } = await params
    const supabase = await createClient()

    // 1. Documentos directos do imovel
    const { data: propertyDocs, error: propError } = await supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .eq('property_id', propertyId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (propError) {
      return NextResponse.json({ error: propError.message }, { status: 500 })
    }

    // 2. Buscar proprietarios do imovel
    const { data: owners } = await supabase
      .from('property_owners')
      .select('owner_id')
      .eq('property_id', propertyId)

    const ownerIds = owners?.map((o) => o.owner_id).filter(Boolean) || []

    // 3. Documentos reutilizaveis dos proprietarios (property_id IS NULL)
    let ownerDocs: any[] = []
    if (ownerIds.length > 0) {
      const { data } = await supabase
        .from('doc_registry')
        .select(`
          *,
          doc_type:doc_types(id, name, category),
          uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
        `)
        .in('owner_id', ownerIds)
        .is('property_id', null)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })

      ownerDocs = data || []
    }

    return NextResponse.json({
      property_documents: propertyDocs || [],
      owner_documents: ownerDocs,
    })
  } catch (error) {
    console.error('Erro ao obter documentos do imovel:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

---

### Ficheiro #9 — `app/api/owners/[id]/documents/route.ts` (CRIAR)

**Funcao:** GET documentos de um proprietario especifico.

```typescript
// app/api/owners/[id]/documents/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ownerId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('doc_registry')
      .select(`
        *,
        doc_type:doc_types(id, name, category),
        uploaded_by_user:dev_users!doc_registry_uploaded_by_fkey(id, commercial_name)
      `)
      .eq('owner_id', ownerId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao obter documentos do proprietario:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

---

### Ficheiro #5 (MODIFICAR) — `app/api/libraries/doc-types/route.ts`

**Estado actual:** Apenas handler GET que lista todos os tipos. 26 linhas.

**Modificacao:** Adicionar filtro por `?category=` no GET e adicionar handler POST para criar tipo.

```typescript
// app/api/libraries/doc-types/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { docTypeCreateSchema } from '@/lib/validations/document'

// GET — listar tipos de documento (com filtro opcional por categoria)
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let query = supabase
      .from('doc_types')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar tipos de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar novo tipo de documento
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = docTypeCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('doc_types')
      .insert(parsed.data)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('unique') ? 400 : 500 }
      )
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar tipo de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

---

## 7. Fase D — Componente de Upload e UI de Documentos

### Ficheiro #10 — `components/documents/document-uploader.tsx` (CRIAR)

**Funcao:** Wrapper do @diceui/file-upload com logica de upload ao backend. Aceita doc_type_id para validacao de extensoes. Usado em Step 5, tarefas de processo, e dialog avulso.

```tsx
// components/documents/document-uploader.tsx
'use client'

import { useState, useCallback } from 'react'
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemDelete,
} from '@/components/ui/file-upload'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { extensionsToAccept, MAX_FILE_SIZE } from '@/lib/validations/document'
import type { UploadResult } from '@/types/document'

interface DocumentUploaderProps {
  docTypeId: string
  allowedExtensions: string[]
  propertyId?: string
  ownerId?: string
  consultantId?: string
  validUntil?: string
  maxFiles?: number
  disabled?: boolean
  onUploaded: (result: UploadResult) => void
  onError?: (error: string) => void
}

export function DocumentUploader({
  docTypeId,
  allowedExtensions,
  propertyId,
  ownerId,
  consultantId,
  validUntil,
  maxFiles = 1,
  disabled = false,
  onUploaded,
  onError,
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<File[]>([])

  const accept = extensionsToAccept(allowedExtensions)

  const handleUpload = useCallback(
    async (filesToUpload: File[]) => {
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('doc_type_id', docTypeId)
        if (propertyId) formData.append('property_id', propertyId)
        if (ownerId) formData.append('owner_id', ownerId)
        if (consultantId) formData.append('consultant_id', consultantId)
        if (validUntil) formData.append('valid_until', validUntil)

        try {
          const res = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || 'Erro ao carregar documento')
          }

          const result: UploadResult = await res.json()
          toast.success('Documento carregado com sucesso')
          onUploaded(result)
        } catch (error: any) {
          const msg = error.message || 'Erro ao carregar documento'
          toast.error(msg)
          onError?.(msg)
        }
      }
    },
    [docTypeId, propertyId, ownerId, consultantId, validUntil, onUploaded, onError]
  )

  return (
    <FileUpload
      value={files}
      onValueChange={setFiles}
      onUpload={handleUpload}
      maxFiles={maxFiles}
      maxSize={MAX_FILE_SIZE}
      accept={accept}
      disabled={disabled}
    >
      <FileUploadDropzone className="min-h-[120px] flex flex-col items-center justify-center gap-2 border-dashed">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Arraste ficheiros ou clique para seleccionar
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Formatos: {allowedExtensions.join(', ').toUpperCase()} — Max: 20MB
          </p>
        </div>
      </FileUploadDropzone>
      <FileUploadList>
        <FileUploadItem>
          <FileUploadItemPreview />
          <FileUploadItemMetadata />
          <FileUploadItemDelete />
        </FileUploadItem>
      </FileUploadList>
    </FileUpload>
  )
}
```

---

### Ficheiro #11 — `components/documents/document-list.tsx` (CRIAR)

**Funcao:** Lista generica de documentos em formato tabela. Mostra nome, tipo, status, data, accoes.

```tsx
// components/documents/document-list.tsx
'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  MoreHorizontal,
  Eye,
  Archive,
  Download,
  ExternalLink,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import type { Document } from '@/types/document'

interface DocumentListProps {
  documents: Document[]
  onPreview?: (doc: Document) => void
  onArchive?: (docId: string) => void
  emptyMessage?: string
}

export function DocumentList({
  documents,
  onPreview,
  onArchive,
  emptyMessage = 'Nenhum documento encontrado',
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Validade</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="w-[50px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {documents.map((doc) => {
          const statusConfig =
            STATUS_COLORS[doc.status as keyof typeof STATUS_COLORS]
          const isExpired =
            doc.valid_until && new Date(doc.valid_until) < new Date()

          return (
            <TableRow key={doc.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate max-w-[200px]">{doc.file_name}</span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {doc.doc_type?.name || '—'}
                </span>
              </TableCell>
              <TableCell>
                {statusConfig ? (
                  <Badge
                    variant="outline"
                    className={`${statusConfig.bg} ${statusConfig.text} border-0`}
                  >
                    {statusConfig.label}
                  </Badge>
                ) : (
                  <Badge variant="outline">{doc.status}</Badge>
                )}
              </TableCell>
              <TableCell>
                {doc.valid_until ? (
                  <span
                    className={
                      isExpired ? 'text-red-600 font-medium' : 'text-sm'
                    }
                  >
                    {formatDate(doc.valid_until)}
                    {isExpired && ' (expirado)'}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(doc.created_at)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onPreview && (
                      <DropdownMenuItem onClick={() => onPreview(doc)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Abrir
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href={doc.file_url} download={doc.file_name}>
                        <Download className="mr-2 h-4 w-4" />
                        Descarregar
                      </a>
                    </DropdownMenuItem>
                    {onArchive && doc.status === 'active' && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onArchive(doc.id)}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Arquivar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
```

---

### Ficheiro #12 — `components/documents/document-card.tsx` (CRIAR)

**Funcao:** Card individual de documento. Alternativa visual ao formato tabela. Mostra icone, nome, tipo, badge status, validade.

```tsx
// components/documents/document-card.tsx
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { STATUS_COLORS } from '@/lib/constants'
import type { Document } from '@/types/document'

interface DocumentCardProps {
  document: Document
  onPreview?: () => void
  compact?: boolean
}

export function DocumentCard({ document, onPreview, compact = false }: DocumentCardProps) {
  const statusConfig = STATUS_COLORS[document.status as keyof typeof STATUS_COLORS]
  const isExpired = document.valid_until && new Date(document.valid_until) < new Date()

  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{document.file_name}</p>
              {isExpired ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : document.status === 'active' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {document.doc_type?.name && <span>{document.doc_type.name}</span>}
              {document.valid_until && (
                <span className={isExpired ? 'text-red-600' : ''}>
                  Valido ate {formatDate(document.valid_until)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {statusConfig && (
              <Badge
                variant="outline"
                className={`${statusConfig.bg} ${statusConfig.text} border-0 text-xs`}
              >
                {statusConfig.label}
              </Badge>
            )}
            {onPreview && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPreview}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

### Ficheiro #13 — `components/documents/document-preview-dialog.tsx` (CRIAR)

**Funcao:** Dialog modal para preview de documentos. PDF mostra iframe, imagens mostram img tag.

```tsx
// components/documents/document-preview-dialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download, ExternalLink } from 'lucide-react'
import type { Document } from '@/types/document'

interface DocumentPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: Document | null
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  document,
}: DocumentPreviewDialogProps) {
  if (!document) return null

  const isPdf =
    document.file_name.toLowerCase().endsWith('.pdf') ||
    document.metadata?.mimetype === 'application/pdf'
  const isImage =
    document.metadata?.mimetype?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp)$/i.test(document.file_name)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate">{document.file_name}</span>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button variant="outline" size="sm" asChild>
                <a href={document.file_url} download={document.file_name}>
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={document.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir
                </a>
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 overflow-auto max-h-[70vh]">
          {isPdf ? (
            <iframe
              src={document.file_url}
              className="w-full h-[70vh] rounded border"
              title={document.file_name}
            />
          ) : isImage ? (
            <img
              src={document.file_url}
              alt={document.file_name}
              className="max-w-full rounded"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                Pre-visualizacao nao disponivel para este formato.
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <a href={document.file_url} download={document.file_name}>
                  <Download className="mr-2 h-4 w-4" />
                  Descarregar ficheiro
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Ficheiro #14 — `components/documents/document-upload-dialog.tsx` (CRIAR)

**Funcao:** Dialog de upload avulso (fora de angariacao). Permite seleccionar tipo de documento e fazer upload.

```tsx
// components/documents/document-upload-dialog.tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DocumentUploader } from './document-uploader'
import type { DocType, UploadResult } from '@/types/document'

interface DocumentUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId?: string
  ownerId?: string
  onUploaded: (result: UploadResult) => void
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  propertyId,
  ownerId,
  onUploaded,
}: DocumentUploadDialogProps) {
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [selectedDocType, setSelectedDocType] = useState<DocType | null>(null)
  const [validUntil, setValidUntil] = useState('')

  useEffect(() => {
    if (open && docTypes.length === 0) {
      fetch('/api/libraries/doc-types')
        .then((res) => res.json())
        .then((data) => setDocTypes(data))
        .catch(() => setDocTypes([]))
    }
  }, [open, docTypes.length])

  useEffect(() => {
    if (!open) {
      setSelectedDocType(null)
      setValidUntil('')
    }
  }, [open])

  // Agrupar por categoria
  const byCategory = docTypes.reduce<Record<string, DocType[]>>((acc, dt) => {
    const cat = dt.category || 'Outros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  const handleUploaded = (result: UploadResult) => {
    onUploaded(result)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carregar Documento</DialogTitle>
          <DialogDescription>
            Seleccione o tipo de documento e carregue o ficheiro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de documento */}
          <div className="space-y-2">
            <Label>Tipo de Documento *</Label>
            <Select
              value={selectedDocType?.id || ''}
              onValueChange={(id) => {
                const dt = docTypes.find((d) => d.id === id)
                setSelectedDocType(dt || null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(byCategory).map(([category, types]) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {types.map((dt) => (
                      <SelectItem key={dt.id} value={dt.id}>
                        {dt.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Validade */}
          <div className="space-y-2">
            <Label>Valido ate (opcional)</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          {/* Upload — visivel apenas apos seleccionar tipo */}
          {selectedDocType && (
            <DocumentUploader
              docTypeId={selectedDocType.id}
              allowedExtensions={selectedDocType.allowed_extensions}
              propertyId={propertyId}
              ownerId={ownerId}
              validUntil={validUntil || undefined}
              onUploaded={handleUploaded}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 8. Fase E — KYC no Formulario de Angariacoes (Step 3)

### Ficheiro #15 — `components/acquisitions/owner-kyc-singular.tsx` (CRIAR)

**Funcao:** Sub-formulario com campos KYC para pessoa singular. Renderizado condicionalmente quando `person_type === 'singular'`. Usa Collapsible do shadcn para nao sobrecarregar a UI.

**Campos:**
- `birth_date` (Input date)
- `id_doc_type` (Select: CC, BI, Passaporte, Titulo de Residencia, Outro)
- `id_doc_number`, `id_doc_expiry` (Input date), `id_doc_issued_by`
- `is_pep` (Switch) + `pep_position` (condicional)
- `funds_origin` (Checkboxes: Salario, Poupancas, Heranca, Venda de Imovel, Investimentos, Emprestimo, Outro)
- `profession`, `last_profession`
- `is_portugal_resident` (Switch) + `residence_country` (condicional: se false)
- `postal_code`, `city`
- `marital_regime` (Select: Comunhao de adquiridos, Separacao de bens, Comunhao geral, Uniao de facto)

**Padrao de FormField:**
Cada campo segue o padrao existente em step-3-owners.tsx:
```tsx
<FormField
  control={form.control}
  name={`owners.${index}.birth_date`}
  render={({ field }) => (
    <FormItem>
      <FormLabel>Data de Nascimento</FormLabel>
      <FormControl>
        <Input type="date" {...field} value={field.value || ''} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Estrutura do componente:**
```tsx
// components/acquisitions/owner-kyc-singular.tsx
'use client'

import { UseFormReturn } from 'react-hook-form'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

const ID_DOC_TYPES = [
  { value: 'CC', label: 'Cartao de Cidadao' },
  { value: 'BI', label: 'Bilhete de Identidade' },
  { value: 'Passaporte', label: 'Passaporte' },
  { value: 'Titulo de Residencia', label: 'Titulo de Residencia' },
  { value: 'Outro', label: 'Outro' },
]

const FUNDS_ORIGINS = [
  'Salario', 'Poupancas', 'Heranca', 'Venda de Imovel',
  'Investimentos', 'Emprestimo', 'Outro',
]

const MARITAL_REGIMES = [
  { value: 'comunhao_adquiridos', label: 'Comunhao de Adquiridos' },
  { value: 'separacao_bens', label: 'Separacao de Bens' },
  { value: 'comunhao_geral', label: 'Comunhao Geral de Bens' },
  { value: 'uniao_facto', label: 'Uniao de Facto' },
]

interface OwnerKycSingularProps {
  form: UseFormReturn<any>
  index: number
}

export function OwnerKycSingular({ form, index }: OwnerKycSingularProps) {
  const [isOpen, setIsOpen] = useState(false)
  const isPep = form.watch(`owners.${index}.is_pep`)
  const isResident = form.watch(`owners.${index}.is_portugal_resident`)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between">
          Dados KYC — Pessoa Singular
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {/* Documento de Identificacao */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* id_doc_type Select */}
          {/* id_doc_number Input */}
          {/* id_doc_expiry Input date */}
          {/* id_doc_issued_by Input */}
        </div>

        {/* Dados Pessoais */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* birth_date Input date */}
          {/* profession Input */}
          {/* last_profession Input */}
        </div>

        {/* Residencia */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* is_portugal_resident Switch */}
          {/* residence_country Input (condicional: se !isResident) */}
          {/* postal_code Input */}
          {/* city Input */}
        </div>

        {/* Regime Matrimonial */}
        {/* marital_regime Select */}

        {/* PEP */}
        <div className="space-y-2">
          {/* is_pep Switch */}
          {/* pep_position Input (condicional: se isPep) */}
        </div>

        {/* Origem de Fundos */}
        {/* funds_origin Checkboxes (array) */}
      </CollapsibleContent>
    </Collapsible>
  )
}
```

**Nota:** O componente completo tera ~150 linhas. O padrao acima mostra a estrutura; cada campo segue o FormField pattern.

---

### Ficheiro #16 — `components/acquisitions/owner-kyc-coletiva.tsx` (CRIAR)

**Funcao:** Sub-formulario KYC para pessoa colectiva. Campos empresariais + trigger para beneficiarios.

**Campos:**
- `company_object` (Input)
- `company_branches` (Input)
- `legal_nature` (Select: Sociedade Unipessoal, Sociedade por Quotas, Sociedade Anonima, Associacao, Fundacao, Outro)
- `country_of_incorporation` (Input, default 'Portugal')
- `cae_code` (Input)
- `rcbe_code` (Input)

**Logica condicional:** Se `rcbe_code` estiver vazio, mostrar secção de beneficiarios efectivos.

**Estrutura:** Mesma pattern que owner-kyc-singular.tsx com Collapsible. ~100 linhas.

---

### Ficheiro #17 — `components/acquisitions/owner-beneficiaries-list.tsx` (CRIAR)

**Funcao:** Lista dinamica de beneficiarios efectivos (para pessoas colectivas sem codigo RCBE). Cada beneficiario tem: full_name, position, share_percentage, id_doc_type, id_doc_number, id_doc_expiry, id_doc_issued_by, nif.

**Padrao:** Reutilizar o padrao de array dinamico de step-3-owners.tsx (form.setValue directamente, nao useFieldArray). Cada beneficiario renderiza num Card com botao remover.

**Estrutura:**
```tsx
// components/acquisitions/owner-beneficiaries-list.tsx
'use client'

interface OwnerBeneficiariesListProps {
  form: UseFormReturn<any>
  ownerIndex: number // indice do owner no array form.owners
}

// O path dos beneficiarios no form: `owners.${ownerIndex}.beneficiaries`
// Cada beneficiario: { full_name, position, share_percentage, id_doc_type, id_doc_number, id_doc_expiry, id_doc_issued_by, nif }
```

**~120 linhas.**

---

### Ficheiro #1 (MODIFICAR) — `components/acquisitions/step-3-owners.tsx`

**Estado actual:** 248 linhas. Mostra campos basicos por proprietario (person_type, name, email, phone, nif, ownership_percentage, is_main_contact).

**Modificacao:** Integrar os sub-formularios KYC condicionais. Apos os campos basicos de cada proprietario, adicionar:

```tsx
// Dentro do Card de cada owner, apos os campos basicos existentes:

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

**Imports a adicionar:**
```typescript
import { OwnerKycSingular } from './owner-kyc-singular'
import { OwnerKycColetiva } from './owner-kyc-coletiva'
import { OwnerBeneficiariesList } from './owner-beneficiaries-list'
```

---

### Ficheiro #3 (MODIFICAR) — `lib/validations/acquisition.ts`

**Estado actual:** 110 linhas. Schema do owner tem campos basicos.

**Modificacao:** Adicionar campos KYC ao objecto owner dentro do `acquisitionSchema`:

```typescript
// Adicionar ao z.object dentro do array owners:

// KYC Singular
birth_date: z.string().optional(),
id_doc_type: z.string().optional(),
id_doc_number: z.string().optional(),
id_doc_expiry: z.string().optional(),
id_doc_issued_by: z.string().optional(),
is_pep: z.boolean().default(false),
pep_position: z.string().optional(),
funds_origin: z.array(z.string()).default([]),
profession: z.string().optional(),
last_profession: z.string().optional(),
is_portugal_resident: z.boolean().default(true),
residence_country: z.string().optional(),
postal_code: z.string().optional(),
city: z.string().optional(),
marital_regime: z.string().optional(),
legal_rep_id_doc: z.string().optional(),

// KYC Colectiva
company_object: z.string().optional(),
company_branches: z.string().optional(),
legal_nature: z.string().optional(),
country_of_incorporation: z.string().default('Portugal'),
cae_code: z.string().optional(),
rcbe_code: z.string().optional(),

// Beneficiarios (apenas para colectiva sem rcbe_code)
beneficiaries: z.array(z.object({
  full_name: z.string().min(2, 'Nome obrigatorio'),
  position: z.string().optional(),
  share_percentage: z.string().optional(),
  id_doc_type: z.string().optional(),
  id_doc_number: z.string().optional(),
  id_doc_expiry: z.string().optional(),
  id_doc_issued_by: z.string().optional(),
  nif: z.string().optional(),
})).optional().default([]),
```

**Adicionar ao `documents` array no schema (ja existe como opcional):**

O schema actual ja inclui `documents` opcional. Verificar que aceita `owner_id`:
```typescript
documents: z.array(z.object({
  doc_type_id: z.string(),
  file_url: z.string().optional(),
  file_name: z.string().optional(),
  valid_until: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  owner_id: z.string().optional(), // ← ADICIONAR se nao existir
})).optional().default([]),
```

---

### Ficheiro #4 (MODIFICAR) — `app/api/acquisitions/route.ts`

**Estado actual:** 232 linhas. Insere owners com campos basicos.

**Modificacao 1:** Expandir o insert de owners para incluir campos KYC:

```typescript
// No insert de owners (aproximadamente linha 120), adicionar todos os campos KYC:
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
    // KYC Singular
    birth_date: ownerData.birth_date || null,
    id_doc_type: ownerData.id_doc_type || null,
    id_doc_number: ownerData.id_doc_number || null,
    id_doc_expiry: ownerData.id_doc_expiry || null,
    id_doc_issued_by: ownerData.id_doc_issued_by || null,
    is_pep: ownerData.is_pep ?? false,
    pep_position: ownerData.pep_position || null,
    funds_origin: ownerData.funds_origin || null,
    profession: ownerData.profession || null,
    last_profession: ownerData.last_profession || null,
    is_portugal_resident: ownerData.is_portugal_resident ?? true,
    residence_country: ownerData.residence_country || null,
    postal_code: ownerData.postal_code || null,
    city: ownerData.city || null,
    marital_regime: ownerData.marital_regime || null,
    legal_rep_id_doc: ownerData.legal_rep_id_doc || null,
    // KYC Colectiva
    company_object: ownerData.company_object || null,
    company_branches: ownerData.company_branches || null,
    legal_nature: ownerData.legal_nature || null,
    country_of_incorporation: ownerData.country_of_incorporation || 'Portugal',
    cae_code: ownerData.cae_code || null,
    rcbe_code: ownerData.rcbe_code || null,
  })
  .select('id')
  .single()
```

**Modificacao 2:** Apos inserir owner colectiva, inserir beneficiarios:

```typescript
// Apos o insert do owner com sucesso, se for colectiva com beneficiarios:
if (ownerData.person_type === 'coletiva' && ownerData.beneficiaries?.length > 0) {
  const beneficiariesToInsert = ownerData.beneficiaries.map((b: any) => ({
    owner_id: newOwner.id,
    full_name: b.full_name,
    position: b.position || null,
    share_percentage: b.share_percentage || null,
    id_doc_type: b.id_doc_type || null,
    id_doc_number: b.id_doc_number || null,
    id_doc_expiry: b.id_doc_expiry || null,
    id_doc_issued_by: b.id_doc_issued_by || null,
    nif: b.nif || null,
  }))

  await supabase.from('owner_beneficiaries').insert(beneficiariesToInsert)
}
```

**Modificacao 3:** Nos documentos, suportar `owner_id`:

```typescript
// Na seccao de documentos (linha ~180), adicionar owner_id:
const docInserts = data.documents
  .filter((doc) => doc.file_url && doc.file_name)
  .map((doc) => ({
    property_id: property.id,
    owner_id: doc.owner_id || null, // ← ADICIONAR
    doc_type_id: doc.doc_type_id,
    file_url: doc.file_url!,
    file_name: doc.file_name!,
    uploaded_by: user.id,
    valid_until: doc.valid_until || null,
    status: 'active',
    metadata: (doc.metadata || {}) as any,
  }))
```

---

## 9. Fase F — Step 5 Documentos Funcional

### Ficheiro #2 (MODIFICAR) — `components/acquisitions/step-5-documents.tsx`

**Estado actual:** 47 linhas. Placeholder com lista de documentos sugeridos.

**Substituir completamente** por componente funcional que:
1. Carrega doc_types ao montar (agrupados por categoria)
2. Para cada proprietario do Step 3, mostra seccao com docs relevantes
3. Para cada doc_type, verifica se owner ja tem doc existente (via `GET /api/owners/{id}/documents`)
4. Se existe (valido) → badge verde + link + botao "Substituir"
5. Se existe (expirado) → badge laranja + area de upload visivel
6. Se nao existe → `<DocumentUploader>` visivel
7. Ao fazer upload: `POST /api/documents/upload` → guarda resultado em estado local → inclui no payload final

**Estrutura do componente expandido:**

```tsx
// components/acquisitions/step-5-documents.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentUploader } from '@/components/documents/document-uploader'
import { DocumentCard } from '@/components/documents/document-card'
import { FileText, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { DocType, Document, UploadResult } from '@/types/document'

// Tipos de documento relevantes para angariacao (por categoria)
const ACQUISITION_DOC_CATEGORIES = ['imovel', 'identificacao', 'fiscal', 'legal', 'certificacao']

interface StepDocumentsProps {
  form: UseFormReturn<any>
}

export function StepDocuments({ form }: StepDocumentsProps) {
  const owners = form.watch('owners') || []
  const [docTypes, setDocTypes] = useState<DocType[]>([])
  const [ownerExistingDocs, setOwnerExistingDocs] = useState<Record<string, Document[]>>({})
  const [isLoading, setIsLoading] = useState(true)

  // 1. Carregar doc_types
  useEffect(() => {
    fetch('/api/libraries/doc-types')
      .then((res) => res.json())
      .then((data) => {
        setDocTypes(
          data.filter((dt: DocType) =>
            ACQUISITION_DOC_CATEGORIES.includes(dt.category)
          )
        )
      })
      .finally(() => setIsLoading(false))
  }, [])

  // 2. Para owners com ID (existentes), buscar docs
  useEffect(() => {
    const fetchOwnerDocs = async () => {
      const docsMap: Record<string, Document[]> = {}
      for (const owner of owners) {
        if (owner.id) {
          try {
            const res = await fetch(`/api/owners/${owner.id}/documents`)
            if (res.ok) {
              docsMap[owner.id] = await res.json()
            }
          } catch { /* ignorar */ }
        }
      }
      setOwnerExistingDocs(docsMap)
    }
    fetchOwnerDocs()
  }, [owners])

  // 3. Handler de upload concluido
  const handleUploaded = useCallback(
    (result: UploadResult, docTypeId: string, ownerId?: string) => {
      const currentDocs = form.getValues('documents') || []
      form.setValue('documents', [
        ...currentDocs,
        {
          doc_type_id: docTypeId,
          file_url: result.url,
          file_name: result.file_name,
          owner_id: ownerId || undefined,
          metadata: {},
        },
      ])
    },
    [form]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  // Agrupar doc_types por categoria
  const byCategory = docTypes.reduce<Record<string, DocType[]>>((acc, dt) => {
    const cat = dt.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(dt)
    return acc
  }, {})

  const uploadedDocs = form.watch('documents') || []

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Documentos</h3>
        <p className="text-sm text-muted-foreground mt-1">
          O upload de documentos e opcional nesta fase. Documentos carregados aqui
          serao automaticamente associados ao processo.
        </p>
      </div>

      {/* Documentos do Imovel */}
      {Object.entries(byCategory).map(([category, types]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {types.map((dt) => {
              const isUploaded = uploadedDocs.some(
                (d: any) => d.doc_type_id === dt.id && d.file_url
              )

              return (
                <div key={dt.id} className="flex items-center justify-between gap-4 p-3 rounded border">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm">{dt.name}</span>
                    {isUploaded && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-0">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Carregado
                      </Badge>
                    )}
                  </div>
                  {!isUploaded && (
                    <div className="w-full max-w-xs">
                      <DocumentUploader
                        docTypeId={dt.id}
                        allowedExtensions={dt.allowed_extensions}
                        onUploaded={(result) => handleUploaded(result, dt.id)}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**Nota:** Este e o esqueleto. O componente final tera ~150-180 linhas com as seccoes por proprietario e logica de docs existentes/expirados.

---

## 10. Fase G — Upload em Tarefas de Processo

### Ficheiro #18 — `components/processes/task-upload-action.tsx` (CRIAR)

**Funcao:** Componente que aparece em tarefas UPLOAD pendentes/em progresso no detalhe de processo. Permite upload manual ou reutilizacao de documento existente.

```tsx
// components/processes/task-upload-action.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DocumentUploader } from '@/components/documents/document-uploader'
import { CheckCircle2, FileText, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { Document, UploadResult } from '@/types/document'

interface TaskUploadActionProps {
  taskId: string
  processId: string
  propertyId: string
  docTypeId: string
  docTypeName: string
  allowedExtensions: string[]
  existingDocs?: Document[] // docs ja existentes do imovel/owners com mesmo doc_type
  onCompleted: () => void
}

export function TaskUploadAction({
  taskId,
  processId,
  propertyId,
  docTypeId,
  docTypeName,
  allowedExtensions,
  existingDocs = [],
  onCompleted,
}: TaskUploadActionProps) {
  const [isCompleting, setIsCompleting] = useState(false)

  // Filtrar docs validos com o mesmo doc_type_id
  const validExisting = existingDocs.filter(
    (d) =>
      d.doc_type_id === docTypeId &&
      d.status === 'active' &&
      (!d.valid_until || new Date(d.valid_until) > new Date())
  )

  const completeTask = async (docRegistryId: string) => {
    setIsCompleting(true)
    try {
      const res = await fetch(
        `/api/processes/${processId}/tasks/${taskId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            task_result: { doc_registry_id: docRegistryId },
          }),
        }
      )

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao completar tarefa')
      }

      toast.success('Documento associado e tarefa concluida')
      onCompleted()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsCompleting(false)
    }
  }

  const handleUploaded = async (result: UploadResult) => {
    // Apos upload, completar a tarefa com o doc_registry_id
    await completeTask(result.id)
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Upload className="h-4 w-4 text-blue-600" />
          <span className="font-medium">{docTypeName}</span>
        </div>

        {/* Documentos existentes reutilizaveis */}
        {validExisting.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Documentos existentes com este tipo:
            </p>
            {validExisting.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2 rounded border bg-emerald-50/50"
              >
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <span className="truncate">{doc.file_name}</span>
                  <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">
                    Valido
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => completeTask(doc.id)}
                  disabled={isCompleting}
                >
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Usar este
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Area de upload */}
        <DocumentUploader
          docTypeId={docTypeId}
          allowedExtensions={allowedExtensions}
          propertyId={propertyId}
          onUploaded={handleUploaded}
        />
      </CardContent>
    </Card>
  )
}
```

---

### Ficheiro #6 (MODIFICAR) — `components/processes/process-tasks-section.tsx`

**Estado actual:** 333 linhas. Tarefas UPLOAD pendentes NAO tem UI de upload — apenas accoes no dropdown (Iniciar, Concluir, Dispensar).

**Modificacao:** Para tarefas UPLOAD com status `pending` ou `in_progress`, renderizar `<TaskUploadAction>` abaixo do card da tarefa.

**Adicionar import:**
```typescript
import { TaskUploadAction } from './task-upload-action'
```

**Adicionar renderizacao condicional** (apos o bloco de cada tarefa, dentro do loop de tasks):

```tsx
{/* Upload action para tarefas UPLOAD pendentes */}
{task.action_type === 'UPLOAD' &&
 ['pending', 'in_progress'].includes(task.status) &&
 task.config?.doc_type_id && (
  <TaskUploadAction
    taskId={task.id}
    processId={processId}
    propertyId={propertyId}
    docTypeId={task.config.doc_type_id}
    docTypeName={task.title}
    allowedExtensions={['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']}
    existingDocs={processDocuments}
    onCompleted={onTaskUpdate}
  />
)}
```

**Nota:** A prop `processDocuments` deve ser passada pelo componente pai (`app/dashboard/processos/[id]/page.tsx`). Corresponde aos documentos do processo (ja carregados pela API GET /api/processes/[id]).

Tambem precisamos que `propertyId` seja passado como prop:

```typescript
// Expandir props:
interface ProcessTasksSectionProps {
  processId: string
  propertyId: string // ← ADICIONAR
  stages: ProcessStageWithTasks[]
  processDocuments?: Document[] // ← ADICIONAR
  onTaskUpdate: () => void
}
```

---

## 11. Fase H — Rotas de Leitura e Listagem

Os ficheiros #7 (GET /api/documents), #8 (GET /api/properties/[id]/documents), e #9 (GET /api/owners/[id]/documents) ja foram detalhados na Fase C acima.

---

## 12. Fase I — Constantes e Types

### Ficheiro #7 (MODIFICAR) — `lib/constants.ts`

**Modificacao:** Adicionar labels de documentos PT-PT e mapa de extensoes.

```typescript
// Adicionar a lib/constants.ts

export const DOC_LABELS = {
  upload: 'Carregar documento',
  archive: 'Arquivar',
  replace: 'Substituir documento',
  use_existing: 'Usar este documento',
  select_file: 'Seleccionar ficheiro',
  drag_drop: 'Arraste ficheiros ou clique para seleccionar',
  valid_until: 'Valido ate',
  issued_by: 'Emitido por',
  doc_type: 'Tipo de documento',
  already_exists_valid: 'Ja existe (valido)',
  already_exists_expired: 'Ja existe (expirado)',
  no_documents: 'Nenhum documento encontrado',
  max_size: 'Tamanho maximo: 20MB',
  format_error: 'Formato nao permitido',
  upload_success: 'Documento carregado com sucesso',
  upload_error: 'Erro ao carregar documento',
  archive_confirm: 'Tem a certeza de que pretende arquivar este documento?',
} as const

export const DOC_CATEGORIES: Record<string, string> = {
  certificacao: 'Certificacao',
  fiscal: 'Fiscal',
  identificacao: 'Identificacao',
  imovel: 'Imovel',
  legal: 'Legal',
  proprietario: 'Proprietario',
}

export const KYC_LABELS = {
  birth_date: 'Data de Nascimento',
  id_doc_type: 'Tipo de Documento',
  id_doc_number: 'Numero do Documento',
  id_doc_expiry: 'Data de Validade',
  id_doc_issued_by: 'Emitido por',
  is_pep: 'Pessoa Politicamente Exposta (PEP)',
  pep_position: 'Cargo PEP',
  funds_origin: 'Origem dos Fundos',
  profession: 'Profissao',
  last_profession: 'Ultima Profissao',
  is_portugal_resident: 'Residente em Portugal',
  residence_country: 'Pais de Residencia',
  marital_regime: 'Regime Matrimonial',
  company_object: 'Objecto Social',
  company_branches: 'Estabelecimentos',
  legal_nature: 'Natureza Juridica',
  country_of_incorporation: 'Pais de Constituicao',
  cae_code: 'Codigo CAE',
  rcbe_code: 'Codigo RCBE',
} as const
```

---

## 13. Ordem de Execucao Recomendada

```
Fase 1 — Infraestrutura BD + R2
  1.1  Instalar @diceui/file-upload: npx shadcn@latest add @diceui/file-upload
  1.2  Aplicar migracao: create_consultant_documents
  1.3  Aplicar migracao: add_doc_registry_optional_columns
  1.4  Criar lib/r2/client.ts
  1.5  Criar lib/r2/documents.ts

Fase 2 — Validacoes e Types
  2.1  Criar lib/validations/document.ts
  2.2  Criar types/document.ts
  2.3  Modificar lib/constants.ts (DOC_LABELS, DOC_CATEGORIES, KYC_LABELS)

Fase 3 — Rota Central de Upload
  3.1  Criar app/api/documents/upload/route.ts
  3.2  Criar app/api/documents/[id]/route.ts
  3.3  Criar app/api/documents/route.ts
  3.4  Modificar app/api/libraries/doc-types/route.ts (POST + filtro category)

Fase 4 — Componentes de Upload e Listagem
  4.1  Criar components/documents/document-uploader.tsx
  4.2  Criar components/documents/document-card.tsx
  4.3  Criar components/documents/document-list.tsx
  4.4  Criar components/documents/document-preview-dialog.tsx
  4.5  Criar components/documents/document-upload-dialog.tsx

Fase 5 — KYC no Formulario de Angariacoes
  5.1  Criar components/acquisitions/owner-kyc-singular.tsx
  5.2  Criar components/acquisitions/owner-kyc-coletiva.tsx
  5.3  Criar components/acquisitions/owner-beneficiaries-list.tsx
  5.4  Modificar lib/validations/acquisition.ts (campos KYC + beneficiarios)
  5.5  Modificar components/acquisitions/step-3-owners.tsx (integrar KYC)
  5.6  Modificar app/api/acquisitions/route.ts (KYC + beneficiarios + owner_id docs)

Fase 6 — Step 5 Documentos Funcional
  6.1  Modificar components/acquisitions/step-5-documents.tsx (substituir placeholder)

Fase 7 — Upload em Tarefas de Processo
  7.1  Criar components/processes/task-upload-action.tsx
  7.2  Modificar components/processes/process-tasks-section.tsx (integrar upload)

Fase 8 — Rotas de Leitura
  8.1  Criar app/api/properties/[id]/documents/route.ts
  8.2  Criar app/api/owners/[id]/documents/route.ts

Fase 9 — Verificacao
  9.1  npm run build — sem erros de TypeScript
  9.2  Testar upload de documento (formData → R2 → doc_registry)
  9.3  Testar Step 5 com upload real
  9.4  Testar KYC singular e colectiva no Step 3
  9.5  Testar upload manual em tarefa de processo
  9.6  Testar auto-complete apos aprovacao
  9.7  Verificar que todas as labels estao em PT-PT
```

---

## 14. Criterios de Sucesso

### Verificacao Automatizada

- [ ] `npm run build` — sem erros de TypeScript
- [ ] Migracoes aplicadas sem erro via Supabase MCP
- [ ] `POST /api/documents/upload` aceita FormData e retorna `{ id, url, file_name }`
- [ ] `GET /api/documents?property_id=X` retorna lista de documentos
- [ ] `GET /api/properties/[id]/documents` retorna docs do imovel + docs reutilizaveis dos owners
- [ ] `GET /api/owners/[id]/documents` retorna docs do proprietario
- [ ] `PUT /api/documents/[id]` altera status
- [ ] `DELETE /api/documents/[id]` arquiva (status → archived)
- [ ] `POST /api/libraries/doc-types` cria tipo de documento
- [ ] `GET /api/libraries/doc-types?category=fiscal` filtra por categoria

### Verificacao Manual

- [ ] Step 5: lista doc_types agrupados por categoria, com area de upload funcional
- [ ] Step 5: apos upload, badge "Carregado" aparece junto ao tipo
- [ ] Step 5: documentos carregados sao incluidos no payload do POST /api/acquisitions
- [ ] Step 3: campos KYC pessoa singular aparecem em Collapsible expandivel
- [ ] Step 3: campos KYC pessoa colectiva aparecem quando person_type = 'coletiva'
- [ ] Step 3: beneficiarios aparecem quando colectiva sem codigo RCBE
- [ ] Tarefa UPLOAD pendente: mostra DocumentUploader com area de drop
- [ ] Tarefa UPLOAD: botao "Usar este" aparece quando existe doc reutilizavel valido
- [ ] Tarefa UPLOAD: apos upload, tarefa e automaticamente completada
- [ ] Upload valida extensao contra doc_types.allowed_extensions
- [ ] Upload rejeita ficheiros > 20MB com mensagem clara
- [ ] Preview de PDF abre em iframe no dialog
- [ ] Preview de imagem mostra img tag no dialog
- [ ] DocumentList mostra tabela com nome, tipo, status, validade, accoes
- [ ] Toda a UI esta em PT-PT (labels, mensagens, toasts)

---

## 15. Fora de Escopo

As seguintes funcionalidades NAO serao implementadas nesta spec:

1. **Documentos de consultores UI** — depende do M09 (Consultores). A tabela `consultant_documents` e criada, mas a interface de gestao fica para M09.
2. **Gestao de tipos de documento (admin UI)** — depende do M14 (Definicoes). A API POST esta criada, mas a pagina de admin fica para M14.
3. **Pagina de modulo /dashboard/documentos** — vista global de todos os documentos do sistema. Complexidade elevada e baixa prioridade face ao upload funcional.
4. **Workflow de validacao de documentos** — transicao active → validated / rejected por um aprovador. Adicionar em iteracao futura.
5. **Notificacoes de expiracao** — alertas quando docs se aproximam de valid_until. Adicionar em iteracao futura.
6. **Presigned URLs para download** — downloads directos do R2 via URL publica. Se necessario proteger downloads, implementar presigned URLs em iteracao futura.
7. **Versionamento de documentos** — substituir doc mantendo historico. A funcionalidade "Substituir" arquiva o antigo e cria novo.
8. **OCR / extraccao automatica** — leitura automatica de dados de documentos.
9. **RLS Policies** — o projecto opera sem RLS (usa service role onde necessario).

---

## Resumo de Ficheiros — Contagem Final

| Tipo | Quantidade |
|------|-----------|
| Ficheiros a CRIAR | 18 |
| Ficheiros a MODIFICAR | 7 |
| Migracoes BD | 2 |
| Dependencias a instalar | 1 (@diceui/file-upload) |
| **Total de ficheiros afectados** | **25** |
