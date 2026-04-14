## ADDED Requirements

### Requirement: Helper `resolveContactVariables`

O sistema SHALL expor um helper server-side em `lib/automacao/resolve-contact-variables.ts` com assinatura `resolveContactVariables(supabase, contactId: string, dealId?: string): Promise<Record<string, string>>` que devolve um mapa de variáveis prontas a serem interpoladas em templates via `{{variavel}}`.

#### Scenario: Contacto sem negócio associado
- **WHEN** o helper é chamado com um `contactId` válido e `dealId` undefined
- **THEN** o sistema devolve variáveis do contacto, data e ano actual, mas não de negócio

#### Scenario: Contacto com negócio
- **WHEN** o helper é chamado com `contactId` e `dealId` válidos
- **THEN** o sistema devolve variáveis do contacto + negócio + derivadas

#### Scenario: Contacto inexistente
- **WHEN** o `contactId` não existe
- **THEN** o helper lança erro com mensagem `"Contacto não encontrado"` para o spawner registar como `failed`

### Requirement: Variáveis de contacto

O helper SHALL popular as seguintes variáveis a partir de `leads_contacts`:

- `{{contact_name}}` ← `name` ou primeiro + último nome concatenados
- `{{contact_first_name}}` ← primeiro nome
- `{{contact_email}}` ← `email` (string vazia se null)
- `{{contact_phone}}` ← `phone` (string vazia se null)
- `{{contact_birthday}}` ← `date_of_birth` formatado `DD/MM/YYYY` (string vazia se null)

#### Scenario: Todos os campos preenchidos
- **WHEN** o contacto tem `name='João Silva'`, `email='joao@example.com'`, `phone='+351912345678'`, `date_of_birth='1985-04-20'`
- **THEN** o mapa devolvido contém `contact_name='João Silva'`, `contact_first_name='João'`, `contact_email='joao@example.com'`, `contact_phone='+351912345678'`, `contact_birthday='20/04/1985'`

#### Scenario: Campos nulos
- **WHEN** o contacto tem `email=null`
- **THEN** `contact_email=''` (string vazia, não `undefined` nem `null`)

### Requirement: Variáveis de negócio

Quando `dealId` é fornecido, o helper SHALL popular variáveis adicionais a partir de `negocios`:

- `{{deal_name}}` ← `nome` ou `titulo` do negócio (conforme schema)
- `{{deal_closing_date}}` ← `expected_close_date` formatado `DD/MM/YYYY`
- `{{deal_years_since_close}}` ← número de anos inteiros desde `expected_close_date` até hoje (ex: fecho 2024-06-15, hoje 2026-04-14 → `1`)
- `{{deal_value}}` ← `preco_venda` ou `orcamento` formatado como moeda PT (`€ 250.000,00`)

#### Scenario: Cálculo de anos desde fecho
- **WHEN** `expected_close_date='2023-04-20'` e hoje é `2026-04-14`
- **THEN** `deal_years_since_close='2'` (aniversário ainda não bateu em 2026)

#### Scenario: Aniversário bateu
- **WHEN** `expected_close_date='2023-04-10'` e hoje é `2026-04-14`
- **THEN** `deal_years_since_close='3'`

#### Scenario: Negócio sem data de fecho
- **WHEN** `deal_id` aponta para negócio com `expected_close_date=null`
- **THEN** `deal_closing_date=''` e `deal_years_since_close=''`

### Requirement: Variáveis derivadas do sistema

O helper SHALL popular sempre:

- `{{today_date}}` ← data de hoje no timezone do automatismo, formatada `DD/MM/YYYY`
- `{{current_year}}` ← ano corrente (ex: `'2026'`)

#### Scenario: Execução em 2026-04-14
- **WHEN** o helper é invocado em 2026-04-14 com timezone `Europe/Lisbon`
- **THEN** `today_date='14/04/2026'` e `current_year='2026'`

### Requirement: Reutilização pelo spawner e envio manual

O helper SHALL ser stateless e reutilizável em qualquer contexto server-side (spawner, APIs REST, future send-now feature).

#### Scenario: Uso no spawner
- **WHEN** o spawner cria um run para automatismo com contacto + negócio
- **THEN** chama o helper e coloca o resultado em `auto_runs.context.variables` antes de criar steps

#### Scenario: Uso hipotético em "enviar agora"
- **WHEN** um endpoint futuro "enviar agora" for adicionado
- **THEN** reutiliza o mesmo helper sem duplicar lógica

### Requirement: Valores string e não HTML-escaped

O helper SHALL devolver `Record<string, string>` com valores sempre em string. O processador que interpola (`resolveVariablesInString` existente) NOT SHALL fazer escape HTML — responsabilidade do template.

#### Scenario: Nome com caracteres especiais
- **WHEN** o contacto chama-se `"João & Maria"`
- **THEN** `contact_name='João & Maria'` — se o template é HTML, o autor do template escapa se necessário
