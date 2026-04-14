## 1. Setup e dependências

- [x] 1.1 Instalar dependências npm: `@viselect/react@^3.9.0`, `file-saver@^2.0.5`, `@types/file-saver`, `react-dropzone@^14`
- [x] 1.2 Adicionar componente shadcn `context-menu` (`npx shadcn add context-menu`)
- [x] 1.3 Adicionar regra `.selection-area-rect` ao layer `components` em `app/globals.css` (usando `hsl(var(--primary) / 0.08)`)
- [x] 1.4 Criar pasta `components/documents/` com `index.ts` de barrel exports
- [x] 1.5 Definir tipos partilhados em `components/documents/types.ts` (`DocumentFile`, `DocumentFolder`, `DocumentsGridProps`, `DomainConfig`)
- [x] 1.6 Criar `components/documents/domain-configs.ts` com mapeamento de categorias PT-PT por domínio (properties, leads, negocios, processes)
- [x] 1.7 Criar `lib/documents/labels.ts` com strings PT-PT centralizadas (botões, toasts, empty states)

## 2. Biblioteca partilhada `components/documents/`

- [x] 2.1 Estender `components/icons/folder-icon.tsx` com props `thumbnailUrl`, `badgeCount`, `state: 'empty' | 'filled' | 'selected'`
- [x] 2.1a Criar helper `lib/documents/file-icon.ts` com `getExtensionFromFile(file)` (deriva de `mimeType` ou `fileName`) para alimentar o `DocIcon` existente em `components/icons/doc-icon.tsx`
- [x] 2.2 Implementar `<FolderCard>` em `components/documents/folder-card.tsx` — renderiza FolderIcon + label + contador, com `data-selectable`, classe `.selectable-folder`, ring em selecção
- [x] 2.3 Implementar `<DocumentsGrid>` em `components/documents/documents-grid.tsx` — agrupa por categoria com `Collapsible`, envolve com `<SelectionArea>` de `@viselect/react`, gere `selectedIds: Set<string>`, desactiva drag em `pointer: coarse`
- [x] 2.4 Integrar `ContextMenu` em `<FolderCard>` com acções: Seleccionar, Abrir, Enviar, Descarregar pasta (PT-PT)
- [x] 2.5 Gerir double-click em `<FolderCard>` → `onOpenFolder` (viewer) se tem ficheiros, senão `onUpload` (upload dialog)
- [x] 2.6 Implementar `<BatchActionBar>` em `components/documents/batch-action-bar.tsx` com animação slide-up via Tailwind (`translate-y-0`/`translate-y-full` + `opacity`)
- [x] 2.7 Implementar hook `useBatchDownload` em `components/documents/use-batch-download.ts` com lógica single-file vs ZIP, `toast.promise`, `_erros.txt` em falhas parciais, limite soft 200 MB. **Nota:** o fetch passa por `/api/documents/proxy?url=...` (ver task 2.7a) para contornar CORS do R2 público.
- [x] 2.7a Criar `app/api/documents/proxy/route.ts` que valida URL contra `R2_PUBLIC_DOMAIN`, faz `GetObjectCommand` server-side e devolve bytes com `content-disposition: attachment`. Requer sessão Supabase autenticada.
- [x] 2.8 Implementar `<DocumentViewerModal>` em `components/documents/document-viewer-modal.tsx` — área principal (PDF/img/docx/fallback), sidebar com lista de ficheiros usando `<DocIcon extension={...}>`, navegação por teclado (Esc, ←/→), contador N/M
- [x] 2.9 Adicionar acções no viewer: Descarregar, Substituir (upload upsert), Eliminar com `AlertDialog` PT-PT
- [x] 2.10 Implementar `<DocumentUploadDialog>` em `components/documents/document-upload-dialog.tsx` com `react-dropzone`, previews via `<DocIcon extension={...}>`, validação de extensão/tamanho, etiqueta por ficheiro, data de validade condicional (`has_expiry`), textarea notas, `toast.promise` com progresso
- [x] 2.11 Implementar `<CustomDocTypeDialog>` em `components/documents/custom-doc-type-dialog.tsx` — nome + toggle "Tem validade?", cria `doc_type` via nova rota partilhada
- [x] 2.12 Criar página dev `app/dev-documents/page.tsx` com dados fake para validar a biblioteca isolada (remover no passo 8). Nota: `_dev` é privado no Next App Router, usar `dev-documents`.

## 3. API partilhada `doc_types` e upload

- [x] 3.1 Migration Supabase: `supabase/migrations/20260414_doc_types_applies_to.sql` adiciona `applies_to text[]` + backfill. **Por aplicar** à DB.
- [x] 3.2 Seed já incluído na migration (backfill por categoria).
- [x] 3.3 `GET /api/libraries/doc-types` agora aceita `?applies_to=<domain>` e filtra via PostgREST `or(applies_to.cs.{...},applies_to.eq.{})`. Relaxada a permissão de `settings` para `auth only` (listagem é catálogo, não sensível).
- [x] 3.4 `POST /api/libraries/doc-types/custom` criado — aceita `name`, `has_expiry`, `applies_to[]`, `category`. Slug gerado automaticamente.
- [x] 3.5 Auditoria `log_audit` registada na criação de tipos custom.

## 4. Refactor Imóveis

- [x] 4.1 Criar adapter `lib/documents/adapters/property.ts` que converte a resposta actual de `/api/properties/[id]/documents` para `DocumentFolder[]`
- [x] 4.2 Adicionar toggle "Lista / Pastas" via novo `property-documents-root.tsx`; vista "Pastas" usa `<DocumentsGrid>` + `<BatchActionBar>` + modais partilhados. **Nota de escopo:** substituição total foi rejeitada — o tab legacy tem 1009 linhas com fluxos AI (classify, extract-validity, extract-legal, compose-email) que estão fora do âmbito desta change. A toggle permite ambos coexistirem até os AI flows serem portados em change futura.
- [x] 4.3 Handlers existentes mantidos intactos: `POST /api/documents/upload`, `DELETE /api/documents/[id]`, `POST /api/properties/[id]/documents/extract-validity` — invocados também a partir da nova vista Pastas.
- [ ] 4.4 Validar em staging: upload, batch download, viewer PDF/imagem, delete, extract-validity — todos continuam a funcionar
- [ ] 4.5 Remover componentes antigos não usados (se houver) e actualizar imports. **Pendente:** consolidar `property-documents-tab.tsx` (legacy) vs `property-documents-folders-view.tsx` depois de decisão do stakeholder sobre qual vista fica como default.

## 5. Refactor Processos e Angariações

- [x] 5.1 Criar adapter `lib/documents/adapters/process.ts` a partir de `GET /api/processes/[id]/documents`
- [x] 5.2 Substituído `components/processes/process-documents-manager.tsx` pelo flat grid com `<DocumentsGrid>`. A UX navegação-dentro-de-pasta foi trocada por double-click → viewer com todos os ficheiros da pasta. Mantém search e badge de contador. Decisão confirmada pelo stakeholder.
- [x] 5.3 O novo `<FolderCard>` partilhado substitui a grelha antiga. `components/processes/document-folder-card.tsx` (e `document-file-card.tsx`, `document-file-row.tsx`, `document-preview-dialog.tsx`, `document-breadcrumb-nav.tsx`) ficam órfãos — marcar para remoção em 4.5/8.6.
- [~] 5.4 Substituir UI em `components/acquisitions/step-5-documents.tsx` — **ignorado** por decisão do stakeholder (passo de formulário, UX diferente).
- [ ] 5.5 Validar em staging: approve/reject do processo, upload em tarefa UPLOAD, preview inline, batch download por fase

## 6. Leads — upgrade de Anexos

- [x] 6.1 Migration `supabase/migrations/20260414_lead_attachments_doc_type.sql` — adiciona `doc_type_id uuid null` + índice. **Por aplicar.**
- [x] 6.2 `lead_attachments` passa a ter `doc_type_id`, `valid_until`, `notes`, `file_size`, `mime_type` lidos via join em `doc_types`. Types do Supabase serão regenerados quando migration for aplicada.
- [x] 6.3 `GET /api/leads/[id]/attachments` agora devolve `{ folders: DocumentFolder[] }` agrupado por `doc_type_id` (registos sem tipo caem em "Outros").
- [x] 6.4 `POST` detecta `Content-Type`: multipart faz upload a R2 em `leads/{leadId}/{docTypeSlug}/...` e cria registo; JSON mantém comportamento legacy (anexar URL externo).
- [x] 6.5 `PUT /api/leads/attachments/[attachmentId]` criado para actualizar `doc_type_id`, `valid_until`, `notes`, `name`.
- [x] 6.6 Hook `hooks/use-lead-documents.ts` criado.
- [x] 6.7 Subtab "Anexos" em `app/dashboard/leads/[id]/page.tsx` substituída por `<LeadDocumentsFoldersView>` (DocumentsGrid + modais).
- [x] 6.8 Seed incluído no backfill da migration (categorias agrupadas por keyword).
- [ ] 6.9 Validar em staging: anexos antigos sem `doc_type_id` aparecem em "Outros" e ainda podem ser descarregados.

## 7. Negócios — nova superfície de Documentos

- [x] 7.1 Migration `supabase/migrations/20260414_negocio_documents.sql` — cria tabela com `ON DELETE CASCADE` no `negocio_id`, trigger de `updated_at`, 3 índices. **Por aplicar.**
- [x] 7.2 Types Supabase regenerados via MCP para `types/database.ts` (478 763 chars). `negocio_documents`, `doc_types.applies_to` e `lead_attachments.{doc_type_id,file_size,mime_type,valid_until,notes}` presentes. **Atenção:** a regeneração revelou ~94 erros TS pré-existentes que estavam escondidos pelo `types/database.ts` partido anterior (o TS caía para `any`). Nenhum erro afecta ficheiros desta change; é débito técnico separado a limpar numa change própria (`cleanup-types-after-db-regen`).
- [x] 7.3 Types ficam derivados via `Database['public']['Tables']['negocio_documents']['Row']` após regen.
- [x] 7.4 `GET /api/negocios/[id]/documents` devolve `{ folders }` agrupado por `doc_type_id`, com joins para `doc_types` e `dev_users` (uploader).
- [x] 7.5 `POST /api/negocios/[id]/documents` — multipart, valida extensão via `doc_type.allowed_extensions`, upload a R2 (`negocios/{negocioId}/{slug}/...`), insert + auditoria.
- [x] 7.6 `PUT` e `DELETE` em `app/api/negocios/[id]/documents/[docId]/route.ts`. DELETE faz cleanup best-effort no R2 + auditoria.
- [x] 7.7 Hook `hooks/use-negocio-documents.ts` criado.
- [x] 7.8 Tab "Documentos" adicionada em `app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx` no final da lista de tabs (aparece em todos os tipos de negócio).
- [x] 7.9 `<NegocioDocumentsFoldersView>` renderiza `<DocumentsGrid domain="negocios">` + upload/viewer/custom-type dialogs.
- [ ] 7.10 Seed `doc_types` com tipos partilhados — incluído no backfill da migration `doc_types.applies_to` (Contratual → `['properties','negocios']`, Proprietário → `['properties','leads','negocios']`). Tipos novos específicos (Contrato de Promessa, CPCV) podem ser criados via UI.

## 8. QA, acessibilidade e cleanup

- [ ] 8.1 **Manual** — Testar em browser real: Chrome/Firefox/Safari desktop + mobile (iOS Safari e Android Chrome). Validar que drag está desactivado em touch.
- [ ] 8.2 **Manual** — Testar navegação por teclado no viewer (Esc, ←/→) e semântica ARIA nos `ContextMenu` e `Dialog`.
- [x] 8.3 Labels e toasts centralizados em `lib/documents/labels.ts` — PT-PT consistente em toda a library.
- [ ] 8.4 **Manual** — Medir performance do batch download com 20 ficheiros/~150 MB. O limite soft 200 MB está implementado em `useBatchDownload`.
- [ ] 8.5 **Manual** — Verificar dark mode: `.selection-area-rect` usa `color-mix(in oklch, var(--primary) 8%, transparent)` (adapta automaticamente). Verificar `FolderIcon` gradients e `DocumentViewerModal`.
- [x] 8.6 `app/dev-documents/page.tsx` removida. Também removidos 5 componentes órfãos de `components/processes/` (document-folder-card, document-file-card, document-file-row, document-preview-dialog, document-breadcrumb-nav) — substituídos pela nova library.
- [x] 8.7 `CLAUDE.md` actualizado com secção "Documentos — Biblioteca Partilhada" detalhando contrato, componentes, adapters, APIs, schema DB, R2 paths, CSS e bug conhecido do `@viselect/react`.
- [ ] 8.8 **Stakeholder** — Confirmar decisões em design §Open Questions:
  - ✅ `doc_types.applies_to text[]` adoptado e aplicado em DB.
  - ⏳ Substituir ficheiro no viewer — ainda não implementado (a decidir: soft-delete + novo vs upsert).
  - ⏳ Permissões — actualmente `requirePermission('leads')` para leads e `requirePermission('pipeline')` para negócios. A discutir se é adequado.
