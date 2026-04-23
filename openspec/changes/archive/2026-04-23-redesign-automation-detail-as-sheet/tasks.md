## 1. DB — migration aditiva

- [x] 1.1 Criar `supabase/migrations/<timestamp>_cals_custom_event_id.sql` com `ALTER TABLE contact_automation_lead_settings ADD COLUMN custom_event_id UUID NULL REFERENCES custom_commemorative_events(id) ON DELETE CASCADE`.
- [x] 1.2 Na mesma migration: `CREATE UNIQUE INDEX CONCURRENTLY contact_automation_lead_settings_unique_idx_new ON contact_automation_lead_settings (lead_id, event_type, COALESCE(custom_event_id, '00000000-0000-0000-0000-000000000000'::uuid))`. Depois `DROP INDEX CONCURRENTLY <old_unique>` + rename do novo. Comentário de aviso destacado no topo do ficheiro para revisão do Broker.
- [x] 1.3 Adicionar `CREATE INDEX idx_cals_lead_event_custom ON contact_automation_lead_settings (lead_id, event_type, custom_event_id)` (não-unique, para queries do spawner).
- [x] 1.4 Aplicar em staging via Supabase MCP (`mcp__supabase__apply_migration`). Correr smoke query manual: rows existentes preservadas, novo insert com `custom_event_id` OK, violação de unique com (lead, event, custom_event) repetido bloqueia.
- [x] 1.5 Documentar na secção "Estado Actual" do `CLAUDE.md` o comando para revert (drop coluna / rebuild old index).

## 2. Backend — helpers e APIs de channel availability

- [x] 2.1 Criar `lib/automacao/resolve-channels-for-event-consultant.ts` exportando `resolveChannels(event: {channels: string[]}, accounts: {email_count: number, wpp_count: number}): {email: 'active'|'unavailable'|'off', whatsapp: ...}`. Testar com fixtures para as 9 combinações (on × has, on × no, off × has, off × no, …).
- [x] 2.2 Criar `GET /api/automacao/channel-availability/route.ts` que devolve `{email: {available, account_count}, whatsapp: {available, instance_count}}` para `auth.user.id`. Cache-Control `private, max-age=60`.
- [x] 2.3 Actualizar `GET /api/automacao/custom-events/[id]/route.ts` para:
  - Ler `consultant_email_accounts` + `auto_wpp_instances` do consultor.
  - Calcular `effective_channels` via o helper 2.1.
  - Incluir no payload de resposta.
  - Adicionar `Cache-Control: private, max-age=30`.
- [x] 2.4 Actualizar hook `useScheduled()` (em `hooks/use-scheduled.ts` ou equivalente do `scheduled-tab.tsx`) para usar o helper partilhado em vez do cálculo inline actual. Zero regressão nas badges do scheduled-tab.

## 3. Backend — overrides per-lead para eventos custom

- [x] 3.1 Actualizar `POST /api/leads/[id]/automation-settings/route.ts` para aceitar `custom_event_id?: string` (UUID) no body. Quando presente, validar que é um UUID e que o evento existe + pertence ao consultor autenticado (403 caso contrário). Upsert faz match em `(lead_id, event_type, COALESCE(custom_event_id, '00000000-...'))`.
- [x] 3.2 Actualizar `DELETE /api/leads/[id]/automation-settings` para aceitar `custom_event_id` em query-string. Quando presente, filtra só a linha com esse scope. Sem ele, apaga só fixos (comportamento actual).
- [x] 3.3 Actualizar `GET /api/leads/[id]/automation-settings` para devolver todas as linhas (fixos + custom), cada uma com o seu `custom_event_id` explícito no payload.
- [x] 3.4 Auditar `lib/automacao/spawn-retry.ts` e todas as queries do spawner/cron:
  - Procurar por `from('contact_automation_lead_settings')` no repo.
  - Em cada match, verificar se o contexto é fixo (adicionar `AND custom_event_id IS NULL`) ou custom (adicionar `AND custom_event_id = X`).
  - Adicionar testes unitários para os dois cenários do spec (aniversário + Páscoa com hours diferentes).
- [x] 3.5 Actualizar `resolve-template-for-lead.ts` (se existir) para honrar `custom_event_id` quando disponível no contexto da chamada.

## 4. Backend — endpoint de templates para o evento

- [x] 4.1 Criar `GET /api/automacao/custom-events/[id]/templates/route.ts` que devolve:
  - `email: {default: <template>|null, used: <template>[], available: <template>[]}`
  - `whatsapp: {default, used, available}`
  - `default` = `event.email_template_id` / `event.wpp_template_id` resolvido para row completa.
  - `used` = templates em overrides de `contact_automation_lead_settings` com `custom_event_id=<id>`.
  - `available` = `tpl_email_library` / `auto_wpp_templates` onde `scope='global' AND is_system=true` OR `scope='personal' AND scope_id=<consultor>`, excluindo os já em `used`.
- [x] 4.2 Endpoint respeita permissões — só consultor dono do evento vê templates.

## 5. UI — componente shell `<AutomationDetailSheet>`

- [x] 5.1 Criar `components/crm/automations-hub/automation-detail-sheet/automation-detail-sheet.tsx` com props `{kind: 'fixed'|'custom', eventId: string, open: boolean, onOpenChange: (o:boolean)=>void}`. Copiar os tokens visuais de [`components/calendar/calendar-event-form.tsx`](../../../components/calendar/calendar-event-form.tsx) linhas 499-528: `SheetContent` responsivo (right-desktop `sm:max-w-[540px] sm:rounded-l-3xl` / bottom-mobile `h-[80dvh] rounded-t-3xl`), backdrop `bg-background/85 ... backdrop-blur-2xl`, `shadow-2xl`, `border-border/40`, grabber mobile (`h-1 w-10 rounded-full`).
- [x] 5.2 Header seguindo padrão do calendar-event-form: `SheetTitle text-[22px] font-semibold leading-tight tracking-tight pr-10` + linha abaixo com chips resumo (data/hora, recorrência, canais via `<ChannelChips>` de 6.1). Em mobile chips ficam em `flex overflow-x-auto` com scroll horizontal.
- [x] 5.3 Pill-tabs (NÃO underline-tabs) via `<TabsList className="grid w-full grid-cols-4 h-9 p-0.5 rounded-full bg-muted/50 border border-border/30">`. 4 triggers: `info`, `contacts`, `templates`, `runs`. Labels longas no desktop (`AUTOMATION_SHEET_COPY.tabsLong`) + curtas no mobile (`tabsShort`) conforme breakpoint `md`. Trigger activo usa `bg-background shadow-sm`.
- [x] 5.4 Footer translúcido: `<SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">` com botão "Fechar" + (para custom) "Eliminar automatismo" com `AlertDialog`.
- [x] 5.5 Reset de tab para `info` em cada abertura (não persistir entre aberturas).
- [x] 5.6 Comparação visual lado-a-lado com `calendar-event-form` aberta: proporções, espaçamentos, sombras e pill-tabs devem ser indistinguíveis do calendário (só muda o conteúdo).

## 6. UI — sub-secções

- [x] 6.1 `components/crm/automations-hub/automation-detail-sheet/automation-channel-chips.tsx` — chip por canal com 3 estados (Activo / Desligado / Indisponível), ícone + tooltip, switch inline quando editável. Usa `effective_channels` do evento.
- [x] 6.2 `automation-info-section.tsx` — render dos campos editáveis (nome, descrição, data, hora, recorrência, switches de canal). Inline edit pattern: span → input com lápis. Enter/blur persiste via `PUT /api/automacao/custom-events/[id]`. Validação Zod reusando `customEventUpdateSchema`.
- [x] 6.3 `automation-contacts-section.tsx` — duas sub-tabs (`Incluídos/Por adicionar` custom OR `A receber/Não vai receber` fixo). Cada sub-tab renderiza cards de contacto (não rows). Pesquisa sempre visível; filtros (pipeline + estado) só na sub-tab de adicionar/não-receber.
- [x] 6.4 `contact-card.tsx` — avatar/iniciais + nome + estado + email/telemóvel + menu `⋯` (Alterar hora, Alterar template email, Alterar template WhatsApp, Remover) + pills indicando overrides existentes.
- [x] 6.5 `contact-override-popover.tsx` — `<Popover>` com o campo específico (hora/template email/template WhatsApp). Submit faz `POST /api/leads/[id]/automation-settings` com `custom_event_id` quando aplicável. "Remover override" disponível quando há valor definido.
- [x] 6.6 `contacts-batch-bar.tsx` — reusar pattern de `components/documents/batch-action-bar.tsx` com acções "Adicionar seleccionados" / "Remover seleccionados". Selecção via `Set<lead_id>`.
- [x] 6.7 `automation-templates-section.tsx` — por canal: secção "Usados" (com badge "Padrão" no default) e secção "Outros disponíveis". Cards com `Preview`, `Tornar padrão`, `Editar`.
- [x] 6.8 `template-preview-dialog.tsx` — Dialog nested com `body_html` renderizado + variáveis resolvidas para lead de exemplo (o primeiro lead do evento).
- [x] 6.9 `automation-runs-section.tsx` — timeline vertical agrupada por dia (heading sticky). Card por run: ícone canal + nome + estado + timestamp relativo. Chip-filter "Só falhados" acima.
- [x] 6.10 `run-card.tsx` — card expandível; mostra `error` e `skip_reason` quando expandido; botão "Tentar novamente" em falhados que dispara `POST /api/automacao/runs/[id]/retry`.

## 7. Copy centralizado

- [x] 7.1 Adicionar `AUTOMATION_SHEET_COPY` a `lib/constants-automations.ts` com todas as strings visíveis (tabs, sub-tabs, placeholders, tooltips, empty-states, toasts de sucesso/erro). Marcação `as const` para type-safety.
- [x] 7.2 Passar o Sheet e todas as sub-secções por review manual verificando zero ocorrências dos termos proibidos (mute, schedule, spawn, virtual, cron, RPC, upsert, template id, payload) no texto renderizado.

## 8. Cut-over e cleanup

- [x] 8.1 Em `components/crm/automations-hub/scheduled-tab.tsx`, substituir o render de `CustomEventDetailDialog` por `<AutomationDetailSheet kind={detailIsFixed ? 'fixed' : 'custom'} ...>`.
- [x] 8.2 Confirmar que o resto da `scheduled-tab.tsx` continua a funcionar (callbacks de close, refresh após mutação).
- [x] 8.3 Deletar `components/crm/automations-hub/custom-events/custom-event-detail-dialog.tsx` (780+ linhas). Procurar no repo por imports órfãos.
- [x] 8.4 Remover imports desusados em `scheduled-tab.tsx`.

## 9. Testes + QA manual

- [x] 9.1 Testar em desktop (Chrome, viewport 1440×900): abrir Sheet de custom + fixo, editar cada campo, adicionar/remover contacto, override de hora, preview de template, retry de run.
- [x] 9.2 Testar em mobile (Chrome DevTools 375×667 iPhone SE): idem. Swipe de tabs, scroll vertical do corpo, bottom-sheet sem overflow.
- [x] 9.3 Testar consultor sem SMTP: chip "Email" aparece Indisponível, switch disabled, tooltip correcto.
- [x] 9.4 Testar consultor sem instância WhatsApp: idem para WhatsApp.
- [x] 9.5 Testar consultor sem ambos: header não mostra chips activos, Sheet ainda abre e permite criar overrides teóricos (mas avisa).
- [x] 9.6 Testar spawner em staging: criar override de hora para lead L em Páscoa (custom, `custom_event_id='<p>'`), criar outro override de hora em aniversário (fixo, `custom_event_id=NULL`). Forçar tick do spawner e verificar runs criadas com horas correctas.
- [x] 9.7 Testar que o comportamento actual dos fixos não regride: mute global, unmute per-lead, edit send_hour, edit template per-lead — tudo continua a funcionar.
- [x] 9.8 `tsc --noEmit` filtrado aos ficheiros mexidos: zero erros.
- [x] 9.9 Validar que "Eliminar automatismo" só aparece em `kind='custom'` e nunca em fixo.

## 10. Documentação

- [x] 10.1 Actualizar `CLAUDE.md` com bloco `✅ Automatismos de Contactos — redesign com Sheet unificado (ENTREGUE via redesign-automation-detail-as-sheet)` listando: o novo componente, a migration aditiva, os novos endpoints, o helper partilhado, e a extensão de overrides a eventos custom.
- [x] 10.2 Actualizar secção `Contact Automations` no `CLAUDE.md` a referir que o detalhe abre agora num Sheet unificado e que per-lead overrides funcionam para ambos os tipos de evento.
- [x] 10.3 Não mexer em outros `.md` do repo (nenhuma documentação externa depende directamente dos dialogs antigos).
