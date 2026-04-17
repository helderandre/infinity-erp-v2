## 1. Dependências e Setup

- [x] 1.1 Instalar AI SDK: `npm install ai @ai-sdk/react @ai-sdk/openai`
- [x] 1.2 Instalar componentes ai-elements: `npx ai-elements@latest add message conversation prompt-input suggestion shimmer`
- [x] 1.3 Verificar que os componentes ai-elements foram adicionados a `components/ai-elements/` e que os imports funcionam

## 2. Endpoint de Streaming (`/api/libraries/emails/ai-generate`)

- [x] 2.1 Criar `app/api/libraries/emails/ai-generate/route.ts` com autenticação Supabase e validação do body
- [x] 2.2 Construir o system prompt com componentes Craft.js, variáveis, formato JSON com delimitadores
- [x] 2.3 Corrigir para AI SDK v6: substituir `toDataStreamResponse()` por `toTextStreamResponse()` e eliminar rota `[chatId]/stream` duplicada
- [x] 2.4 Enriquecer system prompt com contexto do consultor (dados da DB) e categoria do template
- [x] 2.5 Gerar metadados (nome, assunto, categoria) além do corpo do email

## 3. Componente de Geração IA (v2 — Dialog simples)

- [x] 3.1 Reescrever `ai-generate-panel.tsx`: substituir Sheet+chat por Dialog simples com textarea + sugestões rápidas
- [x] 3.2 Ao submeter, fechar dialog, chamar endpoint, fazer parse do JSON e injectar directamente no editor via `injectAiBodyIntoEditorState` + `actions.deserialize()`
- [x] 3.3 Manter AlertDialog de confirmação quando body já tem conteúdo
- [x] 3.4 Tratar erros com toast (Sonner)
- [x] 3.5 Sugestões dinâmicas por categoria (aniversário, natal, etc.)
- [x] 3.6 Stream preview: mostrar texto da IA em tempo real no overlay do canvas

## 4. Parsing e Injecção no Editor

- [x] 4.1 Criar utilitário `lib/email/ai-state-injector.ts` com `injectAiBodyIntoEditorState`, `extractJsonFromStream`, `bodyHasContent`
- [x] 4.2 Gerar IDs únicos para cada nó do JSON da IA antes de injectar, re-mapeando referências parent/nodes
- [x] 4.3 Adicionar `extractMetaFromStream` e `extractAiResult` para extrair metadados + nós

## 5. Integração no Editor

- [x] 5.1 Botão "Gerar com IA" (Sparkles) na topbar com estado loading ("A gerar...")
- [x] 5.2 Border Beam colorido à volta do canvas durante geração (lib `border-beam`)
- [x] 5.3 Overlay com preview de texto em streaming + ícone animado
- [x] 5.4 Preenchimento automático de nome, assunto e categoria via metadados da IA
- [x] 5.5 Ler query params `scope` e `category` na página `novo` e passar ao editor/panel

## 6. Contexto do Consultor

- [x] 6.1 Quando scope=consultant, buscar dados do consultor (nome, bio, especializações, telefone) na DB
- [x] 6.2 Instruir a IA para escrever na 1ª pessoa com tom pessoal quando scope=consultant
- [x] 6.3 Instruir a IA para tom institucional quando scope=global
- [x] 6.4 Enriquecer prompts por tipo de evento (aniversário, natal, ano novo, etc.)
