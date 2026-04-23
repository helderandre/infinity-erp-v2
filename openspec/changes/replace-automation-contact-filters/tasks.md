## 1. API — endpoint eligible-leads

- [x] 1.1 Em `app/api/automacao/custom-events/eligible-leads/route.ts`, parsear os novos query-params: `pipeline_stage_ids` (CSV → array de UUIDs) e `contact_estados` (CSV → array de strings URL-decoded). Remover o parsing de `status`.
- [x] 1.2 Validar limites: se qualquer dos arrays tiver mais de 20 valores, devolver HTTP 400 `{ error: "Demasiados filtros (máximo 20 por grupo)" }`. Filtrar silenciosamente UUIDs inválidos (regex `/^[0-9a-f]{8}-...$/i`) e estados fora de `LEAD_ESTADOS` (importar de `@/lib/constants`).
- [x] 1.3 Se `pipeline_stage_ids.length > 0`, executar primeiro uma query `supabase.from('negocios').select('lead_id').in('pipeline_stage_id', pipelineStageIds)`, extrair `Set<lead_id>`, e short-circuit com `{ leads: [], total: 0, page, limit }` se o set estiver vazio.
- [x] 1.4 Aplicar `.in('id', [...leadIdSet])` no query principal quando o pipeline filter está activo.
- [x] 1.5 Se `contact_estados.length > 0`, aplicar `.in('estado', contactEstados)` no query principal.
- [ ] 1.6 Smoke test manual ao endpoint com curl cobrindo: sem filtros, só `pipeline_stage_ids`, só `contact_estados`, ambos, `contact_estados` com label inválido, 21 valores (espera 400), `status=contacted` legacy (espera ignorado). **(a executar em staging)**

## 2. Hook — useEligibleLeads

- [x] 2.1 Em `hooks/use-eligible-leads.ts`, substituir `status?: string` por `pipelineStageIds?: string[]` e `contactEstados?: string[]` na `UseEligibleLeadsParams`.
- [x] 2.2 Actualizar `fetch()` para serializar ambos como CSV (`params.set('pipeline_stage_ids', ids.join(','))` quando não vazio; idem `contact_estados`, aplicando `encodeURIComponent` no valor completo automaticamente via `URLSearchParams`).
- [x] 2.3 Garantir que mudar qualquer array reactiva o `useCallback`/`useEffect` (adicionar aos deps). Atenção a estabilidade referencial — memoizar arrays no componente pai com `useMemo`. **(estabilidade garantida dentro do hook via `pipelineKey`/`estadosKey` memoizados a partir de `.join(',')` — callers não precisam de `useMemo` externo)**

## 3. UI — componente MultiSelect reutilizável

- [x] 3.1 Verificar se `components/ui/multi-select-dropdown.tsx` (ou equivalente) já existe no projecto. Fazer `grep -r "MultiSelect" components/ui/` para confirmar. **(decisão: reutilizar [`components/shared/multi-select-filter.tsx`](../../../components/shared/multi-select-filter.tsx), já largamente usado em consultants/visits/training/properties/leads/credit filters)**
- [x] 3.2 ~~Criar componente novo~~ **(não aplicável — reutilizado `<MultiSelectFilter>` existente)**
- [x] 3.3 Suportar `group?` na opção para renderizar separadores por grupo. **(adicionado `group?: string` a `MultiSelectOption` com fallback para render flat quando nenhuma opção tem `group`; `CommandGroup heading` renderiza o nome do grupo)**

## 4. UI — LeadMultiSelect

- [x] 4.1 Em `components/crm/automations-hub/custom-events/lead-multi-select.tsx`, remover `STATUS_LABELS` e o `<Select>` "Estado" hardcoded.
- [x] 4.2 Adicionar novo hook `usePipelineStages` em [`hooks/use-pipeline-stages.ts`](../../../hooks/use-pipeline-stages.ts) que faz `GET /api/crm/pipeline-stages` sem filtro e devolve `{stages, isLoading, error}`. Cache de módulo + de-duplicação de `inflight` fetches.
- [x] 4.3 Construir `pipelineOptions` mapeando cada stage para `{value: stage.id, label: stage.name, group: PIPELINE_TYPE_LABELS[stage.pipeline_type]}`, ordenado por `pipeline_type` + `order_index`.
- [x] 4.4 Construir `estadoOptions` = `LEAD_ESTADOS.filter(e => e !== 'Lead').map(e => ({value: e, label: e}))`.
- [x] 4.5 Adicionar state `pipelineStageIds` e `contactEstados`. Renderizar dois `<MultiSelectFilter>` acima da lista. Layout `flex flex-wrap items-center gap-2` com search (flex-1 min-w-[200px]) + dois multi-selects.
- [x] 4.6 Handlers `handlePipelineChange`/`handleEstadosChange` chamam `setPage(1)` após `setState`, garantindo reset para página 1.
- [x] 4.7 Badge na linha passa a mostrar `{lead.status}` verbatim (valor de `leads.estado`), escondido se null/empty.

## 5. i18n + constantes

- [x] 5.1 `PIPELINE_TYPE_LABELS` já existe em `lib/constants-leads-crm.ts` com as 4 entradas correctas (`arrendador: 'Senhorio'` em vez de `'Arrendador'` — PT-PT idiomático, mantido).
- [x] 5.2 Placeholders PT-PT: `"Fase do pipeline"`, `"Estado do contacto"`, `"Limpar filtros"` (herdado do `<MultiSelectFilter>`). Texto "A carregar fases do pipeline…" quando `usePipelineStages` está loading.

## 6. QA manual — staging

- [ ] 6.1 Abrir `/dashboard/crm/automatismos-contactos`, clicar em "Agendar novo automatismo", avançar para o passo "Seleccionar contactos".
- [ ] 6.2 Sem filtros: confirmar que aparecem todos os leads do consultor autenticado, ordenados por nome.
- [ ] 6.3 Seleccionar pipeline stage `Proposta` (comprador): só aparecem leads com negócio em Proposta.
- [ ] 6.4 Seleccionar estado `Cliente Activo`: só aparecem leads com `estado='Cliente Activo'` (confirmar via badge visível na linha).
- [ ] 6.5 Combinação (Proposta + Cliente Activo): intersecção correcta.
- [ ] 6.6 Confirmar que `"Lead"` NÃO aparece como opção no dropdown de estado do contacto.
- [ ] 6.7 Confirmar que "Limpar filtros" de um dropdown não afecta o outro.
- [ ] 6.8 Mudar filtro estando na página 2 → reset automático para página 1.
- [ ] 6.9 Confirmar que "Seleccionar todos" + contagem `total` reflectem o universo filtrado.

## 7. Documentação

- [x] 7.1 Actualizado CLAUDE.md com o bloco `✅ Automatismos de Contactos — filtros do selector (ENTREGUE via replace-automation-contact-filters)`.
- [x] 7.2 Nenhum outro `.md` tocado.
