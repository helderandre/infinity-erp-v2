# Inventário de Subtarefas — Angariação

> **Última actualização:** 2026-05-02 — post-migration `20260502_split_armazenar_documentos_task`.
> **Objectivo:** base de trabalho para ditar as regras hardcoded uma a uma. À medida que cada rule for implementada, marcar o status e preencher as notas de comportamento.

## Metadados do template

- **ID:** `c8cd3fcb-968f-4e23-9114-f3421cafa745`
- **Nome:** Processo de Angariações
- **Descrição:** Template Oficial
- **Activo:** ✅
- **Criado:** 2026-02-25
- **Total:** 4 stages · 19 tasks · 43 subtasks

## Changelog

- **2026-05-02** — task "Armazenar documentos" dividida em 3 tasks alinhadas com a UI:
  - **"Documentos do Imóvel"** (rename da task existente, FK preservada) — 7 subtasks
  - **"Documentos Pessoa Colectiva"** (nova) — 7 subtasks
  - **"Documentos Pessoa Singular"** (nova) — 5 subtasks
  Total: 19 novas subtasks substituem as 5 antigas. Tasks seguintes no stage 01 foram shiftadas em order_index (Geração CMI agora em order 4, etc.) — os headers "Task 01.X" neste doc mantêm a numeração semântica antiga por legibilidade.

## Como ler este documento

Cada subtarefa inclui:
- **UUID** em `tpl_subtasks` (referência histórica — as linhas em `proc_subtasks` pré-existentes têm este valor no backfill do `subtask_key` legacy)
- **Título actual** (em `tpl_subtasks.title`)
- **Tipo** do config + parâmetros extraídos (`owner_scope`, `person_type_filter`, IDs referenciados)
- **`subtask_key` sugerido** — kebab_case, estável, para usar no registry TS
- **Status no registry novo**: `[x]` implementado / `[ ]` por implementar
- **Notas de comportamento** — campo livre para dires o que a rule tem de fazer ao concluir (envio, AI, payload, validação, etc.)

### Convenções de owner / person_type

| Símbolo | Significado |
|---|---|
| 🟢 `all_owners` | Expande para **uma linha por owner** (`repeatPerOwner: true`) |
| 🔵 `main_contact_only` | Uma única linha, owner = contacto principal |
| ⚪ sem owner_scope | Subtarefa não ligada a owner (ex.: campos de imóvel) |
| 🏠 `singular` | Só para proprietários pessoa singular |
| 🏢 `coletiva` | Só para proprietários pessoa coletiva |
| 👥 `all` | Todos |

---

## Stage 01 — Recolha de documentação
**ID:** `e203caef-885c-48ff-a3df-9017bbe7222f` · `order_index=0`

### Task 01.1 — Enviar e-mail ao cliente com pedido de documento
- **ID:** `7fd6b0b4-7bd1-4fb8-85cd-707b46e14700` · **SLA:** 2 dias · **Mandatory:** ✅
- **Descrição:** Enviar e-mail ao cliente com pedido de documentos para preenchimento do CMI, juntamente com a Ficha de Branqueamento de Capitais (FBC)

#### 01.1.1 Pedido de Documentação
- **UUID:** `cff4c3ac-af4f-454e-951b-f1bbdb0cb178`
- **Tipo:** `email` · 🟢 all_owners · 👥 all (variantes por person_type)
- **Variantes:**
  - 🏠 singular → tpl_email `450c31c0-723d-4d79-8a2a-580e55b4f63f` "Email Pedido de Documentação Singular (cópia)"
  - 🏢 coletiva → tpl_email `1cbdd950-a716-4266-9e18-5087c0864c77` "Email Pedido de Documentação Coletivo"
- **`subtask_key` sugerido:** `email_pedido_documentacao`
- **Registry:** [x] `email-pedido-doc` ✅ (skeleton)
- **Notas:** <!-- ditar: o email é enviado via SMTP do consultor? lê template da biblioteca por person_type e substitui placeholders? tem botão "marcar enviado" vs "enviar automaticamente"? -->

---

### Task 01.2 — Documentos do Imóvel (ex-"Armazenar documentos")
- **ID:** `c51cf081-06cc-4d70-80a9-9e97563cc776` · **Mandatory:** ✅ · **order_index=1**
- **Descrição:** Documentos obrigatórios do imóvel (certificado energético, caderneta predial, certidão permanente, etc.)
- **Nota:** renomeada a 2026-05-02 de "Armazenar documentos" → "Documentos do Imóvel". As 5 tpl_subtasks antigas foram **apagadas** (`proc_subtasks.tpl_subtask_id` fica NULL mas `subtask_key` backfilled com `legacy_tpl_*` preserva identidade dos 15 proc_subtasks existentes). 7 subtasks novas abaixo.

#### 01.2.1 Certificado Energético
- **UUID:** `6ce347d7-83ce-43b1-b5cc-cde0f8f77703`
- **Tipo:** `upload` · ⚪ sem scope · **Mandatory:** ✅
- **doc_type:** `b201aa0e-fa71-4ca7-88d7-1372bd351aa5` "Certificado Energético"
- **`subtask_key`:** `upload_certificado_energetico`
- **Registry:** [x] `upload-certificado-energetico.ts` ✅ (hybrid)

#### 01.2.2 Caderneta Predial Urbana
- **UUID:** `53c3346c-bc4e-4a45-b9d9-ae069661e9b1`
- **Tipo:** `upload` · ⚪ sem scope · **Mandatory:** ✅
- **doc_type:** `5da10e4a-80bb-4f24-93a8-1e9731e20071` "Caderneta Predial Urbana (CPU)"
- **`subtask_key`:** `upload_caderneta_predial_urbana`
- **Registry:** [x] `upload-caderneta-predial-urbana.ts` ✅ (hybrid)

#### 01.2.3 Certidão Permanente
- **UUID:** `e80ebf6f-7add-444d-b890-58923efcf73f`
- **Tipo:** `upload` · ⚪ sem scope · **Mandatory:** ✅
- **doc_type:** `09eac23e-8d32-46f3-9ad8-f579d8d8bf9f` "Certidão Permanente (CRP)"
- **`subtask_key`:** `upload_certidao_permanente`
- **Registry:** [x] `upload-certidao-permanente.ts` ✅ (hybrid)

#### 01.2.4 Licença de Utilização
- **UUID:** `9f2f1ec0-6575-4814-ab57-2bb1b9e7ad09`
- **Tipo:** `upload` · ⚪ sem scope · **Mandatory:** ❌ (condicional)
- **doc_type:** `b326071d-8e8c-43e4-b74b-a377e76b94dc` "Licença de Utilização"
- **Hint:** "Obrigatório para imóveis posteriores a 07 de Agosto de 1951"
- **`subtask_key`:** `upload_licenca_utilizacao`
- **Registry:** [x] `upload-licenca-utilizacao.ts` ✅ (hybrid, `hint`)

#### 01.2.5 Ficha Técnica de Habitação
- **UUID:** `583e1160-9508-45fe-a9da-2023baaea606`
- **Tipo:** `upload` · ⚪ sem scope · **Mandatory:** ❌ (condicional)
- **doc_type:** `f4df68d0-f833-4d18-ad61-f30c699c22d6` "Ficha Técnica de Habitação"
- **Hint:** "Obrigatória para imóveis posteriores a 1 de Abril de 2004"
- **`subtask_key`:** `upload_ficha_tecnica_habitacao`
- **Registry:** [x] `upload-ficha-tecnica-habitacao.ts` ✅ (hybrid, `hint`)

#### 01.2.6 Planta do Imóvel
- **UUID:** `29808967-d884-4502-9d2d-46c540eba9c4`
- **Tipo:** `upload` · ⚪ sem scope · **Mandatory:** ✅
- **doc_type:** `afde278e-3c7e-4214-a779-588778023dc6` "Planta do Imóvel"
- **`subtask_key`:** `upload_planta_imovel`
- **Registry:** [x] `upload-planta-imovel.ts` ✅ (hybrid)

#### 01.2.7 Hipoteca — valor em dívida (se aplicável)
- **UUID:** `fbfd52c0-3563-47d0-92c6-4b2bc76d4cb1`
- **Tipo:** `field` · ⚪ sem scope · **Mandatory:** ❌
- **Campo:** label="Hipoteca em dívida", field_name=`mortgage_balance`, type=`currency`, target=`property_internal`
- **Hint:** "Indicar se existe hipoteca e, em caso afirmativo, valor aproximado em dívida"
- **`subtask_key`:** `field_property_hipoteca_divida`
- **Registry:** [x] `field-property-hipoteca-divida.ts` ✅ (hybrid, `hint`)

---

### Task 01.3 — Documentos Pessoa Colectiva (NOVA — 2026-05-02)
- **ID:** `fff5651a-9335-4d26-a1c8-5e4302c506fb` · **Mandatory:** ✅ · **order_index=2**
- **Descrição:** Documentação específica de proprietários do tipo pessoa colectiva (empresas).
- **Expansão:** todas as subtasks `ownerScope: 'all'` + `personTypeFilter: 'coletiva'` — **1 linha por owner empresa**.

#### 01.3.1 Certidão Comercial da Empresa
- **UUID:** `40643317-ca4e-456d-aa2b-325489c5d9ce`
- **Tipo:** `upload` · 🟢 all_owners · 🏢 coletiva · **Mandatory:** ✅
- **doc_type:** `e433c9f1-b323-43ac-9607-05b31f72bbb9` "Certidão Permanente da Empresa" (sinónimo de "Comercial")
- **Hint:** "Código de acesso válido"
- **`subtask_key`:** `upload_certidao_comercial_empresa`
- **Registry:** [x] `upload-certidao-comercial-empresa.ts` ✅ (hybrid)

#### 01.3.2 RCBE
- **UUID:** `16829ae3-a482-4c12-bed1-ecd0028ac691`
- **Tipo:** `upload` · 🟢 all_owners · 🏢 coletiva · **Mandatory:** ✅
- **doc_type:** `6dd8bf4c-d354-4e0e-8098-eda5a8767fd1` "RCBE"
- **Hint:** "Código de acesso válido"
- **`subtask_key`:** `upload_rcbe`
- **Registry:** [x] `upload-rcbe.ts` ✅ (hybrid)

#### 01.3.3 CC / Passaporte do representante legal
- **UUID:** `9eb0e316-a879-40a9-9d70-1acccbd91627`
- **Tipo:** `upload` · 🟢 all_owners · 🏢 coletiva · **Mandatory:** ✅
- **doc_type:** `16706cb5-1a27-413d-ad75-ec6aee1c3674` "Cartão de Cidadão"
- **`subtask_key`:** `upload_cc_passaporte_representante_legal`
- **Registry:** [x] `upload-cc-passaporte-representante-legal.ts` ✅ (hybrid)

#### 01.3.4 Naturalidade do representante legal
- **UUID:** `6c8ad09c-0b56-4ee6-ba2e-891fd952dff1`
- **Tipo:** `field` · 🟢 all_owners · 🏢 coletiva · **Mandatory:** ✅
- **Campo:** label="Naturalidade do representante legal", field_name=`legal_rep_naturality`, type=`text`, target=`owner`
- **`subtask_key`:** `field_naturalidade_representante_legal`
- **Registry:** [x] `field-naturalidade-representante-legal.ts` ✅ (hybrid)

#### 01.3.5 Morada atual do representante legal
- **UUID:** `8528c0d0-c551-4f59-8a1a-34b19be78f17`
- **Tipo:** `field` · 🟢 all_owners · 🏢 coletiva · **Mandatory:** ✅
- **Campo:** label="Morada atual do representante legal", field_name=`legal_rep_address`, type=`textarea`, target=`owner`
- **`subtask_key`:** `field_morada_representante_legal`
- **Registry:** [x] `field-morada-representante-legal.ts` ✅ (hybrid)

#### 01.3.6 Estado civil do representante legal
- **UUID:** `513d9492-3dc6-4df0-964d-a59443c03eca`
- **Tipo:** `field` · 🟢 all_owners · 🏢 coletiva · **Mandatory:** ✅
- **Campo:** label="Estado civil do representante legal", field_name=`legal_rep_marital_status`, type=`text`, target=`owner`
- **`subtask_key`:** `field_estado_civil_representante_legal`
- **Registry:** [x] `field-estado-civil-representante-legal.ts` ✅ (hybrid)

#### 01.3.7 Ficha de Branqueamento (Empresa)
- **UUID:** `7d7cc165-5a59-486f-8d07-5bfc042407d1`
- **Tipo:** `upload` · 🟢 all_owners · 🏢 coletiva · **Mandatory:** ✅
- **doc_type:** `f9a3ee8f-04a6-40f0-aae0-021ae7c48c6d` "Ficha de Branqueamento (Empresa)"
- **`subtask_key`:** `upload_ficha_branqueamento_empresa`
- **Registry:** [x] `upload-ficha-branqueamento-empresa.ts` ✅ (hybrid)

---

### Task 01.4 — Documentos Pessoa Singular (NOVA — 2026-05-02)
- **ID:** `3b632b79-6da9-4ba5-8a1a-d9e622930cbd` · **Mandatory:** ✅ · **order_index=3**
- **Descrição:** Documentação específica de proprietários do tipo pessoa singular.
- **Expansão:** todas as subtasks `ownerScope: 'all'` + `personTypeFilter: 'singular'` — **1 linha por owner singular**.

#### 01.4.1 Cartão de Cidadão / Passaporte
- **UUID:** `003031a9-dece-47c4-af4d-662329c74adc`
- **Tipo:** `upload` · 🟢 all_owners · 🏠 singular · **Mandatory:** ✅
- **doc_type:** `16706cb5-1a27-413d-ad75-ec6aee1c3674` "Cartão de Cidadão"
- **`subtask_key`:** `upload_cc_passaporte_singular`
- **Registry:** [x] `upload-cc-passaporte-singular.ts` ✅ (hybrid)

#### 01.4.2 Naturalidade (freguesia e concelho)
- **UUID:** `05475f91-3eba-4575-bab6-3e45eddcdccb`
- **Tipo:** `field` · 🟢 all_owners · 🏠 singular · **Mandatory:** ✅
- **Campo:** label="Naturalidade (freguesia e concelho)", field_name=`naturality`, type=`text`, target=`owner`
- **`subtask_key`:** `field_naturalidade_singular`
- **Registry:** [x] `field-naturalidade-singular.ts` ✅ (hybrid)

#### 01.4.3 Morada atual
- **UUID:** `91dffeea-d31a-4a30-af2e-ac56a4558e87`
- **Tipo:** `field` · 🟢 all_owners · 🏠 singular · **Mandatory:** ✅
- **Campo:** label="Morada atual", field_name=`address`, type=`textarea`, target=`owner`
- **`subtask_key`:** `field_morada_atual_singular`
- **Registry:** [x] `field-morada-atual-singular.ts` ✅ (hybrid)

#### 01.4.4 Estado civil
- **UUID:** `0299644f-b790-4570-8b3d-c082cd15819c`
- **Tipo:** `field` · 🟢 all_owners · 🏠 singular · **Mandatory:** ✅
- **Campo:** label="Estado civil", field_name=`marital_status`, type=`text`, target=`owner`
- **`subtask_key`:** `field_estado_civil_singular`
- **Registry:** [x] `field-estado-civil-singular.ts` ✅ (hybrid)

#### 01.4.5 Ficha de Branqueamento de Capitais
- **UUID:** `499302c0-954a-4d5e-91c6-ae464768e98c`
- **Tipo:** `upload` · 🟢 all_owners · 🏠 singular · **Mandatory:** ✅
- **doc_type:** `02b63b46-d5ed-4314-9e83-1447095f8a15` "Ficha de Branqueamento de Capitais"
- **Hint:** "Uma por proprietário, mesmo em caso de casados"
- **`subtask_key`:** `upload_ficha_branqueamento_capitais_singular`
- **Registry:** [x] `upload-ficha-branqueamento-capitais-singular.ts` ✅ (hybrid)

---

> **Nota:** as secções seguintes mantêm numeração antiga (01.3, 01.4, etc.) por continuidade de leitura. No template DB actual, Geração do CMI está em order_index=4, Enviar CMI em 5, Agendamento em 6, Recolha em 7, Confirmação em 8, Digitalizar em 9.

---

### Task 01.3 — Geração do CMI
- **ID:** `ff51ce46-bf5c-49fd-a285-ea3bcb97894f` · **Mandatory:** ✅
- **Alertas:** on_unblock → Email + WhatsApp + Notificação para role "Gestora Processual" (mensagem: "A tarefa {title} foi desbloqueada e está pronta para ser iniciada")

#### 01.3.1 Gerar CMI
- **UUID:** `3ac7e230-9459-46e1-ac06-1c02ada73fe3`
- **Tipo:** `generate_doc` · 🔵 main_contact_only · 👥 all · **Mandatory:** ✅
- **doc_library:** `9223bdfc-31a0-4918-b5ee-580760ba8b32` "CMI"
- **`subtask_key` sugerido:** `gerar_cmi`
- **Registry:** [x] `geracao-cmi` ✅ (skeleton — confirmar se a key bate)
- **Notas:** <!-- ditar: substituir placeholders a partir de que fonte? permite edição antes de finalizar? gera PDF + guarda em doc_registry? -->

#### 01.3.2 Verificar CMI
- **UUID:** `bd8850f3-5937-419d-a751-46a044e30755`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- **`subtask_key` sugerido:** `verificar_cmi`
- **Registry:** [x] `verificar-cmi.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: o que é verificado? campos específicos? abre preview do CMI gerado? -->

---

### Task 01.4 — Enviar CMI ao proprietário
- **ID:** `4b525d35-929a-4325-bdb6-d73b3933448d` · **Mandatory:** ❌ (optional)

#### 01.4.1 Envio de Email CMI
- **UUID:** `4b63440b-57ea-4eed-9403-a0baf62a8391`
- **Tipo:** `email` · 🔵 main_contact_only · 👥 all · **Mandatory:** ✅
- **email_library:** `1bf9cf39-963a-45cb-bf46-2a08beef49bd` ⚠️ **não encontrado na tpl_email_library** (provavelmente eliminado — recriar ou apontar para outro)
- **`subtask_key` sugerido:** `email_envio_cmi`
- **Registry:** [x] `email-envio-cmi.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: anexa o CMI gerado em 01.3.1? qual é o template real? -->

#### 01.4.2 Verificar Resposta do Email
- **UUID:** `b0b670ba-e637-454d-9bef-bfae371a803f`
- **Tipo:** `checklist` · 🔵 main_contact_only · 👥 all · **Mandatory:** ✅
- **`subtask_key` sugerido:** `verificar_resposta_email_cmi`
- **Registry:** [x] `verificar-resposta-email-cmi.ts` ✅ (hybrid, `dueRule: {after: 'email_envio_cmi', offset: '24h'}`)
- **Notas:** <!-- ditar: tem `dueRule` dependente do envio em 01.4.1 (ex.: 24h depois)? -->

---

### Task 01.5 — Agendamento com o consultor CMI e FBC
- **ID:** `872048e4-26dd-442a-8410-ec58748885b2` · **Mandatory:** ✅
- **Descrição:** Agendar com o consultor uma data para levantamento do CMI, recolha de assinaturas e preenchimento da FBC

#### 01.5.1 Criar agendamento
- **UUID:** `9bac8825-6fdc-4ac1-a9e1-0f3274cdd411`
- **Tipo:** `schedule_event` · ⚪ sem scope · **Mandatory:** ✅
- **`subtask_key` sugerido:** `schedule_recolha_cmi_fbc`
- **Registry:** [x] `schedule-recolha-cmi-fbc.ts` ✅ (hybrid, UI: `SubtaskCardScheduleEvent` com calendar sync)
- **Notas:** <!-- ditar: integra com o calendário do módulo? cria evento no calendar? notifica o owner? -->

---

### Task 01.6 — Recolha do CMI e FBC
- **ID:** `4a2158d5-4a2c-4b7d-b7e5-c24a312e621a` · **Mandatory:** ✅

#### 01.6.1 Confirmar Recolha
- **UUID:** `3bfd3a9b-9f94-414e-85f2-1bf146dd5d24`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- **`subtask_key` sugerido:** `confirmar_recolha_cmi_fbc`
- **Registry:** [x] `confirmar-recolha-cmi-fbc.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: tem `dueRule` dependente do agendamento em 01.5.1? -->

---

### Task 01.7 — Confirmação dos dados do CMI e FBC
- **ID:** `9f56d34e-1b3e-4196-b7d1-f794861a62c5` · **Mandatory:** ✅

#### 01.7.1 Confirmar o correto preenchimento do CPCV
- **UUID:** `f4381b61-0102-43ee-8b35-13a4ab186f40`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- ⚠️ **Inconsistência no template:** título menciona "CPCV" mas a task é sobre CMI+FBC. Confirmar.
- **`subtask_key` sugerido:** `confirmar_cmi_preenchimento` (se CMI) **ou** `confirmar_cpcv_preenchimento` (se CPCV, mas parece erro)
- **Registry:** [x] `confirmar-cmi-preenchimento.ts` ✅ (hybrid — chave `confirmar_cmi_preenchimento`, título legacy preservado)
- **Notas:** <!-- ditar: é CMI ou CPCV? -->

#### 01.7.2 Confirmar o correto preenchimento da FBC
- **UUID:** `a61c2c71-8f7e-4996-93a6-b917301b48b8`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- **`subtask_key` sugerido:** `confirmar_fbc_preenchimento`
- **Registry:** [x] `confirmar-fbc-preenchimento.ts` ✅ (hybrid)
- **Notas:** <!-- ditar -->

---

### Task 01.8 — Digitalizar Originais
- **ID:** `67aa208f-a735-4384-b5ec-651c72d2c796` · **Mandatory:** ✅
- **Descrição:** Digitalizar e guardar na Drive; colocar os originais físicos na pasta para entrega na sede da ConviCtus

#### 01.8.1 Confirmar
- **UUID:** `1920bbe2-ea78-4fda-9959-76bec0be31bc`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- ⚠️ Título genérico — confirmar intenção.
- **`subtask_key` sugerido:** `confirmar_entrega_originais_sede` (placeholder)
- **Registry:** [x] `confirmar-entrega-originais-sede.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: confirmar o quê exactamente? -->

#### 01.8.2 Digitalizar CMI Original
- **UUID:** `9436ce84-1bf7-4115-99ea-74ed1703ae68`
- **Tipo:** `upload` · ⚪ sem scope · **Mandatory:** ✅
- **doc_type:** `7b3f2510-c470-4845-85ad-1af3dd781e62` "CMI Digitalizado"
- **`subtask_key` sugerido:** `upload_cmi_digitalizado`
- **Registry:** [x] `upload-cmi-digitalizado.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: substitui o CMI gerado em 01.3.1 ou adiciona-se como segundo documento? -->

---

## Stage 02 — Link e descrição
**ID:** `1feae050-f780-4018-ba7a-209fde175f58` · `order_index=1`

### Task 02.1 — Finalizar Dados do Imóvel
- **ID:** `b3752b4c-1435-4eff-acc7-489a6d775fd0` · **Mandatory:** ✅

#### 02.1.1 Escrever a descrição do imóvel
- **UUID:** `b045400a-b063-4bf7-8485-d9823ed973e2`
- **Tipo:** `field` · ⚪ sem scope · **Mandatory:** ✅
- **Campo:** label="Descrição", field_name=`description`, type=`rich_text`, target=`property`
- **`subtask_key` sugerido:** `field_property_descricao`
- **Registry:** [x] `field-property-descricao.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: usa IA para gerar sugestão a partir das características? editor rich_text com toolbar completa? -->

#### 02.1.2 Preencher todas as informações restantes
- **UUID:** `fd15bd46-6113-4f2a-a43c-277d70e4994f`
- **Tipo:** `form` · ⚪ sem scope · **Mandatory:** ✅
- **Form:** 3 secções
  - **Dados Gerais** (title, listing_price, business_type, property_condition, energy_certificate)
  - **Localização** (address_map via Mapbox)
  - **Secção 3** (typology, bedrooms, bathrooms, area_gross, area_util, construction_year, parking_spaces, has_elevator, solar_orientation, views, equipment, features)
- **`subtask_key` sugerido:** `form_property_completar_dados`
- **Registry:** [x] `form-property-completar-dados.ts` ✅ (hybrid, 3 secções preservadas)
- **Notas:** <!-- ditar: reaproveita o PropertyForm existente? valida contra Zod? pré-preenche a partir do imóvel já criado? -->

---

### Task 02.2 — Upload das imagens do Imóvel
- **ID:** `224b9e54-e83e-45fb-9825-108edfb2a42b` · **Mandatory:** ✅

#### 02.2.1 Fotografias do Imóvel
- **UUID:** `ede2d1df-d705-4ab3-b61c-3ab27291fbff`
- **Tipo:** `form` · ⚪ sem scope · **Mandatory:** ✅
- **Campo:** `media_upload` com target=`property`
- **`subtask_key` sugerido:** `upload_property_fotografias`
- **Registry:** [x] `upload-property-fotografias.ts` ✅ (hybrid, `type: form` + `media_upload`)
- **Notas:** <!-- ditar: reutiliza o PropertyMediaUpload existente (crop + compressão WebP + reorder)? mínimo de fotos para concluir? -->

---

## Stage 03 — Draft e aprovação
**ID:** `801922e4-e43f-4e6a-a9a0-866088c0cbac` · `order_index=2`

### Task 03.1 — Draft do Imóvel
- **ID:** `c21049d2-64eb-4cb9-8b08-f3c9c6edddd9` · **Mandatory:** ✅
- **Descrição:** ADICIONA SUBTASKS — Criar o Draft no MaxWork e alertar o Processual para iniciar os passos seguintes

#### 03.1.1 Criar o Draft no MaxWork
- **UUID:** `0d998ff1-f8ec-43cf-b3b9-c5f4abbdd7e6`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- **`subtask_key` sugerido:** `checklist_draft_maxwork`
- **Registry:** [x] `checklist-draft-maxwork.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: link externo para o MaxWork? instruções? -->

#### 03.1.2 Registar Draft
- **UUID:** `4cb1326f-6a3f-4926-a80c-e125a9c586da`
- **Tipo:** `field` · ⚪ sem scope · **Mandatory:** ✅
- **Campo:** label="Número Draft RE/MAX", field_name=`remax_draft_number`, type=`text`, target=`property`
- **`subtask_key` sugerido:** `field_property_remax_draft_number`
- **Registry:** [x] `field-property-remax-draft-number.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: valida formato? -->

---

### Task 03.2 — Enviar e-mail para processual Infinity
- **ID:** `b1bc99d6-66dc-4f96-87ef-29ef14c548ea` · **Mandatory:** ✅
- **Descrição:** Enviar e-mail para processual.convictus@remax.pt (Cátia) a solicitar aprovação do Draft · Verificar resposta de Email em até 24h

#### 03.2.1 Enviar e-mail para processual.convictus@remax.pt (Cátia) a solicitar aprovação do Draft
- **UUID:** `5d39134b-ca89-4d4d-83e2-8ca218a46484`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- ⚠️ É `checklist` no template mas deveria ser `email` — confirmar.
- **`subtask_key` sugerido:** `email_aprovacao_draft_processual`
- **Registry:** [x] `email-aprovacao-draft-processual.ts` ✅ (hybrid — mantém `type: 'checklist'` do legacy; convertível futuramente)
- **Notas:** A razão de ser `checklist` é que **não existe template em `tpl_email_library`** para este pedido de aprovação ao processual ConviCtus. O consultor envia o email manualmente (cliente externo) e marca aqui. Para converter em envio real: criar template + trocar `configBuilder` para `type: 'email'` + `email_library_id` (comentário de referência no topo do ficheiro da rule).

#### 03.2.2 Verificar resposta de Email em até 24h
- **UUID:** `d4805618-68e0-48d1-8c40-48902c7d6f5a`
- **Tipo:** `checklist` · ⚪ sem scope · **Mandatory:** ✅
- **`subtask_key` sugerido:** `verificar_resposta_aprovacao_draft`
- **Registry:** [x] `verificar-resposta-aprovacao-draft.ts` ✅ (hybrid, `dueRule: {after: 'email_aprovacao_draft_processual', offset: '24h'}`)
- **Notas:** <!-- ditar: `dueRule { after: 'email_aprovacao_draft_processual', offset: '24h' }`? -->

---

### Task 03.3 — Registar o ID do imóvel, a data de entrada e observações
- **ID:** `9bb7240d-ade0-40b6-bd85-123c92f50c52` · **Mandatory:** ✅

#### 03.3.1 Estado de Publicação
- **UUID:** `5e35b207-4007-4bf4-b32a-d34626459f66`
- **Tipo:** `field` · **Mandatory:** ✅
- **Campo:** label="Estado de Publicação", field_name=`business_status`, type=`select`, target=`property`, options=`PROPERTY_STATUS`
- **`subtask_key` sugerido:** `field_property_business_status`
- **Registry:** [x] `field-property-business-status.ts` ✅ (hybrid)
- **Notas:** <!-- ditar -->

#### 03.3.2 Data de publicação Remax
- **UUID:** `46f3be15-6939-4692-823c-52296e1bfb83`
- **Tipo:** `field` · **Mandatory:** ✅
- **Campo:** label="Data de Publicação RE/MAX", field_name=`remax_published_date`, type=`date`, target=`property`
- **`subtask_key` sugerido:** `field_property_remax_published_date`
- **Registry:** [x] `field-property-remax-published-date.ts` ✅ (hybrid)
- **Notas:** <!-- ditar -->

#### 03.3.3 Registar ID Externo
- **UUID:** `ad40a71c-1113-4a49-a0a0-5e42292befa5`
- **Tipo:** `field` · **Mandatory:** ✅
- **Campo:** label="Referência Externa", field_name=`external_ref`, type=`text`, target=`property`
- **`subtask_key` sugerido:** `field_property_external_ref`
- **Registry:** [x] `field-property-external-ref.ts` ✅ (hybrid)
- **Notas:** <!-- ditar -->

#### 03.3.4 Link portal Cliente Remax
- **UUID:** `fb0588ad-fa06-4b65-9f2b-1ba44542c920`
- **Tipo:** `field` · **Mandatory:** ✅
- **Campo:** label="Link Portal RE/MAX", field_name=`link_portal_remax`, type=`link_external`, target=`property`, placeholder=`https://www.remax.pt/...`
- **`subtask_key` sugerido:** `field_property_link_remax`
- **Registry:** [x] `field-property-link-remax.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: valida URL? abre em nova tab ao clicar? -->

#### 03.3.5 Notas Jurídico Convictus
- **UUID:** `08c530c9-544c-4698-87f3-3a616d8c94f5`
- **Tipo:** `field` · **Mandatory:** ✅
- **Campo:** label="Notas Jurídico Convictus", field_name=`notas_juridico_convictus`, type=`rich_text`, target=`property`
- **`subtask_key` sugerido:** `field_property_notas_juridico`
- **Registry:** [x] `field-property-notas-juridico.ts` ✅ (hybrid)
- **Notas:** <!-- ditar -->

---

## Stage 04 — Publicação e finalização
**ID:** `bf259485-d399-46dd-9b8f-5527fa758446` · `order_index=3`

### Task 04.1 — Publicar a angariação nos portais
- **ID:** `eb8d7119-3de8-44b7-a7b2-1e2ac332caee` · **Mandatory:** ✅
- **Descrição:** Publicar a angariação nos portais imobiliários (Idealista e Imovirtual) e guardar os links na app (Administrativo)

#### 04.1.1 Link Idealista
- **UUID:** `834d55ca-7ccc-4a18-b4a0-6c23351006c9`
- **Tipo:** `field` · **Mandatory:** ✅
- **Campo:** label="Link Portal Idealista", field_name=`link_portal_idealista`, type=`link_external`, target=`property`
- **`subtask_key` sugerido:** `field_property_link_idealista`
- **Registry:** [x] `field-property-link-idealista.ts` ✅ (hybrid)
- **Notas:** <!-- ditar -->

#### 04.1.2 Link Imovirtual
- **UUID:** `5ec595e8-afea-4430-8237-71900e0d74b0`
- **Tipo:** `field` · **Mandatory:** ✅
- **Campo:** label="Link Portal Imovirtual", field_name=`link_portal_imovirtual`, type=`link_external`, target=`property`
- **`subtask_key` sugerido:** `field_property_link_imovirtual`
- **Registry:** [x] `field-property-link-imovirtual.ts` ✅ (hybrid)
- **Notas:** <!-- ditar -->

---

### Task 04.2 — Registar no Mapa de Marketing e enviar ao Pedro???
- **ID:** `d92ae18a-1cba-4276-9609-eb5997eb085b` · **Mandatory:** ✅
- ⚠️ **Task sem subtasks no template.** Título termina com "???" — precisa de clarificação. O que é o Mapa de Marketing? Quem é o Pedro? Precisa de rules.
- **Notas:** <!-- ditar: definir que subtarefas criar aqui -->

---

### Task 04.3 — E-mail de agradecimento
- **ID:** `52719188-80f0-4393-b651-6802e4968e24` · **Mandatory:** ✅
- **Descrição:** Enviar e-mail de agradecimento ao cliente com os links dos portais (Processual)

#### 04.3.1 Enviar Email de Agradecimento
- **UUID:** `465cc353-4e2e-4893-8b27-4fa3e0b46615`
- **Tipo:** `email` · ⚪ sem scope · **Mandatory:** ✅
- **email_library:** `8829ca88-8848-47ec-8149-62a126f829fb` "Agradecimento pela Confiança na Nossa Equipe Imobiliária - INFINITY GROUP"
- **`subtask_key` sugerido:** `email_agradecimento_final`
- **Registry:** [x] `email-agradecimento-final.ts` ✅ (hybrid)
- **Notas:** <!-- ditar: variáveis do template incluem os links dos portais preenchidos nas 04.1.1 e 04.1.2? -->

---

## Resumo por implementação

| Stage | Task | Subtasks | Implementadas |
|---|---|---|---|
| 01 Recolha de documentação | 01.1 Pedido documento | 1 | 1 ✅ |
| 01 Recolha de documentação | 01.2 Documentos do Imóvel (ex-Armazenar) | 7 | 7 ✅ |
| 01 Recolha de documentação | 01.3 Documentos Pessoa Colectiva (NOVA) | 7 | 7 ✅ |
| 01 Recolha de documentação | 01.4 Documentos Pessoa Singular (NOVA) | 5 | 5 ✅ |
| 01 Recolha de documentação | Geração do CMI | 2 | 2 ✅ |
| 01 Recolha de documentação | Enviar CMI ao proprietário | 2 | 2 ✅ |
| 01 Recolha de documentação | Agendamento CMI/FBC | 1 | 1 ✅ |
| 01 Recolha de documentação | Recolha CMI/FBC | 1 | 1 ✅ |
| 01 Recolha de documentação | Confirmação CMI/FBC | 2 | 2 ✅ |
| 01 Recolha de documentação | Digitalizar Originais | 2 | 2 ✅ |
| 02 Link e descrição | Finalizar Dados | 2 | 2 ✅ |
| 02 Link e descrição | Upload imagens | 1 | 1 ✅ |
| 03 Draft e aprovação | Draft do Imóvel | 2 | 2 ✅ |
| 03 Draft e aprovação | Email processual | 2 | 2 ✅ |
| 03 Draft e aprovação | Registar IDs | 5 | 5 ✅ |
| 04 Publicação | Publicar portais | 2 | 2 ✅ |
| 04 Publicação | Mapa Marketing ??? | 0 | — (sem tpl_subtasks) |
| 04 Publicação | Email agradecimento | 1 | 1 ✅ |
| **Totais** | **18 tasks com subtasks** | **45** | **45 ✅ (100%)** |

Migração completa concluída:
- **2026-05-01** — criação do registry + 29 subtasks iniciais
- **2026-05-02** — split de "Armazenar documentos" em 3 grupos (Imóvel/Colectiva/Singular) alinhado com a UI correcta. +14 subtasks (de 29 → 43 no stage 01; de 29 → 45 no total se contarmos todos os stages — inventário antigo tinha 31 pois assumia 2 rules órfãs).

Todas as 45 rules são **hybrid** (`Component: null`) para reaproveitar a UI legacy por `config.type`. Novas entradas no contrato `SubtaskRule`:
- `ownerScope: 'none' | 'main_contact_only' | 'all'`
- `personTypeFilter: 'all' | 'singular' | 'coletiva'`
- `hint?: string` — texto auxiliar mostrado no card

## Inconsistências detectadas

1. **01.2.3 Naturalidade** — título "Naturalidade" mas field é "Morada/address". Duas rules ou uma mal configurada?
2. **01.7.1 CPCV** — título menciona "CPCV" mas a task é sobre CMI+FBC. Erro?
3. **01.8.1 Confirmar** — título genérico, sem contexto claro.
4. **01.4.1 email_library `1bf9cf39-...`** — não existe em `tpl_email_library`. Precisa ser recriado ou re-apontado.
5. **03.2.1** — tipo `checklist` no template mas o texto descreve um envio de email. Converter?
6. **04.2 Mapa de Marketing ???** — tarefa sem subtasks e título termina com "???". Precisa ser clarificada e populada.
7. **`armazenar-documentos` no registry** — skeleton existe mas não mapeia 1:1 para uma subtask; parece ser um guarda-chuva para 01.2.*.

## Como avançar

Proposta: tarefa a tarefa, tu dizes (em prosa livre, eu estruturo):
- Se o `subtask_key` proposto está bem ou prefere outro
- O que acontece exactamente ao concluir (envio, IA, payload gravado, validação)
- Se tem `dueRule` (depende de outra subtarefa)
- Se tem UI especial (IA, preview, integração com calendário, etc.)

Começamos por **Stage 01 tarefa por tarefa**? Sugiro abrirmos pela **01.2 (Armazenar documentos)** porque é a mais complexa (5 subtasks, mistura de upload/field/form/checklist) — se consolidarmos o padrão aqui, as restantes ficam fáceis.
