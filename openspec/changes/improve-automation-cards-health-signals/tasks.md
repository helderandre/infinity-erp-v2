## 1. Backend — endpoint de saúde

- [x] 1.1 Criar `app/api/automacao/custom-events/health-summary/route.ts` (GET). Auth via `requireAuth()`; 401 se não autenticado.
- [x] 1.2 Parse de `?consultant_id` query param. Se presente e `!== user.id`, validar `canSeeAll(roles)` (broker/admin); retornar 403 caso contrário.
- [x] 1.3 Migration `20260430_fn_automation_health_summary.sql` com função `get_automation_health_summary(p_consultant_id uuid)` — CTE `recent_runs` joina `contact_automations`+`leads` para resolver consultant_id via `leads.agent_id`. Aplicada via MCP.
- [x] 1.4 Subquery `lead_event_latest_failed` filtra failed com NOT EXISTS posterior `sent`. `unresolved_ranked` + `FILTER (WHERE rnk <= 5)` limita a 5 leads por event_key e mantém o count total separado.
- [x] 1.5 Post-processar no route handler: `completed_one_shot` cruza `custom:<id>` com `custom_commemorative_events.is_recurring`. `error_short` truncado a 80 chars já na SQL.
- [x] 1.6 `Cache-Control: private, max-age=30` adicionado ao Response.
- [ ] 1.7 Tests manuais com cURL: (a) consultor normal scoped ao próprio; (b) broker com `?consultant_id=X`; (c) consultor tenta passar `?consultant_id=X` → 403; (d) retry resolve failed_unresolved. (Deferido para QA)
- [ ] 1.8 Verificar no EXPLAIN ANALYZE se `idx_car_lead_event_created` é necessário. Criar migration aditiva se sort > 20ms em dataset de staging. (Deferido para QA)

## 2. Types & hook client-side

- [x] 2.1 Adicionado `HealthSummaryRow` + `HealthSummaryFailedItem` em [types/custom-event.ts](types/custom-event.ts).
- [x] 2.2 Criado [hooks/use-automation-health.ts](hooks/use-automation-health.ts) com `consultantId?` e fetch ao endpoint.
- [x] 2.3 Expõe `{ rows, byKey, isLoading, error, refetch }` — `byKey` é `Record<string, HealthSummaryRow>` via `useMemo`.

## 3. Card — sinais de saúde

- [x] 3.1 `<AutomationEventCard>` aceita prop `health?: HealthSummaryRow`.
- [x] 3.2 [lib/automacao/resolve-health-bucket.ts](lib/automacao/resolve-health-bucket.ts) — helper puro com prioridade `failures_unresolved > completed_one_shot > ok > idle` conforme spec.
- [x] 3.3 Dot 8px posicionado `absolute top-3 right-3` com `ring-2 ring-background` e `title`/`aria-label` do bucket.
- [x] 3.4 `isCompleted` substitui a badge de status por "Concluído" (emerald suave), esconde chip de data/hora e aplica opacidade 0.92.
- [x] 3.5 Nova linha `<HealthSummaryLine>` com `formatDistanceToNow` (locale `pt`) para "Último envio: há X dias" / "Concluído em DD MMM YYYY" / "Sem envios ainda".
- [x] 3.6 Contador `✓ N · ✕ N` renderizado apenas quando `failed30d > 0`.
- [x] 3.7 `<Skeleton>` do grid passa de `h-36` para `h-44` e o card placeholder de `min-h-[136px]` para `min-h-[176px]` para reservar a nova linha.

## 4. Card — badge de falhas com deep-link

- [x] 4.1 `<FailuresBadge>` inline no card; ícone `AlertTriangle` + texto `N falha(s)` em pill vermelho-suave.
- [x] 4.2 Tooltip via `<TooltipProvider>` com join dos nomes + sufixo `+N` quando `count > names.length`.
- [x] 4.3 `useIsTouch()` detecta `matchMedia('(pointer: coarse)')`; em touch suprime Tooltip.
- [x] 4.4 Click chama `onFailuresClick()` callback nova no card.
- [x] 4.5 `stopPropagation` no click do badge evita o `onClick` do card.

## 5. Grid — consumir health e propagar deep-link

- [x] 5.1 `<EventsCardsGrid>` consome `useAutomationHealth({ consultantId })`.
- [x] 5.2 `FIXED_KEY_BY_ID` mapeia `fixed-aniversario → aniversario_contacto`, etc. Custom events usam `custom:${evt.id}`.
- [x] 5.3 `onEventClick(id, isFixed, opts?)` aceita `{ initialRunsFilter }` e `onFailuresClick` interna chama-o com `'failed'`.

## 6. Sheet — prop initialRunsFilter

- [x] 6.1 `<AutomationDetailSheet>` aceita `initialRunsFilter?: 'all' | 'failed'`.
- [x] 6.2 `defaultTab = initialRunsFilter === 'failed' ? 'runs' : 'info'`; o `useEffect` de reset respeita a mesma regra quando o sheet reabre.
- [x] 6.3 Propaga `initialFilter={initialRunsFilter ?? 'all'}` a `<AutomationRunsSection>`.
- [x] 6.4 `<AutomationRunsSection>` usa `useState(initialFilter === 'failed')`; o chip muda estado localmente sem observar re-renders da prop.
- [ ] 6.5 Test manual: abrir sheet normal → tab "Informação" por defeito, filtro "all" em envios; abrir via badge de falhas → tab "Envios feitos" por defeito, filtro "failed". (Deferido para QA)

## 7. ScheduledTab — remover tabela e filtros redundantes

- [x] 7.1 Removido bloco `<Table>` + linhas/cells em `scheduled-tab.tsx`.
- [x] 7.2 Removidos imports não usados: `Link`, `Badge`, `Skeleton`, `Table*`, `cn`, `CONTACT_AUTOMATION_EVENT_LABELS_PT`, `STATE_COLORS`, `STATE_LABELS`, `useScheduled`.
- [x] 7.3 Removidos selectores `event` e `state` + state local.
- [x] 7.4 Selector `Consultor` mantido (broker only); valor propagado a `<EventsCardsGrid consultantId>` → `useCustomEvents` + `useAutomationHealth`.
- [x] 7.5 `useScheduled` / `/api/crm/contact-automations-scheduled` permanecem no repo — usados apenas nesta tab, mas deixados intactos em caso de consumidor futuro (custo nulo).
- [x] 7.6 Deep-link: state `detailInitialFilter` em `ScheduledTab` recebe `opts.initialRunsFilter` e passa a `<AutomationDetailSheet initialRunsFilter>`.

## 8. Broker scoping

- [x] 8.1 `useCustomEvents({ consultantId })` passa `?consultant_id=X` ao endpoint. `GET /api/automacao/custom-events` valida `canSeeAll(roles)` e retorna 403 caso contrário.
- [x] 8.2 `useAutomationHealth({ consultantId })` alinhado com o mesmo param; validação de role idêntica.
- [x] 8.3 `GET /api/automacao/custom-events/eligible-leads` passa a aceitar `?consultant_id=` com mesma validação; grid propaga `consultantId` ao fetch de contagem dos fixos.

## 9. QA

- [ ] 9.1 Staging com conta consultor: criar evento custom one-shot, deixar correr (ou simular com retry manual) → verificar card "Concluído".
- [ ] 9.2 Staging com conta consultor: provocar erro (template inválido) → verificar badge `⚠ N falhas` com lead no tooltip.
- [ ] 9.3 Clicar no badge abre sheet na tab "Envios feitos" com filtro "failed".
- [ ] 9.4 Clicar retry no sheet e aguardar sucesso → verificar que o lead desaparece de `failed_unresolved` no próximo fetch.
- [ ] 9.5 Mudar consultor no selector (conta broker) → grelha re-carrega com cards + health do outro consultor.
- [ ] 9.6 Viewport mobile (375px): verificar que o dot e o badge de falhas permanecem legíveis.
- [ ] 9.7 Medir TTI da tab Automatismos: com 8 cards + health carregado, deve ser ≤ actual (baseline antes de remover tabela).

## 10. Documentação

- [x] 10.1 [CLAUDE.md](CLAUDE.md) actualizado com entrada no topo da secção "Estado Actual do Projecto".
- [ ] 10.2 Arquivar com `openspec archive improve-automation-cards-health-signals` após merge em master.
