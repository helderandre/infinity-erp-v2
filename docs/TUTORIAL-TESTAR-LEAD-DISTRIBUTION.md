# Tutorial: Testar o Sistema de Distribuição de Leads

Este tutorial guia-o por todos os componentes do sistema, passo a passo.

---

## Pré-requisitos

1. Servidor de desenvolvimento a correr: `npm run dev`
2. Migração `20260328_crm_lead_distribution.sql` aplicada no Supabase
3. Utilizador autenticado com permissão `pipeline` (role Broker/CEO ou Gestora)
4. Pelo menos 2 consultores activos em `dev_users`

---

## Parte 1: Configurar Campanhas

### 1.1 Criar uma campanha

1. Navegar para **CRM → Campanhas** no sidebar
2. Clicar **"Nova Campanha"**
3. Preencher:
   - Nome: `Teste Meta — Apartamentos Lisboa`
   - Plataforma: `Meta Ads`
   - Estado: `Activa`
   - Sector: `Imobiliário — Compra`
   - ID Campanha: (deixar vazio para teste, ou colocar um ID real do Meta)
   - Orçamento: `500`
   - Data início: hoje
4. Clicar **"Criar"**
5. **Verificar:** a campanha aparece na grelha com badges de plataforma e sector

### 1.2 Criar uma segunda campanha

Repetir com:
- Nome: `Google — Moradias Cascais`
- Plataforma: `Google Ads`
- Sector: `Imobiliário — Compra`

---

## Parte 2: Configurar Regras de Atribuição

### 2.1 Criar regra para Meta → consultor específico

1. Navegar para **CRM → Regras de Atribuição**
2. Ler a secção "Como funciona" (3 passos)
3. Clicar **"Nova Regra"**
4. Preencher:
   - Nome: `Meta Ads → Consultor A`
   - Prioridade: `100` (alta)
   - Origens: seleccionar **Meta Ads** (botão fica azul)
   - Consultor: seleccionar um consultor
   - Limite de carga: `10`
   - Se exceder: `Devolver ao pool (gestora)`
5. Clicar **"Criar"**
6. **Verificar:** a regra aparece com badge "Meta Ads" e o nome do consultor

### 2.2 Criar regra catch-all

1. Criar outra regra:
   - Nome: `Default — Pool Gestora`
   - Prioridade: `0` (baixa)
   - Não seleccionar nenhuma origem (catch-all)
   - Não seleccionar consultor
2. **Verificar:** esta regra aparece por baixo (prioridade menor)

### 2.3 Testar toggle activo/inactivo

1. Clicar no switch de uma regra
2. **Verificar:** a regra fica semi-transparente (inactiva)
3. Voltar a activar

---

## Parte 3: Configurar SLA

### 3.1 Verificar configs existentes

1. Navegar para **CRM → Config. SLA**
2. **Verificar:** 6 configurações pré-definidas (Meta Urgente, Meta Normal, Google, Website, Parceiro, Default)
3. Verificar que cada uma mostra o prazo (30min, 2h, 4h, 8h, 24h) e os thresholds (50%/100%/150%)

### 3.2 Editar um SLA

1. Clicar nos 3 pontos da config "Meta Ads — Normal" → **Editar**
2. Alterar prazo de 120 para 60 minutos
3. Guardar
4. **Verificar:** badge actualizado para "1h"

---

## Parte 4: Testar Ingestão Manual de Leads

### 4.1 Simular via API (terminal)

Abrir o terminal e executar:

```bash
# Substituir <URL> pelo URL do app (ex: http://localhost:3000)
# Substituir <CAMPAIGN_ID> pelo ID da campanha criada em 1.1

curl -X POST <URL>/api/webhooks/meta/leads \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "changes": [{
        "field": "leadgen",
        "value": {
          "leadgen_id": "test_lead_001",
          "form_id": "form_123"
        }
      }]
    }]
  }'
```

**Nota:** Isto vai falhar porque não temos o `META_ACCESS_TOKEN` para buscar os dados reais. Para teste, use a API CRM directamente:

```bash
# 1. Criar contacto
curl -X POST http://localhost:3000/api/crm/contacts \
  -H "Content-Type: application/json" \
  -H "Cookie: <sua-session-cookie>" \
  -d '{
    "nome": "João Teste",
    "email": "joao@teste.pt",
    "telemovel": "+351912345678"
  }'

# 2. Criar entrada (lead entry)
curl -X POST http://localhost:3000/api/crm/contacts/<CONTACT_ID>/entries \
  -H "Content-Type: application/json" \
  -H "Cookie: <sua-session-cookie>" \
  -d '{
    "contact_id": "<CONTACT_ID>",
    "source": "meta_ads",
    "campaign_id": "<CAMPAIGN_ID>"
  }'
```

### 4.2 Verificar nos Contactos

1. Navegar para **CRM → Contactos**
2. **Verificar:** "João Teste" aparece na lista
3. Abrir o detalhe → tab **Entradas**
4. **Verificar:** entrada com fonte "Meta Ads" e campanha associada

---

## Parte 5: Testar o Painel da Gestora

### 5.1 Ver overview

1. Navegar para **CRM → Gestora de Leads**
2. **Verificar:** 4 KPIs no topo (em atraso, sem atribuição, novas hoje, consultores)
3. **Verificar:** tabela "Carga por Consultor" mostra consultores com contagem de leads

### 5.2 Testar tabs

1. Clicar tab **"Em Atraso"** — mostra leads que ultrapassaram o SLA
2. Clicar tab **"Pool"** — mostra leads sem consultor atribuído
3. **Nota:** se acabou de criar a entrada, pode demorar até 5 min para o SLA check correr

### 5.3 Forçar check de SLA (manual)

```bash
curl http://localhost:3000/api/cron/check-sla
```

Verificar na gestora se o status SLA mudou.

### 5.4 Testar reatribuição em massa

1. No tab "Pool" ou "Em Atraso", marcar checkboxes de 1-2 leads
2. Na barra inferior que aparece:
   - Seleccionar consultor destino
   - Clicar **"Reatribuir"**
3. **Verificar:** toast de sucesso, leads desaparecem da lista e aparecem no consultor

### 5.5 Testar "Devolver" leads

1. Na tabela de consultores, encontrar um com leads em atraso
2. Clicar **"Devolver X"**
3. **Verificar:** leads voltam ao Pool

---

## Parte 6: Testar Contacto e Call Outcome

### 6.1 Clicar para contactar

1. Abrir o detalhe de um contacto, ou ver na lista da Gestora
2. Clicar no botão **telefone** (verde)
3. **Verificar:** modal "Resultado do contacto?" aparece

### 6.2 Registar resultado

1. Seleccionar **"Atendeu"**
2. Escrever nota: "Interessado em T2 no centro"
3. Clicar **"Registar"**
4. **Verificar:**
   - Toast de sucesso
   - Na timeline do contacto: actividade "Chamada atendida"
   - O status SLA muda para "completed" (verificar na gestora — a lead sai do "Em Atraso")
   - Se era a primeira vez, o lifecycle stage muda para "Contactado"

### 6.3 Registar sem resposta

1. Repetir com outro contacto
2. Seleccionar **"Sem resposta"**
3. **Verificar:** actividade registada mas SLA continua activo

---

## Parte 7: Testar Notificações

### 7.1 Verificar bell

1. Olhar para o sino de notificações (canto superior direito)
2. **Verificar:** badge vermelho com contagem de não lidas
3. Clicar → popover mostra notificações mistas (processos + CRM)

### 7.2 Tipos de notificação esperados

- **"Nova lead recebida"** — quando uma lead é atribuída
- **"Lead reatribuída"** — quando a gestora reatribui
- **"SLA a 50%"** — aviso (após o cron correr)
- **"SLA ultrapassado"** — breach

### 7.3 Marcar como lido

1. Clicar numa notificação → navega para o contacto
2. Ou clicar **"Marcar tudo como lido"**
3. **Verificar:** badge actualiza

---

## Parte 8: Testar Analytics de Consultores

### 8.1 Ver métricas

1. Navegar para **CRM → Analytics**
2. **Verificar:** 8 KPI cards no topo
3. **Verificar:** funil de conversão visual (leads → contactadas → qualificadas → convertidas → ganhas)

### 8.2 Filtrar por período

1. Alterar de "30 dias" para "7 dias"
2. **Verificar:** valores actualizam

### 8.3 Filtrar por consultor

1. Clicar no nome de um consultor nos pills
2. **Verificar:** aparecem 2 cards adicionais:
   - "Leads por Origem" (breakdown com barras)
   - "Actividades" (breakdown por tipo)

### 8.4 Tabela comparativa

1. Voltar a "Todos"
2. **Verificar:** tabela com ranking de consultores por receita
3. Colunas: leads, taxa de contacto, tempo resposta, SLA, negócios, win rate, receita
4. Indicadores coloridos (verde = bom, amarelo = médio, vermelho = mau)

---

## Parte 9: Testar Analytics de Campanhas

### 9.1 Sync manual de métricas

```bash
# Executar sync (busca Meta API + calcula ERP metrics)
curl http://localhost:3000/api/cron/sync-campaign-metrics
```

**Nota:** sem META_ACCESS_TOKEN configurado, só as métricas ERP serão preenchidas. As métricas Meta ficam a null.

### 9.2 Ver dashboard

1. Navegar para **CRM → Analytics** e depois clicar numa campanha
   — **ou** ir directamente a `/dashboard/crm/analytics/campanhas`
2. **Verificar:** 5 KPI globais (investimento, leads, CPQ, CPA, ROAS)
3. **Verificar:** funil global de campanhas
4. **Verificar:** tabela com todas as campanhas e métricas

### 9.3 Filtrar

1. Filtrar por plataforma (Meta vs Google)
2. Alterar período
3. **Verificar:** dados actualizam

---

## Parte 10: Testar Fluxo Completo (End-to-End)

### Cenário: Lead Meta → Consultor → Contacto → Negócio

1. **Campanha:** Já existe (criada no passo 1.1)
2. **Regra:** Já existe (Meta Ads → Consultor A, criada no passo 2.1)
3. **SLA:** Meta Normal = 2h

4. **Criar contacto + entrada:**
   - Via API ou manualmente na UI
   - Fonte: meta_ads, com campaign_id

5. **Verificar automação:**
   - Contacto criado (ou reutilizado se já existia → is_reactivation = true)
   - Entrada criada com assigned_agent_id = Consultor A
   - SLA deadline definido (2h a partir de agora)
   - Notificação in-app para Consultor A
   - (Se email configurado) Email enviado

6. **Como Consultor A:**
   - Ver notificação no bell
   - Abrir contacto
   - Clicar telefone → modal → "Atendeu"
   - **Verificar:** SLA completo, lifecycle → Contactado

7. **Criar negócio:**
   - Na página do contacto, criar negócio
   - Tipo: Comprador, Stage: Lead Recebida
   - **Verificar:** negócio aparece no pipeline kanban

8. **Mover no pipeline:**
   - Arrastar negócio para "Contacto Inicial", depois "Qualificação"
   - **Verificar:** stage history registada

9. **Analytics:**
   - Ir a Analytics de Consultores → Consultor A
   - **Verificar:** 1 lead, 1 contactada, tempo resposta, 1 negócio activo
   - Ir a Analytics de Campanhas
   - **Verificar:** campanha Meta mostra 1 entrada ERP, 1 contactada

---

## Parte 11: Testar Portal de Parceiros

### 11.1 Criar parceiro no CRM

1. Navegar para **CRM → Parceiros** (ou via API)
2. Criar parceiro: nome, email (obrigatório para magic link), tipo (advogado/banco/etc.)
3. **Verificar:** parceiro criado com magic_link_token gerado

### 11.2 Enviar magic link

```bash
curl -X POST http://localhost:3000/api/crm/partners/<PARTNER_ID>/send-link \
  -H "Cookie: <sua-session-cookie>"
```

**Verificar:** email enviado com link `/parceiro?token=...`

### 11.3 Aceder ao portal

1. Abrir `/parceiro?token=<TOKEN>` no browser (ou copiar do email)
2. **Verificar:** página carrega, mostra nome do parceiro no header
3. **Verificar:** dashboard mostra 4 cards (total, pendentes, convertidos, taxa conversão)
4. **Verificar:** lista de referências (vazia se novo parceiro)

### 11.4 Submeter lead

1. Clicar **"Submeter Nova Lead"**
2. Preencher: nome, email ou telefone, notas
3. Clicar **"Submeter Lead"**
4. **Verificar:** toast sucesso, redirect para dashboard
5. **Verificar no ERP:** novo contacto + entrada com source "partner"

### 11.5 Pedir reatribuição

1. Na lista de referências, encontrar uma que não seja terminal
2. Clicar **"Pedir reatribuição"**
3. Escrever motivo, submeter
4. **Verificar no ERP:** gestora recebe notificação

### 11.6 Verificar privacidade

- Nomes devem estar mascarados (ex: "João S." em vez de "João Silva")
- Sem email ou telefone visível

---

## Parte 12: Testar Web Push

### 12.1 Gerar VAPID keys

```bash
npx web-push generate-vapid-keys
```

Copiar as keys para `.env.local`:
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPx...
VAPID_PRIVATE_KEY=dGh...
```

### 12.2 Activar notificações

1. Abrir o ERP no browser
2. **Verificar:** banner "Active notificações" aparece no topo (se `PushBanner` integrado no layout)
3. Clicar **"Activar"**
4. Browser pede permissão → aceitar
5. **Verificar:** subscription guardada em `push_subscriptions` (verificar no Supabase)

### 12.3 Receber push

1. Forçar um SLA check:
   ```bash
   curl http://localhost:3000/api/cron/check-sla
   ```
2. Se existe uma lead com SLA a expirar, **verificar:** notificação push nativa aparece
3. Clicar na notificação → abre a página do contacto

### 12.4 Desactivar

1. Usar o hook `usePushSubscription().unsubscribe()` ou limpar no browser
2. **Verificar:** subscription removida da tabela

**Nota:** Push não funciona em localhost sem HTTPS. Para testar, use ngrok ou deploy.

---

## Parte 13: Testar Multi-Sector

### 13.1 Filtrar por sector na Gestora

1. Ir a **CRM → Gestora de Leads**
2. No dropdown "Sector" ao lado dos tabs, seleccionar "Recrutamento"
3. **Verificar:** lista filtra para mostrar apenas leads com sector recruitment
4. Mudar para "Crédito" → filtro actualiza
5. Voltar a "Todos os sectores"

### 13.2 Sector no Analytics

1. Ir a **CRM → Analytics**
2. (Se a API suporta sector param, pode testar via URL directamente)
3. **Verificar:** métricas computadas apenas para o sector seleccionado

### 13.3 Criar campanha com sector

1. Ir a **CRM → Campanhas** → Nova
2. Seleccionar sector "Recrutamento"
3. Criar regra de atribuição com `sector_match: ['recruitment']` → recrutador
4. Submeter lead (via parceiro ou manualmente) com essa campanha
5. **Verificar:** lead herda sector da campanha, é roteada para o recrutador

---

## Checklist Final

| Componente | Testar | ✓ |
|------------|--------|---|
| Campanhas | Criar, editar, eliminar, filtrar | |
| Regras de Atribuição | Criar, editar, toggle on/off, prioridade | |
| Config SLA | Ver defaults, editar prazo, criar novo | |
| Gestora | KPIs, carga consultores, tabs overdue/pool | |
| Gestora | Reatribuição em massa, devolver overdue | |
| Gestora | Filtro por sector | |
| Contacto | Botões tel/whatsapp/email, modal outcome | |
| Contacto | Call outcome → SLA completo, stage upgrade | |
| Notificações in-app | Bell mostra CRM + processos, mark as read | |
| Web Push | Banner, subscribe, receber push, desactivar | |
| Analytics Consultores | KPIs, funil, tabela comparativa, filtros | |
| Analytics Campanhas | KPIs globais, funil, tabela, ROAS | |
| Portal Parceiros | Login magic link, dashboard, lista referências | |
| Portal Parceiros | Submeter lead, pedir reatribuição | |
| Portal Parceiros | Privacidade (nomes mascarados) | |
| Cron SLA | Execução manual, status updates | |
| Cron Metrics | Execução manual, métricas ERP | |

---

## Variáveis de Ambiente Necessárias

```env
# Já existentes
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Para Meta Ads (webhook + sync)
META_ACCESS_TOKEN=...          # Page Access Token (long-lived)
META_VERIFY_TOKEN=...          # Token de verificação do webhook
META_AD_ACCOUNT_ID=...         # ID da conta de anúncios (act_xxx)
META_APP_SECRET=...            # Para validação de data-deletion

# Para crons
CRON_SECRET=...                # Authorization header para crons

# Para Web Push
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@infinitygroup.pt

# Para emails (já existente via Edge Function)
# O sistema usa a Edge Function send-email que já está configurada
```

---

## Crons (Coolify / Servidor)

Os cron jobs são API routes normais que precisam de ser chamados periodicamente. Em produção, configurar no Coolify (Settings → Scheduled Tasks) ou via crontab do servidor:

```bash
# Meta leads sync (cada 5 min)
*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/sync-meta-leads

# SLA check (cada 5 min)
*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/check-sla

# Campaign metrics (diário às 06:00)
0 6 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<APP_URL>/api/cron/sync-campaign-metrics
```

**Para testar localmente**, basta chamar os endpoints directamente:
```bash
curl http://localhost:3000/api/cron/check-sla
curl http://localhost:3000/api/cron/sync-campaign-metrics
```

(Sem `CRON_SECRET` definido no `.env.local`, os endpoints aceitam qualquer request.)
