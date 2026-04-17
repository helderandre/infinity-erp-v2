# CLAUDE.md — ERP Infinity (Imobiliária)

## 📊 Estado Actual do Projecto

**Última actualização:** 2026-04-16

### ✅ Contact Automations (ENTREGUE via `add-contact-automations` + `add-fixed-contact-automations`)
- Tab "Automatismos" em `app/dashboard/leads/[id]/page.tsx`: secção **Eventos fixos** (aniversário/Natal/Ano Novo — implícitos) + wizard manual para `aniversario_fecho` e `festividade`.
- Tabelas: `contact_automations`, `contact_automation_runs`, `auto_scheduler_log`, `contact_automation_lead_settings`, `contact_automation_mutes`.
- Endpoint cron `POST /api/automacao/scheduler/spawn-runs` corre duas fases: **A (manual)** contra `contact_automations` e **B (virtual)** contra `leads × {3 eventos fixos}` com cascata de templates e gating por canal. Feature flag `AUTOMACAO_VIRTUAL_SPAWNER_ENABLED=false` desliga só B.
- Flow sentinela `00000000-0000-0000-0000-00000c0a0a17` em `auto_flows` reservado para runs efémeros; `auto_step_runs.node_data_snapshot` permite runs sem `published_definition`.
- Cascata de templates em 3 camadas (lead → consultor → global) via colunas `scope`/`scope_id`/`is_system` em `tpl_email_library` e `auto_wpp_templates`. Templates `is_system=true` protegidos contra delete.
- Mutes combinatórios `(consultant_id, lead_id, event_type, channel)` — null = "todos". Predicado null-as-wildcard em [`lib/automacao/is-muted.ts`](lib/automacao/is-muted.ts).
- Hub CRM em `/dashboard/crm/automatismos-contactos` com 4 tabs: Agendados, Runs falhados, Os meus templates, Mutes globais.
- APIs retry/reschedule individuais e em lote (max 100) em `/api/automacao/runs/[id]/retry|reschedule` + `/retry-batch|reschedule-batch`.
- Biblioteca partilhada em [`lib/automacao/`](lib/automacao/): `resolve-template-for-lead`, `resolve-account-for-lead`, `is-muted`, `next-fixed-occurrence`, `spawn-retry`.

**📄 Especificações:**
- [SPEC-FIXED-CONTACT-AUTOMATIONS.md](docs/M10-AUTOMACOES/SPEC-FIXED-CONTACT-AUTOMATIONS.md) — pista virtual + cascata + hub CRM
- [SPEC-CONTACT-AUTOMATIONS.md](docs/M10-AUTOMACOES/SPEC-CONTACT-AUTOMATIONS.md) — pista manual legada



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

### 🟡 FASE 5 — Leads (PARCIAL)
- ✅ CRUD completo de Leads (listagem com filtros, criação, detalhe com 6 tabs)
- ✅ CRUD completo de Negócios (formulário dinâmico por tipo, 5 tabs)
- ✅ APIs de IA: chat GPT-4o, fill-from-text, transcribe (Whisper), analyze-document, summary
- ✅ APIs utilitárias: código postal (geoapi.pt), NIPC (nif.pt)
- ✅ Componentes: lead-filters, lead-form, document-analyzer
- ✅ Componentes: negocio-form, negocio-chat, negocio-matches, negocio-interessados, negocio-summary, quick-fill
- ✅ Types, validações Zod e constantes PT-PT para leads e negócios
- ✅ Dependência `openai` instalada para APIs de IA
- ❌ API de actividades (registar + histórico)
- ❌ Vista Kanban com drag-and-drop + toggle Kanban/Lista
- ❌ Timeline de actividades no detalhe do lead
- ❌ Score visual (0-100)

**📄 Especificação:** [SPEC-M05-LEADS.md](docs/FASE%2005%20-%20LEADES/SPEC-M05-LEADS.md)

### ✅ FASE 3 — Imóveis (CONCLUÍDA)
- ✅ CRUD completo de Imóveis (listagem com filtros, criação, detalhe com 6 tabs, edição)
- ✅ API Routes: GET/POST /api/properties, GET/PUT/DELETE /api/properties/[id]
- ✅ API Media: POST/GET /api/properties/[id]/media, PUT/DELETE /api/properties/[id]/media/[mediaId], PUT reorder
- ✅ Hooks: useProperties, useProperty, usePropertyMedia, useImageCompress
- ✅ Componentes: property-filters, property-card, property-form, property-image-cropper, property-media-upload, property-media-gallery
- ✅ Páginas: listagem (tabela/grid), detalhe (6 tabs), criação, edição
- ✅ Upload de imagens com compressão WebP, crop (16:9, 1:1, livre), drag-to-reorder, marcação de capa
- ✅ Mapa Mapbox interactivo na página de detalhe
- ✅ Status badge com cores para todos os estados (including `available`)
- ✅ Dependências: browser-image-compression, react-easy-crop, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

**📄 Especificação:** [SPEC-M03-IMOVEIS.md](docs/FASE%2003%20-%20IMÓVEIS/SPEC-M03-IMOVEIS.md)

### 🟠 FASE 2 — Módulos Core (PRÓXIMA)
- [x] Módulo Imóveis completo
- [ ] Módulo Proprietários
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
openai                          # ← adicionado na FASE 5 (APIs de IA)
```

**34 componentes shadcn/ui instalados** (sidebar, form, sonner, skeleton, avatar, table, tabs, badge, dialog, select, etc.)

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
│   │   │   ├── route.ts                  ← GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       ├── route.ts              ← GET (detail)
│   │   │       ├── approve/route.ts      ← POST (aprovar com template)
│   │   │       ├── reject/route.ts       ← POST (rejeitar)
│   │   │       ├── return/route.ts       ← POST (devolver)
│   │   │       └── hold/route.ts         ← POST (pausar/reactivar)
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

### ✅ M03 — Imóveis (Propriedades) (CONCLUÍDA)
- [x] **BACK:** `GET /api/properties` — listagem com filtros (status, tipo, cidade, preço, consultor, search) + paginação
- [x] **BACK:** `POST /api/properties` — criação com specs e internal
- [x] **BACK:** `GET /api/properties/[id]` — detalhe com todas as relações (specs, internal, media, owners, consultant)
- [x] **BACK:** `PUT /api/properties/[id]` — edição parcial com upsert de specs/internal
- [x] **BACK:** `DELETE /api/properties/[id]` — soft delete (status → cancelled)
- [x] **BACK:** `POST /api/properties/[id]/media` — upload de imagens ao R2 com is_cover e order_index
- [x] **BACK:** `PUT /api/properties/[id]/media/[mediaId]` — definir capa
- [x] **BACK:** `DELETE /api/properties/[id]/media/[mediaId]` — eliminar media (R2 + DB)
- [x] **BACK:** `PUT /api/properties/[id]/media/reorder` — reordenar imagens
- [x] **FRONT:** Listagem com tabela/grid toggle, filtros (PropertyFilters), search, paginação
- [x] **FRONT:** Formulário completo (PropertyForm) com 4 secções: Dados Gerais, Localização (Mapbox), Especificações, Dados Internos
- [x] **FRONT:** Componente `<PropertyAddressMapPicker>` com autocomplete Mapbox + mapa interactivo + marcador arrastável
- [x] **FRONT:** Geocodificação inversa ao arrastar marcador (preenche morada, código postal, cidade, zona)
- [x] **FRONT:** Página de detalhe com 6 tabs controladas (Geral, Especificações, Media, Documentos, Proprietários, Processo)
- [x] **FRONT:** Galeria de imagens com drag-to-reorder (@dnd-kit) e marcação de capa
- [x] **FRONT:** Upload com preview, crop (16:9, 1:1, livre), compressão WebP e progress bar
- [x] **FRONT:** Status badge com cores para todos os estados (incluindo `available`)
- [x] **FRONT:** Skeleton, empty states, confirmação de eliminação (AlertDialog)
- [x] **FRONT:** Hooks: useProperties, useProperty, usePropertyMedia, useImageCompress

### M04 — Proprietários
- [ ] **BACK:** `GET /api/owners` — listagem com imóveis associados
- [ ] **BACK:** `POST /api/owners` — criar (com verificação NIF/email existente)
- [ ] **BACK:** `PUT /api/owners/[id]` — editar
- [ ] **FRONT:** Listagem com search por nome/NIF
- [ ] **FRONT:** Formulário com toggle singular/colectiva (campos condicionais)
- [ ] **FRONT:** Detalhe com imóveis associados
- [ ] **FRONT:** Componente `<OwnerSearch>` reutilizável (autocomplete) para formulário de imóvel

### 🟡 M05 — Leads (PARCIAL)

**✅ Implementado:**
- [x] **BACK:** `GET /api/leads` — listagem com filtros (estado, temperatura, origem, agent_id, nome) + paginação
- [x] **BACK:** `POST /api/leads` — criar lead com validação Zod
- [x] **BACK:** `GET/PUT/DELETE /api/leads/[id]` — detalhe, actualização e eliminação
- [x] **BACK:** `GET/POST /api/leads/[id]/attachments` — gestão de anexos
- [x] **BACK:** `DELETE /api/leads/attachments/[attachmentId]` — eliminar anexo
- [x] **BACK:** `POST /api/leads/[id]/analyze-document` — análise OCR com GPT-4o-mini
- [x] **BACK:** `GET/POST /api/negocios` — CRUD de negócios com filtros
- [x] **BACK:** `GET/PUT/DELETE /api/negocios/[id]` — detalhe, actualização e eliminação
- [x] **BACK:** `GET /api/negocios/[id]/matches` — matching de propriedades com flags de preço
- [x] **BACK:** `GET /api/negocios/[id]/interessados` — compradores interessados
- [x] **BACK:** `POST /api/negocios/[id]/chat` — assistente IA com GPT-4o
- [x] **BACK:** `POST /api/negocios/[id]/fill-from-text` — extracção de dados de texto
- [x] **BACK:** `POST /api/negocios/[id]/transcribe` — transcrição áudio com Whisper
- [x] **BACK:** `GET /api/negocios/[id]/summary` — resumo IA do negócio
- [x] **BACK:** `GET /api/postal-code/[cp]` — lookup código postal (geoapi.pt)
- [x] **BACK:** `GET /api/nipc/[nipc]` — lookup empresa por NIPC (nif.pt)
- [x] **FRONT:** Listagem de leads com tabela, filtros, paginação e confirmação de eliminação
- [x] **FRONT:** Formulário de criação de lead (nome, email, telemóvel, origem, consultor)
- [x] **FRONT:** Detalhe de lead com 6 tabs (Dados Pessoais, Identificação, Morada, Empresa, Negócios, Anexos)
- [x] **FRONT:** Detalhe de negócio com 5 tabs (Detalhes, Assistente IA, Preenchimento Rápido, Matching, Interessados)
- [x] **FRONT:** Formulário dinâmico de negócio por tipo (Compra/Venda/Arrendatário/Arrendador)
- [x] **FRONT:** Componentes IA: chat, quick-fill (texto + áudio), document-analyzer, summary

**❌ Por implementar:**
- [ ] **BACK:** `POST /api/leads/[id]/activities` — registar actividade (call, email, whatsapp, sms, visit, note)
- [ ] **BACK:** `GET /api/leads/[id]/activities` — histórico de actividades do lead
- [ ] **FRONT:** Vista Kanban (colunas por status) com drag-and-drop
- [ ] **FRONT:** Toggle entre vistas (Kanban / Lista)
- [ ] **FRONT:** Card de lead para Kanban com prioridade (cor), source, agente atribuído
- [ ] **FRONT:** Timeline de actividades no detalhe do lead
- [ ] **FRONT:** Formulário de nova actividade (call, email, whatsapp, nota, visita)
- [ ] **FRONT:** Score visual (barra/círculo de 0-100) no detalhe do lead

**📄 Especificação:** [SPEC-M05-LEADS.md](docs/FASE%2005%20-%20LEADES/SPEC-M05-LEADS.md)

**Nota sobre Leads:**
- Tabelas: `leads`, `negocios`, `lead_attachments` (nomes PT no schema)
- APIs de IA requerem `OPENAI_API_KEY` e `NIF_PT_API_KEY` no `.env.local`
- Negócios têm formulário dinâmico: campos mudam conforme o tipo (Compra, Venda, Arrendatário, Arrendador)
- Matching de propriedades compara tipo_imovel, localização, preço e quartos contra `dev_properties`

### ✅ M06 — Processos (Instâncias) (CONCLUÍDA)
- [x] **BACK:** `POST /api/processes` — criar instância de processo (via acquisitions)
- [x] **BACK:** `GET /api/processes` — listar instâncias activas
- [x] **BACK:** `GET /api/processes/[id]` — detalhe com tarefas, owners, documentos
- [x] **BACK:** `POST /api/processes/[id]/approve` — aprovar com selecção de template
- [x] **BACK:** `POST /api/processes/[id]/reject` — rejeitar com motivo
- [x] **BACK:** `POST /api/processes/[id]/return` — devolver com motivo
- [x] **BACK:** `POST /api/processes/[id]/hold` — pausar/reactivar processo
- [x] **BACK:** `PUT /api/processes/[id]/tasks/[taskId]` — actualizar status de tarefa
- [x] **BACK:** Lógica de bypass de tarefa (is_bypassed, bypass_reason, bypassed_by)
- [x] **BACK:** Cálculo de `percent_complete` e avanço de `current_stage_id`
- [x] **BACK:** `autoCompleteTasks()` — completar tarefas UPLOAD com docs existentes
- [x] **BACK:** `recalculateProgress()` — recalcular percentagem e fase actual
- [x] **FRONT:** Stepper visual por fases (progress horizontal)
- [x] **FRONT:** Lista de tarefas por fase com status e acções
- [x] **FRONT:** Acções por tipo: UPLOAD → file picker, EMAIL → preview/enviar, MANUAL → marcar concluído
- [x] **FRONT:** Dialog de bypass com motivo obrigatório
- [x] **FRONT:** Barra de progresso geral
- [x] **FRONT:** Referência PROC-YYYY-XXXX visível
- [x] **FRONT:** Selecção de template na aprovação (Select com templates activos)
- [x] **FRONT:** Atribuição de tarefas a consultores
- [x] **FRONT:** Pausa/reactivação de processos

**📄 Documentação:** [FASE 06 - PROCESSOS/](docs/FASE%2006%20-%20PROCESSOS/)
- [SPEC-M06-PROCESSOS.md](docs/FASE%2006%20-%20PROCESSOS/SPEC-M06-PROCESSOS.md)
- [SPEC-SELECCAO-TEMPLATE-APROVACAO.md](docs/FASE%2006%20-%20PROCESSOS/SPEC-SELECCAO-TEMPLATE-APROVACAO.md)

**Nota importante sobre APIs de processo:**
- Todas as acções de estado (approve, reject, return, hold) usam **POST** (não PUT)
- A aprovação requer `tpl_process_id` no body — o template é seleccionado pelo aprovador
- A criação de angariação (`POST /api/acquisitions`) cria `proc_instances` **sem template** (`tpl_process_id = null`)
- As tarefas são populadas apenas após aprovação (via `populate_process_tasks()`)
- Validação de UUID usa regex (não `z.uuid()`) para aceitar IDs com bits de versão zero

### ✅ M07 — Templates de Processo (CONCLUÍDA) `docs/FASE 07 TEMPLATES DE PROCESSOS`
- [x] **BACK:** `GET /api/templates` — listar templates activos
- [x] **BACK:** `POST /api/templates` — criar template com fases e tarefas
- [x] **BACK:** `PUT /api/templates/[id]` — editar
- [x] **BACK:** `DELETE /api/templates/[id]` — desactivar (is_active = false)
- [x] **FRONT:** Template builder visual (arrastar fases e tarefas)
- [x] **FRONT:** Configuração de tarefa por action_type (selector de doc_type, email template, etc.)
- [x] **FRONT:** Preview do template antes de guardar
- [x] **FRONT:** Listagem de templates com badge activo/inactivo

### M08 — Documentos
- [x] **BACK:** `GET /api/libraries/doc-types` — tipos de documento
- [x] **BACK:** `POST /api/libraries/doc-types` — criar tipo
- [x] **BACK:** `GET /api/properties/[id]/documents` — documentos do imóvel
- [x] **FRONT:** Listagem de documentos por imóvel com status (recebido, validado, rejeitado)
- [x] **FRONT:** Upload com validação de extensão no frontend
- [x] **FRONT:** Preview de PDF inline
- [x] **FRONT:** Gestão de tipos de documento (admin)

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
8. **Rotas duplicadas** — existem páginas em `app/dashboard/` (pasta real, URL `/dashboard/...`) e `app/(dashboard)/` (route group). As páginas activas são as de `app/dashboard/`. Editar sempre os ficheiros em `app/dashboard/`.
9. **APIs de processo usam POST** — approve, reject, return, hold usam método POST (não PUT). Usar `z.string().regex()` para validar UUIDs (não `z.uuid()` que rejeita IDs com bits de versão zero).
10. **Fluxo de aprovação de processos** — A angariação cria `proc_instances` sem template (`tpl_process_id = null`). O aprovador selecciona o template na UI e envia-o via `POST /api/processes/[id]/approve`. Só após aprovação é que as tarefas são populadas.
11. **Tabelas de leads usam nomes PT** — `leads` (nome, telemovel, estado, temperatura, origem), `negocios` (tipo, estado, localizacao, orcamento, preco_venda), `lead_attachments`
12. **APIs de IA requerem chaves** — `OPENAI_API_KEY` para chat/fill-from-text/transcribe/summary/analyze-document, `NIF_PT_API_KEY` para lookup de NIPC
13. **Negócios têm formulário dinâmico** — Os campos mudam conforme o tipo (Compra, Venda, Arrendatário, Arrendador, Compra e Venda). Tipo "Compra e Venda" mostra campos duplicados com sufixo `_venda`
14. **Biblioteca de documentos partilhada** — Grelha de pastas 3D + selecção múltipla + batch ZIP + viewer inline vive em `components/documents/` (ver secção abaixo). Usa `@viselect/react`, `jszip`, `file-saver`, `react-dropzone`.

---

## Documentos — Biblioteca Partilhada (`components/documents/`)

Componentes domain-agnostic que qualquer módulo pode usar para listar/gerir documentos de uma entidade. Cada domínio tem a sua config em `domain-configs.ts` (properties, leads, negocios, processes) com categorias PT-PT e ícones.

**Componentes principais:**
- `<DocumentsGrid>` — grelha de pastas 3D, agrupadas por `Collapsible` de categoria, com selecção rectangular via `@viselect/react`. Desactiva drag em `pointer: coarse` (touch).
- `<FolderCard>` — pasta individual com thumbnail (primeira imagem), badge de contagem, context-menu PT-PT (Seleccionar/Abrir/Enviar/Descarregar pasta) e double-click (abre viewer ou upload se vazia).
- `<BatchActionBar>` — barra flutuante no rodapé com contador + "Descarregar" + "Cancelar" (slide-up).
- `<DocumentViewerModal>` — PDF em iframe, imagem com `object-contain`, DOCX via Office Online, fallback com `<DocIcon>` + download. Navegação por teclado (Esc, ←/→). Sidebar direita com `<DocIcon>` (nunca ícones Lucide para ficheiros).
- `<DocumentUploadDialog>` — `react-dropzone` multi-ficheiro, validação de extensão via `doc_type.allowed_extensions`, label opcional por ficheiro, data de validade condicional.
- `<CustomDocTypeDialog>` — criação rápida de `doc_type` ad-hoc com scope `applies_to`.
- `useBatchDownload()` — hook que faz single-file `saveAs` ou ZIP via `jszip`. **Sempre** passa por `/api/documents/proxy?url=...` (CORS R2).

**Contrato (`components/documents/types.ts`):**
```ts
type DocumentFolder = {
  id: string
  docTypeId: string | null
  name: string
  category: string         // mapa a DOMAIN_CONFIGS[domain].categories
  files: DocumentFile[]
  hasExpiry: boolean
  expiresAt?: string | null
  source?: DocumentFolderSource  // discriminated union: doc-type | property-media | ...
  ...
}
```

**Padrão de integração por domínio:**
1. Adapter em `lib/documents/adapters/{domain}.ts` converte a resposta da API em `DocumentFolder[]`.
2. Hook `hooks/use-{domain}-documents.ts` faz fetch + refetch.
3. View component em `components/{domain}/{domain}-documents-folders-view.tsx` compõe `DocumentsGrid` + dialogs + `useBatchDownload`.
4. Cada domínio envia multipart para `POST /api/{domain}/[id]/documents` (ou equivalente) que faz upload R2 + insert DB.

**Superfícies activas:**
| Domínio | Ficheiro | Estado |
|---|---|---|
| Imóveis | `property-documents-root.tsx` (toggle Lista/Pastas) | ✅ Pastas opcional; fluxos AI na vista Lista. |
| Processos | `process-documents-manager.tsx` | ✅ Flat grid. Pastas `property-media` abrem `<PropertyMediaGallery>` em Dialog. |
| Leads (Anexos) | `lead-documents-folders-view.tsx` | ✅ Substitui lista plana. Upload multipart → R2. |
| Negócios (Documentos) | `negocio-documents-folders-view.tsx` | ✅ Tab nova. |

## Envio de Imóveis do Dossier (Negócio)

A partir das tabs **Imóveis** e **Matching** em `/dashboard/leads/[id]/negocios/[negocioId]`, o consultor pode seleccionar múltiplos imóveis (checkbox por card + "Seleccionar todos") e clicar "Enviar selecionados" (barra flutuante) para abrir um diálogo análogo ao de documentos, com canais Email e WhatsApp independentes.

- **Selecção no tab Matching** auto-adiciona o imóvel ao dossier (`POST /api/negocios/[id]/properties`) antes de entrar no Set de seleção — mantém estado consistente e `sent_at` persistido.
- **Email**: o corpo é `[intro editável pelo consultor] + renderPropertyGrid(cards)` embrulhado em `wrapEmailHtml`. Despacho via `smtp-send` edge com `pLimit(3)` usando `consultant_email_accounts` resolvida por `resolveEmailAccount`.
- **WhatsApp**: uma mensagem de texto por destinatário (`action: 'send_text'`) com lista enumerada de `título — preço` + URL — sem anexos binários; o WhatsApp gera preview OG via `infinitygroup.pt`. `pLimit(2)`.
- **Link público**: `property_id` → `buildPublicPropertyUrl(slug)` = `${PUBLIC_WEBSITE_URL}/property/{slug}` (env `NEXT_PUBLIC_WEBSITE_URL`). Item externo → `external_url` directo.

**Ficheiros-chave:**
- `lib/email/property-card-html.ts` — `renderPropertyGrid(PropertyCardInput[], options)` (Outlook-safe tables + media query mobile → 1 coluna).
- `components/email-editor/user/email-property-grid.tsx` — bloco Craft.js "Grelha Imóveis" (resolver + toolbox já registados); serializa via o mesmo `renderPropertyGrid`.
- `components/negocios/send-properties-dialog.tsx` + `hooks/use-send-properties.ts`.
- `app/api/negocios/[id]/properties/send/route.ts` — endpoint com Zod + limites (`MAX_PROPERTY_IDS_PER_SEND=20`, `MAX_RECIPIENTS_PER_CHANNEL=20`).
- `app/api/negocios/[id]/properties/send/recipients/route.ts` — defaults para o diálogo (lead como destinatário principal, consultor atribuído).
- Auditoria: uma linha em `log_audit` por request com `entity_type='negocio_properties'`, `action='negocio_properties.send'`.

**APIs de suporte:**
- `GET /api/libraries/doc-types?applies_to=<domain>` — catálogo filtrado. Permissão: auth-only.
- `POST /api/libraries/doc-types/custom` — criação ad-hoc de tipo com auditoria.
- `GET /api/documents/proxy?url=<r2-url>` — proxy server-side para contornar CORS do R2 público (usado pelo `useBatchDownload`).

**Schema DB relevante (aplicado em 2026-04-14):**
- `doc_types.applies_to text[]` — scopes dos tipos (`properties`, `leads`, `negocios`, `processes`). Vazio = global.
- `lead_attachments.{doc_type_id, file_size, mime_type, valid_until, notes}` — colunas aditivas NULL-safe para suportar folders e upload real a R2.
- `negocio_documents` — tabela nova per-deal com FK `ON DELETE CASCADE` para `negocios`, join para `doc_types` e `dev_users`, trigger `updated_at`.

**R2 paths:**
- `leads/{leadId}/{docTypeSlug?}/{timestamp}-{name}`
- `negocios/{negocioId}/{docTypeSlug?}/{timestamp}-{name}`
- (já existentes: `imoveis-documentos/...`, `imoveis/{propertyId}/...`)

**CSS:**
- `.selection-area-rect` em `globals.css` — estilo do rectângulo de selecção (usa `color-mix` com `var(--primary)`).
- `.documents-grid-root *` — `user-select: none` para evitar conflito de selecção de texto durante drag. Input/textarea re-habilitam selecção.

**Bug conhecido do `@viselect/react` v3.9 e fix aplicado:** o wrapper regista handlers num `useEffect(..., [])` com deps vazias, capturando closures da primeira render. Solução: todos os callbacks em `DocumentsGrid` são estáveis (`useCallback(..., [])`) e leem estado via refs sincronizados.

---

## 📚 Documentação e Recursos

### Documentação Criada
- **[FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md)** — Documentação completa da Fase 1
- **[SPEC-M05-LEADS.md](docs/FASE%2005%20-%20LEADES/SPEC-M05-LEADS.md)** — Especificação completa do módulo de Leads
- **[FASE 06 - PROCESSOS/](docs/FASE%2006%20-%20PROCESSOS/)** — Documentação de Processos

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
- `lib/constants.ts` — STATUS_COLORS + labels PT-PT + constantes leads/negócios + formatadores
- `lib/validations/` — Schemas Zod (property, lead, owner, negocio)
- `types/database.ts` — Types do Supabase (auto-gerado)
- `types/lead.ts` — Types de Leads e Negócios

### Ficheiros Chave Criados (FASE 5 — Leads)

**API Routes:**
- `app/api/leads/route.ts` — GET (listagem + filtros) + POST (criar)
- `app/api/leads/[id]/route.ts` — GET + PUT + DELETE
- `app/api/leads/[id]/attachments/route.ts` — GET + POST anexos
- `app/api/leads/[id]/analyze-document/route.ts` — OCR com GPT-4o-mini
- `app/api/negocios/route.ts` — GET + POST negócios
- `app/api/negocios/[id]/route.ts` — GET + PUT + DELETE
- `app/api/negocios/[id]/chat/route.ts` — Assistente IA
- `app/api/negocios/[id]/fill-from-text/route.ts` — Extracção de texto
- `app/api/negocios/[id]/transcribe/route.ts` — Transcrição áudio
- `app/api/negocios/[id]/summary/route.ts` — Resumo IA
- `app/api/negocios/[id]/matches/route.ts` — Matching propriedades
- `app/api/negocios/[id]/interessados/route.ts` — Interessados
- `app/api/postal-code/[cp]/route.ts` — Lookup código postal
- `app/api/nipc/[nipc]/route.ts` — Lookup NIPC empresa

**Páginas:**
- `app/dashboard/leads/page.tsx` — Listagem com filtros e paginação
- `app/dashboard/leads/novo/page.tsx` — Criação de lead
- `app/dashboard/leads/[id]/page.tsx` — Detalhe com 6 tabs
- `app/dashboard/leads/[id]/negocios/[negocioId]/page.tsx` — Detalhe negócio com 5 tabs

**Componentes:**
- `components/leads/lead-filters.tsx` — Barra de filtros
- `components/leads/lead-form.tsx` — Formulário de criação
- `components/leads/document-analyzer.tsx` — Análise OCR de documentos
- `components/negocios/negocio-form.tsx` — Formulário dinâmico por tipo
- `components/negocios/negocio-chat.tsx` — Chat IA
- `components/negocios/negocio-matches.tsx` — Matching de propriedades
- `components/negocios/negocio-interessados.tsx` — Lista de interessados
- `components/negocios/negocio-summary.tsx` — Resumo IA
- `components/negocios/quick-fill.tsx` — Preenchimento rápido (texto + áudio)

### Ficheiros Chave Criados (FASE 3 — Imóveis)

**Types & Infra:**
- `types/property.ts` — PropertyWithRelations, PropertyDetail, re-exports
- `lib/r2/images.ts` — uploadImageToR2, deleteImageFromR2
- `lib/crop-image.ts` — Canvas crop → WebP Blob
- `lib/validations/property.ts` — (actualizado) updatePropertySchema, filtersSchema

**API Routes:**
- `app/api/properties/route.ts` — GET (listagem + filtros + paginação) + POST (criação)
- `app/api/properties/[id]/route.ts` — GET (detalhe) + PUT (edição) + DELETE (soft delete)
- `app/api/properties/[id]/media/route.ts` — GET (listar) + POST (upload ao R2)
- `app/api/properties/[id]/media/[mediaId]/route.ts` — PUT (set cover) + DELETE (eliminar)
- `app/api/properties/[id]/media/reorder/route.ts` — PUT (reordenar)

**Hooks:**
- `hooks/use-properties.ts` — Listagem com filtros e debounce
- `hooks/use-property.ts` — Detalhe de imóvel
- `hooks/use-property-media.ts` — Upload, delete, setCover, reorder (optimistic)
- `hooks/use-image-compress.ts` — Compressão WebP (0.3MB, 1920px)

**Componentes:**
- `components/properties/property-filters.tsx` — Filtros (status, tipo, negócio, consultor)
- `components/properties/property-card.tsx` — Card de imóvel com imagem, specs, preço
- `components/properties/property-form.tsx` — Formulário completo (4 secções)
- `components/properties/property-image-cropper.tsx` — Crop com 3 aspect ratios
- `components/properties/property-media-upload.tsx` — Upload multi-ficheiro com preview e crop
- `components/properties/property-media-gallery.tsx` — Galeria drag-to-reorder com @dnd-kit

**Páginas:**
- `app/dashboard/imoveis/page.tsx` — Listagem com tabela/grid, filtros, paginação
- `app/dashboard/imoveis/[id]/page.tsx` — Detalhe com 6 tabs controladas
- `app/dashboard/imoveis/novo/page.tsx` — Criação de imóvel
- `app/dashboard/imoveis/[id]/editar/page.tsx` — Edição de imóvel

**Dependências adicionadas:** browser-image-compression, react-easy-crop, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

**Total:** 85+ ficheiros criados | 35 componentes shadcn instalados

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
- ✅ Leads: listagem, criação, detalhe, edição, eliminação
- ✅ Negócios: criação, formulário dinâmico, matching, interessados
- ✅ IA: chat, preenchimento rápido, análise de documentos, resumo (requer OPENAI_API_KEY)
- ✅ Imóveis: listagem, criação, detalhe (6 tabs), edição, eliminação
- ✅ Media: upload com crop e compressão, galeria drag-to-reorder, marcação de capa

### 4. Próximos Passos
Consultar [FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md) para roadmap da **FASE 2 — Módulos Core**.
