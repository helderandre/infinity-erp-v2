# SPEC-AUTOMACOES-GERAL — Sistema de Automações do ERP Infinity

**Data:** 2026-03-05
**Status:** 🔵 A IMPLEMENTAR
**Dependências:** FASE 01 concluída, sistema de templates de email existente
**Prioridade:** Alta — Módulo transversal que servirá todos os funis do ERP

---

## 📋 Resumo Executivo

O sistema de automações do ERP Infinity é um motor de workflows visuais que permite aos utilizadores (consultores, gestores processuais, office managers) criar fluxos automatizados sem escrever código. Inspirado em ferramentas como Zapier e n8n, mas desenhado para o contexto imobiliário português, com UX adaptada a utilizadores leigos.

O sistema cobre 4 pilares:

1. **Editor Visual de Fluxos** — Canvas drag-and-drop com nodes conectáveis (React Flow)
2. **Motor de Execução** — Fila PostgreSQL nativa (pgmq) com modos síncrono e assíncrono
3. **Gestão de Instâncias WhatsApp** — API separada para conectar/desconectar/monitorar via Uazapi
4. **Templates de Mensagens** — Editor visual para WhatsApp (texto, imagem, vídeo, áudio, documento) com preview ao vivo e variáveis

---

## 🗺️ Mapa de Fases

O sistema está dividido em **7 fases**, ordenadas por dependência e prioridade:

| Fase | Nome | Prioridade | Dependências | Complexidade |
|------|------|-----------|-------------|-------------|
| **F1** | Schema de Base de Dados + Extensões | 🔴 Crítica | Nenhuma | Média |
| **F2** | Tipos TypeScript + Template Engine + Variáveis | 🔴 Crítica | F1 | Média |
| **F3** | Gestão de Instâncias WhatsApp (API + UI) | 🟠 Alta | F1 | Média |
| **F4** | Templates de Mensagens WhatsApp (Editor + Biblioteca) | 🟠 Alta | F1, F2, F3 |  Alta |
| **F5** | Editor Visual de Fluxos (Canvas + Nodes + Sidebar) | 🟠 Alta | F1, F2 | Alta |
| **F6** | Motor de Execução (Worker + Fila + Webhook) | 🟡 Média | F1, F2, F5 | Alta |
| **F7** | Monitorização + Histórico + Gestão de Execuções | 🟡 Média | F6 | Média |

```
F1 (DB) ──→ F2 (Tipos) ──→ F5 (Editor) ──→ F6 (Worker) ──→ F7 (Monitor)
   │              │
   │              └──→ F4 (Templates WhatsApp)
   │
   └──→ F3 (Instâncias WhatsApp)
```

---

## 🏗️ Arquitectura de Alto Nível

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 16)                    │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ Editor Visual│  │ Templates    │  │ Instâncias WhatsApp│    │
│  │ (React Flow) │  │ Mensagens    │  │ (Gestão + Status)  │    │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘    │
│         │                 │                    │                │
│  ┌──────┴─────────────────┴────────────────────┴──────────┐    │
│  │              Hooks React + Supabase Realtime            │    │
│  └────────────────────────┬───────────────────────────────┘    │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                    API ROUTES (Next.js)                          │
│                                                                 │
│  /api/automacao/fluxos          CRUD fluxos + triggers          │
│  /api/automacao/fluxos/[id]     Detalhe + save                  │
│  /api/automacao/fluxos/[id]/test Disparo manual de teste        │
│  /api/automacao/execucoes       Histórico de execuções          │
│  /api/automacao/instancias      Gestão instâncias Uazapi        │
│  /api/automacao/templates-wpp   Templates mensagens WhatsApp    │
│  /api/webhook/[key]             Receiver de webhooks externos   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                         │
│                                                                 │
│  Tabelas:              Extensões:         Edge Functions:        │
│  ├─ auto_flows         ├─ pgmq            ├─ auto-worker        │
│  ├─ auto_triggers      ├─ pg_cron         │  (processa fila)    │
│  ├─ auto_queue         ├─ pg_net          ├─ auto-webhook       │
│  ├─ auto_step_runs     │                  │  (resposta sync)    │
│  ├─ auto_delivery_log  │                  └─ verify-whatsapp    │
│  ├─ auto_wpp_instances │                                        │
│  ├─ auto_wpp_templates │                                        │
│  ├─ auto_webhook_captures                                       │
│  └─ tpl_variables (existente — expandir)                        │
│                                                                 │
│  Realtime:                                                      │
│  └─ auto_step_runs (INSERT/UPDATE → frontend em tempo real)     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│                    SERVIÇOS EXTERNOS                             │
│                                                                 │
│  Uazapi (WhatsApp API)    Resend (Email API)                    │
│  ├─ /instance/*           ├─ POST /emails                       │
│  ├─ /send/text            │                                     │
│  ├─ /send/media           │                                     │
│  └─ /sender/advanced      │                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Tabelas Existentes que o Sistema Utilizará

O sistema de automações precisa de aceder a dados de várias entidades do ERP. Estas tabelas **já existem** e não serão modificadas:

| Tabela | Entidade | Campos relevantes para variáveis |
|--------|----------|--------------------------------|
| `leads` | Leads/Contactos | nome, email, telefone, telemovel, origem, estado, temperatura, observacoes |
| `owners` | Proprietários | name, email, phone, nif, person_type, address |
| `users` | Consultores/Utilizadores | full_name, commercial_name, professional_email, phone_primary |
| `dev_properties` | Imóveis | title, external_ref, listing_price, city, zone |
| `property_listings` | Angariações | listing_price, property_type, typology, business_type |
| `proc_instances` | Processos | external_ref, current_status, percent_complete |
| `negocios` | Negócios/Oportunidades | tipo, estado, lead_id, orcamento |
| `tpl_variables` | Variáveis de template | key, label, category, source_table, source_column |
| `tpl_email_library` | Templates de email | name, subject, body_html, editor_state |
| `notifications` | Notificações | recipient_id, title, body, entity_type |
| `log_emails` | Log de emails | recipient_email, subject, delivery_status |

---

## 🧩 Tipos de Nodes do Editor Visual

### Nodes de Gatilho (Triggers — sem input, apenas output)

| Node | Ícone | Cor | Descrição para o utilizador |
|------|-------|-----|---------------------------|
| **Webhook** | 🔗 Webhook | Âmbar | "Recebe dados de uma fonte externa" |
| **Mudança de Estado** | 🔄 Activity | Âmbar | "Quando o estado de algo muda" |
| **Agendamento** | ⏰ Clock | Âmbar | "Executar automaticamente em horários definidos" |
| **Manual** | ▶️ Play | Âmbar | "Iniciar manualmente a partir do sistema" |

### Nodes de Acção (input e output)

| Node | Ícone | Cor | Descrição |
|------|-------|-----|-----------|
| **WhatsApp** | 💬 MessageCircle | Esmeralda | "Enviar mensagens WhatsApp" |
| **Email** | ✉️ Mail | Azul Céu | "Enviar email com template" |
| **Aguardar** | ⏱️ Timer | Violeta | "Esperar X minutos/horas/dias" |
| **Consulta Banco** | 🗄️ Database | Índigo | "Consultar ou gravar dados no sistema" |
| **Buscar Lead** | 🔍 Search | Azul | "Procurar ou criar um contacto" |
| **Condição** | 🔀 GitBranch | Rosa | "Decidir caminho baseado numa condição" |
| **Definir Variável** | 📝 Variable | Ciano | "Guardar um valor para usar depois" |
| **HTTP Request** | 🌐 Globe | Laranja | "Chamar uma API externa" |
| **Responder Webhook** | ↩️ Reply | Cinza | "Responder ao sistema que chamou" |
| **Notificação** | 🔔 Bell | Amarelo | "Criar notificação no sistema" |

---

## 👤 UX para Utilizador Leigo — Princípios Fundamentais

### 1. Variáveis como "pills" visuais (nunca mostrar `{{variável}}`)

O utilizador nunca vê código. Em vez de `{{lead.nome}}`, vê uma pill colorida:

```
 ┌─────────────────┐
 │ 🔵 Lead > Nome  │  ← pill azul, clicável, não editável
 └─────────────────┘
```

Cada entidade tem a sua cor: azul para leads, verde para imóveis, âmbar para consultores, roxo para proprietários. O seletor de variáveis mostra-as organizadas por categoria com ícones e valores de exemplo.

### 2. Condições em linguagem natural (nunca mostrar operadores)

Em vez de `field: "temperatura", operator: "equals", value: "Quente"`, o utilizador vê:

```
Quando   [Lead > Temperatura ▼]   [é igual a ▼]   [Quente ▼]
```

Cada dropdown mostra apenas opções válidas. "é igual a" traduz internamente para `equals`.

### 3. Preview ao vivo de tudo

O editor de mensagens WhatsApp mostra à direita um preview estilo telemóvel com os dados reais de um lead/proprietário seleccionado. O editor de email mostra o email renderizado. O canvas mostra checkmarks verdes durante a execução de teste.

### 4. Galeria de receitas pré-prontas

Antes de ver o canvas avançado, o utilizador vê uma galeria de automações comuns:
- "Quando novo lead chega, enviar WhatsApp de boas-vindas"
- "Quando processo muda para Aprovado, notificar consultor"
- "Enviar lembrete de follow-up 3 dias após primeiro contacto"

Cada receita é um fluxo pré-configurado que o utilizador activa com um clique.

---

## 📂 Estrutura de Pastas (Destino no Projecto)

```
app/
  (dashboard)/
    automacao/
      layout.tsx                          # Layout com sub-navegação
      page.tsx                            # Dashboard de automações
      fluxos/
        page.tsx                          # Lista de fluxos
        editor/
          page.tsx                        # Canvas visual (React Flow)
      execucoes/
        page.tsx                          # Histórico de execuções
      instancias/
        page.tsx                          # Gestão de instâncias WhatsApp
      templates-wpp/
        page.tsx                          # Biblioteca de templates WhatsApp
        editor/
          page.tsx                        # Editor de template individual

  api/
    automacao/
      fluxos/
        route.ts                          # GET lista, POST criar
        [flowId]/
          route.ts                        # GET detalhe, PUT save, DELETE
          test/route.ts                   # POST testar fluxo
          executions/
            route.ts                      # GET execuções do fluxo
            [executionId]/route.ts        # GET detalhe, POST retry
      execucoes/route.ts                  # GET global de execuções
      instancias/route.ts                 # GET/POST gestão instâncias
      templates-wpp/
        route.ts                          # GET lista, POST criar
        [id]/route.ts                     # GET/PUT/DELETE template
      stats/route.ts                      # GET métricas
    webhook/
      [key]/route.ts                      # POST/GET receiver externo

components/
  automations/
    flow-editor.tsx                       # Canvas principal React Flow
    flow-sidebar.tsx                      # Palette de nodes
    flow-card.tsx                         # Card na listagem de fluxos
    automation-tester.tsx                 # Dialog de teste com realtime
    whatsapp-message-editor.tsx           # Editor de mensagem individual
    whatsapp-template-builder.tsx         # Builder de template completo
    whatsapp-preview.tsx                  # Preview estilo telemóvel
    webhook-json-tree.tsx                 # Tree view de payload
    webhook-field-mapper.tsx              # Mapeamento de campos
    webhook-config-sheet.tsx              # Sheet de configuração webhook
    variable-picker.tsx                   # Seletor de variáveis (pill-based)
    execution-timeline.tsx                # Timeline de execução
    instance-card.tsx                     # Card de instância WhatsApp
    instance-connection-sheet.tsx         # Sheet de conexão (QR/pair code)
    recipe-gallery.tsx                    # Galeria de receitas pré-prontas
    nodes/
      node-wrapper.tsx                    # Wrapper base de todos os nodes
      trigger-webhook-node.tsx
      trigger-status-node.tsx
      trigger-schedule-node.tsx
      trigger-manual-node.tsx
      whatsapp-node.tsx
      email-node.tsx
      delay-node.tsx
      condition-node.tsx
      supabase-query-node.tsx
      task-lookup-node.tsx
      set-variable-node.tsx
      http-request-node.tsx
      webhook-response-node.tsx
      notification-node.tsx

hooks/
  use-flows.ts                            # CRUD de fluxos
  use-realtime-execution.ts               # Monitoramento via Realtime
  use-executions.ts                       # Histórico de execuções
  use-auto-layout.ts                      # Auto-layout BFS/dagre
  use-whatsapp-instances.ts               # Gestão de instâncias
  use-webhook-test-listener.ts            # Listener de teste webhook
  use-wpp-templates.ts                    # CRUD templates WhatsApp

lib/
  types/
    automation-flow.ts                    # Tipos de nodes, edges, flow
    whatsapp-template.ts                  # Tipos de templates WhatsApp
  template-engine.ts                      # Renderização de variáveis
  condition-evaluator.ts                  # Avaliação de condições
  webhook-mapping.ts                      # Mapeamento webhook → variáveis
  sync-flow-executor.ts                   # Engine de execução síncrona
  retry.ts                                # Lógica de retry + backoff
```

---

## 🔗 Integração com Uazapi (WhatsApp)

### Endpoints utilizados

| Endpoint | Método | Auth | Uso no sistema |
|----------|--------|------|---------------|
| `/instance/init` | POST | admintoken | Criar instância |
| `/instance/all` | GET | admintoken | Listar todas |
| `/instance/connect` | POST | token | Conectar (QR/pair code) |
| `/instance/disconnect` | POST | token | Desconectar |
| `/instance/status` | GET | token | Verificar estado |
| `/instance` | DELETE | token | Remover instância |
| `/send/text` | POST | token | Enviar texto |
| `/send/media` | POST | token | Enviar imagem/vídeo/áudio/documento |
| `/sender/simple` | POST | token | Envio em massa simples |
| `/sender/advanced` | POST | token | Envio em massa com delay variável |
| `/webhook` | POST | token | Configurar webhook da instância |
| `/chat/find` | POST | token | Buscar conversas |
| `/contacts/list` | GET | token | Listar contactos |

### Tipos de média suportados no `/send/media`

| Tipo | Formato | Campo extra |
|------|---------|------------|
| `image` | JPG preferencialmente | `text` (legenda) |
| `video` | MP4 apenas | `text` (legenda) |
| `audio` | MP3 ou OGG | — |
| `ptt` | OGG (push-to-talk) | — |
| `document` | PDF, DOCX, XLSX | `docName` (nome do ficheiro) |
| `sticker` | WEBP | — |

### Campos comuns a todos os envios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `number` | string | Número destino (formato internacional) |
| `delay` | integer | Segundos de "digitando..." antes de enviar |
| `readchat` | boolean | Marcar conversa como lida |
| `replyid` | string | ID da mensagem a que responde |
| `track_source` | string | Identificador do sistema (ex: "erp_infinity") |
| `track_id` | string | ID do fluxo/execução para rastreamento |

---

## 📊 Sistema de Variáveis (tpl_variables expandido)

### Variáveis existentes (14)

Já mapeadas na tabela `tpl_variables` com `source_table` e `source_column`:

| Categoria | Variáveis | Cor da pill |
|-----------|----------|-------------|
| Consultor | consultor_nome, consultor_email, consultor_telefone | 🟠 Âmbar |
| Imóvel | imovel_ref, imovel_titulo, imovel_morada, imovel_preco | 🟢 Verde |
| Proprietário | proprietario_nome, proprietario_email, proprietario_telefone | 🟣 Roxo |
| Processo | processo_ref | 🔵 Azul |
| Sistema | data_actual, empresa_nome | ⚪ Cinza |

### Variáveis a adicionar (Fase 2)

| Categoria | Key | Label | source_table | source_column |
|-----------|-----|-------|-------------|--------------|
| Lead | lead_nome | Nome do Lead | leads | nome |
| Lead | lead_email | Email do Lead | leads | email |
| Lead | lead_telefone | Telefone do Lead | leads | telefone |
| Lead | lead_telemovel | Telemóvel do Lead | leads | telemovel |
| Lead | lead_origem | Origem do Lead | leads | origem |
| Lead | lead_estado | Estado do Lead | leads | estado |
| Lead | lead_temperatura | Temperatura do Lead | leads | temperatura |
| Negócio | negocio_tipo | Tipo de Negócio | negocios | tipo |
| Negócio | negocio_estado | Estado do Negócio | negocios | estado |
| Negócio | negocio_orcamento | Orçamento | negocios | orcamento |
| Proprietário | proprietario_nif | NIF do Proprietário | owners | nif |
| Imóvel | imovel_tipologia | Tipologia | property_listings | typology |
| Imóvel | imovel_tipo | Tipo de Imóvel | property_listings | property_type |
| Sistema | hora_actual | Hora Actual | — | — |

---

## 📄 Documentos por Fase

Cada fase tem o seu documento detalhado com migrations SQL, tipos TypeScript, componentes, API routes, e critérios de aceitação:

| Documento | Fase | Conteúdo |
|-----------|------|----------|
| `SPEC-AUTO-F1-DATABASE.md` | F1 | Extensões, 9 tabelas novas, índices, RLS, Realtime |
| `SPEC-AUTO-F2-TIPOS-VARIAVEIS.md` | F2 | Tipos TS, template engine, condition evaluator, webhook mapping |
| `SPEC-AUTO-F3-INSTANCIAS-WPP.md` | F3 | API de instâncias Uazapi, UI de gestão, conexão QR/pair |
| `SPEC-AUTO-F4-TEMPLATES-WPP.md` | F4 | Editor de mensagens, biblioteca, preview ao vivo, drag-and-drop |
| `SPEC-AUTO-F5-EDITOR-VISUAL.md` | F5 | Canvas React Flow, 13 nodes, sidebar, validação, save/load |
| `SPEC-AUTO-F6-MOTOR-EXECUCAO.md` | F6 | pgmq worker, sync executor, webhook receiver, retry |
| `SPEC-AUTO-F7-MONITORIZACAO.md` | F7 | Dashboard, timeline, histórico, retry, execução ao vivo |

---

## 🛠️ Stack Técnica Adicional

### Dependências a instalar

```bash
# Editor visual
npm install @xyflow/react

# Filas PostgreSQL (apenas extensão no Supabase, sem pacote npm)
# pgmq, pg_cron, pg_net — activar via Dashboard Supabase

# Editor de variáveis com pills (avaliar na Fase 2)
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-mention
# OU usar react-mentions para campos mais simples
```

### Repositórios de referência

| Projecto | URL | O que reutilizar |
|----------|-----|-----------------|
| Vercel Workflow Builder | github.com/vercel-labs/workflow-builder-template | Estrutura base do editor |
| shadcn-next-workflows | github.com/nobruf/shadcn-next-workflows | Integração shadcn + React Flow |
| FlowiseAI | github.com/FlowiseAI/Flowise | Padrão de nodes complexos |
| pgflow | github.com/pgflow-dev/pgflow | Motor de execução Supabase |

---

## ⚠️ Decisões Arquitectónicas Importantes

### 1. Prefixo `auto_` para todas as tabelas de automação

Para não conflitar com tabelas existentes (`proc_*`, `tpl_*`), todas as tabelas novas usam o prefixo `auto_`. Exemplos: `auto_flows`, `auto_queue`, `auto_wpp_instances`.

### 2. pgmq vs. tabela customizada para a fila

**Decisão:** Usar pgmq para o processamento assíncrono principal, com uma tabela `auto_step_runs` para tracking/histórico. O pgmq garante exactly-once delivery; a tabela de step_runs permite UI de monitorização com Supabase Realtime.

### 3. Execução síncrona vs. assíncrona

**Decisão:** O sistema suporta ambas. Quando um fluxo tem um node "Responder Webhook", o webhook route executa os nodes inline até ao ponto de resposta (SyncFlowExecutor). Os nodes seguintes (WhatsApp, Email, Delay) vão para a fila assíncrona.

### 4. Templates WhatsApp separados dos fluxos

**Decisão:** Templates de mensagens WhatsApp vivem na tabela `auto_wpp_templates` e podem ser reutilizados em múltiplos fluxos. Dentro do node WhatsApp, o utilizador pode escolher "Usar template existente" ou "Criar mensagens neste fluxo".

### 5. Variáveis do webhook são dinâmicas

**Decisão:** As variáveis vindas de webhooks não precisam estar na `tpl_variables`. São mapeadas visualmente no node trigger e ficam disponíveis como pills durante o fluxo. A `tpl_variables` serve para variáveis do sistema (entidades do banco).
