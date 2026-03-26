# SPEC — Assistente IA de Descrição de Imóvel

## Objectivo

Gerar automaticamente **2 variantes** de descrição profissional para imóveis, com base nos campos da ficha do imóvel, notas do consultor (texto ou transcrição de áudio), e regras do sector imobiliário português.

---

## Localização na App

### Opção A — Subtarefa no Processo de Angariação
Uma subtarefa do tipo `GENERATE_DOC` no template de angariação chamada **"Escrever a descrição do imóvel"**. O consultor abre a subtarefa, vê o editor rich-text actual, e tem um botão **"Gerar com IA"** que preenche o editor com a descrição gerada.

### Opção B — Botão na Página do Imóvel
Na tab "Geral" da página de detalhe do imóvel, junto ao campo `description`, um botão **"Gerar com IA"** que abre um painel lateral (sheet) com o assistente.

### Recomendação: Ambos
- O botão na subtarefa do processo (onde o consultor já está a trabalhar)
- E um atalho na página do imóvel para re-gerar a qualquer momento

---

## Fluxo do Utilizador

```
1. Consultor abre "Gerar com IA"
   │
2. Painel lateral (Sheet) abre com:
   ├── Preview dos dados do imóvel (auto-preenchidos)
   ├── Campo de notas adicionais (textarea)
   ├── Botão "Gravar Nota de Voz" (microfone → transcrição Whisper)
   ├── Selector de idioma: PT | EN | FR | ES
   ├── Selector de tom: Profissional | Premium/Luxo | Acolhedor/Familiar
   │
3. Clica "Gerar Descrições"
   │
4. IA gera 2 variantes (streaming)
   ├── Variante A: Mais descritiva/emocional
   └── Variante B: Mais factual/técnica
   │
5. Consultor escolhe uma (ou edita), clica "Usar esta descrição"
   │
6. Descrição é guardada em dev_properties.description
```

---

## API

### `POST /api/properties/[id]/generate-description`

**Request:**
```typescript
{
  language: 'pt' | 'en' | 'fr' | 'es'  // default 'pt'
  tone: 'professional' | 'premium' | 'cozy'  // default 'professional'
  additional_notes?: string  // notas do consultor
  audio_notes?: string  // transcrição (já processada pelo Whisper)
}
```

**Response (streaming):**
```typescript
{
  variant_a: string  // descrição variante A (markdown)
  variant_b: string  // descrição variante B (markdown)
}
```

### `POST /api/properties/[id]/transcribe-notes`

Reutiliza o endpoint Whisper existente (`/api/negocios/[id]/transcribe`) com adaptação mínima. Recebe áudio, retorna texto.

---

## Dados Enviados à IA

O endpoint recolhe automaticamente todos os campos relevantes do imóvel:

```typescript
// Da tabela dev_properties
title, description (existente, se houver), listing_price, property_type,
business_type, status, energy_certificate, city, zone, address_parish,
property_condition, contract_regime

// Da tabela dev_property_specifications
typology, bedrooms, bathrooms, area_gross, area_util,
construction_year, parking_spaces, garage_spaces, features[],
has_elevator, fronts_count, solar_orientation[], views[],
equipment[], storage_area, balcony_area, pool_area

// Da tabela dev_property_internal
condominium_fee, internal_notes

// Da tabela property_owners → owners
owner name (para contextualizar se é empreendimento/particular)

// Notas adicionais do consultor (input do utilizador)
additional_notes, audio_notes (transcrição)
```

---

## Prompt do Sistema

```
És um copywriter profissional de imobiliária em Portugal, especializado em
descrições de imóveis para portais (Idealista, Imovirtual, RE/MAX).

REGRAS OBRIGATÓRIAS:
1. Toda a descrição deve estar em {language}
2. Tom: {tone_description}
3. Usar formatação com bullet points para características
4. Destacar palavras-chave em **negrito**
5. Incluir secções: Introdução → Características → Localização → Condições
6. ARRENDAMENTO: É OBRIGATÓRIO mencionar a Licença de Utilização.
   Se o imóvel foi inscrito na matriz antes de 1951, mencionar:
   "Dispensado de licença de utilização por ter sido inscrito na matriz
   antes de 1951, conforme o Decreto Lei nº 38382"
   Caso contrário, mencionar que possui Licença de Utilização válida.
7. Incluir call-to-action final (agendar visita)
8. Não inventar dados — usar APENAS os fornecidos
9. Se faltar informação, omitir (não inventar áreas, quartos, etc.)
10. Preço: incluir se business_type = arrendamento (valor mensal).
    Para venda, não mencionar preço na descrição.

VARIANTE A: Mais descritiva e emocional. Criar narrativa envolvente que
transmita o estilo de vida. Usar linguagem aspiracional.

VARIANTE B: Mais factual e estruturada. Focar em dados concretos,
áreas, características técnicas. Ideal para compradores analíticos.

Dados do imóvel:
{property_data}

Notas do consultor:
{notes}

Gera as duas variantes, separadas por "---VARIANTE_B---".
```

### Variações de Tom

| Tom | Descrição para o prompt |
|-----|------------------------|
| `professional` | Profissional e equilibrado, tom padrão de agência imobiliária de referência |
| `premium` | Luxo e exclusividade, linguagem sofisticada, enfatizar prestígio e raridade |
| `cozy` | Acolhedor e familiar, enfatizar conforto, vizinhança, qualidade de vida |

### Variações de Idioma

| Idioma | Adaptações |
|--------|-----------|
| PT | Português de Portugal (não brasileiro). Usar "imóvel", "divisão", "casa de banho" |
| EN | British English. Property terms: "flat", "lounge", "en-suite" |
| FR | Français. "Appartement", "séjour", "salle de bains" |
| ES | Español. "Piso", "salón", "cuarto de baño" |

---

## Componente UI: `PropertyDescriptionGenerator`

### Layout (Sheet lateral)

```
┌─────────────────────────────────────────┐
│  ✨ Gerar Descrição com IA         [X]  │
│─────────────────────────────────────────│
│                                         │
│  Dados do Imóvel (resumo auto)          │
│  ┌─────────────────────────────────┐    │
│  │ T3 Apartamento · Venda          │    │
│  │ Lisboa, Avenidas Novas          │    │
│  │ 106m² · 3 quartos · 1 WC       │    │
│  │ Cert. Energético: B             │    │
│  │ Ano: 1987 · Elevador · 6º piso │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Notas adicionais                       │
│  ┌─────────────────────────────────┐    │
│  │ Ex: Último andar com muita luz, │    │
│  │ armários embutidos em todos os  │    │
│  │ quartos, condomínio organizado  │    │
│  └─────────────────────────────────┘    │
│  [🎤 Gravar nota de voz]               │
│                                         │
│  Idioma    Tom                          │
│  [PT ▼]   [Profissional ▼]             │
│                                         │
│  [✨ Gerar Descrições]                  │
│                                         │
│─────────────────────────────────────────│
│  Variante A                     [Usar]  │
│  ┌─────────────────────────────────┐    │
│  │ Descubra este magnífico T3...   │    │
│  │ ...                             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Variante B                     [Usar]  │
│  ┌─────────────────────────────────┐    │
│  │ Apartamento T3 com 106m²...     │    │
│  │ ...                             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [🔄 Re-gerar]                         │
└─────────────────────────────────────────┘
```

### Regras de UI
- Dados do imóvel em card compacto read-only (auto-preenchido)
- Notas: textarea com placeholder explicativo
- Botão de voz: usa `MediaRecorder` → envia para `/api/properties/[id]/transcribe-notes` → preenche textarea
- Variantes: em cards com botão "Usar" que copia para `description` e fecha o sheet
- Streaming: texto aparece progressivamente (ReadableStream + `useChat` pattern ou manual SSE)
- "Re-gerar": nova chamada com os mesmos inputs
- Design: seguir padrão moderno (glassmorphic cards, pill buttons, dark accents)

---

## Regras de Negócio Específicas

### Arrendamento — Licença de Utilização
Este é um requisito legal em Portugal. Para anúncios de arrendamento:

1. Se `construction_year < 1951` → mencionar dispensa: "Dispensado de licença de utilização por ter sido inscrito na matriz antes de 1951, conforme o Decreto Lei nº 38382"
2. Se `construction_year >= 1951` → mencionar: "Imóvel com Licença de Utilização válida"
3. Se `construction_year` não preenchido → incluir nota genérica: "Licença de Utilização disponível mediante solicitação"

### Empreendimentos
Se o imóvel faz parte de um empreendimento (detectado via `extra_identification` ou notas):
- Incluir secção sobre o empreendimento
- Mencionar data de conclusão se disponível
- Enfatizar características do projecto (sustentabilidade, certificação, etc.)

### Campos que influenciam o estilo
| Campo | Impacto na descrição |
|-------|---------------------|
| `listing_price > 500k` | Tom mais premium automaticamente |
| `property_type = 'quinta'` | Enfatizar terreno, natureza, privacidade |
| `property_type = 'comercio'` | Linguagem de investimento, rentabilidade |
| `features[]` inclui piscina/jardim | Destacar lifestyle, lazer |
| `views[]` não vazio | Secção dedicada às vistas |
| `solar_orientation[]` | Mencionar luminosidade natural |

---

## Ficheiros a Criar/Modificar

### Novos
| Ficheiro | Descrição |
|----------|-----------|
| `app/api/properties/[id]/generate-description/route.ts` | API streaming com GPT-4o |
| `app/api/properties/[id]/transcribe-notes/route.ts` | Whisper para notas de voz |
| `components/properties/property-description-generator.tsx` | Sheet com o assistente completo |

### Modificar
| Ficheiro | Alteração |
|----------|-----------|
| `app/dashboard/imoveis/[id]/page.tsx` | Botão "Gerar com IA" junto à descrição |
| `components/processes/subtask-card-form.tsx` | Botão "Gerar com IA" na subtarefa de descrição |
| `components/processes/dynamic-form-renderer.tsx` | Suporte para rich_text fields com botão IA |

---

## Dependências

- `openai` (já instalado)
- Nenhuma dependência nova necessária

---

## Exemplos de Output Esperado

### Variante A (Descritiva/Emocional) — Venda

> **Apartamento T3 | Rua Gonçalves Crespo — Último Andar no Coração de Lisboa**
>
> Descubra este magnífico apartamento T3, localizado no **6.º e último piso** de um edifício de referência, com **dois elevadores**, na prestigiada **Rua Gonçalves Crespo** — uma das zonas mais centrais e valorizadas de Lisboa.
>
> Com uma **Área Bruta Privativa de 106,14 m²**, este imóvel destaca-se pela sua **excelente qualidade de construção**, pela luminosidade natural e pela distribuição funcional dos espaços...

### Variante B (Factual/Técnica) — Venda

> **T3 — Avenidas Novas, Lisboa | 106 m² | 6.º Andar com Elevador**
>
> **Características:**
> - Área bruta privativa: 106,14 m²
> - 3 quartos (13,44 m² / 10,12 m² / 9,19 m²)
> - Sala de estar: 21,73 m²
> - Cozinha: 8,00 m²
> - 1 casa de banho com banheira: 3,40 m²
> - Armários embutidos em todas as divisões
> - 2 elevadores
> ...

### Arrendamento (nota obrigatória)

> ...
> **Condições**
> * Valor de arrendamento: **4.970€ mensais**
> * Disponível para entrada imediata
>
> Dispensado de licença de utilização por ter sido inscrito na matriz antes de 1951, conforme o Decreto Lei nº 38382

---

## Estimativa de Tokens

| Componente | Tokens estimados |
|-----------|-----------------|
| System prompt | ~500 |
| Property data | ~300-500 |
| Notes | ~100-300 |
| Output (2 variantes) | ~1500-2500 |
| **Total por chamada** | **~2500-4000** |

Custo aproximado: ~$0.02-0.04 por geração (GPT-4o)
