## Context

### Estado actual

A página `/dashboard/crm/automatismos-contactos` serve dois modelos conceptuais de automatismo — **fixos** (`aniversario_contacto`, `natal`, `ano_novo`, geridos via `contact_automation_mutes` / opt-out) e **custom** (`custom_commemorative_events`, geridos via `custom_event_leads` / opt-in). Cada um tem o seu diálogo dedicado em [`components/crm/automations-hub/custom-events/custom-event-detail-dialog.tsx`](../../../components/crm/automations-hub/custom-events/custom-event-detail-dialog.tsx) (780+ linhas num só ficheiro, duas funções: `CustomEventDetailDialog` lines 51-277 e `FixedEventDetailDialog` lines 293-779).

Características actuais:
- **Fixos** já suportam per-lead overrides (hour, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id) via `contact_automation_lead_settings` + API `POST /api/leads/[id]/automation-settings`. Suportam também mute global via `contact_automation_mutes` com `lead_id=null`.
- **Custom** NÃO suportam overrides — apenas associação simples de leads em `custom_event_leads (event_id, lead_id, added_at)`. Para overridar hora ou template por contacto, o consultor teria que desassociar o lead e criar um evento separado — fluxo absurdo.
- Os chips de canal (Email/WhatsApp) nos cards do scheduled-tab e nos diálogos são puramente visuais (`event.channels` array) — não reflectem se o consultor tem realmente uma `consultant_email_accounts` ou `auto_wpp_instances` activa. O consultor pode "activar" email num automatismo sem ter conta SMTP, e nunca nada é enviado silenciosamente.
- Execuções (`contact_automation_runs`) são mostradas em tabela densa com colunas de 4 campos. Em mobile isto é pouco utilizável.
- Não há secção de gestão de templates — o consultor que queira trocar o template default tem que navegar para `/dashboard/templates-email` ou `/dashboard/templates-whatsapp`.
- A **sheet de criar/editar evento** do calendário ([`components/calendar/calendar-event-form.tsx`](../../../components/calendar/calendar-event-form.tsx)) — **não** a página de detalhe read-only — já resolveu o padrão visual e interactivo que queremos espelhar: Sheet responsivo (right-desktop / bottom-mobile `h-[80dvh]`), backdrop blur + rounded-3xl + sombra forte, header com título grande + AI quick-fill bar opcional, **pill-tabs** (rounded-full com estado activo `bg-background shadow-sm`), corpo scrollável com `space-y-5`, footer translúcido (`bg-background/40 backdrop-blur-md`). É a reference design para o novo `<AutomationDetailSheet>` — o mesmo vocabulário visual que o consultor já aprendeu a usar no calendário.

### Stakeholders

Consultores imobiliários que usam o hub de automatismos diariamente; Broker/CEO que supervisiona o pipeline; equipa de suporte que tem hoje de explicar a bypasses como "abrir wizard" para adicionar contactos a evento existente.

### Constraints

- Preservar compatibilidade do spawner/retry — já funcionam em produção e gastam slots de cron no Coolify. Alterações à schema de `contact_automation_lead_settings` têm que ser aditivas (nullable column, nova unique constraint que não invalida rows existentes).
- Manter as duas conceptualizações (opt-out fixo vs opt-in custom) — o utilizador **quer** ver excluídos/por-adicionar; não fundir tudo numa única tab.
- Zero quebras no cron (`/api/automacao/scheduler/spawn-runs`) — auditoria obrigatória de todas as queries que lêem `contact_automation_lead_settings`.
- PT-PT sem jargão em toda a UI visível (requisito explícito do utilizador).
- Mobile-first — muitos consultores usam o ERP em tablet/telemóvel entre visitas.

## Goals / Non-Goals

**Goals:**

- Unificar os dois `<Dialog>` num único `<AutomationDetailSheet>` que reutiliza o padrão do calendário (mobile bottom-sheet, desktop right-panel, header+chips+tabs+footer).
- Dar ao consultor **edição inline** dos campos nucleares (data, hora, recorrência, canais, descrição) sem ter que eliminar-e-recriar.
- Dar uma **secção de gestão de contactos** com dois pratos (incluídos + por adicionar) e acções de selecção múltipla sem sair da tab.
- Dar uma **secção de templates** onde o consultor vê os usados, define o padrão, e salta para o editor.
- Dar uma **secção de execuções** com retry visível e agrupamento temporal amigável.
- Fazer os **chips de canal** refletirem disponibilidade real (email account / whatsapp instance) para que o consultor saiba quando nada vai sair mesmo com o toggle ligado.
- Extender per-lead overrides a **eventos custom** (hora/template diferente por contacto dentro do mesmo evento).
- Usar **linguagem acessível** em todos os textos visíveis.

**Non-Goals:**

- Não reescrever o wizard de criação de automatismo. Ele continua como está em [`custom-event-wizard.tsx`](../../../components/crm/automations-hub/custom-events/custom-event-wizard.tsx); só muda o que acontece depois (abertura do Sheet).
- Não alterar o runtime do spawner/retry além do necessário para honrar o novo `custom_event_id` em `contact_automation_lead_settings`.
- Não criar novo editor de templates — "Editar" faz navegação para o editor existente em `/dashboard/templates-email/[id]` / `/dashboard/templates-whatsapp/[id]`.
- Não adicionar novos canais (SMS, push) — ficam fora do escopo.
- Não migrar `custom_event_leads` para uma tabela nova. Continua simples `(event_id, lead_id, added_at)` — overrides vivem em `contact_automation_lead_settings`.

## Decisions

### 1. Unificar num único `<AutomationDetailSheet>` com `kind='fixed'|'custom'`

**Decisão:** Um componente shell único que recebe `{kind, eventId, open, onOpenChange}` e internamente decide quais sub-componentes renderizar. O layout (header, tabs, footer) é idêntico; só o conteúdo das tabs diverge em pontos específicos (sub-tab labels, campos editáveis em Info, fonte de dados de contactos).

**Alternativa considerada:** Dois componentes `<FixedAutomationSheet>` + `<CustomAutomationSheet>` que partilham um `<AutomationSheetShell>` wrapper. Rejeitado porque duplica o código de tabs + headers sem ganho — os pontos de divergência são 5-6 condicionais pequenos (via `kind === 'custom'`).

**Tokens visuais copiados directamente de [`calendar-event-form.tsx`](../../../components/calendar/calendar-event-form.tsx):**

```tsx
<SheetContent
  side={isMobile ? 'bottom' : 'right'}
  className={cn(
    'p-0 flex flex-col overflow-hidden border-border/40 shadow-2xl',
    'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl',
    isMobile
      ? 'data-[side=bottom]:h-[80dvh] rounded-t-3xl'
      : 'w-full data-[side=right]:sm:max-w-[540px] sm:rounded-l-3xl',
  )}
>
  {isMobile && (
    <div className="absolute left-1/2 top-2.5 -translate-x-1/2 h-1 w-10 rounded-full bg-muted-foreground/25" />
  )}

  <div className="shrink-0 px-6 pt-8 pb-4 sm:pt-10">
    <SheetHeader className="p-0 gap-0">
      <SheetTitle className="text-[22px] font-semibold leading-tight tracking-tight pr-10">
        {event.name}
      </SheetTitle>
      <SheetDescription className="sr-only">{description}</SheetDescription>
    </SheetHeader>
    {/* header chips (data/hora/recorrência/canais) em linha compacta */}
  </div>

  <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
    <div className="shrink-0 px-6">
      <TabsList className="grid w-full grid-cols-4 h-9 p-0.5 rounded-full bg-muted/50 border border-border/30">
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="contacts">Quem recebe</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="runs">Envios</TabsTrigger>
      </TabsList>
    </div>
    {/* TabsContent com space-y-5, scroll interno */}
  </Tabs>

  <SheetFooter className="px-6 py-4 flex-row gap-2 shrink-0 bg-background/40 supports-[backdrop-filter]:bg-background/30 backdrop-blur-md">
    {/* Fechar + (custom) Eliminar */}
  </SheetFooter>
</SheetContent>
```

Os nomes das tabs em mobile SHALL ser versões curtas (`Info / Contactos / Templates / Envios`) para caberem no `grid-cols-4` sem truncar; em desktop são longas (`Informação / Quem recebe / Templates / Envios feitos`). A constante `AUTOMATION_SHEET_COPY` expõe ambos os conjuntos (`tabsLong`, `tabsShort`).

### 2. Per-lead overrides em eventos custom: estender `contact_automation_lead_settings` em vez de nova tabela

**Decisão:** Adicionar coluna `custom_event_id UUID NULL` a `contact_automation_lead_settings`. A lógica existente (com `custom_event_id IS NULL`) continua a funcionar para fixos; eventos custom filtram `custom_event_id = X`. Unique constraint ajustado via expression index:

```sql
ALTER TABLE contact_automation_lead_settings
  ADD COLUMN custom_event_id UUID NULL
    REFERENCES custom_commemorative_events(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS contact_automation_lead_settings_unique_idx;
CREATE UNIQUE INDEX contact_automation_lead_settings_unique_idx
  ON contact_automation_lead_settings (
    lead_id,
    event_type,
    COALESCE(custom_event_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX idx_cals_lead_event_custom
  ON contact_automation_lead_settings (lead_id, event_type, custom_event_id);
```

**Alternativa considerada:** Tabela nova `custom_event_lead_settings` com mesma schema. Rejeitado porque:
- Duplica código no spawner (duas tabelas para verificar overrides).
- Duplica a rota `POST /api/leads/[id]/automation-settings` (ou força parâmetro dispatch).
- As colunas de override são **idênticas** (send_hour, email_template_id, wpp_template_id, smtp_account_id, wpp_instance_id). Semântica é a mesma — only scope muda.

**Alternativa considerada:** JSON coluna `overrides jsonb` em `custom_event_leads`. Rejeitado porque perde type safety e obriga a parseamento manual no spawner; também não permite reuso do código de resolução de templates que já existe para fixos.

### 3. Channel availability: endpoint dedicado + helper partilhado

**Decisão:** Novo `GET /api/automacao/channel-availability` retorna payload pequeno `{email: {available, account_count}, whatsapp: {available, instance_count}}` que o client carrega uma vez por sessão (cacheado em module-level). O `GET /api/automacao/custom-events/[id]` passa a incluir `effective_channels` pré-computado para poupar round-trips.

Um helper puro `lib/automacao/resolve-channels-for-event-consultant.ts` aceita `(event, accounts, instances)` e devolve `{email: 'active'|'unavailable'|'off', whatsapp: ...}`. É usado:
1. Server-side no `GET /api/automacao/custom-events/[id]`.
2. Server-side no `useScheduled` hook do scheduled-tab (passa a cross-reference em vez de só ler `event.channels`).
3. Client-side no Sheet para reconciliar após toggle optimistic.

**Alternativa considerada:** Inferir do DOM / não mostrar indisponível, deixar silenciar. Rejeitado porque é o bug actual — o consultor não sabe porque é que Natal nunca disparou email para ninguém e é porque não tinha SMTP configurado desde o início.

**Alternativa considerada:** Cron-time check apenas (spawner skipa canal sem account). Rejeitado porque já acontece e é invisível — a UI tem que prevenir o erro antes de o consultor agendar.

### 4. Secção Templates com "usados + candidatos" + navegação para editor existente

**Decisão:** Novo endpoint `GET /api/automacao/custom-events/[id]/templates` devolve `{email: {default: {...}, used: [...], available: [...]}, whatsapp: {...}}` onde:
- `default` = o template do evento (`email_template_id` / `wpp_template_id`) ou null
- `used` = templates que aparecem em overrides de `contact_automation_lead_settings` para contactos deste evento
- `available` = todos os restantes templates no scope do consultor (scope='personal' OR 'global' system)

Editar é out-of-scope visual — cada card tem "Editar" que navega para `/dashboard/templates-email/[id]?return_to=automation-sheet&event_id=<>`. O editor existente é retrocompat (já aceita qualquer retorno).

"Tornar padrão" para custom → `PUT /api/automacao/custom-events/[id] {email_template_id: X}`. Para fixos → `POST /api/automacao/template-defaults {event_type, channel, template_id}` (endpoint já existe).

**Alternativa considerada:** Editor inline num Dialog dentro do Sheet. Rejeitado — templates têm WYSIWYG complexo (Craft.js) que não cabe elegantemente num nested modal e duplica maintenance.

### 5. Secção Runs como timeline agrupada em vez de tabela

**Decisão:** Render vertical de cards por run, agrupados por dia via heading sticky ("Hoje", "Ontem", "25 de Dezembro"). Cada card tem: ícone do canal (cor primária), nome do contacto, badge de estado colorido, timestamp relativo com `date-fns/formatDistanceToNow`. Retry em falhados via botão integrado.

**Alternativa considerada:** Tabela com colunas (como hoje). Rejeitado — em mobile o overflow horizontal é inutilizável; a timeline scala melhor em ambas as larguras.

### 6. Inline edit via "lápis toggle" em vez de modo edit global

**Decisão:** Cada campo editável na tab Informação tem um ícone de lápis discreto. Clicar faz o campo transitar de `<span>` para `<Input>`/`<Select>`/`<DatePicker>`. Enter ou blur persiste; Esc cancela. Padrão inspirado no calendário.

**Alternativa considerada:** Botão "Editar" global que troca o Sheet todo para modo form. Rejeitado porque é overkill para 3-5 campos e quebra o padrão calendar que já treinou o utilizador.

### 7. Selecção múltipla com barra flutuante reutilizável

**Decisão:** Reusar `<BatchActionBar>` de `components/documents/batch-action-bar.tsx` (já usa animação slide-up e padrão partilhado). Selecção gerida com `Set<lead_id>` em state local do Sheet.

### 8. Copy centralizado numa constante

**Decisão:** Todo o texto visível do Sheet vive em `AUTOMATION_SHEET_COPY` em [`lib/constants-automations.ts`](../../../lib/constants-automations.ts):

```ts
export const AUTOMATION_SHEET_COPY = {
  tabs: {
    info: 'Informação',
    contacts: 'Quem recebe',
    templates: 'Templates',
    runs: 'Envios feitos',
  },
  subTabs: {
    custom: { included: 'Incluídos', toAdd: 'Por adicionar' },
    fixed: { included: 'A receber', excluded: 'Não vai receber' },
  },
  channels: {
    emailUnavailable: 'Não tem uma conta de email configurada. Adicionar em Definições → Contas.',
    whatsappUnavailable: 'Não tem uma instância WhatsApp ligada. Configurar em Definições → WhatsApp.',
  },
  // ... etc
} as const
```

Força code review semântica quando alguém mexe em copy e permite futuras extensões (i18n se surgir Brasileiro).

## Risks / Trade-offs

**[Risco] Migração da constraint unique em produção** — ALTER do índice unique numa tabela com writes concorrentes pode falhar.
→ Mitigação: usar `CREATE UNIQUE INDEX CONCURRENTLY` + `DROP INDEX CONCURRENTLY` na migration. Testar em staging com dataset clonado de produção antes do deploy. A migration file SHALL ter comentário de aviso destacado para o Broker rever.

**[Risco] Spawner/retry a usar queries stale** — após adicionar `custom_event_id`, qualquer query antiga que faça `WHERE lead_id=X AND event_type=Y` pode dar match a overrides de custom events que não deveria.
→ Mitigação: auditoria obrigatória nas tasks + adicionar explicitamente `AND custom_event_id IS NULL` nas queries de eventos fixos. Test unit assertions cobrindo ambos os casos no design scenario acima.

**[Risco] Unificar dialogs duplica complexidade se os ramos `kind === 'custom'` espalharem condicionais** — o componente pode virar spaghetti.
→ Mitigação: extrair sub-componentes por secção (`<InfoSection kind={kind}/>`, `<ContactsSection kind={kind}/>`) em vez de condicionais inline. Cada sub-componente resolve o próprio kind. O shell só passa props.

**[Risco] Mobile bottom-sheet + tabs + popovers de edição → camadas de portais a competir por focus.**
→ Mitigação: testar com VoiceOver iOS e TalkBack Android. Usar `Popover modal={false}` dentro do Sheet para evitar focus-trap duplo. Documentar pattern em README interno se precisar ser reusado.

**[Risco] Channel availability endpoint chamado em cada load do scheduled-tab card → N+1.**
→ Mitigação: caching module-level com TTL 60s no client; backend retorna pouco (2 ints). Payload sub-1kb.

**[Risco] Templates "Editar" que abre novo tab perde estado do Sheet.**
→ Mitigação: `return_to=automation-sheet&event_id=<>` query params + localStorage flag `reopen_automation_sheet_eventId` que o scheduled-tab lê em mount para reabrir automaticamente.

**[Risco] Per-lead overrides de evento custom não aparecem nos runs se o spawner não for actualizado.**
→ Mitigação: a task de update do spawner é explicitamente listada e SHALL ser feita antes de o UI permitir criar overrides. Feature flag opcional (`CUSTOM_EVENT_OVERRIDES_ENABLED`) se preciso rollback parcial.

**[Risco] Scope creep — "enquanto mexemos no diálogo, podíamos também adicionar X" durante implementação.**
→ Mitigação: spec lista explicitamente Non-Goals. Qualquer extensão pede nova proposal.

**Trade-off:** Componente shell unificado vs dois componentes separados. Escolhido unificado para reduzir duplicação de layout/estilo; o custo é disciplina na organização por sub-componentes.

**Trade-off:** Extensão de `contact_automation_lead_settings` vs nova tabela. Escolhido extensão para não duplicar lógica no spawner; o custo é a unique constraint com `COALESCE(...)` que é menos legível que um simples `(lead_id, event_type, custom_event_id)` composto com NULL semantics (Postgres trata NULL como distinto em unique por defeito — por isso usamos o COALESCE).

**Trade-off:** Endpoint dedicado para templates vs inline no GET do evento. Escolhido dedicado para manter o payload do evento lean; o custo é um request extra quando o consultor entra na tab Templates.

## Migration Plan

1. **Migration SQL** — aplicar primeiro em staging, smoke-test do spawner, depois deploy produção:
   - `supabase/migrations/<ts>_cals_custom_event_id.sql` com `CREATE INDEX CONCURRENTLY` + rebuild do unique constraint.
2. **Helper + endpoint de channel availability** — adicionar sem breaking.
3. **API updates** — actualizar `GET /api/automacao/custom-events/[id]` com `effective_channels`, aceitar `custom_event_id` em `POST /api/leads/[id]/automation-settings`, criar `GET /api/automacao/custom-events/[id]/templates` e `/channel-availability`.
4. **Spawner + retry audit** — ajustar queries para filtrar por `custom_event_id IS NULL` em fixos e `= X` em custom. Testar em staging antes de deploy.
5. **Componente novo `<AutomationDetailSheet>`** — implementar em paralelo sem remover os dialogs antigos. Feature flag `USE_AUTOMATION_SHEET` opcional para toggle lado a lado em staging.
6. **Cut-over** — `scheduled-tab.tsx` passa a abrir o novo Sheet. Dialogs antigos ficam exportados mas não-usados.
7. **Cleanup** — remover `CustomEventDetailDialog` + `FixedEventDetailDialog` + copy desnecessário após 1 semana em produção sem regressão.
8. **Rollback**: reverter cut-over (1 linha em scheduled-tab) reabre os dialogs antigos; migration não precisa de rollback porque é aditiva.

## Open Questions

1. **Edição de descrição em fixos?** — O evento "Natal" não tem `description` na schema. O utilizador quer poder anotar algo ("Lembra-te: este ano incluir promoção X")? Se sim, precisamos de nova coluna `consultant_notes` em `contact_automation_event_preferences` (tabela nova) ou reutilizar `consultant_template_defaults.notes`. Ficou fora do escopo até confirmação.

2. **Eliminar evento fixo?** — Fixos não podem ser eliminados (são sistema). O toggle "Activo" global já cobre o caso "não quero receber Natal". Confirmar que o footer do Sheet NÃO mostra botão Eliminar para `kind='fixed'`.

3. **Histórico de runs além dos 100 mais recentes?** — Paginação na tab "Envios feitos" se o consultor quiser ver mais do que os últimos 100? Por agora fica como limite fixo; follow-up se surgir pedido.

4. **Reopen após editar template** — O localStorage flag para reabrir o Sheet após voltar do editor assume que o consultor volta de imediato. Se fechar a tab intermédia, o flag fica stale. TTL de 5 min no localStorage? Ou limpar ao voltar. Decisão: limpar no mount do scheduled-tab após abrir o Sheet (consumido).
