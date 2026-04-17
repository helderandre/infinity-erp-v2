## 1. Endpoint de Streaming (`/api/automacao/templates-wpp/ai-generate`)

- [x] 1.1 Criar `app/api/automacao/templates-wpp/ai-generate/route.ts` com autenticação Supabase e validação do body (`prompt`, `scope?`, `category?`)
- [x] 1.2 Construir system prompt com: tipos de mensagem WhatsApp (text only v1), formatação (*bold*, _italic_, ~strike~, emojis), variáveis disponíveis, regras de delay, limite de 2-5 mensagens, formato JSON com delimitadores `:::WPP_META_START/END:::` + `:::WPP_MESSAGES_START/END:::`
- [x] 1.3 Quando scope=consultant, buscar dados do consultor (nome, bio, especializações, telefone) e instruir para 1ª pessoa com tom pessoal
- [x] 1.4 Contexto por categoria (aniversário, Natal, etc.) com instruções específicas
- [x] 1.5 Implementar `streamText()` com `toTextStreamResponse()` (AI SDK v6)

## 2. Utilitário de Parsing

- [x] 2.1 Criar `lib/automacao/wpp-ai-parser.ts` com funções `extractWppMeta(text)` e `extractWppMessages(text)` + `extractWppAiResult(text)` que extrai metadados + array de mensagens dos delimitadores
- [x] 2.2 Validar e sanitizar mensagens: gerar `id` único (crypto.randomUUID) para cada mensagem, garantir `type: "text"`, limpar conteúdo

## 3. Input Inline IA no Builder

- [x] 3.1 Criar `components/automations/wpp-ai-generate-input.tsx` seguindo o padrão do email: input flutuante com sugestões por categoria, textarea, ditado por voz (Web Speech API), botão enviar, BorderBeam no estado "A gerar..."
- [x] 3.2 Ao submeter: chamar endpoint, ler stream, extrair JSON, injectar mensagens no builder e preencher nome/descrição/categoria
- [x] 3.3 Confirmação antes de substituir se já existem mensagens

## 4. Integração no Builder

- [x] 4.1 Adicionar botão "Gerar com IA" (Sparkles) na topbar do `WppTemplateBuilder`
- [x] 4.2 Montar `WppAiGenerateInput` no builder com estado visible/hidden controlado pelo botão
- [x] 4.3 Ler query params `scope` e `category` na página do editor e passar ao input IA
- [x] 4.4 Callback `onAiResult` que substitui `messages[]` + preenche nome/descrição/categoria no form

## 5. Testes e Polimento

- [x] 5.1 Testar geração com diferentes instruções e verificar que as mensagens são válidas
- [x] 5.2 Testar formatação WhatsApp (*bold*, _italic_, emojis) no preview
- [x] 5.3 Testar delays entre mensagens no preview
- [x] 5.4 Garantir que toda a UI está em PT-PT
