# PRD-04: Contacts, Owners Integration & Realtime

> WhatsApp Web — Vinculação de contactos, Supabase Realtime, e integrações ERP
> Projecto: ERP Infinity v2 | Data: 2026-03-18

---

## 1. Vinculação Contacto ↔ Owner / Lead

### 1.1 Modelo de Dados

```
wpp_contacts
  ├── owner_id FK → owners(id) ON DELETE SET NULL
  └── lead_id FK → leads(id) ON DELETE SET NULL

Quando um contacto é vinculado a um owner:
  → Mostrar tags com imóveis (property_owners → dev_properties)
  → Mostrar tags com processos (proc_instances via property_owners)
  → Mostrar dados do owner (nome, NIF, email, telefone)

Quando um contacto é vinculado a um lead:
  → Mostrar tags com negócios (negocios)
  → Mostrar status e score do lead
  → Mostrar dados do lead (nome, email, telefone, origem)
```

### 1.2 Auto-Match por Telefone

```typescript
// Edge function ou API route: auto_match
// Lógica: para cada contacto sem vinculação,
// procurar owner/lead com o mesmo telefone

async function autoMatchContacts(instanceId: string) {
  const supabase = createAdminClient()

  // Buscar contactos sem vinculação
  const { data: contacts } = await supabase
    .from("wpp_contacts")
    .select("id, phone")
    .eq("instance_id", instanceId)
    .is("owner_id", null)
    .is("lead_id", null)
    .not("phone", "is", null)

  if (!contacts?.length) return { matched: 0 }

  let matched = 0

  for (const contact of contacts) {
    const phone = contact.phone

    // Tentar match com owner (por phone ou email)
    // Normalizar: remover +, espaços, traços
    const normalizedPhone = phone.replace(/\D/g, "")
    const phoneVariants = [
      phone,
      normalizedPhone,
      `+${normalizedPhone}`,
      normalizedPhone.startsWith("351") ? normalizedPhone.slice(3) : `351${normalizedPhone}`,
    ]

    // Match owner
    const { data: owner } = await supabase
      .from("owners")
      .select("id")
      .or(phoneVariants.map(p => `phone.eq.${p}`).join(","))
      .limit(1)
      .maybeSingle()

    if (owner) {
      await supabase
        .from("wpp_contacts")
        .update({ owner_id: owner.id, updated_at: new Date().toISOString() })
        .eq("id", contact.id)
      matched++
      continue
    }

    // Match lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .or(phoneVariants.map(p => `phone_primary.eq.${p},phone_secondary.eq.${p}`).join(","))
      .limit(1)
      .maybeSingle()

    if (lead) {
      await supabase
        .from("wpp_contacts")
        .update({ lead_id: lead.id, updated_at: new Date().toISOString() })
        .eq("id", contact.id)
      matched++
    }
  }

  return { matched, total: contacts.length }
}
```

### 1.3 API Route para Tags do Contacto

```typescript
// GET /api/whatsapp/contacts/[contactId]/erp-data
// Retorna dados completos do owner/lead vinculado + imóveis + processos + negócios

import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  const { contactId } = await params
  const supabase = createAdminClient()

  const { data: contact } = await supabase
    .from("wpp_contacts")
    .select("id, owner_id, lead_id")
    .eq("id", contactId)
    .single()

  if (!contact) return NextResponse.json({ error: "Contacto não encontrado" }, { status: 404 })

  let ownerData = null
  let leadData = null

  // ── Owner data com imóveis e processos ──
  if (contact.owner_id) {
    const { data: owner } = await supabase
      .from("owners")
      .select("id, name, email, phone, nif, person_type")
      .eq("id", contact.owner_id)
      .single()

    if (owner) {
      // Imóveis do owner
      const { data: propertyLinks } = await supabase
        .from("property_owners")
        .select(`
          ownership_percentage,
          is_main_contact,
          property:dev_properties(
            id, title, slug, status, listing_price, property_type, city
          )
        `)
        .eq("owner_id", owner.id)

      // Processos dos imóveis do owner
      const propertyIds = (propertyLinks || [])
        .map(pl => (pl as any).property?.id)
        .filter(Boolean)

      let processes: any[] = []
      if (propertyIds.length > 0) {
        const { data: procs } = await supabase
          .from("proc_instances")
          .select("id, external_ref, current_status, percent_complete, property_id")
          .in("property_id", propertyIds)

        processes = procs || []
      }

      ownerData = {
        ...owner,
        properties: (propertyLinks || []).map(pl => ({
          ...(pl as any).property,
          ownership_percentage: (pl as any).ownership_percentage,
          is_main_contact: (pl as any).is_main_contact,
        })),
        processes,
      }
    }
  }

  // ── Lead data com negócios ──
  if (contact.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, name, email, phone_primary, status, score, source, lead_type, priority")
      .eq("id", contact.lead_id)
      .single()

    if (lead) {
      const { data: negocios } = await supabase
        .from("negocios")
        .select("id, tipo, estado, tipo_imovel, localizacao, orcamento_max")
        .eq("lead_id", lead.id)

      leadData = {
        ...lead,
        negocios: negocios || [],
      }
    }
  }

  return NextResponse.json({ owner: ownerData, lead: leadData })
}
```

### 1.4 Componente: Tags de Vinculação ERP

```tsx
// components/whatsapp/erp-link-tags.tsx
'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Building2, FileCheck, ShoppingCart, User, UserPlus } from 'lucide-react'
import Link from 'next/link'

interface ErpLinkTagsProps {
  contactId: string
}

interface OwnerData {
  id: string; name: string; nif: string
  properties: Array<{ id: string; title: string; status: string; listing_price: number }>
  processes: Array<{ id: string; external_ref: string; current_status: string; percent_complete: number }>
}

interface LeadData {
  id: string; name: string; status: string; score: number
  negocios: Array<{ id: string; tipo: string; estado: string; tipo_imovel: string }>
}

export function ErpLinkTags({ contactId }: ErpLinkTagsProps) {
  const [owner, setOwner] = useState<OwnerData | null>(null)
  const [lead, setLead] = useState<LeadData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/whatsapp/contacts/${contactId}/erp-data`)
        if (!res.ok) return
        const data = await res.json()
        setOwner(data.owner)
        setLead(data.lead)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [contactId])

  if (isLoading) return <div className="animate-pulse h-8 bg-muted rounded" />
  if (!owner && !lead) return null

  return (
    <div className="space-y-3">
      {/* Owner Tags */}
      {owner && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs font-medium">Proprietário</span>
          </div>
          <Link href={`/dashboard/proprietarios/${owner.id}`}>
            <Badge variant="outline" className="text-xs">
              {owner.name} {owner.nif ? `(${owner.nif})` : ''}
            </Badge>
          </Link>

          {/* Imóveis */}
          {owner.properties.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {owner.properties.map(p => (
                <Link key={p.id} href={`/dashboard/imoveis/${p.id}`}>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Building2 className="h-3 w-3" />
                    {p.title?.slice(0, 25)}{p.title?.length > 25 ? '...' : ''}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Processos */}
          {owner.processes.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {owner.processes.map(proc => (
                <Link key={proc.id} href={`/dashboard/processos/${proc.id}`}>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileCheck className="h-3 w-3" />
                    {proc.external_ref} ({proc.percent_complete}%)
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead Tags */}
      {lead && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-xs font-medium">Lead</span>
          </div>
          <Link href={`/dashboard/leads/${lead.id}`}>
            <Badge variant="outline" className="text-xs">
              {lead.name} — {lead.status} (Score: {lead.score})
            </Badge>
          </Link>

          {/* Negócios */}
          {lead.negocios.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {lead.negocios.map(n => (
                <Link key={n.id} href={`/dashboard/leads/${lead.id}/negocios/${n.id}`}>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    {n.tipo} — {n.tipo_imovel}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### 1.5 Dialog de Vinculação Manual

```tsx
// components/whatsapp/contact-link-dialog.tsx
// - Pesquisa de owners por nome/NIF/telefone
// - Pesquisa de leads por nome/email/telefone
// - Botão para desvincular
// - Auto-match all (botão que chama auto_match para todos)

// Reutilizar padrão do OwnerSearch existente:
// components/owners/owner-search.tsx (quando existir)

// Padrão:
// 1. Dialog com Tabs: "Proprietário" | "Lead"
// 2. Campo de pesquisa com debounce
// 3. Lista de resultados com rádio para selecção
// 4. Botão "Vincular" → PUT /api/whatsapp/instances/[id]/contacts/[contactId]
```

---

## 2. Supabase Realtime — Arquitectura

### 2.1 Padrão Híbrido (Postgres Changes + Broadcast)

```
┌─────────────────────────────────────────────────────────┐
│                    Supabase Realtime                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Postgres Changes (persistido no DB)                    │
│  ├── wpp_chats (INSERT/UPDATE) → Lista de chats         │
│  ├── wpp_messages (INSERT/UPDATE) → Thread de mensagens │
│  └── wpp_contacts (INSERT/UPDATE) → Lista de contactos  │
│                                                         │
│  Broadcast (efémero, não persistido)                    │
│  ├── presence → Indicadores de digitação                │
│  ├── online_status → Quem está online                   │
│  └── typing → "A escrever..." no frontend               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Channels e Eventos

```typescript
// Canal para lista de chats (1 por instância)
supabase.channel(`wpp-chats-${instanceId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'wpp_chats',
    filter: `instance_id=eq.${instanceId}`,
  }, handleChatChange)
  .subscribe()

// Canal para mensagens de um chat (1 por chat aberto)
supabase.channel(`wpp-messages-${chatId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'wpp_messages',
    filter: `chat_id=eq.${chatId}`,
  }, handleNewMessage)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'wpp_messages',
    filter: `chat_id=eq.${chatId}`,
  }, handleMessageUpdate)
  .subscribe()

// Canal para presença/typing (broadcast, 1 por instância)
supabase.channel(`wpp-presence-${instanceId}`)
  .on('broadcast', { event: 'presence' }, handlePresence)
  .subscribe()
```

### 2.3 Padrão de Referência: `hooks/use-chat-messages.ts`

O hook existente para chat dos processos já implementa o padrão:

```typescript
// Padrão validado no codebase:
const channel = supabase
  .channel(`process-chat-${processId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'proc_chat_messages',
    filter: `proc_instance_id=eq.${processId}`,
  }, (payload) => {
    const messageId = (payload.new as { id?: string })?.id
    if (messageId) fetchMessageById(messageId) // Fetch completo com joins
    else fetchMessages()                       // Fallback: refetch all
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'proc_chat_messages',
    filter: `proc_instance_id=eq.${processId}`,
  }, (payload) => {
    // Mesmo padrão para updates
  })
  .subscribe()

// Cleanup:
return () => {
  supabase.removeChannel(channel)
  channelRef.current = null
}
```

**Adaptação para WhatsApp Web:**
- Usar `payload.new` directamente em vez de refetch (para INSERT com dados completos)
- Para UPDATE, merge directo no state (status, reactions, is_deleted)
- Deduplicação via `wa_message_id` para evitar duplicados

### 2.4 Habilitação do Realtime no Supabase

```sql
-- Habilitar Realtime para as tabelas necessárias
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE wpp_contacts;

-- Configurar filtros para reduzir carga
-- (feito automaticamente pelo filter no subscribe)
```

---

## 3. Cascade Delete — Fluxo Completo

### 3.1 Quando uma instância é removida

```
DELETE auto_wpp_instances WHERE id = X
  │
  ├── CASCADE → wpp_contacts (todos os contactos da instância)
  ├── CASCADE → wpp_chats (todos os chats da instância)
  │     └── CASCADE → wpp_messages (todas as mensagens dos chats)
  │           └── CASCADE → wpp_message_media (todos os media das mensagens)
  ├── CASCADE → wpp_labels (todas as etiquetas)
  │     └── CASCADE → wpp_chat_labels (todas as associações)
  ├── CASCADE → _debug_wpp_payloads (payloads de debug)
  │
  └── TRIGGER → cleanup_instance_media()
        └── Marca ficheiros R2 para limpeza assíncrona
            Path: wpp-media/{instance_id}/**
```

### 3.2 Limpeza de ficheiros R2

```typescript
// Na API route de delete da instância:
async function handleDelete(supabase: any, params: any) {
  const { instance_id } = params

  // 1. Listar todos os ficheiros R2 da instância
  const { data: media } = await supabase
    .from("wpp_message_media")
    .select("r2_key")
    .eq("instance_id", instance_id)

  // 2. Apagar ficheiros do R2
  if (media?.length) {
    const deletePromises = media.map((m: any) =>
      S3.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: m.r2_key,
      })).catch(() => {}) // Não falhar se ficheiro não existe
    )
    await Promise.all(deletePromises)
  }

  // 3. Também apagar pasta outgoing
  // (Listar via S3 ListObjectsCommand com Prefix)

  // 4. Apagar instância do DB (cascade cuida do resto)
  const { error } = await supabase
    .from("auto_wpp_instances")
    .delete()
    .eq("id", instance_id)

  if (error) throw new Error(error.message)
}
```

---

## 4. Sincronização de Contactos

### 4.1 Sync via UAZAPI `/contacts/list`

```typescript
// Chamado manualmente ou no sync de instâncias
async function syncContactsFromUazapi(instanceId: string, token: string) {
  let page = 1
  const pageSize = 100
  let hasMore = true

  while (hasMore) {
    const res = await fetch(`${UAZAPI_URL}/contacts/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ page, pageSize }),
    })

    if (!res.ok) break
    const data = await res.json()
    const contacts = Array.isArray(data) ? data : data.contacts || []

    if (contacts.length === 0) {
      hasMore = false
      break
    }

    // Batch upsert
    for (const contact of contacts) {
      const jid = contact.id || contact.jid || ""
      if (!jid || jid.includes("@broadcast")) continue

      await supabase
        .from("wpp_contacts")
        .upsert({
          instance_id: instanceId,
          wa_contact_id: jid,
          phone: jid.split("@")[0],
          name: contact.name || contact.pushName || contact.notify || "",
          short_name: contact.shortName || "",
          profile_pic_url: contact.imgUrl || "",
          is_business: contact.isBusiness || false,
          is_group: jid.includes("@g.us"),
          raw_data: contact,
          updated_at: new Date().toISOString(),
        }, { onConflict: "instance_id,wa_contact_id", ignoreDuplicates: false })
    }

    page++
    if (contacts.length < pageSize) hasMore = false
  }
}
```

### 4.2 Sync via Webhook (passivo)

O webhook `contacts` do UAZAPI envia contactos actualizados automaticamente.
Tratado em `handleContacts()` no `whatsapp-webhook-receiver`.

---

## 5. Soft Delete de Mensagens

### 5.1 Quando o remetente apaga (delete for everyone)

```
UAZAPI Webhook: messages_update com ProtocolMessage type=0
  │
  └── webhook-receiver → handleNewMessage (messageType = "protocol")
        └── UPDATE wpp_messages SET is_deleted=true, deleted_at=now(), deleted_by='sender'
            WHERE instance_id=X AND wa_message_id=Y
```

### 5.2 Quando o utilizador do ERP apaga

```
Frontend: Botão "Apagar" no menu de contexto
  │
  ├── DELETE /api/whatsapp/messages/[id] { for_everyone: true }
  │     └── Edge function: whatsapp-messaging → handleDeleteMessage
  │           ├── UAZAPI /message/delete { id, forEveryone: true }
  │           └── UPDATE wpp_messages SET is_deleted=true, deleted_by='sender'
  │
  └── Frontend: Optimistic update → message.is_deleted = true
```

### 5.3 Renderização no Frontend

```tsx
// No message-bubble.tsx:
if (message.is_deleted) {
  return (
    <p className="text-sm italic text-muted-foreground">
      🚫 Esta mensagem foi apagada
    </p>
  )
}

// Para admins (role Broker/CEO):
// Mostrar conteúdo original com badge "Apagada"
if (message.is_deleted && isAdmin) {
  return (
    <div className="opacity-50">
      <Badge variant="destructive" className="text-[10px] mb-1">Apagada</Badge>
      {/* Renderizar conteúdo normal */}
    </div>
  )
}
```

---

## 6. Página de Gestão de Contactos

```tsx
// app/dashboard/whatsapp/contactos/page.tsx
// Funcionalidades:
// - Selector de instância
// - Tabela de contactos com colunas:
//   - Avatar + Nome + Telefone
//   - Vinculação (Owner/Lead/Nenhuma)
//   - Última mensagem
//   - Acções (Vincular, Ver chat, Bloquear)
// - Filtros: Todos | Com vinculação | Sem vinculação
// - Pesquisa por nome/telefone
// - Botão "Auto-vincular" (auto_match)
// - Botão "Sincronizar contactos"
// - Paginação

// Reutilizar DataTable pattern existente do codebase
```

---

## 7. Resumo de Ficheiros a Criar/Modificar

### Novos Ficheiros

| Ficheiro | Tipo | Descrição |
|---|---|---|
| `supabase/functions/whatsapp-webhook-receiver/index.ts` | Edge Function | Receber webhooks UAZAPI |
| `supabase/functions/whatsapp-messaging/index.ts` | Edge Function | Enviar mensagens via UAZAPI |
| `supabase/functions/whatsapp-media-processor/index.ts` | Edge Function | Processar media (decrypt + R2) |
| `supabase/functions/whatsapp-chats-api/index.ts` | Edge Function | API de gestão de chats |
| `app/api/whatsapp/chats/route.ts` | API Route | Listar chats |
| `app/api/whatsapp/chats/[chatId]/messages/route.ts` | API Route | Mensagens paginadas + enviar |
| `app/api/whatsapp/chats/[chatId]/read/route.ts` | API Route | Marcar como lido |
| `app/api/whatsapp/chats/[chatId]/presence/route.ts` | API Route | Enviar presença |
| `app/api/whatsapp/send/route.ts` | API Route | Enviar qualquer tipo |
| `app/api/whatsapp/messages/[messageId]/route.ts` | API Route | CRUD mensagem |
| `app/api/whatsapp/messages/[messageId]/react/route.ts` | API Route | Reagir |
| `app/api/whatsapp/instances/[id]/contacts/route.ts` | API Route | Contactos |
| `app/api/whatsapp/instances/[id]/contacts/[contactId]/route.ts` | API Route | Vincular contacto |
| `app/api/whatsapp/contacts/[contactId]/erp-data/route.ts` | API Route | Tags ERP |
| `app/api/whatsapp/media/upload/route.ts` | API Route | Upload para R2 |
| `app/dashboard/whatsapp/page.tsx` | Página | WhatsApp Web principal |
| `app/dashboard/whatsapp/layout.tsx` | Layout | Full-height |
| `app/dashboard/whatsapp/contactos/page.tsx` | Página | Gestão de contactos |
| `components/whatsapp/chat-layout.tsx` | Componente | Layout 3 painéis |
| `components/whatsapp/chat-sidebar.tsx` | Componente | Lista de chats |
| `components/whatsapp/chat-thread.tsx` | Componente | Área de mensagens |
| `components/whatsapp/chat-header.tsx` | Componente | Header do chat |
| `components/whatsapp/chat-input.tsx` | Componente | Input de mensagem |
| `components/whatsapp/chat-info-panel.tsx` | Componente | Info do contacto |
| `components/whatsapp/message-bubble.tsx` | Componente | Bolha de mensagem |
| `components/whatsapp/message-status.tsx` | Componente | Ticks de status |
| `components/whatsapp/message-reactions.tsx` | Componente | Reacções |
| `components/whatsapp/message-quoted.tsx` | Componente | Mensagem citada |
| `components/whatsapp/message-media-renderer.tsx` | Componente | Media renderer |
| `components/whatsapp/message-context-menu.tsx` | Componente | Menu de contexto |
| `components/whatsapp/audio-player.tsx` | Componente | Player de áudio |
| `components/whatsapp/media-preview-modal.tsx` | Componente | Preview fullscreen |
| `components/whatsapp/typing-indicator.tsx` | Componente | "A escrever..." |
| `components/whatsapp/instance-selector.tsx` | Componente | Selector de instância |
| `components/whatsapp/erp-link-tags.tsx` | Componente | Tags de vinculação |
| `components/whatsapp/contact-link-dialog.tsx` | Componente | Dialog de vinculação |
| `components/whatsapp/contact-card.tsx` | Componente | Card de contacto |
| `components/whatsapp/empty-chat-state.tsx` | Componente | Estado vazio |
| `components/whatsapp/emoji-picker.tsx` | Componente | Picker de emojis |
| `components/whatsapp/search-messages.tsx` | Componente | Pesquisa |
| `hooks/use-whatsapp-chats.ts` | Hook | Lista de chats + realtime |
| `hooks/use-whatsapp-messages.ts` | Hook | Mensagens + realtime |
| `hooks/use-whatsapp-presence.ts` | Hook | Indicadores de digitação |
| `hooks/use-whatsapp-contacts.ts` | Hook | Gestão de contactos |
| `lib/types/whatsapp-web.ts` | Types | Tipos para WhatsApp Web |

### Ficheiros a Modificar

| Ficheiro | Modificação |
|---|---|
| `app/api/automacao/instancias/route.ts` | Adicionar webhook registration no sync/connect |
| `components/layout/app-sidebar.tsx` | Adicionar link "WhatsApp Web" no sidebar |
| `lib/types/whatsapp-template.ts` | Opcional: re-exportar tipos de whatsapp-web.ts |

### Migrações SQL

| Migração | Tabelas |
|---|---|
| `001_wpp_contacts.sql` | `wpp_contacts` |
| `002_wpp_chats.sql` | `wpp_chats` |
| `003_wpp_messages.sql` | `wpp_messages` |
| `004_wpp_message_media.sql` | `wpp_message_media` |
| `005_wpp_labels.sql` | `wpp_labels`, `wpp_chat_labels` |
| `006_debug_wpp_payloads.sql` | `_debug_wpp_payloads` |
| `007_alter_instances.sql` | ALTER `auto_wpp_instances` (webhook fields) |
| `008_realtime_enable.sql` | ALTER PUBLICATION para realtime |
| `009_cleanup_trigger.sql` | Trigger de cleanup de media |

---

## 8. Ordem de Implementação Recomendada

```
FASE A — Backend (DB + Edge Functions)
  1. Criar migrações SQL (tabelas + índices + realtime)
  2. Deploy edge function: whatsapp-webhook-receiver
  3. Deploy edge function: whatsapp-messaging
  4. Deploy edge function: whatsapp-chats-api
  5. Modificar instâncias API para registar webhook
  6. Testar: enviar/receber mensagem via UAZAPI

FASE B — API Routes + Hooks
  7. API routes: chats, messages, send, contacts
  8. Hooks: useWhatsAppChats, useWhatsAppMessages, useWhatsAppPresence
  9. Testar: listar chats, carregar mensagens, enviar texto

FASE C — Frontend Básico
  10. Página + layout do WhatsApp Web
  11. ChatLayout + ChatSidebar + ChatThread
  12. MessageBubble + MessageStatus + ChatInput
  13. Sidebar link
  14. Testar: fluxo completo texto (enviar/receber/status)

FASE D — Media + Funcionalidades Avançadas
  15. Deploy edge function: whatsapp-media-processor
  16. MessageMediaRenderer (image, video, audio, document)
  17. AudioPlayer + MediaPreviewModal
  18. Upload de ficheiros para envio
  19. Testar: enviar/receber media

FASE E — Contactos + Vinculação
  20. Página de contactos
  21. Auto-match + vinculação manual
  22. ErpLinkTags + ChatInfoPanel
  23. Testar: vincular contacto a owner, ver tags

FASE F — Polish
  24. Emoji picker + reacções
  25. Menu de contexto (responder, reencaminhar, apagar)
  26. Pesquisa de mensagens
  27. Typing indicator
  28. Loading states + empty states + error handling
```
