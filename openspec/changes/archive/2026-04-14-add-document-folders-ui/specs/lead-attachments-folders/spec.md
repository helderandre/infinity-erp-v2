## ADDED Requirements

### Requirement: Coluna `doc_type_id` em `lead_attachments`

O sistema SHALL adicionar à tabela `lead_attachments` uma coluna `doc_type_id uuid` NULLABLE com FK para `doc_types(id)`. Registos existentes MUST manter-se válidos sem valor (caem na pasta "Outros"). A migration MUST ser aditiva, zero-downtime.

#### Scenario: Migration aditiva aplicada

- **WHEN** a migration é executada
- **THEN** a coluna `doc_type_id` existe em `lead_attachments` e aceita `NULL`
- **AND** registos antigos permanecem acessíveis sem alteração
- **AND** a UI de anexos agrupa registos sem `doc_type_id` na pasta "Outros"

---

### Requirement: `doc_types.applies_to` para partilhar tipos entre domínios

O sistema SHALL adicionar à tabela `doc_types` uma coluna `applies_to text[]` (default `'{}'`). Valores esperados: `'properties'`, `'leads'`, `'negocios'`, `'processes'`. A UI de upload MUST filtrar apenas os `doc_types` cujo `applies_to` contém o domínio actual.

#### Scenario: Seed de tipos partilhados

- **WHEN** o seed é executado
- **THEN** existe um `doc_type` `"Cartão de Cidadão"` com `applies_to = ['leads','negocios']`
- **AND** existe `"Contrato de Promessa"` com `applies_to = ['negocios','properties']`
- **AND** tipos específicos de imóvel (`"Caderneta Predial"`) mantêm `applies_to = ['properties']`

#### Scenario: UI filtra por domínio

- **WHEN** o utilizador abre o upload dialog em contexto de `leads`
- **THEN** o selector de tipo mostra apenas `doc_types` com `'leads' IN applies_to`
- **AND** tipos exclusivos de imóvel não aparecem

---

### Requirement: API upgrade para anexos como folders

O sistema SHALL actualizar as rotas `GET/POST /api/leads/[id]/attachments` para:
- `GET` devolve `{ folders: DocumentFolder[] }` agrupados por `doc_type_id` (registos com `null` vão para "Outros")
- `POST` aceita `doc_type_id` opcional no `FormData` e persiste-o
- `PUT /api/leads/[id]/attachments/[attachmentId]` (nova) permite actualizar `doc_type_id`, `valid_until`, `notes`

A rota `DELETE /api/leads/attachments/[attachmentId]` existente MUST continuar a funcionar sem alterações.

#### Scenario: GET devolve folders

- **WHEN** `GET /api/leads/{id}/attachments`
- **THEN** resposta inclui `{ folders: [{ id, name, category, files: [...] }, ...] }`
- **AND** registos sem `doc_type_id` aparecem na folder com `id = 'outros'`

#### Scenario: POST com doc_type_id

- **WHEN** é enviado POST com `file` e `doc_type_id`
- **THEN** o registo criado em `lead_attachments` tem o `doc_type_id` respectivo
- **AND** o ficheiro vai para R2 em `leads/{leadId}/{docTypeSlug}/{timestamp}-{name}`

#### Scenario: Compatibilidade retroactiva

- **WHEN** um POST chega sem `doc_type_id` (cliente antigo)
- **THEN** o registo é criado com `doc_type_id = null`
- **AND** a resposta continua `201` sem quebrar integrações

---

### Requirement: Tab "Anexos" upgrade para folders

O sistema SHALL substituir a lista plana actual na tab "Anexos" do detalhe do lead por `<DocumentsGrid>` com as categorias em `DOMAIN_CONFIGS.leads` (**Identificação**, **Fiscal**, **Comprovativos**, **Outros**). MUST suportar multi-select, batch download, viewer inline e upload contextual por pasta.

#### Scenario: Lista antiga migra para pastas

- **WHEN** o utilizador abre a tab Anexos num lead com 5 anexos antigos sem `doc_type_id`
- **THEN** os 5 aparecem todos na pasta "Outros"
- **AND** o utilizador pode arrastar/seleccionar e fazer batch download

#### Scenario: Upload contextualizado

- **WHEN** o utilizador clica "Enviar" na pasta "Identificação"
- **THEN** o upload dialog abre com selector de `doc_type` filtrado a `applies_to` contém `'leads'` e `category = 'identificacao'`

#### Scenario: Alterar tipo de anexo existente

- **WHEN** no viewer o utilizador escolhe "Alterar tipo" num anexo da pasta "Outros"
- **THEN** é feito `PUT /api/leads/{id}/attachments/{attachmentId}` com o novo `doc_type_id`
- **AND** a pasta é recalculada após o refetch
