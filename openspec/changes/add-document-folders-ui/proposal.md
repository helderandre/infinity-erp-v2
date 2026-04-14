## Why

Os módulos do ERP (Imóveis, Processos/Angariações, Leads, Negócios) têm hoje experiências de documentos inconsistentes: o módulo de Imóveis tem uma tab completa, Processos tem uma manager de pastas, Leads tem uma lista simples de anexos, e Negócios não tem superfície de documentos. Falta um padrão visual e de interacção partilhado — pastas 3D, selecção múltipla com rectângulo de arrasto, menu de contexto, visualizador inline de PDF/imagens e download em lote em ZIP — que já foi validado no projecto Rota Náutica 2 e que a Infinity quer adoptar como *look & feel* oficial do ERP.

## What Changes

- **Criar uma biblioteca partilhada `components/documents/`** com os blocos reutilizáveis: grelha de pastas com selecção múltipla, barra flutuante de acções, visualizador modal (PDF/imagem/DOCX), diálogo de upload (drag-and-drop + validade + notas), diálogo de tipo customizado e hook de download em lote (JSZip).
- **Adoptar `@viselect/react`** para selecção rectangular por arrasto, com estilos partilhados em `globals.css` (`.selection-area-rect`).
- **Instalar dependências novas**: `@viselect/react`, `file-saver`, `react-dropzone`. Instalar shadcn `context-menu`.
- **Refactor Imóveis** (`components/properties/property-documents-tab.tsx`) para consumir os blocos partilhados mantendo o backend actual (`doc_registry`, `doc_types`, R2).
- **Refactor Processos/Angariações** (`components/processes/process-documents-manager.tsx` e `components/acquisitions/step-5-documents.tsx`) para consumir os mesmos blocos — uma única UI de pastas em vez de duas implementações.
- **Upgrade Leads → Anexos**: substituir a lista plana por pastas (tipos de anexo: Identificação, Fiscal, Comprovativos, Outros), multi-select + batch download, viewer inline. Requer extender `lead_attachments` com `doc_type_id` (ou criar `lead_doc_types`) — decisão na fase de design.
- **Nova superfície em Negócios**: adicionar tab "Documentos" a [negocioId]/page.tsx usando a biblioteca partilhada. Backend novo: tabela `negocio_documents` + rotas `/api/negocios/[id]/documents`.
- **Componentes de ícone partilhados**: reutilizar o `FolderIcon` 3D existente em `components/icons/folder-icon.tsx` (estendido com `thumbnailUrl`, `badgeCount`, `state`) **e** o `DocIcon` existente em `components/icons/doc-icon.tsx` (papel dobrado + badge colorido por extensão: PDF, DOCX, XLSX, JPG…). O `DocIcon` substitui os ícones Lucide genéricos da implementação de referência — será usado no sidebar do viewer, nos previews do upload dialog e em qualquer lista de ficheiros individuais.
- **Endpoint de download assinado**: `/api/documents/batch-download` opcional — para já usa URLs públicos do R2 (igual ao padrão Rota Náutica), mas preparar ponto único caso o bucket passe a privado.

Não incluído (fora de âmbito): módulo Clientes (não existe ainda), integração com IA para OCR de anexos de Leads/Negócios, e expiry alerts automáticos via cron.

## Capabilities

### New Capabilities
- `document-folders-ui`: Biblioteca de componentes partilhada — grelha de pastas, selecção múltipla com `@viselect/react`, visualizador modal, diálogo de upload, download em lote ZIP. Consumível por qualquer domínio (imóveis, processos, leads, negócios, futuros clientes).
- `negocio-documents`: Nova superfície de documentos ligada a `negocios`, com tabela `negocio_documents`, rotas CRUD e tab "Documentos" na página de detalhe.
- `lead-attachments-folders`: Upgrade dos anexos de leads — tipos de anexo (pastas), multi-select, batch download, viewer, mantendo compatibilidade com `lead_attachments` actual.

### Modified Capabilities
<!-- Sem specs existentes em openspec/specs/ — tudo é new capability. -->

## Impact

- **Código afectado**:
  - Novo: `components/documents/` (folder-grid, folder-card, batch-action-bar, document-viewer-modal, document-upload-dialog, custom-doc-type-dialog, use-batch-download)
  - Refactor: `components/properties/property-documents-tab.tsx`, `components/processes/process-documents-manager.tsx`, `components/processes/document-folder-card.tsx`, `components/acquisitions/step-5-documents.tsx`
  - Novo: `app/api/negocios/[id]/documents/route.ts`, `app/api/negocios/[id]/documents/[docId]/route.ts`
  - Alterado: `app/dashboard/leads/[id]/page.tsx` (tab anexos → pastas), `app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx` (+ tab Documentos)
  - Alterado: `app/globals.css` (`.selection-area-rect`)
- **Base de dados (Supabase)**:
  - Nova tabela `negocio_documents` (id, negocio_id FK, doc_type_id FK, file_url, file_name, file_size, mime_type, uploaded_by, valid_until, notes, created_at)
  - Opcional: nova coluna `doc_type_id` em `lead_attachments` (nullable) ou nova tabela `lead_doc_types` (decidir no design)
  - Seed em `doc_types` com categorias para leads/negócios (Identificação, Fiscal, Comprovativos, Contratos, Outros)
- **APIs & storage**: R2 continua como storage; novos paths `negocios/{negocioId}/{docTypeSlug}/...` e `leads/{leadId}/{docTypeSlug}/...`. Sem mudanças ao fluxo de upload R2 existente (`@aws-sdk/client-s3`).
- **Dependências npm**: `@viselect/react ^3.9.0`, `file-saver ^2.0.5`, `react-dropzone ^14`, `@types/file-saver`. shadcn `context-menu`.
- **Quebras**: nenhuma pública; a refactor de Imóveis/Processos mantém props e comportamento observável. Breaking apenas na forma como componentes internos são importados.
