# Estrutura de Conexão com Cloudflare R2

## Visão Geral

O sistema utiliza o Cloudflare R2 como storage de objectos para ficheiros (imagens de imóveis, fotos de utilizadores, documentos). A conexão suporta dois modos: **Cloudflare Bindings** (quando deployado no Workers/Pages) e **S3 API** (fallback para desenvolvimento local e outros ambientes).

## Configuração

### Variáveis de Ambiente (.env)

```env
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=public
R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev
R2_UPLOAD_PATH=imoveis-imagens
R2_DOCUMENTS_PATH=imoveis
```

### Runtime Config (nuxt.config.ts)

```typescript
runtimeConfig: {
  // Server-side (privado — nunca exposto ao cliente)
  r2AccountId: process.env.R2_ACCOUNT_ID,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  r2BucketName: process.env.R2_BUCKET_NAME,
  r2DocumentsPath: process.env.R2_DOCUMENTS_PATH || 'imoveis',
  r2UploadPath: process.env.R2_UPLOAD_PATH || 'public/imoveis-imagens',

  // Client-side (público)
  public: {
    r2PublicDomain: process.env.R2_PUBLIC_DOMAIN || '',
  },
}
```

## Padrão de Conexão S3

Todos os endpoints server-side usam o `@aws-sdk/client-s3` para comunicar com o R2 via API S3-compatible:

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const config = useRuntimeConfig()

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2AccountId}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  },
})
```

> **Nota:** Em operações de delete, adiciona-se `forcePathStyle: true` na configuração do S3Client.

## Dual Mode: Bindings vs S3

Alguns endpoints verificam primeiro a existência de Cloudflare Bindings antes de usar a API S3:

```typescript
// Verificar binding nativo do Cloudflare
const cloudflare = (event.context as any)?._platform?.cloudflare
  ?? (event.context as any)?.cloudflare
const r2Bucket = cloudflare?.env?.R2_BUCKET
  ?? cloudflare?.env?.BUCKET
  ?? cloudflare?.env?.MEDIA

if (r2Bucket) {
  // Usar API nativa R2 (mais rápido, sem credenciais)
  await r2Bucket.put(key, fileBuffer)
} else {
  // Fallback: usar S3 API com credenciais
  await S3.send(new PutObjectCommand({ ... }))
}
```

## Endpoints de Upload/Delete

### Upload Genérico

```
POST /api/r2/upload
```

Recebe multipart form data com campos:
- `file` — ficheiro a enviar
- `propertyId` (opcional) — ID do imóvel (path: `{r2UploadPath}/{propertyId}/{timestamp}-{filename}.webp`)
- `userId` (opcional) — ID do utilizador (path: `public/usuarios-fotos/{userId}/{timestamp}-{filename}.webp`)

**Fluxo:**
1. Receber ficheiro via `readMultipartFormData()`
2. Determinar path no R2 baseado nos parâmetros
3. Tentar binding nativo; se não disponível, usar S3 API
4. Retornar `{ success: true, url: "<public-path>" }`

### Upload de Documentos (Propriedade)

```
POST /api/properties/{id}/documents/upload
```

Recebe multipart form data com campos:
- `doc_type_id` — tipo de documento
- `file` — ficheiro a enviar

**Fluxo:**
1. Validar UUID do imóvel
2. Validar `doc_type_id` e extensão contra `doc_types.allowed_extensions`
3. Sanitizar nome do ficheiro
4. Upload para R2: `{r2DocumentsPath}/{propertyId}/{timestamp}-{sanitizedFilename}`
5. Registar em `doc_registry` com metadados (size, mimetype)
6. Retornar `{ success: true, id, url, file_name }`

### URL Pré-assinada

```
POST /api/r2/upload-url
```

Gera uma URL pré-assinada para upload directo do cliente ao R2 (sem passar pelo servidor):

```typescript
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const uploadUrl = await getSignedUrl(S3, new PutObjectCommand({
  Bucket: config.r2BucketName,
  Key: key,
  ContentType: contentType,
}), { expiresIn: 60 })  // 60 segundos
```

Retorna `{ uploadUrl, publicPath }`.

### Delete de Imagens (Propriedade)

```
DELETE /api/properties/{id}/media
```

**Fluxo:**
1. Buscar registo de media em `dev_property_media`
2. Extrair key do R2 a partir da URL
3. Apagar objecto no R2 (`DeleteObjectCommand` ou binding)
4. Remover registo da base de dados

### Delete de Foto (Utilizador)

```
DELETE /api/users/{id}/photo
```

**Fluxo:**
1. Buscar URL da foto no registo do utilizador
2. Extrair key do R2
3. Apagar objecto no R2
4. Limpar campos `profile_photo_url` e `profile_photo_crop` no `dev_users`

## Composables (Client-side)

### usePropertyUpload

```typescript
uploadImage(file: File | Blob, propertyId: string, options?)
```

1. Comprime a imagem (max 0.3MB, 1920px) e converte para WebP
2. Chama `POST /api/r2/upload` com `propertyId`
3. Cria registo em `dev_property_media` via `POST /api/properties/media`
4. Retorna objecto `PropertyMedia`

### useUserUpload

```typescript
uploadPhoto(file: File | Blob, userId: string, cropData?)
```

1. Comprime a imagem (max 0.2MB, 800px) e converte para WebP
2. Chama `POST /api/r2/upload` com `userId`
3. Actualiza `dev_users` com a URL da foto
4. Retorna URL da foto

## Organização de Paths no R2

```
bucket/
├── imoveis-imagens/           ← R2_UPLOAD_PATH (imagens de imóveis)
│   └── {property-uuid}/
│       ├── 1707123456789-foto-sala.webp
│       └── 1707123456790-foto-quarto.webp
├── imoveis/                   ← R2_DOCUMENTS_PATH (documentos)
│   └── {property-uuid}/
│       ├── 1707123456789-caderneta_predial.pdf
│       └── 1707123456790-escritura.pdf
└── public/
    └── usuarios-fotos/        ← fotos de utilizadores
        └── {user-uuid}/
            └── 1707123456789-perfil.webp
```

## URL Pública

O domínio público do R2 é configurado em `R2_PUBLIC_DOMAIN`. As URLs finais são construídas assim:

```typescript
const fileUrl = `${config.public.r2PublicDomain}/${key}`
// Exemplo: https://pub-xxx.r2.dev/imoveis/abc-123/1707123456789-escritura.pdf
```

## Dependências

```json
{
  "@aws-sdk/client-s3": "^3.986.0",
  "@aws-sdk/s3-request-presigner": "^3.989.0"
}
```
