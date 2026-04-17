## Context

O sistema de automatismos de contactos já suporta 3 eventos fixos virtuais (`aniversario_contacto`, `natal`, `ano_novo`) gerados pelo spawner cron e 2 tipos manuais (`aniversario_fecho`, `festividade`) criados individualmente por contacto. Os consultores querem poder criar **datas comemorativas personalizadas** (Páscoa, Ramadão, Hanucá, Carnaval, Dia da Mãe, etc.) que disparem para **múltiplos contactos** de uma só vez, com recorrência opcional.

A infraestrutura de runs, mutes, template cascade e spawner já existe — o objectivo é estendê-la sem duplicar lógica.

## Goals / Non-Goals

**Goals:**
- Permitir ao consultor criar eventos personalizados com nome livre, data/hora, e flag de recorrência (anual ou única vez).
- Selecção de contactos em lote (todos os do consultor, ou subconjunto via pesquisa/filtro).
- Auto-enrollment: novos leads atribuídos ao consultor entram automaticamente em todos os seus eventos activos.
- Associar templates de Email e/ou WhatsApp ao evento (existentes ou criados inline).
- Integrar com o spawner existente (`spawn-runs`) para gerar `contact_automation_runs`.
- UI em cards visuais — cada evento (fixo + personalizado) é um card; clicar abre detalhe com contactos, acções e histórico.
- Histórico de execuções com detalhes de instância de envio (conta de email / instância WhatsApp usada).

**Non-Goals:**
- Datas com recorrência diferente de anual (mensal, semanal, etc.) — fora de âmbito.
- Cálculo automático de datas móveis (ex: Páscoa varia cada ano) — o consultor define a data manualmente cada ano ou edita a recorrência.
- Alteração dos 3 eventos fixos existentes — continuam virtuais e imutáveis.
- Envio imediato/broadcast — os eventos personalizados passam sempre pelo spawner (agendamento).

## Decisions

### 1. Modelo de dados: tabela `custom_commemorative_events` + junction `custom_event_leads`

**Decisão:** Criar duas tabelas novas em vez de reutilizar `contact_automations`.

**Racional:** `contact_automations` é 1:1 com um contacto (`contact_id NOT NULL`) e tem `event_type` limitado a dois valores (`aniversario_fecho`, `festividade`). Os eventos personalizados são N:M (1 evento → N contactos) e têm nome livre. Uma tabela separada evita alterar constraints existentes e mantém queries simples.

**Alternativa descartada:** Adicionar colunas à `contact_automations` e permitir `contact_id = NULL` com junction — quebraria invariantes do spawner fase A que assume `contact_id` presente.

**Schema:**
```sql
-- Evento personalizado do consultor
CREATE TABLE custom_commemorative_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES dev_users(id),
  name TEXT NOT NULL,                       -- "Páscoa", "Ramadão", etc.
  description TEXT,
  event_date DATE NOT NULL,                 -- dia/mês de referência (ex: 2026-04-05)
  send_hour INT NOT NULL DEFAULT 9,         -- hora local (0-23)
  is_recurring BOOLEAN NOT NULL DEFAULT true, -- anual ou única vez
  channels TEXT[] NOT NULL DEFAULT '{email}', -- {'email','whatsapp'} 
  email_template_id UUID REFERENCES tpl_email_library(id),
  wpp_template_id UUID REFERENCES auto_wpp_templates(id),
  smtp_account_id UUID REFERENCES consultant_email_accounts(id),
  wpp_instance_id UUID,
  status TEXT NOT NULL DEFAULT 'active',    -- active | paused | archived
  last_triggered_year INT,                  -- para evitar duplicação no mesmo ano
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contactos associados ao evento
CREATE TABLE custom_event_leads (
  event_id UUID NOT NULL REFERENCES custom_commemorative_events(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, lead_id)
);
```

### 2. Integração com o spawner: nova fase C

**Decisão:** Adicionar uma **fase C** ao cron `spawn-runs` que itera `custom_commemorative_events` activos cujo `event_date` (mês/dia) está dentro da janela de spawn.

**Racional:** Reutiliza toda a lógica existente de criação de runs (`contact_automation_runs`), mutes, e template cascade. A fase C gera runs com `kind = 'custom_event'` e `custom_event_id` (coluna nova em `contact_automation_runs`).

**Alternativa descartada:** Cron separado — duplicaria lógica de gating, mutes e retry.

### 3. Recorrência: campo `is_recurring` + `last_triggered_year`

**Decisão:** Boolean simples (`is_recurring`). O spawner compara `event_date` (mês/dia) com a data actual. `last_triggered_year` evita duplicação. Eventos não-recorrentes ficam `status = 'archived'` após o primeiro disparo.

**Alternativa descartada:** Formato cron/RRULE — complexidade desnecessária para recorrência anual simples.

### 4. UI: cards de eventos + wizard de criação

**Decisão:** A tab "Automatismos" no hub CRM mostra **cards visuais** — um card por evento (fixos: Aniversário, Natal, Ano Novo + personalizados). Cada card mostra nome, data, nº de contactos, estado e canais. Clicar no card abre um **painel de detalhe** com:
- Lista de contactos que vão receber o evento (com opção de remover/adicionar)
- Acções: desactivar/pausar, editar template, ver execuções
- Histórico de runs com detalhes de envio (conta SMTP / instância WPP usada, extraídos de `contact_automation_runs.node_data_snapshot` ou joins a `consultant_email_accounts`)

**Wizard de criação** — botão "+ Nova Data" abre wizard com 3 passos:
1. **Dados do evento** — nome, data, hora, recorrência
2. **Selecção de contactos** — tabela com checkbox, pesquisa, filtro por estado/origem, "Seleccionar todos"
3. **Templates** — escolher template existente ou criar novo inline (Email e/ou WhatsApp)

**Racional:** Cards dão visão rápida de todos os automatismos do consultor. O wizard segue o padrão já usado para automatismos manuais. A selecção de contactos é um componente reutilizável (`<LeadMultiSelect>`).

### 5. Auto-enrollment de novos leads

**Decisão:** Quando um lead é criado ou `assigned_agent_id` é actualizado para um consultor, o sistema insere automaticamente o lead em todos os `custom_commemorative_events` activos desse consultor (INSERT INTO `custom_event_leads` ... ON CONFLICT DO NOTHING).

**Mecanismo:** Trigger PostgreSQL `AFTER INSERT OR UPDATE OF assigned_agent_id ON leads` que faz o insert em batch, **apenas para eventos com `status = 'active'` e (`is_recurring = true` OR `last_triggered_year IS NULL` ou `< ano_actual`)**. Eventos únicos já disparados (`status = 'archived'`) são excluídos. Alternativa (hook na API de leads) descartada porque não cobriria imports em batch ou actualizações directas ao DB.

**Racional:** O consultor pediu que "quando entra em leads todos entram lá" — mas apenas nos eventos que ainda vão disparar. Eventos únicos já passados não fazem sentido receber novos leads. O `ON CONFLICT DO NOTHING` torna a operação idempotente.

### 6. Templates: reutilização dos existentes

**Decisão:** Os eventos personalizados referenciam `tpl_email_library` e `auto_wpp_templates` com `scope = 'consultant'`. O wizard inclui botão "Criar novo template" que abre o dialog de criação inline (já existente).

## Risks / Trade-offs

- **[Datas móveis]** → O consultor tem de actualizar manualmente a data de eventos como Páscoa ou Ramadão cada ano. Mitigação: notificação na UI quando o evento se aproxima e a data não foi actualizada (melhoria futura).
- **[Volume de runs]** → Um evento com "todos os contactos" pode gerar centenas de runs de uma vez. Mitigação: o spawner já faz `pLimit` e o envio é assíncrono; adicionar aviso na UI quando > 50 contactos.
- **[Coluna nova em contact_automation_runs]** → Adicionar `custom_event_id` nullable para rastreio. Mitigação: coluna nullable, não quebra runs existentes.
