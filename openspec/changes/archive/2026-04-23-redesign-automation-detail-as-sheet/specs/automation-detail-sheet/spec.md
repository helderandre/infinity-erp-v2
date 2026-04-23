## ADDED Requirements

### Requirement: Detalhe de automatismo abre num Sheet responsivo

Clicar num card de automatismo (custom OR fixo) na página `/dashboard/crm/automatismos-contactos` SHALL abrir um `<Sheet>` único designado `<AutomationDetailSheet>` que substitui os dois `<Dialog>` anteriores (`CustomEventDetailDialog`, `FixedEventDetailDialog`). O Sheet SHALL adoptar **os mesmos tokens visuais e proporções que [`components/calendar/calendar-event-form.tsx`](../../../../components/calendar/calendar-event-form.tsx)**:

- Desktop: `side='right'` com `sm:max-w-[540px] sm:rounded-l-3xl`, altura total.
- Mobile: `side='bottom'` com `data-[side=bottom]:h-[80dvh] rounded-t-3xl` e grabber `h-1 w-10 rounded-full bg-muted-foreground/25` posicionado `absolute left-1/2 top-2.5 -translate-x-1/2`.
- Translucência: `bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl` + `shadow-2xl` + `border-border/40`.
- Título no header: `text-[22px] font-semibold leading-tight tracking-tight pr-10` com `<SheetDescription className="sr-only">` para acessibilidade.
- **Pill-tabs** (proibido usar underline-tabs): `TabsList` com `grid w-full grid-cols-4 h-9 p-0.5 rounded-full bg-muted/50 border border-border/30`. Trigger activo tem `bg-background shadow-sm`; inactivo `text-muted-foreground hover:text-foreground`.
- Footer: `<SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">`.

O Sheet SHALL conter 4 secções navegáveis por pill-tabs: **Informação** (mobile: "Info"), **Quem recebe** (mobile: "Contactos"), **Templates**, **Envios feitos** (mobile: "Envios") — labels PT-PT sem jargão técnico. A ordem dos tabs é fixa e igual para fixos e custom. Um header comum fixa-se no topo com o nome do evento + chips resumo (data/hora, recorrência, canais com estado real) e um footer translúcido fica no rodapé com acções "Fechar" + (para custom) "Eliminar automatismo".

#### Scenario: Abertura no desktop

- **WHEN** o consultor clica num card de automatismo numa viewport ≥768px
- **THEN** o Sheet abre do lado direito com backdrop translúcido (`backdrop-blur-2xl`)
- **AND** a largura máxima é 750px (`sm:max-w-[750px]`) com canto esquerdo arredondado (`sm:rounded-l-3xl`)
- **AND** o header mostra nome do evento em `text-[22px] font-semibold` + chips resumo (ex.: "Anual · Email · WhatsApp")
- **AND** a tab "Informação" está activa por defeito
- **AND** as tabs são renderizadas como pills (rounded-full) — NUNCA como underline-tabs

#### Scenario: Abertura no mobile

- **WHEN** o consultor abre o mesmo card numa viewport <768px
- **THEN** o Sheet abre em bottom-sheet com altura `85dvh` e grabber visível no topo
- **AND** as tabs são horizontalmente scrolláveis se não couberem
- **AND** o header colapsa para uma linha compacta

#### Scenario: Fecho preserva contexto

- **WHEN** o consultor fecha o Sheet após mudar uma tab para "Envios feitos"
- **AND** reabre o mesmo card
- **THEN** o Sheet SHALL reabrir na tab "Informação" (reset de estado local; não persistir entre aberturas)

#### Scenario: Dialogs antigos são removidos

- **GIVEN** o cut-over para o novo Sheet está completo
- **THEN** `CustomEventDetailDialog` e `FixedEventDetailDialog` NÃO SHALL ser exportados nem renderizados em lado nenhum
- **AND** `scheduled-tab.tsx` SHALL abrir `<AutomationDetailSheet>`

### Requirement: Chips e switches de canal reflectem disponibilidade real

Cada canal (Email, WhatsApp) SHALL ser apresentado como chip com um de três estados visuais e semânticos:

1. **Activo** (fundo preenchido, ícone cor primária): canal está incluído em `event.channels` E o consultor tem pelo menos uma `consultant_email_accounts` com `is_active=true` (para email) ou uma `auto_wpp_instances` com `status='connected'` (para WhatsApp).
2. **Desligado** (fundo transparente, ícone cinzento claro): canal NÃO está em `event.channels`. Pode ser activado via switch.
3. **Indisponível** (fundo transparente, ícone vermelho/warning, ícone de alerta sobreposto): canal está em `event.channels` mas o consultor NÃO tem conta/instância activa. Switch é `disabled` com tooltip "Não tem conta de email configurada. Configurar em Definições → Contas." (ou equivalente WhatsApp). Nenhum envio será feito por este canal independentemente do toggle.

O novo endpoint `GET /api/automacao/channel-availability` SHALL devolver `{email: {available: boolean, account_count: number}, whatsapp: {available: boolean, instance_count: number}}` para o consultor autenticado. O resposta do `GET /api/automacao/custom-events/[id]` SHALL ganhar o campo `effective_channels: {email: 'active'|'unavailable'|'off', whatsapp: ...}` com esta computação pré-feita pelo servidor.

#### Scenario: Consultor sem instância WhatsApp

- **GIVEN** o consultor não tem nenhuma `auto_wpp_instances` com `status='connected'`
- **AND** o evento tem `channels: ['email', 'whatsapp']`
- **WHEN** o consultor abre o Sheet
- **THEN** o chip "Email" SHALL estar no estado "Activo"
- **AND** o chip "WhatsApp" SHALL estar no estado "Indisponível" com ícone de alerta
- **AND** o switch WhatsApp SHALL ficar `disabled`
- **AND** hover sobre o chip WhatsApp SHALL mostrar tooltip "Não tem uma instância WhatsApp ligada. Configurar em Definições → WhatsApp."

#### Scenario: Consultor activa canal que tem conta

- **GIVEN** o consultor tem `consultant_email_accounts` activa
- **AND** o evento tem `channels: ['whatsapp']` (email está Desligado)
- **WHEN** o consultor clica no switch "Email"
- **THEN** o cliente SHALL chamar `PUT /api/automacao/custom-events/[id]` com `channels: ['whatsapp', 'email']`
- **AND** em sucesso o chip "Email" transita para "Activo"
- **AND** um toast `toast.success("Canal email activado")` é mostrado

#### Scenario: Consultor tenta activar canal indisponível

- **GIVEN** o consultor não tem conta de email activa
- **AND** o canal "Email" está no estado "Desligado"
- **WHEN** o cursor passa sobre o switch "Email"
- **THEN** o switch SHALL ter `aria-disabled='true'` e cursor `not-allowed`
- **AND** o clique SHALL não disparar acção (no-op)
- **AND** tooltip SHALL explicar o bloqueio com CTA para Definições

#### Scenario: Scheduled-tab usa o mesmo helper

- **WHEN** o scheduled-tab calcula o estado de canal para cada linha
- **THEN** SHALL usar o helper partilhado `lib/automacao/resolve-channels-for-event-consultant.ts`
- **AND** o resultado SHALL ser idêntico ao do Sheet para o mesmo (evento, consultor)

### Requirement: Secção "Informação" permite edição inline

A tab "Informação" SHALL mostrar e permitir edição dos campos nucleares do evento. Para eventos custom: `name`, `description`, `event_date`, `send_hour`, `is_recurring`, `channels`. Para eventos fixos: `send_hour` + toggle global de mute (os restantes são imutáveis — os fixos têm data/recorrência derivadas). Cada campo editável SHALL ter um "lápis" inline que activa modo de edição (input substitui o display); Enter/Save aplica `PUT /api/automacao/custom-events/[id]` (ou POST em `contact-automation-mutes` para fixos); Esc/Cancel restaura. Erros de validação aparecem em `toast.error` + mantêm modo de edição.

#### Scenario: Editar data de evento custom

- **WHEN** o consultor clica no lápis ao lado de "19 de abril"
- **THEN** um `<DatePicker>` substitui o display
- **AND** seleccionar nova data + Enter dispara `PUT /api/automacao/custom-events/[id]` com `event_date: 'YYYY-MM-DD'`
- **AND** em sucesso o display volta a aparecer com a nova data + toast "Data actualizada"

#### Scenario: Editar hora de evento fixo

- **WHEN** o consultor edita "Hora de envio" num evento fixo (Natal)
- **AND** submete `11:00`
- **THEN** o cliente SHALL persistir via upsert em `consultant_template_defaults` ou mecanismo existente (manter comportamento actual do `FixedEventDetailDialog`)
- **AND** a hora aparece no header como chip actualizado

#### Scenario: Descrição vazia em custom

- **WHEN** o consultor apaga totalmente o campo "Descrição"
- **AND** guarda
- **THEN** o cliente envia `description: null`
- **AND** o display passa a mostrar placeholder em itálico "Sem descrição"

#### Scenario: Campos imutáveis em fixo não têm lápis

- **WHEN** o consultor abre o Sheet para o evento "Natal"
- **THEN** os campos "Nome" e "Data" SHALL ser read-only (sem lápis)
- **AND** só "Hora de envio" e toggle "Canais" SHALL aparecer editáveis

### Requirement: Secção "Quem recebe" unifica gestão de contactos

A tab "Quem recebe" SHALL ter duas sub-tabs internas:
- Para **custom**: **Incluídos** (leads em `custom_event_leads`) / **Por adicionar** (leads elegíveis sem `is_associated`).
- Para **fixos**: **A receber** (leads sem mute) / **Não vai receber** (leads com mute).

Os filtros (Fase do pipeline + Estado do contacto — herdados de [replace-automation-contact-filters](../../replace-automation-contact-filters/)) SHALL estar visíveis apenas na sub-tab "Por adicionar" / "Não vai receber". A sub-tab "Incluídos" / "A receber" SHALL ter apenas pesquisa por nome/email/telemóvel.

Cada linha SHALL ser um card compacto (não row de tabela) com: avatar/iniciais, nome, estado do contacto (badge), contactos (email + telemóvel em linha separada), menu `⋯` com acções.

- **Adicionar** (visível nas sub-tabs "Por adicionar" / "Não vai receber"): botão primário à direita do card. Para custom: `POST /api/automacao/custom-events/[id]/leads` com `{lead_ids: [id]}`. Para fixo: `DELETE /api/contact-automation-mutes?id=X`.
- **Remover** (visível nas sub-tabs "Incluídos" / "A receber"): acção no menu `⋯`. Para custom: `DELETE /api/automacao/custom-events/[id]/leads` com `{lead_ids: [id]}`. Para fixo: `POST /api/contact-automation-mutes` com `{lead_id, event_type, channel: null}`.
- Selecção múltipla via checkbox + "Adicionar seleccionados" / "Remover seleccionados" na barra flutuante (pattern reusado de `batch-action-bar.tsx` dos documentos).

Contador no título de cada sub-tab (ex.: "Incluídos (12)") actualizado optimisticamente após cada acção.

#### Scenario: Adicionar lead a evento custom

- **GIVEN** o consultor está na sub-tab "Por adicionar" com 5 leads filtrados
- **WHEN** clica "Adicionar" no card de João
- **THEN** `POST /api/automacao/custom-events/[id]/leads` é chamado com `{lead_ids: ['<joao-id>']}`
- **AND** o card transita para a sub-tab "Incluídos" com animação
- **AND** os contadores actualizam (`Incluídos +1`, `Por adicionar -1`)

#### Scenario: Remover lead de evento fixo (adicionar ao mute)

- **GIVEN** o evento é "Natal" e o lead Maria está em "A receber"
- **WHEN** o consultor clica "Remover" no menu `⋯` da linha da Maria
- **AND** confirma num `AlertDialog` "Maria não vai receber a mensagem de Natal. Continuar?"
- **THEN** `POST /api/contact-automation-mutes` cria `{lead_id: '<maria>', event_type: 'natal', channel: null, consultant_id: <self>}`
- **AND** o card transita para "Não vai receber"

#### Scenario: Batch remover em fixo

- **WHEN** o consultor selecciona 3 leads em "A receber"
- **AND** clica "Remover seleccionados"
- **THEN** SHALL criar 3 rows em `contact_automation_mutes` numa única chamada (nova rota `POST /api/contact-automation-mutes/batch` OU 3 chamadas paralelas com pLimit)
- **AND** em caso de erro parcial, mostra `toast.error` com contagem "2 removidos, 1 falhou"

### Requirement: Menu por contacto suporta overrides individuais

O menu `⋯` de cada card de contacto na sub-tab "Incluídos" / "A receber" SHALL oferecer as acções: "Alterar hora", "Alterar template de email", "Alterar template de WhatsApp", "Remover da automação". Cada acção abre um `<Popover>` anchorado no botão (não novo Dialog), com o campo relevante e botões "Guardar"/"Cancelar". A persistência faz upsert em `contact_automation_lead_settings` via `POST /api/leads/[leadId]/automation-settings` com body `{event_type, custom_event_id?, send_hour?, email_template_id?, wpp_template_id?}`.

Após guardar, o card SHALL exibir uma pill discreta indicando quais campos estão overridden (ex.: `⏰ 11:00` a verde se hora diferente do default, `📧 Personalizado` se template email override). Hover na pill descreve o override completo.

#### Scenario: Override de hora para um lead em evento custom

- **WHEN** o consultor clica "Alterar hora" para João num evento custom com `id='<ev-id>'`
- **AND** selecciona `14:00` e guarda
- **THEN** `POST /api/leads/<joao>/automation-settings` é chamado com body `{event_type: 'custom_event', custom_event_id: '<ev-id>', send_hour: 14}`
- **AND** o servidor faz upsert scoped a `(lead_id, event_type, custom_event_id)`
- **AND** o card de João passa a mostrar pill `⏰ 14:00`

#### Scenario: Remover override existente

- **GIVEN** João tem override de hora `14:00` para o evento custom
- **WHEN** o consultor clica "Alterar hora" e seleccionar "Usar hora do evento (09:00)"
- **THEN** `DELETE /api/leads/<joao>/automation-settings?event_type=custom_event&custom_event_id=<ev-id>&field=send_hour` remove só o campo `send_hour`
- **AND** a pill `⏰ 14:00` desaparece
- **AND** a hora volta a seguir o default do evento

#### Scenario: Override funciona para fixos sem regressão

- **GIVEN** um lead tem override de `send_hour=11` para `event_type='natal'` (sem `custom_event_id`)
- **WHEN** o spawner calcula o próximo run de Natal para esse lead
- **THEN** SHALL usar hora 11:00 (comportamento actual preservado)
- **AND** a DB query continua `WHERE event_type='natal' AND lead_id=... AND custom_event_id IS NULL`

### Requirement: Secção "Templates" mostra usados + candidatos e permite default

A tab "Templates" SHALL listar, por canal, dois grupos: **Templates usados** (o default do evento + todos os que aparecem em overrides de contactos) e **Outros disponíveis** (os restantes `tpl_email_library` / `auto_wpp_templates` no scope do consultor + system). Cada template SHALL ser um card com nome, categoria, badge "Padrão" se for default, botões `Preview` (abre iframe/modal com `body_html` e variáveis resolvidas para um lead exemplo), `Tornar padrão` (para os não-default), `Editar` (navega para `/dashboard/templates-email/[id]` ou `/dashboard/templates-whatsapp/[id]` com query `?return_to=automation-sheet&event_id=<id>` para preservar contexto).

"Tornar padrão" SHALL fazer `PUT /api/automacao/custom-events/[id]` com `{email_template_id: <id>}` OR `{wpp_template_id: <id>}`. Para eventos fixos, SHALL escrever em `consultant_template_defaults` com `POST /api/automacao/template-defaults`.

#### Scenario: Ver preview de template

- **WHEN** o consultor clica "Preview" num card de template
- **THEN** um Dialog abre com o HTML renderizado
- **AND** as variáveis `{{lead.nome}}`, `{{consultor.nome}}`, `{{evento.data}}` etc. SHALL aparecer resolvidas com valores de exemplo

#### Scenario: Definir novo template padrão

- **WHEN** o consultor clica "Tornar padrão" num template email alternativo
- **AND** já existia um default diferente
- **THEN** o novo template aparece com badge "Padrão"
- **AND** o anterior perde o badge
- **AND** toast "Template de email definido como padrão"

#### Scenario: Editar template

- **WHEN** o consultor clica "Editar" num template
- **THEN** navegação para o editor dedicado
- **AND** após guardar, um botão "Voltar ao automatismo" (via `return_to` query) leva de volta ao Sheet com a mesma tab activa

### Requirement: Secção "Envios feitos" lista runs com retry em falhas

A tab "Envios feitos" SHALL listar as últimas 100 linhas de `contact_automation_runs` ordenadas por `COALESCE(sent_at, scheduled_for) DESC` (mais recentes primeiro), renderizadas como cards verticais em timeline. Cada card mostra: ícone do canal, nome do contacto (link para `/dashboard/leads/[id]`), estado (badge colorido: Enviado verde / Agendado azul / Falhado vermelho / Ignorado cinzento), timestamp relativo ("há 2 horas"), e para falhos/ignorados uma expansão com `error` e `skip_reason`.

Cards com `status='failed'` SHALL ter botão "Tentar novamente" que dispara `POST /api/automacao/runs/[id]/retry`. Em sucesso (201 com `{new_run_id}`), o novo run aparece no topo da timeline com `status='pending'` e o card antigo mantém-se com estado Falhado (histórico imutável).

Agrupamento visual por dia quando há múltiplos runs no mesmo dia (ex.: heading "Hoje", "Ontem", "25 de Dezembro").

#### Scenario: Retry de run falhado

- **WHEN** o consultor clica "Tentar novamente" num run falhado
- **THEN** POST é feito
- **AND** um novo card aparece no topo com status "Agendado"
- **AND** toast "Envio reagendado"

#### Scenario: Filtro por estado

- **WHEN** o consultor clica num chip "Só falhados" acima da timeline
- **THEN** SHALL filtrar client-side para mostrar apenas `status='failed'`
- **AND** o contador no chip reflecte o total filtrado

#### Scenario: Sem envios ainda

- **WHEN** o evento nunca disparou (sem rows em `contact_automation_runs`)
- **THEN** empty state ilustrado com ícone + "Ainda não foram enviadas mensagens. O primeiro envio está agendado para <data>."

### Requirement: Mobile colapsa layout em bottom-sheet optimizado

Em viewports `<md` (<768px) o Sheet SHALL usar `side='bottom'` com altura `85dvh`, cantos arredondados no topo e grabber (`<div className='mx-auto h-1 w-12 rounded-full bg-muted'/>`) visível. O header SHALL colapsar para uma única linha (nome + botão de fechar); os chips resumo ficam logo abaixo em linha scrollável horizontal. As tabs SHALL ser horizontalmente scrolláveis com `overflow-x-auto` + `snap-x`; tab activa centrada automaticamente em mudança. Cards de contacto/run SHALL ser vertical stack sem colunas laterais. O footer de acções fixa-se no fundo com safe-area inset.

#### Scenario: Abertura em iPhone

- **GIVEN** viewport de 375×667
- **WHEN** o consultor abre o Sheet
- **THEN** ocupa `85dvh` a partir do fundo
- **AND** as 4 tabs cabem horizontalmente (texto curto: "Info", "Contactos", "Templates", "Envios")
- **AND** scroll vertical dentro do corpo funciona sem interferir com o Sheet drag-to-close

#### Scenario: Tabs swipe

- **WHEN** o consultor faz swipe horizontal nas tabs
- **THEN** a tab seguinte scrolla suavemente para o centro
- **AND** a área de conteúdo transita para os dados dessa tab

### Requirement: DB migration aditiva para overrides em eventos custom

Uma migration `supabase/migrations/<timestamp>_contact_automation_settings_custom_event.sql` SHALL:
1. Adicionar coluna `custom_event_id UUID NULL` a `contact_automation_lead_settings`.
2. Adicionar FK `REFERENCES custom_commemorative_events(id) ON DELETE CASCADE`.
3. Substituir o unique constraint existente em `(lead_id, event_type)` por `(lead_id, event_type, COALESCE(custom_event_id, '00000000-0000-0000-0000-000000000000'::uuid))` usando um expression index único.
4. Adicionar índice `idx_cals_lead_event_custom (lead_id, event_type, custom_event_id)`.
5. Linhas existentes ficam com `custom_event_id=NULL` e mantêm-se válidas para eventos fixos.

O spawner/retry logic SHALL ser actualizado para filtrar `custom_event_id` correctamente: fixos procuram `IS NULL`, custom procuram `= <id>`. Qualquer rota que já consulte `contact_automation_lead_settings` SHALL ser auditada e ajustada.

#### Scenario: Dois leads com overrides distintos por evento

- **GIVEN** lead L tem settings para `aniversario_contacto` (fixo, `custom_event_id=NULL`) com `send_hour=10`
- **AND** lead L também tem settings para evento custom Páscoa (`custom_event_id='<x>'`) com `send_hour=14`
- **WHEN** o spawner processa aniversário de L
- **THEN** usa hora 10 (match de `event_type='aniversario_contacto' AND custom_event_id IS NULL`)
- **WHEN** o spawner processa Páscoa de L
- **THEN** usa hora 14 (match de `event_type='custom_event' AND custom_event_id='<x>'`)

#### Scenario: Migration é aditiva e reversível

- **WHEN** a migration é aplicada numa DB com 0 settings
- **THEN** SHALL executar sem erros e sem afectar dados
- **WHEN** a migration é aplicada numa DB com rows existentes
- **THEN** todas as rows ficam com `custom_event_id=NULL` e continuam válidas
- **AND** queries existentes (sem o novo predicado) continuam a retornar os mesmos resultados

### Requirement: Copywriting PT-PT sem jargão técnico

Toda a UI visível no Sheet SHALL usar vocabulário acessível. Termos proibidos no texto exibido ao utilizador: `mute`, `schedule`, `spawn`, `virtual`, `cron`, `RPC`, `upsert`, `template id`, `payload`. Os nomes das tabs, botões, tooltips, toasts e empty states SHALL ser escritos para um consultor imobiliário sem background técnico. Uma constante central `AUTOMATION_SHEET_COPY` em [`lib/constants-automations.ts`](../../../../lib/constants-automations.ts) SHALL centralizar todo o copy editável.

#### Scenario: Mensagens de sucesso não mencionam DB

- **WHEN** o consultor adiciona 3 leads a um evento custom
- **THEN** toast SHALL dizer "3 contactos adicionados" (não "3 linhas upserted em custom_event_leads")

#### Scenario: Empty state amigável

- **WHEN** a sub-tab "Por adicionar" não tem leads candidatos
- **THEN** empty state SHALL dizer "Todos os seus contactos já estão neste automatismo."
- **AND** NOT "No eligible leads found in database"
