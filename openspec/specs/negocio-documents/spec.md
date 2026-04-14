# Negocio Documents


### Requirement: Tabela `negocio_documents`

O sistema SHALL criar a tabela `negocio_documents` em Supabase para persistir documentos associados a cada `negocio`. A tabela MUST incluir FK para `negocios`, FK opcional para `doc_types`, metadados do ficheiro (url, nome, tamanho, mime), utilizador que fez upload, data de validade opcional, notas e timestamps. MUST ter índices em `negocio_id` e `doc_type_id`. `ON DELETE CASCADE` em `negocio_id`.

#### Scenario: Migration aplicada

- **WHEN** a migration é executada em Supabase
- **THEN** existe a tabela `negocio_documents` com colunas `id, negocio_id, doc_type_id, file_url, file_name, file_size, mime_type, uploaded_by, valid_until, notes, created_at`
- **AND** existem índices `idx_negocio_documents_negocio` e `idx_negocio_documents_doc_type`
- **AND** apagar um `negocio` apaga em cascata os respectivos documentos

---

### Requirement: API REST para documentos de negócio

O sistema SHALL expor as rotas:
- `GET /api/negocios/[id]/documents` → devolve `{ folders: DocumentFolder[] }`
- `POST /api/negocios/[id]/documents` → aceita `FormData` com `file`, `doc_type_id`, `valid_until?`, `notes?`, `label?`; faz upload para R2 em `negocios/{negocioId}/{docTypeSlug}/{timestamp}-{sanitizedName}` e cria registo em `negocio_documents`
- `DELETE /api/negocios/[id]/documents/[docId]` → apaga registo + objecto R2
- `PUT /api/negocios/[id]/documents/[docId]` → actualiza `valid_until`, `notes` ou `label`

Todas as rotas MUST validar input com Zod, retornar códigos HTTP correctos e registar em `log_audit`.

#### Scenario: Listar documentos agrupados por tipo

- **WHEN** o utilizador faz `GET /api/negocios/{id}/documents`
- **THEN** o sistema devolve `{ folders: [...] }` agrupado por `doc_type_id` (+ uma folder "Outros" para registos com `doc_type_id = null`)
- **AND** cada folder inclui `files[]` com `url` público R2, `mimeType`, `size`, `uploadedBy` populado a partir de `dev_users`

#### Scenario: Upload de documento

- **WHEN** é enviado POST multipart com `file` (pdf, 2MB), `doc_type_id`, `valid_until`
- **THEN** o sistema valida extensão contra `doc_types.allowed_extensions`, faz `PutObjectCommand` ao R2, cria registo em `negocio_documents` e devolve `201` com o shape `DocumentFile`
- **AND** o `uploaded_by` é o ID do utilizador autenticado

#### Scenario: Rejeitar extensão não permitida

- **WHEN** é enviado `.exe` e o `doc_type.allowed_extensions` é `['pdf','jpg','png']`
- **THEN** a API responde `400` com `{ error: "Extensão não permitida" }`
- **AND** nenhum objecto é criado no R2

#### Scenario: DELETE remove R2 e DB

- **WHEN** `DELETE /api/negocios/{id}/documents/{docId}`
- **THEN** o sistema faz `DeleteObjectCommand` ao R2 para a key extraída do `file_url`
- **AND** apaga o registo em `negocio_documents`
- **AND** regista em `log_audit` com `entity_type='negocio_document'`

---

### Requirement: Tab "Documentos" no detalhe do negócio

O sistema SHALL adicionar uma tab "Documentos" em `app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx` que consome o hook `useNegocioDocuments` e renderiza `<DocumentsGrid>` com as categorias configuradas em `DOMAIN_CONFIGS.negocios`. As categorias default SHALL incluir: **Identificação**, **Fiscal**, **Comprovativos**, **Contratos**, **Outros**.

#### Scenario: Tab visível no detalhe

- **WHEN** o utilizador abre a página de detalhe de um negócio
- **THEN** existe uma tab "Documentos" após "Interessados"
- **AND** ao seleccionar, renderiza a grelha de pastas com skeleton enquanto carrega

#### Scenario: Upload rápido via tab

- **WHEN** o utilizador clica "Enviar" numa pasta da categoria "Contratos"
- **THEN** o `DocumentUploadDialog` abre pré-filtrado com os `doc_types` de categoria Contratos aplicáveis a `negocios`
- **AND** após upload, a grelha refaz fetch e mostra o ficheiro novo
