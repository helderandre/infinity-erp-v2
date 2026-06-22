# CMI — Mapeamento de Campos (Contrato de Mediação Imobiliária)

> Estado: **entregue a 2026-06-22** (mapeamento + correções + wiring).
> Migration: [`20260622_cmi_complete_field_mapping.sql`](../../supabase/migrations/20260622_cmi_complete_field_mapping.sql)

## 1. O que é / como funciona

O passo **"Geração do CMI"** da angariação preenche o PDF **`Convictus_CMI.pdf`**
(modelo da RE/MAX Convictus, 4 páginas, **75 campos AcroForm**).

- Modelo: `tpl_doc_library` id `9223bdfc-31a0-4918-b5ee-580760ba8b32` (`template_type='pdf'`, ficheiro em R2).
- O preenchimento tem 3 camadas:
  1. **`doc_pdf_field_mappings`** — 1 linha por campo do PDF → `variable_key` (+ `transform`, `default_value`).
  2. **`tpl_variables`** — catálogo: cada `variable_key` → `source_table.source_column` (ou `static_value` / sistema).
  3. **Resolver** [`/api/libraries/emails/preview-data`](../../app/api/libraries/emails/preview-data/route.ts) lê as colunas para as entidades passadas (**property / owner / consultant / process** — NÃO negócio) e a engine [`lib/pdf/fill-generic.ts`](../../lib/pdf/fill-generic.ts) escreve no PDF. A mesma `applyTransform` ([`lib/pdf/transforms.ts`](../../lib/pdf/transforms.ts)) corre no preview editável e na geração final.
- Checkbox marcada quando o valor resolvido ∈ `{true,1,sim,yes,x,on}`.

## 2. Quando cada campo é preenchido

| Fase | Origem | O que preenche |
|---|---|---|
| **① Criação da angariação** (form de 6 passos) | `dev_properties`, `dev_property_specifications`, `dev_property_internal`, `owners` (básico) | tipo, tipologia, área, preço, morada/freguesia/concelho/CP/zona do imóvel; nome/email/telemóvel/NIF do proprietário; regime/prazo/comissão; checkboxes de tipo de negócio e tipo de comissão |
| **② Fase de processo** (KYC + extração de docs legais, ANTES do passo CMI) | `owners` (KYC), `dev_property_legal_data`, `dev_property_internal` | estado civil, regime, n.º C.C, morada/CP/localidade do proprietário; conservatória, ficha, artigo matricial, freguesia fiscal, licença (n.º/data/câmara), certificado energético; ónus (`has_mortgage`/`mortgage_owed`) |
| **③ Manual** (não capturado em lado nenhum) | — | cônjuge (nome/CC/NIF), calendário de pagamentos, taxa de obtenção de docs (Cláusula 6), foro, centro RAL, consentimentos RGPD, "Outros" |

> Nota: o passo de **criação** da angariação NÃO recolhe KYC — ver comentário em
> [`step-3-owners.tsx:279`](../../components/acquisitions/step-3-owners.tsx). O KYC é
> recolhido na fase de processo (pós-aprovação), antes do passo CMI.

## 3. Mapeamento completo dos 75 campos

Legenda fase: ① criação · ② processo · ③ manual · 🅰 automático (sistema)

### Página 1 — Partes + Identificação do imóvel + Negócio

| Campo PDF | Significado | variable_key | Coluna | Fase |
|---|---|---|---|---|
| `nome do cliente` | Nome do proprietário | `proprietario_nome` | owners.name | ① |
| `estado civil` | Estado civil | `proprietario_estado_civil` | owners.marital_status | ② |
| `sob o regime de bens` | Regime de bens | `proprietario_regime` | owners.marital_regime | ② |
| `residentes` | **Nome do cônjuge** | `conjuge_nome` | owners.spouse_name | ③ |
| `na` | Morada do proprietário | `morada_proprietario` | owners.address | ② |
| `undefined_2` | CP proprietário (4 díg.) | `proprietario_codigo_postal` (cp_prefix) | owners.postal_code | ② |
| `undefined_3` | CP proprietário (3 díg.) | `proprietario_codigo_postal` (cp_suffix) | owners.postal_code | ② |
| `em` | Localidade do proprietário | `proprietario_localidade` | owners.city | ② |
| `nos` | **N.º C.C/B.I** | `proprietario_cc` | owners.id_doc_number | ② — 🐞 corrigido (era NIF) |
| `undefined_4` | N.º C.C do cônjuge | `conjuge_cc` | owners.spouse_cc_number | ③ |
| `nos_2` | **NIF** do proprietário | `proprietario_nif` | owners.nif | ① — 🐞 corrigido (estava vazio) |
| `adiante designados…` | NIF do cônjuge | `conjuge_nif` | owners.spouse_nif | ③ |
| `com telemóvel n` | Telemóvel | `proprietario_telefone` | owners.phone | ① |
| `email` | Email | `proprietario_email` | owners.email | ① |
| `na qualidade de` | Qualidade (Proprietário/Senhorio…) | `imovel_business_type` (qualidade_from_business) | dev_properties.business_type | ① — era `negocio_tipo` (morto) |
| `urbano…destinado a 1` | Fim/uso do imóvel | `imovel_tipo` | dev_properties.property_type | ① (rever: "destinado a") |
| `urbano…destinado a 2` | N.º divisões assoalhadas | `imovel_tipologia` | dev_property_specifications.typology | ① (rever) |
| `urbano…destinado a 3` | Morada do imóvel | `imovel_morada` | dev_properties (concat) | ① |
| `divisões…área total de` | Área total | `imovel_area_total` | dev_property_specifications.area_gross | ① |
| `undefined_5` | CP imóvel (4 díg.) | `imovel_codigo_postal` (cp_prefix) | dev_properties.postal_code | ① |
| `undefined_6` | CP imóvel (3 díg.) | `imovel_codigo_postal` (cp_suffix) | dev_properties.postal_code | ① |
| `undefined_7` | Localidade do imóvel | `imovel_zona` | dev_properties.zone | ① |
| `freguesia` | Freguesia | `imovel_freguesia` | dev_properties.address_parish | ① |
| `concelho` | Concelho | `imovel_concelho` | dev_properties.city | ① |
| `descrito…Predial de 1` | Conservatória | `imovel_conservatoria` | dev_property_legal_data.conservatoria_crp | ② |
| `descrito…Predial de 2` | **Câmara Municipal (licença)** | `imovel_licenca_emissor` | dev_property_internal.use_license_issuer | ② — 🐞 corrigido (era ficha_ano) |
| `sob a ficha n` | Ficha de registo | `imovel_ficha_registo` | dev_property_legal_data.descricao_ficha | ② |
| `a licença…construção n` | N.º licença utilização | `imovel_licenca_numero` | dev_property_internal.use_license_number | ② |
| `em_2` | Data licença → dia | `imovel_licenca_data` (date_part_day) | dev_property_internal.use_license_date | ② |
| `undefined_8` | Data licença → mês | `imovel_licenca_data` (date_part_month) | « | ② |
| `undefined_9` | Data licença → ano | `imovel_licenca_data` (date_part_year) | « | ② |
| `n` | Artigo matricial | `imovel_artigo_matricial` | dev_property_legal_data.artigo_matricial | ② |
| `da freguesia de` | Freguesia fiscal | `imovel_freguesia_fiscal` | dev_property_legal_data.freguesia_fiscal | ② |
| `e a certificação energética` | Certificação energética | `certificado_energetico` | dev_properties.energy_certificate | ①/② |
| `pelo preço de` | Preço (por extenso) | `imovel_preco` (number_words_pt) | dev_properties.listing_price | ① |
| `undefined_10` | Preço (numérico) | `imovel_preco` | « | ① |
| `Check Box6` | ☑ Compra | `imovel_business_type` (checkbox_if_venda) | dev_properties.business_type | ① |
| `Check Box7` | ☑ Trespasse | « (checkbox_if_trespasse) | « | ① |
| `Check Box8` | ☑ Arrendamento | « (checkbox_if_arrendamento) | « | ① |
| `Check Box9` | ☑ Outros | « (checkbox_if_outros) | « | ① |
| `Arrendamento` | "Outros" (especificar) | — | — | ③ |

### Página 2 — Ónus, Regime, Remuneração, Obtenção de docs

| Campo PDF | Significado | variable_key | Coluna | Fase |
|---|---|---|---|---|
| `Check Box16` | ☑ Livre de ónus | `imovel_tem_hipoteca` (checkbox_if_false) | dev_property_internal.has_mortgage | ② |
| `Check Box17` | ☑ Recaem ónus | « (checkbox_if_true) | « | ② |
| `seguintes ónus…penhoras` | Descrição dos ónus | — | — | ③ |
| `pelo valor de` | Valor em dívida | `imovel_mortgage_owed` | dev_property_internal.mortgage_owed | ② |
| `Check Box11` | ☑ Comissão % | `imovel_tipo_comissao` (checkbox_if_percentage) | dev_property_internal.commission_type | ① |
| `A quantia de` | Comissão (%) | `imovel_comissao_valor` | dev_property_internal.commission_agreed | ① |
| `Check Box15` | ☑ Comissão fixa | `imovel_tipo_comissao` (checkbox_if_fixed) | « | ① |
| `A quantia de_2` | Comissão (€ fixo) | `imovel_comissao` | dev_property_internal.commission_agreed | ① |
| `Euros` | Comissão por extenso | — | — | ③ |
| `Check Box14` | ☑ Pagamento na escritura | — | — | ③ |
| `undefined_11` / `após…remanescente de` / `Check Box13` | % sinal + remanescente | — | — | ③ |
| `Check Box12` | ☑ Total no CPCV | — | — | ③ |
| `Check Box22` / `quantia de` / `Euros_2` / `Check Box10` | Cláusula 6 (taxa obtenção docs) | — | — | ③ |

### Página 3 — Prazos, Angariador, Foro

| Campo PDF | Significado | variable_key | Coluna | Fase |
|---|---|---|---|---|
| `dias meses contados…` | Prazo do contrato | `imovel_contrato_prazo` | dev_property_internal.contract_term | ① |
| `dias a contar…` | Prazo de colaboração | — | — | ③ |
| `contribuinte fiscal n` | **Nome do angariador** | `consultor_nome` | dev_users.commercial_name | 🅰 — 🐞 corrigido (trocado) |
| `angariador` | **NIF do angariador** | `consultor_nif` | dev_consultant_private_data.nif | 🅰 — 🐞 corrigido (trocado) |
| `com expressa renúncia a` | Foro/Comarca | — | — | ③ |

### Página 4 — Tratamento de dados + Assinatura

| Campo PDF | Significado | variable_key | Coluna | Fase |
|---|---|---|---|---|
| `Check Box18` / `Check Box20` | Autoriza/não cedência RE/MAX | — | — | ③ (consentimento) |
| `Check Box19` / `Check Box21` | Autoriza/não RGPD | — | — | ③ (consentimento) |
| `com` / `undefined_12` / `undefined_13` | Centro RAL + sítio | — | — | ③ |
| `1` | Cidade (assinatura) | — (default `Lisboa`) | — | 🅰 |
| `2` | Dia | `dia_actual` | sistema | 🅰 |
| `3` | Mês | `mes_actual_numerico` | sistema | 🅰 (sugestão: extenso) |
| `de` | Ano | `ano_actual` | sistema | 🅰 |

**Cobertura: 54/75 com origem automática · 21 manuais** (calendário de pagamentos, consentimentos, foro, RAL, cônjuge, "Outros").

## 4. Bugs corrigidos (valor caía no campo errado)

1. `nos`/`nos_2` — o NIF estava no campo do C.C; passou para o campo do NIF (`nos_2`), e `nos` → n.º C.C (`id_doc_number`).
2. `descrito…Predial de 2` — era `imovel_ficha_ano`; é a Câmara Municipal emissora da licença → `imovel_licenca_emissor`.
3. `angariador` ⇄ `contribuinte fiscal n` — estavam **trocados**: nome no slot do NIF e vice-versa.

## 5. Alterações entregues

- **Migration** [`20260622_cmi_complete_field_mapping.sql`](../../supabase/migrations/20260622_cmi_complete_field_mapping.sql): 3 colunas novas em `owners` (`spouse_name`, `spouse_cc_number`, `spouse_nif`); 11 `tpl_variables` novas; correção dos 4 bugs; ligação dos campos fáceis; auto-tick das 8 checkboxes; divisão da data de licença.
- **Transforms** [`lib/pdf/transforms.ts`](../../lib/pdf/transforms.ts): `checkbox_if_*`, `qualidade_from_business`, `cp_prefix/suffix`, `date_part_day/month/year`.
- **Wiring de IDs** na nova timeline: [`angariacao-overview`](../../app/api/processes/[id]/angariacao-overview/route.ts) devolve `mainContactOwnerId` + `consultantId`, propagados por panel → sheet → content → `CmiRealBuilder` → `SubtaskPdfSheet`. Antes só passava `propertyId`, pelo que todo o bloco do proprietário + angariador ficava vazio na nova vista.
- **Decisão**: reutilizar colunas KYC já existentes (`id_doc_number`, `city`, `postal_code`) em vez de duplicar; só o cônjuge é coluna nova.

## 6. Por fazer (estado actual)

- [ ] **Verificar build/typecheck** — `npx tsc --noEmit` (foi interrompido; mudanças são transforms puros + prop-threading + SQL).
- [ ] **Teste ponta-a-ponta**: abrir o passo *Geração do CMI* num imóvel real com dados completos e confirmar o prefill (proprietário + angariador + imóvel + checkboxes).
- [ ] **Cônjuge**: as colunas `spouse_*` existem mas nada as preenche. Decidir: (a) UI para capturar cônjuge, ou (b) usar a 2.ª linha de `owners` em vez de colunas de cônjuge.
- [ ] *(Opcional)* mês da assinatura por extenso (`mes_actual_extenso`) em vez de numérico.
- [ ] *(Opcional, adiado por decisão)* re-adicionar campos KYC do proprietário (C.C, morada/CP/localidade, estado civil) ao **form de criação** para serem capturados logo, em vez de só na fase de processo.
- [ ] *(Por design, manual)* os 21 campos da fase ③ continuam preenchidos à mão na sheet do CMI (calendário de pagamentos, consentimentos RGPD, foro, RAL).
