# Edge Function — `send-email`

Envia emails transaccionais via **Resend API**.

---

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/send-email
```

---

## Variáveis de Ambiente Necessárias

| Variável         | Descrição                         |
|------------------|-----------------------------------|
| `RESEND_API_KEY` | Chave de API do Resend (obrigatória) |

Definir no painel do Supabase em **Project Settings → Edge Functions → Secrets**, ou via CLI:

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
```

---

## Headers da Requisição

| Header           | Valor                  |
|------------------|------------------------|
| `Content-Type`   | `application/json`     |

> **Nota:** A autenticação JWT está desactivada (`verify_jwt = false`). Proteger a rota via RLS ou outro mecanismo se necessário.

---

## Request Body

```json
{
  "senderName":     "string (obrigatório)",
  "senderEmail":    "string (obrigatório)",
  "recipientEmail": "string (obrigatório)",
  "cc":             ["string", "..."] ,
  "subject":        "string (obrigatório)",
  "body":           "string HTML (obrigatório)"
}
```

### Campos

| Campo            | Tipo       | Obrigatório | Descrição                                        |
|------------------|------------|-------------|--------------------------------------------------|
| `senderName`     | `string`   | ✅           | Nome que aparece como remetente                  |
| `senderEmail`    | `string`   | ✅           | Email do remetente (deve ser domínio verificado no Resend) |
| `recipientEmail` | `string`   | ✅           | Email do destinatário principal                  |
| `cc`             | `string[]` | ❌           | Lista de emails em cópia (CC). Omitir se vazio   |
| `subject`        | `string`   | ✅           | Assunto do email                                 |
| `body`           | `string`   | ✅           | Corpo do email em HTML                           |

---

## Exemplos

### Email simples

```json
{
  "senderName": "Infinity Group",
  "senderEmail": "noreply@infinitygroup.pt",
  "recipientEmail": "cliente@exemplo.com",
  "subject": "Bem-vindo à Infinity Group",
  "body": "<p>Olá,</p><p>Obrigado por nos contactar.</p>"
}
```

### Email com CC

```json
{
  "senderName": "Ana Silva",
  "senderEmail": "ana.silva@infinitygroup.pt",
  "recipientEmail": "proprietario@exemplo.com",
  "cc": ["backoffice@infinitygroup.pt", "gestora@infinitygroup.pt"],
  "subject": "Documentação do Processo PROC-2026-0042",
  "body": "<p>Exmo. Sr.,</p><p>Em anexo segue a documentação solicitada.</p><p>Com os melhores cumprimentos,<br>Ana Silva</p>"
}
```

---

## Response

### Sucesso — `200 OK`

```json
{
  "success": true,
  "message": "Email enviado com sucesso.",
  "id": "re_123abc456def"
}
```

### Erro — Campos em falta `400 Bad Request`

```json
{
  "error": "Campos obrigatórios em falta.",
  "required": ["senderName", "senderEmail", "recipientEmail", "subject", "body"]
}
```

### Erro — Falha no Resend `4xx/5xx`

```json
{
  "error": "Falha ao enviar email.",
  "resend": {
    "statusCode": 422,
    "message": "The from address does not match a verified domain.",
    "name": "validation_error"
  }
}
```

---

## Deploy

```bash
# Instalar Supabase CLI (se necessário)
npm install -g supabase

# Login
supabase login

# Ligar ao projecto
supabase link --project-ref umlndumjfamfsswwjgoo

# Definir secret
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx

# Deploy da função
supabase functions deploy send-email
```

---

## Teste Local

```bash
# Iniciar ambiente local
supabase start
supabase functions serve send-email --env-file .env.local

# Chamar a função localmente
curl -X POST http://localhost:54321/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "senderName": "Teste",
    "senderEmail": "teste@dominioVerificado.pt",
    "recipientEmail": "destinatario@exemplo.com",
    "subject": "Teste de Email",
    "body": "<p>Email de teste.</p>"
  }'
```

---

## Uso no Frontend (Next.js)

```typescript
async function sendEmail(payload: {
  senderName: string
  senderEmail: string
  recipientEmail: string
  cc?: string[]
  subject: string
  body: string
}) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  )

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error ?? 'Erro ao enviar email')
  }

  return res.json() // { success: true, message: '...', id: '...' }
}
```
