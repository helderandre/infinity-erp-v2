# IMPL-AUTO-F2-DESVIOS — Desvios da Spec na Implementação da Fase 2

**Data:** 2026-03-05
**Status:** Implementado com sucesso
**Referência:** SPEC-AUTO-F2-TIPOS-VARIAVEIS.md

---

## Desvio 1: AutomationNode e AutomationEdge sem dependência de @xyflow/react

**Spec original:** Os tipos `AutomationNode` e `AutomationEdge` importam de `@xyflow/react`:
```typescript
import type { Node, Edge } from "@xyflow/react"
export type AutomationNode = Node<AutomationNodeData, AutomationNodeType>
export type AutomationEdge = Edge
```

**Implementação:** Definidos como interfaces próprias sem dependência de `@xyflow/react`:
```typescript
export interface AutomationNode {
  id: string
  type: AutomationNodeType
  position: { x: number; y: number }
  data: AutomationNodeData
}
export interface AutomationEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
}
```

**Motivo:** O pacote `@xyflow/react` ainda não está instalado (será instalado na Fase 5 — Editor Visual). Definir interfaces compatíveis evita bloquear a Fase 2 e permite que os tipos sejam usados imediatamente pelas fases 3, 4 e 6. Na Fase 5, estes tipos serão actualizados para usar os tipos nativos do React Flow.

---

## Desvio 2: WebhookFieldMapping duplicada entre ficheiros

**Spec original:** `WebhookFieldMapping` definida apenas em `lib/webhook-mapping.ts` e importada por `automation-flow.ts`.

**Implementação:** `WebhookFieldMapping` está definida em ambos os ficheiros (`lib/types/automation-flow.ts` e `lib/webhook-mapping.ts`), com a mesma estrutura.

**Motivo:** Evitar dependência circular. O `automation-flow.ts` (tipos) é importado por muitos ficheiros. Se ele importasse de `webhook-mapping.ts` (lógica), criaria um acoplamento indesejado entre tipos e lógica de negócio. Na Fase 5, quando o código estiver mais estabilizado, pode-se consolidar num único local.

---

## Desvio 3: API de variáveis usa `static_value` em vez de `sample_value`

**Spec original:** Sugere que o dropdown de variáveis mostra "valores de exemplo" ao lado de cada variável.

**Implementação:** A rota `GET /api/automacao/variaveis` retorna `static_value` da tabela `tpl_variables` como `sampleValue`.

**Motivo:** A tabela `tpl_variables` não tem coluna `sample_value`. Tem `static_value` que serve para variáveis com valor fixo (como `data_actual`, `empresa_nome`). Para variáveis dinâmicas (como `lead_nome`), o `static_value` é null e o campo `sampleValue` fica vazio no frontend.

---

## Desvio 4: API de variáveis filtra por `is_active`

**Spec original:** Não menciona filtro de variáveis activas/inactivas.

**Implementação:** A rota `GET /api/automacao/variaveis` filtra `.eq("is_active", true)`.

**Motivo:** A tabela `tpl_variables` tem coluna `is_active`. Faz sentido não mostrar variáveis desactivadas no seletor, para não confundir o utilizador.

---

## Verificação dos Critérios de Aceitação

| Critério | Resultado |
|----------|-----------|
| `npx tsc --noEmit` passa sem erros | OK |
| Todos os tipos exportados correctamente | OK — 14 node data interfaces, union type, flow definition |
| `renderTemplate("Olá {{nome}}", { nome: "João" })` retorna `"Olá João"` | OK |
| `renderTemplate("{{nome\|Cliente}}", {})` retorna `"Cliente"` | OK |
| `extractVariables("{{a}} {{b\|x}} {{#se c}}{{/se}}")` retorna `["a", "b", "c"]` | OK |
| `evaluateCondition` com equals retorna true/false correcto | OK |
| `resolveWebhookMapping` extrai valores por path | OK |
| `extractAllPaths({a:{b:1}})` retorna entries para "a" e "a.b" | OK |
| Mapas de cores cobrem todos os 14 tipos de node | OK |
| Variable picker carrega variáveis da API | OK |

---

## Ficheiros Criados (8)

1. `lib/types/automation-flow.ts` — Tipos de nodes, edges, flow definition, mapas de cores
2. `lib/types/whatsapp-template.ts` — Tipos de templates e instâncias WhatsApp
3. `lib/template-engine.ts` — Motor de renderização de variáveis com condicionais
4. `lib/condition-evaluator.ts` — Avaliador de condições (and/or, 10 operadores)
5. `lib/webhook-mapping.ts` — Mapeamento de webhook payload para variáveis
6. `lib/retry.ts` — Retry com exponential backoff + jitter
7. `app/api/automacao/variaveis/route.ts` — API GET de variáveis do sistema
8. `components/automations/variable-picker.tsx` — Seletor visual com pills coloridas
