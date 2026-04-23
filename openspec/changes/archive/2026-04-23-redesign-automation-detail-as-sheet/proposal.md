## Why

Hoje um clique num card de automatismo na página `/dashboard/crm/automatismos-contactos` abre um de dois `<Dialog>` distintos (`CustomEventDetailDialog` para custom / `FixedEventDetailDialog` para fixos) — cada um com layout próprio, tabelas densas e tabs com vocabulário técnico (`Activos/Excluídos`, `Contactos/Execuções`). Os diálogos não suportam:

- Edição da informação nuclear do evento (data, hora, recorrência, canais) — é preciso eliminar e recriar.
- Gestão completa de contactos num sítio: o consultor vê quem está **dentro**, mas para adicionar precisa de voltar à página-mãe e abrir outro wizard.
- Overrides por contacto em eventos custom (hora/template/data específicos) — só existe em fixos via `contact_automation_lead_settings`.
- Reflectir canal real: uma automação pode ter `channels: ['email','whatsapp']` mas o consultor pode não ter conta SMTP ou instância WhatsApp activa. A UI mostra os dois ícones mesmo quando um deles **nunca vai disparar**.
- Gerir templates no contexto da automação (ver os usados, escolher default, editar) — o consultor tem que navegar até `/dashboard/templates-email` ou `/dashboard/templates-whatsapp`.
- Experiência mobile — os `<Dialog>` actuais cortam tabelas em ecrãs pequenos.

A **sheet de criar/editar evento do calendário** ([`components/calendar/calendar-event-form.tsx`](../../../components/calendar/calendar-event-form.tsx)) já resolveu o padrão visual que queremos adoptar:

- `<Sheet>` responsivo: `side='right' sm:max-w-[540px] sm:rounded-l-3xl` no desktop, `side='bottom' h-[80dvh] rounded-t-3xl` no mobile, com grabber visível em mobile.
- Backdrop translúcido: `bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl` + `shadow-2xl` + `border-border/40`.
- Header com título grande (`text-[22px] font-semibold leading-tight tracking-tight`), segmented control opcional e **barra AI quick-fill** com voz.
- **Pill-tabs** (não underline): `grid-cols-N h-9 p-0.5 rounded-full bg-muted/50 border border-border/30` — cada trigger é uma pill compacta com estado activo em `bg-background shadow-sm`.
- Footer translúcido fixo: `bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md`.
- Corpo das tabs em `space-y-5` / `space-y-7` com scroll interno `flex-1 min-h-0`.

Reusamos estes tokens e proporções para unificar os dois flavours de automatismo numa única superfície com **linguagem visual idêntica à do calendário**, adicionando as funcionalidades de gestão em falta e escondendo jargão.

## What Changes

- **Novo componente `<AutomationDetailSheet>`** em [`components/crm/automations-hub/automation-detail-sheet/`](../../../components/crm/automations-hub/) que substitui ambos os `<Dialog>` existentes (`CustomEventDetailDialog` + `FixedEventDetailDialog`). Um único shell responsivo com **os mesmos tokens visuais do `calendar-event-form.tsx`** (backdrop blur, rounded-3xl, pill-tabs, footer translúcido, grabber mobile) e 4 secções navegáveis por pill-tabs: **Informação**, **Quem recebe**, **Templates**, **Envios feitos**. Renderização diferenciada por `kind = 'fixed' | 'custom'` mas com layout idêntico.
- **Secção "Informação"** — header editável inline (nome, data+hora, recorrência "Anual / Numa data / Cada ano no aniversário", descrição) + **Switches de canais** que espelham disponibilidade real. `PATCH` no próprio endpoint do evento (`PUT /api/automacao/custom-events/[id]`). Para fixos, a "edição" limita-se a `send_hour` global + toggle global (ambos já existem, só mudam de sítio visual).
- **Chips de canal inteligentes** — Email/WhatsApp tags ganham três estados: **Activo** (canal ligado + consultor tem conta), **Desligado** (canal não está nos `channels` do evento), **Indisponível** (canal ligado mas consultor **não** tem conta/instância activa — tooltip "Não tem conta de email configurada. Configurar em Definições → Contas."). Switch correspondente fica disabled com o mesmo tooltip.
- **Secção "Contactos"** com sub-tabs unificadas por nome amigável:
  - Custom: **Incluídos** (actuais `custom_event_leads`) / **Por adicionar** (leads elegíveis sem associação, reusando `GET /api/automacao/custom-events/eligible-leads` com `event_id`).
  - Fixos: **A receber** (leads sem mute) / **Excluídos** (com mute).
  - Botões "Adicionar" (cria `custom_event_leads` ou remove `contact_automation_mutes`) e "Remover" (o inverso) coerentes entre os dois modos.
  - Filtros herdados do `LeadMultiSelect` refactorizado em [`replace-automation-contact-filters`](../replace-automation-contact-filters/) (Fase do pipeline + Estado do contacto).
- **Gestão de contacto individual** — cada linha tem menu `⋯` com: "Alterar hora", "Alterar template email", "Alterar template WhatsApp", "Remover da automação". Todos abrem um inline popover (não novo dialog) com persistência via `POST /api/leads/[leadId]/automation-settings`. Os overrides existentes cobrem fixos; **este change estende o suporte a eventos custom** (ver secção Impact + spec).
- **Secção "Templates"** — lista horizontal dos templates em uso (email + whatsapp), cada um um cartão clicável com: nome, badge "Padrão" se for default do consultor, botões `Preview`, `Tornar padrão`, `Editar` (abre o editor existente em `/dashboard/templates-email/[id]` numa nova tab ou dentro de Sheet-inception, configurável). Também lista os templates **candidatos** — não usados mas disponíveis ao consultor — com opção "Usar neste evento".
- **Secção "Execuções"** — timeline de `contact_automation_runs` ordenada por `sent_at DESC`. Cada linha: ícone do canal, nome do contacto, estado (Enviado / Agendado / Falhado / Ignorado), timestamp relativo. Para falhados, botão "Tentar novamente" (POST `/api/automacao/runs/[id]/retry`) + expandir para ver `error` e `skip_reason`. Sem tabela densa — cards/rows amigáveis.
- **BREAKING (DB aditivo)**: Extensão de `contact_automation_lead_settings` para suportar overrides por evento custom. Opção preferida: adicionar coluna `custom_event_id UUID NULL` (FK SET NULL → `custom_commemorative_events.id`) + ajustar unique constraint de `(lead_id, event_type)` para `(lead_id, event_type, COALESCE(custom_event_id, uuid_nil()))`. Alternativa (descrita no design): nova tabela `custom_event_lead_settings`. Migração aditiva — linhas existentes ficam com `custom_event_id=NULL` e comportam-se como hoje para fixos.
- **Linguagem PT-PT sem jargão**:
  - "Activo/Excluído" → "A receber / Não vai receber" nos fixos
  - "Contactos/Execuções" → "Quem recebe / Envios feitos"
  - "Mute" desaparece da UI (apenas nos commits/logs)
  - "Schedule"/"Spawn"/"Virtual" — nenhum desses termos aparece no corpo visível
- **Mobile-first** — sheet bottom com altura `85dvh`, tabs horizontais swipable, cards empilhados (não tabelas), acções primárias fixas no footer translúcido. Secções longas fazem scroll interno.

## Capabilities

### New Capabilities

- `automation-detail-sheet`: UI e contrato de dados do novo painel lateral unificado que abre ao clicar num card de automatismo (custom OR fixo). Define a composição das 4 secções, os estados de canal reflectindo disponibilidade real, o modelo de overrides por contacto (incluindo a extensão para eventos custom) e o comportamento mobile.

### Modified Capabilities

<!-- Nenhum spec existente descreve os diálogos actuais; são geridos como componentes internos. A nova capability é greenfield. -->

## Impact

- **UI nova** em `components/crm/automations-hub/automation-detail-sheet/` (diretório novo, ~8-10 ficheiros). Sobe em tamanho mas os actuais `custom-event-detail-dialog.tsx` (~780 linhas num só ficheiro) são fatiados em componentes focados (`automation-sheet-shell.tsx`, `automation-info-section.tsx`, `automation-contacts-section.tsx`, `automation-templates-section.tsx`, `automation-runs-section.tsx`, `automation-channel-chips.tsx`, `contact-row-menu.tsx`).
- **Remoção** de `CustomEventDetailDialog` e `FixedEventDetailDialog` após cut-over; hubs (`scheduled-tab.tsx`) passam a abrir o novo Sheet.
- **API novas/ajustadas**:
  - `GET /api/automacao/custom-events/[id]` — devolve agora também `effective_channels: {email: 'active'|'unavailable'|'off', whatsapp: …}` com base no cross-reference event×consultant accounts.
  - `GET /api/automacao/channel-availability` — novo endpoint pequeno que retorna `{email: {available: boolean, account_count}, whatsapp: {available, instance_count}}` para o consultor autenticado (usado em loads do sheet e do scheduled-tab para pré-popular estado).
  - `POST /api/leads/[leadId]/automation-settings` — passa a aceitar `custom_event_id?: string` no body; quando presente, upsert é scoped a esse evento.
  - `GET /api/automacao/custom-events/[id]/templates` — novo endpoint que devolve `{email: {default, alternatives[]}, whatsapp: {default, alternatives[]}}` para popular a secção Templates sem múltiplos fetches.
- **DB migration aditiva** (⚠️ deploy blocking):
  - Coluna `custom_event_id UUID NULL` em `contact_automation_lead_settings`.
  - FK `custom_event_id REFERENCES custom_commemorative_events(id) ON DELETE CASCADE`.
  - Índice `idx_cals_lead_event_custom (lead_id, event_type, custom_event_id)`.
  - Unique constraint ajustado para `(lead_id, event_type, COALESCE(custom_event_id, '00000000-0000-0000-0000-000000000000'::uuid))`.
- **Scheduled-tab** tem de ajustar o cálculo de `channels_active[]` para usar o novo helper partilhado `resolve-channels-for-event-consultant.ts` (única fonte de verdade entre tab cards e sheet chips).
- **Sem impacto** em: spawner de runs (lê `contact_automation_lead_settings` já com WHERE por `event_type`; adicionar filtro por `custom_event_id IS NULL` ou `= X` é trivial e coberto nas tasks). Email/WhatsApp edge functions inalteradas.
- **Performance** — payload do novo `GET /api/automacao/custom-events/[id]` fica maior (inclui templates available + channel availability). Mitigado via `Cache-Control: private, max-age=30`.
- **Acessibilidade** — Sheet usa focus-trap e `<SheetDescription>` sr-only; tabs via `<Tabs>` com aria-labels; switches com labels visíveis.
- **i18n** — todos os textos PT-PT, centralizados numa constante `AUTOMATION_SHEET_COPY` em [`lib/constants-automations.ts`](../../../lib/constants-automations.ts) para evitar drift.
