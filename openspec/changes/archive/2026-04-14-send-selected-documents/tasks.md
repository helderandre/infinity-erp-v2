## 1. Backend — endpoint de recipients

- [x] 1.1 Criar `app/api/documents/send/recipients/route.ts` com `GET` que aceita `?domain=properties|processes&entityId=<id>` e autentica via Supabase server client.
- [x] 1.2 Implementar lookup para `domain = 'properties'`: ler `dev_properties.consultant_id` e `property_owners → owners` do imóvel.
- [x] 1.3 Implementar lookup para `domain = 'processes'`: ler `proc_instances.property_id` e reutilizar a rotina de properties.
- [x] 1.4 Juntar dados do consultor: email primário via `consultant_email_accounts` (pegar a conta activa mais recente) + `phone_commercial` de `dev_consultant_profiles`.
- [x] 1.5 Devolver `{ consultant: {id,label,email?,phone?}, owners: [{id,label,email?,phone?, isMain}] }` com permissão verificada (auth obrigatória via `requireAuth`; per-entity check delegado ao mesmo padrão de admin client usado nos detalhes — ver Open Question).
- [x] 1.6 Retornar `404` se entidade não existe; `401` via `requireAuth` se não autenticado.

## 2. Backend — endpoint de envio

- [x] 2.1 Criar `app/api/documents/send/route.ts` com `POST` validando payload com Zod (schema para `domain`, `entityId`, `files[]`, `email?`, `whatsapp?`).
- [x] 2.2 Validar que pelo menos um canal (email/whatsapp) está presente; caso contrário devolver `400 { error: 'Nenhum canal seleccionado' }`.
- [x] 2.3 Validar ownership de `email.account_id` via `resolveEmailAccount` (delega o check de admin/consultant_id).
- [x] 2.4 Validar ownership de `whatsapp.instance_id` contra `auto_wpp_instances.user_id = auth.user.id` (ou WHATSAPP_ADMIN_ROLES); `403` se falhar.
- [x] 2.5 Implementar envio de Email: chamada directa à Edge Function `smtp-send` com `attachments` em base64 (download server-side dos URLs R2 uma vez, reutilizado por todos os destinatários).
- [x] 2.6 Implementar envio de WhatsApp: para cada recipient, resolver chat na instância escolhida (helper interno — não reutiliza `/api/whatsapp/resolve-chat` porque este auto-pica instância); `send_text` (se `message`) + `send_media` por ficheiro via Edge Function `whatsapp-messaging`.
- [x] 2.7 Concorrência via `pLimit(3)` para emails e `pLimit(2)` para WhatsApp (helper inline `lib/concurrency.ts`, sem nova dependência); falhas individuais não abortam o batch.
- [x] 2.8 Devolver `200 { results: [{channel, to, status:'success'|'failed', error?}], attempted, succeeded }`.
- [x] 2.9 Registar em `log_audit` 1 entrada agregada com `action = 'documents.send'`, `entity_type` (property/process), `entity_id`, `new_data` com canais, files e results.
- [ ] 2.10 Testes automatizados: pendente (validação manual em QA section).

## 3. Frontend — `BatchActionBar` + `DocumentsGrid`

- [x] 3.1 Em `components/documents/batch-action-bar.tsx`: adicionada prop opcional `onSend?: () => void`.
- [x] 3.2 Quando `onSend` ausente, botão "Enviar" não é renderizado.
- [x] 3.3 Quando `onSend` presente e `totalFiles === 0`, botão renderizado disabled com `Tooltip` PT-PT `"Selecção sem ficheiros"`.
- [x] 3.4 Quando `onSend` presente e `totalFiles > 0`, botão habilitado; onClick invoca `onSend()` (o container já tem acesso a `selectedFolders`).
- [x] 3.5 `DocumentsGrid` não precisa de mudança — `BatchActionBar` é renderizado directamente pelos containers, não por dentro do grid (arquitectura confirmada via inspecção).
- [x] 3.6 `lead-documents-folders-view.tsx` e `negocio-documents-folders-view.tsx` continuam sem passar `onSend` (não foram modificados).

## 4. Frontend — `SendDocumentsDialog`

- [x] 4.1 Criado `components/documents/send-documents-dialog.tsx` como client component com props `{ open, onOpenChange, domain, entityId, folders, onSuccess? }`.
- [x] 4.2 Hook `useSendDocuments` faz fetch a `/api/documents/send/recipients?domain=...&entityId=...` ao abrir.
- [x] 4.3 Fetch em paralelo de `/api/email/account` e `/api/whatsapp/instances` (este último criado nesta change).
- [x] 4.4 Layout: header com título "Enviar documentos", corpo com dois blocos (Email / WhatsApp) com toggle on/off, rodapé com botão "Enviar".
- [x] 4.5 Bloco Email:
  - [x] 4.5.1 Selector de conta (read-only se 1, `Select` se ≥2, desabilitado + CTA se 0).
  - [x] 4.5.2 Lista de destinatários (Consultor + Proprietários pré-marcados) com checkboxes + chips ad-hoc (Input com validação regex e Enter para adicionar).
  - [x] 4.5.3 Input "Assunto" obrigatório pré-preenchido com ref. do imóvel/processo.
  - [x] 4.5.4 Textarea "Corpo" obrigatório pré-preenchido com template PT-PT listando as pastas.
  - [x] 4.5.5 Info de attachments: total de ficheiros + tamanho agregado; aviso visual + `toast.warning` se >25 MB.
- [x] 4.6 Bloco WhatsApp:
  - [x] 4.6.1 Selector de instância (read-only se 1, `Select` se ≥2, desabilitado + CTA se 0).
  - [x] 4.6.2 Lista de destinatários (Consultor + Proprietários com telefone pré-marcados; sem telefone aparecem disabled com tooltip) + chips ad-hoc com normalização E.164.
  - [x] 4.6.3 Textarea opcional "Mensagem" pré-preenchida com template PT-PT.
- [x] 4.7 Sub-componente `SendProgressList`: linhas destinatário × canal com ícones `pending / sending / success / failed` e mensagem de erro em hover (Tooltip).
- [x] 4.8 Submissão: payload construído e POST a `/api/documents/send`; estado `sending` durante a chamada; resposta mapeada para resultados finais.
- [x] 4.9 Botão "Tentar novamente" habilitado quando há `failed`; reenvia payload filtrado apenas aos destinatários falhados.
- [x] 4.10 Ao terminar com 0 falhas, dispara `onSuccess()` (container fecha o diálogo + limpa selecção).

## 5. Integração nos containers

- [x] 5.1 `components/properties/property-documents-folders-view.tsx`: adicionado estado `sendOpen` e dialog pendurado com `selectedFolders`.
- [x] 5.2 `BatchActionBar` agora recebe `onSend={() => setSendOpen(true)}`.
- [x] 5.3 `components/processes/process-documents-manager.tsx`: mesmo padrão com `domain='processes'`.
- [x] 5.4 `property-documents-root.tsx` propaga automaticamente — só mounta `PropertyDocumentsFoldersView` quando está no modo "Pastas".
- [x] 5.5 `lead-documents-folders-view.tsx` e `negocio-documents-folders-view.tsx` não foram tocados — botão "Enviar" permanece oculto por ausência de `onSend`.

## 6. Hooks e utilitários

- [x] 6.1 Criado `hooks/use-send-documents.ts` que encapsula fetch de recipients/contas/instâncias, estado `results`, `isSending` e POST a `/api/documents/send`.
- [x] 6.2 Criado `lib/documents/send-defaults.ts` com `buildDefaultSubject`, `buildDefaultEmailBody` e `buildDefaultWhatsappMessage` (PT-PT).
- [x] 6.3 Criado `lib/documents/phone.ts` com `normalizeToE164`, `isValidE164` e `formatE164ForDisplay`.
- [x] 6.4 Criado `lib/documents/email-validate.ts` com `isValidEmail`.

## 7. QA manual e polish

- [ ] 7.1 Smoke test em `dev`: enviar só Email (1 dest), só WhatsApp (1 dest), ambos (2 dest cada), com 3 ficheiros.
- [ ] 7.2 Testar selecção com 0 ficheiros (todas as pastas vazias) → botão "Enviar" disabled com tooltip.
- [ ] 7.3 Testar utilizador com 2 contas SMTP e 2 instâncias WhatsApp → obriga selecção antes de submeter.
- [ ] 7.4 Testar utilizador sem contas/instâncias → canais disabled + CTA.
- [ ] 7.5 Testar falha SMTP simulada (endereço inválido) → resposta mostra `failed`, retry só repete o falhado.
- [ ] 7.6 Verificar registo em `log_audit` após envio bem-sucedido.
- [ ] 7.7 Acessibilidade: labels nos inputs, foco inicial no primeiro campo, Esc fecha o diálogo, Enter no campo ad-hoc adiciona chip.
- [ ] 7.8 Responsive: diálogo utilizável em viewport mobile (sheet bottom em <768px).
- [x] 7.9 Copy PT-PT verificado em todas as strings novas (`labels.send.*`).
