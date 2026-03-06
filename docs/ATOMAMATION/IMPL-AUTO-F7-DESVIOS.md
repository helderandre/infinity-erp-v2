# IMPL-AUTO-F7-DESVIOS — Desvios da Implementacao da Fase 7

**Data:** 2026-03-06
**Status:** Implementado com desvios documentados abaixo

---

## 1. ~~Grafico de barras CSS puro (sem echarts)~~ — RESOLVIDO

**Spec original:** Usar echarts (echarts-for-react) para grafico de execucoes por dia.

**Implementado inicialmente:** Grafico de barras CSS puro.

**Corrigido em 2026-03-06:** Instalado `echarts` + `echarts-for-react`. O `MiniBarChart` em `stats-cards.tsx` agora usa echarts com barras empilhadas (concluidas/falhadas), tooltip, legenda e eixos formatados. Tree-shaking aplicado via imports granulares (`echarts/core`, `echarts/charts`, etc.).

**Este desvio ja nao se aplica.**

---

## 2. Pagina de dashboard sem route group `(dashboard)`

**Spec original:** `app/(dashboard)/automacao/page.tsx` e `app/(dashboard)/automacao/execucoes/page.tsx`

**Implementado:** `app/dashboard/automacao/page.tsx` e `app/dashboard/automacao/execucoes/page.tsx`

**Razao:** O projecto usa `app/dashboard/` (pasta real) e nao `app/(dashboard)/` (route group). Documentado nos desvios globais (DESVIOS-ACUMULADOS).

---

## 3. Tester integrado como Sheet (nao Dialog)

**Spec original:** `automation-tester.tsx` como Dialog.

**Implementado:** Sheet lateral (slide-in da direita) com largura `sm:max-w-lg`. Integrado no editor de fluxos via botao "Teste Avancado", mantendo o botao "Testar" original para teste rapido sem variaveis.

**Razao:** Sheet permite scroll de conteudo longo (timeline + variaveis) sem bloquear a interaccao com o canvas. Dialog ficaria demasiado apertado para mostrar a timeline completa.

---

## 4. Sem seleccao de lead por autocomplete no tester

**Spec original:** Tester com campo de pesquisa de lead (`[Pesquisar lead...]`) e seleccao de lead existente do banco.

**Implementado:** Campos manuais de variaveis (key + value) com valores pre-populados (lead_nome, lead_email, lead_telefone). Campos entity_type e entity_id opcionais para contexto.

**Razao:** A pesquisa de leads requer um endpoint de autocomplete dedicado que nao existe. O approach manual e mais flexivel (funciona com qualquer entidade, nao so leads) e suficiente para testes. A seleccao de lead pode ser adicionada numa iteracao futura.

---

## 5. Webhook test listener nao reimplementado (ja existe)

**Spec original:** `use-webhook-test-listener.ts` descrito na F7.

**Implementado:** Ja existia em `hooks/use-webhook-test-listener.ts` desde a F5. Nao foi recriado nem duplicado.

---

## 6. Stats API calcula no servidor (sem funcao SQL dedicada)

**Spec original:** Nao especificava implementacao.

**Implementado:** A route `GET /api/automacao/stats` faz 4 queries paralelas (flows, runs, deliveries, instances) e calcula metricas no servidor Node.js. Nao usa funcao SQL agregada.

**Razao:** O volume de dados (14 dias) e pequeno o suficiente para agregar no servidor. Se o volume crescer, migrar para uma funcao `auto_get_stats()` no PostgreSQL.

---

## 7. Paginacao na listagem de execucoes usa offset/limit

**Spec original:** Server-side com offset/limit.

**Implementado:** Exactamente como especificado. Offset/limit com botoes Anterior/Proxima e indicador de pagina.

---

## 8. Collapsible para expansao de execucoes (carregamento lazy)

**Spec original:** Expandir execucao mostra steps.

**Implementado:** Usa `Collapsible` do shadcn/ui. Ao expandir, faz fetch do detalhe da execucao (steps) via `getDetail()`. Lazy loading para nao carregar todos os steps de todas as execucoes na listagem.

---

## Ficheiros Criados

| Ficheiro | Descricao |
|----------|-----------|
| `app/api/automacao/stats/route.ts` | GET metricas do dashboard |
| `app/dashboard/automacao/page.tsx` | Dashboard de automacoes |
| `app/dashboard/automacao/execucoes/page.tsx` | Historico global de execucoes |
| `components/automations/execution-timeline.tsx` | Timeline de steps com Realtime |
| `components/automations/automation-tester.tsx` | Sheet de teste com realtime |
| `components/automations/stats-cards.tsx` | Cards de metricas + mini grafico |
| `components/automations/execution-detail-sheet.tsx` | Sheet com detalhe completo |
| `hooks/use-executions.ts` | Historico + detalhes + retry + paginacao |
| `hooks/use-realtime-execution.ts` | Monitoramento via Supabase Realtime |

## Ficheiros Modificados

| Ficheiro | Alteracao |
|----------|-----------|
| `components/layout/app-sidebar.tsx` | Adicionados items Dashboard e Execucoes ao menu de automacoes |
| `app/dashboard/automacao/fluxos/editor/page.tsx` | Integrado botao "Teste Avancado" + AutomationTester sheet |
