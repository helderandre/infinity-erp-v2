# DESVIOS-SPEC-04: Contacts, Owners Integration & Realtime

> Desvios entre a SPEC-04 e a implementacao real

---

## 1. Colunas da tabela `leads` — nomes PT vs EN

**Spec:** Usa `name`, `phone_primary`, `phone_secondary`, `status`, `score`, `source`, `lead_type`, `priority`
**Implementado:** A tabela real usa colunas PT: `nome`, `telemovel`, `telefone`, `estado`, `temperatura`, `origem`, `forma_contacto`

**Impacto:**
- API `erp-data` mapeia PT → EN na resposta para manter a interface frontend consistente
- API `auto-match` usa colunas PT directamente (`telemovel`, `telefone`)
- Queries de join em `chats/route.ts`, `instances/[id]/contacts/route.ts` e `instances/[id]/contacts/[contactId]/route.ts` corrigidas para `lead:leads(id, nome, email, telemovel)`
- Tipo `WppContact.lead` actualizado para `{ id, nome, email, telemovel }`
- `contact-link-dialog.tsx` pesquisa leads por `nome`, `email`, `telemovel` e mapeia para interface EN

---

## 2. Paths dos ficheiros — sem prefixo `src/`

**Spec:** Todos os paths usam `src/app/...`, `src/components/...`
**Implementado:** O projecto nao usa pasta `src/`. Ficheiros criados directamente em `app/`, `components/`, `hooks/`, `lib/`.

---

## 3. Pagina de contactos — server + client split

**Spec:** Um unico ficheiro `page.tsx` com server component + client component inline
**Implementado:** Split em dois ficheiros:
- `app/dashboard/whatsapp/contactos/page.tsx` — Server component (busca instancias)
- `app/dashboard/whatsapp/contactos/contacts-page-client.tsx` — Client component (toda a logica interactiva)

**Motivo:** Manter o padrao do projecto de separar server/client components. Consistente com `app/dashboard/whatsapp/page.tsx`.

---

## 4. Soft delete admins — deteccao de role

**Spec:** Verificar role `Broker/CEO` directamente
**Implementado:** Usa `ADMIN_ROLES` de `lib/auth/roles.ts` que inclui `['admin', 'Broker/CEO']`

**Motivo:** Centralizar definicao de roles admin. Se novos roles admin forem adicionados, funciona automaticamente.

**Fluxo:** `ChatThread` usa `useUser()` + `ADMIN_ROLES` para derivar `isAdmin` e passa como prop para `MessageBubble`.

---

## 5. `chat-info-panel.tsx` — ErpLinkTags + refetch

**Spec:** Renderizar `<ErpLinkTags>` inline
**Implementado:** Adicionado `<ErpLinkTags>` com key-based refresh (`erpKey` state) + `<ContactLinkDialog>` embebido no painel.

Apos vincular/desvincular:
- Re-fetch do chat para actualizar `contact.owner_id`/`contact.lead_id`
- Increment de `erpKey` para forcar re-render do `ErpLinkTags`

---

## 6. Tabela `leads` — campo `score` nao existe

**Spec:** `leads.score` (int, 0-100)
**Implementado:** A tabela real usa `temperatura` (text: low/medium/high/urgent). Nao existe coluna `score`.

Na API `erp-data`, o campo `score` e retornado como `null`. O frontend mostra temperatura/prioridade em vez de score numerico.

---

## 7. Realtime — SQL ja executado

**Spec (item #9):** Executar `ALTER PUBLICATION supabase_realtime ADD TABLE wpp_chats/wpp_messages/wpp_contacts`
**Status:** Ja executado na SPEC-01. Nao repetido.

---

## 8. Cascade delete — verificacao

**Spec (item #11):** Verificar cascade delete ao eliminar instancia
**Status:** Ja implementado e documentado na SPEC-01. A limpeza R2 e feita no handler `handleDelete` de `app/api/automacao/instancias/route.ts` antes do delete da instancia. ON DELETE CASCADE cuida das tabelas.
