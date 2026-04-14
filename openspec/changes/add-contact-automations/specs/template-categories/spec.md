## ADDED Requirements

### Requirement: Valores canónicos de categoria

O sistema SHALL aceitar apenas os seguintes valores para a coluna `category` em `tpl_email_library` e `auto_wpp_templates`: `aniversario_contacto`, `aniversario_fecho`, `natal`, `ano_novo`, `festividade`, `custom`, `geral`.

#### Scenario: Valor canónico aceite
- **WHEN** um template é criado com `category='aniversario_contacto'`
- **THEN** o sistema aceita e persiste

#### Scenario: Valor não-canónico rejeitado
- **WHEN** um template é criado com `category='outro_qualquer'`
- **THEN** a validação Zod do endpoint recusa com 400 e mensagem "Categoria inválida. Valores permitidos: ..."

#### Scenario: Categoria omitida tratada como geral
- **WHEN** um template é criado sem `category` (campo omitido no payload)
- **THEN** o sistema persiste com `category='geral'`

### Requirement: Campo `category` obrigatório na UI

Os formulários de criação e edição de templates de email e WhatsApp SHALL exibir um campo dropdown "Categoria" obrigatório com os valores canónicos e labels PT-PT.

#### Scenario: Labels PT-PT
- **WHEN** o utilizador abre o dropdown
- **THEN** vê as opções: "Aniversário do contacto", "Aniversário de fecho", "Natal", "Ano Novo", "Festividade", "Personalizado", "Geral"

#### Scenario: Submissão sem categoria
- **WHEN** o utilizador tenta submeter o formulário com o dropdown vazio
- **THEN** o formulário mostra erro de validação "Categoria é obrigatória"

### Requirement: Validação server-side nos endpoints de template

Os endpoints `POST /api/templates/emails`, `PUT /api/templates/emails/[id]`, `POST /api/automacao/whatsapp/templates` e `PUT /api/automacao/whatsapp/templates/[id]` (ou equivalentes existentes) SHALL validar `category` via Zod enum com os valores canónicos.

#### Scenario: Schema Zod centralizado
- **WHEN** qualquer endpoint de template valida input
- **THEN** usa `TEMPLATE_CATEGORY_VALUES` importado de `lib/constants/template-categories.ts`

### Requirement: Filtro por categoria no wizard

O wizard de criação de automatismo no passo 4 SHALL filtrar templates por categoria correspondente ao `event_type` escolhido + sempre incluir `geral`.

#### Scenario: Evento aniversário contacto
- **WHEN** `event_type='aniversario_contacto'`
- **THEN** o dropdown mostra templates com `category IN ('aniversario_contacto', 'geral')`

#### Scenario: Evento Natal
- **WHEN** `event_type='natal'`
- **THEN** o dropdown mostra templates com `category IN ('natal', 'geral')`

#### Scenario: Festividade personalizada
- **WHEN** `event_type='festividade'`
- **THEN** o dropdown mostra templates com `category IN ('festividade', 'custom', 'geral')`

### Requirement: Mapeamento evento → categoria sugerida

O sistema SHALL expor em `lib/constants/template-categories.ts` um mapa `EVENT_TYPE_TO_CATEGORY: Record<ContactAutomationEventType, TemplateCategory>` para uso no wizard (pré-seleccionar categoria ao criar template novo).

#### Scenario: Criação de template a partir do wizard
- **WHEN** o utilizador clica "Criar novo template" no passo 4 com `event_type='ano_novo'`
- **THEN** o editor abre com `category='ano_novo'` pré-preenchido

### Requirement: Filtro de categoria nas páginas de biblioteca de templates

As páginas de listagem de templates (email e WhatsApp) SHALL incluir um filtro por categoria no topo, reutilizando os mesmos valores canónicos.

#### Scenario: Filtrar listagem
- **WHEN** o utilizador selecciona "Aniversário do contacto" no filtro
- **THEN** a listagem mostra apenas templates com essa categoria

#### Scenario: "Todos" como default
- **WHEN** o utilizador abre a listagem pela primeira vez
- **THEN** o filtro está em "Todos" e mostra todos os templates incluindo os legados com `category=null`

### Requirement: Templates legados com categoria null

O sistema SHALL continuar a exibir templates existentes com `category=null` como "Geral" na UI, sem forçar migração de dados.

#### Scenario: Template legado exibido
- **WHEN** um template antigo com `category=null` é listado
- **THEN** a UI mostra "Geral" na coluna de categoria
- **AND** o template é incluído nas buscas `category='geral'` (via coalesce no filtro)

#### Scenario: Edição de template legado
- **WHEN** o utilizador edita um template com `category=null`
- **THEN** o formulário apresenta o dropdown em "Geral" pré-seleccionado (não vazio); guardar actualiza para `'geral'` explícito
