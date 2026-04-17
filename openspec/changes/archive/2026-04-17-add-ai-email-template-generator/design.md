## Context

O editor de templates de email usa Craft.js com 14 componentes registados (EmailContainer, EmailText, EmailHeading, EmailButton, EmailDivider, EmailSpacer, EmailGrid, EmailImage, EmailAttachment, EmailPortalLinks, EmailHeader, EmailFooter, EmailSignature, EmailPropertyGrid). Os templates são serializados como JSON (`editor_state`) onde cada nó tem `type.resolvedName`, `props`, `nodes[]` e `parent`. O header e footer são fixos e não devem ser regenerados pela IA.

O projecto já usa OpenAI SDK (GPT-4o/4o-mini) para várias funcionalidades de IA, mas não tem o Vercel AI SDK instalado. O utilizador quer usar **ai-elements** (componentes de chat shadcn-based) com **AI SDK streaming** (`useChat` + `streamText`).

Já existe um endpoint `/api/email/ai-draft` que gera texto simples para respostas de email — esta feature é diferente: gera a **estrutura Craft.js completa** (JSON com nós tipados) para o corpo do template.

## Goals / Non-Goals

**Goals:**
- Assistente IA conversacional no editor de templates que gera `editor_state` Craft.js válido
- Streaming da resposta via AI SDK (`useChat` + `streamText`) com UI ai-elements
- Suporte para variáveis do sistema (consultor, lead, imóvel, etc.) no conteúdo gerado
- Injecção do resultado no editor preservando header/footer fixos
- Sugestões rápidas para cenários comuns
- Interface em PT-PT

**Non-Goals:**
- Geração de imagens ou upload de media pela IA
- Edição iterativa conversacional (refinar bloco a bloco) — v1 gera o corpo completo
- Treino de modelo custom — usa GPT-4o com prompt engineering
- Substituição do editor visual — a IA é um ponto de partida, o utilizador continua a editar

## Decisions

### 1. AI SDK + ai-elements vs OpenAI SDK raw

**Decisão:** Instalar `ai`, `@ai-sdk/react`, `@ai-sdk/openai` e usar `useChat()` + `streamText()`.

**Alternativa considerada:** Continuar com OpenAI SDK raw + ReadableStream manual (padrão existente no projecto).

**Racional:** O utilizador pediu explicitamente ai-elements que requer AI SDK. O `useChat()` fornece gestão de estado de mensagens, streaming automático e integração nativa com os componentes ai-elements (Message, Conversation, PromptInput). O overhead de adicionar AI SDK é mínimo e coexiste com o OpenAI SDK existente.

### 2. Output da IA: JSON Craft.js estruturado

**Decisão:** A IA devolve um JSON com a estrutura de nós Craft.js (apenas os nós do body — sem header/footer/signature). O frontend recebe o JSON completo no final do stream e injeta no editor.

**Formato de resposta:**
```json
{
  "bodyNodes": {
    "body-root": {
      "type": { "resolvedName": "EmailContainer" },
      "isCanvas": true,
      "props": { "direction": "column", "padding": 24, "gap": 8 },
      "nodes": ["node-1", "node-2"],
      "linkedNodes": {},
      "parent": null
    },
    "node-1": {
      "type": { "resolvedName": "EmailHeading" },
      "props": { "html": "Feliz Aniversário, {{lead_name}}!", "level": "h2" },
      "nodes": [],
      "linkedNodes": {},
      "parent": "body-root"
    }
  }
}
```

**Alternativa considerada:** Devolver HTML simples e converter para Craft.js no frontend.

**Racional:** A conversão HTML→Craft.js seria frágil e perderia props específicas dos componentes (fontSize, boxShadow, borderRadius, etc.). Gerando directamente a estrutura Craft.js, garantimos fidelidade total ao que o editor espera. O GPT-4o é capaz de gerar JSON estruturado com `response_format: { type: "json_object" }`.

### 3. Streaming com extracção de JSON no final

**Decisão:** O endpoint usa `streamText()` do AI SDK. O stream envia texto conversacional (a IA "explica" o que está a fazer) e no final inclui o bloco JSON delimitado por marcadores `:::EMAIL_STATE_START:::` e `:::EMAIL_STATE_END:::`. O frontend faz parse do JSON quando detecta o marcador final.

**Alternativa considerada:** Usar `generateObject()` do AI SDK para output JSON puro.

**Racional:** `generateObject()` não suporta streaming parcial de forma user-friendly — o utilizador veria apenas um spinner até o JSON completo chegar. Com `streamText()`, a IA pode ir explicando as suas escolhas ("Vou usar um título com a variável do nome do lead, seguido de um texto personalizado...") enquanto o JSON é montado internamente. A experiência conversacional é muito melhor.

### 4. Painel lateral vs Dialog modal

**Decisão:** Painel lateral (sheet/drawer) no lado direito do editor, que coexiste com a área de edição visível.

**Alternativa considerada:** Dialog modal central.

**Racional:** O utilizador precisa de ver o editor enquanto interage com a IA para dar contexto visual. Um painel lateral permite side-by-side. Usa `Sheet` do shadcn/ui com largura ~400px.

### 5. Injecção no editor — substituição do body container

**Decisão:** Ao aplicar o resultado da IA, o frontend:
1. Obtém o `editor_state` actual via `query.serialize()`
2. Identifica os nós fixos (header, footer, signature) pelos `resolvedName`
3. Remove todos os nós do body container (entre header e footer)
4. Insere os novos nós gerados pela IA no body container
5. Carrega o estado resultante via `actions.deserialize()`

**Racional:** Preserva header/footer/signature intactos e substitui apenas o conteúdo editável. O Craft.js tem API para deserializar estado completo.

### 6. Componentes ai-elements a instalar

**Decisão:** Instalar: `message`, `conversation`, `prompt-input`, `suggestion`, `shimmer`.

**Racional:** São os componentes mínimos necessários para uma interface conversacional com streaming. O `shimmer` dá feedback visual durante a geração.

## Risks / Trade-offs

- **[JSON inválido da IA]** → Mitigação: validação com try/catch no parse; se falhar, mostrar toast de erro e permitir retry. Usar `response_format: { type: "json_object" }` quando possível para forçar JSON válido.
- **[Componentes Craft.js desconhecidos pela IA]** → Mitigação: system prompt detalhado com todos os componentes, props e exemplos. Limitar a IA aos componentes de body (excluir Header, Footer, Signature, Attachment, PortalLinks, PropertyGrid que dependem de dados externos).
- **[Custo de tokens]** → Mitigação: usar GPT-4o-mini por defeito (mais barato); o system prompt com schema dos componentes será ~2000 tokens.
- **[Conflito de IDs de nós]** → Mitigação: gerar UUIDs únicos no frontend antes de injectar, re-mapeando os IDs do JSON da IA. Reutilizar a função `sanitizeEditorState()` já existente.
- **[AI SDK + OpenAI SDK coexistência]** → Trade-off aceite: duas SDKs para OpenAI no projecto. O AI SDK é usado apenas para esta feature e futuras features de chat; o OpenAI SDK continua para as features existentes.
