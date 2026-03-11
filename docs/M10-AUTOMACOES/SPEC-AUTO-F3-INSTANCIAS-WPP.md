# SPEC-AUTO-F3-INSTANCIAS-WPP — Fase 3: Gestão de Instâncias WhatsApp

**Data:** 2026-03-05
**Prioridade:** 🟠 Alta (bloqueia F4 — templates WhatsApp)
**Estimativa:** 1 sessão de Claude Code
**Pré-requisitos:** F1 concluída (tabela `auto_wpp_instances`)

---

## 📋 Objectivo

API separada para gestão de instâncias WhatsApp via Uazapi e interface para conectar, desconectar, monitorar estado e remover instâncias. Independente dos fluxos de automação.

---

## 📁 Ficheiros a Criar

| Ficheiro | Responsabilidade |
|----------|-----------------|
| `app/api/automacao/instancias/route.ts` | GET lista + POST acções |
| `app/(dashboard)/automacao/instancias/page.tsx` | Página de gestão |
| `components/automations/instance-card.tsx` | Card de instância |
| `components/automations/instance-connection-sheet.tsx` | Sheet conexão QR/pair code |
| `components/automations/create-instance-dialog.tsx` | Dialog criar instância |
| `hooks/use-whatsapp-instances.ts` | Hook CRUD completo |

---

## 🔌 API Route: `app/api/automacao/instancias/route.ts`

### Variáveis de ambiente necessárias

```env
UAZAPI_URL=https://seu-servidor.uazapi.com    # Sem barra final
UAZAPI_ADMIN_TOKEN=token-admin-uazapi
```

### GET — Listar instâncias

```typescript
// GET /api/automacao/instancias
// Retorna todas as instâncias com contagem de fluxos vinculados
// Response: { instances: [{ ...instância, flow_count: number }] }

// GET /api/automacao/instancias?id=UUID
// Retorna instância específica + fluxos + execuções recentes
// Response: { instance, flows: [], executions: [] }
```

**Lógica:**
1. Buscar `auto_wpp_instances` ordenado por `created_at DESC`
2. Para cada instância, contar fluxos vinculados via `auto_flows.wpp_instance_id`
3. Se `?id=UUID`, buscar também `auto_flows` e últimas 50 entradas de `auto_step_runs` relacionadas

### POST — Acções (switch por `action`)

| Acção | Body | Endpoint Uazapi | Descrição |
|-------|------|----------------|-----------|
| `sync` | — | `GET /instance/all` + `GET /instance/status` por token | Sincroniza TODAS as instâncias Uazapi com o banco. Marca como `not_found` as que desapareceram. |
| `create` | `{ name, user_id? }` | `POST /instance/init` | Cria instância na Uazapi + salva no banco |
| `connect` | `{ instance_id, phone? }` | `POST /instance/connect` | Se `phone`: gera pair code. Senão: gera QR code |
| `disconnect` | `{ instance_id }` | `POST /instance/disconnect` | Desconecta instância |
| `status` | `{ instance_id }` | `GET /instance/status` | Verifica e actualiza estado no banco |
| `assign_user` | `{ instance_id, user_id }` | — | Vincula/desvincula utilizador |
| `delete` | `{ instance_id }` | `DELETE /instance` | Remove da Uazapi e do banco |

### Detalhe da acção `sync` (a mais complexa)

```
1. GET /instance/all (header: admintoken) → lista de instâncias Uazapi
2. Para cada instância Uazapi:
   a. GET /instance/status (header: token) → estado, perfil, telefone
   b. Se existe no banco (por uzapi_token): UPDATE com dados frescos
   c. Se não existe: INSERT nova instância
3. Para cada instância no banco que NÃO está na lista Uazapi:
   → UPDATE connection_status = 'not_found'
4. Buscar flow_count para cada instância
5. Retornar lista actualizada
```

### Detalhe da acção `connect`

```typescript
// Resposta inclui QR code OU pair code conforme o modo
// O frontend mostra o QR code como imagem ou o pair code como texto

// Response quando phone NÃO é enviado (modo QR):
{
  instance_id: "uuid",
  mode: "qrcode",
  qrcode: "data:image/png;base64,...",  // base64 da imagem
  connected: false,
  logged_in: false
}

// Response quando phone É enviado (modo pair code):
{
  instance_id: "uuid",
  mode: "paircode",
  paircode: "ABCD-EFGH",  // código para inserir no WhatsApp
  connected: false,
  logged_in: false
}
```

### Helper interno: `fetchUazapiStatus(token: string)`

```typescript
async function fetchUazapiStatus(token: string) {
  const res = await fetch(`${UAZAPI_URL}/instance/status`, {
    method: "GET",
    headers: { token },
  })
  if (!res.ok) return null
  return await res.json()
  // Retorna: { instance: { status, profileName, profilePicUrl, isBusiness, qrcode, paircode }, status: { connected, loggedIn, jid: { user } } }
}
```

---

## 🖥️ Página: `app/(dashboard)/automacao/instancias/page.tsx`

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Instâncias WhatsApp                [Actualizar] [+ Nova]    │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Instâncias  │  │ Conectadas  │  │ Fluxos      │          │
│  │     3       │  │     2       │  │ Vinculados  │          │
│  │ 2 on · 1 off│  │    67%      │  │     5       │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐          │
│  │ 📱 WhatsApp Comercial│  │ 📱 WhatsApp Suporte  │          │
│  │ 🟢 Conectado         │  │ 🔴 Desconectado      │          │
│  │ +351 912 345 678     │  │                      │          │
│  │ Maria Santos         │  │ [Conectar]           │          │
│  │ 3 fluxos vinculados  │  │ 0 fluxos vinculados  │          │
│  │                      │  │                      │          │
│  │ [Detalhes] [···]     │  │ [Detalhes] [···]     │          │
│  └──────────────────────┘  └──────────────────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Componentes

**`instance-card.tsx`** — Card individual com:
- Avatar/foto do perfil (ou ícone default)
- Nome da instância + nome do perfil WhatsApp
- Badge de estado: 🟢 Conectado, 🔴 Desconectado, 🟡 A conectar, ⚪ Não encontrado
- Número de telefone
- Contagem de fluxos vinculados
- Menu dropdown (···): Desconectar, Atribuir utilizador, Remover
- Botão principal: "Conectar" (se desconectado) ou "Detalhes" (se conectado)

**`instance-connection-sheet.tsx`** — Sheet lateral com:
- Dois modos: QR Code (imagem) ou Pair Code (texto grande)
- Input opcional de número de telefone (para pair code)
- Polling automático de status a cada 5 segundos até conectar
- Botão "Verificar Estado" manual
- Feedback visual quando conecta com sucesso (ícone verde + toast)

**`create-instance-dialog.tsx`** — Dialog simples com:
- Input: Nome da instância
- Select: Utilizador responsável (opcional, lista de `users`)
- Botão: "Criar Instância"

### Estado: `hooks/use-whatsapp-instances.ts`

```typescript
export function useWhatsAppInstances() {
  return {
    instances: WhatsAppInstance[],
    loading: boolean,
    syncInstances: () => Promise<void>,        // action: sync
    createInstance: (params) => Promise<void>,  // action: create
    connectInstance: (id, phone?) => Promise<ConnectResult>,  // action: connect
    disconnectInstance: (id) => Promise<void>,  // action: disconnect
    checkStatus: (id) => Promise<StatusResult>, // action: status
    assignUser: (id, userId) => Promise<void>,  // action: assign_user
    deleteInstance: (id) => Promise<void>,       // action: delete
    fetchInstanceDetails: (id) => Promise<InstanceDetails>,
  }
}
```

---

## ✅ Critérios de Aceitação

- [ ] `POST action=sync` sincroniza instâncias Uazapi e marca `not_found` correctamente
- [ ] `POST action=create` cria instância na Uazapi e salva no banco
- [ ] `POST action=connect` retorna QR code (sem phone) ou pair code (com phone)
- [ ] `POST action=status` actualiza `connection_status`, `profile_name`, `phone` no banco
- [ ] `POST action=disconnect` desconecta e actualiza estado
- [ ] `POST action=delete` remove da Uazapi e do banco
- [ ] UI mostra cards com badge de estado correcto
- [ ] Sheet de conexão mostra QR code como imagem
- [ ] Polling de status funciona até conexão bem-sucedida
- [ ] `flow_count` aparece correctamente em cada card

## 📝 Notas para o Claude Code

1. **Padrão a seguir:** `app/api/automacao/instancias/route.ts` do LeveMãe (enviado nos documentos) — mesma estrutura com switch por action
2. **Uazapi auth:** Acções admin usam header `admintoken`, acções por instância usam header `token`
3. **Normalizar URL:** Remover barra final: `UAZAPI_URL.replace(/\/$/, "")`
4. **Não bloquear se Uazapi falhar:** Se `/instance/status` falhar para uma instância, logar e continuar
5. **Usar `createAdminSupabaseClient()`** para todas as operações (bypass RLS)
