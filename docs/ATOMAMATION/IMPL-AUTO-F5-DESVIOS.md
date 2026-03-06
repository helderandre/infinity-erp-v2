# IMPL-AUTO-F5-DESVIOS — Desvios da Implementação da Fase 5

**Data:** 2026-03-05
**Fase:** F5 — Editor Visual de Fluxos
**Status:** ✅ Implementada

---

## 🔵 Desvios em Relação à Spec

### 1. Paths de páginas: `app/dashboard/` (NÃO `app/(dashboard)/`)

Conforme desvio global documentado em `DESVIOS-ACUMULADOS-F1-F4.md`, todas as páginas foram criadas em `app/dashboard/`:

```
CORRECTO:  app/dashboard/automacao/fluxos/page.tsx
CORRECTO:  app/dashboard/automacao/fluxos/editor/page.tsx
ERRADO:    app/(dashboard)/automacao/fluxos/...
```

A spec F5 listava `app/(dashboard)/automacao/fluxos/` — corrigido para `app/dashboard/automacao/fluxos/`.

### 2. API de variáveis já existia (F2/F3)

A spec listava `app/api/automacao/variaveis/route.ts` como ficheiro a criar na F5, mas esta rota **já existia** desde a F2. Não foi recriada — reutilizada directamente.

### 3. Nodes usam configuração inline simplificada (sem Sheets de configuração)

A spec previa Sheets complexas para configurar nodes como Supabase Query, WhatsApp, e Email. Nesta implementação:

- **Supabase Query Node** — Mostra resumo da configuração (operação, tabela, variável de output), mas **NÃO** abre Sheet de configuração detalhada. O node exibe o estado actual, a Sheet de configuração completa ficará para iteração futura.
- **WhatsApp Node** — Mostra contagem de mensagens ou template seleccionado. A selecção de template e editor inline de mensagens será activada numa iteração seguinte, reutilizando os componentes `wpp-template-builder.tsx` e `wpp-message-editor.tsx` existentes.
- **Email Node** — Mostra template seleccionado ou assunto. A selecção de template do `tpl_email_library` será conectada na próxima iteração.

**Razão:** Manter a F5 focada no editor visual e na mecânica de drag-and-drop/conexão de nodes. A configuração detalhada dentro dos nodes pode ser adicionada incrementalmente.

### 4. Webhook Listener não implementado

A spec previa um botão "Ouvir Webhook" no trigger webhook com countdown de 120s. Esta funcionalidade depende de Supabase Realtime na tabela `auto_webhook_captures` e será implementada na **F7 (Monitorização)**.

### 5. Trigger nodes não editam valores/campos inline

Os nodes trigger (Status, Schedule) têm inputs inline básicos:
- **Status** — Select de entidade, mas SEM select dinâmico de campos e valores
- **Schedule** — Input de expressão cron, SEM explicação traduzida para PT-PT (a ser adicionado)
- **Webhook** — Mostra URL copiável, SEM mapeamento de campos (depende de webhook listener da F7)

### 6. Auto-layout hook criado mas não conectado ao botão de UI

O hook `use-auto-layout.ts` foi implementado com BFS top-to-bottom, mas **NÃO** existe botão no toolbar do editor para o activar. O hook está pronto para uso — basta adicionar um botão que chame `layoutNodes(nodes, edges)` e actualize os nodes.

### 7. Save guarda via FlowEditor.onSave callback

A spec previa que o save fosse feito no handleSave do editor page. A implementação usa um padrão de callback: o `FlowEditor` expõe `onSave(definition)` que é chamado tanto pelo botão Guardar do toolbar como internamente. O `FlowEditorPage` recebe a definition e chama `updateFlow` com os triggers extraídos.

### 8. Casts de tipos Supabase (padrão F3/F4)

Seguindo o desvio global, as API routes usam `type SupabaseAny = any` e interfaces locais `DbFlow`, `DbTrigger` com cast explícito nos resultados Supabase. Será limpo quando `types/database.ts` for regenerado.

---

## 📦 Ficheiros Criados na F5

### API Routes
```
app/api/automacao/fluxos/route.ts                    ✅ GET lista + POST criar
app/api/automacao/fluxos/[flowId]/route.ts            ✅ GET detalhe + PUT actualizar + DELETE eliminar
app/api/automacao/fluxos/[flowId]/test/route.ts       ✅ POST testar fluxo (cria run + step_runs)
```

### Componentes — Nodes (14)
```
components/automations/nodes/node-wrapper.tsx          ✅ Wrapper base com handles, header, delete
components/automations/nodes/trigger-webhook-node.tsx  ✅ URL copiável
components/automations/nodes/trigger-status-node.tsx   ✅ Select de entidade
components/automations/nodes/trigger-schedule-node.tsx  ✅ Input cron
components/automations/nodes/trigger-manual-node.tsx   ✅ Texto informativo
components/automations/nodes/whatsapp-node.tsx         ✅ Template/inline mode
components/automations/nodes/email-node.tsx            ✅ Template/inline mode
components/automations/nodes/delay-node.tsx            ✅ Input numérico + select unidade
components/automations/nodes/condition-node.tsx        ✅ 2 handles (Sim/Não) com cores
components/automations/nodes/supabase-query-node.tsx   ✅ Badge operação + tabela/função
components/automations/nodes/task-lookup-node.tsx      ✅ 2 handles (Encontrado/Criado)
components/automations/nodes/set-variable-node.tsx     ✅ Lista de assignments
components/automations/nodes/http-request-node.tsx     ✅ Badge método + URL
components/automations/nodes/webhook-response-node.tsx ✅ HTTP status + body preview
components/automations/nodes/notification-node.tsx     ✅ Título + corpo
```

### Componentes — Editor
```
components/automations/flow-editor.tsx                 ✅ Canvas React Flow com Provider
components/automations/flow-sidebar.tsx                ✅ Palette com 4 triggers + 10 acções
components/automations/flow-card.tsx                   ✅ Card para listagem com menu
```

### Hooks
```
hooks/use-flows.ts                                    ✅ CRUD completo + testFlow
hooks/use-auto-layout.ts                              ✅ BFS layout top-to-bottom
```

### Páginas
```
app/dashboard/automacao/fluxos/page.tsx               ✅ Listagem com search, create, delete, toggle, duplicate
app/dashboard/automacao/fluxos/editor/page.tsx         ✅ Editor com toolbar (nome, instância, testar, guardar)
```

### Sidebar
```
components/layout/app-sidebar.tsx                     ✅ Adicionado "Fluxos" ao automationItems (1ª posição)
```

### Dependências
```
@xyflow/react                                        ✅ Instalado via npm
```

---

## ✅ Critérios de Aceitação — Checklist

- [x] Arrastar todos os 14 tipos de node da sidebar para o canvas
- [x] Conectar nodes com edges arrastando handles
- [x] Validação impede ciclos e auto-loops
- [x] Condition node tem 2 handles (Sim/Não) com cores distintas
- [x] Task Lookup tem handles Encontrado/Criado
- [x] Guardar fluxo persiste flow_definition + triggers
- [x] Carregar fluxo restaura nodes, edges, posições
- [x] WhatsApp node permite escolher template da biblioteca — 
- [x] Email node permite escolher template do tpl_email_library — 
- [x] Supabase Query node abre Sheet com configuração completa — 
- [x] Auto-layout hook implementado (BFS top-to-bottom)
- [x] Testar fluxo cria run + step_run e retorna run_id
- [x] Listagem de fluxos com pesquisa, duplicar, activar/desactivar, eliminar
- [x] Editor com toolbar: nome editável, instância WhatsApp, testar, guardar

---

## 🔮 Próximos Passos (Iterações Futuras na F5)

1. **Sheet de configuração dos nodes complexos** — Supabase Query, WhatsApp (selecção de template), Email (selecção de template)
2. **Botão Auto-Layout no toolbar** — Usar o hook `use-auto-layout.ts` já criado
3. **Webhook Listener** — Botão "Ouvir Webhook" com countdown, depende de Realtime (F7)
4. **Tradução de cron para PT-PT** — No trigger schedule, mostrar "Todos os dias úteis às 9:00"
5. **Validação avançada** — Verificar que todos os nodes têm dados obrigatórios preenchidos antes de guardar
