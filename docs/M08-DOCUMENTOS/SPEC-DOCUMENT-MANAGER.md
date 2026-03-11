# SPEC — Gestor de Documentos (Tab Processos)

**Data:** 2026-03-10
**PRD:** `docs/PRD-DOCUMENT-MANAGER.md`
**Ordem de implementacao:** De baixo para cima (types → constants → API → hook → componentes folha → orquestrador → integracao)

---

## 1. MODIFICAR `types/process.ts`

**O que fazer:** Adicionar 3 interfaces novas para o sistema de pastas de documentos. Colocar depois da interface `ProcessDocument` existente (linha ~100).

```typescript
export interface DocumentFile {
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
  source?: 'registry' | 'task'
  task_title?: string
}

export interface DocumentFolder {
  id: string                    // 'property' | 'process' | `owner-${ownerId}` | 'consultant'
  name: string                  // 'Documentos do Imovel' | nome do owner | etc.
  icon: string                  // 'Building2' | 'FileCheck' | 'User' | 'Briefcase'
  type: 'property' | 'process' | 'owner' | 'consultant'
  entity_id?: string
  document_count: number
  documents: DocumentFile[]
}

export interface ProcessDocumentsResponse {
  folders: DocumentFolder[]
  stats: {
    total_documents: number
    total_size_bytes: number
    by_status: Record<string, number>
  }
}
```

---

## 2. MODIFICAR `lib/constants.ts`

**O que fazer:** Adicionar 3 constantes no final do ficheiro (depois de `DOC_CATEGORIES`).

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

## 3. CRIAR `app/api/processes/[id]/documents/route.ts`

**O que fazer:** API GET que agrega documentos de 4 fontes e devolve agrupados em pastas. Aceita query param `?search=`.

**Logica:**

1. Obter `property_id` e `requested_by` (consultant_id) do `proc_instances` via admin client
2. Buscar `property_owners` com join em `owners(id, name, person_type)` para o `property_id`
3. **Pasta "Documentos do Imovel"** — query `doc_registry` WHERE `property_id = X` AND `owner_id IS NULL` AND `status = 'active'`, com join `doc_types(*)` e `uploaded_by:dev_users(id, commercial_name)`
4. **Pasta por proprietario** — para cada owner, query `doc_registry` WHERE `owner_id = X` AND `status = 'active'`, mesmos joins
5. **Pasta "Documentos do Processo"** — query `proc_subtasks` WHERE `proc_instance_id = X` AND `task_result IS NOT NULL`. Para cada subtask que tenha `task_result.doc_registry_id`, fazer join com `doc_registry` para obter o ficheiro
6. **Pasta "Documentos do Consultor"** — query `consultant_documents` WHERE `consultant_id = X` AND `status = 'active'`, com join `doc_types(*)`
7. Se `search` param existe, filtrar `file_name ILIKE %search%` em todas as queries (usar `.ilike('file_name', '%${search}%')`)
8. Calcular stats: total_documents (soma de todos), total_size_bytes (soma de metadata.size), by_status (contagem por status)
9. Montar array de `DocumentFolder[]` e devolver como `ProcessDocumentsResponse`

**Pattern a seguir:** `app/api/processes/[id]/route.ts` — usa `createAdminClient()`, params com `Promise<{ id: string }>`, try/catch, status codes 400/404/500.

---

## 4. CRIAR `hooks/use-process-documents.ts`

**O que fazer:** Hook que faz fetch da API de documentos e expoe dados + loading + error + refetch.

**Pattern a seguir:** `hooks/use-properties.ts` — useState para data/loading/error, useCallback para fetch, useEffect para trigger, useDebounce para search.

```typescript
interface UseProcessDocumentsParams {
  processId: string
  search?: string
}

interface UseProcessDocumentsReturn {
  folders: DocumentFolder[]
  stats: ProcessDocumentsResponse['stats']
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useProcessDocuments({ processId, search = '' }: UseProcessDocumentsParams): UseProcessDocumentsReturn
```

- Usa `useDebounce(search, 300)` do `hooks/use-debounce.ts`
- Faz `fetch(/api/processes/${processId}/documents?search=${debouncedSearch})`
- Retorna `{ folders, stats, isLoading, error, refetch }`

---

## 5. CRIAR `components/processes/document-breadcrumb-nav.tsx`

**O que fazer:** Breadcrumb interno para navegacao entre raiz e pasta. Client component.

**Props:**
```typescript
interface DocumentBreadcrumbNavProps {
  currentFolder: DocumentFolder | null  // null = raiz
  onNavigateRoot: () => void
}
```

**Implementacao:**
- Usa componentes `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator` de `components/ui/breadcrumb.tsx`
- Se `currentFolder === null`: mostra "Documentos" como `BreadcrumbPage` (sem link)
- Se `currentFolder !== null`: mostra "Documentos" como `BreadcrumbLink` clicavel (onClick → `onNavigateRoot`) + separator + nome da pasta como `BreadcrumbPage`

---

## 6. CRIAR `components/processes/document-folder-card.tsx`

**O que fazer:** Card de pasta estilo Google Drive. Client component.

**Props:**
```typescript
interface DocumentFolderCardProps {
  folder: DocumentFolder
  onClick: () => void
}
```

**Visual — seguir pattern de `components/properties/property-card.tsx`:**
- `<Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md hover:scale-[1.01]">`
- Area superior: `aspect-[16/10] bg-muted flex items-center justify-center` com icone de pasta (Lucide `Folder` em `h-16 w-16 text-blue-400`)
- `<CardContent className="p-4">`: nome da pasta (`font-semibold text-sm`) + contagem (`text-xs text-muted-foreground`: "X documentos")
- Mapear `folder.icon` para o icone Lucide correcto (Building2, FileCheck, User, Briefcase) e mostrar como badge pequeno no canto do card

---

## 7. CRIAR `components/processes/document-file-card.tsx`

**O que fazer:** Card de ficheiro para vista grid, com overlay de accoes no hover. Client component.

**Props:**
```typescript
interface DocumentFileCardProps {
  file: DocumentFile
  onPreview: (file: DocumentFile) => void
  onDownload: (file: DocumentFile) => void
}
```

**Visual:**
- `<Card className="overflow-hidden cursor-pointer transition-all hover:shadow-md group">`
- Area superior `aspect-[4/3] bg-muted flex items-center justify-center`: icone do tipo de ficheiro baseado em `file.metadata?.mimetype` (usar `FILE_TYPE_ICONS` de constants)
- Overlay no hover: `absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity` com 2 botoes (Eye para preview, Download para download)
- `<CardContent className="p-3">`: file_name truncado + row com doc_type.name e formatFileSize

**Helper `formatFileSize`:** Criar inline ou importar de utils — converte bytes para KB/MB.

---

## 8. CRIAR `components/processes/document-file-row.tsx`

**O que fazer:** Linha de ficheiro para vista lista (tabela). Client component.

**Props:**
```typescript
interface DocumentFileRowProps {
  file: DocumentFile
  onPreview: (file: DocumentFile) => void
  onDownload: (file: DocumentFile) => void
}
```

**Visual — seguir pattern de tabelas existentes em `app/dashboard/imoveis/page.tsx`:**
- `<TableRow className="cursor-pointer hover:bg-muted/50">`
- Colunas: icone tipo | file_name (font-medium) | doc_type.name (Badge outline) | tamanho | data relativa (`formatDistanceToNow` de date-fns com locale pt) | dropdown menu (Eye "Ver", Download "Descarregar")
- DropdownMenu usa `MoreHorizontal` como trigger, `DropdownMenuContent align="end"`

---

## 9. CRIAR `components/processes/document-preview-dialog.tsx`

**O que fazer:** Dialog para pre-visualizar PDFs e imagens inline. Client component.

**Props:**
```typescript
interface DocumentPreviewDialogProps {
  file: DocumentFile | null
  onClose: () => void
}
```

**Implementacao:**
- `<Dialog open={!!file} onOpenChange={() => onClose()}>` com `<DialogContent className="max-w-4xl h-[80vh]">`
- `<DialogHeader>` com `<DialogTitle>{file.file_name}</DialogTitle>`
- Condicional por mimetype:
  - PDF (`application/pdf`): `<iframe src={file.file_url} className="w-full h-full rounded-md" />`
  - Imagem (`image/*`): `<img src={file.file_url} className="w-full h-full object-contain" />`
  - Outro: empty state com icone FileText + botao "Abrir ficheiro" que faz `window.open(file.file_url, '_blank')`

---

## 10. CRIAR `components/processes/process-documents-manager.tsx`

**O que fazer:** Componente principal que orquestra tudo — navegacao de pastas, search, toggle grid/list, preview. Client component.

**Props:**
```typescript
interface ProcessDocumentsManagerProps {
  processId: string
}
```

**Estado interno:**
```typescript
const [currentFolder, setCurrentFolder] = useState<DocumentFolder | null>(null)  // null = raiz
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
const [searchQuery, setSearchQuery] = useState('')
const [previewFile, setPreviewFile] = useState<DocumentFile | null>(null)
```

**Usa:** `useProcessDocuments({ processId, search: searchQuery })`

**Layout (de cima para baixo):**

1. **Toolbar:**
   - `<DocumentBreadcrumbNav currentFolder={currentFolder} onNavigateRoot={() => setCurrentFolder(null)} />`
   - Search input (pattern de `components/properties/property-filters.tsx`: icone Search + Input com `pl-9`)
   - Toggle grid/list (pattern de `app/dashboard/imoveis/page.tsx`: 2 Buttons com variant condicional)
   - Stats badge: "X documentos" total

2. **Conteudo — se `currentFolder === null` (vista raiz):**
   - Grid de `<DocumentFolderCard>` para cada pasta em `folders`
   - `grid grid-cols-2 md:grid-cols-4 gap-4`
   - Clicar numa pasta → `setCurrentFolder(folder)`

3. **Conteudo — se `currentFolder !== null` (dentro de pasta):**
   - Se `viewMode === 'grid'`: grid de `<DocumentFileCard>` — `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`
   - Se `viewMode === 'list'`: `<Table>` com `<DocumentFileRow>` para cada ficheiro
   - Se pasta vazia: `<EmptyState icon={FileText} title="Nenhum documento encontrado" description="Esta pasta ainda nao tem documentos." />`

4. **Preview:** `<DocumentPreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />`

**Loading state:** Skeleton cards (usar `<Skeleton>` de `components/ui/skeleton.tsx`) no lugar dos cards de pasta e ficheiro enquanto `isLoading`.

**Download handler:** `window.open(file.file_url, '_blank')` ou criar `<a>` com `download` attribute.

---

## 11. MODIFICAR `app/dashboard/processos/[id]/page.tsx`

**O que fazer:** Substituir o placeholder de documentos (linhas 935-944) pelo novo componente.

**Adicionar import no topo:**
```typescript
import { ProcessDocumentsManager } from '@/components/processes/process-documents-manager'
```

**Substituir bloco (linhas 935-944):**
```typescript
// DE:
{activeSection === 'documentos' && (
  <Card>
    <CardContent className="py-12 text-center text-muted-foreground">
      <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
      <p className="text-sm font-medium">Documentos</p>
      <p className="text-xs mt-1">Secção de documentos em desenvolvimento.</p>
    </CardContent>
  </Card>
)}

// PARA:
{activeSection === 'documentos' && (
  <ProcessDocumentsManager processId={instance.id} />
)}
```

A `instance.id` ja esta disponivel no scope — e extraido de `processData.instance` na linha ~640.

---

## Resumo de ficheiros

| Accao | Path | Complexidade |
|-------|------|-------------|
| MODIFICAR | `types/process.ts` | Baixa — adicionar 3 interfaces |
| MODIFICAR | `lib/constants.ts` | Baixa — adicionar 3 constantes |
| CRIAR | `app/api/processes/[id]/documents/route.ts` | Media — 4 queries Supabase + agregacao |
| CRIAR | `hooks/use-process-documents.ts` | Baixa — fetch + debounce |
| CRIAR | `components/processes/document-breadcrumb-nav.tsx` | Baixa — breadcrumb simples |
| CRIAR | `components/processes/document-folder-card.tsx` | Baixa — card com icone |
| CRIAR | `components/processes/document-file-card.tsx` | Baixa — card com hover overlay |
| CRIAR | `components/processes/document-file-row.tsx` | Baixa — table row + dropdown |
| CRIAR | `components/processes/document-preview-dialog.tsx` | Baixa — dialog + iframe/img |
| CRIAR | `components/processes/process-documents-manager.tsx` | Media — orquestrador com estado |
| MODIFICAR | `app/dashboard/processos/[id]/page.tsx` | Baixa — substituir placeholder |

**Total:** 3 ficheiros modificados + 8 ficheiros criados

---

## Componentes existentes reutilizados (NAO modificar)

- `components/ui/breadcrumb.tsx` — Breadcrumb, BreadcrumbList, BreadcrumbItem, etc.
- `components/ui/card.tsx` — Card, CardContent
- `components/ui/dialog.tsx` — Dialog, DialogContent, DialogHeader, DialogTitle
- `components/ui/skeleton.tsx` — Skeleton (loading)
- `components/ui/badge.tsx` — Badge (categoria)
- `components/ui/dropdown-menu.tsx` — DropdownMenu + items
- `components/ui/table.tsx` — Table, TableRow, TableCell
- `components/shared/empty-state.tsx` — EmptyState com icon + CTA
- `hooks/use-debounce.ts` — useDebounce(value, 300)
