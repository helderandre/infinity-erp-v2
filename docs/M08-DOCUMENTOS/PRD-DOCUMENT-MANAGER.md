# PRD — Gestor de Documentos (Google Drive-like) na Tab de Processos

**Data:** 2026-03-10
**Contexto:** Tab "Documentos" na pagina de detalhe do processo (`/dashboard/processos/[id]`)
**Status actual:** Placeholder — "Seccao de documentos em desenvolvimento"

---

## 1. Visao Geral

Implementar uma interface de gestao de documentos estilo Google Drive dentro da tab "Documentos" do detalhe do processo. A interface organiza documentos em **pastas virtuais** por contexto:

| Pasta | Fonte de Dados | Filtro |
|-------|---------------|--------|
| Documentos do Imovel | `doc_registry` WHERE `property_id` = processo.property_id | `doc_types.category` IN ('Contratual', 'Imovel', 'Juridico', 'Juridico Especial') |
| Documentos do Processo | `proc_tasks.task_result` com `doc_registry_id` | Documentos gerados/uploaded via subtasks |
| Documentos do Proprietario X | `doc_registry` WHERE `owner_id` = X | `doc_types.category` IN ('Proprietario', 'Proprietario Empresa') |
| Documentos do Consultor | `consultant_documents` WHERE `consultant_id` = processo.consultant_id | Todos |

---

## 2. Arquivos Afetados

### 2.1 Arquivos a MODIFICAR

| Arquivo | Motivo |
|---------|--------|
| `app/dashboard/processos/[id]/page.tsx` | Substituir placeholder da seccao "documentos" pelo novo componente |
| `app/api/processes/[id]/route.ts` | Incluir documentos do consultor + documentos do processo (task_result) na resposta |
| `types/process.ts` | Adicionar types para DocumentFolder, ProcessDocumentsResponse |
| `lib/constants.ts` | Adicionar DOC_FOLDER_LABELS, DOC_FOLDER_ICONS |

### 2.2 Arquivos a CRIAR

| Arquivo | Proposito |
|---------|-----------|
| `components/processes/process-documents-manager.tsx` | Componente principal — orquestrador do file manager |
| `components/processes/document-folder-card.tsx` | Card de pasta (icone pasta azul, nome, contagem) |
| `components/processes/document-file-card.tsx` | Card de ficheiro (icone tipo, nome, data, tamanho) |
| `components/processes/document-file-row.tsx` | Linha de ficheiro para vista lista |
| `components/processes/document-preview-dialog.tsx` | Dialog para preview de PDF/imagem |
| `components/processes/document-breadcrumb-nav.tsx` | Breadcrumb de navegacao dentro das pastas |
| `app/api/processes/[id]/documents/route.ts` | API dedicada — agrupa TODOS os documentos do processo por categoria |
| `hooks/use-process-documents.ts` | Hook para fetch + search + filtros dos documentos |

### 2.3 Arquivos EXISTENTES para reutilizar (NAO modificar)

| Arquivo | O que reutilizar |
|---------|-----------------|
| `components/documents/document-uploader.tsx` | Upload com progresso XHR |
| `components/documents/DocumentsSection.tsx` | Pattern de organizacao por categoria |
| `components/shared/empty-state.tsx` | Empty state com icone + CTA |
| `components/ui/file-upload.tsx` | Dropzone drag-and-drop |
| `components/ui/breadcrumb.tsx` | Breadcrumb navigation |
| `components/ui/card.tsx` | Card container |
| `components/ui/dialog.tsx` | Preview dialog |
| `components/ui/scroll-area.tsx` | Scroll areas |
| `components/ui/toggle-group.tsx` | Grid/list toggle |
| `components/ui/skeleton.tsx` | Loading states |
| `components/ui/dropdown-menu.tsx` | Context menu nos ficheiros |
| `components/ui/badge.tsx` | Badge de categoria/status |
| `lib/r2/documents.ts` | Upload/delete no R2 |
| `lib/r2/client.ts` | S3Client singleton |
| `lib/validations/document.ts` | Schema de validacao |
| `hooks/use-debounce.ts` | Debounce para search |

---

## 3. Schema da Base de Dados (JA EXISTE — sem migracoes)

### 3.1 `doc_registry` (documentos de imoveis e proprietarios)

```sql
doc_registry (
  id          UUID PK DEFAULT gen_random_uuid(),
  property_id UUID FK -> dev_properties,    -- NULL se nao for do imovel
  owner_id    UUID FK -> owners,            -- NULL se nao for do proprietario
  doc_type_id UUID FK -> doc_types,
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  uploaded_by UUID FK -> dev_users,
  valid_until TIMESTAMPTZ,
  status      TEXT DEFAULT 'active',        -- active | archived | expired
  metadata    JSONB DEFAULT '{}',           -- { size, mimetype, r2_key }
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ
)
```

### 3.2 `consultant_documents` (documentos do consultor)

```sql
consultant_documents (
  id             UUID PK DEFAULT gen_random_uuid(),
  consultant_id  UUID FK -> dev_users,
  doc_type_id    UUID FK -> doc_types,
  file_url       TEXT,
  file_name      TEXT,
  uploaded_by    UUID FK -> dev_users,
  valid_until    TIMESTAMPTZ,
  status         TEXT DEFAULT 'active',
  metadata       JSONB,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
)
```

### 3.3 `doc_types` — 24 tipos existentes

| Categoria | Tipos |
|-----------|-------|
| Contratual | Contrato de Mediacao (CMI) |
| Imovel | Caderneta Predial (CMI), Certificado Energetico, Ficha Tecnica de Habitacao, Planta do Imovel, Regulamento do Condominio, Titulo Constitutivo, Contrato de Arrendamento |
| Juridico | Certidao Permanente (CRP), Escritura, Licenca de Utilizacao, Procuracao |
| Juridico Especial | Autorizacao do Tribunal, Certidao de Obito, Habilitacao de Herdeiros |
| Proprietario | Cartao de Cidadao, Comprovante de Morada, Comprovativo de Estado Civil, Ficha de Branqueamento de Capitais |
| Proprietario Empresa | Ata de Poderes para Venda, Certidao Permanente da Empresa, Ficha de Branqueamento (Empresa), Pacto Social / Estatutos, RCBE |

### 3.4 `proc_tasks` — documentos gerados no processo

```sql
-- Documentos de subtasks ficam em:
proc_tasks.task_result -> { doc_registry_id: UUID }  -- para UPLOAD
proc_subtasks.task_result -> { doc_registry_id }      -- para subtasks
```

### 3.5 `property_owners` — ligacao M:N

```sql
property_owners (
  property_id          UUID FK -> dev_properties,
  owner_id             UUID FK -> owners,
  ownership_percentage NUMERIC DEFAULT 100,
  is_main_contact      BOOLEAN DEFAULT false
)
```

---

## 4. API — GET `/api/processes/[id]/documents`

### Request
```
GET /api/processes/[id]/documents?search=contrato
```

### Response
```typescript
interface ProcessDocumentsResponse {
  folders: DocumentFolder[]
  stats: {
    total_documents: number
    total_size_bytes: number
    by_status: Record<string, number>
  }
}

interface DocumentFolder {
  id: string                    // 'property' | 'process' | `owner-${ownerId}` | 'consultant'
  name: string                  // 'Documentos do Imovel' | 'Documentos do Processo' | 'Joao Silva' | 'Consultor'
  icon: string                  // 'building' | 'file-check' | 'user' | 'briefcase'
  type: 'property' | 'process' | 'owner' | 'consultant'
  entity_id?: string            // owner_id ou consultant_id
  document_count: number
  documents: DocumentFile[]
}

interface DocumentFile {
  id: string
  file_name: string
  file_url: string
  doc_type: {
    id: string
    name: string
    category: string
  }
  status: 'active' | 'archived' | 'expired'
  uploaded_by?: {
    id: string
    commercial_name: string
  }
  metadata: {
    size?: number
    mimetype?: string
    r2_key?: string
  }
  valid_until?: string
  notes?: string
  created_at: string
  // Campos especificos do processo
  source?: 'registry' | 'task'  // Se veio de doc_registry ou proc_tasks
  task_title?: string           // Se source === 'task', titulo da tarefa
}
```

### Logica do Backend

```typescript
// 1. Buscar property_id e consultant_id do processo
const { property_id, requested_by } = proc_instance

// 2. Buscar owners do imovel
const owners = await supabase
  .from('property_owners')
  .select('owner_id, owners(id, name, person_type)')
  .eq('property_id', property_id)

// 3. Buscar documentos do imovel
const propertyDocs = await supabase
  .from('doc_registry')
  .select('*, doc_types(*), uploaded_by:dev_users(id, commercial_name)')
  .eq('property_id', property_id)
  .is('owner_id', null)
  .eq('status', 'active')

// 4. Buscar documentos de cada proprietario
for (const owner of owners) {
  const ownerDocs = await supabase
    .from('doc_registry')
    .select('*, doc_types(*), uploaded_by:dev_users(id, commercial_name)')
    .eq('owner_id', owner.owner_id)
    .eq('status', 'active')
}

// 5. Buscar documentos do processo (via subtasks completadas)
const processDocs = await supabase
  .from('proc_subtasks')
  .select('id, title, task_result, completed_at')
  .eq('proc_instance_id', processId)
  .not('task_result', 'is', null)
  // Depois JOIN com doc_registry pelo task_result.doc_registry_id

// 6. Buscar documentos do consultor
const consultantDocs = await supabase
  .from('consultant_documents')
  .select('*, doc_types(*)')
  .eq('consultant_id', consultantId)
  .eq('status', 'active')

// 7. Montar resposta agrupada
```

---

## 5. Abordagem de UI — Custom shadcn/ui (SEM bibliotecas externas)

### 5.1 Decisao Tecnica

**Escolha: Build custom com shadcn/ui** (nao usar Chonky/MUI)

**Razoes:**
- Chonky2 traz MUI como dependencia (~200KB+), conflito visual com shadcn/ui
- A estrutura de pastas e fixa/previsivel (4 categorias), nao precisa de file system generico
- Todos os primitivos ja existem no codebase (Card, Breadcrumb, ToggleGroup, Dialog, DropdownMenu)
- Consistencia visual com o resto do ERP

### 5.2 Alternativas Pesquisadas (para referencia)

| Biblioteca | URL | Veredicto |
|-----------|-----|-----------|
| Chonky2 | [github.com/owlpro/chonky2](https://github.com/owlpro/chonky2) | Descartado — MUI dependency |
| react-complex-tree | [github.com/lukasbach/react-complex-tree](https://github.com/lukasbach/react-complex-tree) | Opcional para sidebar tree (0 deps, unstyled) |
| v0.dev File Manager | [v0.dev/t/rKUwt3Oowy0](https://v0.dev/t/rKUwt3Oowy0) | Referencia visual — adaptar |
| shadcnexamples File Manager | [shadcnexamples.com/file-manager](https://shadcnexamples.com/file-manager) | Referencia visual |
| r2-browser | [github.com/CLBray/r2-browser](https://github.com/CLBray/r2-browser) | Referencia para integracao R2 |

---

## 6. Componentes — Especificacao Detalhada

### 6.1 `process-documents-manager.tsx` (Componente Principal)

```
Estado:
- currentFolder: string | null    (null = raiz, mostra pastas)
- viewMode: 'grid' | 'list'
- searchQuery: string
- selectedFiles: string[]

Layout:
┌──────────────────────────────────────────────────┐
│ [Breadcrumb: Documentos > Documentos do Imovel]  │
│                                                  │
│ [Search ___________]  [Grid|List]  [Upload]      │
│                                                  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐  │
│ │ 📁      │ │ 📁      │ │ 📁      │ │ 📁     │  │
│ │ Imovel  │ │ Processo│ │ J.Silva │ │Consultor│  │
│ │ 7 docs  │ │ 3 docs  │ │ 4 docs  │ │ 2 docs │  │
│ └─────────┘ └─────────┘ └─────────┘ └────────┘  │
│                                                  │
│ (ao clicar numa pasta, navega para dentro)       │
│                                                  │
│ Grid View:                                       │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐             │
│ │ 📄      │ │ 📄      │ │ 📄      │             │
│ │ CMI.pdf │ │ CRP.pdf │ │ DL.pdf  │             │
│ │ 245 KB  │ │ 1.2 MB  │ │ 890 KB  │             │
│ └─────────┘ └─────────┘ └─────────┘             │
│                                                  │
│ List View:                                       │
│ ┌────┬──────────────┬──────────┬────────┬──────┐ │
│ │ 📄 │ CMI.pdf      │ Contratual│ 245 KB│ ...  │ │
│ │ 📄 │ CRP.pdf      │ Juridico  │ 1.2 MB│ ...  │ │
│ └────┴──────────────┴──────────┴────────┴──────┘ │
└──────────────────────────────────────────────────┘
```

### 6.2 `document-folder-card.tsx`

```tsx
// Props
interface DocumentFolderCardProps {
  folder: DocumentFolder
  onClick: () => void
}

// Visual — inspirado no design Cloudora (imagens do user)
// Card com icone de pasta azul grande, nome, contagem de documentos
// Hover: shadow-md + scale-[1.01] (pattern existente)
```

**Pattern de referencia do codebase (property-card.tsx):**
```tsx
<Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]">
  <div className="relative aspect-[16/10] bg-muted flex items-center justify-center">
    <Folder className="h-16 w-16 text-blue-400" />
  </div>
  <CardContent className="p-4">
    <h3 className="font-semibold text-sm">{folder.name}</h3>
    <p className="text-xs text-muted-foreground">{folder.document_count} documentos</p>
  </CardContent>
</Card>
```

### 6.3 `document-file-card.tsx` (Grid View)

```tsx
// Visual — card com preview/icone do tipo de ficheiro
<Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md group">
  {/* Preview area */}
  <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
    <FileTypeBadge mimetype={file.metadata?.mimetype} className="h-12 w-12" />
    {/* Overlay actions on hover */}
    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
      <Button size="icon" variant="secondary" onClick={() => onPreview(file)}>
        <Eye className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="secondary" onClick={() => onDownload(file)}>
        <Download className="h-4 w-4" />
      </Button>
    </div>
  </div>
  <CardContent className="p-3">
    <p className="text-sm font-medium truncate">{file.file_name}</p>
    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
      <span>{file.doc_type.name}</span>
      <span>{formatFileSize(file.metadata?.size)}</span>
    </div>
  </CardContent>
</Card>
```

### 6.4 `document-file-row.tsx` (List View)

```tsx
// Pattern da tabela existente em imoveis/page.tsx
<TableRow className="cursor-pointer hover:bg-muted/50">
  <TableCell className="w-10">
    <FileTypeBadge mimetype={file.metadata?.mimetype} className="h-5 w-5" />
  </TableCell>
  <TableCell className="font-medium">{file.file_name}</TableCell>
  <TableCell>
    <Badge variant="outline">{file.doc_type.name}</Badge>
  </TableCell>
  <TableCell className="text-muted-foreground">
    {formatFileSize(file.metadata?.size)}
  </TableCell>
  <TableCell className="text-muted-foreground">
    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true, locale: pt })}
  </TableCell>
  <TableCell>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPreview(file)}>
          <Eye className="mr-2 h-4 w-4" /> Ver
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload(file)}>
          <Download className="mr-2 h-4 w-4" /> Descarregar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TableCell>
</TableRow>
```

### 6.5 `document-preview-dialog.tsx`

```tsx
// PDF: iframe com file_url
// Imagem: <img> com object-fit
<Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
  <DialogContent className="max-w-4xl h-[80vh]">
    <DialogHeader>
      <DialogTitle>{previewFile?.file_name}</DialogTitle>
    </DialogHeader>
    {isPdf ? (
      <iframe
        src={previewFile.file_url}
        className="w-full h-full rounded-md"
        title={previewFile.file_name}
      />
    ) : isImage ? (
      <img
        src={previewFile.file_url}
        alt={previewFile.file_name}
        className="w-full h-full object-contain"
      />
    ) : (
      <div className="flex flex-col items-center justify-center h-full">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <p>Pre-visualizacao nao disponivel</p>
        <Button onClick={() => window.open(previewFile.file_url, '_blank')}>
          Abrir ficheiro
        </Button>
      </div>
    )}
  </DialogContent>
</Dialog>
```

### 6.6 `document-breadcrumb-nav.tsx`

```tsx
// Breadcrumb interno das pastas (NAO e o breadcrumb da pagina)
interface BreadcrumbNavProps {
  currentFolder: DocumentFolder | null
  onNavigateRoot: () => void
}

<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      {currentFolder ? (
        <BreadcrumbLink onClick={onNavigateRoot} className="cursor-pointer">
          Documentos
        </BreadcrumbLink>
      ) : (
        <BreadcrumbPage>Documentos</BreadcrumbPage>
      )}
    </BreadcrumbItem>
    {currentFolder && (
      <>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{currentFolder.name}</BreadcrumbPage>
        </BreadcrumbItem>
      </>
    )}
  </BreadcrumbList>
</Breadcrumb>
```

---

## 7. Hook — `use-process-documents.ts`

```typescript
// Pattern seguido: hooks/use-properties.ts

interface UseProcessDocumentsParams {
  processId: string
  search?: string
}

interface UseProcessDocumentsReturn {
  folders: DocumentFolder[]
  stats: ProcessDocumentsStats
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useProcessDocuments({
  processId,
  search = '',
}: UseProcessDocumentsParams): UseProcessDocumentsReturn {
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [stats, setStats] = useState<ProcessDocumentsStats>({ total_documents: 0, total_size_bytes: 0, by_status: {} })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('search', debouncedSearch)

      const res = await fetch(`/api/processes/${processId}/documents?${params}`)
      if (!res.ok) throw new Error('Erro ao carregar documentos')

      const data: ProcessDocumentsResponse = await res.json()
      setFolders(data.folders)
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [processId, debouncedSearch])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  return { folders, stats, isLoading, error, refetch: fetchDocuments }
}
```

---

## 8. Constantes a Adicionar (`lib/constants.ts`)

```typescript
export const DOC_FOLDER_LABELS = {
  property: 'Documentos do Imovel',
  process: 'Documentos do Processo',
  owner: 'Documentos do Proprietario',
  consultant: 'Documentos do Consultor',
} as const

export const DOC_FOLDER_ICONS = {
  property: 'Building2',
  process: 'FileCheck',
  owner: 'User',
  consultant: 'Briefcase',
} as const

export const FILE_TYPE_ICONS: Record<string, { icon: string; color: string; abbr: string }> = {
  'application/pdf': { icon: 'FileText', color: 'text-red-500', abbr: 'PDF' },
  'image/jpeg': { icon: 'Image', color: 'text-blue-500', abbr: 'JPG' },
  'image/png': { icon: 'Image', color: 'text-blue-500', abbr: 'PNG' },
  'application/msword': { icon: 'FileText', color: 'text-blue-700', abbr: 'DOC' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: 'FileText', color: 'text-blue-700', abbr: 'DOCX' },
}
```

---

## 9. Snippets de Patterns Existentes no Codebase

### 9.1 Grid/List Toggle (de `app/dashboard/imoveis/page.tsx`)

```tsx
const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

<div className="flex border rounded-md">
  <Button
    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
    size="sm"
    className="rounded-r-none"
    onClick={() => setViewMode('table')}
  >
    <List className="h-4 w-4" />
  </Button>
  <Button
    variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
    size="sm"
    className="rounded-l-none"
    onClick={() => setViewMode('grid')}
  >
    <LayoutGrid className="h-4 w-4" />
  </Button>
</div>
```

### 9.2 Search com Debounce (de `components/properties/property-filters.tsx`)

```tsx
<div className="relative flex-1 min-w-[200px]">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Pesquisar documentos..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-9"
  />
</div>
```

### 9.3 Card com Hover (de `components/properties/property-card.tsx`)

```tsx
<Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] py-0">
  <div className="relative aspect-[16/10] bg-muted">
    {/* conteudo */}
  </div>
  <CardContent className="p-4 space-y-2">
    {/* metadata */}
  </CardContent>
</Card>
```

### 9.4 Empty State (de `components/shared/empty-state.tsx`)

```tsx
<EmptyState
  icon={FileText}
  title="Nenhum documento encontrado"
  description="Esta pasta ainda nao tem documentos."
  action={{
    label: 'Carregar Documento',
    onClick: () => setUploadDialogOpen(true),
  }}
/>
```

### 9.5 Upload com Progress (de `components/documents/document-uploader.tsx`)

```tsx
// XHR upload com tracking de progresso
const xhr = new XMLHttpRequest()
xhr.upload.onprogress = (e) => {
  if (e.lengthComputable) {
    const pct = Math.round((e.loaded / e.total) * 85) // 85% para upload
    setProgress(pct)
  }
}
// FormData com: file, doc_type_id, property_id, owner_id, consultant_id
```

### 9.6 R2 Upload Path (de `lib/r2/documents.ts`)

```typescript
type DocumentContext =
  | { type: 'property'; propertyId: string }
  | { type: 'owner'; ownerId: string }
  | { type: 'consultant'; consultantId: string }

function getR2Path(ctx: DocumentContext, fileName: string): string {
  const ts = Date.now()
  const sanitized = sanitizeFileName(fileName)
  switch (ctx.type) {
    case 'property':  return `imoveis/${ctx.propertyId}/${ts}-${sanitized}`
    case 'owner':     return `proprietarios/${ctx.ownerId}/${ts}-${sanitized}`
    case 'consultant': return `consultores/${ctx.consultantId}/${ts}-${sanitized}`
  }
}
```

### 9.7 Hook Pattern (de `hooks/use-properties.ts`)

```typescript
export function useProperties({ search, status, page, perPage }) {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const debouncedSearch = useDebounce(search, 300)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      // build params...
      const res = await fetch(`/api/properties?${params}`)
      const json = await res.json()
      setData(json.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, status, page])

  useEffect(() => { fetch() }, [fetch])
  return { data, isLoading, error, refetch: fetch }
}
```

---

## 10. Fluxo de Navegacao

```
Tab "Documentos" (seccao no sidebar do processo)
    │
    ▼
[Vista Raiz] — mostra 4 pastas como cards
    │
    ├── Clicar "Documentos do Imovel"
    │       ▼
    │   [Vista Pasta] — breadcrumb: Documentos > Documentos do Imovel
    │   Grid/List com ficheiros do imovel
    │   Botao "Voltar" ou clicar "Documentos" no breadcrumb
    │
    ├── Clicar "Documentos do Processo"
    │       ▼
    │   [Vista Pasta] — ficheiros gerados/uploaded via subtasks
    │
    ├── Clicar "Joao Silva" (proprietario)
    │       ▼
    │   [Vista Pasta] — documentos deste proprietario
    │
    └── Clicar "Documentos do Consultor"
            ▼
        [Vista Pasta] — documentos do consultor atribuido
```

---

## 11. Estimativa de Complexidade

| Componente | Complexidade | Dependencias |
|-----------|-------------|-------------|
| API `/processes/[id]/documents` | Media | Supabase queries, 4 fontes de dados |
| `process-documents-manager.tsx` | Media | State management, navegacao interna |
| `document-folder-card.tsx` | Baixa | Card + icone |
| `document-file-card.tsx` | Baixa | Card + hover overlay |
| `document-file-row.tsx` | Baixa | TableRow + DropdownMenu |
| `document-preview-dialog.tsx` | Baixa | Dialog + iframe/img |
| `document-breadcrumb-nav.tsx` | Baixa | Breadcrumb |
| `use-process-documents.ts` | Baixa | Fetch + debounce |
| Types em `types/process.ts` | Baixa | Interfaces |
| Constantes em `lib/constants.ts` | Baixa | Objects |
| Integracao na page do processo | Baixa | Substituir placeholder |

---

## 12. Ordem de Implementacao Sugerida

1. **Types** — Adicionar `DocumentFolder`, `DocumentFile`, `ProcessDocumentsResponse` a `types/process.ts`
2. **Constantes** — Adicionar `DOC_FOLDER_LABELS`, `DOC_FOLDER_ICONS`, `FILE_TYPE_ICONS` a `lib/constants.ts`
3. **API** — Criar `app/api/processes/[id]/documents/route.ts`
4. **Hook** — Criar `hooks/use-process-documents.ts`
5. **Componentes folha** — `document-folder-card`, `document-file-card`, `document-file-row`, `document-breadcrumb-nav`, `document-preview-dialog`
6. **Componente principal** — `process-documents-manager.tsx`
7. **Integracao** — Substituir placeholder em `app/dashboard/processos/[id]/page.tsx`

---

## 13. Referencias Externas

| Recurso | URL | Uso |
|---------|-----|-----|
| v0.dev File Manager (shadcn) | https://v0.dev/t/rKUwt3Oowy0 | Referencia visual para layout grid/list |
| shadcnexamples File Manager | https://shadcnexamples.com/file-manager | Pattern completo |
| shadcnuikit File Manager | https://shadcnuikit.com/dashboard/file-manager | Dashboard template |
| shadcn Left Drawer Explorer | https://www.shadcn.io/patterns/drawer-left-5 | Pattern de sidebar tree |
| react-complex-tree | https://github.com/lukasbach/react-complex-tree | Se precisar de tree sidebar (0 deps) |
| Chonky2 (descartado) | https://github.com/owlpro/chonky2 | Referencia de features, nao usar |
| r2-browser | https://github.com/CLBray/r2-browser | Pattern R2 file browsing |
| cloudflare-r2-file-manager | https://github.com/YsrajSingh/cloudflare-r2-file-manager | CRUD R2 com Node.js |
| Next.js + R2 example | https://github.com/diwosuwanto/cloudflare-r2-with-nextjs-upload-download-delete | Upload/download R2 |
| shadcn File Tree Table | https://www.shadcn.io/blocks/tables-file-tree | Table com tree view |
