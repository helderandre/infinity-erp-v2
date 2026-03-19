# SPEC-05: Novos Tipos de Mensagem WhatsApp

**Data**: 2026-03-19
**PRD**: `docs/M14-WHATSAPP-WEB/PRD-05-NOVOS-TIPOS-MENSAGEM.md`
**Escopo**: Enquete (Poll), Contacto (vCard melhorado), Câmera, Catálogo (experimental)

---

## Fase A — Enquete (Poll)

### A1. Migração SQL — Adicionar coluna `poll_data`

**Acção**: Criar migração via Supabase
**O que fazer**: A tabela `wpp_messages` **não tem** coluna `poll_data`. Adicionar:

```sql
ALTER TABLE wpp_messages ADD COLUMN poll_data JSONB DEFAULT NULL;
COMMENT ON COLUMN wpp_messages.poll_data IS 'Dados estruturados de enquete: { name, options: [{ name, votes, voters }], selectableCount }';
```

---

### A2. `lib/types/whatsapp-web.ts`

**Acção**: Alterar
**O que fazer**:

1. Adicionar interfaces `PollData` e `PollOption` (antes da interface `WppMessage`):

```typescript
export interface PollOption {
  name: string
  votes: number
  voters?: string[]
}

export interface PollData {
  name: string
  options: PollOption[]
  selectableCount: number
}
```

2. Alterar o tipo do campo `poll_data` em `WppMessage` (L59):

```typescript
// DE:
poll_data: Record<string, unknown> | null
// PARA:
poll_data: PollData | null
```

---

### A3. `lib/types/automation-flow.ts`

**Acção**: Alterar
**O que fazer**: Adicionar `'poll'` e `'contact'` ao union `WhatsAppMessageType` (L30):

```typescript
// DE:
export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document'
// PARA:
export type WhatsAppMessageType = 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'poll' | 'contact'
```

Adicionar campos opcionais à interface `WhatsAppMessage` (L72-78):

```typescript
export interface WhatsAppMessage {
  type: WhatsAppMessageType
  content: string
  mediaUrl?: string
  docName?: string
  delay?: number
  // Novos campos para poll:
  pollOptions?: string[]
  pollSelectableCount?: number
  // Novos campos para contact:
  contactName?: string
  contactPhone?: string
  contactOrganization?: string
  contactEmail?: string
}
```

---

### A4. `lib/types/whatsapp-template.ts`

**Acção**: Alterar
**O que fazer**: Adicionar payloads de envio (após `UazapiSendMediaPayload`, ~L125):

```typescript
export interface UazapiSendPollPayload extends UazapiSendPayload {
  type: 'poll'
  text: string
  choices: string[]
  selectableCount?: number
}

export interface UazapiSendContactPayload extends UazapiSendPayload {
  fullName: string
  phoneNumber: string
  organization?: string
  email?: string
  url?: string
}
```

---

### A5. `supabase/functions/whatsapp-webhook-receiver/index.ts`

**Acção**: Alterar
**O que fazer**: Extrair dados de poll do `content` raw e guardar em `poll_data`.

Na função `handleNewMessage()`, **após** a extracção de vCard (L191) e **antes** do bloco de reacções (L196), adicionar:

```typescript
// Poll data
let pollData: Record<string, unknown> | null = null
if (messageType === "poll") {
  const pollCreation = content.pollCreationMessage || content.poll || null
  if (pollCreation) {
    pollData = {
      name: pollCreation.name || text || "",
      options: (pollCreation.options || []).map((o: any) => ({
        name: o.optionName || o.name || o,
        votes: 0,
        voters: [],
      })),
      selectableCount: pollCreation.selectableOptionsCount || pollCreation.selectableCount || 1,
    }
  }
}
```

No upsert da mensagem (L307-333), adicionar o campo `poll_data`:

```typescript
await supabase
  .from("wpp_messages")
  .upsert({
    // ... campos existentes ...
    vcard,
    poll_data: pollData,  // ← NOVO
    timestamp: messageTimestamp,
    raw_data: msg,
  }, { onConflict: "instance_id,wa_message_id", ignoreDuplicates: true })
```

---

### A6. `supabase/functions/whatsapp-messaging/index.ts`

**Acção**: Alterar
**O que fazer**: Adicionar handler `send_poll`.

1. No switch de acções (~L54), adicionar case:

```typescript
case "send_poll":      return await handleSendPoll(body)
```

2. Criar função `handleSendPoll` (após `handleSendContact`, ~L188):

```typescript
// ── SEND POLL ──
async function handleSendPoll(body: any) {
  const { instance_id, wa_chat_id, poll_question, poll_options, poll_selectable_count } = body
  if (!instance_id || !wa_chat_id || !poll_question || !poll_options?.length) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/send/menu", {
    number: wa_chat_id,
    type: "poll",
    text: poll_question,
    choices: poll_options,
    selectableCount: poll_selectable_count || 1,
  })

  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id,
    waChatId: wa_chat_id,
    waMessageId,
    text: poll_question,
    messageType: "poll",
    extra: {
      poll_data: {
        name: poll_question,
        options: poll_options.map((o: string) => ({ name: o, votes: 0, voters: [] })),
        selectableCount: poll_selectable_count || 1,
      },
    },
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}
```

> **Nota**: A função `saveOutgoingMessage` pode precisar de ser ajustada para aceitar `extra` fields (incluindo `poll_data`) no insert. Verificar a implementação actual e adicionar spread de `extra` no upsert se necessário.

---

### A7. `hooks/use-whatsapp-messages.ts`

**Acção**: Alterar
**O que fazer**: Adicionar função `sendPoll()`.

Após `sendAudio()` (~L271), adicionar:

```typescript
const sendPoll = useCallback(async (question: string, options: string[], selectableCount: number = 1, replyId?: string) => {
  if (!chatId || !question.trim() || options.length < 2) return
  setIsSending(true)
  try {
    // Mensagem optimista
    const optimistic: WppMessage = {
      id: `optimistic-${Date.now()}`,
      chat_id: chatId,
      instance_id: '',
      wa_message_id: '',
      from_me: true,
      message_type: 'poll',
      text: question,
      status: 'sent',
      timestamp: Math.floor(Date.now() / 1000),
      poll_data: {
        name: question,
        options: options.map(o => ({ name: o, votes: 0 })),
        selectableCount,
      },
      // ... restantes campos null (seguir padrão do sendText)
      sender: null, sender_name: null, sender_phone: null,
      media_url: null, media_mime_type: null, media_file_name: null,
      media_file_size: null, media_duration: null, media_thumbnail_url: null,
      quoted_message_id: replyId || null,
      is_forwarded: false, is_starred: false, is_deleted: false, is_edited: false,
      reactions: null,
      location_latitude: null, location_longitude: null, location_name: null,
      contact_vcard: null, raw_data: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_poll',
        poll_question: question,
        poll_options: options,
        poll_selectable_count: selectableCount,
        reply_id: replyId,
      }),
    })
  } catch (err) {
    console.error('sendPoll error:', err)
  } finally {
    setIsSending(false)
  }
}, [chatId])
```

Adicionar `sendPoll` ao return do hook:

```typescript
return {
  // ... existentes ...
  sendPoll,
  sendContact,  // ← ver Fase B
}
```

---

### A8. `components/whatsapp/poll-message.tsx`

**Acção**: Criar (NOVO)
**O que fazer**: Componente para renderizar enquete recebida/enviada com opções e barras de progresso.

```tsx
"use client"

import { BarChart3 } from "lucide-react"
import type { WppMessage, PollData } from "@/lib/types/whatsapp-web"

interface PollMessageProps {
  message: WppMessage
}

export function PollMessage({ message }: PollMessageProps) {
  const pollData = message.poll_data as PollData | null
  if (!pollData) return null

  const totalVotes = pollData.options.reduce((sum, o) => sum + (o.votes || 0), 0)

  return (
    <div className="min-w-[260px] max-w-[320px]">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-medium">Sondagem</span>
      </div>

      <p className="text-sm font-semibold mb-3">{pollData.name}</p>

      <div className="space-y-2">
        {pollData.options.map((option, i) => {
          const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
          return (
            <div key={i} className="relative">
              <div
                className="absolute inset-0 rounded bg-emerald-100 dark:bg-emerald-900/30 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 rounded border">
                <span className="text-sm">{option.name}</span>
                {totalVotes > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {option.votes} ({Math.round(pct)}%)
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {totalVotes > 0 && (
        <p className="text-xs text-muted-foreground mt-2">
          {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
          {pollData.selectableCount > 1 && ` · Máx. ${pollData.selectableCount} opções`}
        </p>
      )}
    </div>
  )
}
```

---

### A9. `components/whatsapp/poll-creator.tsx`

**Acção**: Criar (NOVO)
**O que fazer**: Dialog para criar enquete (pergunta + opções dinâmicas + selectableCount).

Estrutura:
- Dialog/Sheet com título "Criar Sondagem"
- Input para pergunta (obrigatório, placeholder "Escreva a pergunta...")
- Lista dinâmica de opções (mín. 2, máx. 12), cada uma com Input + botão remover
- Botão "Adicionar opção"
- Select para `selectableCount` (1 a N opções)
- Botões "Cancelar" e "Enviar Sondagem"
- Validação: pergunta não vazia, pelo menos 2 opções não vazias

Props:
```typescript
interface PollCreatorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (question: string, options: string[], selectableCount: number) => void
}
```

Usar componentes shadcn: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `Input`, `Button`, `Select`.

---

### A10. `components/whatsapp/message-media-renderer.tsx`

**Acção**: Alterar
**O que fazer**: Adicionar `case 'poll'` no switch (antes do `case 'contact'`, ~L266).

```tsx
import { PollMessage } from './poll-message'

// No switch, adicionar:
case 'poll':
  return <PollMessage message={message} />
```

---

### A11. `components/whatsapp/chat-input.tsx`

**Acção**: Alterar
**O que fazer**:

1. Adicionar props para poll e contact:

```typescript
interface ChatInputProps {
  // ... existentes ...
  onSendPoll?: (question: string, options: string[], selectableCount: number) => void
  onSendContact?: (name: string, phone: string, org?: string, email?: string) => void
}
```

2. Adicionar state para controlar dialogs:

```typescript
const [pollCreatorOpen, setPollCreatorOpen] = useState(false)
const [contactPickerOpen, setContactPickerOpen] = useState(false)
const [cameraOpen, setCameraOpen] = useState(false)
```

3. No `DropdownMenuContent` (após o item "Documento", ~L153), adicionar separador e novos itens:

```tsx
<DropdownMenuSeparator />
<DropdownMenuItem onClick={() => setPollCreatorOpen(true)}>
  <BarChart3 className="mr-2 h-4 w-4" /> Sondagem
</DropdownMenuItem>
<DropdownMenuItem onClick={() => setContactPickerOpen(true)}>
  <UserRound className="mr-2 h-4 w-4" /> Contacto
</DropdownMenuItem>
<DropdownMenuItem onClick={() => setCameraOpen(true)}>
  <Camera className="mr-2 h-4 w-4" /> Câmera
</DropdownMenuItem>
```

4. Renderizar os dialogs (antes do `return` final ou dentro do JSX raiz):

```tsx
<PollCreator
  open={pollCreatorOpen}
  onOpenChange={setPollCreatorOpen}
  onSend={(q, opts, sc) => {
    onSendPoll?.(q, opts, sc)
    setPollCreatorOpen(false)
  }}
/>
<ContactPicker
  open={contactPickerOpen}
  onOpenChange={setContactPickerOpen}
  onSend={(name, phone, org, email) => {
    onSendContact?.(name, phone, org, email)
    setContactPickerOpen(false)
  }}
/>
{cameraOpen && (
  <CameraCapture
    onCapture={(file, type) => {
      onSendMedia(file, type)
      setCameraOpen(false)
    }}
    onClose={() => setCameraOpen(false)}
  />
)}
```

---

### A12. `lib/node-processors/whatsapp.ts`

**Acção**: Alterar
**O que fazer**: Adicionar handler para `poll` no if/else chain (~L99-136).

Após o bloco `else` de media (L115-136), adicionar:

```typescript
} else if (msg.type === "poll") {
  response = await fetch(`${baseUrl}/send/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: instance.uazapi_token },
    body: JSON.stringify({
      number: recipientNumber,
      type: "poll",
      text: content,
      choices: msg.pollOptions || [],
      selectableCount: msg.pollSelectableCount || 1,
      delay: msg.delay || 2,
      readchat: true,
      track_source: "erp_infinity",
      track_id: flowMeta.runId,
    }),
  })
}
```

---

## Fase B — Contacto (vCard melhorado)

### B1. `lib/utils/vcard.ts`

**Acção**: Criar (NOVO)
**O que fazer**: Utilitários de parse e geração de vCard 3.0.

```typescript
export interface ParsedVCard {
  fullName: string
  phones: { number: string; type: string; waid?: string }[]
  email?: string
  organization?: string
  url?: string
}

export function parseVCard(vcard: string): ParsedVCard {
  const lines = vcard.split(/\r?\n/)
  const result: ParsedVCard = { fullName: '', phones: [] }

  for (const line of lines) {
    if (line.startsWith('FN:')) {
      result.fullName = line.slice(3)
    } else if (line.startsWith('TEL')) {
      const typeMatch = line.match(/TYPE=(\w+)/)
      const waidMatch = line.match(/waid=(\d+)/)
      const number = line.split(':').pop() || ''
      result.phones.push({
        number: number.trim(),
        type: typeMatch?.[1] || 'CELL',
        waid: waidMatch?.[1],
      })
    } else if (line.startsWith('EMAIL')) {
      result.email = line.split(':').pop()?.trim()
    } else if (line.startsWith('ORG:')) {
      result.organization = line.slice(4).replace(/;$/, '')
    } else if (line.startsWith('URL:')) {
      result.url = line.slice(4)
    }
  }
  return result
}

export function generateVCard(contact: {
  fullName: string
  phone: string
  organization?: string
  email?: string
  url?: string
}): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${contact.fullName}`,
    `TEL;TYPE=CELL:${contact.phone}`,
  ]
  if (contact.organization) lines.push(`ORG:${contact.organization}`)
  if (contact.email) lines.push(`EMAIL;TYPE=INTERNET:${contact.email}`)
  if (contact.url) lines.push(`URL:${contact.url}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}
```

---

### B2. `components/whatsapp/contact-card-message.tsx`

**Acção**: Criar (NOVO)
**O que fazer**: Renderizar contacto recebido com dados do vCard parseado.

Estrutura:
- Parsear `message.contact_vcard` usando `parseVCard()`
- Fallback para `message.text` se vCard não existir
- Card com: avatar placeholder (ícone User), nome, telefone(s), organização, email
- Botões de acção: "Enviar mensagem" (abre chat WhatsApp), "Copiar número"
- Se vCard tem `waid`, o botão "Enviar mensagem" pode abrir o chat no ERP

Props:
```typescript
interface ContactCardMessageProps {
  message: WppMessage
}
```

Layout aproximado:
```
┌─────────────────────────────┐
│ 👤  João Silva              │
│     Infinity Group          │
│     +351 912 345 678  📋    │
│     joao@infinity.pt        │
│                             │
│  [Enviar mensagem]          │
└─────────────────────────────┘
```

---

### B3. `components/whatsapp/contact-picker.tsx`

**Acção**: Criar (NOVO)
**O que fazer**: Dialog para seleccionar ou criar contacto a enviar.

Estrutura:
- Dialog com título "Enviar Contacto"
- Duas tabs ou modos:
  - **Manual**: Inputs para nome (obrigatório), telefone (obrigatório), organização, email
  - **Da lista**: Search input que filtra contactos WPP existentes (fetch de `wpp_contacts` da instância)
- Botões "Cancelar" e "Enviar"

Props:
```typescript
interface ContactPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (name: string, phone: string, organization?: string, email?: string) => void
  instanceId?: string  // Para buscar contactos existentes
}
```

---

### B4. `components/whatsapp/message-media-renderer.tsx`

**Acção**: Alterar
**O que fazer**: Melhorar o `case 'contact'` existente (L266-272).

```tsx
import { ContactCardMessage } from './contact-card-message'

// Substituir o case 'contact' actual por:
case 'contact':
  return <ContactCardMessage message={message} />
```

---

### B5. `hooks/use-whatsapp-messages.ts`

**Acção**: Alterar
**O que fazer**: Adicionar função `sendContact()`.

Após `sendPoll()`, adicionar:

```typescript
const sendContact = useCallback(async (
  contactName: string,
  contactPhone: string,
  organization?: string,
  email?: string,
  replyId?: string
) => {
  if (!chatId || !contactName.trim() || !contactPhone.trim()) return
  setIsSending(true)
  try {
    const optimistic: WppMessage = {
      id: `optimistic-${Date.now()}`,
      chat_id: chatId,
      instance_id: '',
      wa_message_id: '',
      from_me: true,
      message_type: 'contact',
      text: contactName,
      status: 'sent',
      timestamp: Math.floor(Date.now() / 1000),
      contact_vcard: generateVCard({ fullName: contactName, phone: contactPhone, organization, email }),
      // ... restantes campos null (seguir padrão)
      sender: null, sender_name: null, sender_phone: null,
      media_url: null, media_mime_type: null, media_file_name: null,
      media_file_size: null, media_duration: null, media_thumbnail_url: null,
      quoted_message_id: replyId || null,
      is_forwarded: false, is_starred: false, is_deleted: false, is_edited: false,
      reactions: null, poll_data: null,
      location_latitude: null, location_longitude: null, location_name: null,
      raw_data: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_contact',
        contact_name: contactName,
        contact_phone: contactPhone,
        // organization e email já são suportados pela Edge Function existente
        // mas a Edge Function actual só aceita contact_name e contact_phone
        // Pode ser necessário estender handleSendContact
      }),
    })
  } catch (err) {
    console.error('sendContact error:', err)
  } finally {
    setIsSending(false)
  }
}, [chatId])
```

---

### B6. `supabase/functions/whatsapp-messaging/index.ts`

**Acção**: Alterar
**O que fazer**: Estender `handleSendContact` (L169-188) para aceitar `organization` e `email`.

```typescript
async function handleSendContact(body: any) {
  const { instance_id, wa_chat_id, contact_name, contact_phone, organization, email, url } = body
  if (!instance_id || !wa_chat_id || !contact_name || !contact_phone) {
    return jsonResponse({ error: "Campos obrigatórios em falta" }, 400)
  }

  const token = await getInstanceToken(instance_id)
  const result = await callUazapi(token, "/send/contact", {
    number: wa_chat_id,
    fullName: contact_name,
    phoneNumber: contact_phone,
    ...(organization && { organization }),
    ...(email && { email }),
    ...(url && { url }),
  })

  const waMessageId = result?.messageid || result?.id || result?.key?.id || ""
  const savedMsg = await saveOutgoingMessage({
    instanceId: instance_id, waChatId: wa_chat_id, waMessageId,
    text: contact_name, messageType: "contact",
  })

  return jsonResponse({ message: savedMsg, uazapi_response: result })
}
```

> **Nota**: O `handleSendContact` actual usa formato `contact: [{ name, number }]`. A API UAZAPI também suporta o formato flat com `fullName`, `phoneNumber`, `organization`, `email`, `url` (conforme PRD secção 3.2). Verificar qual formato a instância UAZAPI aceita e usar o correcto.

---

### B7. `lib/node-processors/whatsapp.ts`

**Acção**: Alterar
**O que fazer**: Adicionar handler para `contact` no if/else chain.

Após o bloco de `poll` (adicionado em A12), adicionar:

```typescript
} else if (msg.type === "contact") {
  response = await fetch(`${baseUrl}/send/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: instance.uazapi_token },
    body: JSON.stringify({
      number: recipientNumber,
      fullName: msg.contactName || content,
      phoneNumber: msg.contactPhone || "",
      ...(msg.contactOrganization && { organization: msg.contactOrganization }),
      ...(msg.contactEmail && { email: msg.contactEmail }),
      delay: msg.delay || 2,
      readchat: true,
      track_source: "erp_infinity",
      track_id: flowMeta.runId,
    }),
  })
}
```

---

## Fase C — Câmera

### C1. `components/whatsapp/camera-capture.tsx`

**Acção**: Criar (NOVO)
**O que fazer**: Componente fullscreen de captura de foto/vídeo via browser API (`navigator.mediaDevices.getUserMedia`).

Estrutura:
- Modo foto e modo vídeo (toggle)
- Preview de câmera via `<video>` element com stream
- Botão circular de captura (foto: snapshot via canvas, vídeo: MediaRecorder)
- Botão de trocar câmera (front/back via `facingMode`)
- Botão fechar (X)
- Após captura: preview com botões "Descartar" e "Enviar"
- Permissão negada: mostrar mensagem explicativa

Props:
```typescript
interface CameraCaptureProps {
  onCapture: (file: File, type: 'image' | 'video') => void
  onClose: () => void
}
```

Fluxo de captura de foto:
```typescript
const capturePhoto = () => {
  const video = videoRef.current!
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d')!.drawImage(video, 0, 0)
  canvas.toBlob(blob => {
    if (blob) onCapture(new File([blob], 'photo.jpg', { type: 'image/jpeg' }), 'image')
  }, 'image/jpeg', 0.85)
}
```

Fluxo de captura de vídeo:
```typescript
// Usar MediaRecorder API
const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
// Ao parar: criar File a partir dos chunks e chamar onCapture(file, 'video')
```

**Sem alterações de API** — o ficheiro capturado é enviado via `sendMedia(file, 'image'|'video')` que já existe.

---

### C2. `components/whatsapp/chat-input.tsx`

**Acção**: Já coberto em A11
**O que fazer**: O botão "Câmera" e o render do `<CameraCapture>` já foram especificados em A11.

---

## Fase D — Catálogo (Experimental — Baixa Prioridade)

> **Adiar implementação** até a UAZAPI estabilizar os endpoints `/business/catalog/*` (marcados como experimentais). Quando avançar:

### D1. `app/api/whatsapp/catalog/route.ts`

**Acção**: Criar (NOVO)
**O que fazer**: Proxy GET para listar produtos do catálogo via UAZAPI.

- `GET` — Recebe `instanceId` e `jid` como query params
- Chama UAZAPI `POST /business/catalog/list` com `{ jid }`
- Retorna lista de `CatalogProduct[]`

### D2. `app/api/whatsapp/catalog/[productId]/route.ts`

**Acção**: Criar (NOVO)
**O que fazer**: Proxy para info/show/hide de produto.

- `GET` — Info do produto via `/business/catalog/info`
- `POST` — Toggle show/hide via `/business/catalog/show` ou `/business/catalog/hide`

---

## Resumo de Ficheiros

### Ficheiros a CRIAR (7)

| # | Path | Fase | Descrição |
|---|------|------|-----------|
| 1 | `lib/utils/vcard.ts` | B | Parser e gerador vCard 3.0 |
| 2 | `components/whatsapp/poll-message.tsx` | A | Renderizar enquete com barras de progresso |
| 3 | `components/whatsapp/poll-creator.tsx` | A | Dialog para criar enquete |
| 4 | `components/whatsapp/contact-card-message.tsx` | B | Renderizar cartão de contacto rico |
| 5 | `components/whatsapp/contact-picker.tsx` | B | Dialog para seleccionar/criar contacto |
| 6 | `components/whatsapp/camera-capture.tsx` | C | Captura de foto/vídeo via browser |
| 7 | `app/api/whatsapp/catalog/route.ts` | D | Proxy catálogo (experimental) |

### Ficheiros a ALTERAR (8)

| # | Path | Fase | O que muda |
|---|------|------|-----------|
| 1 | `lib/types/whatsapp-web.ts` | A | Adicionar `PollData`, `PollOption`; tipar `poll_data` |
| 2 | `lib/types/automation-flow.ts` | A | Adicionar `'poll'` e `'contact'` ao union; campos poll/contact em `WhatsAppMessage` |
| 3 | `lib/types/whatsapp-template.ts` | A | Adicionar `UazapiSendPollPayload` e `UazapiSendContactPayload` |
| 4 | `hooks/use-whatsapp-messages.ts` | A+B | Adicionar `sendPoll()` e `sendContact()` |
| 5 | `components/whatsapp/message-media-renderer.tsx` | A+B | Adicionar `case 'poll'`; melhorar `case 'contact'` |
| 6 | `components/whatsapp/chat-input.tsx` | A+B+C | Adicionar botões Sondagem/Contacto/Câmera + dialogs |
| 7 | `lib/node-processors/whatsapp.ts` | A+B | Handlers `poll` e `contact` no if/else chain |
| 8 | `supabase/functions/whatsapp-messaging/index.ts` | A+B | Adicionar `handleSendPoll`; estender `handleSendContact` |

### Edge Functions a ALTERAR (2)

| # | Path | Fase | O que muda |
|---|------|------|-----------|
| 1 | `supabase/functions/whatsapp-messaging/index.ts` | A+B | `send_poll` action + estender `send_contact` |
| 2 | `supabase/functions/whatsapp-webhook-receiver/index.ts` | A | Extrair `poll_data` do content e guardar no upsert |

### Migração SQL (1)

| # | Descrição | Fase |
|---|-----------|------|
| 1 | `ALTER TABLE wpp_messages ADD COLUMN poll_data JSONB DEFAULT NULL` | A |

---

## Ordem de Implementação Recomendada

```
1. Migração SQL (poll_data)
2. Types (whatsapp-web.ts, automation-flow.ts, whatsapp-template.ts)
3. Utils (vcard.ts)
4. Edge Functions (webhook-receiver → poll_data, messaging → send_poll + send_contact)
5. Hook (sendPoll, sendContact)
6. Componentes de renderização (poll-message, contact-card-message)
7. Componentes de criação (poll-creator, contact-picker, camera-capture)
8. Integração no chat-input (botões + dialogs)
9. Node processor (automation poll + contact)
10. Deploy Edge Functions
```
