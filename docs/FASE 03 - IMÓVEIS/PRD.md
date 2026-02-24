# PRD — Modulo Imoveis (Properties Module)

**Data:** 2026-02-24
**Projecto:** ERP Infinity v2
**Scope:** Implementacao completa do modulo de imoveis (CRUD, listagem, detalhe, galeria de media, upload de imagens com crop/compress, formulario de edicao)

---

## 1. INVENTARIO DE FICHEIROS RELEVANTES DA BASE DE CODIGO

### 1.1 Ficheiros Existentes — Propriedades (Parcialmente Implementados)

| Ficheiro | Estado | Descricao |
|----------|--------|-----------|
| `app/dashboard/imoveis/page.tsx` | Stub vazio | Placeholder "Modulo em desenvolvimento — FASE 2" — SUBSTITUIR |
| `components/properties/property-address-map-picker.tsx` | COMPLETO | Mapbox autocomplete + mapa interactivo + marcador arrastavel |
| `app/api/properties/[id]/documents/route.ts` | PARCIAL | Apenas sub-rota de documentos, falta CRUD principal |
| `lib/validations/property.ts` | COMPLETO | Schemas Zod para property, specs, internal, media |
| `lib/validations/acquisition.ts` | COMPLETO | Schema do formulario de angariacao 5-step |
| `types/document.ts` | COMPLETO | Types de DocType, Document, UploadResult, DeferredDocument |

### 1.2 Infraestrutura de Upload e Storage (PRONTA)

| Ficheiro | Descricao |
|----------|-----------|
| `lib/r2/client.ts` | Singleton S3Client para Cloudflare R2 |
| `lib/r2/documents.ts` | `uploadDocumentToR2()`, `deleteDocumentFromR2()`, `sanitizeFileName()`, DocumentContext |
| `app/api/documents/upload/route.ts` | Upload generico com validacao de extensao, contexto (property/owner/consultant) |
| `components/ui/file-upload.tsx` | Componente base (1417 linhas) — drag-drop, progress, preview, validation |
| `components/documents/document-uploader.tsx` | Wrapper do FileUpload para documentos |
| `components/documents/document-upload-dialog.tsx` | Dialog com seleccao de doc_type |
| `components/documents/DocCategoryCard.tsx` | Card com progress ring por categoria |
| `components/documents/DocumentsSection.tsx` | Container que agrupa doc_types por categoria |
| `lib/validations/document.ts` | MAX_FILE_SIZE (20MB), EXTENSION_MIME_MAP |

### 1.3 Formulario de Angariacao (Padrao Multi-Step — REUTILIZAR)

| Ficheiro | Descricao |
|----------|-----------|
| `components/acquisitions/acquisition-form.tsx` | Form 5-step com deferred upload pattern |
| `components/acquisitions/step-1-property.tsx` | Dados gerais (titulo, tipo, preco, condicao) |
| `components/acquisitions/step-2-location.tsx` | Localizacao com PropertyAddressMapPicker |
| `components/acquisitions/step-3-owners.tsx` | Proprietarios com KYC (singular/coletiva) |
| `components/acquisitions/step-4-contract.tsx` | Contrato (comissao, regime, termos) |
| `components/acquisitions/step-5-documents.tsx` | Documentos com upload deferred |
| `app/api/acquisitions/route.ts` | POST — cria property + specs + internal + owners + proc_instance |

### 1.4 Modulos Similares (USAR COMO TEMPLATE)

#### Leads Module — Padrao CRUD Completo

| Ficheiro | Padrao |
|----------|--------|
| `app/api/leads/route.ts` | GET com filtros + paginacao, POST com validacao Zod |
| `app/api/leads/[id]/route.ts` | GET detalhe, PUT actualizacao, DELETE eliminacao |
| `app/dashboard/leads/page.tsx` | Listagem com DataTable, filtros, paginacao |
| `app/dashboard/leads/[id]/page.tsx` | Detalhe com 6 tabs |
| `app/dashboard/leads/novo/page.tsx` | Formulario de criacao |
| `components/leads/lead-filters.tsx` | Barra de filtros reutilizavel |
| `components/leads/lead-form.tsx` | Formulario react-hook-form + zod |
| `lib/validations/lead.ts` | Schemas de validacao |
| `types/lead.ts` | TypeScript types |

#### Processos Module — Padrao Detail + Actions

| Ficheiro | Padrao |
|----------|--------|
| `app/api/processes/route.ts` | GET lista, POST criar |
| `app/api/processes/[id]/route.ts` | GET detalhe com joins complexos |
| `app/api/processes/[id]/approve/route.ts` | POST accao com validacao |
| `app/dashboard/processos/page.tsx` | Listagem com status badges |
| `app/dashboard/processos/[id]/page.tsx` | Detalhe com stepper + tarefas |

### 1.5 Componentes Partilhados (REUTILIZAR)

| Ficheiro | Descricao |
|----------|-----------|
| `components/shared/confirm-dialog.tsx` | AlertDialog reutilizavel para accoes destrutivas |
| `components/shared/status-badge.tsx` | Badge com cores por status |
| `components/shared/data-table.tsx` | Tabela generica com sort/filter/pagination |
| `components/shared/empty-state.tsx` | Estado vazio com icone + mensagem + CTA |
| `components/shared/loading-skeleton.tsx` | Skeletons reutilizaveis |
| `components/shared/search-input.tsx` | Input de pesquisa com debounce |
| `components/shared/stats-card.tsx` | Card de KPI |
| `components/layout/app-sidebar.tsx` | Sidebar — ADICIONAR link de Imoveis |
| `components/layout/breadcrumbs.tsx` | Breadcrumbs dinamicos PT-PT |
| `components/layout/page-header.tsx` | Header de pagina com titulo + accoes |

### 1.6 Configuracao e Constantes

| Ficheiro | Descricao |
|----------|-----------|
| `lib/constants.ts` | STATUS_COLORS, PROPERTY_TYPES, BUSINESS_TYPES, PROPERTY_CONDITIONS, ENERGY_CERTIFICATES |
| `lib/utils.ts` | `cn()`, formatadores |
| `lib/supabase/client.ts` | Cliente browser |
| `lib/supabase/server.ts` | Cliente server components |
| `lib/supabase/admin.ts` | Cliente service role |
| `hooks/use-user.ts` | Dados do utilizador autenticado |
| `hooks/use-permissions.ts` | Verificacao de permissoes |
| `hooks/use-debounce.ts` | Debounce generico |
| `middleware.ts` | Proteccao de rotas |

### 1.7 Base de Dados — Tabelas Relevantes

```
dev_properties (imovel principal)
├── id, slug, external_ref, title, description, listing_price
├── property_type, business_type, status, energy_certificate
├── city, zone, consultant_id, property_condition, business_status
├── contract_regime, address_parish, address_street, postal_code
├── latitude, longitude, created_at, updated_at

dev_property_specifications (1:1)
├── property_id, typology, bedrooms, bathrooms
├── area_gross, area_util, construction_year
├── parking_spaces, garage_spaces, features[]
├── has_elevator, fronts_count, solar_orientation[], views[]
├── storage_area, balcony_area, pool_area, etc.

dev_property_internal (1:1, dados nao publicos)
├── property_id, exact_address, postal_code
├── internal_notes, commission_agreed, commission_type
├── contract_regime, contract_term, contract_expiry
├── imi_value, condominium_fee, cpcv_percentage

dev_property_media (1:N)
├── id, property_id, url, media_type, order_index, is_cover

property_owners (M:N junction)
├── property_id, owner_id, ownership_percentage, is_main_contact

doc_registry (documentos)
├── id, property_id, doc_type_id, file_url, file_name
├── uploaded_by, valid_until, status, metadata
```

---

## 2. FICHEIROS A CRIAR / MODIFICAR

### 2.1 Novos Ficheiros

```
# API Routes
app/api/properties/route.ts                    → GET (lista com filtros), POST (criar)
app/api/properties/[id]/route.ts               → GET (detalhe), PUT (editar), DELETE (soft delete)
app/api/properties/[id]/media/route.ts         → GET (listar), POST (upload imagem)
app/api/properties/[id]/media/[mediaId]/route.ts → PUT (update order/cover), DELETE (eliminar)
app/api/properties/[id]/media/reorder/route.ts → PUT (reordenar batch)
app/api/r2/upload-image/route.ts               → POST (upload imagem comprimida ao R2)

# Paginas
app/dashboard/imoveis/page.tsx                 → SUBSTITUIR stub — listagem completa
app/dashboard/imoveis/novo/page.tsx            → Formulario de criacao multi-step
app/dashboard/imoveis/[id]/page.tsx            → Detalhe com tabs
app/dashboard/imoveis/[id]/editar/page.tsx     → Formulario de edicao

# Componentes
components/properties/property-card.tsx         → Card para listagem grid
components/properties/property-filters.tsx      → Filtros (status, tipo, cidade, preco)
components/properties/property-form.tsx         → Formulario reutilizavel (criar/editar)
components/properties/property-media-gallery.tsx → Galeria com drag-to-reorder + cover
components/properties/property-media-upload.tsx  → Upload com crop + compress + preview
components/properties/property-image-cropper.tsx → Dialog de crop de imagem
components/properties/property-status-badge.tsx  → Badge de status com cores

# Hooks
hooks/use-properties.ts                        → Hook de listagem com filtros
hooks/use-property.ts                          → Hook de detalhe individual
hooks/use-property-media.ts                    → Hook de gestao de media (upload, reorder, delete)
hooks/use-image-compress.ts                    → Hook de compressao + WebP conversion

# Utilitarios
lib/crop-image.ts                              → getCroppedImg() com canvas → WebP blob
```

### 2.2 Ficheiros a Modificar

```
components/layout/app-sidebar.tsx              → Adicionar/activar link "Imoveis"
lib/constants.ts                               → Verificar PROPERTY_STATUS, adicionar se falta
types/property.ts                              → Criar/completar types de propriedades
lib/validations/property.ts                    → Completar se necessario
```

---

## 3. PADROES DE IMPLEMENTACAO DA BASE DE CODIGO

### 3.1 Padrao: API Route Handler — CRUD com Filtros

**Referencia:** `app/api/leads/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Autenticacao
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // Filtros
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('per_page') || '20')

    let query = supabase
      .from('dev_properties')
      .select(`
        *,
        dev_property_specifications(*),
        dev_property_media(id, url, is_cover, order_index),
        consultant:dev_users!consultant_id(id, commercial_name)
      `, { count: 'exact' })

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('property_type', type)
    if (search) query = query.or(`title.ilike.%${search}%,city.ilike.%${search}%,zone.ilike.%${search}%`)

    // Paginacao
    const from = (page - 1) * perPage
    query = query.range(from, from + perPage - 1)
      .order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, total: count, page, per_page: perPage })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })

    const body = await request.json()
    const validated = createPropertySchema.parse(body)

    const { data, error } = await supabase
      .from('dev_properties')
      .insert(validated)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados invalidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

### 3.2 Padrao: Pagina de Listagem com Filtros

**Referencia:** `app/dashboard/leads/page.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/shared/data-table'
import { PropertyFilters } from '@/components/properties/property-filters'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Building2 } from 'lucide-react'

export default function ImoveisPage() {
  const router = useRouter()
  const [properties, setProperties] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [pagination, setPagination] = useState({ page: 1, total: 0, perPage: 20 })

  useEffect(() => {
    fetchProperties()
  }, [filters, pagination.page])

  async function fetchProperties() {
    setIsLoading(true)
    const params = new URLSearchParams({ page: String(pagination.page), ...filters })
    const res = await fetch(`/api/properties?${params}`)
    const { data, total } = await res.json()
    setProperties(data)
    setPagination(prev => ({ ...prev, total }))
    setIsLoading(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imoveis"
        description="Gestao de imoveis"
        action={
          <Button onClick={() => router.push('/dashboard/imoveis/novo')}>
            <Plus className="mr-2 h-4 w-4" /> Novo Imovel
          </Button>
        }
      />
      <PropertyFilters filters={filters} onChange={setFilters} />
      {isLoading ? <Skeleton /> : properties.length === 0 ? (
        <EmptyState icon={Building2} title="Nenhum imovel encontrado" />
      ) : (
        <DataTable data={properties} columns={columns} />
      )}
    </div>
  )
}
```

### 3.3 Padrao: Pagina de Detalhe com Tabs

**Referencia:** `app/dashboard/leads/[id]/page.tsx`

```typescript
'use client'

import { use, useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [property, setProperty] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/properties/${id}`)
      .then(res => res.json())
      .then(data => { setProperty(data); setIsLoading(false) })
  }, [id])

  return (
    <Tabs defaultValue="geral" className="space-y-6">
      <TabsList>
        <TabsTrigger value="geral">Geral</TabsTrigger>
        <TabsTrigger value="specs">Especificacoes</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="proprietarios">Proprietarios</TabsTrigger>
        <TabsTrigger value="processo">Processo</TabsTrigger>
      </TabsList>
      <TabsContent value="geral">...</TabsContent>
      <TabsContent value="media">
        <PropertyMediaGallery propertyId={id} media={property?.dev_property_media} />
      </TabsContent>
    </Tabs>
  )
}
```

### 3.4 Padrao: Deferred Upload (Angariacao)

**Referencia:** `components/acquisitions/acquisition-form.tsx`

```typescript
// 1. Recolher ficheiros no form state (File objects)
const handleFileSelected = (file: File, docTypeId: string) => {
  form.setValue('documents', [
    ...form.getValues('documents'),
    { doc_type_id: docTypeId, file, file_name: file.name }
  ])
}

// 2. No submit, separar ficheiros do JSON
const pendingFiles = data.documents.filter(d => d.file instanceof File)
const jsonPayload = { ...data, documents: data.documents.filter(d => !(d.file instanceof File)) }

// 3. Enviar JSON para criar a entidade
const result = await fetch('/api/acquisitions', { method: 'POST', body: JSON.stringify(jsonPayload) })
const { property_id } = await result.json()

// 4. Upload dos ficheiros com o property_id real
for (const pending of pendingFiles) {
  const formData = new FormData()
  formData.append('file', pending.file)
  formData.append('property_id', property_id)
  await fetch('/api/documents/upload', { method: 'POST', body: formData })
}
```

### 3.5 Padrao: R2 Upload + DB Registry

**Referencia:** `app/api/documents/upload/route.ts` + `lib/r2/documents.ts`

```typescript
// Determinar contexto (path no R2)
const ctx: DocumentContext = { type: 'property', propertyId }

// Converter File → Buffer
const buffer = Buffer.from(await file.arrayBuffer())

// Upload ao R2
const { url, key } = await uploadDocumentToR2(buffer, file.name, file.type, ctx)

// Registar no DB
await supabase.from('doc_registry').insert({
  property_id: propertyId,
  doc_type_id: docTypeId,
  file_url: url,
  file_name: file.name,
  uploaded_by: user.id,
  metadata: { size: file.size, mimetype: file.type, r2_key: key },
})
```

### 3.6 Padrao: FileUpload Component (Composicao)

**Referencia:** `components/ui/file-upload.tsx`

```typescript
<FileUpload
  value={files}
  onValueChange={setFiles}
  onUpload={handleUpload}
  maxFiles={10}
  maxSize={MAX_FILE_SIZE}
  accept=".jpg,.jpeg,.png,.webp"
>
  <FileUploadDropzone className="min-h-[120px] flex flex-col items-center justify-center gap-2">
    <Upload className="h-6 w-6 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">Arraste imagens ou clique para seleccionar</p>
  </FileUploadDropzone>

  <FileUploadList>
    {files.map((file, i) => (
      <FileUploadItem key={i} value={file}>
        <FileUploadItemPreview />
        <FileUploadItemMetadata />
        <FileUploadItemProgress variant="linear" />
        <FileUploadItemDelete />
      </FileUploadItem>
    ))}
  </FileUploadList>
</FileUpload>
```

---

## 4. DOCUMENTACAO DE TECNOLOGIAS EXTERNAS

### 4.1 browser-image-compression — Compressao Client-Side

**Instalacao:** `npm install browser-image-compression`

**Uso para pipeline de imagens do ERP:**
```typescript
import imageCompression from 'browser-image-compression'

async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.3,              // Max 300KB por imagem
    maxWidthOrHeight: 1920,       // Redimensionar se maior
    useWebWorker: true,           // Nao bloquear UI
    fileType: 'image/webp',       // Converter para WebP
    initialQuality: 0.8,          // Qualidade inicial
    preserveExif: false,          // Strip EXIF (privacidade)
    onProgress: (progress: number) => {
      console.log(`Compressao: ${progress}%`)
    },
  }

  return await imageCompression(file, options)
}
```

**Opcoes Completas:**

| Opcao | Tipo | Default | Descricao |
|-------|------|---------|-----------|
| `maxSizeMB` | number | Infinity | Tamanho max do ficheiro |
| `maxWidthOrHeight` | number | undefined | Redimensionar se exceder |
| `useWebWorker` | boolean | true | Usar Web Worker |
| `fileType` | string | original | Formato de saida (image/webp) |
| `initialQuality` | number | 1 | Qualidade 0-1 |
| `preserveExif` | boolean | false | Manter EXIF |
| `onProgress` | Function | undefined | Callback 0-100 |
| `signal` | AbortSignal | undefined | Cancelar compressao |

**Helpers:**
```typescript
const dataUrl = await imageCompression.getDataUrlFromFile(file)
const file = await imageCompression.getFilefromDataUrl(dataUrl, 'image.webp')
```

**Notas:**
- Fornecer `maxSizeMB` OU `maxWidthOrHeight` (ou ambos) — sem eles nao comprime
- `useWebWorker: true` requer `OffscreenCanvas` no browser
- `fileType: 'image/webp'` faz a conversao automatica para WebP

---

### 4.2 react-easy-crop — Crop de Imagens

**Instalacao:** `npm install react-easy-crop`

**Componente Cropper:**
```tsx
'use client'
import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'

interface ImageCropperProps {
  imageSrc: string
  aspect?: number
  onCropDone: (croppedBlob: Blob) => void
}

export function ImageCropper({ imageSrc, aspect = 16/9, onCropDone }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleSave = async () => {
    if (!croppedAreaPixels) return
    const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation)
    if (blob) onCropDone(blob)
  }

  return (
    <div>
      {/* Container DEVE ter position:relative e altura definida */}
      <div style={{ position: 'relative', width: '100%', height: 400 }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          cropShape="rect"
          showGrid={true}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
        />
      </div>
      <input type="range" min={1} max={3} step={0.1} value={zoom}
        onChange={(e) => setZoom(Number(e.target.value))} />
      <button onClick={handleSave}>Guardar</button>
    </div>
  )
}
```

**Utilitario getCroppedImg (NAO incluido na lib — TEM de ser criado):**

```typescript
// lib/crop-image.ts

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}

function getRadianAngle(degreeValue: number): number {
  return (degreeValue * Math.PI) / 180
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation)
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
  flip = { horizontal: false, vertical: false }
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const rotRad = getRadianAngle(rotation)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1)
  ctx.translate(-image.width / 2, -image.height / 2)
  ctx.drawImage(image, 0, 0)

  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height)

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.putImageData(data, 0, 0)

  // Exportar como WebP com qualidade 0.9
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9)
  })
}
```

**Props Completas do Cropper:**

| Prop | Tipo | Default | Descricao |
|------|------|---------|-----------|
| `image` | string | required | URL ou base64 da imagem |
| `crop` | `{x, y}` | required | Posicao do crop |
| `onCropChange` | function | required | Actualizar crop state |
| `zoom` | number | 1 | Nivel de zoom |
| `minZoom` / `maxZoom` | number | 1 / 3 | Limites de zoom |
| `rotation` | number | 0 | Rotacao em graus |
| `aspect` | number | 4/3 | Aspect ratio (width/height) |
| `cropShape` | 'rect' / 'round' | 'rect' | Forma da area de crop |
| `showGrid` | boolean | true | Mostrar grelha |
| `restrictPosition` | boolean | true | Restringir imagem a area de crop |
| `onCropComplete` | function | — | `(croppedArea, croppedAreaPixels) => void` |
| `objectFit` | string | 'contain' | 'contain', 'cover' |

**Notas:**
- Container **TEM** de ter `position: relative` e altura definida
- A lib NAO inclui `getCroppedImg()` — tem de ser implementada manualmente
- Para WebP: usar `canvas.toBlob(cb, 'image/webp', 0.9)`
- Usar `crossOrigin: 'anonymous'` ao carregar imagens externas (evitar CORS)

---

### 4.3 @dnd-kit — Drag-and-Drop para Reordenar Imagens

**Instalacao:** `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**SortableItem Component:**
```tsx
'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableItemProps {
  id: string
  children: React.ReactNode
}

export function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}
```

**Sortable Image Grid:**
```tsx
'use client'
import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'

interface MediaItem {
  id: string
  url: string
  is_cover: boolean
  order_index: number
}

export function SortableImageGrid({ items, onReorder }: {
  items: MediaItem[]
  onReorder: (items: MediaItem[]) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // Evitar drags acidentais
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id)
      const newIndex = items.findIndex((i) => i.id === over.id)
      const reordered = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order_index: index,
      }))
      onReorder(reordered)
    }
  }

  const activeItem = items.find((i) => i.id === activeId)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id}>
              <img src={item.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
            </SortableItem>
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <img src={activeItem.url} alt="" className="w-full aspect-square object-cover rounded-lg shadow-xl" />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
```

**Estrategias de Sorting:**

| Estrategia | Uso |
|------------|-----|
| `rectSortingStrategy` | Grids (usar para galeria de imagens) |
| `verticalListSortingStrategy` | Listas verticais |
| `horizontalListSortingStrategy` | Listas horizontais |

**Notas:**
- Usar `closestCenter` para interfaces sortable
- `activationConstraint: { distance: 5 }` distingue clicks de drags
- `SortableContext items` deve ser array de string/number IDs, NAO objectos
- `DragOverlay` melhora feedback visual (renderiza fora do fluxo normal)
- `arrayMove` retorna novo array (nao muta o original)

---

### 4.4 Cloudflare R2 — Upload com Presigned URLs

**Ja implementado no projecto:** `lib/r2/client.ts` + `lib/r2/documents.ts`

**Para imagens de imoveis, extender com path especifico:**
```typescript
// Novo path para imagens (separado dos documentos)
// R2_UPLOAD_PATH = 'imoveis-imagens'
// Estrutura: imoveis-imagens/{property-uuid}/{timestamp}-{sanitized}.webp

export type ImageContext = {
  type: 'property-image'
  propertyId: string
}

function getImagePath(ctx: ImageContext): string {
  return `${process.env.R2_UPLOAD_PATH || 'imoveis-imagens'}/${ctx.propertyId}`
}
```

**Presigned URL (alternativa para upload directo do browser):**
```typescript
// app/api/r2/upload-url/route.ts
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export async function POST(request: Request) {
  const { fileName, contentType, path } = await request.json()
  const key = `${path}/${crypto.randomUUID()}-${fileName}`

  const url = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,  // DEVE corresponder ao Content-Type do cliente
    }),
    { expiresIn: 3600 }
  )

  return NextResponse.json({ uploadUrl: url, key, publicUrl: `${R2_PUBLIC_DOMAIN}/${key}` })
}
```

**CORS para R2 (necessario para presigned URLs do browser):**
```json
[{
  "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
  "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
  "AllowedHeaders": ["Content-Type"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}]
```

**Notas criticas:**
- `ContentType` no `PutObjectCommand` DEVE corresponder ao `Content-Type` do upload
- R2 NAO suporta wildcard `"*"` em `AllowedHeaders` (ao contrario do S3)
- Presigned URLs so funcionam no dominio S3 (`*.r2.cloudflarestorage.com`), NAO em custom domains
- Max expiry: 7 dias (604,800s)
- Next.js body size limit default: 1MB — para ficheiros maiores usar presigned URLs

---

### 4.5 Mapbox SearchBox API v1

**Ja implementado no projecto:** `components/properties/property-address-map-picker.tsx`

**Endpoints:**
- `/suggest`: `GET https://api.mapbox.com/search/searchbox/v1/suggest?q=...&access_token=...&session_token=...&language=pt&country=PT&limit=5`
- `/retrieve`: `GET https://api.mapbox.com/search/searchbox/v1/retrieve/{mapbox_id}?access_token=...&session_token=...`
- Reverse geocoding: `GET https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json?access_token=...&language=pt`

**Sessao de billing:**
1. Gerar `crypto.randomUUID()` no inicio
2. Reutilizar em todos os `suggest` ate seleccionar
3. Apos `retrieve`, gerar novo token

**Coordenadas:** Mapbox usa `[longitude, latitude]` (NAO lat/lng)

---

### 4.6 Next.js App Router — File Upload

**Padrao em Route Handlers:**
```typescript
export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  // Validar tipo e tamanho
  if (!file) return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Demasiado grande' }, { status: 400 })

  // Converter para Buffer
  const buffer = Buffer.from(await file.arrayBuffer())

  // Upload ao R2
  await S3.send(new PutObjectCommand({ Bucket, Key, Body: buffer, ContentType: file.type }))
}
```

**Notas:**
- NAO definir `Content-Type` header ao enviar FormData via fetch — o browser faz automaticamente
- `multer`, `formidable`, `busboy` NAO funcionam com App Router Route Handlers
- Usar `request.formData()` em vez disso
- Body size limit default: 1MB — configurar `experimental.serverActions.bodySizeLimit` ou usar presigned URLs

---

## 5. PIPELINE DE UPLOAD DE IMAGENS — FLUXO PROPOSTO

```
Utilizador selecciona imagem(ns)
    |
    v
[Opcional] Dialog de crop (react-easy-crop)
    |-- Aspect ratio: 16:9 ou livre
    |-- Zoom + Rotacao
    |-- Output: Blob via Canvas → WebP
    |
    v
Compressao (browser-image-compression)
    |-- maxSizeMB: 0.3 (300KB)
    |-- maxWidthOrHeight: 1920px
    |-- fileType: 'image/webp'
    |-- useWebWorker: true
    |
    v
Preview no UI (URL.createObjectURL)
    |
    v
Upload ao servidor (POST /api/properties/[id]/media)
    |-- FormData com ficheiro comprimido
    |-- Validacao: tipo, tamanho, extensao
    |-- Buffer → R2 (PutObjectCommand)
    |-- Path: imoveis-imagens/{property-uuid}/{timestamp}-{sanitized}.webp
    |
    v
Registar em dev_property_media
    |-- url, media_type, order_index, is_cover
    |
    v
Actualizar UI (optimistic update ou refetch)
```

**Fluxo alternativo com Presigned URL (para ficheiros grandes):**
```
Cliente → POST /api/r2/upload-url (obter URL assinado)
Cliente → PUT directo ao R2 com ficheiro
Cliente → POST /api/properties/[id]/media (registar no DB)
```

---

## 6. DEPENDENCIAS A INSTALAR

```bash
npm install browser-image-compression react-easy-crop @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Dependencias ja instaladas:**
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2)
- `mapbox-gl` (mapas)
- `react-hook-form` + `@hookform/resolvers` + `zod` (formularios)
- `sonner` (toasts)
- `lucide-react` (icones)
- `date-fns` (datas)
- `framer-motion` (animacoes)

---

## 7. TABELA DE DECISOES TECNICAS

| Decisao | Opcao Escolhida | Justificacao |
|---------|-----------------|--------------|
| Compressao de imagem | `browser-image-compression` (client) | Reduz trafego de rede, WebP nativo, Web Worker |
| Crop de imagem | `react-easy-crop` | Leve (9KB gzip), touch-friendly, aspect ratio, zero deps |
| Drag-and-drop reorder | `@dnd-kit/sortable` | Modular, acessivel, `rectSortingStrategy` para grids |
| Storage | Cloudflare R2 via server proxy | Ja implementado, sem expor credentials |
| Upload flow | FormData → Route Handler → R2 | Consistente com padroes existentes |
| Formato de imagem | WebP | Suporte universal, 30% mais leve que JPEG |
| Path de imagens | `imoveis-imagens/{uuid}/` | Separado dos documentos (`imoveis/{uuid}/`) |
| Estado da galeria | `dev_property_media` | Tabela existente com order_index + is_cover |
| Padrao CRUD | Seguir module de Leads | Consistencia, validacao Zod, Supabase server client |

---

## 8. RISCOS E MITIGACOES

| Risco | Mitigacao |
|-------|----------|
| Imagens muito grandes bloqueiam o browser | `useWebWorker: true` + compressao antes do upload |
| CORS bloqueado em presigned URLs | Configurar CORS no R2 bucket dashboard |
| Next.js body size limit (1MB) | Comprimir para ≤300KB antes do upload, ou usar presigned URLs |
| WebP nao suportado em Safari antigo | Safari 14+ suporta WebP; fallback para JPEG se necessario |
| Perda de dados em upload parcial | Deferred upload pattern ja testado na angariacao |
| Reordenar muitas imagens de uma vez | Batch update endpoint com transacao |
| Canvas CORS tainted em imagens externas | `crossOrigin: 'anonymous'` na Image() |
