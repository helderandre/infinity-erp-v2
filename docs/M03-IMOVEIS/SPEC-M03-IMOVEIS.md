# SPEC — Módulo Imóveis (M03)

**Data:** 2026-02-24
**PRD:** [PRD.md](./PRD.md)
**Scope:** CRUD completo de imóveis, listagem com filtros, detalhe com tabs, galeria de media com drag-to-reorder, upload de imagens com crop + compressão, formulário de edição

---

## Dependências a Instalar

```bash
npm install browser-image-compression react-easy-crop @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## FASE 1 — Types, Validações e Infraestrutura de Imagens

### 1.1 CRIAR `types/property.ts`

Definir tipos compostos para a propriedade com relações, seguindo o padrão de [types/lead.ts](../types/lead.ts).

```typescript
import type { Database } from './database'

type PropertyRow = Database['public']['Tables']['dev_properties']['Row']
type PropertySpecsRow = Database['public']['Tables']['dev_property_specifications']['Row']
type PropertyInternalRow = Database['public']['Tables']['dev_property_internal']['Row']
type PropertyMediaRow = Database['public']['Tables']['dev_property_media']['Row']
type OwnerRow = Database['public']['Tables']['owners']['Row']
type DevUser = Database['public']['Tables']['dev_users']['Row']

// Listagem — usado na tabela/grid de imóveis
export interface PropertyWithRelations extends PropertyRow {
  dev_property_specifications: PropertySpecsRow | null
  dev_property_media: Pick<PropertyMediaRow, 'id' | 'url' | 'is_cover' | 'order_index'>[]
  consultant: Pick<DevUser, 'id' | 'commercial_name'> | null
}

// Detalhe — usado na página de detalhe/edição
export interface PropertyDetail extends PropertyRow {
  dev_property_specifications: PropertySpecsRow | null
  dev_property_internal: PropertyInternalRow | null
  dev_property_media: PropertyMediaRow[]
  consultant: Pick<DevUser, 'id' | 'commercial_name'> | null
  property_owners: {
    ownership_percentage: number
    is_main_contact: boolean
    owners: Pick<OwnerRow, 'id' | 'name' | 'email' | 'phone' | 'nif'> | null
  }[]
}

// Re-exports para conveniência
export type PropertyMedia = PropertyMediaRow
export type PropertySpecs = PropertySpecsRow
export type PropertyInternal = PropertyInternalRow
```

---

### 1.2 MODIFICAR `lib/validations/property.ts`

O ficheiro já existe com 4 schemas (`propertySchema`, `propertySpecsSchema`, `propertyInternalSchema`, `propertyMediaSchema`). Adicionar schemas de update (partial) e de filtros.

**Adicionar ao final do ficheiro:**

```typescript
// Schema para actualização parcial (PUT)
export const updatePropertySchema = propertySchema.partial()

export const updatePropertySpecsSchema = propertySpecsSchema.omit({ property_id: true }).partial()

export const updatePropertyInternalSchema = propertyInternalSchema.omit({ property_id: true }).partial()

// Schema de filtros da listagem
export const propertyFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  property_type: z.string().optional(),
  business_type: z.string().optional(),
  city: z.string().optional(),
  consultant_id: z.string().uuid().optional(),
  price_min: z.number().nonnegative().optional(),
  price_max: z.number().nonnegative().optional(),
  page: z.number().int().positive().default(1),
  per_page: z.number().int().min(1).max(100).default(20),
})

export type UpdatePropertyFormData = z.infer<typeof updatePropertySchema>
export type UpdatePropertySpecsFormData = z.infer<typeof updatePropertySpecsSchema>
export type UpdatePropertyInternalFormData = z.infer<typeof updatePropertyInternalSchema>
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>
```

---

### 1.3 CRIAR `lib/r2/images.ts`

Upload e delete de imagens de imóveis no R2 (path separado dos documentos). Seguir padrão de [lib/r2/documents.ts](../lib/r2/documents.ts).

```typescript
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'
import { sanitizeFileName } from './documents'

export async function uploadImageToR2(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  propertyId: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const uploadPath = process.env.R2_UPLOAD_PATH || 'imoveis-imagens'
  const key = `${uploadPath}/${propertyId}/${Date.now()}-${sanitized}`

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

export async function deleteImageFromR2(key: string): Promise<void> {
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

### 1.4 CRIAR `lib/crop-image.ts`

Utilitário client-side para crop de imagens com canvas → WebP blob. Necessário para `react-easy-crop` (a lib não inclui esta função).

```typescript
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

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.9)
  })
}
```

---

## FASE 2 — API Routes (Backend)

### 2.1 CRIAR `app/api/properties/route.ts`

**GET** — listagem com filtros + paginação. **POST** — criar imóvel (property + specs + internal).

Seguir padrão exacto de [app/api/leads/route.ts](../app/api/leads/route.ts).

**GET:**
- Parâmetros: `search`, `status`, `property_type`, `business_type`, `city`, `consultant_id`, `price_min`, `price_max`, `page` (default 1), `per_page` (default 20)
- Select: `*, dev_property_specifications(*), dev_property_media(id, url, is_cover, order_index), consultant:dev_users!consultant_id(id, commercial_name)`
- Opção `{ count: 'exact' }` para paginação
- Filtros: `.eq()` para status/type/city/consultant, `.ilike()` para search (contra title, city, zone, external_ref), `.gte()`/`.lte()` para price range
- Order: `created_at desc`
- Range: offset-based como leads `(page-1)*perPage` até `(page-1)*perPage + perPage - 1`
- Retorno: `{ data, total, page, per_page }`

**POST:**
- Auth obrigatória
- Validar body com `propertySchema.safeParse(body)`
- Insert em `dev_properties` com `consultant_id: user.id` como default se não fornecido
- Se body incluir `specifications`: insert em `dev_property_specifications` com `property_id`
- Se body incluir `internal`: insert em `dev_property_internal` com `property_id`
- Retorno: `{ id: property.id }` com status 201

---

### 2.2 CRIAR `app/api/properties/[id]/route.ts`

**GET** — detalhe com todas as relações. **PUT** — edição parcial. **DELETE** — soft delete.

Seguir padrão exacto de [app/api/leads/[id]/route.ts](../app/api/leads/[id]/route.ts).

**Assinatura de params:** `{ params }: { params: Promise<{ id: string }> }` com `const { id } = await params`

**GET:**
- Select: `*, dev_property_specifications(*), dev_property_internal(*), dev_property_media(*), consultant:dev_users!consultant_id(id, commercial_name), property_owners(ownership_percentage, is_main_contact, owners(id, name, email, phone, nif))`
- Order media por `order_index asc`
- Erro PGRST116 → 404 "Imóvel não encontrado"
- Retorno: objecto completo (tipo `PropertyDetail`)

**PUT:**
- Auth obrigatória
- Validar body: pode conter `property` (campos do `dev_properties`), `specifications` (campos do `dev_property_specifications`), `internal` (campos do `dev_property_internal`)
- Para cada secção presente no body:
  - `property`: `supabase.from('dev_properties').update(propertyData).eq('id', id)`
  - `specifications`: `supabase.from('dev_property_specifications').upsert({ property_id: id, ...specsData })`
  - `internal`: `supabase.from('dev_property_internal').upsert({ property_id: id, ...internalData })`
- Usar `upsert` para specs/internal porque podem não existir ainda
- Retorno: `{ id }`

**DELETE:**
- Auth obrigatória
- Soft delete: `supabase.from('dev_properties').update({ status: 'cancelled' }).eq('id', id)`
- Retorno: `{ ok: true }`

---

### 2.3 CRIAR `app/api/properties/[id]/media/route.ts`

**GET** — listar media do imóvel. **POST** — upload de imagem (FormData → R2 → DB).

**GET:**
- `supabase.from('dev_property_media').select('*').eq('property_id', id).order('order_index', { ascending: true })`
- Retorno: array de `PropertyMedia`

**POST:**
- Auth obrigatória
- `const formData = await request.formData()`
- Campos: `file` (File, obrigatório), `is_cover` (opcional, "true"/"false")
- Validar: tipo (image/webp, image/jpeg, image/png), tamanho (max 5MB — imagens já vêm comprimidas do client)
- Converter: `Buffer.from(await file.arrayBuffer())`
- Upload: `uploadImageToR2(buffer, file.name, file.type, id)` (de `lib/r2/images.ts`)
- Se `is_cover === "true"`: `supabase.from('dev_property_media').update({ is_cover: false }).eq('property_id', id)` (limpar cover anterior)
- Determinar `order_index`: query `max(order_index)` + 1
- Insert: `supabase.from('dev_property_media').insert({ property_id: id, url, media_type: 'image', order_index, is_cover }).select().single()`
- Retorno: o registo criado com status 201

---

### 2.4 CRIAR `app/api/properties/[id]/media/[mediaId]/route.ts`

**PUT** — actualizar is_cover. **DELETE** — eliminar imagem (R2 + DB).

**PUT:**
- Body: `{ is_cover?: boolean }`
- Se `is_cover === true`: limpar cover anterior (`update({ is_cover: false }).eq('property_id', id)`) antes de definir o novo
- `supabase.from('dev_property_media').update(body).eq('id', mediaId)`
- Retorno: `{ ok: true }`

**DELETE:**
- Auth obrigatória
- Obter registo: `supabase.from('dev_property_media').select('url').eq('id', mediaId).single()`
- Extrair key do URL: `url.replace(R2_PUBLIC_DOMAIN + '/', '')`
- `deleteImageFromR2(key)` (de `lib/r2/images.ts`)
- `supabase.from('dev_property_media').delete().eq('id', mediaId)`
- Retorno: `{ ok: true }`

---

### 2.5 CRIAR `app/api/properties/[id]/media/reorder/route.ts`

**PUT** — batch reorder de imagens.

- Auth obrigatória
- Body: `{ items: { id: string, order_index: number }[] }`
- Loop pelos items: `supabase.from('dev_property_media').update({ order_index: item.order_index }).eq('id', item.id)`
- Retorno: `{ ok: true }`

---

## FASE 3 — Hooks

### 3.1 CRIAR `hooks/use-properties.ts`

Hook para listagem de imóveis com filtros e paginação. Padrão: state interno + fetch + useCallback + useEffect, como na página de leads.

```typescript
interface UsePropertiesParams {
  search?: string
  status?: string
  propertyType?: string
  businessType?: string
  city?: string
  consultantId?: string
  priceMin?: number
  priceMax?: number
  page?: number
  perPage?: number
}

interface UsePropertiesReturn {
  properties: PropertyWithRelations[]
  total: number
  isLoading: boolean
  error: string | null
  refetch: () => void
}
```

- Usa `useDebounce(search, 300)` do hook existente
- Build `URLSearchParams` com filtros não-vazios
- `fetch('/api/properties?' + params)` no `useEffect` dependente dos filtros
- Reset page a 0 quando filtros mudam (como leads)

---

### 3.2 CRIAR `hooks/use-property.ts`

Hook para detalhe de imóvel individual.

```typescript
interface UsePropertyReturn {
  property: PropertyDetail | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}
```

- `fetch('/api/properties/${id}')` no `useEffect`
- Retorna o objecto completo com todas as relações

---

### 3.3 CRIAR `hooks/use-property-media.ts`

Hook para gestão de media (upload, reorder, delete, set cover).

```typescript
interface UsePropertyMediaReturn {
  media: PropertyMedia[]
  isUploading: boolean
  uploadProgress: number
  uploadImages: (files: File[]) => Promise<void>
  deleteImage: (mediaId: string) => Promise<void>
  setCover: (mediaId: string) => Promise<void>
  reorderImages: (items: PropertyMedia[]) => Promise<void>
  refetch: () => void
}
```

- `uploadImages`: para cada file, faz `POST /api/properties/${propertyId}/media` com FormData
- `deleteImage`: `DELETE /api/properties/${propertyId}/media/${mediaId}`
- `setCover`: `PUT /api/properties/${propertyId}/media/${mediaId}` com `{ is_cover: true }`
- `reorderImages`: `PUT /api/properties/${propertyId}/media/reorder` com `{ items: [...] }`
- Cada operação chama `refetch()` no final para actualizar o estado

---

### 3.4 CRIAR `hooks/use-image-compress.ts`

Hook para compressão client-side de imagens com `browser-image-compression`.

```typescript
interface UseImageCompressReturn {
  compressImage: (file: File) => Promise<File>
  compressImages: (files: File[]) => Promise<File[]>
  isCompressing: boolean
  progress: number  // 0-100
}
```

- Opções fixas: `maxSizeMB: 0.3`, `maxWidthOrHeight: 1920`, `useWebWorker: true`, `fileType: 'image/webp'`, `initialQuality: 0.8`, `preserveExif: false`
- `compressImages`: comprime em paralelo com `Promise.all`, actualiza `progress` conforme cada uma completa

---

## FASE 4 — Componentes

### 4.1 CRIAR `components/properties/property-filters.tsx`

Filtros de imóveis. Seguir padrão exacto de [components/leads/lead-filters.tsx](../components/leads/lead-filters.tsx).

```typescript
interface PropertyFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  propertyType: string
  onPropertyTypeChange: (value: string) => void
  businessType: string
  onBusinessTypeChange: (value: string) => void
  city: string
  onCityChange: (value: string) => void
  consultants: { id: string; commercial_name: string }[]
  consultantId: string
  onConsultantChange: (value: string) => void
  onClearFilters: () => void
  hasActiveFilters: boolean
}
```

**Selectores (todos com opção "Todos"):**
- Search (Input com ícone Search) — placeholder "Pesquisar por título, cidade..."
- Status → `PROPERTY_STATUS` de `lib/constants.ts`
- Tipo de imóvel → `PROPERTY_TYPES` de `lib/constants.ts`
- Tipo de negócio → `BUSINESS_TYPES` de `lib/constants.ts`
- Cidade → Input livre (não select, porque há muitas cidades)
- Consultor → Select com lista de consultores (fetch `/api/users/consultants`)
- Botão "Limpar" quando `hasActiveFilters`

---

### 4.2 CRIAR `components/properties/property-card.tsx`

Card para vista de grid na listagem. Mostra imagem de capa, título, preço, tipo, cidade, specs resumidos, status badge.

```typescript
interface PropertyCardProps {
  property: PropertyWithRelations
  onClick?: () => void
}
```

**Conteúdo:**
- Imagem de capa (primeira media com `is_cover: true`, ou primeira por `order_index`, ou placeholder)
- Badge de status (usar `StatusBadge` existente com `type="property"`)
- Título (truncado)
- Localização (cidade + zona)
- Preço (formatado com `formatCurrency`)
- Specs resumidos: quartos (🛏), casas de banho (🚿), área (m²) — da relação `dev_property_specifications`
- Consultor (nome)

---

### 4.3 CRIAR `components/properties/property-status-badge.tsx`

Wrapper fino sobre `StatusBadge` existente — ou simplesmente usar `<StatusBadge status={status} type="property" />` directamente. Avaliar se é necessário um componente separado. Se `StatusBadge` já suporta `type="property"` (e suporta — verificado em [components/shared/status-badge.tsx](../components/shared/status-badge.tsx)), **não criar ficheiro separado** — usar `StatusBadge` directamente.

---

### 4.4 CRIAR `components/properties/property-image-cropper.tsx`

Dialog de crop de imagem usando `react-easy-crop`. Client-only component.

```typescript
interface PropertyImageCropperProps {
  imageSrc: string         // URL ou base64 da imagem original
  open: boolean
  onOpenChange: (open: boolean) => void
  onCropDone: (croppedBlob: Blob) => void
  aspect?: number          // default 16/9
}
```

**Implementação:**
- Usa `<Dialog>` do shadcn para o wrapper
- Dentro: `<Cropper>` do `react-easy-crop` com container `position: relative, height: 400px`
- Slider de zoom (shadcn `<Slider>` ou input range)
- Botões: "Cancelar" + "Guardar" (com Loader2 enquanto processa crop)
- No "Guardar": chama `getCroppedImg()` de `lib/crop-image.ts` → passa o blob ao `onCropDone`
- Aspecto configurável mas default 16:9 (padrão imobiliário)

---

### 4.5 CRIAR `components/properties/property-media-upload.tsx`

Componente de upload de imagens com pipeline: select → [crop opcional] → compress → preview.

```typescript
interface PropertyMediaUploadProps {
  propertyId: string
  onUploadComplete: () => void  // para refetch da galeria
}
```

**Fluxo:**
1. Botão "Adicionar Imagens" abre file picker (accept: `.jpg,.jpeg,.png,.webp`)
2. Para cada ficheiro seleccionado:
   - Mostrar preview (URL.createObjectURL)
   - [Opcional] Abrir dialog de crop (PropertyImageCropper) — botão de crop por imagem
   - Comprimir com `useImageCompress` hook
3. Lista de imagens prontas para upload com previews
4. Botão "Enviar" — upload de todas via `usePropertyMedia.uploadImages()`
5. Progress bar global durante upload
6. Toast de sucesso/erro via sonner

**Pode usar o `FileUpload` existente de `components/ui/file-upload.tsx`** como base para o drag-drop + preview, mas com a pipeline de crop/compress custom antes do upload.

---

### 4.6 CRIAR `components/properties/property-media-gallery.tsx`

Galeria de imagens com drag-to-reorder via `@dnd-kit/sortable` + marcação de capa + delete.

```typescript
interface PropertyMediaGalleryProps {
  propertyId: string
  media: PropertyMedia[]
  onMediaChange: () => void  // refetch trigger
}
```

**Implementação usando @dnd-kit:**
- `DndContext` + `SortableContext` com `rectSortingStrategy`
- `PointerSensor` com `activationConstraint: { distance: 5 }` (evitar drags acidentais)
- `DragOverlay` para feedback visual durante drag
- Grid responsivo: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4`
- Cada item:
  - Imagem com aspect-ratio (object-cover)
  - Badge "Capa" se `is_cover`
  - Botão overlay "Definir como capa" (ícone Star)
  - Botão overlay "Eliminar" (ícone Trash2, com confirmação AlertDialog)
  - Handle de drag (ícone GripVertical)
- Ao final do drag: chama `PUT /api/properties/${propertyId}/media/reorder` via `usePropertyMedia.reorderImages()`
- Inclui `<PropertyMediaUpload>` no final para adicionar mais imagens

---

### 4.7 CRIAR `components/properties/property-form.tsx`

Formulário reutilizável para criar/editar imóvel. Usa `react-hook-form` + `zod`.

```typescript
interface PropertyFormProps {
  defaultValues?: Partial<PropertyFormData & PropertySpecsFormData & PropertyInternalFormData>
  onSubmit: (data: { property: PropertyFormData; specifications: PropertySpecsFormData; internal: PropertyInternalFormData }) => Promise<void>
  isSubmitting?: boolean
  mode: 'create' | 'edit'
}
```

**Secções (Cards):**

**Card 1 — Dados Gerais:**
- Título (Input, obrigatório)
- Descrição (Textarea)
- Tipo de imóvel (Select com `PROPERTY_TYPES`)
- Tipo de negócio (Select com `BUSINESS_TYPES`)
- Preço (Input number, com formatação EUR)
- Condição (Select com `PROPERTY_CONDITIONS`)
- Certificado energético (Select com `ENERGY_CERTIFICATES`)
- Referência externa (Input)
- Status (Select com `PROPERTY_STATUS`) — visível apenas em mode `edit`

**Card 2 — Localização:**
- `<PropertyAddressMapPicker>` (componente existente — reutilizar)
- Wired via `form.setValue()` / `form.watch()` conforme padrão da acquisition-form

**Card 3 — Especificações:**
- Tipologia (Select com `TYPOLOGIES`)
- Quartos, Casas de banho, Lugares de estacionamento, Garagem (Input number)
- Área bruta, Área útil (Input number)
- Ano de construção (Input number)
- Elevador (Checkbox)
- Frentes (Input number)
- Orientação solar (multi-select com `SOLAR_ORIENTATIONS`)
- Vistas (multi-select com `VIEWS`)
- Equipamento (multi-select com `EQUIPMENT`)
- Características (multi-select com `FEATURES`)
- Áreas extra: arrecadação, varanda, piscina, sótão, despensa, ginásio (Input number cada)

**Card 4 — Dados Internos (Contrato):**
- Regime de contrato (Select com `CONTRACT_REGIMES`)
- Comissão acordada (Input number) + Tipo de comissão (Select: percentagem/valor fixo)
- Prazo do contrato (Input)
- Data de expiração (Input date)
- IMI (Input number)
- Condomínio (Input number)
- CPCV % (Input number)
- Notas internas (Textarea)

**Botões:**
- "Guardar" / "Criar Imóvel" (conforme mode) — com Loader2 durante submissão

---

## FASE 5 — Páginas

### 5.1 SUBSTITUIR `app/dashboard/imoveis/page.tsx`

Substituir o stub actual (17 linhas) pela listagem completa. Seguir padrão exacto de [app/dashboard/leads/page.tsx](../app/dashboard/leads/page.tsx).

**Estrutura:**
- Export default wraps em `<Suspense fallback={<ImoveisPageSkeleton />}>`
- `ImoveisPageSkeleton`: skeleton com header + filtros + grid/tabela
- `ImoveisPageContent`: conteúdo principal
- Estado: `properties[]`, `total`, `isLoading`, `consultants[]`, `deleteId`, filtros (search, status, propertyType, businessType, consultantId), `page`, `viewMode` (grid/table)

**Header:**
- Título: "Imóveis"
- Descrição: "Gestão de imóveis"
- Botão: "Novo Imóvel" → `router.push('/dashboard/imoveis/novo')`

**Conteúdo:**
- `<PropertyFilters>` (componente criado em 4.1)
- Toggle vista: Grid / Tabela (2 botões com ícones LayoutGrid / List)
- **Vista Tabela** (padrão): shadcn `<Table>` com colunas:
  - Imagem (thumbnail pequeno da capa, 40x40 rounded)
  - Título
  - Tipo
  - Cidade
  - Preço (formatado)
  - Status (StatusBadge)
  - Consultor
  - Data (formatDate)
  - Menu de acções (DropdownMenu: Ver, Editar, Eliminar)
- **Vista Grid**: grid de `<PropertyCard>` (componente 4.2)
  - `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`
- `<EmptyState>` quando sem resultados
- Paginação: prev/next como leads

**Delete:**
- `<AlertDialog>` de confirmação (padrão do codebase)
- Soft delete via `DELETE /api/properties/${id}`
- Toast de sucesso/erro

---

### 5.2 CRIAR `app/dashboard/imoveis/[id]/page.tsx`

Página de detalhe do imóvel com tabs. Seguir padrão de [app/dashboard/leads/[id]/page.tsx](../app/dashboard/leads/[id]/page.tsx).

**Carregamento:**
- `const { id } = useParams<{ id: string }>()`
- `useProperty(id)` hook para fetch
- Skeleton enquanto carrega

**Header:**
- Botão "Voltar" (ArrowLeft)
- Título do imóvel
- StatusBadge
- Referência (slug ou external_ref)
- Botão "Editar" → `router.push(/dashboard/imoveis/${id}/editar)`

**Tabs (6):**

1. **Geral** — Dados principais em Cards de leitura:
   - Card "Informações Gerais": tipo, negócio, condição, certificado energético, referência, consultor
   - Card "Preço": listing_price formatado
   - Card "Localização": morada, cidade, zona, código postal + mapa (se lat/lng existem — renderizar mapa read-only com mapbox-gl marker)

2. **Especificações** — Dados de `dev_property_specifications`:
   - Grid de stats: tipologia, quartos, casas de banho, área bruta, área útil, ano construção, estacionamento
   - Lista: características, equipamento, orientação solar, vistas
   - Áreas extra numa grid

3. **Media** — Galeria de imagens:
   - `<PropertyMediaGallery>` (componente 4.6)
   - Drag-to-reorder, set cover, delete, upload

4. **Documentos** — Documentos do imóvel:
   - Reutilizar `<DocumentsSection>` existente de `components/documents/DocumentsSection.tsx`
   - Fetch docs via `GET /api/properties/${id}/documents` (rota já existente)
   - Upload via dialog existente `<DocumentUploadDialog>`

5. **Proprietários** — Dados de `property_owners` + `owners`:
   - Lista/tabela com: nome, NIF, email, telefone, % propriedade, contacto principal (badge)
   - Link para futuro módulo de proprietários

6. **Processo** — Estado do processo associado:
   - Fetch `proc_instances` onde `property_id = id`
   - Se existe: mostrar referência (PROC-YYYY-XXXX), status, percentagem, link para detalhe do processo
   - Se não existe: mensagem "Nenhum processo associado"

---

### 5.3 CRIAR `app/dashboard/imoveis/novo/page.tsx`

Página de criação de imóvel.

**Duas opções de abordagem — escolher a mais adequada:**

**Opção A — Formulário simples (recomendado):** Usar `<PropertyForm mode="create">` numa página simples com submit `POST /api/properties`.

```typescript
'use client'

export default function NovoImovelPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(data) {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data.property,
          specifications: data.specifications,
          internal: data.internal,
        }),
      })
      if (!res.ok) throw new Error('Erro ao criar imóvel')
      const { id } = await res.json()
      toast.success('Imóvel criado com sucesso')
      router.push(`/dashboard/imoveis/${id}`)
    } catch {
      toast.error('Erro ao criar imóvel')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Imóvel</h1>
          <p className="text-muted-foreground">Criar um novo imóvel no sistema</p>
        </div>
      </div>
      <PropertyForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  )
}
```

**Nota:** para angariações completas (com owners + documentos + processo) já existe o fluxo em `/dashboard/aquisicoes/novo` com `AcquisitionForm`. Esta página (`/imoveis/novo`) é para criar imóveis "avulsos" sem processo.

---

### 5.4 CRIAR `app/dashboard/imoveis/[id]/editar/page.tsx`

Página de edição do imóvel.

**Estrutura:**
- Carrega dados via `useProperty(id)`
- Skeleton enquanto carrega
- Header: botão voltar + "Editar Imóvel" + título
- `<PropertyForm mode="edit" defaultValues={...} onSubmit={handleUpdate}>`
- `handleUpdate`: `PUT /api/properties/${id}` com body `{ property, specifications, internal }`
- Toast de sucesso → redirect para detalhe

---

## FASE 6 — Integrações e Ajustes Finais

### 6.1 VERIFICAR `components/layout/app-sidebar.tsx`

O link "Imóveis" **já existe** na sidebar (linha 62–67 com `href: '/dashboard/imoveis'`, `permission: 'properties'`, `icon: Building2`). **Não é necessário modificar.**

---

### 6.2 VERIFICAR `lib/constants.ts`

Todas as constantes de propriedades **já existem**:
- `PROPERTY_STATUS` (linha 141)
- `PROPERTY_TYPES` (linha 267)
- `BUSINESS_TYPES` (linha 280)
- `PROPERTY_CONDITIONS` (linha 287)
- `ENERGY_CERTIFICATES` (linha 297)
- `CONTRACT_REGIMES` (linha 311)
- `SOLAR_ORIENTATIONS` (linha 476)
- `VIEWS` (linha 486)
- `EQUIPMENT` (linha 497)
- `FEATURES` (linha 511)
- `TYPOLOGIES` (verificar se existe, adicionar se faltar)
- `formatCurrency`, `formatDate`, `formatArea`

**Não é necessário modificar**, excepto se `TYPOLOGIES` não existir (verificar e adicionar se necessário).

---

## Resumo de Ficheiros

### Ficheiros a CRIAR (17)

| # | Ficheiro | Descrição |
|---|----------|-----------|
| 1 | `types/property.ts` | Types compostos (PropertyWithRelations, PropertyDetail) |
| 2 | `lib/r2/images.ts` | Upload/delete de imagens no R2 |
| 3 | `lib/crop-image.ts` | getCroppedImg() — canvas → WebP blob |
| 4 | `app/api/properties/route.ts` | GET (lista + filtros) + POST (criar) |
| 5 | `app/api/properties/[id]/route.ts` | GET (detalhe) + PUT (editar) + DELETE (soft delete) |
| 6 | `app/api/properties/[id]/media/route.ts` | GET (listar) + POST (upload imagem) |
| 7 | `app/api/properties/[id]/media/[mediaId]/route.ts` | PUT (set cover) + DELETE (eliminar) |
| 8 | `app/api/properties/[id]/media/reorder/route.ts` | PUT (reorder batch) |
| 9 | `hooks/use-properties.ts` | Hook de listagem com filtros |
| 10 | `hooks/use-property.ts` | Hook de detalhe individual |
| 11 | `hooks/use-property-media.ts` | Hook de gestão de media |
| 12 | `hooks/use-image-compress.ts` | Hook de compressão WebP |
| 13 | `components/properties/property-filters.tsx` | Barra de filtros |
| 14 | `components/properties/property-card.tsx` | Card para vista grid |
| 15 | `components/properties/property-image-cropper.tsx` | Dialog de crop |
| 16 | `components/properties/property-media-upload.tsx` | Upload com compress + preview |
| 17 | `components/properties/property-media-gallery.tsx` | Galeria drag-to-reorder |
| 18 | `components/properties/property-form.tsx` | Formulário reutilizável criar/editar |

### Ficheiros a MODIFICAR (2)

| # | Ficheiro | O que modificar |
|---|----------|-----------------|
| 1 | `lib/validations/property.ts` | Adicionar schemas de update (partial) e filtros |
| 2 | `app/dashboard/imoveis/page.tsx` | Substituir stub por listagem completa |

### Ficheiros a CRIAR (Páginas) (3)

| # | Ficheiro | Descrição |
|---|----------|-----------|
| 1 | `app/dashboard/imoveis/[id]/page.tsx` | Detalhe com 6 tabs |
| 2 | `app/dashboard/imoveis/novo/page.tsx` | Formulário de criação |
| 3 | `app/dashboard/imoveis/[id]/editar/page.tsx` | Formulário de edição |

### Ficheiros que NÃO precisam de modificação (verificados)

| Ficheiro | Razão |
|----------|-------|
| `components/layout/app-sidebar.tsx` | Link "Imóveis" já existe (linha 62–67) |
| `lib/constants.ts` | Todas as constantes de property já existem |
| `components/shared/status-badge.tsx` | Já suporta `type="property"` |
| `components/shared/empty-state.tsx` | Reutilizável sem modificação |
| `lib/r2/client.ts` | Singleton R2 — reutilizar |
| `lib/r2/documents.ts` | Reutilizar `sanitizeFileName()` |
| `components/properties/property-address-map-picker.tsx` | Componente completo — reutilizar no form |
| `components/ui/file-upload.tsx` | Componente base — reutilizar no media upload |

---

## Ordem de Implementação Recomendada

```
FASE 1 — Types, Validações, Infra (sem dependências entre si)
  1.1 types/property.ts
  1.2 lib/validations/property.ts (modificar)
  1.3 lib/r2/images.ts
  1.4 lib/crop-image.ts

FASE 2 — APIs (depende da FASE 1)
  2.1 app/api/properties/route.ts
  2.2 app/api/properties/[id]/route.ts
  2.3 app/api/properties/[id]/media/route.ts
  2.4 app/api/properties/[id]/media/[mediaId]/route.ts
  2.5 app/api/properties/[id]/media/reorder/route.ts

FASE 3 — Hooks (depende da FASE 2)
  3.1 hooks/use-properties.ts
  3.2 hooks/use-property.ts
  3.3 hooks/use-property-media.ts
  3.4 hooks/use-image-compress.ts

FASE 4 — Componentes (depende da FASE 3)
  4.1 components/properties/property-filters.tsx
  4.2 components/properties/property-card.tsx
  4.4 components/properties/property-image-cropper.tsx
  4.5 components/properties/property-media-upload.tsx
  4.6 components/properties/property-media-gallery.tsx
  4.7 components/properties/property-form.tsx

FASE 5 — Páginas (depende da FASE 4)
  5.1 app/dashboard/imoveis/page.tsx (substituir)
  5.2 app/dashboard/imoveis/[id]/page.tsx
  5.3 app/dashboard/imoveis/novo/page.tsx
  5.4 app/dashboard/imoveis/[id]/editar/page.tsx

FASE 6 — Verificações finais
  6.1 Sidebar (já OK)
  6.2 Constants (já OK)
  npm install das dependências
```
