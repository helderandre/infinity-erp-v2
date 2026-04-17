## Why

O editor de templates de email (Craft.js) permite construir emails visualmente com 14 componentes e um sistema de variáveis rico, mas exige que o utilizador monte cada bloco manualmente. Para templates frequentes (aniversários, boas-vindas, propostas, follow-ups), o processo é repetitivo. Um assistente IA que gere o corpo do email a partir de uma descrição em linguagem natural — produzindo directamente a estrutura Craft.js com os componentes e variáveis correctos — elimina essa fricção e garante consistência visual.

## What Changes

- **Novo painel de chat IA** no editor de templates de email, acessível via botão na topbar, que abre um painel lateral com interface conversacional (ai-elements + AI SDK streaming).
- **Novo endpoint de streaming** `POST /api/libraries/emails/ai-generate` que recebe a instrução do utilizador e devolve um `editor_state` Craft.js válido em streaming, usando os componentes disponíveis (EmailHeading, EmailText, EmailButton, EmailDivider, EmailSpacer, EmailContainer, EmailGrid) e variáveis do sistema.
- **Injecção directa no editor** — o resultado da IA é deserializado e carregado no Craft.js Frame, preservando header e footer fixos.
- **Sugestões pré-definidas** para cenários comuns (Feliz Aniversário, Boas-vindas, Proposta de Imóvel, Follow-up, Festividade).
- **Instalação de dependências**: `ai`, `@ai-sdk/react`, `@ai-sdk/openai`, componentes ai-elements (message, conversation, prompt-input, suggestion, shimmer).

## Capabilities

### New Capabilities

- `ai-email-body-generator`: Assistente IA conversacional que gera o corpo (editor_state Craft.js) de templates de email a partir de instruções em linguagem natural, com streaming, sugestões e injecção directa no editor.

### Modified Capabilities

_(nenhuma — a funcionalidade é aditiva ao editor existente)_

## Impact

- **Frontend**: Novo painel lateral no `EmailEditorComponent`; novos componentes ai-elements instalados; topbar ganha botão "Gerar com IA".
- **Backend**: Novo route handler com streaming (`/api/libraries/emails/ai-generate`).
- **Dependências**: `ai`, `@ai-sdk/react`, `@ai-sdk/openai` + componentes ai-elements via CLI.
- **API keys**: Reutiliza `OPENAI_API_KEY` já existente no `.env.local`.
- **Editor Craft.js**: Novo método para carregar `editor_state` parcial (apenas body nodes) preservando header/footer.
