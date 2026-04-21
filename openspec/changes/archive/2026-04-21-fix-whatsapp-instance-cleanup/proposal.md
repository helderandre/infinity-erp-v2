## Why

Hoje, ao **eliminar** uma instância WhatsApp pelo painel `/dashboard/automacao/instancias`, os dados associados (chats, mensagens, contactos, labels, media, sessões de actividade, mensagens agendadas) permanecem no banco porque as foreign keys que ligam `wpp_*` a `auto_wpp_instances` não estão com `ON DELETE CASCADE` — o `DELETE` da instância apaga apenas a linha em `auto_wpp_instances` (já suportado porque apenas `wpp_debug_log` foi ajustado em `20260425_wpp_debug_log_cascade.sql`) enquanto todos os outros registos ficam órfãos com `instance_id` inválido. Isto contradiz a expectativa do consultor ("eliminar é irreversível e apaga tudo") e mantém PII de contactos/conversas indefinidamente.

Separadamente, a página `/dashboard/whatsapp/contactos` lista `auto_wpp_instances` sem filtrar por `user_id`, pelo que qualquer consultor não-admin vê instâncias que não lhe pertencem — quebra a garantia de escopo "cada utilizador só vê a sua instância" já aplicada em `/api/whatsapp/instances`, `/api/automacao/instancias` e `/dashboard/whatsapp`.

## What Changes

- **Migração SQL** que substitui as FKs de `wpp_chats`, `wpp_messages`, `wpp_contacts`, `wpp_labels`, `wpp_message_media`, `wpp_activity_sessions`, `wpp_scheduled_messages` (coluna `instance_id`) para `REFERENCES auto_wpp_instances(id) ON DELETE CASCADE`. As relações internas entre elas (`wpp_messages.chat_id → wpp_chats`, `wpp_message_media.message_id → wpp_messages`, etc.) são actualizadas para `ON DELETE CASCADE` quando ainda não estão.
- **`handleDelete` em `app/api/automacao/instancias/route.ts`** continua a apagar a instância da Uazapi e a desvincular fluxos, mas passa a depender da cascata do Postgres para limpar os dados locais — sem código adicional de `delete()` por tabela. Adiciona-se uma **limpeza best-effort dos objectos R2** indexados via `wpp_message_media.r2_key`/`thumbnail_r2_key` antes do `DELETE` da instância (reutiliza `deleteImageFromR2` / S3Client existente).
- **`handleDisconnect` permanece inalterado** — apenas marca `connection_status = 'disconnected'` e limpa `phone/profile_name/profile_pic_url`. O histórico fica preservado para reconexão futura.
- **Escopo por utilizador na listagem de contactos**: `app/dashboard/whatsapp/contactos/page.tsx` passa a ler roles e filtrar `auto_wpp_instances` por `user_id = auth.user.id` para não-admins (mesmo padrão de `app/dashboard/whatsapp/page.tsx`). A API `/api/whatsapp/instances/[id]/contacts` passa a validar ownership antes de devolver contactos.
- **AlertDialog de confirmação** em `app/dashboard/automacao/instancias/page.tsx` ganha texto que enumera o que vai ser apagado ("todo o histórico de conversas, mensagens e contactos desta instância") para o consultor perceber a diferença face a "Desconectar".
- **Toast de resultado** passa a indicar contagens apagadas (`N conversas, M mensagens, K contactos removidos`) usando valores devolvidos pelo endpoint.

## Capabilities

### New Capabilities
- `whatsapp-instance-management`: Ciclo de vida de uma instância WhatsApp (criar, conectar, desconectar, eliminar, escopo por utilizador, regras de limpeza de dados derivados).

### Modified Capabilities
<!-- Nenhuma spec existente abrange instâncias WhatsApp — é a primeira vez que a capacidade é formalizada. -->

## Impact

- **Código afectado**:
  - `app/api/automacao/instancias/route.ts` — handler `handleDelete` (limpeza R2 + confiar em cascata; remove `delete()` órfãos se tiverem sido adicionados).
  - `app/dashboard/automacao/instancias/page.tsx` — copy do `AlertDialog`, toast de sucesso com contagens.
  - `app/dashboard/whatsapp/contactos/page.tsx` — filtro por `user_id` + leitura de roles.
  - `app/api/whatsapp/instances/[id]/contacts/route.ts` — validação de ownership antes de servir contactos.
  - `hooks/use-whatsapp-instances.ts` — tipo de retorno de `deleteInstance` ganha `deletedCounts` (opcional).
- **Base de dados**:
  - Nova migração `supabase/migrations/YYYYMMDD_wpp_instance_cascade.sql` que altera 7 FKs para `ON DELETE CASCADE`.
  - Tipos regenerados via `supabase gen types` (ou edição manual em `types/database.ts` se não correr o CLI).
- **Dependências externas**: nenhuma nova. Continua a usar Uazapi `DELETE /instance` e S3Client para R2.
- **Segurança/PII**: a mudança **apaga mais** dados — considerar que uma eliminação acidental é irreversível (já documentado no dialog). Sem impacto de RLS: as tabelas `wpp_*` já estão atrás do admin client.
- **Performance**: `DELETE` de instâncias com grande histórico (milhares de mensagens/media) passa a executar cascata longa. Mitigação: envelopar num `BEGIN` e correr fora do pico; documentar no aviso do dialog. Não é necessário batch — o Postgres processa cascatas em single statement com índice em `instance_id`.
- **Não afecta**: webhooks Uazapi, fluxos de automação (continuam com `wpp_instance_id = null` como hoje), roles (reutiliza `WHATSAPP_ADMIN_ROLES`).
