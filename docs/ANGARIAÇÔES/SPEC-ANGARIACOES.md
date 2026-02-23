# SPEC — Angariações (Acquisitions Module)

> Documento de referência para LLMs. Descreve o fluxo completo de criação de angariações no ERP Infinity.

---

## 1. Visão Geral

Uma **angariação** é o processo de registar um novo imóvel para venda/arrendamento. É o ponto de entrada principal do sistema: cria um imóvel (`dev_properties`), liga proprietários (`owners` + `property_owners`), regista dados internos/contratuais (`dev_property_internal`), especificações (`dev_property_specifications`), documentos opcionais (`doc_registry`) e inicia um processo documental (`proc_instances`) com status `pending_approval`.

**URL da página:** `/dashboard/angariacao`

---

## 2. Estrutura de Ficheiros

```
app/
├── dashboard/angariacao/
│   └── page.tsx                              ← Página wrapper (renderiza AcquisitionForm)
├── api/
│   ├── acquisitions/route.ts                 ← POST — cria imóvel + owners + processo
│   ├── documents/upload/route.ts             ← POST — upload de ficheiro ao R2 + registo BD
│   └── libraries/doc-types/route.ts          ← GET — tipos de documento

components/acquisitions/
├── acquisition-form.tsx                      ← Componente principal (multi-step, 332 linhas)
├── step-1-property.tsx                       ← Passo 1: dados do imóvel + especificações
├── step-2-location.tsx                       ← Passo 2: localização (Mapbox)
├── step-3-owners.tsx                         ← Passo 3: proprietários + KYC
├── step-4-contract.tsx                       ← Passo 4: contrato + comissão
├── step-5-documents.tsx                      ← Passo 5: documentos (opcional, deferred)
├── owner-kyc-singular.tsx                    ← KYC pessoa singular (collapsible)
├── owner-kyc-coletiva.tsx                    ← KYC pessoa colectiva (collapsible)
└── owner-beneficiaries-list.tsx              ← Beneficiários efectivos (colectiva sem RCBE)

components/properties/
└── property-address-map-picker.tsx           ← Autocomplete Mapbox + mapa interactivo

components/documents/
└── DocumentsSection.tsx                      ← Secção reutilizável de upload de documentos

lib/
├── validations/acquisition.ts                ← Schema Zod (acquisitionSchema)
├── r2/documents.ts                           ← Helpers R2 (upload, delete, sanitize)
└── constants.ts                              ← PROPERTY_TYPES, BUSINESS_TYPES, CONTRACT_REGIMES, etc.

types/
├── document.ts                               ← DocType interface
└── process.ts                                ← ProcessInstance interface
```

---

## 3. Formulário Multi-Step (5 Passos)

O formulário usa `react-hook-form` + `zodResolver(acquisitionSchema)` + componente `<Stepper>` do shadcn/ui.

### Passo 1 — Dados do Imóvel (`step-1-property.tsx`)

**Campos obrigatórios (*):**

| Campo               | Tipo   | Validação                     | Constante           |
|---------------------|--------|-------------------------------|---------------------|
| `title` *           | Input  | min 5 caracteres              | —                   |
| `property_type` *   | Select | min 1 caracter                | `PROPERTY_TYPES`    |
| `business_type` *   | Select | min 1 caracter                | `BUSINESS_TYPES`    |
| `listing_price` *   | Number | positivo                      | —                   |
| `property_condition` | Select | opcional                     | `PROPERTY_CONDITIONS` |
| `description`       | Textarea | opcional                   | —                   |
| `energy_certificate` | Select | opcional                    | `ENERGY_CERTIFICATES` |

**Especificações (opcionais, dentro de `specifications`):**

| Campo                        | Tipo   |
|------------------------------|--------|
| `specifications.typology`    | Input  |
| `specifications.bedrooms`    | Number |
| `specifications.bathrooms`   | Number |
| `specifications.area_util`   | Number |

### Passo 2 — Localização (`step-2-location.tsx`)

Usa o componente `<PropertyAddressMapPicker>` (Mapbox SearchBox API + mapa interactivo com marcador arrastável).

| Campo              | Tipo   | Obrigatório | Preenchido por          |
|--------------------|--------|-------------|-------------------------|
| `address_street` * | Input  | Sim         | Mapbox autocomplete     |
| `city` *           | Input  | Sim         | Mapbox context.place    |
| `postal_code`      | Input  | Não         | Mapbox context.postcode |
| `zone`             | Input  | Não         | Mapbox context.region   |
| `address_parish`   | Input  | Não         | Manual                  |
| `latitude`         | Number | Não         | Mapbox coordinates      |
| `longitude`        | Number | Não         | Mapbox coordinates      |

**Fluxo Mapbox:**
1. Utilizador digita morada → debounce 300ms → Mapbox Suggest API
2. Selecciona sugestão → Mapbox Retrieve API → preenche todos os campos
3. Marcador move-se no mapa → `flyTo` zoom 16
4. Se arrastar marcador → Geocoding API v5 (inversa) → actualiza campos

### Passo 3 — Proprietários (`step-3-owners.tsx`)

Array dinâmico de owners (mínimo 1). Cada owner tem:

**Campos base:**

| Campo                   | Tipo     | Obrigatório |
|-------------------------|----------|-------------|
| `person_type`           | Select   | Sim         |
| `name`                  | Input    | Sim (min 2) |
| `email`                 | Input    | Não         |
| `phone`                 | Input    | Não         |
| `nif`                   | Input    | Não (9 dígitos) |
| `ownership_percentage`  | Number   | Sim (0-100) |
| `is_main_contact`       | Checkbox | 1 por imóvel |

**KYC Pessoa Singular** (`owner-kyc-singular.tsx`, collapsible):

| Campo                | Tipo       | Condicional        |
|----------------------|------------|--------------------|
| `id_doc_type`        | Select     | CC, BI, Passaporte, Título Residência, Outro |
| `id_doc_number`      | Input      | —                  |
| `id_doc_expiry`      | Date       | —                  |
| `id_doc_issued_by`   | Input      | —                  |
| `birth_date`         | Date       | —                  |
| `profession`         | Input      | —                  |
| `is_portugal_resident` | Switch   | —                  |
| `residence_country`  | Input      | Se `is_portugal_resident === false` |
| `marital_regime`     | Select     | Comunhão Adquiridos, Separação Bens, etc. |
| `is_pep`             | Switch     | —                  |
| `pep_position`       | Input      | Se `is_pep === true` |
| `funds_origin`       | Checkboxes | Multi-select: Salário, Poupanças, Herança, Venda de Imóvel, Investimentos, Empréstimo, Outro |

**KYC Pessoa Colectiva** (`owner-kyc-coletiva.tsx`, collapsible):

| Campo                      | Tipo   |
|----------------------------|--------|
| `company_object`           | Input  |
| `company_branches`         | Input  |
| `legal_nature`             | Select (Unipessoal, Quotas, Anónima, Associação, Fundação, Outro) |
| `country_of_incorporation` | Input (default: "Portugal") |
| `cae_code`                 | Input  |
| `rcbe_code`                | Input  |

**Beneficiários Efectivos** (`owner-beneficiaries-list.tsx`):
- Aparece **apenas** quando `person_type === 'coletiva'` E `rcbe_code` está vazio
- Array dinâmico de beneficiários, cada um com:
  - `full_name` * (obrigatório)
  - `position`, `share_percentage`, `nif`
  - `id_doc_type`, `id_doc_number`, `id_doc_expiry`, `id_doc_issued_by`

### Passo 4 — Contrato (`step-4-contract.tsx`)

| Campo              | Tipo     | Obrigatório | Constante         |
|--------------------|----------|-------------|-------------------|
| `contract_regime` *| Select   | Sim         | `CONTRACT_REGIMES` |
| `contract_term`    | Input    | Não         | —                 |
| `contract_expiry`  | Date     | Não         | —                 |
| `commission_agreed`* | Number | Sim (>=0)   | —                 |
| `commission_type`  | Select   | Não         | "percentage" / "fixed" |
| `imi_value`        | Number   | Não         | —                 |
| `condominium_fee`  | Number   | Não         | —                 |
| `internal_notes`   | Textarea | Não         | —                 |

### Passo 5 — Documentos (`step-5-documents.tsx`)

- Upload é **opcional** nesta fase
- Usa modo **deferred**: ficheiros `File` guardados no estado do form, upload real após criação
- Carrega tipos de documento da API `GET /api/libraries/doc-types`
- Filtra categorias: `Contratual`, `Imóvel`, `Jurídico`, `Jurídico Especial`, `Proprietário`, `Proprietário Empresa`
- Docs de categorias `Proprietário*` são auto-associados ao owner (main_contact ou index 0)
- Componente `<DocumentsSection>` renderiza as categorias com file pickers

---

## 4. Schema de Validação Zod

**Ficheiro:** `lib/validations/acquisition.ts`

```typescript
export const acquisitionSchema = z.object({
  // Step 1
  title: z.string().min(5),
  property_type: z.string().min(1),
  business_type: z.string().min(1),
  listing_price: z.number().positive(),
  description: z.string().optional(),
  property_condition: z.string().optional(),
  energy_certificate: z.string().optional(),

  // Step 2
  address_street: z.string().min(1),
  city: z.string().min(1),
  address_parish: z.string().optional(),
  postal_code: z.string().optional(),
  zone: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),

  // Step 3
  owners: z.array(z.object({
    id: z.string().uuid().optional(),
    person_type: z.enum(['singular', 'coletiva']),
    name: z.string().min(2),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    nif: z.string().min(9).max(9).optional().or(z.literal('')),
    // ... KYC singular fields (all optional)
    // ... KYC coletiva fields (all optional)
    beneficiaries: z.array(z.object({
      full_name: z.string().min(2),
      // ... (all other fields optional)
    })).optional().default([]),
    ownership_percentage: z.number().min(0).max(100),
    is_main_contact: z.boolean(),
  })).min(1),

  // Step 4
  contract_regime: z.string().min(1),
  commission_agreed: z.number().nonnegative(),
  commission_type: z.string().default('percentage'),
  contract_term: z.string().optional(),
  contract_expiry: z.string().optional(),
  imi_value: z.number().nonnegative().optional(),
  condominium_fee: z.number().nonnegative().optional(),
  internal_notes: z.string().optional(),

  // Specifications
  specifications: z.object({ /* all optional */ }).optional(),

  // Step 5
  documents: z.array(z.object({
    doc_type_id: z.string(),
    file_url: z.string().optional(),
    file_name: z.string().optional(),
    file_size: z.number().optional(),
    file_type: z.string().optional(),
    valid_until: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    owner_id: z.string().optional(),
  })).optional(),
})
```

**Types exportados:**
- `AcquisitionFormData = z.infer<typeof acquisitionSchema>`
- `AcquisitionEditFormData = z.infer<typeof acquisitionEditSchema>` (partial)

---

## 5. APIs — Fluxo Passo a Passo

### 5.1 `POST /api/acquisitions` (Route Handler principal)

**Ficheiro:** `app/api/acquisitions/route.ts`

**Request:** JSON body validado contra `acquisitionSchema`

**Response (sucesso):**
```json
{
  "success": true,
  "property_id": "uuid",
  "proc_instance_id": "uuid",
  "owner_ids": ["uuid", "uuid"],
  "message": "Angariação criada com sucesso"
}
```

**Sequência de operações no servidor:**

```
1. Autenticação
   └─ supabase.auth.getUser() → user.id

2. Validação
   └─ acquisitionSchema.safeParse(body)
   └─ Se inválido: 400 + details

3. INSERT dev_properties
   └─ title, description, property_type, business_type, listing_price
   └─ status: 'pending_approval' (SEMPRE)
   └─ city, zone, address_parish, address_street, postal_code
   └─ latitude, longitude
   └─ consultant_id: user.id (quem criou)
   └─ property_condition, energy_certificate
   └─ Retorna: property.id

4. INSERT dev_property_specifications (se fornecido)
   └─ property_id, typology, bedrooms, bathrooms, area_util, etc.

5. INSERT dev_property_internal
   └─ property_id, exact_address, postal_code
   └─ commission_agreed, commission_type
   └─ contract_regime, contract_term, contract_expiry
   └─ imi_value, condominium_fee, internal_notes

6. Para CADA owner no array:
   6a. Verificar se existe (deduplicação):
       └─ Por NIF (se 9 dígitos) → SELECT owners WHERE nif = X
       └─ Por email (se fornecido) → SELECT owners WHERE email = X
       └─ Se encontrado: reutilizar ID existente
   6b. Se não existe: INSERT owners
       └─ Campos comuns: person_type, name, email, phone, nif, nationality, etc.
       └─ KYC singular: birth_date, id_doc_*, is_pep, funds_origin, profession, etc.
       └─ KYC colectiva: company_object, legal_nature, cae_code, rcbe_code, etc.
   6c. Se colectiva COM beneficiários:
       └─ INSERT owner_beneficiaries (array)
   6d. INSERT property_owners
       └─ property_id, owner_id, ownership_percentage, is_main_contact
   6e. Guardar owner_id no array ownerIds[]

7. INSERT doc_registry (se documentos com file_url)
   └─ Filtra apenas documentos com file_url E file_name
   └─ property_id, doc_type_id, file_url, file_name
   └─ uploaded_by: user.id, status: 'active'

8. INSERT proc_instances
   └─ property_id
   └─ tpl_process_id: NULL (sem template!)
   └─ current_status: 'pending_approval'
   └─ requested_by: user.id
   └─ percent_complete: 0
   └─ Trigger automático: trg_generate_proc_ref → PROC-YYYY-XXXX

9. Retornar { success, property_id, proc_instance_id, owner_ids }
```

### 5.2 `POST /api/documents/upload` (Upload de ficheiros ao R2)

**Ficheiro:** `app/api/documents/upload/route.ts`

**Request:** `FormData` com:
- `file` (File, obrigatório)
- `doc_type_id` (string, obrigatório)
- `property_id` (string, condicional)
- `owner_id` (string, opcional)
- `valid_until` (string, opcional)
- `notes` (string, opcional)

**Fluxo:**
```
1. Autenticação
2. Ler FormData (file, doc_type_id, property_id, owner_id, etc.)
3. Validar file existe e tamanho <= MAX_FILE_SIZE (20MB)
4. Validar extensão contra doc_types.allowed_extensions
5. Se doc de proprietário sem owner_id → inferir via property_owners (main_contact)
6. Determinar path R2: imoveis/{propertyId}/ ou proprietarios/{ownerId}/
7. Upload ao Cloudflare R2 via PutObjectCommand
   └─ Key: {basePath}/{timestamp}-{sanitized-filename}
8. INSERT doc_registry
   └─ property_id, owner_id, doc_type_id, file_url, file_name
   └─ uploaded_by, status: 'active'
   └─ metadata: { size, mimetype, r2_key }
9. Retornar { id, url, file_name }
```

### 5.3 `GET /api/libraries/doc-types` (Tipos de documento)

Retorna array de tipos de documento filtrados. Usado no Step 5 para carregar categorias.

### 5.4 `POST /api/processes/[id]/approve` (Aprovação — pós-angariação)

Chamado **depois** da angariação, pelo Broker/CEO:
```
1. Verificar permissão do utilizador
2. Receber { tpl_process_id } no body
3. Actualizar proc_instances:
   └─ tpl_process_id = template seleccionado
   └─ current_status = 'active'
4. Trigger populate_process_tasks() → copia tarefas do template
5. Auto-complete tarefas UPLOAD com docs já existentes
6. Recalcular progresso
```

---

## 6. Fluxo Completo no Cliente (Submissão)

**Ficheiro:** `components/acquisitions/acquisition-form.tsx` → `onSubmit()`

```
1. Separar ficheiros do payload JSON:
   ├─ pendingFiles[] ← documentos com File object (upload posterior)
   └─ jsonDocuments[] ← documentos com file_url (já uploaded, raro)

2. POST /api/acquisitions
   └─ Body: { ...formData, documents: jsonDocuments }
   └─ Resposta: { property_id, proc_instance_id, owner_ids }

3. Upload de ficheiros pendentes (sequencial):
   └─ Para cada pendingFile:
      ├─ FormData: file, doc_type_id, property_id
      ├─ Resolver owner_id: owner_ids[pending.owner_index]
      └─ POST /api/documents/upload
   └─ Erros não bloqueiam (toast.warning)

4. Redirect: router.push(`/dashboard/processos/${proc_instance_id}`)
```

---

## 7. Tabelas de Base de Dados Envolvidas

| Tabela                      | Operação | Quando                                |
|-----------------------------|----------|---------------------------------------|
| `dev_properties`            | INSERT   | Sempre (dados principais do imóvel)   |
| `dev_property_specifications` | INSERT | Se specifications fornecidas          |
| `dev_property_internal`     | INSERT   | Sempre (comissão, contrato, notas)    |
| `owners`                    | SELECT/INSERT | Para cada proprietário (dedup NIF/email) |
| `owner_beneficiaries`       | INSERT   | Se colectiva sem RCBE com beneficiários |
| `property_owners`           | INSERT   | Para cada proprietário (junction M:N) |
| `doc_registry`              | INSERT   | Para cada documento uploaded          |
| `doc_types`                 | SELECT   | Step 5 (carregar categorias)          |
| `proc_instances`            | INSERT   | Sempre (processo pendente aprovação)  |

**Triggers automáticos na inserção de `proc_instances`:**
- `trg_generate_proc_ref` → gera `external_ref` no formato `PROC-YYYY-XXXX`

**Triggers automáticos na aprovação:**
- `trg_populate_tasks` → copia tarefas do template para `proc_tasks`

---

## 8. Componentes e Dependências

### Árvore de componentes

```
<AngariacaoPage>                          ← app/dashboard/angariacao/page.tsx
  └─ <AcquisitionForm>                    ← components/acquisitions/acquisition-form.tsx
       ├─ <Stepper> (shadcn/ui)
       │   ├─ <StepperList>
       │   │   └─ <StepperItem> x5 (property, location, owners, contract, documents)
       │   └─ <Card>
       │       ├─ <StepperContent value="property">
       │       │   └─ <StepProperty>      ← step-1-property.tsx
       │       ├─ <StepperContent value="location">
       │       │   └─ <StepLocation>      ← step-2-location.tsx
       │       │       └─ <PropertyAddressMapPicker>
       │       ├─ <StepperContent value="owners">
       │       │   └─ <StepOwners>        ← step-3-owners.tsx
       │       │       ├─ <OwnerKycSingular>   (se singular, collapsible)
       │       │       ├─ <OwnerKycColetiva>   (se colectiva, collapsible)
       │       │       └─ <OwnerBeneficiariesList> (se colectiva sem RCBE)
       │       ├─ <StepperContent value="contract">
       │       │   └─ <StepContract>      ← step-4-contract.tsx
       │       └─ <StepperContent value="documents">
       │           └─ <StepDocuments>     ← step-5-documents.tsx
       │               └─ <DocumentsSection>
       └─ Botões: Voltar / Avançar / Criar Angariação
```

### Componentes shadcn/ui usados

| Componente       | Uso                                         |
|------------------|---------------------------------------------|
| `Stepper`        | Navegação multi-step                        |
| `Form`           | Wrapper react-hook-form                     |
| `FormField`      | Campo com label, validação, mensagem        |
| `Input`          | Campos de texto e número                    |
| `Textarea`       | Descrição e notas internas                  |
| `Select`         | Dropdowns (tipo imóvel, negócio, etc.)      |
| `Checkbox`       | Main contact, funds_origin multi-select     |
| `Switch`         | is_portugal_resident, is_pep                |
| `Card`           | Container de cada owner e stepper content   |
| `Badge`          | "Proprietário 1", "Contacto Principal"      |
| `Button`         | Navegação, adicionar/remover owner          |
| `Collapsible`    | Secções KYC (expandir/colapsar)             |
| `Skeleton`       | Loading state no step 5                     |

### Bibliotecas externas usadas

| Biblioteca       | Uso                                         |
|------------------|---------------------------------------------|
| `react-hook-form` | Gestão de estado do formulário             |
| `zod`            | Validação de schema                         |
| `@hookform/resolvers` | zodResolver para react-hook-form       |
| `sonner`         | Toast notifications                         |
| `lucide-react`   | Ícones (Loader2, ChevronLeft, Plus, etc.)   |
| `mapbox-gl`      | Mapa interactivo no Step 2                  |
| `@aws-sdk/client-s3` | Upload para Cloudflare R2              |

---

## 9. Constantes Usadas (de `lib/constants.ts`)

| Constante             | Tipo   | Exemplo de valores                         |
|-----------------------|--------|--------------------------------------------|
| `PROPERTY_TYPES`      | Object | apartamento → "Apartamento", moradia → "Moradia", loja → "Loja" |
| `BUSINESS_TYPES`      | Object | venda → "Venda", arrendamento → "Arrendamento", trespasse → "Trespasse" |
| `PROPERTY_CONDITIONS`  | Object | novo → "Novo", bom_estado → "Bom Estado", renovacao → "Renovação" |
| `ENERGY_CERTIFICATES` | Object | a_plus → "A+", a → "A", b → "B", ... |
| `CONTRACT_REGIMES`    | Object | exclusivo → "Exclusivo", nao_exclusivo → "Não-exclusivo" |

### Constantes hardcoded nos componentes KYC

**Tipos de documento de identificação:**
```
CC, BI, Passaporte, Título de Residência, Outro
```

**Origens de fundos:**
```
Salário, Poupanças, Herança, Venda de Imóvel, Investimentos, Empréstimo, Outro
```

**Regimes matrimoniais:**
```
comunhao_adquiridos, separacao_bens, comunhao_geral, uniao_facto
```

**Naturezas jurídicas (colectiva):**
```
unipessoal, quotas, anonima, associacao, fundacao, outro
```

---

## 10. Storage — Cloudflare R2

**Helper:** `lib/r2/documents.ts`

**Paths de armazenamento:**
```
{R2_DOCUMENTS_PATH}/{propertyId}/{timestamp}-{sanitized-filename}   ← documentos de imóvel
proprietarios/{ownerId}/{timestamp}-{sanitized-filename}            ← documentos de proprietário
consultores/{consultantId}/{timestamp}-{sanitized-filename}         ← documentos de consultor
```

**Sanitização de nome:** remove acentos, caracteres especiais, converte para minúsculas, substitui espaços por hifens.

**URL pública:** `{R2_PUBLIC_DOMAIN}/{key}`

---

## 11. Regras de Negócio Importantes

1. **Status inicial é SEMPRE `pending_approval`** — o imóvel não é publicado sem aprovação
2. **Processo criado SEM template** — `tpl_process_id = null`. O template é seleccionado pelo aprovador (Broker/CEO) em `POST /api/processes/[id]/approve`
3. **Tarefas do processo só existem após aprovação** — o trigger `populate_process_tasks()` executa apenas quando `tpl_process_id` é definido
4. **Deduplicação de owners** — antes de criar novo, verifica NIF (9 dígitos) e depois email
5. **Exactamente 1 `is_main_contact = true`** por imóvel — UI garante isso
6. **Upload de documentos é two-phase:**
   - Fase 1 (form): File objects no estado do form
   - Fase 2 (pós-submit): upload real ao R2 com `property_id` real
7. **Documentos de proprietário** (categorias `Proprietário`, `Proprietário Empresa`) são auto-associados ao owner via `owner_index` → `owner_ids[]`
8. **Falha no upload de documentos não bloqueia** — toast de aviso, documentos podem ser adicionados depois na página do processo
9. **`consultant_id`** é preenchido automaticamente com o `user.id` autenticado
10. **Referência `PROC-YYYY-XXXX`** é gerada por trigger no INSERT de `proc_instances`

---

## 12. Diagrama de Sequência

```
Consultor                    Frontend                       API /acquisitions              Supabase              R2
   │                            │                               │                           │                   │
   │  Preenche 5 passos         │                               │                           │                   │
   │ ──────────────────────►    │                               │                           │                   │
   │                            │  POST /api/acquisitions       │                           │                   │
   │                            │ ─────────────────────────►    │                           │                   │
   │                            │                               │  INSERT dev_properties    │                   │
   │                            │                               │ ─────────────────────►    │                   │
   │                            │                               │  INSERT dev_property_specs│                   │
   │                            │                               │ ─────────────────────►    │                   │
   │                            │                               │  INSERT dev_property_int  │                   │
   │                            │                               │ ─────────────────────►    │                   │
   │                            │                               │  SELECT/INSERT owners     │                   │
   │                            │                               │ ─────────────────────►    │                   │
   │                            │                               │  INSERT property_owners   │                   │
   │                            │                               │ ─────────────────────►    │                   │
   │                            │                               │  INSERT proc_instances    │                   │
   │                            │                               │ ─────────────────────►    │                   │
   │                            │  { property_id, proc_id, owner_ids }                      │                   │
   │                            │ ◄─────────────────────────    │                           │                   │
   │                            │                               │                           │                   │
   │                            │  POST /api/documents/upload (por cada ficheiro)            │                   │
   │                            │ ──────────────────────────────────────────────►            │                   │
   │                            │                                                           │  PutObject        │
   │                            │                                                           │ ────────────────► │
   │                            │                                                           │  INSERT doc_reg   │
   │                            │ ◄──────────────────────────────────────────────            │                   │
   │                            │                               │                           │                   │
   │                            │  router.push(/processos/{id}) │                           │                   │
   │ ◄──────────────────────    │                               │                           │                   │
   │                            │                               │                           │                   │
   │  (Mais tarde)              │                               │                           │                   │
   │  Broker/CEO aprova         │  POST /api/processes/{id}/approve                         │                   │
   │ ──────────────────────►    │ ──────────────────────────────────────────────►            │                   │
   │                            │                               │  UPDATE proc_instances    │                   │
   │                            │                               │  (tpl_process_id, status) │                   │
   │                            │                               │ ─────────────────────►    │                   │
   │                            │                               │  TRIGGER populate_tasks   │                   │
   │                            │                               │ ─────────────────────►    │                   │
```

---

## 13. Navegação e Sidebar

**Entrada no sidebar:**
```typescript
{
  title: 'Angariação',
  icon: ClipboardCheck,    // lucide-react
  href: '/dashboard/angariacao',
  permission: 'properties',
}
```

**Após submissão bem-sucedida:**
- Redirect para `/dashboard/processos/{proc_instance_id}`
- Processo aparece com status `pending_approval`
- Aprovador selecciona template e aprova

---

## 14. Validação por Step (Navegação)

A validação acontece **ao avançar** (não ao recuar):

| Step       | Campos validados                                          |
|------------|-----------------------------------------------------------|
| 1 → 2     | `title`, `property_type`, `business_type`, `listing_price` |
| 2 → 3     | `city`, `address_street`, `postal_code`                    |
| 3 → 4     | `owners` (min 1)                                           |
| 4 → 5     | `contract_regime`, `commission_agreed`                     |
| 5 → Submit| Sem validação de step (docs são opcionais)                 |

Ao submeter (`form.handleSubmit`), **toda** a schema é validada.

---

## 15. Tratamento de Erros

| Cenário                    | Comportamento                                           |
|----------------------------|---------------------------------------------------------|
| Campos inválidos (step)    | `toast.error` + campos marcados com erro                |
| Campos inválidos (submit)  | `toast.error` listando campos + console.error detalhado |
| API retorna 400            | `toast.error` com mensagem do servidor                  |
| API retorna 401            | `toast.error("Não autenticado")`                        |
| API retorna 500            | `toast.error("Erro ao criar angariação")`               |
| Upload de doc falha        | `toast.warning` não-bloqueante, conta falhas             |
| Upload parcial (N falhas)  | `toast.warning("{N} documento(s) não carregado(s)")"`    |
