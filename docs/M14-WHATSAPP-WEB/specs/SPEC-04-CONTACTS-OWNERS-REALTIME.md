# SPEC-04: Contacts, Owners Integration & Realtime

> WhatsApp Web — Vinculação de contactos ao ERP, Realtime, e página de gestão
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## Ficheiros a Criar

### 1. `src/app/api/whatsapp/contacts/[contactId]/erp-data/route.ts`

**Criar ficheiro.** GET para dados ERP do contacto vinculado.

**GET(request, { params }):**
- Extrair `contactId`, buscar contacto em `wpp_contacts` para obter `owner_id` e `lead_id`
- Se `owner_id`:
  - Query `owners` por id: select `id, name, email, phone, nif, person_type`
  - Query `property_owners` join `dev_properties` para obter imóveis do owner:
    ```
    property_owners → select ownership_percentage, is_main_contact, property:dev_properties(id, title, slug, status, listing_price, property_type, city) WHERE owner_id = X
    ```
  - Query `proc_instances` para processos dos imóveis do owner:
    ```
    select id, external_ref, current_status, percent_complete, property_id WHERE property_id IN (propertyIds)
    ```
  - Montar `ownerData = { ...owner, properties: [...], processes: [...] }`
- Se `lead_id`:
  - Query `leads` por id: select `id, name, email, phone_primary, status, score, source, lead_type, priority`
  - Query `negocios` por `lead_id`: select `id, tipo, estado, tipo_imovel, localizacao, orcamento_max`
  - Montar `leadData = { ...lead, negocios: [...] }`
- Retornar `{ owner: ownerData, lead: leadData }`

---

### 2. `src/app/api/whatsapp/contacts/auto-match/route.ts`

**Criar ficheiro.** POST para auto-vincular contactos por telefone.

**POST(request):**
- Extrair `{ instance_id }` do body
- Query `wpp_contacts` sem vinculação: `instance_id = X AND owner_id IS NULL AND lead_id IS NULL AND phone IS NOT NULL`
- Para cada contacto:
  - Normalizar telefone: remover não-dígitos, gerar variantes (`phone`, `+phone`, com/sem `351`)
  - Tentar match com `owners.phone` usando `.or(phoneVariants.map(...))`
  - Se match → update `wpp_contacts.owner_id`
  - Senão, tentar match com `leads.phone_primary` ou `leads.phone_secondary`
  - Se match → update `wpp_contacts.lead_id`
- Retornar `{ matched, total }`

**Lógica de normalização de telefone:**
```typescript
const normalizedPhone = phone.replace(/\D/g, "")
const phoneVariants = [
  phone,
  normalizedPhone,
  `+${normalizedPhone}`,
  normalizedPhone.startsWith("351") ? normalizedPhone.slice(3) : `351${normalizedPhone}`,
]
```

---

### 3. `src/components/whatsapp/erp-link-tags.tsx`

**Criar ficheiro.** `'use client'` — Tags de vinculação ERP.

**Props:** `contactId: string`

**O que fazer:**
- `useEffect` → fetch GET `/api/whatsapp/contacts/${contactId}/erp-data`
- State: `owner` (OwnerData | null), `lead` (LeadData | null), `isLoading`
- Se loading: skeleton `animate-pulse`
- Se nenhum dado: retornar null

**Se owner:**
- Ícone `<User>` azul + label "Proprietário"
- Badge com link para `/dashboard/proprietarios/${owner.id}`: `owner.name (owner.nif)`
- Imóveis: para cada → `<Badge variant="secondary">` com `<Building2>` + título truncado, link para `/dashboard/imoveis/${id}`
- Processos: para cada → `<Badge variant="secondary">` com `<FileCheck>` + `external_ref (percent_complete%)`, link para `/dashboard/processos/${id}`

**Se lead:**
- Ícone `<UserPlus>` amber + label "Lead"
- Badge com link para `/dashboard/leads/${lead.id}`: `lead.name — lead.status (Score: lead.score)`
- Negócios: para cada → `<Badge variant="secondary">` com `<ShoppingCart>` + `tipo — tipo_imovel`, link para `/dashboard/leads/${lead.id}/negocios/${id}`

**Código completo:** Ver PRD-04 secção 1.4.

---

### 4. `src/components/whatsapp/contact-link-dialog.tsx`

**Criar ficheiro.** `'use client'` — Dialog para vincular contacto a owner/lead.

**Props:** `contactId: string, instanceId: string, currentOwnerId?: string, currentLeadId?: string, onLinked: () => void, open: boolean, onOpenChange: (open) => void`

**O que fazer:**
- `<Dialog>` shadcn com `<Tabs>`: "Proprietário" | "Lead"
- Tab Proprietário:
  - Input de pesquisa com debounce 300ms
  - Query `owners` por `name.ilike OR nif.ilike OR phone.ilike`
  - Lista de resultados com radio para selecção (nome, NIF, telefone)
  - Botão "Vincular" → PUT `/api/whatsapp/instances/${instanceId}/contacts/${contactId}` com `{ owner_id }`
  - Botão "Desvincular" se já tem `currentOwnerId` → PUT com `{ owner_id: null }`
- Tab Lead:
  - Input de pesquisa
  - Query `leads` por `name.ilike OR email.ilike OR phone_primary.ilike`
  - Lista de resultados
  - Botão "Vincular" → PUT com `{ lead_id }`
  - Botão "Desvincular" se já tem `currentLeadId` → PUT com `{ lead_id: null }`
- Toast de sucesso após vincular/desvincular
- Chamar `onLinked()` após operação para refetch no parent

---

### 5. `src/components/whatsapp/contact-card.tsx`

**Criar ficheiro.** Card de contacto para a página de gestão.

**Props:** `contact: WppContact, onLink: () => void, onViewChat: () => void`

**O que fazer:**
- Avatar + Nome + Telefone
- Badge de vinculação: "Proprietário: X", "Lead: Y", ou "Sem vinculação"
- Botões: Vincular (abre dialog), Ver chat (navega para `/dashboard/whatsapp?chat=X`)
- Se `is_business`: badge "Empresa"

---

### 6. `src/app/dashboard/whatsapp/contactos/page.tsx`

**Criar ficheiro.** Server Component — Página de gestão de contactos.

**O que fazer:**
- Buscar instâncias (mesmo query de `whatsapp/page.tsx`)
- Renderizar `<ContactsPage instances={instances} />`

**Componente client `<ContactsPage>`:**
- Topo: `<InstanceSelector>` + botões "Sincronizar contactos" + "Auto-vincular"
- Filtros: Todos | Com vinculação | Sem vinculação (tabs ou select)
- Pesquisa por nome/telefone com debounce
- Usar hook `useWhatsAppContacts(instanceId)`
- Tabela com colunas:
  - Avatar + Nome + Telefone
  - Vinculação (Owner/Lead/Nenhuma) — com badges clicáveis
  - Acções: Vincular, Ver chat
- Paginação (offset-based)
- Botão "Sincronizar" → `syncContacts()` do hook
- Botão "Auto-vincular" → POST `/api/whatsapp/contacts/auto-match` com `{ instance_id }` → toast com resultado (`"X de Y contactos vinculados"`)
- Reutilizar `<DataTable>` pattern do codebase

---

## Ficheiros a Modificar

### 7. `src/components/whatsapp/chat-info-panel.tsx` (criado na SPEC-03)

**Modificar:** Adicionar secção de vinculação ERP.

**Onde:** Após avatar/nome/telefone, antes de "Media".

**O que adicionar:**
- Secção "Vinculação ERP" com `<Separator>` acima
- Se o chat tem `contact_id` e o contacto tem `owner_id` ou `lead_id`:
  - Renderizar `<ErpLinkTags contactId={contact.id} />`
- Botão "Vincular a Owner/Lead" → abre `<ContactLinkDialog>`
- Se não tem contacto vinculado: mostrar "Contacto sem vinculação ERP" com botão para vincular

---

### 8. `src/components/whatsapp/message-bubble.tsx` (criado na SPEC-03)

**Modificar:** Tratamento especial de soft delete para admins.

**Onde:** No bloco `if (isDeleted)`.

**O que adicionar:**
- Verificar se o utilizador tem role `Broker/CEO` (admin)
- Se admin e `is_deleted`:
  - Mostrar conteúdo original com `opacity-50`
  - Badge `<Badge variant="destructive" className="text-[10px] mb-1">Apagada</Badge>` acima do conteúdo
- Se não admin e `is_deleted`:
  - Manter comportamento actual: `"🚫 Esta mensagem foi apagada"`

---

## Configuração Supabase Realtime

### 9. Habilitar Realtime (já na SPEC-01, repetido para referência)

**Executar via Supabase MCP `execute_sql`:**

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_contacts;
```

### 10. Arquitectura de Channels

**Channels Postgres Changes (persistidos no DB):**

| Channel | Tabela | Eventos | Filtro | Usado em |
|---|---|---|---|---|
| `wpp-chats-{instanceId}` | `wpp_chats` | `*` | `instance_id=eq.{instanceId}` | `useWhatsAppChats` |
| `wpp-messages-{chatId}` | `wpp_messages` | `INSERT`, `UPDATE` | `chat_id=eq.{chatId}` | `useWhatsAppMessages` |

**Channels Broadcast (efémeros, não persistidos):**

| Channel | Evento | Payload | Usado em |
|---|---|---|---|
| `wpp-presence-{instanceId}` | `presence` | `{ chatId, type, participant }` | `useWhatsAppPresence` |

**Padrão de subscripção (já implementado nos hooks da SPEC-02):**
- `useRef` para guardar referência do channel
- Cleanup com `supabase.removeChannel(channel)` no return do useEffect
- Deduplicação de mensagens por `id` no INSERT handler
- Merge directo no UPDATE handler (status, reactions, is_deleted)

---

## Cascade Delete — Verificação

### 11. Fluxo de delete de instância

Quando `DELETE auto_wpp_instances WHERE id = X`, o PostgreSQL CASCADE garante:

```
auto_wpp_instances (DELETE)
  ├── CASCADE → wpp_contacts (todos)
  ├── CASCADE → wpp_chats (todos)
  │     └── CASCADE → wpp_messages (todas)
  │           └── CASCADE → wpp_message_media (todos)
  ├── CASCADE → wpp_labels (todas)
  │     └── CASCADE → wpp_chat_labels (todas)
  └── CASCADE → _debug_wpp_payloads (via instance_id, se FK existir)
```

**Limpeza R2:** Tratada via trigger `cleanup_instance_media()` (SPEC-01 #8) ou directamente na API route de delete.

**Alternativa directa no delete handler de `app/api/automacao/instancias/route.ts`:**
- Antes de delete: listar `wpp_message_media.r2_key` onde `instance_id = X`
- Apagar ficheiros do R2 via `DeleteObjectCommand`
- Também apagar pasta `wpp-media/{instance_id}/outgoing/` via `ListObjectsCommand` + `DeleteObjectsCommand`
- Depois: delete instância (cascade cuida do DB)

---

## Soft Delete de Mensagens

### 12. Fluxo completo

**Quando o remetente apaga via WhatsApp (webhook):**
1. UAZAPI envia webhook `messages_update` com ProtocolMessage type=0
2. Edge function `whatsapp-webhook-receiver` → `handleNewMessage` detecta `messageType === "protocol"`
3. UPDATE `wpp_messages` SET `is_deleted=true, deleted_at=now(), deleted_by='sender'`
4. Supabase Realtime propaga UPDATE → frontend actualiza via `useWhatsAppMessages`

**Quando o utilizador do ERP apaga:**
1. Frontend: click "Apagar" no `<MessageContextMenu>`
2. Hook `deleteMessage(messageId, forEveryone)`:
   - Optimistic: set `is_deleted = true` no state local
   - DELETE `/api/whatsapp/messages/${messageId}` com `{ for_everyone }`
3. API route → edge function `whatsapp-messaging` → UAZAPI `/message/delete` + soft delete no DB
4. Realtime propaga para outros clientes

**Renderização:**
- Utilizadores normais: `"🚫 Esta mensagem foi apagada"`
- Admins (Broker/CEO): conteúdo original com `opacity-50` + badge "Apagada"

---

## Ordem de Implementação

1. API route `erp-data` (#1)
2. API route `auto-match` (#2)
3. Componente `erp-link-tags` (#3)
4. Componente `contact-link-dialog` (#4)
5. Componente `contact-card` (#5)
6. Página de contactos (#6)
7. Integrar `erp-link-tags` no `chat-info-panel` (#7)
8. Soft delete para admins no `message-bubble` (#8)
9. Verificar cascade delete (#11)
10. **Testar:** vincular contacto a owner → ver tags → abrir chat → ver info panel com imóveis/processos
