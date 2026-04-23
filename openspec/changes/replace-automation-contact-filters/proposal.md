## Why

O diálogo de agendamento de automatismos em `/dashboard/crm/automatismos-contactos` (wizard de `custom_commemorative_events` → passo 2 "Seleccionar contactos") usa hoje um filtro por estado de lead com códigos em inglês (`new`, `contacted`, `qualified`, `archived`, `expired`) que **não correspondem aos valores reais** guardados em `leads.estado` (PT-PT: `Lead`, `Contactado`, `Qualificado`, `Potencial Cliente`, `Cliente Activo`, `1 Negocio Fechado`, `Cliente Recorrente`, `Cliente Premium`, `Perdido`, `Inactivo`). Resultado: aplicar qualquer opção (excepto "Todos") devolve sempre lista vazia — o filtro está efectivamente partido.

O consultor quer dois filtros que reflictam a realidade do CRM: (1) **fase de pipeline do negócio** (colunas do kanban: `Contactado`, `Pesquisa de Imóveis`, `Visitas`, `Proposta`, `CPCV`, `Escritura`, `Fecho`, `Perdido`) para alcançar contactos numa determinada etapa comercial, e (2) **estado do contacto** (coluna `leads.estado`, exactamente como no detalhe do lead) sem a opção inicial "Lead" — quem está ainda no estado "Lead" não é alvo destas automatismos.

## What Changes

- **BREAKING (UI)**: Remover o `Select` "Estado" com as cinco opções hardcoded (`new/contacted/qualified/archived/expired`) de [`components/crm/automations-hub/custom-events/lead-multi-select.tsx`](../../../components/crm/automations-hub/custom-events/lead-multi-select.tsx) e o mapa `STATUS_LABELS` associado.
- **BREAKING (API)**: `GET /api/automacao/custom-events/eligible-leads` deixa de aceitar o query-param `status=<code>`. Passa a aceitar dois novos query-params multi-valor:
  - `pipeline_stage_ids=<uuid>,<uuid>,…` — UUIDs de `leads_pipeline_stages.id`. O lead é incluído se tiver pelo menos um `negocios` cujo `pipeline_stage_id` esteja no conjunto (OR dentro do grupo).
  - `contact_estados=<label>,<label>,…` — valores exactos de `leads.estado` (PT-PT, URL-encoded). O lead é incluído se `estado IN (...)`.
- Se ambos os grupos vierem preenchidos aplica-se **AND entre grupos, OR dentro de cada grupo**. Se ambos vierem vazios/ausentes o endpoint devolve a lista completa do consultor (comportamento actual com `status=all`).
- Novo componente UI no wizard: duas dropdowns multi-select lado a lado ("Fase do pipeline" e "Estado do contacto"), cada uma com chips para os valores seleccionados e opção "Limpar". A lista de fases é carregada via `GET /api/crm/pipeline-stages` (já existente) e agrupada por `pipeline_type`. A lista de estados é a constante `LEAD_ESTADOS` de [`lib/constants.ts`](../../../lib/constants.ts) **sem** o valor `'Lead'`.
- Badge mostrado em cada linha do selector continua a mostrar o `estado` do lead — passa a usar a label PT-PT directa em vez do lookup em `STATUS_LABELS`.
- Hook [`hooks/use-eligible-leads.ts`](../../../hooks/use-eligible-leads.ts): troca o param `status?: string` por `pipelineStageIds?: string[]` + `contactEstados?: string[]` e serializa como CSV no query-string.
- Preserva-se o comportamento "Seleccionar todos" — o contador `total` reflecte o universo filtrado (igual a hoje, mas com os novos critérios).

## Capabilities

### New Capabilities

- `automation-contact-filters`: Filtros aplicáveis ao selector de contactos elegíveis no wizard de agendamento de automatismos (tanto a UI como o contrato do endpoint `GET /api/automacao/custom-events/eligible-leads`). Define que dimensões de filtragem existem, como se combinam entre si e que acontece quando nenhuma é seleccionada.

### Modified Capabilities

<!-- Nenhum spec existente descreve este endpoint/UI — a funcionalidade foi introduzida com o wizard e nunca teve capability própria. -->

## Impact

- **Código**:
  - `components/crm/automations-hub/custom-events/lead-multi-select.tsx` — remove `STATUS_LABELS` + `Select` de estado, adiciona dois multi-selects.
  - `hooks/use-eligible-leads.ts` — troca assinatura de parâmetros e construção do query-string.
  - `app/api/automacao/custom-events/eligible-leads/route.ts` — parsing novo, JOIN/subquery contra `negocios` para `pipeline_stage_ids`, `in('estado', …)` para `contact_estados`, auditoria inalterada.
- **API contrato**: breaking para o query-param `status`, mas o endpoint é consumido unicamente por este wizard interno — sem integrações externas. Nenhum client externo é afectado.
- **Base de dados**: zero migrations. Usa colunas existentes `leads.estado` (text), `negocios.pipeline_stage_id` (uuid FK → `leads_pipeline_stages.id`), `negocios.lead_id` (uuid FK → `leads.id`).
- **Performance**: a subquery `EXISTS (SELECT 1 FROM negocios n WHERE n.lead_id = leads.id AND n.pipeline_stage_id = ANY(...))` é O(n_leads × log n_negocios) com os índices existentes; mantém-se paginada (`range(offset, offset+limit-1)`). Limite defensivo: `pipeline_stage_ids` e `contact_estados` capados a 20 valores cada no servidor.
- **Acessos / permissões**: inalterado. O endpoint continua a filtrar por `agent_id = auth.user.id` (consultor só vê os próprios leads).
- **i18n**: todos os rótulos PT-PT. `LEAD_ESTADOS` é single source of truth.
