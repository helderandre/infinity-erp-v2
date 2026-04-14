## Context

O ERP já tem três implementações diferentes de UI de documentos:

| Módulo | Estado | Ficheiros principais | Armazenamento |
|---|---|---|---|
| Imóveis | Completo (upload + lista + filtros) | `components/properties/property-documents-tab.tsx`, `app/api/properties/[id]/documents/route.ts` | R2 `imoveis-documentos/` |
| Processos | Completo (folder-view) | `components/processes/process-documents-manager.tsx`, `components/processes/document-folder-card.tsx`, `app/api/processes/[id]/documents/route.ts` | R2 via `doc_registry` |
| Leads | Básico (lista plana) | Inline em `app/dashboard/leads/[id]/page.tsx`, `app/api/leads/[id]/attachments/route.ts` | R2, tabela `lead_attachments` |
| Negócios | Inexistente | — | — |

O projecto Rota Náutica 2 resolveu a mesma categoria de problema com uma biblioteca uniforme: grelha de pastas 3D + selecção por arrasto (`@viselect/react`) + download em lote (`jszip` + `file-saver`) + viewer modal. A Infinity pediu para adoptar o mesmo padrão.

Dependências já presentes no ERP: `jszip`, shadcn `collapsible/tooltip/switch/textarea/separator/popover`, `FolderIcon` 3D, cliente R2 via `@aws-sdk`. Falta: `@viselect/react`, `file-saver`, `react-dropzone`, shadcn `context-menu`.

CLAUDE.md obriga PT-PT em toda a UI, `STATUS_COLORS` centralizado em `lib/constants.ts`, componentes <150 linhas e extracção para sub-componentes/hooks.

## Goals / Non-Goals

**Goals:**
- Uma única biblioteca `components/documents/` reutilizada por todos os domínios (imóveis, processos/angariações, leads, negócios e futuros).
- UX idêntica em todos os módulos: pastas 3D, toggle seleccionar/double-click/right-click, rectângulo de arrasto, barra flutuante com contador + "Descarregar" + "Cancelar".
- Download em lote com estrutura `{tipo-documento}/{ficheiro}` no ZIP; single-file usa `saveAs` directo.
- Viewer inline para PDF (iframe), imagens (`<img>`), DOCX (Office Online Viewer); fallback com CTA "Descarregar" para outros tipos.
- Backend uniforme: a API de cada domínio devolve sempre `{ folders: Folder[] }` onde `Folder = { id, name, category, docTypeId, files: File[], expiresAt?: string, isCustom: boolean }`. Os componentes partilhados não conhecem Supabase/R2 directamente.
- Refactor sem regredir funcionalidade existente de imóveis e processos (capas, expiry, extract-validity continuam a funcionar).

**Non-Goals:**
- Criar módulo de Clientes (não existe).
- Implementar alertas automáticos de expiração via cron ou email (já coberto em outras specs).
- OCR automático de anexos de leads/negócios (fora de âmbito; só upload + preview).
- Suporte offline / PWA.
- Migrar storage de R2 para Supabase Storage (continua R2).

## Decisions

### D1. Biblioteca partilhada "domain-agnostic"

Os componentes em `components/documents/` recebem dados já normalizados — não fazem fetch directo a tabelas. Cada domínio tem o seu próprio hook (`useNegocioDocuments`, `useLeadDocuments`, etc.) que chama a API e devolve o shape comum `{ folders, isLoading, refetch }`.

**Alternativa considerada:** componente "mágico" que recebe `entityType="negocio"` e faz fetch internamente. Rejeitado porque acopla a biblioteca aos endpoints e torna testing mais difícil.

**Contrato (TypeScript):**
```ts
type DocumentFile = {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
  uploadedAt: string
  uploadedBy?: { id: string; name: string }
}

type DocumentFolder = {
  id: string               // ID estável (docTypeId ou custom UUID)
  docTypeId: string | null // null se for folder "Outros" sem tipo
  name: string             // "Identificação", "CPCV", etc.
  category: string         // mapa para agrupar (ver D3)
  icon?: LucideIcon        // opcional, por default infere de category
  files: DocumentFile[]
  hasExpiry: boolean
  expiresAt?: string | null
  isCustom: boolean
}

type DocumentsGridProps = {
  folders: DocumentFolder[]
  onOpenFolder: (folder: DocumentFolder) => void
  onUpload: (folder: DocumentFolder) => void
  onDownloadFolder: (folder: DocumentFolder) => void
  getPublicUrl: (file: DocumentFile) => string  // R2 público ou assinado
  emptyState?: ReactNode
}
```

### D2. Selecção múltipla com `@viselect/react`

Usar `<SelectionArea>` a envolver a grelha, com `selectables=".selectable-folder"` e `data-selectable={folder.id}`. Estado `selectedIds: Set<string>` fica no componente `DocumentsGrid`. CSS `.selection-area-rect` partilhado em `globals.css`.

**Integração com click/double-click:**
- Click simples em pasta → toggle no set.
- Double-click → abre viewer modal com primeiro ficheiro (se existir) ou upload dialog (se vazia).
- Right-click → shadcn `ContextMenu` com: Seleccionar/Desseleccionar, Abrir, Enviar, Descarregar pasta.
- Drag sobre áreas vazias → rectângulo. O `@viselect/react` ignora clicks curtos (<5px).

### D3. Categorias por domínio

Cada domínio tem a sua config em `components/documents/domain-configs.ts`:

```ts
export const DOMAIN_CONFIGS = {
  properties: {
    categories: [
      { id: 'obrigatorios', label: 'Obrigatórios', icon: Anchor },
      { id: 'vistoria', label: 'Vistoria', icon: Search },
      { id: 'contratos', label: 'Contratos', icon: FileText },
      { id: 'outros', label: 'Outros', icon: FolderOpen },
    ],
  },
  leads: {
    categories: [
      { id: 'identificacao', label: 'Identificação', icon: IdCard },
      { id: 'fiscal', label: 'Fiscal', icon: Receipt },
      { id: 'comprovativos', label: 'Comprovativos', icon: FileCheck },
      { id: 'outros', label: 'Outros', icon: File },
    ],
  },
  negocios: { /* idem com Contratos */ },
  processes: { /* usa categorias existentes de doc_types */ },
}
```

A renderização usa `<Collapsible>` por categoria (default todas abertas em desktop, primeira em mobile).

### D4. Esquema de base de dados

**`negocio_documents`** (nova tabela):
```sql
create table negocio_documents (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references negocios(id) on delete cascade,
  doc_type_id uuid references doc_types(id),
  file_url text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references dev_users(id),
  valid_until timestamptz,
  notes text,
  created_at timestamptz default now()
);
create index idx_negocio_documents_negocio on negocio_documents(negocio_id);
create index idx_negocio_documents_doc_type on negocio_documents(doc_type_id);
```

**`lead_attachments`** (alteração mínima): adicionar coluna `doc_type_id uuid references doc_types(id) null`. Registos antigos ficam com `null` e caem no folder "Outros". Sem migration destrutiva.

**`doc_types`** — seed adicional com categorias para leads/negócios (marcados via nova coluna `applies_to text[]` — e.g. `['properties']`, `['leads','negocios']` — ou via coluna `category` já existente). **Decisão**: usar coluna `applies_to text[]` nova para permitir tipos partilhados entre domínios sem duplicação.

**Alternativa considerada:** tabela polimórfica única `documents(entity_type, entity_id, ...)`. Rejeitado: quebra integridade referencial e torna queries mais complexas. Tabelas separadas por domínio com `doc_type_id` partilhado é melhor compromisso.

### D5. Download em lote

Hook `useBatchDownload` em `components/documents/use-batch-download.ts`:
1. Recolhe `files: DocumentFile[]` a partir de `selectedIds`.
2. Se `files.length === 1` → `saveAs(await fetchBlob(url), file.name)`.
3. Se múltiplos → `JSZip`: cada ficheiro entra em `{folder.name}/{file.name}`. Nome do zip: `documentos-{entidade}-{YYYYMMDD}.zip`.
4. Progress toast via `sonner` com `toast.promise`.
5. Erros individuais (404 no R2) adicionam entrada `_erros.txt` dentro do zip em vez de falhar todo.

URLs públicos do R2 (`R2_PUBLIC_DOMAIN`) — já é o padrão no ERP. Se futuramente o bucket ficar privado, introduzir endpoint `/api/documents/signed-url?key=...`; a interface `getPublicUrl` na prop permite trocar sem mexer nos componentes.

### D6. Upload dialog

`DocumentUploadDialog` usa `react-dropzone` (50MB max, aceita tipos do `doc_types.allowed_extensions`). Campos:
- Dropzone multi-ficheiro com preview
- Campo opcional "Etiqueta" por ficheiro (e.g. "Frente", "Verso")
- Data de validade (só se `docType.has_expiry`)
- Textarea notas

Submit: upload sequencial a `POST /api/{domain}/{id}/documents` com `FormData` (um request por ficheiro para manter rotas simples; barra de progresso agregada no toast). Invalidate do hook após todos completos.

**Alternativa:** zustand upload-queue-store com eventos (como em rota-nautica). Rejeitado por agora: overhead desnecessário para o uso actual do ERP; promover se/quando surgir necessidade de uploads em background.

### D7. Viewer modal

`DocumentViewerModal` recebe `files: DocumentFile[]` + `initialIndex`. Renderiza:
- PDF → `<iframe src="{url}#toolbar=1&navpanes=0" />`
- `image/*` → `<img className="object-contain" />`
- `.docx` → `<iframe src="https://view.officeapps.live.com/op/embed.aspx?src={encodeURIComponent(url)}" />` (aviso: requer URL público; só activar se `R2_PUBLIC_DOMAIN` definido)
- Outros → placeholder + botão "Descarregar"

Sidebar direita com lista de ficheiros (thumbnail/ícone por mime), hover com acções: Descarregar, Eliminar, Substituir (upload com `upsert=true`). Setas de navegação "N / M".

### D8. Ícones partilhados (FolderIcon + DocIcon)

O ERP já tem dois componentes de ícone desenhados à medida em `components/icons/`. A biblioteca de documentos MUST usá-los em vez de ícones Lucide genéricos — consistência visual e evitar re-trabalho.

**`FolderIcon`** (`components/icons/folder-icon.tsx`) — pasta 3D com perspectiva. Estender com props novas:
- `thumbnailUrl?: string` — se primeiro ficheiro é imagem, mostrar miniatura "a espreitar" da pasta.
- `badgeCount?: number` — número de ficheiros.
- `state?: 'empty' | 'filled' | 'selected'` — altera gradientes (CSS vars `--folder-tab-from/to`).

**`DocIcon`** (`components/icons/doc-icon.tsx`) — folha com canto dobrado e badge colorido por extensão (já suporta pdf/doc/xls/ppt/txt/jpg/png/webp/svg/zip/mp4/mp3/json/html/pages/numbers/key). A biblioteca usa-o em:
- **Sidebar do `DocumentViewerModal`** — cada item da lista de ficheiros renderiza `<DocIcon extension={...} className="h-8 w-8" />`. Substitui o mapa hardcoded "PDF vermelho / imagem azul / DOCX azul-escuro" do Rota Náutica.
- **Previews do `DocumentUploadDialog`** — cada ficheiro na dropzone antes do submit mostra `<DocIcon>` + nome + tamanho + X.
- **Empty state** de folders vazias — quando a pasta não tem ficheiros mas tem um tipo de documento associado, podemos complementar o `FolderIcon` com um `DocIcon` ghost indicativo.

A extensão é derivada do `mimeType` (ou `fileName.split('.').pop()`). Para MIME types não mapeados, o `DocIcon` usa o fallback `DEFAULT_COLOR` (primary do tema) com label `"doc"`.

### D9. Onde viver o CSS da rectangular selection

`app/globals.css` — zona `@layer components`:
```css
@layer components {
  .selection-area-rect {
    background: hsl(var(--primary) / 0.08);
    border: 1.5px solid hsl(var(--primary) / 0.4);
    border-radius: 6px;
  }
}
```
Usa variáveis de tema shadcn para respeitar dark mode.

### D10. Acessibilidade & mobile

- Selecção por arrasto **desactivada** em `pointer: coarse` (touch) — `@viselect/react` permite `behaviour.triggers=[]`. Em touch, selecção é só por click nas pastas.
- Context menu também acessível por botão `⋮` visível em touch.
- Navegação por teclado no viewer: `Esc` fecha, `←/→` troca ficheiro.

## Risks / Trade-offs

- **Refactor duplo (imóveis + processos)** → risco de regressão em features já em produção (capas, extract-validity).
  - **Mitigação:** manter APIs actuais intactas; a refactor é apenas da camada UI. Introduzir a biblioteca partilhada primeiro com adapter que traduz os payloads antigos para o shape `DocumentFolder[]`. Testar imóveis primeiro, depois processos.
- **`@viselect/react` + Next.js App Router** → biblioteca client-only, precisa `'use client'` e pode ter problemas com hydration se renderizada em SSR.
  - **Mitigação:** envolver num `dynamic(() => import(...), { ssr: false })` se necessário; começar sem e medir.
- **DOCX preview via Office Online** → requer URL público e envia o documento para servidores Microsoft.
  - **Mitigação:** feature-flag por env var; desactivar se o bucket R2 ficar privado; avisar stakeholders.
- **Migration `lead_attachments.doc_type_id`** → coluna nova numa tabela em uso.
  - **Mitigação:** nullable, sem default obrigatório; registos antigos caem no folder "Outros". Zero downtime.
- **Tamanho do ZIP em batch download** → ficheiros grandes podem esgotar memória no browser.
  - **Mitigação:** limite soft de 200 MB total (soma dos `file_size`) antes de iniciar; avisar via `toast.warning` para descarregar em menos pastas.
- **Consistência PT-PT** → 5 novos componentes + muitos labels. Risco de esquecer strings.
  - **Mitigação:** todos os textos em `lib/constants.ts#DOCUMENT_LABELS` ou direct inline sempre em PT-PT; code review foca labels.

## Migration Plan

1. **Infra (tasks.md §1-2):** instalar deps, adicionar shadcn `context-menu`, criar `globals.css` rule, criar pasta `components/documents/` com os componentes e types partilhados. Nenhuma mudança a módulos existentes ainda.
2. **Biblioteca primeiro (§3):** implementar `DocumentsGrid`, `FolderCard`, `BatchActionBar`, `DocumentViewerModal`, `DocumentUploadDialog`, `CustomDocTypeDialog`, `useBatchDownload`. Storybook/test page em `app/_dev/documents/page.tsx` (removida no fim) para validar isolada.
3. **Imóveis (§4):** adapter que converte resposta existente para `DocumentFolder[]`; trocar UI da tab por `<DocumentsGrid>`. Testar em staging.
4. **Processos (§5):** idem, incluindo a variante em `step-5-documents.tsx`.
5. **Leads (§6):** migration SQL (`lead_attachments.doc_type_id`), seed `doc_types` com `applies_to`, nova UI na tab Anexos.
6. **Negócios (§7):** migration SQL (`negocio_documents`), rotas API, nova tab Documentos.
7. **Cleanup (§8):** remover código antigo não usado, rever labels PT-PT, QA final.

**Rollback:**
- Cada passo 3-7 é independente e revertível por git revert do PR respectivo.
- Migrations são aditivas (nova tabela, nova coluna nullable) — rollback SQL é `drop table` / `drop column` sem perda de dados dos módulos antigos.

## Open Questions

1. **`doc_types.applies_to` vs categoria única:** adoptar `text[]` ou manter apenas `category` e filtrar por nome? → Recomendação: `applies_to text[]` para permitir `doc_types` partilhados (ex: "Cartão de Cidadão" em leads e em negocios). Decidir antes de iniciar §5.
2. **Substituir ficheiro** no viewer: fazer upload novo + soft-delete do antigo, ou upsert no mesmo path R2? → Recomendação: soft-delete + novo registo para manter histórico. Confirmar com stakeholder.
3. **Permissões**: só o `assigned_agent_id` do lead/negocio pode fazer upload, ou qualquer user com permissão `documents`? → Assumir por agora qualquer user com `permissions.documents=true`; validar com cliente.
4. **Watermark/annotate PDFs** no viewer — fora de âmbito agora, mas deixar hook `onFilePreview` extensível para adicionar depois.
