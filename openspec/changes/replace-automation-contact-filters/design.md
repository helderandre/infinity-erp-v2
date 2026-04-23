## Context

O wizard de `custom_commemorative_events` em [`components/crm/automations-hub/custom-events/custom-event-wizard.tsx`](../../../components/crm/automations-hub/custom-events/custom-event-wizard.tsx) tem três passos: dados do evento, selecção de contactos e escolha de templates. O passo de selecção usa o componente [`<LeadMultiSelect>`](../../../components/crm/automations-hub/custom-events/lead-multi-select.tsx) que por sua vez consome o hook [`useEligibleLeads`](../../../hooks/use-eligible-leads.ts) contra `GET /api/automacao/custom-events/eligible-leads`.

Hoje o filtro do `<Select>` "Estado" envia códigos EN (`new`, `contacted`, `qualified`, `archived`, `expired`) que foram copiados do schema legacy do M05 (ver CLAUDE.md → "Tabelas de Leads" → `status` enum). Quando o módulo de CRM avançou, a coluna passou a chamar-se `leads.estado` com labels PT-PT livres (array `LEAD_ESTADOS` em [`lib/constants.ts:1021`](../../../lib/constants.ts#L1021-L1032)). O filtro nunca foi actualizado — qualquer selecção devolve zero resultados porque a igualdade `leads.estado = 'contacted'` nunca dá match contra `'Contactado'`.

Paralelamente, o kanban de negócios usa `leads_pipeline_stages` (FK de `negocios.pipeline_stage_id`) com fases específicas por `pipeline_type`. Esta é a dimensão comercial relevante — onde está o negócio — e não está exposta em lado nenhum do wizard de automatismos.

**Stakeholders:** consultores imobiliários que agendam eventos personalizados (ex.: festividade, aniversário de fecho) e precisam segmentar destinatários. Broker/CEO que supervisiona o pipeline.

**Constraints:**
- Zero migrations de BD. Usar colunas existentes.
- Manter o contrato do endpoint simples (sem body POST novo, continuar GET com query params).
- Preservar RLS lógica: consultor vê só os seus leads (`agent_id = auth.user.id`).
- UI PT-PT, padrões shadcn/ui já estabelecidos no projecto.

## Goals / Non-Goals

**Goals:**
- Substituir o filtro partido por duas dimensões que o consultor reconhece do dia-a-dia (pipeline do negócio + estado do contacto).
- Tornar o filtro do CRM interno single-source-of-truth: pipeline stages via `leads_pipeline_stages`, estados via `LEAD_ESTADOS`.
- Permitir combinação AND entre dimensões para segmentação fina (ex.: "clientes activos com negócio em Proposta").
- Manter fallback "sem filtros = lista completa do consultor" para compatibilidade com o fluxo rápido actual.

**Non-Goals:**
- Não redesenhar o wizard (ficam os 3 passos, só muda o componente de filtros no passo 2).
- Não adicionar filtros por outras dimensões (origem, temperatura, data de criação, tags) — ficam como follow-up se necessário.
- Não mexer no contrato de `POST /api/automacao/custom-events` nem no `POST /api/automacao/custom-events/[id]/leads` — a selecção final continua a ir por lead_ids[] ou `all: true`.
- Não criar nova tabela ou índice. Se a query agregada ficar lenta, optimizamos como follow-up com índice `negocios(lead_id, pipeline_stage_id)`.
- Não propagar este filtro para outros endpoints (ex.: lead listings, kanban) — é específico do wizard de automatismos.

## Decisions

### 1. Dois grupos de filtros, OR dentro, AND entre

**Decisão:** Cada dimensão é multi-select. Dentro de cada grupo aplica-se `IN (...)` (OR). Entre grupos aplica-se AND. Se ambos vazios, nenhum predicado é adicionado.

**Alternativa considerada:** Um único filtro "categoria" que mistura pipeline stages e estados numa lista. Rejeitado porque são dimensões ortogonais com significado distinto — misturá-las confunde o utilizador e perde expressividade (não consegues pedir "clientes activos em Proposta" num único dropdown).

**Alternativa considerada:** AND dentro do grupo pipeline (lead com negócios em todas as fases seleccionadas). Rejeitado porque seria contra-intuitivo e na prática raramente útil — OR aproxima-se do mental model "quero alcançar quem está em qualquer destas fases".

### 2. Filtro pipeline usa `EXISTS` subquery, não JOIN

**Decisão:** O endpoint constrói a query com uma subquery `EXISTS` em vez de JOIN, para evitar duplicação de linhas quando um lead tem múltiplos negócios em fases seleccionadas. Implementação com PostgREST:

```ts
// 1. Se pipeline_stage_ids não vazio: ir primeiro buscar lead_ids matching
const { data: matchingLeadIds } = await supabase
  .from('negocios')
  .select('lead_id')
  .in('pipeline_stage_id', pipelineStageIds)

const leadIdSet = Array.from(new Set(matchingLeadIds.map(r => r.lead_id).filter(Boolean)))

// 2. Aplicar no query principal
if (pipelineStageIds.length > 0) {
  if (leadIdSet.length === 0) {
    // short-circuit: nenhum match possível
    return NextResponse.json({ leads: [], total: 0, page, limit })
  }
  query = query.in('id', leadIdSet)
}
```

**Alternativa considerada:** `.select('*, negocios!inner(id)')` com filtro no join. Rejeitado porque o PostgREST `!inner` + `.in()` no campo joined retorna linhas duplicadas (uma por negócio match) e complica o `count: 'exact'`. A abordagem two-step é O(2) queries mas previsível, idempotente e usa o índice `negocios(lead_id)` que já existe pelo FK.

**Alternativa considerada:** RPC function server-side. Adiável — não justifica a complexidade operacional (migration, typegen) para o volume actual de leads.

### 3. Filtro estados usa `.in('estado', labels)` — labels PT-PT exactos

**Decisão:** O cliente envia os labels exactamente como armazenados em `leads.estado` (URL-encoded). O servidor faz `.in('estado', selectedEstados)`. Antes de aplicar, o servidor valida que cada label pertence a `LEAD_ESTADOS` — valores fora do conjunto são silenciosamente removidos (defence-in-depth contra injection ou drift entre client/server).

**Alternativa considerada:** Enviar enum codes (ex.: `cliente_activo`) e traduzir server-side. Rejeitado porque adiciona um mapping sem ganhos — `LEAD_ESTADOS` já é single source of truth no client e no server (constante importada).

### 4. UI: dois `MultiSelect` (chips + popover checkbox list)

**Decisão:** Implementar um componente utilitário `<MultiSelectDropdown>` em [`components/ui/multi-select-dropdown.tsx`](../../../components/ui/multi-select-dropdown.tsx) se ainda não existir — ou reutilizar o padrão estabelecido no negocios-form/negocios-filters. Cada grupo tem o seu próprio componente que renderiza:
- Trigger: botão com label ("Fase do pipeline" / "Estado do contacto") + contador de seleccionados (`(2)`).
- Content: checkboxes agrupados (no caso do pipeline, por `pipeline_type` com heading "Comprador" / "Vendedor" / "Arrendatário" / "Arrendador").
- Footer: botão "Limpar" + "Fechar".

**Alternativa considerada:** Dois `Select` simples (single-value). Rejeitado porque perde a expressividade — o consultor muitas vezes quer 2-3 fases adjacentes (ex.: Visitas + Proposta + CPCV).

**Alternativa considerada:** Popover com `Command` (shadcn combobox). Aceitável; vamos usar este padrão se já estiver estabelecido em outros filtros do CRM.

### 5. Pipeline stages — carregar uma vez e agrupar no client

**Decisão:** O `<LeadMultiSelect>` (ou um hook novo `usePipelineStages`) faz `GET /api/crm/pipeline-stages` sem `pipeline_type` (pede todas), e o client agrupa por `pipeline_type` para renderizar. A resposta é pequena (~20-40 rows) e estável — pode ser cacheada via SWR ou `useEffect` local.

**Alternativa considerada:** Carregar só `pipeline_type='comprador'` por default e trocar conforme contexto. Rejeitado porque o wizard é agnóstico de pipeline type — o consultor escolhe estados de qualquer pipeline.

### 6. Contrato legacy `status=<code>`: silent drop, não erro

**Decisão:** O parâmetro antigo `status` é removido do schema do servidor mas não gera erro — é ignorado se vier na query string. Isto evita quebrar bookmarks ou histórico enquanto ninguém utiliza (o único caller é o `useEligibleLeads` que vamos actualizar).

**Alternativa considerada:** Retornar 400 "param deprecated". Rejeitado — ruído sem benefício; o param nunca devolveu resultados úteis de qualquer forma.

## Risks / Trade-offs

**[Risco] Query two-step (buscar lead_ids primeiro) cria race entre a resolução de lead_ids e o fetch principal.**
→ Mitigação: o consultor só vê leads onde é agente; a probabilidade de um negócio mudar de fase entre os dois queries é negligível e o pior caso é um lead aparecer ou desaparecer numa página — aceitável. Em caso de escala (>10k leads por consultor) migra-se para RPC/view.

**[Risco] `.in('id', leadIdSet)` com arrays grandes (100k+) pode gerar URLs longos no PostgREST.**
→ Mitigação: `.in` usa o cabeçalho `PostgREST-Range` / URL limit; o limite prático é ~2000 entradas. Como o consultor típico tem <500 leads no total, o lado direito (`leadIdSet`) raramente ultrapassa esse número. Se ultrapassar, divide-se em chunks (não implementado nesta fase — adicionar se métricas mostrarem).

**[Risco] Labels em `leads.estado` divergirem de `LEAD_ESTADOS` (dados históricos com valores não-canónicos).**
→ Mitigação: o filtro falha "safe" — se um lead tem `estado='cliente activo'` (lowercase), fica fora do filtro exacto. Já hoje esses dados existem no CRM porque a coluna aceita free-text. O follow-up é uma migration de normalização que está fora do escopo desta change.

**[Risco] Performance degrada se `leads_pipeline_stages` crescer muito (ex.: pipelines personalizados por equipa).**
→ Mitigação: a tabela é pequena por design (8-12 stages × 4 tipos ≈ 40 rows). Sem risco próximo.

**[Risco] UI quebra em ecrãs estreitos — dois dropdowns lado-a-lado no step 2 do wizard.**
→ Mitigação: layout `flex-wrap` ou `grid-cols-1 md:grid-cols-2`, chips com `truncate`. O wizard está num `Dialog` que já scrolla verticalmente; adicionar altura mínima para o popover não cortar.

**[Risco] Consultor sem negócios abertos deixa de ver os seus leads quando acciona o filtro pipeline.**
→ Mitigação: comportamento correcto e esperado — está documentado num scenario do spec ("Lead without any negócio is excluded when pipeline filter is active"). Para casos limite o consultor desmarca tudo e volta ao baseline.

**Trade-off:** Dois queries → +1 round-trip. Ganho: código previsível, sem duplicações no count. Custo: ~10-30ms adicionais por request filtrado. Aceitável para fluxo interactivo de wizard.

**Trade-off:** Dropping silent de params inválidos vs 400. Ganho: UX mais permissivo, histórico não quebra. Custo: bugs client-side podem passar despercebidos. Aceitável porque o único client é interno e passa por typecheck.

## Migration Plan

1. **Deploy sem feature flag** — a mudança é strictly UI + API handler, ambos deployam juntos.
2. **Backward compat**: o `status` query-param é ignorado, não lança erro. Se uma tab aberta antiga do wizard ainda enviar `status=contacted`, o server simplesmente devolve a lista completa do consultor (comportamento igual a "Todos"). Sem quebra visível.
3. **Monitorização**: smoke test manual em staging cobrindo as 4 combinações: nenhum filtro, só pipeline, só estado, ambos.
4. **Rollback**: revert do commit repõe o comportamento anterior sem migrations para desfazer.

## Open Questions

Nenhuma aberta. As decisões acima cobrem todas as ambiguidades do request original.
