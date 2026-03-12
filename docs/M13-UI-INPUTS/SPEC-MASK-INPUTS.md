# SPEC — Mask Inputs (Percentagem, Monetário, Data, Telefone)

> **Módulo:** M13 — UI Inputs
> **Data:** 2026-03-12
> **Estado:** Proposta
> **Dependência:** `@diceui/mask-input` via Dice UI registry

---

## 1. Contexto e Motivação

Actualmente, todos os inputs de percentagem, monetário, data e telefone no ERP usam `<Input type="number">` ou `<Input type="text">` sem qualquer máscara de formatação. Isto causa:

- **Valores monetários** sem separador de milhares (ex: "1234567" em vez de "1.234.567 €")
- **Percentagens** sem símbolo `%` e sem limite visual de 0–100
- **Datas** com mix inconsistente entre `type="date"` nativo e `<DatePicker>` customizado
- **Telefones** sem formatação, sem validação de padrão PT (+351)
- **UX degradada** — o utilizador não tem feedback visual imediato do formato esperado

### Solução

Adoptar o componente `MaskInput` do **Dice UI** (`@diceui/mask-input`) com padrões customizados para o contexto português. O Dice UI já está registado no projecto (`components.json`) mas o componente `mask-input` ainda não foi instalado.

---

## 2. Instalação

```bash
npx shadcn@latest add @diceui/mask-input
```

Isto cria `components/ui/mask-input.tsx` e instala `@radix-ui/react-slot` (se necessário). O ficheiro `lib/compose-refs.ts` já existe no projecto.

---

## 3. Padrões de Máscara Customizados (PT-PT)

### 3.1 Telefone Português

```typescript
// lib/masks.ts

import type { MaskPattern } from "@/components/ui/mask-input"

/**
 * Telefone PT: +351 9XX XXX XXX (telemóvel) ou +351 2XX XXX XXX (fixo)
 * Armazena apenas dígitos sem +351 (9 dígitos)
 * Exibe: +351 912 345 678
 */
export const phonePTMask: MaskPattern = {
  pattern: "+351 ### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 9),
  validate: (value) => value.length === 9,
}

/**
 * Telefone internacional genérico (máx 15 dígitos E.164)
 * Para contactos não-portugueses
 */
export const phoneInternationalMask: MaskPattern = {
  pattern: "+### ### ### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 15),
  validate: (value) => value.length >= 9 && value.length <= 15,
}
```

### 3.2 Percentagem

Usar o built-in `percentage` do Dice UI com ajustes:

```typescript
/**
 * Percentagem 0.00% – 100.00%
 * Dice UI built-in: mask="percentage"
 * Max 2 decimais, max valor 100
 */
// Uso directo:
<MaskInput
  mask="percentage"
  placeholder="0,00%"
  maskPlaceholder="__,__%"
  onValueChange={(masked, unmasked) => {
    // masked: "12,50%"
    // unmasked: "12.50" (sempre com ponto decimal)
    field.onChange(parseFloat(unmasked) || 0)
  }}
/>
```

Se o built-in `percentage` não suportar locale pt-PT (vírgula como decimal), criar custom:

```typescript
export const percentagePTMask: MaskPattern = {
  pattern: "##,##%",
  transform: (value) => {
    const digits = value.replace(/[^\d]/g, "")
    if (!digits) return ""
    const num = parseInt(digits, 10)
    if (num > 10000) return "10000" // max 100.00%
    return digits
  },
  validate: (value) => {
    const num = parseFloat(value.replace(",", "."))
    return !isNaN(num) && num >= 0 && num <= 100
  },
}
```

### 3.3 Monetário (EUR)

Usar o built-in `currency` do Dice UI com locale pt-PT:

```typescript
/**
 * Moeda EUR com formatação portuguesa
 * Exibe: 1.234,56 € (separador milhares: ponto, decimal: vírgula)
 */
<MaskInput
  mask="currency"
  currency="EUR"
  locale="pt-PT"
  placeholder="0,00 €"
  onValueChange={(masked, unmasked) => {
    // masked: "1.234,56 €"
    // unmasked: "1234.56"
    field.onChange(parseFloat(unmasked) || 0)
  }}
/>
```

### 3.4 Data (DD/MM/AAAA)

```typescript
/**
 * Data no formato português: DD/MM/AAAA
 * Padrão built-in "date" usa MM/DD/YYYY (US) — NÃO USAR directamente
 */
export const datePTMask: MaskPattern = {
  pattern: "##/##/####",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 8),
  validate: (value) => {
    if (value.length !== 8) return false
    const day = parseInt(value.slice(0, 2), 10)
    const month = parseInt(value.slice(2, 4), 10)
    const year = parseInt(value.slice(4, 8), 10)
    if (month < 1 || month > 12) return false
    if (day < 1 || day > 31) return false
    if (year < 1900 || year > 2100) return false
    // Validação completa com Date
    const d = new Date(year, month - 1, day)
    return d.getDate() === day && d.getMonth() === month - 1
  },
}
```

**Nota:** Este MaskInput de data serve como **alternativa inline** para campos onde o `<DatePicker>` (calendário popup) não é necessário ou desejado. Os dois podem coexistir — usar `<DatePicker>` para campos de data principais e `MaskInput` com `datePTMask` para campos secundários ou contextos compactos.

---

## 4. Componente Wrapper: `<MaskedFormField>`

Para evitar repetição em formulários react-hook-form, criar um componente wrapper:

```typescript
// components/shared/masked-form-field.tsx
"use client"

import { MaskInput, type MaskPattern, type MaskPatternKey } from "@/components/ui/mask-input"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import type { Control, FieldPath, FieldValues } from "react-hook-form"

interface MaskedFormFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  mask: MaskPatternKey | MaskPattern
  placeholder?: string
  maskPlaceholder?: string
  description?: string
  disabled?: boolean
  currency?: string
  locale?: string
  /** Função para converter unmasked → valor do form (ex: parseFloat) */
  parse?: (unmasked: string) => unknown
}

export function MaskedFormField<T extends FieldValues>({
  control,
  name,
  label,
  mask,
  placeholder,
  maskPlaceholder,
  description,
  disabled,
  currency,
  locale,
  parse,
}: MaskedFormFieldProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <MaskInput
              mask={mask}
              placeholder={placeholder}
              maskPlaceholder={maskPlaceholder}
              disabled={disabled}
              currency={currency}
              locale={locale}
              value={field.value != null ? String(field.value) : ""}
              onValueChange={(_masked, unmasked) => {
                if (parse) {
                  field.onChange(parse(unmasked))
                } else {
                  field.onChange(unmasked)
                }
              }}
              onBlur={field.onBlur}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
```

---

## 5. Ficheiro Central de Máscaras

```typescript
// lib/masks.ts
import type { MaskPattern } from "@/components/ui/mask-input"

// ─── Telefone ────────────────────────────────────────────
export const phonePTMask: MaskPattern = {
  pattern: "+351 ### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 9),
  validate: (value) => value.length === 9,
}

export const phoneInternationalMask: MaskPattern = {
  pattern: "+### ### ### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 15),
  validate: (value) => value.length >= 9 && value.length <= 15,
}

// ─── Data PT ─────────────────────────────────────────────
export const datePTMask: MaskPattern = {
  pattern: "##/##/####",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 8),
  validate: (value) => {
    if (value.length !== 8) return false
    const day = parseInt(value.slice(0, 2), 10)
    const month = parseInt(value.slice(2, 4), 10)
    const year = parseInt(value.slice(4, 8), 10)
    if (month < 1 || month > 12 || day < 1 || day > 31) return false
    if (year < 1900 || year > 2100) return false
    const d = new Date(year, month - 1, day)
    return d.getDate() === day && d.getMonth() === month - 1
  },
}

// ─── NIF / NIPC ──────────────────────────────────────────
export const nifMask: MaskPattern = {
  pattern: "### ### ###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 9),
  validate: (value) => value.length === 9,
}

// ─── IBAN PT ─────────────────────────────────────────────
export const ibanPTMask: MaskPattern = {
  pattern: "PT50 #### #### #### #### #### #",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 21),
  validate: (value) => value.length === 21,
}

// ─── Código Postal PT ────────────────────────────────────
export const postalCodePTMask: MaskPattern = {
  pattern: "####-###",
  transform: (value) => value.replace(/[^\d]/g, "").slice(0, 7),
  validate: (value) => value.length === 7,
}

// ─── Helpers de parse ────────────────────────────────────
export const parseFloat0 = (v: string) => parseFloat(v) || 0
export const parseFloatOrNull = (v: string) => {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}
export const parseFloatOrUndefined = (v: string) => {
  const n = parseFloat(v)
  return isNaN(n) ? undefined : n
}

/**
 * Converte string de data DD/MM/AAAA para ISO YYYY-MM-DD
 */
export function datePTtoISO(datePT: string): string {
  const digits = datePT.replace(/[^\d]/g, "")
  if (digits.length !== 8) return ""
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  return `${year}-${month}-${day}`
}

/**
 * Converte ISO YYYY-MM-DD para DD/MM/AAAA (para popular o MaskInput)
 */
export function isoToDatePT(iso: string): string {
  if (!iso) return ""
  const parts = iso.split("-")
  if (parts.length !== 3) return ""
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}
```

---

## 6. Campos Impactados por Componente

### 6.1 `property-form.tsx` — Formulário de Imóvel

| Campo | Actual | Novo | Máscara |
|-------|--------|------|---------|
| `listing_price` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `1.234,56 €` |
| `commission_agreed` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `1.234,56 €` |
| `imi_value` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `1.234,56 €` |
| `condominium_fee` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `1.234,56 €` |
| `cpcv_percentage` | `<Input type="number" max={100}>` | `<MaskInput mask="percentage">` | `12,50%` |
| `contract_expiry` | `<Input type="date">` | `<MaskInput mask={datePTMask}>` ou manter `<DatePicker>` | `25/12/2026` |
| `postal_code` | `<Input type="text">` | `<MaskInput mask={postalCodePTMask}>` | `1234-567` |

### 6.2 `consultant-form.tsx` — Formulário de Consultor

| Campo | Actual | Novo | Máscara |
|-------|--------|------|---------|
| `monthly_salary` | `<Input type="number">` + "EUR/mês" description | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `1.234,56 €` |
| `commission_rate` | `<Input type="number">` + "%" description | `<MaskInput mask="percentage">` | `12,50%` |
| `hiring_date` | `<Input type="date">` | `<MaskInput mask={datePTMask}>` ou `<DatePicker>` | `25/12/2026` |
| `phone_commercial` | `<Input type="tel">` | `<MaskInput mask={phonePTMask}>` | `+351 912 345 678` |
| `nif` | `<Input>` | `<MaskInput mask={nifMask}>` | `123 456 789` |
| `iban` | `<Input>` | `<MaskInput mask={ibanPTMask}>` | `PT50 1234 5678 ...` |

### 6.3 `owner-form.tsx` — Formulário de Proprietário

| Campo | Actual | Novo | Máscara |
|-------|--------|------|---------|
| `phone` | `<Input>` (texto livre) | `<MaskInput mask={phonePTMask}>` | `+351 912 345 678` |
| `nif` | `<Input maxLength={9}>` | `<MaskInput mask={nifMask}>` | `123 456 789` |
| `birth_date` | `<DatePicker>` | Manter `<DatePicker>` (campo principal) | — |
| `id_doc_expiry` | `<DatePicker>` | Manter `<DatePicker>` (campo principal) | — |
| `ownership_percentage` | `<Input type="number">` | `<MaskInput mask="percentage">` | `50,00%` |

### 6.4 `lead-form.tsx` — Formulário de Lead

| Campo | Actual | Novo | Máscara |
|-------|--------|------|---------|
| `telefone` | `<Input>` | `<MaskInput mask={phonePTMask}>` | `+351 912 345 678` |
| `telemovel` | `<Input>` | `<MaskInput mask={phonePTMask}>` | `+351 912 345 678` |

### 6.5 `negocio-form.tsx` — Formulário de Negócio

| Campo | Actual | Novo | Máscara |
|-------|--------|------|---------|
| `orcamento` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `250.000 €` |
| `preco_venda` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `350.000 €` |
| `renda_mensal` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `1.200 €` |
| `valor_credito` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `200.000 €` |
| `capital_proprio` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `50.000 €` |
| `caucao_rendas` | `<Input type="number">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `2.400 €` |

### 6.6 `acquisition-field.tsx` / Steps de Angariação

| Campo | Actual | Novo | Máscara |
|-------|--------|------|---------|
| Campos com `suffix="€"` | `<AcqInputField suffix="€">` | `<MaskInput mask="currency" currency="EUR" locale="pt-PT">` | `1.234 €` |
| Campos com `suffix="%"` | `<AcqInputField suffix="%">` | `<MaskInput mask="percentage">` | `5,00%` |
| `nif` | `<AcqInputField>` | `<MaskInput mask={nifMask}>` | `123 456 789` |
| `telefone` / `phone` | `<AcqInputField type="tel">` | `<MaskInput mask={phonePTMask}>` | `+351 912 345 678` |
| `postal_code` | `<AcqInputField>` | `<MaskInput mask={postalCodePTMask}>` | `1234-567` |

### 6.7 Detalhe de Lead (tabs de edição inline)

| Campo | Actual | Novo | Máscara |
|-------|--------|------|---------|
| `nif` | `<Input maxLength={9}>` | `<MaskInput mask={nifMask}>` | `123 456 789` |
| `telefone_empresa` | `<Input>` | `<MaskInput mask={phonePTMask}>` | `+351 212 345 678` |

---

## 7. Validações Zod — Ajustes Necessários

O `MaskInput` com `onValueChange` devolve `unmasked` (string limpa). As validações Zod devem aceitar strings e fazer coerção:

### Monetário

```typescript
// Antes:
listing_price: z.coerce.number().positive()

// Depois (sem alteração necessária — parseFloat no parse já converte):
listing_price: z.coerce.number().positive()
// O parse do MaskedFormField já converte "1234.56" → 1234.56
```

### Percentagem

```typescript
// Sem alteração necessária — parse converte:
cpcv_percentage: z.coerce.number().min(0).max(100)
```

### Telefone

```typescript
// Antes:
phone: z.string().optional()

// Depois — validar 9 dígitos:
phone: z.string()
  .regex(/^\d{9}$/, "Telefone deve ter 9 dígitos")
  .optional()
  .or(z.literal(""))
```

### NIF

```typescript
// Já está correcto:
nif: z.string().min(9).max(9)
// MaskInput devolve "123456789" (9 dígitos sem espaços)
```

### Data

```typescript
// Antes (ISO string):
contract_expiry: z.string().optional()

// Se usar MaskInput em vez de DatePicker, converter com datePTtoISO():
// O parse do campo converte DD/MM/AAAA → YYYY-MM-DD antes de submeter
```

---

## 8. Estratégia de Migração

### Fase 1 — Setup (sem quebras)
1. Instalar `@diceui/mask-input` via CLI
2. Criar `lib/masks.ts` com todos os padrões PT
3. Criar `components/shared/masked-form-field.tsx`
4. Testar isoladamente com um campo (ex: `listing_price` no property-form)

### Fase 2 — Campos Monetários
Migrar todos os `<Input type="number">` de valores monetários para `<MaskInput mask="currency">`:
- `property-form.tsx` (4 campos)
- `consultant-form.tsx` (1 campo)
- `negocio-form.tsx` (6 campos)
- Steps de angariação (vários campos com `suffix="€"`)

### Fase 3 — Campos de Percentagem
Migrar inputs de percentagem para `<MaskInput mask="percentage">`:
- `property-form.tsx` (1 campo)
- `consultant-form.tsx` (1 campo)
- `owner-form.tsx` (1 campo)
- Steps de angariação (campos com `suffix="%"`)

### Fase 4 — Telefone
Migrar inputs de telefone para `<MaskInput mask={phonePTMask}>`:
- `owner-form.tsx` (1 campo)
- `consultant-form.tsx` (1 campo)
- `lead-form.tsx` (2 campos)
- Steps de angariação (campos de telefone)
- Detalhe de lead (1 campo)

### Fase 5 — Data (Selectivo)
Migrar **apenas** os `<Input type="date">` nativos para `<MaskInput mask={datePTMask}>`. Manter `<DatePicker>` onde já é usado:
- `property-form.tsx` — `contract_expiry`
- `consultant-form.tsx` — `hiring_date`

### Fase 6 — Bónus (NIF, IBAN, Código Postal)
Campos adicionais que beneficiam de máscara:
- NIF: `owner-form.tsx`, `lead [id]/page.tsx`, steps de angariação
- IBAN: `consultant-form.tsx`
- Código Postal: `property-form.tsx`, steps de angariação

---

## 9. Armazenamento no DB — Regras

| Tipo | Valor armazenado | Exemplo |
|------|-------------------|---------|
| Monetário | `numeric` (número puro) | `1234.56` |
| Percentagem | `numeric` (0–100) | `12.5` |
| Telefone | `text` (9 dígitos, sem +351) | `"912345678"` |
| Data | `text` ISO (YYYY-MM-DD) ou `date` | `"2026-12-25"` |
| NIF | `text` (9 dígitos, sem espaços) | `"123456789"` |
| IBAN | `text` (21 dígitos, sem espaços/PT50) | `"123456789012345678901"` |
| Código Postal | `text` (7 dígitos, sem hífen) ou `"1234-567"` | Manter formato actual |

**Regra geral:** O `MaskInput` formata para o utilizador. O `onValueChange(masked, unmasked)` devolve `unmasked` que é o valor limpo para persistir.

---

## 10. Testes e Verificação

### Cenários a validar por tipo:

**Monetário:**
- [ ] Digitar "1234567" → exibe "1.234.567 €"
- [ ] Colar "1234.56" → exibe "1.234,56 €"
- [ ] Campo vazio → submete `null` ou `undefined`
- [ ] Valor guardado no DB é `numeric` correcto

**Percentagem:**
- [ ] Digitar "1250" → exibe "12,50%"
- [ ] Tentar digitar > 100 → bloqueado ou corrigido
- [ ] Campo vazio → submete `0` ou `undefined`

**Telefone:**
- [ ] Digitar "912345678" → exibe "+351 912 345 678"
- [ ] Colar "+351912345678" → formata correctamente
- [ ] Aceitar apenas 9 dígitos após +351
- [ ] Submissão guarda "912345678" (sem +351)

**Data:**
- [ ] Digitar "25122026" → exibe "25/12/2026"
- [ ] Validar dia/mês impossíveis (32/13/2026 → inválido)
- [ ] Submissão guarda ISO "2026-12-25"

---

## 11. Ficheiros Criados/Modificados

### Novos ficheiros:
| Ficheiro | Descrição |
|----------|-----------|
| `components/ui/mask-input.tsx` | Componente Dice UI (gerado pelo CLI) |
| `lib/masks.ts` | Padrões de máscara PT-PT + helpers |
| `components/shared/masked-form-field.tsx` | Wrapper para react-hook-form |

### Ficheiros modificados:
| Ficheiro | Alteração |
|----------|-----------|
| `components/properties/property-form.tsx` | 7 campos → MaskInput |
| `components/consultants/consultant-form.tsx` | 5 campos → MaskInput |
| `components/owners/owner-form.tsx` | 3 campos → MaskInput |
| `components/leads/lead-form.tsx` | 2 campos → MaskInput |
| `components/negocios/negocio-form.tsx` | 6 campos → MaskInput |
| `components/acquisitions/acquisition-field.tsx` | Possível refactor ou campo-a-campo |
| `app/dashboard/leads/[id]/page.tsx` | 2 campos inline → MaskInput |
| `lib/validations/property.ts` | Ajustar telefone regex (se aplicável) |
| `lib/validations/lead.ts` | Adicionar regex telefone |
| `lib/validations/owner.ts` | Adicionar regex telefone |
| `lib/validations/consultant.ts` | Adicionar regex telefone |

### Ficheiros NÃO alterados:
- `components/ui/input.tsx` — mantém-se inalterado
- `components/ui/date-picker.tsx` — mantém-se para campos com calendário
- `lib/utils.ts` — `formatCurrency()` e `formatDate()` mantêm-se para contextos de display (tabelas, cards)

---

## 12. Decisões de Design

| Decisão | Escolha | Justificação |
|---------|---------|--------------|
| Biblioteca de masking | Dice UI `mask-input` | Já usa Dice UI registry; integra com shadcn/ui; suporte currency via `Intl.NumberFormat` |
| DatePicker vs MaskInput data | Coexistem | DatePicker para campos de data principais (calendário); MaskInput para datas inline/compactas |
| Telefone: guardar com ou sem +351 | Sem +351 (9 dígitos) | Consistência com dados existentes no DB; +351 é puramente visual |
| Percentagem: built-in vs custom | Testar built-in primeiro | Se `mask="percentage"` suportar locale pt-PT, usar; caso contrário, custom `percentagePTMask` |
| AcqInputField: manter ou migrar | Migrar campo a campo | Substituir `suffix="€"` e `suffix="%"` por MaskInput; manter AcqInputField para campos texto simples |
| Wrapper genérico | Sim (`MaskedFormField`) | Reduz boilerplate nos 25+ campos a migrar |
