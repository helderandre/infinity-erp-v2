
# PROMPT PARA CLAUDE CODE — Integração Email Profissional RE/MAX

## 🎯 OBJETIVO

Implementar um módulo completo de **Email Profissional** no ERP Infinity que permita aos consultores RE/MAX enviar e receber emails processuais usando as suas contas de email RE/MAX (`@remax.pt`) via protocolo SMTP/IMAP direto no servidor `mail.sooma.com`.

O sistema já possui um **email builder** e **templates de email** implementados. Esta integração deve conectar-se a essa infraestrutura existente, adicionando:

1. Configuração e verificação de conta de email por consultor
2. Envio de emails processuais via SMTP direto (servidor RE/MAX)
3. Caixa de entrada com leitura IMAP (ler, responder, ver anexos, navegar entre pastas)
4. Vinculação de emails a processos do ERP

---

## 📋 INSTRUÇÕES CRÍTICAS

### Antes de qualquer código:

1. **Lê os documentos de referência** linkados abaixo para entender a arquitetura existente
2. **Verifica a estrutura atual** do projeto — faz `find` nos diretórios relevantes para entender o que já existe (email builder, templates, componentes, etc.)
3. **NÃO cries tabelas desnecessárias** — verifica primeiro o que já existe no schema com `npx supabase db dump` ou consultando as migrations existentes
4. **Verifica cada passo** — após implementar backend, testa antes de avançar para o frontend

### Metodologia de trabalho:

- Implementa **um módulo de cada vez**, seguindo a ordem das specs
- Após cada módulo: **verifica que funciona** (backend + frontend) antes de avançar
- Cria **migrations incrementais** — uma por módulo, não uma migration gigante
- Usa **TypeScript strict** em todo o código
- Segue os padrões do projeto (shadcn/ui, Tailwind, etc.)

---

## 🔌 DADOS TÉCNICOS DE CONEXÃO

```
Servidor: mail.sooma.com

ENVIO (SMTP):
  Host: mail.sooma.com
  Porta: 465
  Encriptação: SSL/TLS (obrigatória)
  Autenticação: email completo + senha

RECEPÇÃO (IMAP):
  Host: mail.sooma.com
  Porta: 993
  Encriptação: SSL (obrigatória)
  Autenticação: email completo + senha

Utilizador: [email completo do consultor, ex: nome@remax.pt]
Password: [definida pelo consultor]
```

> ⚠️ O sistema atual usa **Resend** para emails gerais/transacionais. Esta integração é **complementar** — usada para emails processuais que precisam sair do email pessoal do consultor RE/MAX. O Resend continua a funcionar para os envios gerais do sistema.

---

## 📦 SPECS POR MÓDULO

Implementa na ordem. Cada módulo tem: objetivo, migrations, paths de ficheiros afetados, e critérios de verificação.

---

### MÓDULO 1 — Schema e Infraestrutura de Base de Dados

**Objetivo:** Criar as tabelas necessárias para armazenar contas de email, mensagens e anexos. Encriptação de senhas via pgcrypto.

**Antes de começar:**
- Verifica as tabelas existentes: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
- Verifica se `pgcrypto` já está habilitado: `SELECT * FROM pg_extension WHERE extname = 'pgcrypto';`
- Verifica se já existe alguma tabela de email ou comunicação que possa ser reutilizada

**Migration: `add_email_accounts_and_messages`**

```sql
-- Habilitar pgcrypto se não existir
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Contas de email dos consultores
CREATE TABLE IF NOT EXISTS consultant_email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email_address TEXT NOT NULL,
  display_name TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  -- Servidor (defaults para RE/MAX Sooma)
  smtp_host TEXT NOT NULL DEFAULT 'mail.sooma.com',
  smtp_port INTEGER NOT NULL DEFAULT 465,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  imap_host TEXT NOT NULL DEFAULT 'mail.sooma.com',
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT true,
  -- Estado
  is_verified BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(consultant_id),
  UNIQUE(email_address)
);

-- Mensagens de email
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES consultant_email_accounts(id),
  process_id UUID, -- FK para a tabela de processos (verificar nome real)
  process_type TEXT,
  message_id TEXT UNIQUE,
  in_reply_to TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','failed','received')),
  from_address TEXT NOT NULL,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[] DEFAULT '{}',
  bcc_addresses TEXT[] DEFAULT '{}',
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT,
  body_html TEXT,
  imap_uid INTEGER,
  imap_folder TEXT DEFAULT 'INBOX',
  is_read BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  error_message TEXT
);

-- Anexos
CREATE TABLE IF NOT EXISTS email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_email_messages_account ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_process ON email_messages(process_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_attachments_message ON email_attachments(message_id);

-- Funções de encriptação
CREATE OR REPLACE FUNCTION encrypt_email_password(p_password TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(p_password, p_key), 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_email_password(p_encrypted TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(p_encrypted, 'base64'), p_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

```

**Verificação:**
- [ ] Tabelas criadas sem erros
- [ ] pgcrypto funcional: `SELECT encrypt_email_password('test123', 'mykey');`
- [ ] RLS ativo em todas as tabelas
- [ ] Bucket `email-attachments` criado no Storage

**Paths afetados:**
```
supabase/migrations/YYYYMMDD_add_email_accounts_and_messages.sql
src/types/database.ts  (regenerar tipos se usar supabase gen types)
```

---

### MÓDULO 2 — Verificação e Configuração de Conta

**Objetivo:** Edge Function que valida credenciais SMTP/IMAP e página de configuração no frontend.

**Backend — Edge Function `verify-email-account`:**
- Recebe `{ emailAddress, password, displayName }`
- Testa conexão IMAP (mail.sooma.com:993 SSL)
- Testa conexão SMTP (mail.sooma.com:465 SSL/TLS)
- Se ambos OK: encripta a senha e guarda na tabela
- Retorna sucesso/erro detalhado

**Frontend — Página/Modal de configuração:**
- Formulário com campos: Email RE/MAX, Senha, Nome de exibição
- Botão "Verificar e Guardar" que chama a Edge Function
- Indicador de estado (não configurado / verificando / verificado / erro)
- Usar componentes shadcn/ui existentes (Input, Button, Card, Alert)

**Verificação:**
- [ ] Edge Function responde corretamente com credenciais válidas
- [ ] Edge Function retorna erro claro com credenciais inválidas
- [ ] Senha é guardada encriptada (verificar na BD que não está em plain text)
- [ ] UI mostra estados corretos
- [ ] Após configuração, `is_verified = true` na tabela

**Paths afetados:**
```
supabase/functions/verify-email-account/index.ts
src/app/(dashboard)/settings/email/page.tsx     (ou modal — verificar estrutura)
src/components/email/account-setup-form.tsx
src/lib/email/types.ts
```

---

### MÓDULO 3 — Envio de Email via SMTP

**Objetivo:** Edge Function de envio e integração com o email builder/templates existentes.

**Backend — Edge Function `send-remax-email`:**
- Autenticação via JWT do Supabase
- Busca credenciais encriptadas do consultor
- Desencripta senha via `decrypt_email_password`
- Conecta ao SMTP `mail.sooma.com:465` com SSL
- Envia email com suporte a: HTML body, text fallback, anexos, CC/BCC
- Regista na tabela `email_messages` com `direction: 'outbound'`
- Vincula ao processo se `processId` fornecido

**Frontend — Integração com email builder existente:**
- Verificar como o email builder atual funciona e onde está localizado
- Adicionar opção de "Enviar como [consultor@remax.pt]" quando o consultor tem conta configurada
- Fallback para Resend se não tiver conta SMTP configurada
- Feedback visual de envio (loading, sucesso, erro)

**Verificação:**
- [ ] Email chega ao destinatário com remetente correto (@remax.pt)
- [ ] Headers corretos (From, Reply-To, Message-ID)
- [ ] Anexos funcionam
- [ ] Mensagem registada na BD
- [ ] Aparece na pasta Enviados do Outlook/Webmail do consultor

**Paths afetados:**
```
supabase/functions/send-remax-email/index.ts
src/lib/email/send-email.ts                    (ou adaptar o existente)
src/components/email/compose-email.tsx          (verificar componente existente)
src/hooks/use-send-email.ts                     (ou adaptar hook existente)
```

---

### MÓDULO 4 — Caixa de Entrada IMAP

**Objetivo:** Leitura de emails via IMAP com UI de caixa de entrada integrada no ERP.

**Backend — Edge Function `sync-remax-inbox`:**
- Ações suportadas: `list`, `fetch`, `mark_read`, `list_folders`
- `list` — buscar headers + flags dos emails recentes (envelope, flags, bodyStructure)
- `fetch` — buscar corpo completo + extrair anexos (guardar no Storage)
- `mark_read` — marcar como lido via IMAP (flag \Seen)
- `list_folders` — listar todas as pastas IMAP disponíveis
- Guardar mensagens recebidas na tabela `email_messages`

**Frontend — Componentes da caixa de entrada:**
- Lista de mensagens com: remetente, assunto, data, indicador lido/não lido, ícone de anexo
- Painel lateral de pastas (INBOX, Enviados, Rascunhos, etc.)
- Vista de leitura de mensagem (HTML renderizado de forma segura)
- Lista de anexos com download
- Botão de responder (abre o composer com `in_reply_to` preenchido)
- Paginação ou scroll infinito
- Pull-to-refresh / botão de sincronizar

**Verificação:**
- [ ] Lista de mensagens carrega corretamente
- [ ] Abertura de mensagem mostra conteúdo HTML corretamente
- [ ] Anexos são listados e fazem download
- [ ] Marcar como lido sincroniza com o servidor IMAP
- [ ] Navegação entre pastas funciona
- [ ] Responder a um email funciona (usa o composer do Módulo 3)

**Paths afetados:**
```
supabase/functions/sync-remax-inbox/index.ts
src/app/(dashboard)/email/page.tsx
src/components/email/inbox/message-list.tsx
src/components/email/inbox/message-view.tsx
src/components/email/inbox/folder-sidebar.tsx
src/components/email/inbox/attachment-list.tsx
src/hooks/use-email-inbox.ts
src/lib/email/types.ts                         (expandir tipos)
```

---

### MÓDULO 5 — Vinculação a Processos

**Objetivo:** Associar emails enviados/recebidos a processos do ERP (listagens, transações, leads).

**Frontend:**
- Na vista de processo, tab/secção de "Emails" mostrando histórico
- Ao compor email a partir de um processo, vincular automaticamente
- Possibilidade de vincular manualmente um email existente a um processo
- Timeline de comunicação por processo

**Verificação:**
- [ ] Emails aparecem no contexto do processo correto
- [ ] Vinculação automática ao enviar de dentro de um processo
- [ ] Vinculação manual funciona
- [ ] Timeline ordenada cronologicamente

**Paths afetados:**
```
src/components/email/process-email-history.tsx
src/components/processes/[processId]/emails-tab.tsx  (verificar estrutura)
src/hooks/use-process-emails.ts
```

---

## 🔧 CONTEXTO TÉCNICO DO PROJETO

```
Framework: Next.js 16 + TypeScript (strict)
Backend: Supabase (Edge Functions em Deno/TypeScript)
UI: shadcn/ui + Tailwind CSS
Deploy: Coolify (app.infinitygroup.pt)
Projeto Supabase: umlndumjfamfsswwjgoo
Email transacional existente: Resend (manter para emails do sistema)
```

### Bibliotecas recomendadas:
- **SMTP (Deno):** `denomailer` — para Edge Functions
- **IMAP (Deno):** avaliar `deno-imap` ou alternativa disponível
- **MIME parsing:** `postal-mime` (funciona em Deno)
- **HTML sanitize (frontend):** `DOMPurify` para renderizar HTML de emails de forma segura

> **Nota:** Se as bibliotecas IMAP para Deno forem insuficientes, considerar implementar a parte IMAP como **API Route do Next.js** (Node.js) usando `imapflow` + `mailparser`, que são mais maduras. Nesse caso, documentar a decisão e ajustar os paths.

---

## 📂 DOCUMENTOS DE REFERÊNCIA

Antes de iniciar, lê estes ficheiros para entender o contexto completo:

# Schema atual
Verificar: supabase MCP
```

---

## ⚡ VARIÁVEIS DE AMBIENTE NECESSÁRIAS

Adicionar ao Supabase (secrets das Edge Functions):
```
ENCRYPTION_KEY=<chave-forte-32-chars-minimo>
```

As seguintes já existem:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## 🚫 O QUE NÃO FAZER

- **NÃO criar tabelas que já existem** — verifica primeiro
- **NÃO substituir o Resend** — esta integração é complementar
- **NÃO guardar senhas em plain text** — sempre encriptadas via pgcrypto
- **NÃO avançar para o próximo módulo** sem verificar que o atual funciona
- **NÃO criar componentes do zero** se já existir algo similar — adaptar/estender
- **NÃO fazer migrations destrutivas** — sempre `IF NOT EXISTS` e `IF EXISTS`
- **NÃO hardcodar** dados do servidor — usar os defaults na tabela mas permitir override
