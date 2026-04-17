## ADDED Requirements

### Requirement: Botão de geração IA na topbar do editor

O editor de templates de email SHALL exibir um botão "Gerar com IA" (ícone Sparkles) na topbar, à esquerda do botão Guardar. Ao clicar, SHALL abrir um painel lateral (Sheet) no lado direito com a interface de chat IA.

#### Scenario: Abrir painel IA
- **WHEN** o utilizador clica no botão "Gerar com IA" na topbar
- **THEN** um Sheet abre no lado direito com largura ~420px contendo a interface conversacional

#### Scenario: Fechar painel IA
- **WHEN** o utilizador clica no botão de fechar ou fora do Sheet
- **THEN** o painel fecha e o estado da conversa é mantido em memória para a sessão

---

### Requirement: Interface conversacional com ai-elements

O painel lateral SHALL usar componentes ai-elements (Conversation, Message, PromptInput) integrados com o hook `useChat()` do AI SDK para streaming de mensagens.

#### Scenario: Enviar instrução
- **WHEN** o utilizador escreve uma instrução (ex: "Cria um email de feliz aniversário") e submete
- **THEN** a mensagem aparece como mensagem do utilizador e a resposta da IA é streamada em tempo real com efeito shimmer

#### Scenario: Resposta da IA com preview
- **WHEN** a IA termina de gerar a resposta
- **THEN** a mensagem da IA SHALL conter: (1) texto explicativo do que foi gerado, (2) um botão "Aplicar ao editor" para injectar o resultado no Craft.js

#### Scenario: Estado vazio com sugestões
- **WHEN** o painel abre sem mensagens anteriores
- **THEN** SHALL mostrar um estado vazio com título, descrição e sugestões clicáveis (componente Suggestion)

---

### Requirement: Sugestões pré-definidas

O painel SHALL exibir sugestões rápidas para cenários comuns quando não há mensagens na conversa.

#### Scenario: Lista de sugestões
- **WHEN** a conversa está vazia
- **THEN** SHALL mostrar pelo menos estas sugestões: "Email de Feliz Aniversário", "Boas-vindas a novo cliente", "Proposta de imóvel", "Follow-up após visita", "Email de Feliz Natal"

#### Scenario: Clicar numa sugestão
- **WHEN** o utilizador clica numa sugestão
- **THEN** o texto da sugestão é enviado como mensagem do utilizador e a IA inicia a geração

---

### Requirement: Endpoint de streaming para geração de email

O sistema SHALL expor `POST /api/libraries/emails/ai-generate` que recebe instruções e devolve uma resposta em streaming via AI SDK `streamText()`.

#### Scenario: Request válido
- **WHEN** o endpoint recebe `{ messages: Message[] }` com pelo menos uma mensagem do utilizador
- **THEN** SHALL retornar um stream com texto conversacional da IA seguido de um bloco JSON delimitado por `:::EMAIL_STATE_START:::` e `:::EMAIL_STATE_END:::`

#### Scenario: System prompt com componentes
- **WHEN** o endpoint processa um pedido
- **THEN** o system prompt SHALL incluir a lista completa de componentes Craft.js disponíveis para o body (EmailContainer, EmailText, EmailHeading, EmailButton, EmailDivider, EmailSpacer, EmailGrid), as suas props com valores por defeito, e a lista de variáveis disponíveis (consultor, imóvel, lead, negócio, processo, proprietário, sistema)

#### Scenario: Autenticação
- **WHEN** o endpoint recebe um pedido sem sessão autenticada
- **THEN** SHALL retornar 401 Unauthorized

---

### Requirement: Formato de output JSON (editor_state parcial)

A IA SHALL gerar um JSON válido representando apenas os nós do corpo do email (excluindo header, footer, signature). O JSON segue a estrutura Craft.js.

#### Scenario: Estrutura de nós válida
- **WHEN** a IA gera o corpo do email
- **THEN** o JSON SHALL conter um nó raiz `EmailContainer` com `direction: "column"` e filhos que são componentes válidos (EmailHeading, EmailText, EmailButton, EmailDivider, EmailSpacer, EmailContainer, EmailGrid)

#### Scenario: Uso de variáveis
- **WHEN** a instrução do utilizador implica dados dinâmicos (nome do cliente, referência do imóvel, etc.)
- **THEN** a IA SHALL usar variáveis no formato `{{variable_key}}` dentro das props `html` dos componentes de texto (ex: `{{lead_name}}`, `{{imovel_ref}}`)

#### Scenario: Componentes excluídos
- **WHEN** a IA gera o body
- **THEN** NÃO SHALL incluir nós de tipo EmailHeader, EmailFooter, EmailSignature, EmailAttachment, EmailPortalLinks ou EmailPropertyGrid (estes dependem de dados externos ou são fixos)

---

### Requirement: Injecção do resultado no editor Craft.js

Ao clicar "Aplicar ao editor", o sistema SHALL substituir o conteúdo do body container no editor Craft.js pelos nós gerados pela IA, preservando header, footer e signature.

#### Scenario: Aplicar com sucesso
- **WHEN** o utilizador clica "Aplicar ao editor" numa resposta da IA
- **THEN** o sistema SHALL: (1) serializar o estado actual, (2) identificar os nós fixos (header, footer, signature), (3) remover os nós do body container, (4) inserir os novos nós com IDs únicos gerados, (5) deserializar o estado resultante no editor

#### Scenario: Confirmação antes de sobrescrever
- **WHEN** o body container já tem conteúdo (não está vazio) e o utilizador clica "Aplicar ao editor"
- **THEN** SHALL mostrar um AlertDialog de confirmação: "O conteúdo actual do corpo do email será substituído. Pretende continuar?"

#### Scenario: Erro de parse JSON
- **WHEN** o JSON gerado pela IA é inválido
- **THEN** SHALL mostrar toast de erro "Erro ao processar a resposta da IA. Tente novamente." e não alterar o editor

---

### Requirement: Variáveis disponíveis no system prompt

O system prompt SHALL incluir a lista completa de variáveis que podem ser usadas nos templates.

#### Scenario: Categorias de variáveis
- **WHEN** o system prompt é construído
- **THEN** SHALL incluir variáveis agrupadas por categoria: Consultor (`consultant_name`, `consultant_email`, `consultant_phone`, `consultant_phone2`), Imóvel (`property_typology`, `property_type`, `property_ref`, `property_title`, `property_address`, `property_price`, `property_area`, `property_energy_cert`), Lead (`lead_name`, `lead_email`, `lead_phone`, `lead_mobile`, `lead_source`, `lead_status`, `lead_temperature`), Negócio (`deal_type`, `deal_status`, `deal_budget`), Processo (`process_ref`), Proprietário (`owner_name`, `owner_email`, `owner_phone`, `owner_address`), Sistema (`current_time`, `current_date`, `company_name`)
