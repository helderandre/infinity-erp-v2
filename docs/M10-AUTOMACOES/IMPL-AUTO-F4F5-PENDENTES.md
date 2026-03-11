# IMPL-AUTO-F4F5-PENDENTES — Implementação dos Itens Adiados das Fases 4 e 5

**Data de implementação:** 2026-03-05
**Status:** ✅ CONCLUÍDA (8/8 itens)
**Spec de referência:** [SPEC-AUTO-F4F5-PENDENTES.md](SPEC-AUTO-F4F5-PENDENTES.md)
**Build:** ✅ Compilado com sucesso (`npx next build` — 58s, sem erros)

---

## Resumo da Implementação

Todos os 8 itens pendentes (P1–P8) da spec foram implementados. A tabela abaixo resume o estado final:

| # | Item | Prioridade | Status | Desvios? |
|---|------|-----------|--------|----------|
| P1 | Sheet Supabase Query Node | 🔴 Alta | ✅ | Não |
| P2 | WhatsApp Node Template Select | 🔴 Alta | ✅ | Menor |
| P3 | Email Node Template + API | 🔴 Alta | ✅ | Não |
| P4 | Botão Auto-Layout | 🟠 Média | ✅ | Menor |
| P5 | Webhook Listener 120s | 🟠 Média | ✅ | Parcial |
| P6 | Preview WPP com Lead Real | 🟡 Baixa | ✅ | Menor |
| P7 | Tradução Cron PT-PT | 🟡 Baixa | ✅ | Não |
| P8 | Validação antes de Guardar | 🟠 Média | ✅ | Menor |

---

## Ficheiros Criados / Modificados

### Ficheiros Novos (4)

| Ficheiro | Linhas | Descrição |
|----------|--------|-----------|
| `app/api/automacao/email-templates/route.ts` | 24 | API GET para listar templates de email da `tpl_email_library` |
| `app/api/webhook/[key]/route.ts` | 47 | Webhook receiver mínimo (POST grava em `auto_webhook_captures`, GET health check) |
| `hooks/use-webhook-test-listener.ts` | 95 | Hook Realtime para escutar `auto_webhook_captures` com countdown de 120s |
| `components/automations/webhook-json-tree.tsx` | 134 | Componente de árvore JSON colapsável com syntax coloring |

### Ficheiros Reescritos (4)

| Ficheiro | Linhas | Descrição |
|----------|--------|-----------|
| `components/automations/nodes/supabase-query-node.tsx` | 524 | Sheet completa com formulário dinâmico por operação |
| `components/automations/nodes/whatsapp-node.tsx` | 349 | Modo Template/Inline com Sheet, fetch de API, DnD |
| `components/automations/nodes/email-node.tsx` | 305 | Modo Template/Inline com Sheet, variable picker, API fetch |
| `components/automations/nodes/trigger-webhook-node.tsx` | 149 | 4 estados visuais: idle/listening/received/timeout |

### Ficheiros Editados (3)

| Ficheiro | Linhas | Alterações |
|----------|--------|------------|
| `components/automations/flow-editor.tsx` | 395 | +`Panel` import, +`useAutoLayout`, +`validateFlow()`, +`handleAutoLayout`, botão "Organizar" |
| `components/automations/nodes/trigger-schedule-node.tsx` | 60 | +`describeCron()` com tradução PT-PT |
| `components/automations/wpp-template-builder.tsx` | 348 | +Dropdown de leads reais, +`leadToVariables()`, fetch `/api/leads?limit=20` |

---

## Detalhes por Item

### ✅ P1. Sheet de Configuração do Supabase Query Node

**Ficheiro:** `components/automations/nodes/supabase-query-node.tsx` (524 linhas)

**Implementação conforme spec:**

- Botão "Configurar" no node abre `Sheet` lateral (shadcn `Sheet` + `SheetContent`)
- Select de operação com 6 opções e labels PT-PT: Consultar, Inserir, Actualizar, Inserir/Actualizar, Remover, Função
- Campos dinâmicos por operação:
  - **select/update/delete:** Input Tabela, Input Colunas (só select, default `*`), lista dinâmica de filtros com `[coluna] [operador ▼] [valor/{{variável}}]`, Checkbox "Resultado único", Input Limite
  - **insert/upsert:** Input Tabela, lista dinâmica de dados `[coluna] = [valor]`, Input Conflito (só upsert)
  - **rpc:** Input Nome da função, lista de parâmetros `[nome] = [valor]` + select de tipo (text/uuid/int/jsonb)
- Operadores de filtro: `eq` (=), `neq` (≠), `gt` (>), `lt` (<), `gte` (≥), `lte` (≤), `like` (contém), `is` (é nulo)
- Variable picker integrado em cada campo de valor (usa `VariablePicker` existente)
- Input "Guardar resultado em" para variável de saída
- Botão "Guardar" chama `updateNodeData(id, {...})` e fecha Sheet
- Badge no node mostra operação + tabela/função

**Desvios:** Nenhum.

---

### ✅ P2. WhatsApp Node — Selecção de Template

**Ficheiro:** `components/automations/nodes/whatsapp-node.tsx` (349 linhas)

**Implementação conforme spec:**

- Toggle "Template" / "Inline" via botões no topo da Sheet
- **Modo Template:**
  - Fetch de `GET /api/automacao/templates-wpp?active=true` quando a Sheet abre
  - Lista de templates com nome, descrição e contagem de mensagens
  - Ao selecionar: guarda `templateId` + `templateName`, limpa `messages`
  - Badge de "template activo" no node
  - Botão "Ver template →" abre nova tab para o editor do template
- **Modo Inline:**
  - Reutiliza `WppMessageCard` + `WppMessageEditor` da F4
  - DnD com `@dnd-kit/core` + `@dnd-kit/sortable` para reordenar mensagens
  - Botão "+ Mensagem" abre `WppMessageEditor` em Sheet
  - Contagem de mensagens + ícones de tipo no node

**Desvio menor:**
- A spec mencionava "Select/Combobox pesquisável" mas foi implementada como lista clicável dentro da Sheet (mais intuitivo para poucos templates). Cada template é um `<button>` com badge de contagem e ícone de check quando seleccionado. A funcionalidade de pesquisa ficou para iteração futura quando houver dezenas de templates.

---

### ✅ P3. Email Node — Selecção de Template + API

**Ficheiros:**
- `components/automations/nodes/email-node.tsx` (305 linhas)
- `app/api/automacao/email-templates/route.ts` (24 linhas) — **NOVO**

**Implementação conforme spec:**

- **API Route criada:** `GET /api/automacao/email-templates` consulta `tpl_email_library` com campos `id, name, subject, description`, ordenada por nome
- Toggle "Template" / "Inline"
- **Modo Template:** Select com templates carregados da API, mostra nome + assunto
- **Modo Inline:** Input "Assunto" + Textarea "Corpo HTML" — ambos com `VariablePicker`
- **Destinatário:** `VariablePicker` para selecionar variável de email
- Node mostra: template selecionado ou assunto do email + badge de destinatário

**Desvios:** Nenhum.

---

### ✅ P4. Botão Auto-Layout no Toolbar

**Ficheiro:** `components/automations/flow-editor.tsx` (linhas adicionadas: ~25)

**Implementação:**

- Importado `Panel` do `@xyflow/react` + `useAutoLayout` do hook existente + `Button` + `LayoutGrid` icon
- `handleAutoLayout()` converte nodes/edges para tipos do automation-flow, chama `layoutNodes()`, actualiza `setNodes()`, e chama `fitView({ padding: 0.2 })` após 100ms
- Botão "Organizar" dentro de `<Panel position="top-right">` no canvas do ReactFlow

**Desvio menor:**
- A spec sugeria colocar o botão no **toolbar da página** (`editor/page.tsx`) ao lado de "Guardar". Foi colocado como `<Panel>` dentro do **ReactFlow canvas** em `flow-editor.tsx` porque:
  1. O `FlowEditorInner` é o componente que tem acesso directo a `nodes`, `edges`, `setNodes` e `fitView`
  2. A página (`editor/page.tsx`) não expõe esses estados — seria necessário criar um ref/callback pattern complexo
  3. O `<Panel>` do ReactFlow é o padrão recomendado pela biblioteca para botões de controlo do canvas
- O resultado visual é equivalente: botão "Organizar" com ícone `LayoutGrid` no canto superior direito do canvas

---

### ✅ P5. Webhook Listener no Trigger Node (Countdown 120s)

**Ficheiros:**
- `hooks/use-webhook-test-listener.ts` (95 linhas) — **NOVO**
- `components/automations/webhook-json-tree.tsx` (134 linhas) — **NOVO**
- `app/api/webhook/[key]/route.ts` (47 linhas) — **NOVO**
- `components/automations/nodes/trigger-webhook-node.tsx` (149 linhas) — **REESCRITO**

**Implementação:**

**Hook `useWebhookTestListener`:**
- `startListening(webhookKey)` → cria canal Supabase Realtime com filtro `source_id=eq.${webhookKey}` na tabela `auto_webhook_captures`
- Escuta eventos `postgres_changes` (event: `*`) para capturar INSERT e UPDATE
- Countdown de 120s com `setInterval` de 1s
- Ao receber payload → state `"received"` + armazena capture
- Timeout → state `"timeout"` + cleanup automático
- Expostos: `state`, `countdown`, `capture`, `startListening`, `stopListening`, `reset`
- Cleanup completo no unmount (remove canal + clears interval)

**Webhook JSON Tree:**
- Componente recursivo `<JsonNode>` com tipos coloridos:
  - String: `amber`, Number: `emerald`, Boolean: `blue`, Null: `orange`
- Objectos e arrays são colapsáveis com `ChevronRight`/`ChevronDown`
- Auto-expande até profundidade 2
- Max height 256px com overflow scroll

**Webhook Receiver (`app/api/webhook/[key]/route.ts`):**
- `POST` recebe payload (JSON ou text), busca trigger associado por `trigger_source` + `source_type=webhook`, grava upsert em `auto_webhook_captures`
- `GET` retorna health check `{ ok: true }`
- Usa `createAdminClient()` com cast `SupabaseAny`

**Trigger Webhook Node — 4 estados visuais:**
- **Idle:** URL copiável + botão "Ouvir Webhook"
- **Listening:** Dot pulsante amarelo (CSS `animate-ping`) + countdown `Xs` + botão "Parar"
- **Received:** ✅ "Webhook recebido!" + `<WebhookJsonTree>` do payload + botão "Ouvir novamente"
- **Timeout:** "Nenhum webhook recebido em 120s" + botão "Tentar novamente"

**Desvios parciais:**

1. **`webhook-field-mapper.tsx` NÃO criado** — A spec mencionava criar `components/automations/webhook-field-mapper.tsx` para mapeamento `path → variável`. Este componente **não foi implementado** nesta iteração. O mapeamento de campos do webhook para variáveis do fluxo é uma funcionalidade mais complexa que será necessária na F6 (Motor de Execução) quando os webhooks precisarem alimentar variáveis. O componente `webhook-json-tree.tsx` serve apenas para inspecção visual do payload.

2. **Botão "Usar como exemplo" não implementado** — A spec mencionava um botão "Usar como exemplo" no estado `received` que gravaria o payload como `samplePayload` no node data. Foi substituído por "Ouvir novamente" que simplesmente reinicia o listener. O `samplePayload` pode ser implementado quando o field-mapper for criado.

3. **Receiver é versão mínima** — Conforme indicado na spec, o receiver criado é a "versão mínima para teste" que apenas grava o payload. A versão completa (que dispara a execução do fluxo) será criada na F6.

---

### ✅ P6. Preview WhatsApp com Dropdown de Lead Real

**Ficheiro:** `components/automations/wpp-template-builder.tsx` (348 linhas)

**Implementação:**

- Fetch de leads: `GET /api/leads?limit=20` no `useEffect` do mount
- Interface `PreviewLead` com campos: `id, nome, email, telefone, telemovel, origem, estado, temperatura`
- Função `leadToVariables(lead)` mapeia campos do lead para variáveis do template (merge com `SAMPLE_VALUES` para manter variáveis não-lead como `consultor_nome`, `imovel_ref`, etc.)
- `Select` com opção "Dados de exemplo" (default) + lista de leads reais com `nome (email)`
- Ao selecionar um lead: `previewVariables` actualizam e o `WppPreview` re-renderiza com dados reais
- `contactName` do preview também actualiza para o nome do lead

**Desvio menor:**
- A spec sugeria o endpoint `/api/leads?limit=20&fields=id,nome,email,telefone,telemovel,origem,estado,temperatura` — o parâmetro `fields` **não existe** na API de leads actual. O fetch usa apenas `?limit=20` e a API retorna todos os campos do lead (formato `{ data: [...], total: N }`). Os campos necessários são extraídos no frontend via a interface `PreviewLead`. Isto é aceitável porque são apenas 20 registos.
- A spec usava `data.leads` no response — a API real retorna `data.data`, o que foi corrigido no código: `.then((json) => setLeads(json.data || []))`.

---

### ✅ P7. Tradução de Cron para PT-PT

**Ficheiro:** `components/automations/nodes/trigger-schedule-node.tsx` (60 linhas)

**Implementação conforme spec:**

- Função `describeCron(expression)` com split por whitespace e validação de 5 partes
- Casos cobertos:
  - `* * * * *` → "A cada minuto"
  - `0 0 * * *` → "Todos os dias à meia-noite" (adicionado, não estava na spec)
  - `*/N * * * *` → "A cada N minutos"
  - `*/N` no campo hora → "A cada N horas" (adicionado)
  - `H M * * 1-5` → "Seg a Sex às H:MM"
  - `H M * * 1` → "Todas as segundas às H:MM"
  - `H M * * 0` → "Todos os domingos às H:MM" (adicionado)
  - `H M * * *` → "Todos os dias às H:MM"
  - Fallback: `Cron: <expressão>`
- Substitui o antigo texto `Expressão cron: ...` pela descrição traduzida

**Desvios:** Nenhum. Foram adicionados 3 casos extra (`meia-noite`, `a cada N horas`, `domingos`) além dos da spec para melhor cobertura.

---

### ✅ P8. Validação Avançada antes de Guardar

**Ficheiro:** `components/automations/flow-editor.tsx` (adicionadas ~45 linhas)

**Implementação:**

- Função `validateFlow(flowNodes, flowEdges)` retorna array de erros em PT-PT
- Validações implementadas:
  1. ✅ Pelo menos 1 trigger (`"O fluxo precisa de pelo menos um gatilho"`)
  2. ✅ Trigger webhook sem `webhookKey` configurada
  3. ✅ Trigger status sem `entity_type` em `triggerCondition`
  4. ✅ Trigger schedule sem `cronExpression`
  5. ✅ Nodes WhatsApp sem `templateId` nem `messages` configuradas
  6. ✅ Nodes Condição sem `rules` definidas
  7. ✅ Nodes não-trigger desconectados (sem edge de entrada ou saída)
- Chamada no início do `handleSave`: se houver erros, cada um é mostrado via `toast.error()` e o save é abortado

**Desvio menor:**
- A spec incluía validação **"3. WhatsApp node deve ter instância"** (`wppInstanceId`). Esta validação **não foi incluída no `validateFlow()`** dentro do `flow-editor.tsx` porque o `FlowEditorInner` não tem acesso a `wppInstanceId` — esse estado vive na página pai (`editor/page.tsx`). A validação de instância WhatsApp **já existia** no `handleSave` da página e continua a funcionar: `if (hasWppNode && !wppInstanceId) { toast.error(...); return }`. Portanto, a validação está coberta, apenas dividida entre dois níveis.

---

## Dependências e Compatibilidade

### Sem novas dependências

Todas as implementações utilizam pacotes já instalados:
- `@xyflow/react` (Panel, ReactFlow, useReactFlow)
- `@dnd-kit/core`, `@dnd-kit/sortable` (drag-and-drop no WhatsApp node)
- `@supabase/supabase-js` (Realtime channels)
- `sonner` (toasts de validação)
- `lucide-react` (LayoutGrid, Radio, Square, RotateCcw, etc.)
- `shadcn/ui` (Sheet, Select, Button, Input, Checkbox, Badge, Separator)

### Tabelas Supabase utilizadas

| Tabela | Operação | Item |
|--------|----------|------|
| `auto_webhook_captures` | Realtime subscribe + upsert | P5 |
| `auto_triggers` | select (buscar trigger por key) | P5 |
| `auto_flows` | select (nome do fluxo, via join) | P5 |
| `tpl_email_library` | select (listar templates) | P3 |
| `leads` | select (últimos 20 para preview) | P6 |

### APIs existentes utilizadas

| Endpoint | Método | Item |
|----------|--------|------|
| `/api/automacao/templates-wpp?active=true` | GET | P2 |
| `/api/automacao/variaveis` | GET | P1, P3 (via VariablePicker) |
| `/api/leads?limit=20` | GET | P6 |

### APIs novas criadas

| Endpoint | Método | Item |
|----------|--------|------|
| `/api/automacao/email-templates` | GET | P3 |
| `/api/webhook/[key]` | POST, GET | P5 |

---

## Itens Adiados para Iterações Futuras

| Item | Razão | Quando implementar |
|------|-------|--------------------|
| `webhook-field-mapper.tsx` (mapeamento path → variável) | Complexidade alta, depende do motor de execução para ser útil | F6 ou F7 |
| Botão "Usar como exemplo" no webhook received | Depende do field-mapper para ter valor prático | F6 ou F7 |
| Combobox pesquisável para templates WPP | Com poucos templates, a lista simples é suficiente | Quando houver >20 templates |
| Parâmetro `fields` na API de leads | Optimização de payload, não bloqueante | Quando necessário |
| Pills visuais para variáveis (em vez de `{{texto}}`) | Conforme regras globais da spec, adiado | Iteração futura |

---

## Notas Técnicas

### Padrão de acesso a `node.data` no ReactFlow

Todos os nodes usam cast `data as unknown as XxxNodeData` porque o ReactFlow tipifica `data` como `Record<string, unknown>`. Este é o padrão usado em toda a codebase (consistente com F4/F5).

### Validação dividida entre page e flow-editor

A validação P8 está dividida:
- **`flow-editor.tsx` → `validateFlow()`:** Valida estrutura do grafo (triggers, configuração dos nodes, conectividade)
- **`editor/page.tsx` → `handleSave()`:** Valida instância WhatsApp (`wppInstanceId`) — este check já existia antes de P8

Esta divisão é intencional porque `FlowEditorInner` não tem acesso ao estado de `wppInstanceId` que vive na página.

### Auto-layout como Panel vs Toolbar

O botão "Organizar" foi colocado como `<Panel position="top-right">` dentro do ReactFlow em vez de no toolbar da página. Isto é o padrão recomendado pela documentação do ReactFlow para botões que operam sobre o canvas. Seria necessário um pattern de ref/callback para expor `nodes/edges/setNodes` à página, o que adicionaria complexidade sem benefício funcional.

### Webhook receiver — versão mínima

O `app/api/webhook/[key]/route.ts` é intencionalmente mínimo:
- Aceita JSON e text/plain
- Grava em `auto_webhook_captures` via upsert (PK = `source_id`)
- **Não dispara execução de fluxo** — isso será feito na F6 (Motor de Execução)
- O `GET` serve como health check para verificar se o endpoint está activo
