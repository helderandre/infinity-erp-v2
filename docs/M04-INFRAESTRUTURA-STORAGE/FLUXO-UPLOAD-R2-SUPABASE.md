# Fluxo de Upload R2 + Armazenamento Supabase

> Documentação do fluxo completo de upload de ficheiros para Cloudflare R2 e registo dos URLs no Supabase, nos contextos de **Angariações** e **Processos**.

---

## Visão Geral

```
┌─────────────┐     FormData      ┌──────────────────────┐     PutObject     ┌──────────────┐
│  Frontend    │ ───────────────►  │ POST /api/documents/ │ ─────────────────► │ Cloudflare   │
│  (Component) │                   │      upload          │                    │    R2        │
└─────────────┘                   └──────────────────────┘                    └──────┬───────┘
                                          │                                         │
                                          │  INSERT doc_registry                    │ Retorna URL
                                          │  { file_url, metadata.r2_key }          │ público
                                          ▼                                         │
                                  ┌──────────────────┐                              │
                                  │    Supabase       │ ◄──────────────────────────-─┘
                                  │   doc_registry    │   url = R2_PUBLIC_DOMAIN/key
                                  └──────────────────┘
```

---

## API Central: `POST /api/documents/upload`

**Ficheiro:** `src/app/api/documents/upload/route.ts`

Esta é a **única API** de upload para ambos os fluxos. Recebe um `FormData` e:

### Entrada (FormData)

| Campo           | Tipo   | Obrigatório | Descrição                          |
|-----------------|--------|-------------|------------------------------------|
| `file`          | File   | Sim         | Ficheiro a carregar                |
| `doc_type_id`   | string | Sim         | UUID do tipo de documento          |
| `property_id`   | string | Condicional | UUID do imóvel (contexto imóvel)   |
| `owner_id`      | string | Condicional | UUID do proprietário               |
| `consultant_id` | string | Condicional | UUID do consultor                  |
| `valid_until`   | string | Não         | Data de validade (ISO)             |
| `notes`         | string | Não         | Notas sobre o documento            |

### Passo a Passo Interno

```
1. Extrair campos do FormData
2. Validar ficheiro (existe, ≤20MB)
3. Validar extensão contra doc_types.allowed_extensions (Supabase)
4. Determinar contexto (property | owner | consultant)
5. Converter ficheiro para Buffer
6. Upload para R2 via uploadDocumentToR2()
7. Registar em doc_registry (Supabase)
8. Retornar { id, url, file_name }
```

### Resposta (201)

```json
{
  "id": "uuid-do-doc-registry",
  "url": "https://pub-xxx.r2.dev/imoveis/uuid-property/1708123456789-contrato.pdf",
  "file_name": "contrato.pdf"
}
```

---

## Módulo R2: `lib/r2/documents.ts`

### Função `uploadDocumentToR2()`

```typescript
export async function uploadDocumentToR2(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  ctx: DocumentContext
): Promise<{ url: string; key: string }>
```

**O que faz:**

1. **Sanitiza** o nome do ficheiro (remove caracteres especiais)
2. **Gera a key R2** com o padrão: `{basePath}/{timestamp}-{sanitizedFileName}`
3. **Envia** ao R2 via `PutObjectCommand` do `@aws-sdk/client-s3`
4. **Retorna** o URL público e a key

### Estrutura de Paths no R2

```
R2_BUCKET_NAME/
├── imoveis/{propertyId}/
│   ├── 1708123456789-contrato-venda.pdf
│   ├── 1708123457890-certidao-energia.jpg
│   └── ...
├── proprietarios/{ownerId}/
│   └── ...
└── consultores/{consultantId}/
    └── ...
```

### URL Público Gerado

```
https://{R2_PUBLIC_DOMAIN}/{key}

Exemplo:
https://pub-xxx.r2.dev/imoveis/a1b2c3d4-e5f6/1708123456789-contrato.pdf
```

### Conexão R2

```typescript
const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})
```

---

## Armazenamento no Supabase: Tabela `doc_registry`

### Colunas Relevantes

| Coluna        | Tipo        | Conteúdo                                              |
|---------------|-------------|-------------------------------------------------------|
| `id`          | UUID (PK)   | Identificador único do documento                      |
| `property_id` | UUID (FK)   | Referência ao imóvel (`dev_properties.id`)             |
| `owner_id`    | UUID (FK)   | Referência ao proprietário (`owners.id`), nullable     |
| `doc_type_id` | UUID (FK)   | Tipo de documento (`doc_types.id`)                     |
| **`file_url`**| **TEXT**     | **URL público do R2** (onde o link é armazenado)      |
| `file_name`   | TEXT        | Nome original do ficheiro                              |
| `uploaded_by` | UUID (FK)   | Quem fez upload (`dev_users.id`)                       |
| `valid_until` | TIMESTAMPTZ | Data de validade (opcional)                            |
| `status`      | TEXT        | `'active'` / `'archived'` / `'rejected'`               |
| **`metadata`**| **JSONB**   | `{ size, mimetype, r2_key }` — **r2_key** para delete |
| `notes`       | TEXT        | Notas (opcional)                                       |
| `created_at`  | TIMESTAMPTZ | Data de criação                                        |

### Exemplo de Registo

```json
{
  "id": "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a",
  "property_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "owner_id": null,
  "doc_type_id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "file_url": "https://pub-xxx.r2.dev/imoveis/a1b2c3d4-e5f6/1708123456789-contrato.pdf",
  "file_name": "contrato.pdf",
  "uploaded_by": "user-uuid-here",
  "status": "active",
  "metadata": {
    "size": 245760,
    "mimetype": "application/pdf",
    "r2_key": "imoveis/a1b2c3d4-e5f6/1708123456789-contrato.pdf"
  }
}
```

> **Nota:** O campo `metadata.r2_key` guarda o path completo no R2 (sem domínio), usado para operações de eliminação via `DeleteObjectCommand`.

---

## FLUXO 1: Angariações (Formulário Multi-Step)

### Componentes Envolvidos

| Componente | Ficheiro |
|------------|----------|
| Formulário principal | `components/acquisitions/acquisition-form.tsx` |
| Secção de documentos | `components/documents/documents-section.tsx` |
| Uploader | `components/documents/document-uploader.tsx` |
| API upload | `app/api/documents/upload/route.ts` |
| API angariação | `app/api/acquisitions/route.ts` |

### Passo a Passo Completo

```
STEP 1 — Utilizador preenche formulário (5 passos)
═══════════════════════════════════════════════════
   Passo 1: Dados do Imóvel (tipo, preço, tipologia)
   Passo 2: Localização (morada, mapa)
   Passo 3: Proprietários (dados pessoais, NIF)
   Passo 4: Contrato (comissão, regime)
   Passo 5: Documentos ← AQUI os ficheiros são seleccionados

   Neste passo, os ficheiros ficam armazenados em memória
   como objectos File do JavaScript (NÃO são enviados ainda).

   Estado no formulário:
   {
     documents: [
       { doc_type_id: "uuid", file: File, file_name: "contrato.pdf", ... },
       { doc_type_id: "uuid", file: File, file_name: "caderneta.pdf", ... },
     ]
   }


STEP 2 — Utilizador clica "Criar Angariação"
═══════════════════════════════════════════════
   O formulário separa os documentos em duas categorias:

   A) pendingFiles → ficheiros File (ainda não enviados ao R2)
   B) jsonDocuments → docs que já têm file_url (já uploaded)

   const pendingFiles = []   // File objects para upload posterior
   const jsonDocuments = []  // Docs com URL (raros neste fluxo)


STEP 3 — POST /api/acquisitions (SEM ficheiros)
════════════════════════════════════════════════
   O body JSON é enviado SEM os ficheiros binários.
   A API cria sequencialmente:

   3a. dev_properties        → Imóvel (status: 'pending_approval')
   3b. dev_property_specs    → Especificações
   3c. dev_property_internal → Dados internos (comissão, contrato)
   3d. owners                → Proprietários (verifica NIF/email)
   3e. property_owners       → Ligação imóvel↔proprietário
   3f. doc_registry          → Apenas docs que JÁ tinham URL (caso raro)
   3g. proc_instances        → Processo (tpl_process_id = null)

   Retorna: { property_id, proc_instance_id, owner_ids }


STEP 4 — Upload dos ficheiros pendentes (LOOP)
═══════════════════════════════════════════════
   Agora que temos o property_id real, enviamos cada ficheiro:

   Para CADA ficheiro pendente:
   ┌─────────────────────────────────────────────────────┐
   │  const formData = new FormData()                    │
   │  formData.append('file', pending.file)              │
   │  formData.append('doc_type_id', pending.doc_type_id)│
   │  formData.append('property_id', result.property_id) │
   │                                                     │
   │  POST /api/documents/upload  (FormData)             │
   │                                                     │
   │  Dentro da API:                                     │
   │    1. Valida ficheiro + extensão                    │
   │    2. uploadDocumentToR2() → envia ao R2            │
   │    3. INSERT doc_registry (file_url = URL do R2)    │
   │    4. Retorna { id, url, file_name }                │
   └─────────────────────────────────────────────────────┘


STEP 5 — Redirect para processo
═══════════════════════════════
   router.push(`/dashboard/processos/${result.proc_instance_id}`)
```

### Diagrama de Sequência

```
  Utilizador          Frontend           /api/acquisitions    /api/documents/upload    R2        Supabase
      │                  │                       │                     │               │            │
      │  Preenche form   │                       │                     │               │            │
      │─────────────────►│                       │                     │               │            │
      │                  │                       │                     │               │            │
      │  Clica "Criar"   │  POST (JSON, sem      │                     │               │            │
      │─────────────────►│  ficheiros binários)  │                     │               │            │
      │                  │──────────────────────►│                     │               │            │
      │                  │                       │  INSERT property    │               │            │
      │                  │                       │─────────────────────┼───────────────┼───────────►│
      │                  │                       │  INSERT owners      │               │            │
      │                  │                       │─────────────────────┼───────────────┼───────────►│
      │                  │                       │  INSERT proc_inst   │               │            │
      │                  │                       │─────────────────────┼───────────────┼───────────►│
      │                  │  { property_id, ... } │                     │               │            │
      │                  │◄──────────────────────│                     │               │            │
      │                  │                       │                     │               │            │
      │                  │  POST FormData (loop por ficheiro)          │               │            │
      │                  │────────────────────────────────────────────►│               │            │
      │                  │                       │                     │  PutObject    │            │
      │                  │                       │                     │──────────────►│            │
      │                  │                       │                     │  URL público  │            │
      │                  │                       │                     │◄──────────────│            │
      │                  │                       │                     │  INSERT       │            │
      │                  │                       │                     │  doc_registry  │            │
      │                  │                       │                     │───────────────┼───────────►│
      │                  │  { id, url }          │                     │               │            │
      │                  │◄────────────────────────────────────────────│               │            │
      │                  │                       │                     │               │            │
      │  Redirect /processos/{id}                │                     │               │            │
      │◄─────────────────│                       │                     │               │            │
```

---

## FLUXO 2: Processos — Tarefas UPLOAD

### Componentes Envolvidos

| Componente | Ficheiro |
|------------|----------|
| Página do processo | `app/dashboard/processos/[id]/page.tsx` |
| Secção de tarefas | `components/processes/process-tasks-section.tsx` |
| Acção de upload | `components/processes/task-upload-action.tsx` |
| Uploader | `components/documents/document-uploader.tsx` |
| API upload | `app/api/documents/upload/route.ts` |
| API tarefa | `app/api/processes/[id]/tasks/[taskId]/route.ts` |

### Passo a Passo Completo

```
STEP 1 — Utilizador abre processo activo
═════════════════════════════════════════
   GET /api/processes/{id}

   A API retorna:
   - Dados do processo (status, percent_complete, fases)
   - Tarefas agrupadas por fase
   - Documentos existentes do imóvel (doc_registry)

   Cada tarefa UPLOAD tem config:
   {
     "action_type": "UPLOAD",
     "config": {
       "doc_type_id": "uuid-tipo-doc",
       "allowed_extensions": ["pdf", "jpg", "png"]
     }
   }


STEP 2 — Componente TaskUploadAction renderiza
══════════════════════════════════════════════
   Verifica se já existem documentos do mesmo tipo (doc_type_id)
   na lista de documentos do imóvel:

   A) Se SIM → Mostra botão "Utilizar este" para reutilizar
   B) Se NÃO → Mostra componente DocumentUploader para novo upload
   C) Ambos → Mostra as duas opções


STEP 2A — Reutilizar documento existente (SEM upload)
═══════════════════════════════════════════════════════
   O utilizador clica "Utilizar este" num documento já existente.

   PUT /api/processes/{id}/tasks/{taskId}
   {
     "action": "complete",
     "task_result": { "doc_registry_id": "uuid-do-doc-existente" }
   }

   Na API:
   1. Actualiza proc_tasks.status = 'completed'
   2. Actualiza proc_tasks.completed_at = now()
   3. Actualiza proc_tasks.task_result = { doc_registry_id }
   4. Recalcula percent_complete do processo
   5. Avança current_stage_id se fase completa

   ⚠️ Neste caso NÃO há upload ao R2 — apenas liga o doc existente à tarefa.


STEP 2B — Upload de novo documento
═══════════════════════════════════
   O utilizador selecciona/arrasta um ficheiro no DocumentUploader.

   ┌─────────────────────────────────────────────────────┐
   │  POST /api/documents/upload (FormData)              │
   │                                                     │
   │  FormData:                                          │
   │    file: <File>                                     │
   │    doc_type_id: "uuid" (do config da tarefa)        │
   │    property_id: "uuid" (do processo)                │
   │                                                     │
   │  Resultado:                                         │
   │    1. Ficheiro → R2 (PutObjectCommand)              │
   │    2. Registo → doc_registry (file_url = URL R2)    │
   │    3. Retorna { id, url, file_name }                │
   └─────────────────────────────────────────────────────┘

   Após upload bem-sucedido, o callback handleUploaded é chamado:

   ┌─────────────────────────────────────────────────────┐
   │  PUT /api/processes/{id}/tasks/{taskId}             │
   │  {                                                  │
   │    "action": "complete",                            │
   │    "task_result": {                                 │
   │      "doc_registry_id": result.id  ← do upload     │
   │    }                                                │
   │  }                                                  │
   │                                                     │
   │  Resultado:                                         │
   │    1. proc_tasks.status = 'completed'               │
   │    2. proc_tasks.task_result = { doc_registry_id }  │
   │    3. Recalcula progresso do processo                │
   └─────────────────────────────────────────────────────┘
```

### Diagrama de Sequência (Upload Novo)

```
  Utilizador       TaskUploadAction    DocumentUploader   /api/documents/upload   /api/processes/.../tasks   R2       Supabase
      │                  │                   │                     │                       │                  │           │
      │  Arrasta ficheiro│                   │                     │                       │                  │           │
      │─────────────────►│                   │                     │                       │                  │           │
      │                  │                   │  POST FormData      │                       │                  │           │
      │                  │                   │───────────────────►│                       │                  │           │
      │                  │                   │                     │  PutObjectCommand     │                  │           │
      │                  │                   │                     │────────────────────────┼─────────────────►│           │
      │                  │                   │                     │  URL público           │                  │           │
      │                  │                   │                     │◄────────────────────────┼─────────────────│           │
      │                  │                   │                     │  INSERT doc_registry   │                  │           │
      │                  │                   │                     │────────────────────────┼──────────────────┼──────────►│
      │                  │                   │  { id, url }        │                       │                  │           │
      │                  │                   │◄───────────────────│                       │                  │           │
      │                  │  handleUploaded({ id })                 │                       │                  │           │
      │                  │◄──────────────────│                     │                       │                  │           │
      │                  │                   │                     │                       │                  │           │
      │                  │  PUT task (complete + doc_registry_id)  │                       │                  │           │
      │                  │─────────────────────────────────────────────────────────────────►│                  │           │
      │                  │                   │                     │                       │  UPDATE          │           │
      │                  │                   │                     │                       │  proc_tasks      │           │
      │                  │                   │                     │                       │─────────────────┼──────────►│
      │                  │                   │                     │                       │  recalculate     │           │
      │                  │                   │                     │                       │  progress        │           │
      │                  │                   │                     │                       │─────────────────┼──────────►│
      │  Tarefa concluída│                   │                     │                       │                  │           │
      │◄─────────────────│                   │                     │                       │                  │           │
```

### Diagrama de Sequência (Reutilizar Existente)

```
  Utilizador       TaskUploadAction    /api/processes/.../tasks    Supabase
      │                  │                       │                     │
      │  Clica "Utilizar"│                       │                     │
      │─────────────────►│                       │                     │
      │                  │  PUT task             │                     │
      │                  │  { action: "complete",│                     │
      │                  │    task_result: {      │                     │
      │                  │      doc_registry_id } │                     │
      │                  │  }                    │                     │
      │                  │──────────────────────►│                     │
      │                  │                       │  UPDATE proc_tasks  │
      │                  │                       │────────────────────►│
      │                  │                       │  recalculate        │
      │                  │                       │────────────────────►│
      │                  │  { success: true }    │                     │
      │                  │◄──────────────────────│                     │
      │  Tarefa concluída│                       │                     │
      │◄─────────────────│                       │                     │

      ⚠️ SEM upload ao R2 — apenas liga doc existente à tarefa
```

---

## Onde o URL do R2 Fica Armazenado

### Tabela Principal: `doc_registry`

```sql
SELECT id, file_url, file_name, metadata
FROM doc_registry
WHERE property_id = 'uuid-imovel';
```

| Coluna     | Exemplo                                                                  |
|------------|--------------------------------------------------------------------------|
| `file_url` | `https://pub-xxx.r2.dev/imoveis/a1b2c3d4/1708123456789-contrato.pdf`   |
| `metadata` | `{"size": 245760, "mimetype": "application/pdf", "r2_key": "imoveis/a1b2c3d4/1708123456789-contrato.pdf"}` |

- **`file_url`** — URL público completo para acesso/download do ficheiro
- **`metadata.r2_key`** — Key do objecto no R2 (usado para `DeleteObjectCommand`)

### Tabela Secundária: `proc_tasks`

```sql
SELECT id, title, status, task_result
FROM proc_tasks
WHERE proc_instance_id = 'uuid-processo'
  AND action_type = 'UPLOAD';
```

| Coluna        | Exemplo                                                     |
|---------------|-------------------------------------------------------------|
| `task_result` | `{"doc_registry_id": "uuid-do-registo-na-doc-registry"}`   |

- **`task_result.doc_registry_id`** — Referência ao `doc_registry.id` que contém o `file_url`
- A tarefa **NÃO guarda o URL directamente** — guarda uma referência ao registo

### Relação entre Tabelas

```
proc_tasks.task_result.doc_registry_id  ──────►  doc_registry.id
                                                      │
                                                      ├── file_url  (URL público R2)
                                                      ├── file_name
                                                      └── metadata.r2_key
```

---

## Diferenças Entre os Dois Fluxos

| Aspecto                | Angariações (Fluxo 1)                        | Processos (Fluxo 2)                           |
|------------------------|----------------------------------------------|------------------------------------------------|
| **Trigger**            | Formulário multi-step "Criar Angariação"     | Tarefa UPLOAD auto-gerada num processo activo  |
| **Timing do upload**   | **Diferido** — ficheiros uploadados APÓS criar o imóvel | **Imediato** — upload inline com a tarefa |
| **Necessita property_id** | Sim — obtido após `POST /api/acquisitions` | Sim — já existe (vem do processo)              |
| **Registo em doc_registry** | Sim — `file_url` = URL do R2              | Sim — mesmo mecanismo                          |
| **Ligação à tarefa**   | Nenhuma — docs ficam apenas em `doc_registry` | Sim — `proc_tasks.task_result.doc_registry_id` |
| **Reutilização**       | Não aplicável                                 | Sim — pode usar documento já existente         |
| **API de upload**      | `POST /api/documents/upload` (mesma)          | `POST /api/documents/upload` (mesma)           |
| **API de conclusão**   | N/A                                           | `PUT /api/processes/{id}/tasks/{taskId}`       |
| **Auto-complete**      | N/A                                           | Sim — `autoCompleteTasks()` na aprovação       |

---

## Auto-Complete de Tarefas (Bónus)

Quando um processo é **aprovado** (`POST /api/processes/{id}/approve`), a função `autoCompleteTasks()` verifica se já existem documentos no `doc_registry` do imóvel que satisfazem tarefas UPLOAD:

```
Para cada tarefa UPLOAD com config.doc_type_id:
  1. Procura em doc_registry por property_id + doc_type_id + status='active'
  2. Se encontrar documento válido:
     - proc_tasks.status = 'completed'
     - proc_tasks.task_result = { doc_registry_id, auto_completed: true }
     - proc_tasks.completed_at = now()
```

Isto significa que documentos carregados no fluxo de Angariação podem **automaticamente completar** tarefas UPLOAD quando o processo é aprovado.

---

## Resumo Visual

```
                         ┌──────────────────────┐
                         │    Cloudflare R2      │
                         │                       │
                         │  imoveis/{id}/file    │
                         │  ───────────────      │
                         │  URL público gerado   │
                         └───────────┬───────────┘
                                     │
                              URL = R2_DOMAIN/key
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
     ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
     │  doc_registry    │   │  doc_registry    │   │  proc_tasks     │
     │  (Angariação)    │   │  (Processo)      │   │  (Referência)   │
     │                  │   │                  │   │                  │
     │  file_url = URL  │   │  file_url = URL  │   │  task_result =  │
     │  metadata.r2_key │   │  metadata.r2_key │   │  {doc_registry_ │
     │                  │   │                  │   │   id: "uuid"}   │
     └─────────────────┘   └─────────────────┘   └────────┬────────┘
                                                           │
                                                    FK → doc_registry.id
```
