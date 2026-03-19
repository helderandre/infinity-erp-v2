# PRD-05: Novos Tipos de Mensagem WhatsApp

**Data**: 2026-03-19
**Git Commit**: `411cab5`
**Branch**: `master`
**Autor**: Claude Code (Pesquisa)

---

## 1. Resumo Executivo

Implementar suporte para **5 novos tipos de mensagem** no módulo WhatsApp do ERP Infinity:

| Tipo | Enviar | Receber | API UAZAPI | Viabilidade |
|------|--------|---------|------------|-------------|
| **Enquete (Poll)** | ✅ | ✅ | `/send/menu` (type: poll) | Total |
| **Áudio (como media)** | ✅ Já existe | ✅ Já existe | `/send/media` (type: audio/ptt) | Já implementado |
| **Contacto (vCard)** | ✅ | ✅ Parcial | `/send/contact` | Total |
| **Catálogo (Produtos)** | ⚠️ Limitado | ✅ | `/business/catalog/*` | Parcial (requer WhatsApp Business) |
| **Camera (foto/vídeo)** | ✅ | N/A | `/send/media` (type: image/video) | Via captura do browser |

### Limitações Conhecidas

- **Catálogo**: Endpoints UAZAPI marcados como `⚠️ EXPERIMENTAL` — "podem não funcionar como esperado". Requer conta WhatsApp Business.
- **Camera**: WhatsApp não tem endpoint nativo "camera" — implementamos via `navigator.mediaDevices.getUserMedia()` no browser e enviamos como imagem/vídeo normal.
- **Enquetes**: Só funcionam em chats 1:1 e grupos. Resultados de votação chegam via webhook no campo `vote` da mensagem.

---

## 2. Arquivos da Base de Código Afectados

### 2.1 Types & Constants (Alterações)

| Arquivo | O que muda |
|---------|-----------|
| [`lib/types/whatsapp-web.ts`](lib/types/whatsapp-web.ts) | Adicionar campos `poll_name`, `poll_options`, `poll_selectable_count`, `poll_votes` ao `WppMessage`. Enricher `contact_vcard` parsing. |
| [`lib/types/whatsapp-template.ts`](lib/types/whatsapp-template.ts) | Adicionar `poll`, `contact` ao `WhatsAppMessageType` e `UazapiSendPollPayload`, `UazapiSendContactPayload` |
| [`lib/types/automation-flow.ts`](lib/types/automation-flow.ts) | Adicionar `poll`, `contact` ao `WhatsAppMessageType` union |

### 2.2 Componentes UI (Alterações + Novos)

| Arquivo | Status | O que muda |
|---------|--------|-----------|
| [`components/whatsapp/message-media-renderer.tsx`](components/whatsapp/message-media-renderer.tsx) | **Alterar** | Adicionar cases `poll` e `contact` no switch (L146) |
| [`components/whatsapp/chat-input.tsx`](components/whatsapp/chat-input.tsx) | **Alterar** | Adicionar botões no DropdownMenu: Enquete, Contacto, Camera |
| `components/whatsapp/poll-creator.tsx` | **Novo** | Dialog/sheet para criar enquete (pergunta + opções + selectableCount) |
| `components/whatsapp/poll-message.tsx` | **Novo** | Renderizar enquete recebida com opções, votos, barra de progresso |
| `components/whatsapp/contact-card-message.tsx` | **Novo** | Renderizar cartão de contacto recebido (parse vCard) |
| `components/whatsapp/contact-picker.tsx` | **Novo** | Dialog para seleccionar contacto a enviar (da lista de contactos WPP ou manual) |
| `components/whatsapp/camera-capture.tsx` | **Novo** | Componente de captura de câmera (foto/vídeo) via browser API |

### 2.3 Hooks (Alterações)

| Arquivo | O que muda |
|---------|-----------|
| [`hooks/use-whatsapp-messages.ts`](hooks/use-whatsapp-messages.ts) | Adicionar `sendPoll()`, `sendContact()` ao hook |

### 2.4 API Routes (Alterações + Novas)

| Arquivo | Status | O que muda |
|---------|--------|-----------|
| [`app/api/whatsapp/chats/[chatId]/messages/route.ts`](app/api/whatsapp/chats/[chatId]/messages/route.ts) | **Alterar** | Suportar `action: 'send_poll'` e `action: 'send_contact'` no POST |
| `app/api/whatsapp/catalog/route.ts` | **Novo** | GET: listar produtos do catálogo via UAZAPI |
| `app/api/whatsapp/catalog/[productId]/route.ts` | **Novo** | GET: info produto, POST: show/hide |

### 2.5 Webhook / Message Parsing (Alterações)

| Arquivo | O que muda |
|---------|-----------|
| [`app/api/whatsapp/chats/[chatId]/messages/route.ts`](app/api/whatsapp/chats/[chatId]/messages/route.ts) | Enriquecer `normalizeMessageType` e extracção de campos para poll e contact (L12-30, L100-145) |
| Edge Function `whatsapp-webhook-receiver` | Parsear `PollCreationMessage`, `PollUpdateMessage`, `ContactMessage`, `ContactsArrayMessage` |

### 2.6 Automation (Alterações)

| Arquivo | O que muda |
|---------|-----------|
| [`lib/node-processors/whatsapp.ts`](lib/node-processors/whatsapp.ts) | Adicionar handlers para `poll` e `contact` message types (L99-136) |

---

## 3. Documentação da API UAZAPI — Trechos Relevantes

### 3.1 Enviar Enquete — `POST /send/menu`

```json
{
  "number": "5511999999999",
  "type": "poll",
  "text": "Qual horário prefere para atendimento?",
  "choices": [
    "Manhã (8h-12h)",
    "Tarde (13h-17h)",
    "Noite (18h-22h)"
  ],
  "selectableCount": 1
}
```

**Campos:**
- `type`: `"poll"` (obrigatório)
- `text`: Pergunta da enquete (obrigatório)
- `choices`: Array de opções (obrigatório, max ~12 opções)
- `selectableCount`: Quantas opções podem ser seleccionadas (default: 1)

**Campos opcionais comuns:** `delay`, `readchat`, `readmessages`, `replyid`, `track_source`, `track_id`

### 3.2 Enviar Contacto — `POST /send/contact`

```json
{
  "number": "5511999999999",
  "fullName": "João Silva",
  "phoneNumber": "5511999999999,5511888888888",
  "organization": "Empresa XYZ",
  "email": "joao.silva@empresa.com",
  "url": "https://empresa.com/joao"
}
```

**Campos obrigatórios:** `number`, `fullName`, `phoneNumber`
**Campos opcionais:** `organization`, `email`, `url`, `replyid`, `delay`, `readchat`, `track_source`, `track_id`

### 3.3 Enviar Áudio — `POST /send/media`

Já implementado. Tipos disponíveis:

| type | Descrição |
|------|-----------|
| `audio` | Áudio comum (MP3/OGG) — ícone de ficheiro |
| `ptt` | Mensagem de voz (Push-to-Talk) — bolha verde, waveform |
| `myaudio` | Alternativa ao PTT |
| `ptv` | Vídeo circular (Push-to-Video) |

```json
{
  "number": "5511999999999",
  "type": "ptt",
  "file": "https://example.com/audio.ogg"
}
```

### 3.4 Catálogo — Endpoints `/business/catalog/*`

> ⚠️ **EXPERIMENTAL** — "Endpoints ainda não testados completamente. Podem não funcionar como esperado."
> Requer: Conta WhatsApp Business.

| Endpoint | Método | Descrição | Body |
|----------|--------|-----------|------|
| `/business/catalog/list` | POST | Listar produtos | `{ "jid": "55...@s.whatsapp.net" }` |
| `/business/catalog/info` | POST | Info de produto | `{ "jid": "...", "id": "product_id" }` |
| `/business/catalog/delete` | POST | Eliminar produto | `{ "id": "product_id" }` |
| `/business/catalog/show` | POST | Mostrar produto | `{ "id": "product_id" }` |
| `/business/catalog/hide` | POST | Ocultar produto | `{ "id": "product_id" }` |

**Resposta de listagem:**
```json
{
  "response": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "price": "string",
      "currency": "string"
    }
  ]
}
```

### 3.5 Receber Mensagens — Webhook (Schema `Message`)

Campos relevantes para novos tipos na mensagem recebida:

```yaml
vote: "Dados de votação de enquete e listas"
convertOptions: "Conversão de opções da mensagem, lista, enquete e botões"
buttonOrListid: "ID do botão ou item de lista selecionado"
content: "Conteúdo bruto da mensagem (JSON serializado ou texto)"
# content contém os dados estruturados de poll/contact/etc.
```

**Tipos de mensagem normalizados pelo webhook:**
```typescript
const map = {
  PollCreationMessage: "poll",    // Criação de enquete
  ContactMessage: "contact",      // Contacto individual
  ContactsArrayMessage: "contact", // Múltiplos contactos
  // ... (já mapeados no código actual)
}
```

O campo `vote` contém string com dados de votação quando um utilizador vota numa enquete.
O campo `content` (JSON) contém dados estruturados: `pollCreationMessage` com opções, ou `contactMessage` com vCard.

---

## 4. Padrões de Implementação Existentes no Codebase

### 4.1 Padrão: Renderizar Tipo de Mensagem (switch case)

**Arquivo:** [`components/whatsapp/message-media-renderer.tsx:146-276`](components/whatsapp/message-media-renderer.tsx#L146-L276)

```tsx
// Padrão actual — cada tipo é um case no switch
switch (message.message_type) {
  case 'image':
    // ... renderizar imagem
  case 'video':
    // ... renderizar vídeo
  case 'audio':
    // ... AudioPlayer
  case 'document':
    // ... DocIcon + download
  case 'location':
    // ... MapPin + Google Maps link
  case 'contact':
    // ... User icon + texto (BÁSICO — a melhorar)
    return (
      <div className="flex items-center gap-2 p-2 mb-1 rounded bg-muted/50">
        <User className="h-5 w-5 text-muted-foreground" />
        <span className="text-sm">{message.text || 'Contacto'}</span>
      </div>
    )
  default:
    return null
}
```

**Aplicar para:** Adicionar `case 'poll'` com componente `<PollMessage>` e melhorar `case 'contact'` com `<ContactCardMessage>`.

### 4.2 Padrão: Enviar Mensagem (Hook → API → Edge Function → UAZAPI)

**Arquivo:** [`hooks/use-whatsapp-messages.ts:138-191`](hooks/use-whatsapp-messages.ts#L138-L191)

```typescript
// Fluxo padrão de envio:
// 1. Criar mensagem optimista
const optimistic: WppMessage = {
  id: `optimistic-${Date.now()}`,
  chat_id: chatId,
  from_me: true,
  message_type: 'text',  // ← mudar para 'poll' ou 'contact'
  text,
  status: 'sent',
  timestamp: Math.floor(Date.now() / 1000),
  // ... campos null para o resto
}
setMessages((prev) => [...prev, optimistic])

// 2. POST para API
await fetch(`/api/whatsapp/chats/${chatId}/messages`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'send_text', text, reply_id: replyId }),
})
```

**Aplicar para:** Criar `sendPoll()` e `sendContact()` seguindo o mesmo padrão.

### 4.3 Padrão: API Route → Edge Function

**Arquivo:** [`app/api/whatsapp/chats/[chatId]/messages/route.ts:279-324`](app/api/whatsapp/chats/[chatId]/messages/route.ts#L279-L324)

```typescript
// POST handler — delega tudo para Edge Function
const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_KEY}`,
  },
  body: JSON.stringify({
    action: body.action || "send_text",  // ← adicionar 'send_poll', 'send_contact'
    instance_id: chat.instance_id,
    wa_chat_id: chat.wa_chat_id,
    ...body,
  }),
})
```

### 4.4 Padrão: Automation Node → UAZAPI Directo

**Arquivo:** [`lib/node-processors/whatsapp.ts:96-136`](lib/node-processors/whatsapp.ts#L96-L136)

```typescript
if (msg.type === "text") {
  response = await fetch(`${baseUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: instance.uazapi_token },
    body: JSON.stringify({
      number: recipientNumber,
      text: content,
      delay: msg.delay || 2,
      readchat: true,
      track_source: "erp_infinity",
      track_id: flowMeta.runId,
    }),
  })
} else {
  // Media types (image, video, audio, ptt, document)
  response = await fetch(`${baseUrl}/send/media`, { ... })
}
// ← Adicionar: else if (msg.type === "poll") → /send/menu
// ← Adicionar: else if (msg.type === "contact") → /send/contact
```

### 4.5 Padrão: Chat Input — Menu de Anexos

**Arquivo:** [`components/whatsapp/chat-input.tsx:135-155`](components/whatsapp/chat-input.tsx#L135-L155)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon"><Paperclip /></Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start" side="top">
    <DropdownMenuItem onClick={() => handleFileSelect('image/*', 'image')}>
      <Image className="mr-2 h-4 w-4" /> Imagem
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleFileSelect('video/*', 'video')}>
      <Video className="mr-2 h-4 w-4" /> Vídeo
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => handleFileSelect('.pdf,.doc,...', 'document')}>
      <FileText className="mr-2 h-4 w-4" /> Documento
    </DropdownMenuItem>
    {/* ← Adicionar aqui: Enquete, Contacto, Camera */}
  </DropdownMenuContent>
</DropdownMenu>
```

### 4.6 Padrão: Normalizar Tipo de Mensagem Recebida

**Arquivo:** [`app/api/whatsapp/chats/[chatId]/messages/route.ts:12-30`](app/api/whatsapp/chats/[chatId]/messages/route.ts#L12-L30)

```typescript
function normalizeMessageType(uazapiType: string): string {
  const map: Record<string, string> = {
    conversation: "text",
    PollCreationMessage: "poll",      // ← Já mapeado
    ContactMessage: "contact",         // ← Já mapeado
    ContactsArrayMessage: "contact",   // ← Já mapeado
    // ...
  }
  return map[uazapiType] || uazapiType.toLowerCase().replace("message", "") || "text"
}
```

### 4.7 Padrão: Extrair Dados da Mensagem UAZAPI

**Arquivo:** [`app/api/whatsapp/chats/[chatId]/messages/route.ts:100-145`](app/api/whatsapp/chats/[chatId]/messages/route.ts#L100-L145)

```typescript
// Campos já extraídos:
return {
  // ...
  vcard: content.vcard || msg.vcard || null,         // ← contact vCard
  // Para poll, precisamos extrair do content:
  // content.pollCreationMessage?.name  → poll_name
  // content.pollCreationMessage?.options → poll_options
  // content.pollCreationMessage?.selectableOptionsCount → poll_selectable_count
  // msg.vote → poll vote data
}
```

---

## 5. Padrões de Implementação Externos

### 5.1 Poll — Baileys (referência de como o WhatsApp estrutura polls)

```typescript
// Baileys — enviar poll (referência da estrutura interna WhatsApp)
await sock.sendMessage(jid, {
  poll: {
    name: 'Qual horário prefere?',
    values: ['Manhã (8h-12h)', 'Tarde (13h-17h)', 'Noite (18h-22h)'],
    selectableCount: 1,
    toAnnouncementGroup: false
  }
})
```

**Estrutura do PollCreationMessage recebido (conteúdo raw):**
```json
{
  "pollCreationMessage": {
    "name": "Qual horário prefere?",
    "options": [
      { "optionName": "Manhã (8h-12h)" },
      { "optionName": "Tarde (13h-17h)" },
      { "optionName": "Noite (18h-22h)" }
    ],
    "selectableOptionsCount": 1
  }
}
```

**Estrutura do PollUpdateMessage (voto):**
```json
{
  "pollUpdateMessage": {
    "pollCreationMessageKey": { "id": "msg_id_original" },
    "vote": {
      "selectedOptions": [
        { "optionSha256": "hash_da_opcao" }
      ]
    },
    "senderTimestampMs": 1710000000000
  }
}
```

> **Nota:** Os votos são encriptados pelo WhatsApp. A UAZAPI pode ou não devolver os votos desencriptados no campo `vote` da mensagem. O campo `convertOptions` pode conter a conversão legível.

### 5.2 Contact vCard — Formato 3.0

```
BEGIN:VCARD
VERSION:3.0
N:Silva;João;;;
FN:João Silva
ORG:Infinity Group
TEL;TYPE=CELL;waid=351912345678:+351 912 345 678
TEL;TYPE=WORK:+351 213 456 789
EMAIL;TYPE=INTERNET:joao@infinity.pt
URL:https://infinity.pt
END:VCARD
```

**Campos vCard relevantes:**
- `FN` — Nome completo formatado (obrigatório)
- `N` — Nome estruturado: `Apelido;Nome;;;`
- `TEL` — Telefone com type (CELL, WORK, HOME) e `waid=` para link WhatsApp
- `ORG` — Organização
- `EMAIL` — Email
- `URL` — Website

**Parser TypeScript simples:**
```typescript
interface ParsedVCard {
  fullName: string
  phones: { number: string; type: string; waid?: string }[]
  email?: string
  organization?: string
  url?: string
}

function parseVCard(vcard: string): ParsedVCard {
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
```

**Gerador vCard:**
```typescript
function generateVCard(contact: {
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

### 5.3 Poll UI — Padrão de Componente React

Inspirado no Stream Chat SDK e WhatsApp nativo:

```tsx
// Componente PollMessage — renderizar enquete recebida
function PollMessage({ message }: { message: WppMessage }) {
  const pollData = message.poll_data as PollData | null
  if (!pollData) return null

  const totalVotes = pollData.options.reduce((sum, o) => sum + (o.votes || 0), 0)

  return (
    <div className="min-w-[260px] max-w-[320px]">
      {/* Header com ícone */}
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-emerald-600" />
        <span className="text-sm font-medium">Sondagem</span>
      </div>

      {/* Pergunta */}
      <p className="text-sm font-semibold mb-3">{pollData.name}</p>

      {/* Opções com barra de progresso */}
      <div className="space-y-2">
        {pollData.options.map((option, i) => {
          const pct = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
          return (
            <div key={i} className="relative">
              <div
                className="absolute inset-0 rounded bg-emerald-100 dark:bg-emerald-900/30"
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

      {/* Footer */}
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

### 5.4 Camera Capture — Browser API

```tsx
// Componente CameraCapture — capturar foto/vídeo via browser
function CameraCapture({ onCapture, onClose }: {
  onCapture: (file: File, type: 'image' | 'video') => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [mode, setMode] = useState<'photo' | 'video'>('photo')
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    // Solicitar acesso à câmera
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 } },
      audio: mode === 'video',
    }).then(stream => {
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
    })

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [mode])

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

  // ... render video preview + botões
}
```

---

## 6. Estruturas de Dados Propostas

### 6.1 Extensão do `WppMessage` para Poll

```typescript
// Adicionar ao WppMessage ou criar tipo derivado
interface PollData {
  name: string                    // Pergunta
  options: PollOption[]           // Opções
  selectableCount: number         // Máx. opções seleccionáveis
}

interface PollOption {
  name: string                    // Texto da opção
  votes: number                   // Contagem de votos (se disponível)
  voters?: string[]               // JIDs dos votantes (se disponível)
}
```

### 6.2 Extensão do `WppMessage` para Contact

```typescript
interface ContactData {
  fullName: string
  phones: { number: string; type: string; waid?: string }[]
  email?: string
  organization?: string
  url?: string
  rawVCard: string                // vCard original para reenvio
}
```

### 6.3 Novos Payloads UAZAPI

```typescript
// Payload para enviar enquete
interface UazapiSendPollPayload extends UazapiSendPayload {
  type: 'poll'
  text: string                    // Pergunta
  choices: string[]               // Opções
  selectableCount?: number        // Default: 1
}

// Payload para enviar contacto
interface UazapiSendContactPayload extends UazapiSendPayload {
  fullName: string
  phoneNumber: string             // Separados por vírgula se múltiplos
  organization?: string
  email?: string
  url?: string
}

// Payload para catálogo
interface CatalogProduct {
  id: string
  name: string
  description: string
  price: string
  currency: string
}
```

---

## 7. Plano de Implementação por Prioridade

### Fase A — Enquete (Poll) ⭐ Alta prioridade

1. **Types**: Adicionar `PollData`, `PollOption` a `whatsapp-web.ts`
2. **Webhook parsing**: Extrair `pollCreationMessage` do `content` raw → `poll_data`
3. **UI Renderizar**: `poll-message.tsx` — opções com barras de progresso
4. **UI Criar**: `poll-creator.tsx` — dialog com pergunta + opções dinâmicas
5. **Hook**: `sendPoll()` em `use-whatsapp-messages.ts`
6. **API**: Suportar `action: 'send_poll'` → delegar para Edge Function
7. **Edge Function**: Chamar UAZAPI `/send/menu` com `type: 'poll'`
8. **Automation**: Handler `poll` em `whatsapp.ts` node processor
9. **Chat Input**: Botão "Sondagem" no menu de anexos

### Fase B — Contacto (vCard) ⭐ Alta prioridade

1. **Utils**: `parseVCard()` e `generateVCard()` em `lib/utils/vcard.ts`
2. **Webhook parsing**: Extrair vCard do `content.vcard` ou `content.contactMessage`
3. **UI Renderizar**: `contact-card-message.tsx` — card com nome, telefone(s), org, botão "Adicionar"
4. **UI Criar**: `contact-picker.tsx` — seleccionar da lista de contactos WPP ou criar manualmente
5. **Hook**: `sendContact()` em `use-whatsapp-messages.ts`
6. **API**: Suportar `action: 'send_contact'` → Edge Function → UAZAPI `/send/contact`
7. **Automation**: Handler `contact` em node processor
8. **Chat Input**: Botão "Contacto" no menu de anexos

### Fase C — Camera 📷 Média prioridade

1. **UI**: `camera-capture.tsx` — preview de câmera, capturar foto ou gravar vídeo
2. **Chat Input**: Botão "Câmera" no menu de anexos
3. **Envio**: Reutilizar fluxo existente `sendMedia(file, 'image'|'video')`
4. **Sem alterações de API** — usa o mesmo `/send/media` existente

### Fase D — Catálogo 🛒 Baixa prioridade (experimental)

1. **API Routes**: Criar `/api/whatsapp/catalog` para proxy dos endpoints UAZAPI
2. **UI**: Lista de produtos com nome, preço, descrição
3. **Limitações**: Só funciona com WhatsApp Business, endpoints experimentais
4. **Considerar**: Adiar até UAZAPI estabilizar estes endpoints

---

## 8. Tabela de Mapeamento — Coluna DB `wpp_messages`

| Campo DB | Poll | Contact | Camera | Catálogo |
|----------|------|---------|--------|----------|
| `message_type` | `'poll'` | `'contact'` | `'image'`/`'video'` | N/A (produto) |
| `text` | Pergunta | Nome do contacto | Caption | N/A |
| `poll_data` | `{ name, options, selectableCount }` | null | null | null |
| `contact_vcard` | null | vCard string | null | null |
| `media_url` | null | null | URL da foto/vídeo | null |
| `raw_data` | Mensagem UAZAPI completa | Mensagem UAZAPI | Mensagem UAZAPI | N/A |

---

## 9. Referências e Fontes

### Documentação UAZAPI (local)
- [`.temp/documentação-uazpi.yaml`](.temp/documentação-uazpi.yaml) — OpenAPI spec completa

### Fontes Externas
- [Baileys — WhatsApp Web API (TypeScript)](https://github.com/WhiskeySockets/Baileys) — Referência de estrutura de mensagens poll/contact
- [whatsapp-web.js — Poll structures](https://docs.wwebjs.dev/structures_Poll.js.html) — Estrutura do Poll
- [vCard 3.0 Format Specification](https://www.evenx.com/vcard-3-0-format-specification) — Spec completa vCard
- [RFC 6350 — vCard Format](https://datatracker.ietf.org/doc/html/rfc6350) — RFC oficial
- [Stream Chat SDK — Poll Components](https://getstream.io/chat/docs/sdk/react/components/message-components/poll/) — Referência UI para polls em React
- [WPPConnect — vCard utilities](https://github.com/wppconnect-team/wa-js/blob/main/src/whatsapp/misc/VCard.ts) — Parser vCard TypeScript
- [Web Audio API — Voice Recorder in React](https://medium.com/call-center-studio/engineering-a-seamless-voice-recorder-in-react-overcoming-browser-protocol-limitations-811bb2ad7453) — Padrões de gravação áudio
- [WhatsApp Catalog API Guide](https://www.interakt.shop/whatsapp-business-api/product-catalog-whatsapp-api/) — Visão geral catálogo
