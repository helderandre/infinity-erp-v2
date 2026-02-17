# CLAUDE.md — ERP Infinity (Imobiliária)

## 📊 Estado Actual do Projecto

**Última actualização:** 2026-02-17

### ✅ FASE 1 — Fundação (CONCLUÍDA)
- ✅ Estrutura de pastas completa
- ✅ Clientes Supabase (client, server, admin)
- ✅ Sistema de autenticação completo
- ✅ Layout do dashboard com sidebar inset
- ✅ Hooks (useUser, usePermissions, useDebounce)
- ✅ Constantes PT-PT + validações Zod
- ✅ Dashboard com KPIs básicos
- ✅ Componentes shadcn/ui (17 componentes)

**📄 Documentação detalhada:** [FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md)

### 🟠 FASE 2 — Módulos Core (PRÓXIMA)
- [ ] Módulo Imóveis completo
- [ ] Módulo Proprietários
- [ ] Módulo Documentos
- [ ] Dashboard completo (gráficos, actividade)

---

## Visão Geral do Projecto

ERP interno para a imobiliária **Infinity Group** (Portugal). Gestão completa de imóveis, consultores, equipas, leads, processos documentais, comissões, proprietários e comunicação. Toda a UI deve estar em **Português de Portugal** (PT-PT).

---

## Stack Tecnológica

| Camada       | Tecnologia                                                       |
| ------------ | ---------------------------------------------------------------- |
| Framework    | **Next.js 16** (App Router, Server Components, Route Handlers)   |
| Linguagem    | TypeScript (strict)                                              |
| UI           | **shadcn/ui** + Radix UI + Tailwind CSS v4 + Lucide React        |
| Animações    | **tw-animate-css** + CSS transitions + Framer Motion (se necessário) |
| Notificações | **Sonner** (toasts) — instalar: `sonner`                        |
| Diálogos     | **AlertDialog** (shadcn) para confirmações destrutivas           |
| Utilitários  | clsx, tailwind-merge, class-variance-authority (CVA)             |
| Backend/DB   | **Supabase** (PostgreSQL) — `@supabase/supabase-js`             |
| Storage      | **Cloudflare R2** via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| Mapas        | **Mapbox GL JS** + SearchBox API (autocomplete moradas PT)       |
| Auth         | Supabase Auth (email/password)                                   |
| Deploy       | Vercel ou Cloudflare Pages                                       |

### ✅ Dependências Instaladas (FASE 1)

Todas as dependências principais já foram instaladas:

```bash
# Já instalado ✅
@supabase/supabase-js @supabase/ssr
sonner framer-motion
@aws-sdk/client-s3 @aws-sdk/s3-request-presigner
date-fns zustand
react-hook-form @hookform/resolvers zod
mapbox-gl @types/mapbox-gl
class-variance-authority clsx tailwind-merge
```

**17 componentes shadcn/ui instalados** (sidebar, form, sonner, skeleton, avatar, etc.)

---

## Supabase — Configuração

**Project URL:** `https://umlndumjfamfsswwjgoo.supabase.co`

### Variáveis de Ambiente (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://umlndumjfamfsswwjgoo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Cloudflare R2
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=public
R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev
R2_UPLOAD_PATH=imoveis-imagens
R2_DOCUMENTS_PATH=imoveis

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

### Clientes Supabase (criar em `/lib/supabase/`)

- `client.ts` — cliente browser (createBrowserClient)
- `server.ts` — cliente server component (createServerClient com cookies)
- `admin.ts` — cliente service role para Route Handlers (sem RLS)

---

## Base de Dados — Schema Completo

### Tabelas de Utilizadores/Consultores

```
dev_users (utilizadores do ERP — ligada a auth.users)
├── id (UUID, PK, FK → auth.users.id)
├── role_id (UUID, FK → roles.id)
├── commercial_name (text)
├── professional_email (text, unique)
├── is_active (boolean, default true)
├── display_website (boolean, default false)
├── created_at (timestamptz)

dev_consultant_profiles (perfil público do consultor)
├── user_id (UUID, PK, FK → dev_users.id)
├── bio (text)
├── profile_photo_url (text)
├── specializations (text[])
├── languages (text[])
├── instagram_handle (text)
├── linkedin_url (text)
├── phone_commercial (text)

dev_consultant_private_data (dados privados — apenas ERP interno)
├── user_id (UUID, PK, FK → dev_users.id)
├── full_name (text)
├── nif (text)
├── iban (text)
├── address_private (text)
├── monthly_salary (numeric)
├── commission_rate (numeric)
├── hiring_date (date)
├── documents_json (jsonb: { id_card, contract })
```

### Tabelas de Roles/Permissões

```
roles
├── id (UUID, PK)
├── name (varchar, unique)
├── description (text)
├── permissions (jsonb — objeto com booleanos por módulo)
├── created_at, updated_at

Roles existentes:
- Broker/CEO (todas as permissões)
- Consultor
- Consultora Executiva
- Gestora Processual
- Marketing
- Office Manager
- team_leader
- recrutador
- intermediario_credito
- cliente

Módulos de permissão:
goals, store, users, buyers, credit, calendar, pipeline,
settings, dashboard, documents, financial, marketing,
properties, integration, recruitment
```

### Tabelas de Propriedades

```
dev_properties (imóvel principal)
├── id (UUID, PK)
├── slug (text, unique — gerado por trigger)
├── external_ref (text)
├── title (text, obrigatório)
├── description (text)
├── listing_price (numeric)
├── property_type (text)
├── business_type (text)
├── status (text, default 'pending_approval')
├── energy_certificate (text)
├── city (text)
├── zone (text)
├── consultant_id (UUID, FK → dev_users.id)
├── property_condition (text)
├── business_status (text)
├── contract_regime (text)
├── address_parish (text)
├── address_street (text)
├── postal_code (text)
├── latitude (float8)
├── longitude (float8)
├── created_at, updated_at

dev_property_specifications (1:1 com dev_properties)
├── property_id (UUID, PK, FK → dev_properties.id)
├── typology, bedrooms, bathrooms
├── area_gross, area_util (numeric)
├── construction_year (int)
├── parking_spaces, garage_spaces (int)
├── features (text[])
├── has_elevator (boolean)
├── fronts_count (int)
├── solar_orientation (text[])
├── views (text[])
├── equipment (text[])
├── storage_area, balcony_area, pool_area, attic_area, pantry_area, gym_area (numeric)

dev_property_internal (1:1, dados internos — não públicos)
├── property_id (UUID, PK, FK → dev_properties.id)
├── exact_address, postal_code (text)
├── internal_notes (text)
├── commission_agreed (numeric)
├── commission_type (text, default 'percentage')
├── contract_regime, contract_term (text)
├── contract_expiry (date)
├── imi_value, condominium_fee (numeric)
├── cpcv_percentage (numeric, default 0)
├── reference_internal (text)

dev_property_media (1:N)
├── id (UUID, PK)
├── property_id (UUID, FK → dev_properties.id)
├── url (text)
├── media_type (text, default 'image')
├── order_index (int, default 0)
├── is_cover (boolean, default false)
```

### Tabelas de Proprietários

```
owners
├── id (UUID, PK)
├── person_type (text: 'singular' | 'coletiva')
├── name (text, obrigatório)
├── email, phone, nif (unique), nationality, naturality
├── marital_status, address, observations
├── legal_representative_name, legal_representative_nif (para empresas)
├── company_cert_url (para empresas)
├── created_at, updated_at

property_owners (junction table M:N)
├── property_id (UUID, PK, FK → dev_properties.id)
├── owner_id (UUID, PK, FK → owners.id)
├── ownership_percentage (numeric, default 100)
├── is_main_contact (boolean, default false)

Regras:
- Mín. 1 proprietário por imóvel
- Exactamente 1 is_main_contact = true por imóvel
- Contacto principal deve ter email ou phone
- Reutilizar owner existente por NIF ou email antes de criar novo
```

### Tabelas de Documentos

```
doc_types (tipos de documento)
├── id (UUID, PK)
├── name (text, unique)
├── description, category (text)
├── allowed_extensions (text[], default: pdf, jpg, png, jpeg, doc, docx)
├── default_validity_months (int)
├── is_system (boolean, default false)

doc_registry (documentos efectivos)
├── id (UUID, PK)
├── property_id (UUID, FK → dev_properties.id)
├── doc_type_id (UUID, FK → doc_types.id)
├── file_url, file_name (text)
├── uploaded_by (UUID, FK → dev_users.id)
├── valid_until (timestamptz)
├── status (text, default 'active')
├── metadata (jsonb: { size, mimetype })
├── created_at
```

### Tabelas de Templates de Processo

```
tpl_processes (template)
├── id (UUID, PK)
├── name (text), description (text)
├── is_active (boolean, default true)
├── created_at

tpl_stages (fases do template)
├── id (UUID, PK)
├── tpl_process_id (UUID, FK → tpl_processes.id)
├── name (text), order_index (int)
├── created_at

tpl_tasks (tarefas do template)
├── id (UUID, PK)
├── tpl_stage_id (UUID, FK → tpl_stages.id)
├── title, description (text)
├── action_type (text: UPLOAD | EMAIL | GENERATE_DOC | MANUAL)
├── is_mandatory (boolean, default true)
├── dependency_task_id (UUID, FK → tpl_tasks.id, self-ref)
├── sla_days (int)
├── config (jsonb — depende do action_type)
├── order_index (int)

Bibliotecas auxiliares:
- tpl_email_library: id, name, subject, body_html, description
- tpl_doc_library: id, name, content_html, doc_type_id (FK → doc_types), description
```

### Tabelas de Instâncias de Processo

```
proc_instances (instância de um processo para um imóvel)
├── id (UUID, PK)
├── property_id (UUID, FK → dev_properties.id)
├── tpl_process_id (UUID, FK → tpl_processes.id)
├── external_ref (text, unique — gerado por trigger: PROC-YYYY-XXXX)
├── current_status (text, default 'draft')
├── current_stage_id (UUID, FK → tpl_stages.id)
├── percent_complete (int, default 0)
├── started_at, completed_at, updated_at

proc_tasks (tarefas instanciadas — preenchidas por trigger)
├── id (UUID, PK)
├── proc_instance_id (UUID, FK → proc_instances.id)
├── tpl_task_id (UUID, FK → tpl_tasks.id)
├── title (text, copiado do template)
├── status (text, default 'pending')
├── is_mandatory (boolean, default true)
├── is_bypassed (boolean, default false)
├── bypass_reason (text)
├── bypassed_by (UUID, FK → dev_users.id)
├── assigned_to (UUID, FK → dev_users.id)
├── due_date (timestamptz — calculado via sla_days)
├── completed_at (timestamptz)
├── task_result (jsonb)
├── stage_name (text, copiado do template)
├── stage_order_index (int, copiado do template)

Triggers no proc_instances:
- trg_populate_tasks → populate_process_tasks() — copia tarefas do template
- trg_generate_proc_ref → generate_proc_ref() — gera referência PROC-YYYY-XXXX
```

### Tabelas de Leads

```
leads
├── id (UUID, PK)
├── name (text), email, phone_primary, phone_secondary
├── language (text, default 'PT')
├── source (text: portal_idealista | portal_imovirtual | portal_casa_sapo | website | referral | walk_in | phone_call | social_media | other)
├── source_detail, source_message (text)
├── lead_type (text: unknown | buyer | seller | landlord | tenant | investor | buyer_seller | other)
├── status (text: new | contacted | qualified | archived | expired)
├── business_type (text: venda | arrendamento | trespasse | other)
├── priority (text: low | medium | high | urgent)
├── score (int, 0-100)
├── assigned_agent_id (UUID, FK → dev_users.id)
├── property_id (UUID, FK → dev_properties.id)
├── property_reference (text)
├── archived_reason (text: duplicate | no_response | not_interested | converted | spam | other)
├── expires_at, first_contacted_at, qualified_at, created_at_origin
├── created_at, updated_at

lead_activities (histórico de interacções)
├── id (UUID, PK)
├── lead_id (UUID, FK → leads.id)
├── agent_id (UUID, FK → dev_users.id)
├── activity_type (text: call | email | whatsapp | sms | visit | note | status_change | assignment | qualification)
├── description (text)
├── metadata (jsonb)
├── created_at
```

### Tabelas de Logs

```
log_audit (auditoria geral)
├── id, user_id (FK → dev_users), entity_type, entity_id
├── action, old_data (jsonb), new_data (jsonb), ip_address, created_at

log_emails (registo de emails enviados)
├── id, proc_task_id (FK → proc_tasks)
├── recipient_email, subject, sent_at, delivery_status, provider_id, metadata
```

### Tabelas Legacy (NÃO USAR — referência apenas)

```
users — tabela antiga, substituída por dev_users + dev_consultant_profiles + dev_consultant_private_data
property_listings — tabela antiga, substituída por dev_properties + dev_property_specifications + dev_property_internal
contact_form_submissions — formulário de contacto do website público
```

---

## Cloudflare R2 — Storage

### Estrutura de Paths

```
bucket/
├── imoveis-imagens/{property-uuid}/          ← imagens de imóveis (webp)
├── imoveis/{property-uuid}/                  ← documentos de imóveis (pdf, etc.)
└── public/usuarios-fotos/{user-uuid}/        ← fotos de perfil (webp)
```

### Padrão de Conexão (Route Handlers)

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
```

### Upload de Imagens — Fluxo

1. Cliente comprime imagem (max 0.3MB, 1920px) e converte para WebP
2. Envia via `POST /api/r2/upload` com `propertyId` ou `userId`
3. Servidor faz PutObjectCommand ao R2
4. Cria registo em `dev_property_media` ou actualiza `dev_consultant_profiles`
5. Retorna URL pública: `${R2_PUBLIC_DOMAIN}/${key}`

### Upload de Documentos — Fluxo

1. Validar `doc_type_id` e extensão contra `doc_types.allowed_extensions`
2. Sanitizar nome do ficheiro
3. Upload para R2: `imoveis/{propertyId}/{timestamp}-{sanitizedFilename}`
4. Registar em `doc_registry` com metadados (size, mimetype)

---

## Mapbox — Autocomplete de Moradas e Mapa Interactivo

### Visão Geral

O formulário de criação/edição de imóveis inclui um componente `<PropertyAddressMapPicker>` que combina:
1. **Autocomplete de moradas** portuguesas (Mapbox SearchBox Suggest API v1)
2. **Mapa interactivo** com marcador arrastável (mapbox-gl)
3. **Geocodificação inversa** ao arrastar marcador (Geocoding API v5)

### CSS Global Obrigatório

Importar o CSS do mapbox-gl no layout ou globals.css:
```typescript
// app/layout.tsx ou globals.css
import 'mapbox-gl/dist/mapbox-gl.css'
```

### Componente: PropertyAddressMapPicker

**Localização:** `components/properties/property-address-map-picker.tsx`

Este componente é **client-only** (usa APIs do browser e mapbox-gl).

#### Props

```typescript
interface AddressMapPickerProps {
  address?: string
  postalCode?: string
  city?: string
  zone?: string
  latitude?: number | null
  longitude?: number | null
  onAddressChange: (value: string) => void
  onPostalCodeChange: (value: string) => void
  onCityChange: (value: string) => void
  onZoneChange: (value: string) => void
  onLatitudeChange: (value: number | null) => void
  onLongitudeChange: (value: number | null) => void
}
```

#### Uso no Formulário

```tsx
<PropertyAddressMapPicker
  address={form.watch('address_street')}
  postalCode={form.watch('postal_code')}
  city={form.watch('city')}
  zone={form.watch('zone')}
  latitude={form.watch('latitude')}
  longitude={form.watch('longitude')}
  onAddressChange={(v) => form.setValue('address_street', v)}
  onPostalCodeChange={(v) => form.setValue('postal_code', v)}
  onCityChange={(v) => form.setValue('city', v)}
  onZoneChange={(v) => form.setValue('zone', v)}
  onLatitudeChange={(v) => form.setValue('latitude', v)}
  onLongitudeChange={(v) => form.setValue('longitude', v)}
/>
```

### Fluxo de Autocomplete

```
Utilizador digita "Rua da..."
  │
  ▼ (debounce 300ms, mín. 2 caracteres)
  GET https://api.mapbox.com/search/searchbox/v1/suggest
    ?q=Rua da...&access_token=...&language=pt&country=PT
    &session_token=<uuid>&proximity=<lng>,<lat>&limit=5
  │
  ▼ Popover abre com lista de sugestões (usar Popover + Command do shadcn)
  │
  ▼ Utilizador selecciona sugestão
  │
  GET https://api.mapbox.com/search/searchbox/v1/retrieve/{mapbox_id}
    ?access_token=...&session_token=<uuid>&language=pt
  │
  ▼ Preenche: address, postalCode, city, zone, latitude, longitude
  ▼ Move marcador no mapa + flyTo (zoom 16)
  ▼ Gera novo session_token (crypto.randomUUID())
```

### Session Tokens (Billing)

O Mapbox SearchBox API agrupa suggest + retrieve como uma "sessão" de billing:
- Gerar `crypto.randomUUID()` no início
- Reutilizar em todos os `suggest` até seleccionar uma sugestão
- Após o `retrieve`, gerar novo token

### Geocodificação Inversa (Marker Drag)

Quando o utilizador arrasta o marcador:

```
marker.on('dragend') → obter lngLat
  │
  GET https://api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json
    ?access_token=...&language=pt&limit=5
  │
  ▼ Extrair dos features:
    - address → place_name do tipo "address"
    - postalCode → context com id "postcode"
    - city → context com id "place" ou "locality"
    - zone → context com id "region" ou "district"
  │
  ▼ Emitir todos os campos actualizados
```

### Inicialização do Mapa (Client-Side Only)

```typescript
import mapboxgl from 'mapbox-gl'

// Dentro de useEffect:
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!

const map = new mapboxgl.Map({
  container: mapContainerRef.current!,
  style: 'mapbox://styles/mapbox/streets-v12',
  center: hasCoords ? [longitude, latitude] : [-9.15, 38.72], // default: Lisboa
  zoom: hasCoords ? 15 : 10,
})

const marker = new mapboxgl.Marker({ draggable: true })
  .setLngLat(hasCoords ? [longitude, latitude] : [-9.15, 38.72])
  .addTo(map)

marker.on('dragend', () => {
  const lngLat = marker.getLngLat()
  onLatitudeChange(lngLat.lat)
  onLongitudeChange(lngLat.lng)
  reverseGeocode(lngLat.lng, lngLat.lat)
})

// IMPORTANTE: cleanup no return do useEffect
return () => map.remove()
```

### Autocomplete UI — Padrão com shadcn Popover + Command

```tsx
<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
  <PopoverAnchor asChild>
    <Input
      value={query}
      onChange={(e) => onInput(e.target.value)}
      onFocus={() => suggestions.length > 0 && setPopoverOpen(true)}
      placeholder="Pesquisar morada..."
      autoComplete="off"
    />
  </PopoverAnchor>
  <PopoverContent
    className="w-[var(--radix-popover-trigger-width)] p-0"
    sideOffset={4}
    align="start"
    onOpenAutoFocus={(e) => e.preventDefault()}
  >
    <Command>
      <CommandList>
        <CommandEmpty>
          {isLoading ? 'A pesquisar...' : 'Sem resultados.'}
        </CommandEmpty>
        <CommandGroup>
          {suggestions.map((s) => (
            <CommandItem
              key={s.mapbox_id}
              value={s.full_address || s.name}
              onSelect={() => onSelectSuggestion(s)}
            >
              <MapPin className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{s.name}</span>
              {s.full_address && (
                <span className="ml-auto text-xs text-muted-foreground truncate">
                  {s.full_address}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

**Detalhes importantes:**
- `w-[var(--radix-popover-trigger-width)]` — dropdown com a mesma largura do input
- `onOpenAutoFocus={(e) => e.preventDefault()}` — evita roubar o foco do input
- `autoComplete="off"` no input — evita conflito com autocomplete do browser

### Campos Preenchidos no DB (dev_properties)

| Campo UI       | Coluna DB         | Origem Mapbox                   |
|----------------|-------------------|---------------------------------|
| Morada exata   | `address_street`  | Suggest/Retrieve full_address   |
| Código postal  | `postal_code`     | context.postcode.name           |
| Cidade         | `city`            | context.place.name              |
| Zona           | `zone`            | context.region.name             |
| Latitude       | `latitude`        | geometry.coordinates[1]         |
| Longitude      | `longitude`       | geometry.coordinates[0]         |

### APIs Mapbox Utilizadas

| API                  | Endpoint                                                          | Uso                        |
|----------------------|-------------------------------------------------------------------|----------------------------|
| SearchBox Suggest v1 | `api.mapbox.com/search/searchbox/v1/suggest`                      | Autocomplete em tempo real |
| SearchBox Retrieve v1| `api.mapbox.com/search/searchbox/v1/retrieve/{id}`                | Detalhes + coordenadas     |
| Geocoding v5         | `api.mapbox.com/geocoding/v5/mapbox.places/{lng},{lat}.json`      | Geocodificação inversa     |
| Map Tiles (GL JS)    | `mapbox://styles/mapbox/streets-v12`                              | Renderização do mapa       |

---

## Estrutura do Projecto (Next.js App Router)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    ← sidebar + topbar + proteção de rota
│   │   ├── page.tsx                      ← dashboard principal
│   │   ├── imoveis/
│   │   │   ├── page.tsx                  ← listagem com filtros
│   │   │   ├── novo/page.tsx             ← formulário criação (multi-step)
│   │   │   └── [id]/
│   │   │       ├── page.tsx              ← detalhe do imóvel (tabs)
│   │   │       └── editar/page.tsx
│   │   ├── consultores/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── leads/
│   │   │   ├── page.tsx                  ← kanban + lista
│   │   │   └── [id]/page.tsx
│   │   ├── processos/
│   │   │   ├── page.tsx                  ← instâncias activas
│   │   │   └── templates/page.tsx        ← gestão de templates
│   │   ├── documentos/page.tsx
│   │   ├── proprietarios/page.tsx
│   │   ├── equipas/page.tsx
│   │   ├── comissoes/page.tsx
│   │   ├── marketing/page.tsx
│   │   └── definicoes/page.tsx
│   ├── api/
│   │   ├── auth/[...supabase]/route.ts
│   │   ├── properties/
│   │   │   ├── route.ts                  ← GET (list), POST (create)
│   │   │   ├── [id]/route.ts             ← GET, PUT, DELETE
│   │   │   ├── [id]/documents/
│   │   │   │   └── upload/route.ts
│   │   │   └── media/route.ts
│   │   ├── consultants/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── leads/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── activities/route.ts
│   │   ├── processes/
│   │   │   ├── instantiate/route.ts
│   │   │   └── [id]/tasks/route.ts
│   │   ├── templates/route.ts
│   │   ├── owners/route.ts
│   │   ├── libraries/
│   │   │   ├── doc-types/route.ts
│   │   │   ├── emails/route.ts
│   │   │   └── docs/route.ts
│   │   └── r2/
│   │       ├── upload/route.ts
│   │       └── upload-url/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/                               ← shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── breadcrumbs.tsx
│   │   └── page-header.tsx
│   ├── properties/
│   │   ├── property-card.tsx
│   │   ├── property-form.tsx
│   │   ├── property-filters.tsx
│   │   ├── property-media-gallery.tsx
│   │   ├── property-address-map-picker.tsx   ← Mapbox autocomplete + mapa
│   │   └── property-status-badge.tsx
│   ├── consultants/
│   │   ├── consultant-card.tsx
│   │   └── consultant-form.tsx
│   ├── leads/
│   │   ├── lead-card.tsx
│   │   ├── lead-kanban.tsx
│   │   └── lead-activity-timeline.tsx
│   ├── processes/
│   │   ├── process-stepper.tsx
│   │   ├── task-card.tsx
│   │   └── template-builder.tsx
│   ├── documents/
│   │   ├── document-upload.tsx
│   │   └── document-list.tsx
│   ├── owners/
│   │   ├── owner-form.tsx
│   │   └── owner-search.tsx
│   └── shared/
│       ├── confirm-dialog.tsx            ← AlertDialog reutilizável
│       ├── status-badge.tsx              ← badge com cores por status
│       ├── data-table.tsx                ← tabela genérica com sort/filter
│       ├── empty-state.tsx
│       ├── loading-skeleton.tsx
│       ├── file-upload.tsx               ← drag-and-drop genérico
│       ├── search-input.tsx
│       └── stats-card.tsx
├── hooks/
│   ├── use-supabase.ts
│   ├── use-user.ts
│   ├── use-permissions.ts
│   ├── use-property-upload.ts
│   ├── use-confirm.ts                    ← hook para AlertDialog
│   └── use-debounce.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── r2/
│   │   └── client.ts
│   ├── utils.ts                          ← cn(), formatters
│   ├── constants.ts                      ← status maps, cores, labels PT-PT
│   └── validations/
│       ├── property.ts                   ← zod schemas
│       ├── lead.ts
│       └── owner.ts
├── types/
│   ├── database.ts                       ← types gerados do Supabase
│   ├── property.ts
│   ├── lead.ts
│   └── process.ts
└── stores/                               ← zustand stores
    ├── auth-store.ts
    └── ui-store.ts
```

---

## Padrões de UX/UI — OBRIGATÓRIOS

### 1. Idioma

Toda a interface DEVE estar em **Português de Portugal (PT-PT)**:
- "Imóveis" (não "Imóveis" com acento brasileiro)
- "Utilizador" (não "Usuário")
- "Telemóvel" (não "Celular")
- "Morada" (não "Endereço")
- Botões: "Guardar", "Cancelar", "Eliminar", "Voltar", "Criar", "Editar"
- Confirmar eliminação: "Tem a certeza de que pretende eliminar?"
- Sem dados: "Nenhum resultado encontrado"

### 2. Sistema de Cores para Status

```typescript
// lib/constants.ts
export const STATUS_COLORS = {
  // Propriedades
  pending_approval: { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', label: 'Pendente Aprovação' },
  active: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Activo' },
  sold: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Vendido' },
  rented: { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500', label: 'Arrendado' },
  suspended: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500', label: 'Suspenso' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Cancelado' },

  // Leads
  new: { bg: 'bg-sky-100', text: 'text-sky-800', dot: 'bg-sky-500', label: 'Novo' },
  contacted: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500', label: 'Contactado' },
  qualified: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Qualificado' },
  archived: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500', label: 'Arquivado' },
  expired: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500', label: 'Expirado' },

  // Tarefas de Processo
  pending: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-400', label: 'Pendente' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', label: 'Em Progresso' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Concluído' },
  skipped: { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Ignorado' },

  // Prioridade Leads
  low: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Baixa' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Média' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta' },
  urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgente' },

  // Documentos
  received: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Recebido' },
  validated: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Validado' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejeitado' },
} as const
```

### 3. Componentes de Feedback — Obrigatórios

**Sonner (Toasts) — para todas as acções:**
```typescript
import { toast } from 'sonner'

// Sucesso
toast.success('Imóvel criado com sucesso')

// Erro
toast.error('Erro ao guardar. Tente novamente.')

// Loading
const id = toast.loading('A guardar...')
// depois: toast.dismiss(id)

// Promessa (auto-resolve)
toast.promise(saveProperty(), {
  loading: 'A guardar imóvel...',
  success: 'Imóvel guardado com sucesso!',
  error: 'Erro ao guardar imóvel.',
})
```

**AlertDialog — para acções destrutivas:**
```typescript
// Padrão: usar componente <ConfirmDialog>
<ConfirmDialog
  open={open}
  onConfirm={handleDelete}
  title="Eliminar imóvel"
  description="Tem a certeza de que pretende eliminar este imóvel? Esta acção é irreversível."
  confirmLabel="Eliminar"
  variant="destructive"
/>
```

### 4. Animações e Estados

- **Skeleton loading** em todas as listagens e cards enquanto carrega dados
- **Fade-in** suave ao carregar conteúdo (opacity 0→1, translateY 4px→0)
- **Scale** subtil em hover de cards interactivos (scale-[1.01])
- **Transition** em todas as mudanças de estado (cores, visibilidade)
- **Spinner** nos botões durante submissão (desactivar botão + ícone Loader2 a rodar)
- **Empty states** ilustrados com ícone + mensagem + CTA quando não há dados
- **Progresso** visual em upload de ficheiros (progress bar)

```css
/* Padrão de animação para itens de lista */
.animate-in {
  animation: fadeInUp 0.3s ease-out forwards;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 5. Componentização — Regras

- **Máximo 150 linhas por componente de página** — extrair para sub-componentes
- Cada entidade tem pasta própria em `components/`
- Componentes partilhados em `components/shared/`
- Lógica de estado e fetch em **hooks customizados** (`hooks/`)
- Formulários com **react-hook-form** + **zod** para validação
- Tabelas com componente `<DataTable>` reutilizável (sort, filter, pagination)
- Cards com variantes via **CVA** (class-variance-authority)

### 6. Padrão de Route Handlers (API)

```typescript
// app/api/properties/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const { data, error } = await supabase
    .from('dev_properties')
    .select(`
      *,
      dev_property_specifications(*),
      dev_property_media(*),
      property_owners(
        is_main_contact,
        ownership_percentage,
        owners(name, phone, email)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### 7. Layout — Sidebar Navigation

Módulos do sidebar (respeitar permissões do role):
1. **Dashboard** — visão geral, KPIs
2. **Imóveis** — CRUD, filtros, galeria
3. **Leads** — kanban + lista, actividades
4. **Processos** — instâncias activas, stepper
5. **Documentos** — por imóvel, tipos
6. **Consultores** — perfil, dados privados
7. **Proprietários** — gestão, ligação a imóveis
8. **Equipas** — team leaders, membros
9. **Comissões** — cálculos, histórico
10. **Marketing** — campanhas
11. **Templates** — processos, emails, documentos
12. **Definições** — roles, tipos documento, geral

---

## Módulos — Checklist de Implementação

### ✅ M01 — Autenticação & Autorização (FASE 1 - CONCLUÍDA)
- [x] **BACK:** Middleware de autenticação Supabase (SSR) → `middleware.ts`
- [x] **BACK:** Route handler `/api/auth/callback` → callback handler
- [x] **BACK:** Clientes Supabase (client, server, admin) → `lib/supabase/`
- [x] **BACK:** Helper `checkPermission(module)` → `hooks/use-permissions.ts`
- [x] **FRONT:** Página de login com formulário (email + password) → `app/(auth)/login/page.tsx`
- [x] **FRONT:** Layout protegido `(dashboard)/layout.tsx` → com sidebar + breadcrumbs
- [x] **FRONT:** Hook `useUser()` com dados do utilizador + role + permissões
- [x] **FRONT:** Hook `usePermissions()` para condicionar UI
- [x] **FRONT:** Redirect automático via middleware

### 🟡 M02 — Dashboard (FASE 1 - PARCIAL | FASE 2 - COMPLETAR)
- [x] **BACK:** KPIs básicos agregados (total imóveis, leads, consultores)
- [x] **FRONT:** Cards de estatísticas com ícones
- [ ] **FRONT:** Gráficos (leads por mês, imóveis por status)
- [ ] **FRONT:** Actividade recente (últimos leads, tarefas pendentes reais)
- [x] **FRONT:** Skeleton loading completo

### M03 — Imóveis (Propriedades)
- [ ] **BACK:** `GET /api/properties` — listagem com filtros (status, tipo, cidade, preço)
- [ ] **BACK:** `POST /api/properties` — criação com owners, specs, internal
- [ ] **BACK:** `GET /api/properties/[id]` — detalhe com todas as relações
- [ ] **BACK:** `PUT /api/properties/[id]` — edição parcial
- [ ] **BACK:** `DELETE /api/properties/[id]` — soft delete (status → cancelled)
- [ ] **BACK:** `POST /api/properties/[id]/documents/upload` — upload com validação
- [ ] **BACK:** `POST /api/r2/upload` — upload genérico ao R2
- [ ] **BACK:** `DELETE /api/properties/[id]/media` — eliminar media
- [ ] **FRONT:** Listagem com cards ou tabela, filtros laterais, search
- [ ] **FRONT:** Formulário multi-step (dados gerais → specs → internos → proprietários → media)
- [ ] **FRONT:** Componente `<PropertyAddressMapPicker>` com autocomplete Mapbox + mapa interactivo + marcador arrastável
- [ ] **FRONT:** Geocodificação inversa ao arrastar marcador (preenche morada, código postal, cidade, zona)
- [ ] **FRONT:** Página de detalhe com tabs (Geral, Especificações, Documentos, Media, Processo)
- [ ] **FRONT:** Galeria de imagens com drag-to-reorder e marcação de capa
- [ ] **FRONT:** Upload drag-and-drop com preview e progress bar
- [ ] **FRONT:** Status badge com cores
- [ ] **FRONT:** Skeleton, empty states, confirmação de eliminação

### M04 — Proprietários
- [ ] **BACK:** `GET /api/owners` — listagem com imóveis associados
- [ ] **BACK:** `POST /api/owners` — criar (com verificação NIF/email existente)
- [ ] **BACK:** `PUT /api/owners/[id]` — editar
- [ ] **FRONT:** Listagem com search por nome/NIF
- [ ] **FRONT:** Formulário com toggle singular/colectiva (campos condicionais)
- [ ] **FRONT:** Detalhe com imóveis associados
- [ ] **FRONT:** Componente `<OwnerSearch>` reutilizável (autocomplete) para formulário de imóvel

### M05 — Leads
- [ ] **BACK:** `GET /api/leads` — listagem com filtros (status, source, priority, agent)
- [ ] **BACK:** `POST /api/leads` — criar lead
- [ ] **BACK:** `PUT /api/leads/[id]` — actualizar (status, assignment, etc.)
- [ ] **BACK:** `POST /api/leads/[id]/activities` — registar actividade
- [ ] **BACK:** `GET /api/leads/[id]/activities` — histórico
- [ ] **FRONT:** Vista Kanban (colunas por status) com drag-and-drop
- [ ] **FRONT:** Vista Lista/Tabela alternativa
- [ ] **FRONT:** Toggle entre vistas
- [ ] **FRONT:** Card de lead com prioridade (cor), source, agente atribuído
- [ ] **FRONT:** Detalhe com timeline de actividades
- [ ] **FRONT:** Formulário de nova actividade (call, email, whatsapp, nota)
- [ ] **FRONT:** Score visual (barra/círculo de 0-100)

### M06 — Processos (Instâncias)
- [ ] **BACK:** `POST /api/processes/instantiate` — instanciar template para imóvel
- [ ] **BACK:** `GET /api/processes` — listar instâncias activas
- [ ] **BACK:** `GET /api/processes/[id]` — detalhe com tarefas
- [ ] **BACK:** `PUT /api/processes/[id]/tasks/[taskId]` — actualizar status de tarefa
- [ ] **BACK:** Lógica de bypass de tarefa (is_bypassed, bypass_reason, bypassed_by)
- [ ] **BACK:** Cálculo de `percent_complete` e avanço de `current_stage_id`
- [ ] **FRONT:** Stepper visual por fases (progress horizontal)
- [ ] **FRONT:** Lista de tarefas por fase com status e acções
- [ ] **FRONT:** Acções por tipo: UPLOAD → file picker, EMAIL → preview/enviar, MANUAL → marcar concluído
- [ ] **FRONT:** Dialog de bypass com motivo obrigatório
- [ ] **FRONT:** Barra de progresso geral
- [ ] **FRONT:** Referência PROC-YYYY-XXXX visível

### M07 — Templates de Processo
- [ ] **BACK:** `GET /api/templates` — listar templates activos
- [ ] **BACK:** `POST /api/templates` — criar template com fases e tarefas
- [ ] **BACK:** `PUT /api/templates/[id]` — editar
- [ ] **BACK:** `DELETE /api/templates/[id]` — desactivar (is_active = false)
- [ ] **FRONT:** Template builder visual (arrastar fases e tarefas)
- [ ] **FRONT:** Configuração de tarefa por action_type (selector de doc_type, email template, etc.)
- [ ] **FRONT:** Preview do template antes de guardar
- [ ] **FRONT:** Listagem de templates com badge activo/inactivo

### M08 — Documentos
- [ ] **BACK:** `GET /api/libraries/doc-types` — tipos de documento
- [ ] **BACK:** `POST /api/libraries/doc-types` — criar tipo
- [ ] **BACK:** `GET /api/properties/[id]/documents` — documentos do imóvel
- [ ] **FRONT:** Listagem de documentos por imóvel com status (recebido, validado, rejeitado)
- [ ] **FRONT:** Upload com validação de extensão no frontend
- [ ] **FRONT:** Preview de PDF inline
- [ ] **FRONT:** Gestão de tipos de documento (admin)

### M09 — Consultores
- [ ] **BACK:** `GET /api/consultants` — listar (profile + user data)
- [ ] **BACK:** `POST /api/consultants` — criar (dev_users + profiles + private_data)
- [ ] **BACK:** `PUT /api/consultants/[id]` — editar
- [ ] **BACK:** Upload de foto de perfil ao R2
- [ ] **FRONT:** Listagem em grid de cards com foto, nome, especialização
- [ ] **FRONT:** Detalhe com tabs (Perfil Público, Dados Privados, Imóveis, Comissões)
- [ ] **FRONT:** Formulário de edição com secções colapsáveis
- [ ] **FRONT:** Toggle `display_website` e `is_active`

### M10 — Equipas
- [ ] **BACK:** Estrutura de equipas (team_leader → membros via role/department)
- [ ] **FRONT:** Organograma visual ou listagem agrupada
- [ ] **FRONT:** Gestão de membros

### M11 — Comissões
- [ ] **BACK:** Cálculo baseado em `dev_property_internal.commission_agreed` + `dev_consultant_private_data.commission_rate`
- [ ] **BACK:** Endpoint de resumo por consultor
- [ ] **FRONT:** Tabela com imóveis vendidos/arrendados e valor de comissão
- [ ] **FRONT:** Filtros por período, consultor, status

### M12 — Marketing
- [ ] **BACK:** Estrutura de campanhas (a definir)
- [ ] **FRONT:** Gestão de campanhas
- [ ] **FRONT:** Integração com portais (idealista, imovirtual, casa sapo)

### M13 — Bibliotecas (Templates Email + Documentos)
- [ ] **BACK:** `GET/POST /api/libraries/emails` — CRUD email templates
- [ ] **BACK:** `GET/POST /api/libraries/docs` — CRUD doc templates
- [ ] **FRONT:** Editor de email com variáveis ({{proprietario_nome}}, {{imovel_ref}})
- [ ] **FRONT:** Editor de documentos com variáveis
- [ ] **FRONT:** Preview com dados de exemplo

### M14 — Definições
- [ ] **BACK:** `GET/PUT /api/settings/roles` — gestão de roles e permissões
- [ ] **FRONT:** Gestão de roles com matrix de permissões
- [ ] **FRONT:** Configurações gerais do sistema

---

## Regras de Desenvolvimento

### API Route Handlers

1. Sempre usar Supabase server client (com cookies para auth)
2. Validar input com Zod antes de queries
3. Retornar erros com status codes correctos (400, 401, 403, 404, 500)
4. Usar service role apenas quando necessário (bypass RLS)
5. Incluir `try/catch` em todos os handlers
6. Log de auditoria para acções importantes (insert em `log_audit`)

### Frontend

1. **Server Components por defeito** — usar `'use client'` apenas quando necessário (interactividade)
2. **Loading states** — sempre Skeleton ou Spinner durante fetch
3. **Error boundaries** — tratar erros graciosamente
4. **Optimistic updates** — onde fizer sentido (toggle status, etc.)
5. **Debounce** em campos de search (300ms)
6. **Pagination** — cursor-based ou offset em listagens grandes
7. **Responsive** — mobile-first, sidebar colapsável em mobile
8. **Acessibilidade** — labels em inputs, aria-labels, keyboard navigation

### Naming Conventions

- Ficheiros: `kebab-case` (property-card.tsx)
- Componentes: `PascalCase` (PropertyCard)
- Hooks: `camelCase` com prefixo `use` (usePropertyUpload)
- API routes: `kebab-case` em paths
- Constantes: `UPPER_SNAKE_CASE`
- Types/Interfaces: `PascalCase` (PropertyFormData)

---

## MCP Servers Disponíveis

O Claude Code deve utilizar estes MCP servers quando relevante:

### Supabase MCP
- Executar SQL directamente no banco
- Listar tabelas e schema
- Aplicar migrações
- Gerar TypeScript types
- Ver logs e advisors

### Comandos Úteis
```bash
# Gerar types do Supabase
npx supabase gen types typescript --project-id umlndumjfamfsswwjgoo > src/types/database.ts
```

---

## Notas Importantes

1. **NÃO usar tabelas `users` e `property_listings`** — são legacy. Usar `dev_users`, `dev_properties`, etc.
2. **Triggers existentes** — não recriar: `trg_populate_tasks`, `trg_generate_proc_ref`, `trg_generate_dev_property_slug`
3. **R2 upload** — imagens sempre convertidas para WebP antes do upload
4. **Reutilização de owners** — sempre verificar NIF/email antes de criar novo
5. **Permissões** — respeitar `roles.permissions` para esconder/mostrar módulos
6. **58 propriedades existentes** em `dev_properties`, **292 media** em `dev_property_media`, **10 leads**, **4 owners**
7. **Todas as labels, mensagens e textos da UI em PT-PT**

---

## 📚 Documentação e Recursos

### Documentação Criada
- **[FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md)** — Documentação completa da Fase 1
  - O que foi implementado
  - Como funciona cada componente
  - Fluxos de autenticação
  - Guia de teste
  - Próximos passos

### Ficheiros Chave Criados (FASE 1)

**Autenticação:**
- `lib/supabase/client.ts` — Cliente browser
- `lib/supabase/server.ts` — Cliente server components
- `lib/supabase/admin.ts` — Cliente service role
- `middleware.ts` — Protecção de rotas
- `app/api/auth/callback/route.ts` — Callback handler

**Hooks:**
- `hooks/use-user.ts` — Dados do utilizador autenticado
- `hooks/use-permissions.ts` — Verificação de permissões
- `hooks/use-debounce.ts` — Debounce para search

**Layout:**
- `components/layout/app-sidebar.tsx` — Sidebar variant="inset"
- `components/layout/breadcrumbs.tsx` — Breadcrumbs dinâmicos PT-PT
- `app/(dashboard)/layout.tsx` — Layout do dashboard
- `app/(dashboard)/page.tsx` — Dashboard principal

**Configuração:**
- `lib/constants.ts` — STATUS_COLORS + labels PT-PT + formatadores
- `lib/validations/` — Schemas Zod (property, lead, owner)
- `types/database.ts` — Types do Supabase (auto-gerado)

**Total:** 30+ ficheiros criados | 17 componentes shadcn instalados

---

## 🚀 Como Começar (Para Novos Desenvolvedores)

### 1. Iniciar Servidor de Desenvolvimento
```bash
npm run dev
```
Abrir: http://localhost:3000

### 2. Login de Teste
Criar utilizador no Supabase Dashboard (Authentication → Users) e adicionar registo em `dev_users`.

### 3. Testar Funcionalidades
- ✅ Login/Logout
- ✅ Dashboard com KPIs
- ✅ Sidebar navegação
- ✅ Breadcrumbs
- ✅ Sistema de permissões

### 4. Próximos Passos
Consultar [FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md) para roadmap da **FASE 2 — Módulos Core**.
