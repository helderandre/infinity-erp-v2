# Desvios da Implementação — SPEC-03-FRONTEND-COMPONENTS

> Data: 2026-03-18

---

## Layout WhatsApp — Sem layout.tsx dedicado

**Spec:** Criar `app/dashboard/whatsapp/layout.tsx` com `<div className="h-full -m-4">{children}</div>` para remover padding.

**Implementação:** Não foi criado `layout.tsx` dedicado. Em vez disso, a rota `/dashboard/whatsapp` foi adicionada ao array `FULL_BLEED_ROUTES` no `app/dashboard/layout.tsx` existente. Este padrão já é usado por `/dashboard/email`, `/dashboard/automacao/fluxos/editor`, etc. O layout full-bleed remove padding automaticamente e configura `overflow-hidden` + `min-h-svh` no SidebarProvider.

**Justificação:** Reutilizar o mecanismo existente evita conflitos de padding e é consistente com as outras páginas full-height do projecto.

---

## Página Server Component — Cast `as any` no Supabase

**Spec:** Usar `createClient` de `@/lib/supabase/server` para query `auto_wpp_instances`.

**Implementação:** Query implementada conforme spec, mas com cast `as any` no cliente Supabase porque a tabela `auto_wpp_instances` tem colunas (`webhook_url`, `webhook_registered_at`) que não existem nos tipos gerados (`types/database.ts`). O mesmo padrão é usado no `app/api/automacao/instancias/route.ts`.

---

## Sidebar — Opção A (dentro de Automações)

**Spec:** Oferece duas opções — Opção A (dentro do grupo Automações) ou Opção B (grupo separado).

**Implementação:** Escolhida **Opção A** — item "WhatsApp Web" adicionado ao `automationItems` antes de "Instâncias WhatsApp". O ícone usado é `MessageCircle` (lucide-react), conforme sugerido.

---

## Emoji Picker — Implementação simples (sem `emoji-picker-react`)

**Spec:** Sugere instalar `emoji-picker-react` para picker completo, ou implementar picker simples.

**Implementação:** Picker simples com grid de 40 emojis comuns usando `<Popover>` shadcn. A dependência `emoji-picker-react` **não foi instalada** para evitar adicionar dependências desnecessárias nesta fase. Pode ser substituído futuramente se necessário.

---

## Search Messages — Acesso directo ao Supabase

**Spec:** Sugere query `wpp_messages` filtrado por `chat_id` e `text.ilike.%search%`.

**Implementação:** O componente `search-messages.tsx` usa o cliente Supabase do browser directamente (via `createClient()`) com `ilike` filter, em vez de criar uma API route dedicada. Isto é mais simples e suficiente dado que a pesquisa é por `chat_id` específico com filtro de texto.

---

## Chat Info Panel — Vinculação ERP simplificada

**Spec:** Referencia `<ErpLinkTags>` de SPEC-04 (que ainda não foi implementada).

**Implementação:** A secção "Vinculação ERP" mostra informação básica de owner/lead do contacto (dados já disponíveis no join de `wpp_contacts`). A integração completa com tags e acções de linking será implementada na SPEC-04.

---

## Chat Thread — Fetch de chat info via API

**Spec:** Não especifica como obter os dados do chat dentro do `ChatThread`.

**Implementação:** O `ChatThread` faz fetch ao endpoint `/api/whatsapp/chats?instance_id=X&limit=50` e procura o chat pelo `chatId`. Esta abordagem reutiliza o endpoint existente. Futuramente pode ser optimizado com um endpoint dedicado GET `/api/whatsapp/chats/[chatId]`.

---

## Dependências — Nenhuma nova instalada

**Spec:** Lista dependências a verificar (`date-fns`, `lucide-react`, shadcn components, `emoji-picker-react`).

**Implementação:** Todas as dependências necessárias já estavam instaladas. `emoji-picker-react` não foi instalado (ver secção acima). Nenhum `npm install` foi necessário.
