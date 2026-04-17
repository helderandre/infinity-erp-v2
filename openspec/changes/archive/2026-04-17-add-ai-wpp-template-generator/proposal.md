## Why

O editor de templates WhatsApp permite construir sequências de mensagens (texto, imagem, vídeo, áudio, documento) com variáveis e delays, mas exige montagem manual mensagem a mensagem. Para cenários comuns (aniversários, boas-vindas, follow-ups, Natal), o processo é repetitivo. Um assistente IA que gere a sequência completa de mensagens a partir de uma descrição em linguagem natural — com tom pessoal, variáveis e delays adequados — elimina essa fricção, tal como já foi feito para os templates de email.

## What Changes

- **Novo input inline IA** no editor de templates WhatsApp (`WppTemplateBuilder`), idêntico ao do editor de email: input flutuante no fundo com sugestões, ditado por voz (Web Speech API), e estado "A gerar..." com Border Beam.
- **Novo endpoint de streaming** `POST /api/automacao/templates-wpp/ai-generate` que recebe a instrução do utilizador e devolve metadados (nome, descrição, categoria) + array de `WhatsAppTemplateMessage[]` em streaming.
- **Injecção directa no builder** — o resultado da IA substitui as mensagens actuais do template, preenchendo também nome, descrição e categoria.
- **Contexto do consultor** — quando `scope=consultant`, busca dados do consultor para personalizar o tom (1ª pessoa, dados pessoais).
- **Contexto por categoria** — instruções específicas por tipo de evento (aniversário, Natal, etc.).

## Capabilities

### New Capabilities

- `ai-wpp-body-generator`: Assistente IA que gera a sequência de mensagens WhatsApp (texto com formatação, delays entre mensagens, variáveis) a partir de instruções em linguagem natural, com streaming e injecção directa no builder.

### Modified Capabilities

_(nenhuma — a funcionalidade é aditiva ao builder existente)_

## Impact

- **Frontend**: Novo input inline no `WppTemplateBuilder`; botão "Gerar com IA" na topbar do builder.
- **Backend**: Novo route handler com streaming (`/api/automacao/templates-wpp/ai-generate`).
- **Dependências**: Nenhuma nova — reutiliza `ai`, `@ai-sdk/openai`, `border-beam` já instalados.
- **API keys**: Reutiliza `OPENAI_API_KEY` já existente.
- **Padrão reutilizado**: Mesmo padrão do email AI generate (endpoint streaming + input inline + BorderBeam + sugestões + voz).
