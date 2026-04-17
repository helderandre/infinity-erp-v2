## ADDED Requirements

### Requirement: Input inline IA no builder de templates WhatsApp

O builder de templates WhatsApp SHALL exibir um botão "Gerar com IA" (ícone Sparkles) na topbar. Ao clicar, SHALL mostrar um input inline flutuante no fundo da área de mensagens, idêntico ao do editor de email.

#### Scenario: Abrir input IA
- **WHEN** o utilizador clica no botão "Gerar com IA" na topbar
- **THEN** um input inline aparece no fundo com textarea, sugestões por categoria, botão de ditado e botão de envio

#### Scenario: Fechar input IA
- **WHEN** o utilizador clica no X ou pressiona Escape
- **THEN** o input desaparece

---

### Requirement: Sugestões dinâmicas por categoria

O input IA SHALL exibir sugestões rápidas quando a textarea está vazia.

#### Scenario: Sugestões por categoria
- **WHEN** a categoria do template é "aniversario_contacto"
- **THEN** SHALL mostrar sugestões como "Parabéns calorosos e pessoais", "Parabéns formal", etc.
- **WHEN** a categoria é geral ou não definida
- **THEN** SHALL mostrar sugestões genéricas

#### Scenario: Sugestões desaparecem ao escrever
- **WHEN** o utilizador começa a escrever no textarea
- **THEN** as sugestões desaparecem

---

### Requirement: Ditado por voz em tempo real

O input IA SHALL suportar ditado por voz via Web Speech API.

#### Scenario: Activar ditado
- **WHEN** o utilizador clica no botão do microfone
- **THEN** o reconhecimento de voz inicia e o texto aparece em tempo real no textarea

#### Scenario: Parar ditado
- **WHEN** o utilizador clica novamente no microfone
- **THEN** o reconhecimento para e o texto final permanece no textarea

---

### Requirement: Endpoint de streaming para geração WhatsApp

O sistema SHALL expor `POST /api/automacao/templates-wpp/ai-generate` que recebe instruções e devolve uma resposta em streaming.

#### Scenario: Request válido
- **WHEN** o endpoint recebe `{ prompt: string, scope?: string, category?: string }`
- **THEN** SHALL retornar um stream com dois blocos delimitados: metadados (`:::WPP_META_START/END:::`) e mensagens (`:::WPP_MESSAGES_START/END:::`)

#### Scenario: Formato das mensagens geradas
- **WHEN** a IA gera mensagens
- **THEN** cada mensagem SHALL ter: `type: "text"`, `content` com formatação WhatsApp (*bold*, _italic_, ~strike~, emojis), e `delay` em segundos (0 para a primeira, 2-5 para as seguintes)

#### Scenario: Contexto do consultor
- **WHEN** scope é "consultant"
- **THEN** o system prompt SHALL buscar dados do consultor na DB e instruir a IA para escrever na 1ª pessoa com tom pessoal

#### Scenario: Autenticação
- **WHEN** o endpoint recebe um pedido sem sessão autenticada
- **THEN** SHALL retornar 401

---

### Requirement: Injecção no builder com Border Beam

Ao gerar, o input SHALL transformar-se no estado "A gerar..." com Border Beam e preview de streaming.

#### Scenario: Estado de geração
- **WHEN** a geração inicia
- **THEN** o input transforma-se: mostra "A gerar template com IA...", Border Beam colorido à volta, e texto de preview em streaming

#### Scenario: Aplicação do resultado
- **WHEN** a geração termina com sucesso
- **THEN** as mensagens geradas SHALL substituir as mensagens actuais no builder, e nome/descrição/categoria SHALL ser preenchidos automaticamente

#### Scenario: Confirmação antes de substituir
- **WHEN** o builder já tem mensagens e o utilizador inicia uma geração
- **THEN** SHALL mostrar AlertDialog de confirmação antes de substituir

---

### Requirement: Variáveis disponíveis no conteúdo

A IA SHALL usar variáveis no formato `{{key}}` no conteúdo das mensagens.

#### Scenario: Categorias de variáveis
- **WHEN** a IA gera conteúdo
- **THEN** SHALL poder usar: consultor ({{consultor_nome}}, {{consultor_telefone}}), lead ({{lead_nome}}, {{lead_email}}), imóvel, negócio, processo, proprietário, sistema
