# Padrão Portável: "Calcular por defeito, editar como um Excel"

> **Spec reutilizável (estilo CLAUDE.md).** Copia este ficheiro para outro projecto quando
> precisares do mesmo modelo: o sistema **calcula automaticamente** (cobre ~90% dos casos)
> mas **cada valor calculado é editável/sobreponível** em todas as superfícies, sem perder a
> automação. Implementação de referência: módulo **financeiro** do ERP Infinity (negócios →
> `deal_payments` / `deal_payment_splits` → mapa de gestão + fecho + tabs imóvel/negócio).

---

## 1. O problema que isto resolve

Tens valores derivados de uma fórmula (comissões, repartições, faturas, payouts, preços,
escalões…). A automação acerta na esmagadora maioria dos casos. Mas:

- Há sempre o **caso atípico** (~10%) em que a fórmula não bate com a realidade negociada.
- O utilizador quer **mexer manualmente** — editar, apagar, **criar novas linhas** — e que isso
  **se propague a todo o lado** instantaneamente, como num Excel partilhado.
- Não se pode **perder a automação**: o valor calculado tem de continuar lá por baixo, e tem
  de ser possível **voltar ao automático** ou **recalcular** quando os dados base mudam.

A tentação errada é deixar cada ecrã recalcular à sua maneira e depois "editar no ecrã". Isso
**diverge**: editas no ecrã A, o ecrã B continua a mostrar o valor calculado. O padrão abaixo
evita isso por construção.

---

## 2. Princípio central (a regra de ouro)

> **Um override só é "consistente em todo o lado" se todas as superfícies lerem a MESMA linha
> canónica.** Põe o override na linha de dados (a fonte da verdade), nunca por ecrã.

Daqui saem **4 invariantes** que tornam o padrão correcto:

1. **Fonte única da verdade.** Existe 1 (ou 2) tabela(s) canónica(s) onde vivem os valores
   calculados. *Todas* as superfícies — listagens, detalhes, passos de processo, faturação —
   resolvem para essas linhas. Se alguma superfície recalcula por conta própria, **colapsa-a
   primeiro** para ler a fonte única antes de adicionar edição.

2. **Coalesce num único builder.** O cálculo de leitura ("quem recebe o quê", "quanto é") vive
   numa **única função partilhada**. Essa função faz `override ?? calculado` por campo. Mudas
   o builder uma vez → o override aparece em todas as superfícies de graça.

3. **Auditar cada edição.** Dinheiro precisa de rasto. Cada edição/criação/eliminação/recálculo
   escreve numa tabela **append-only** (quem, quando, porquê, valor antigo → novo). Sem isto,
   uma correcção manual é indistinguível de um bug.

4. **Proteger dinheiro já liquidado.** Um valor que já foi **faturado** (reportado ao fisco),
   **recebido** (lançado na contabilidade) ou **pago** não pode ser silenciosamente alterado. O
   override é bloqueado nesses estados com mensagem clara (caminho legal = nota de crédito /
   desmarcar estado / transacção correctiva).

---

## 3. Receita de schema (aditiva, nunca destrutiva)

Para cada coluna calculada `x`, adiciona **`x_override`** (mesmo tipo, **nullable**). `NULL` =
"usar o automático". Valor presente = "o humano mandou isto".

```sql
-- Tabela "cabeçalho" do valor (ex.: deal_payments — um momento de pagamento)
ALTER TABLE <linha_canonica> ADD COLUMN amount_override        numeric;
ALTER TABLE <linha_canonica> ADD COLUMN <campoN>_override      numeric;   -- 1 por campo editável
ALTER TABLE <linha_canonica> ADD COLUMN amounts_locked         boolean NOT NULL DEFAULT false; -- recálculo salta esta linha
ALTER TABLE <linha_canonica> ADD COLUMN override_reason        text;
ALTER TABLE <linha_canonica> ADD COLUMN override_by            uuid;      -- actor
ALTER TABLE <linha_canonica> ADD COLUMN override_at            timestamptz;

-- Tabela "linha" da repartição (ex.: deal_payment_splits — uma parte/interveniente)
ALTER TABLE <linha_detalhe> ADD COLUMN amount_override   numeric;
ALTER TABLE <linha_detalhe> ADD COLUMN <pct>_override    numeric;
ALTER TABLE <linha_detalhe> ADD COLUMN is_manual         boolean NOT NULL DEFAULT false; -- criada à mão (não recalcular)
ALTER TABLE <linha_detalhe> ADD COLUMN is_deleted        boolean NOT NULL DEFAULT false; -- soft-delete (preserva auditoria)
ALTER TABLE <linha_detalhe> ADD COLUMN manual_label      text;   -- p/ intervenientes sem FK (externos)
ALTER TABLE <linha_detalhe> ALTER COLUMN <fk_agente> DROP NOT NULL; -- permitir parte manual sem agente real
ALTER TABLE <linha_detalhe> ADD COLUMN override_reason   text;
ALTER TABLE <linha_detalhe> ADD COLUMN override_by       uuid;
ALTER TABLE <linha_detalhe> ADD COLUMN override_at       timestamptz;

-- Log append-only (service-role only: RLS ON, sem policies)
CREATE TABLE <prefixo>_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid,
  payment_id  uuid,
  split_id    uuid,
  entity      text NOT NULL,          -- 'payment' | 'split'
  action      text NOT NULL,          -- 'edit'|'create'|'delete'|'restore'|'clear'|'lock'|'recompute'
  field       text,                   -- campo alterado (NULL p/ create/delete)
  old_value   jsonb,
  new_value   jsonb,
  reason      text,
  actor_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE <prefixo>_overrides ENABLE ROW LEVEL SECURITY; -- sem policies = só service_role
```

**Porquê `is_deleted` (soft) e não `DELETE`:** mantém o rasto de auditoria e permite "Repor".
**Porquê `is_manual`:** distingue linhas que o recálculo pode regenerar das que foram criadas à
mão (que ele deve preservar).
**Porquê `amounts_locked`:** marca o cabeçalho como "tem edição manual" → o recálculo salta-o.

---

## 4. Read path — coalesce no builder único

Regra mecânica: em cada sítio onde lês o valor, troca `x` por `x_override ?? x`, e **filtra**
as linhas `is_deleted`.

```ts
const eff = (override: number|null, auto: number|null) =>
  override != null ? Number(override) : Number(auto ?? 0)

function buildRows(header, detailLines, ctx) {
  return detailLines
    .filter(d => !d.is_deleted)                      // soft-delete
    .map(d => {
      const amount = eff(d.amount_override, d.amount) // override ?? auto
      const pct    = eff(d.pct_override, d.pct)
      const headerAmount = eff(header.amount_override, header.amount)
      return {
        amount,
        amount_auto: Number(d.amount),                // p/ mostrar o calculado esbatido
        amount_is_override: d.amount_override != null,
        is_manual: d.is_manual,
        // … restantes campos, sempre via eff(...)
      }
    })
}
```

**Importante:** o builder pode estar a **derivar** alguns campos (ex.: escalar a margem da
agência pela % de partilha). Coalesce a **base** *antes* da derivação — senão o override fica
invisível. Expõe na linha de saída tanto o **valor efectivo** (o que mostras) como o
**valor automático** (`*_auto`) e um booleano `*_is_override`, para a UI mostrar "calculado
esbatido ao lado do override" e o badge de override.

Garante que **todos** os SELECTs que alimentam o builder pedem as colunas `_override`,
`is_manual`, `is_deleted`, `amounts_locked`. SELECTs com `*` apanham-nas automaticamente; listas
explícitas de colunas têm de ser actualizadas uma a uma.

---

## 5. Write path — server actions (todas gated + auditadas)

Uma acção por operação. Todas: (1) gate de permissão, (2) fetch da linha p/ guard, (3) **guard
de dinheiro liquidado**, (4) escrita do override + campos de auditoria, (5) `log_override(...)`.

| Acção | O que faz |
|---|---|
| `setHeaderOverride(id, {field, value|null, reason})` | grava `field_override`; `amounts_locked=true`; auditoria |
| `clearHeaderOverride(id, {field?})` | repõe automático (`NULL`); se nada fica override → `amounts_locked=false` |
| `setLineOverride(id, {amount?, pct?, reason})` | grava override na linha; auditoria |
| `createManualLine(headerId, {agent_id?\|manual_label, role, amount, pct, reason})` | INSERT `is_manual=true`; auditoria `create` |
| `deleteLine(id, {reason})` | `is_deleted=true` (soft); auditoria `delete` |
| `restoreLine(id)` | `is_deleted=false`; auditoria `restore` |
| `recalc(parentId, {force?})` | recalcula linhas **não** locked/manual/override; devolve `{updated, skipped[]}` |

**Guard de dinheiro liquidado (o ponto mais importante):**

```ts
if (header.invoice_status === ISSUED || header.invoice_status === CREDITED)
  return fail('Fatura já emitida/reportada — usa nota de crédito / re-emissão.')
if (header.is_received)            // já lançado na contabilidade
  return fail('Pagamento já recebido — desmarca "Recebido" antes de alterar o valor.')
if (line.is_paid)                  // payout já efectuado
  return fail('Já pago — desmarca o pagamento antes de editar.')
```

Edições de **estado/nº de fatura/datas** continuam livres; o guard só trava **montantes** que
alimentam documentos fiscais / lançamentos contabilísticos já materializados.

---

## 6. Recompute semantics (a decisão de produto)

Quando os dados base mudam (valor do negócio, % de comissão), o `recalc`:

- **Preserva** linhas com `is_manual`, `*_override` ou `amounts_locked` (as edições do humano
  ganham).
- **Recalcula** as restantes a partir da função de cálculo partilhada.
- **Nunca** toca em linhas com dinheiro liquidado (faturado/recebido/pago) — nem com `force`.
- Devolve a lista de linhas **saltadas** → a UI mostra "X linhas preservadas (edição manual)".
- `force: true` recalcula também as overridden (excepto liquidadas), com confirmação explícita
  do tipo *"recalcular incluindo as edições manuais (perde as alterações)"*.

> Regra prática: **preservar + avisar**, com escotilha de fuga `force`. Nunca apagar overrides
> em silêncio; nunca recalcular dinheiro já assente.

**Cálculo partilhado:** extrai a fórmula para **uma** função pura
(`computeFinancials(base, settings) → { headerRows, lineRows }`) e usa-a **tanto na criação
inicial como no recalc**. Se forem dois sítios diferentes, divergem.

---

## 7. Regra de wiring por superfície

Para cada ecrã onde o valor aparece:

1. **Encontra o builder/componente partilhado** que já o renderiza (não dupliques).
2. Se ele recalcula localmente → **colapsa-o** para o builder único primeiro.
3. Adiciona o affordance de edição (input inline / secção "Sobrescrita") que chama a server
   action. Como todas as superfícies lêem o builder coalescido, a edição num ecrã aparece
   idêntica nos outros **sem código extra**.
4. Mostra **badge de override** + valor automático esbatido + acção "repor automático".
5. Onde há repartição, mostra o **indicador de reconciliação** (ver §8).

Implementação de referência (ERP Infinity) — as 5 superfícies colapsam em poucos ficheiros
porque partilham builder/componentes:

| Superfície | Ficheiro | Partilha |
|---|---|---|
| Mapa de gestão (grelha, Visão Geral) | `components/financial/mapa-gestao-tab.tsx` | builder |
| Mapa de gestão (sheet de linha) | `components/financial/sheets/mapa-row-sheet.tsx` | builder |
| Fecho · "Pagar às partes" | `components/processes/subtask-card-pay-parties.tsx` + `app/api/deals/[id]/payout-breakdown` | **mesmo builder** |
| Tabs imóvel/negócio | `components/financial/deal-financeiro-panel.tsx` (3 páginas) | **mesmo componente** |
| Fecho · "Emitir fatura" | `lib/processes/neg/derive-fatura-target.ts` + painel Moloni | lê o override |
| **Builder canónico** | `lib/financial/build-mapa-rows.ts` (`buildMapaRowsFromPayment`) | — |
| **Server actions** | `app/dashboard/financeiro/deals/actions.ts` | — |

---

## 8. Indicador de reconciliação (edição livre, aviso não-bloqueante)

Quando as partes são independentemente editáveis, **não** forces a soma a bater. Em vez disso
mostra ao vivo:

```
Σ partes vs total disponível → "falta distribuir 350 €" / "sobra 120 €" / "✓ certo"
```

Edição livre (cada montante é independente) + badge de aviso quando não reconcilia, mas **nunca
bloqueia** guardar. Dá poder ao utilizador sem o prender. (Alternativas — auto-rebalancear as
outras partes, ou a margem da casa absorver a diferença — são opções de produto; o default
recomendado é **edição livre + aviso**.)

---

## 9. Gotchas / armadilhas de correcção monetária

1. **Builder que re-deriva ignora o stored.** Se o builder recalcula um campo a partir de %
   em vez de ler o valor guardado, o teu override no valor guardado fica invisível. Coalesce a
   **base** antes da derivação.
2. **Idempotência de lançamentos no "recebido".** Se ao marcar recebido se cria 1 transacção de
   receita (`reference_type+reference_id` único), um override **posterior** do montante deixa
   essa transacção **desactualizada**. → bloqueia override depois de recebido, ou emite
   transacção correctiva.
3. **Fatura já emitida (reportada ao fisco).** Imutável; só nota de crédito → re-emissão. Override
   não pode divergir do documento emitido.
4. **Somas que deixam de fechar.** Edições manuais podem partir `Σ partes = total`. Mostra o
   indicador (§8); decide a política de reconciliação.
5. **Dois escritores no mesmo campo.** Se o mesmo campo é editável em vários sítios (+ pré-preen-
   chido por outra rotina), é last-write-wins. Considera check de `updated_at` optimista.
6. **`NULL` ≠ `0`.** `x_override = NULL` significa "usar automático", **não** "zero". Nunca
   faças default do override a 0.

---

## 10. Checklist para aplicar a um novo domínio

- [ ] Identifica a(s) tabela(s) canónica(s) e confirma que **todas** as superfícies lêem de lá.
- [ ] Localiza/cria o **builder único** de leitura; colapsa superfícies que recalculam sozinhas.
- [ ] Migration aditiva: `*_override` por campo, `is_manual`, `is_deleted`, `*_locked`, auditoria
      `_overrides`, FK do agente nullable + `manual_label`.
- [ ] Builder: `override ?? auto`, filtra `is_deleted`, expõe `*_auto` + `*_is_override`.
- [ ] Actualiza todos os SELECTs de colunas explícitas com os novos campos.
- [ ] Extrai a fórmula para 1 função pura partilhada por criação + recalc.
- [ ] Server actions: set/clear (header+line), create/delete/restore, recalc(force) — todas
      gated + **auditadas** + com **guard de dinheiro liquidado**.
- [ ] UI por superfície: input inline / secção override, badge, valor automático esbatido, repor.
- [ ] Indicador de reconciliação onde há repartição.
- [ ] Recompute: preservar + avisar + escotilha `force`; nunca tocar em liquidado.
- [ ] Verificação adversarial: editar num ecrã → confirmar idêntico nos outros; recalc preserva
      overrides; guards bloqueiam faturado/recebido/pago.

---

*Referência: ERP Infinity — `deal_payments`/`deal_payment_splits` canónicos, `buildMapaRowsFromPayment`
como builder único, `app/dashboard/financeiro/deals/actions.ts` para as mutações, migration
`*_deal_payment_overrides.sql`. Ver também `moloni-integration-portable-spec.md` para o lado
da faturação fiscal (nota de crédito / re-emissão) que o guard de §5/§9 referencia.*
