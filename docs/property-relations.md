# Relações: Documentos ↔ Propriedades e Proprietários ↔ Propriedades

## 1. Propriedades ↔ Documentos

### Modelo de Dados

```
dev_properties
├── id (UUID, PK)
├── title, listing_price, status, ...
│
│   1:N
│
doc_registry
├── id (UUID, PK)
├── property_id (UUID, FK → dev_properties.id)
├── doc_type_id (UUID, FK → doc_types.id)
├── file_name (text)
├── file_url (text)
├── status (text: received | validated | rejected | expired)
├── metadata (JSONB: { size, mimetype })
├── uploaded_by (UUID, FK → dev_users.id, opcional)
├── valid_until (date, opcional)
└── created_at (timestamp)

doc_types
├── id (UUID, PK)
├── name (text)
├── description (text, opcional)
├── category (text, opcional)
├── allowed_extensions (text[], ex: ["pdf", "jpg", "png"])
├── default_validity_months (integer, opcional)
├── is_system (boolean)
└── created_at (timestamp)
```

### Relação

- **Um imóvel pode ter múltiplos documentos** — `doc_registry.property_id` é FK para `dev_properties.id`
- **Não existe constraint unique em `(property_id, doc_type_id)`** — permite múltiplos ficheiros do mesmo tipo para o mesmo imóvel
- **Cada documento tem um tipo** — `doc_registry.doc_type_id` é FK para `doc_types.id`
- **Tipos de documento definem extensões aceites** — `doc_types.allowed_extensions` é validado no upload

### Fluxo de Upload de Documentos

```
Cliente                          Servidor                         R2 / Supabase
  │                                │                                │
  │  1. POST /api/properties/create│                                │
  │ ──────────────────────────────>│                                │
  │                                │  Insert dev_properties         │
  │  { property: { id } }         │                                │
  │ <──────────────────────────────│                                │
  │                                │                                │
  │  2. POST /api/properties/{id}/documents/upload                  │
  │     FormData: doc_type_id + file                                │
  │ ──────────────────────────────>│                                │
  │                                │  Validar doc_type_id           │
  │                                │  Validar extensão              │
  │                                │  PutObjectCommand ────────────>│ R2
  │                                │                                │
  │                                │  Insert doc_registry ─────────>│ Supabase
  │                                │                                │
  │  { success, id, url }         │                                │
  │ <──────────────────────────────│                                │
  │                                │                                │
  │  (repete para cada ficheiro)   │                                │
```

### Validação de Extensões

A validação ocorre em dois níveis:

1. **Frontend** — ao seleccionar ficheiros, compara a extensão com `doc_types.allowed_extensions` e rejeita ficheiros inválidos com toast de aviso
2. **Backend** — no endpoint de upload, consulta `doc_types` para obter `allowed_extensions` e rejeita com erro 400 se a extensão não for permitida

### Metadados

Cada registo em `doc_registry` armazena metadados no campo JSONB `metadata`:

```json
{
  "size": 245760,
  "mimetype": "application/pdf"
}
```

### Endpoints

| Método | Rota                                    | Descrição                        |
|--------|-----------------------------------------|----------------------------------|
| GET    | `/api/libraries/doc-types`              | Listar tipos de documento        |
| POST   | `/api/properties/{id}/documents/upload` | Upload de documento para imóvel  |

---

## 2. Propriedades ↔ Proprietários

### Modelo de Dados

```
dev_properties
├── id (UUID, PK)
├── title, listing_price, status, ...
├── consultant_id (UUID, FK → dev_users.id)
│
│   M:N (via junction table)
│
property_owners (tabela de junção)
├── property_id (UUID, FK → dev_properties.id)
├── owner_id (UUID, FK → owners.id)
├── is_main_contact (boolean)
└── ownership_percentage (numeric, default 100)
│
│   M:N
│
owners
├── id (UUID, PK)
├── name (text, obrigatório)
├── person_type (text: singular | coletiva)
├── email (text, opcional)
├── phone (text, opcional)
├── nif (text, opcional)
├── address (text, opcional)
├── marital_status (text, opcional)
├── nationality (text, opcional)
├── naturality (text, opcional)
├── legal_representative_name (text, opcional — para empresas)
├── legal_representative_nif (text, opcional — para empresas)
├── company_cert_url (text, opcional — para empresas)
├── observations (text, opcional)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### Relação

- **Many-to-Many** — um imóvel pode ter múltiplos proprietários e um proprietário pode deter múltiplos imóveis
- **`property_owners`** é a tabela de junção com dados adicionais:
  - `is_main_contact` — identifica o contacto principal (exactamente 1 por imóvel)
  - `ownership_percentage` — percentagem de propriedade

### Reutilização de Proprietários

Ao criar uma angariação, o sistema verifica se o proprietário já existe antes de criar um novo:

```
Para cada proprietário no payload:
  1. Se tem NIF → buscar owners WHERE nif = ?
  2. Se não encontrou e tem email → buscar owners WHERE email = ?
  3. Se encontrou → reutilizar owner_id existente
  4. Se não encontrou → INSERT novo owner, usar o id retornado
  5. INSERT em property_owners (property_id, owner_id, is_main_contact, ownership_percentage)
```

### Fluxo de Criação com Proprietários

```
POST /api/properties/create
```

**Payload:**

```json
{
  "propertyData": { "title": "...", "listing_price": 250000, ... },
  "internalData": { "commission_agreed": 5, ... },
  "specsData": { "typology": "T3", "bedrooms": 3, ... },
  "owners": [
    {
      "name": "João Silva",
      "person_type": "singular",
      "email": "joao@email.pt",
      "phone": "+351912345678",
      "nif": "123456789",
      "is_main_contact": true
    },
    {
      "name": "Maria Silva",
      "person_type": "singular",
      "phone": "+351987654321",
      "is_main_contact": false
    }
  ]
}
```

**Sequência:**

```
1. Validação
   ├── Título e preço obrigatórios
   ├── Pelo menos 1 proprietário
   ├── Exactamente 1 proprietário com is_main_contact = true
   └── Contacto principal deve ter email ou telefone

2. Insert dev_properties → retorna property.id

3. Insert dev_property_internal (dados internos)

4. Insert dev_property_specifications (especificações)

5. Para cada owner:
   ├── Buscar existente por NIF ou email
   ├── Se não existe → INSERT owners
   └── INSERT property_owners (property_id, owner_id, is_main_contact, ownership_percentage)

6. Retorna { property: { id }, message }
```

### Consulta de Proprietários

#### Obter proprietário principal de um imóvel

```
GET /api/properties/{id}
```

```sql
-- 1. Buscar link do contacto principal
SELECT owner_id, ownership_percentage, is_main_contact
FROM property_owners
WHERE property_id = :id AND is_main_contact = true

-- 2. Buscar dados do proprietário
SELECT * FROM owners WHERE id = :owner_id
```

#### Obter todos os proprietários (listagem de angariações)

```
GET /api/properties/process
```

Usa nested select do Supabase para obter todos os proprietários numa única query:

```typescript
.from('dev_properties')
.select(`
  *,
  property_owners (
    is_main_contact,
    ownership_percentage,
    owners (
      name,
      phone,
      email
    )
  )
`)
```

#### Actualizar proprietário principal

```
PUT /api/properties/{id}
```

- Se o imóvel já tem um contacto principal, actualiza o registo em `owners`
- Se não tem, cria novo `owners` e novo `property_owners`
- Apenas o contacto principal é gerido pela edição individual

### Relação com Consultor

O imóvel também está ligado a um consultor (agente imobiliário):

```
dev_properties.consultant_id → dev_users.id → dev_consultant_profiles.user_id
```

Na listagem de angariações, o nome e foto do consultor são obtidos com:

```typescript
// Buscar consultor
const { data: consultant } = await client
  .from('dev_users')
  .select('id, commercial_name, profile_photo_url')
  .eq('id', property.consultant_id)
  .maybeSingle()
```

### Regras de Negócio

| Regra | Validação | Nível |
|-------|-----------|-------|
| Mínimo 1 proprietário | `owners.length > 0` | API |
| Exactamente 1 contacto principal | `filter(is_main_contact).length === 1` | API |
| Contacto principal com contacto | `main.email \|\| main.phone` | API |
| Reutilização por NIF | `SELECT FROM owners WHERE nif = ?` | API |
| Reutilização por email | `SELECT FROM owners WHERE email = ?` | API |
| Percentagem default 100% | `ownership_percentage ?? 100` | API |

### Endpoints Relacionados

| Método | Rota                        | Descrição                                    |
|--------|-----------------------------|----------------------------------------------|
| POST   | `/api/properties/create`    | Criar imóvel com proprietários               |
| GET    | `/api/properties/{id}`      | Obter imóvel com proprietário principal       |
| PUT    | `/api/properties/{id}`      | Actualizar imóvel e proprietário principal    |
| GET    | `/api/properties/process`   | Listar imóveis com todos os proprietários     |
