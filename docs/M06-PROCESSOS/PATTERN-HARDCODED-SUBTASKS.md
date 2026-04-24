# Pattern: Hardcoded Subtasks em Processos

**Entregue via:** `openspec/changes/add-hardcoded-process-subtasks` (2026-05-01)
**Evolução:** split-armazenar-documentos + grouped view (2026-05-02) — adiciona `personTypeFilter`, `hint`, `<GroupedSubtasksView>`, estratégia de split de tasks sem quebrar FKs.
**Mantenedor:** módulo M06-PROCESSOS
**Aplicabilidade:** qualquer processo com subtarefas cujo comportamento varia por passo (email específico, geração de doc, validação KYC por proprietário, etc.) e cujo ritmo de alteração seja ~≤5%. Para processos onde o cenário de mudança é alto, manter a camada declarativa (`tpl_subtasks`).

---

## 1. O que é

Em ERP Infinity, os **processos** (`proc_instances`) são instanciados a partir de **templates** declarativos (`tpl_processes → tpl_stages → tpl_tasks`). Esta camada superior **continua declarativa**. A camada abaixo — **subtarefas** — passou a ser **hardcoded em TypeScript** através de um registry tipado. O contrato `SubtaskRule` vive em [`lib/processes/subtasks/types.ts`](../../lib/processes/subtasks/types.ts) e materializa-se em linhas de `proc_subtasks` via `populateSubtasks()` server-side, idempotente por unique index `(proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))`.

Razões da escolha:
- Subtarefas têm lógica rica (prompts de AI, templates de email específicos, schemas de payload distintos) que é custosa de modelar em DB.
- Permite type-safety ponta-a-ponta e AI específica por passo (prompt/model/schema por rule).
- Suporta repetição per-owner (ex.: KYC por proprietário) de forma nativa.
- Preserva a camada declarativa superior (stages/tasks) que continua a funcionar bem.

Trade-off aceite: adicionar ou editar regras exige deploy de código. Foi decisão do stakeholder privilegiar UX rica + velocidade de entrega sobre a flexibilidade de adicionar subtarefas sem release.

---

## 2. Schema DB — o mínimo para suportar o padrão

Uma única migration aditiva ([`supabase/migrations/20260501_proc_subtasks_hardcoded.sql`](../../supabase/migrations/20260501_proc_subtasks_hardcoded.sql)):

1. `ALTER TABLE proc_subtasks ADD COLUMN subtask_key text NOT NULL` (após backfill).
2. Backfill de linhas existentes com prefixo `legacy_tpl_<uuid>` / `legacy_adhoc_<uuid>`.
3. `CREATE UNIQUE INDEX proc_subtasks_dedup ON (proc_task_id, subtask_key, COALESCE(owner_id, uuid_nil))`.
4. `CREATE TABLE holidays_pt (date PRIMARY KEY, name text, scope text)` + seed para 3 anos (nacionais fixos + Sexta Santa + Corpo de Deus).

Nada removido, nada alterado fora disto. `tpl_subtasks` mantém-se intacto — é o path legacy que coexiste com o novo.

---

## 3. O contrato: `SubtaskRule`

Cada rule descreve **uma** subtarefa hardcoded. Shape em [types.ts](../../lib/processes/subtasks/types.ts):

```ts
interface SubtaskRule {
  key: string                   // imutável depois de publicado
  description?: string
  taskKind: string              // match contra proc_tasks.title (exact)

  // Expansão de linhas
  repeatPerOwner?: boolean                             // legacy alias de ownerScope='all'
  ownerScope?: 'none' | 'main_contact_only' | 'all'    // prevalece sobre repeatPerOwner
  personTypeFilter?: 'all' | 'singular' | 'coletiva'   // filtra owners por person_type

  isMandatory?: boolean
  hint?: string                 // texto aux. debaixo do título (config.hint)

  titleBuilder: (ctx) => string
  assignedToResolver?: (ctx) => string | null | Promise<string | null>
  dueRule?: DueRule
  Component: ComponentType<SubtaskComponentProps> | null  // null → hybrid
  supersedesTplSubtaskId?: string | string[]              // ver §3.1
  configBuilder?: (ctx) => Record<string, unknown>        // ver §3.1
  complete: (ctx) => Promise<{ payload?: Record<string, unknown> } | void>
}
```

**Sobre `ownerScope`:**
- `'none'` (default) — 1 row sem `owner_id`. Típico para tarefas do imóvel/processo (ex.: "Finalizar Dados do Imóvel", documentos do imóvel).
- `'main_contact_only'` — 1 row com `owner_id = main contact` do imóvel (resolvido no populate). Típico para documentos únicos do contrato (ex.: CMI).
- `'all'` — N rows, uma por proprietário. Típico para comunicações per-owner (ex.: pedido de documentação por email) e documentos específicos por proprietário (CC, FBC).

`repeatPerOwner: true` continua a funcionar como alias de `ownerScope: 'all'` para retrocompatibilidade com rules antigas.

**Sobre `personTypeFilter`** (extensão 2026-05-02):

Filtra os owners **antes** de aplicar o `ownerScope`, por `owners.person_type`:
- `'all'` (default) — sem filtro
- `'singular'` — só owners com `person_type='singular'` (pessoas singulares)
- `'coletiva'` — só owners com `person_type='coletiva'` (empresas)

Ex.: `"Certidão Comercial da Empresa"` usa `ownerScope:'all' + personTypeFilter:'coletiva'` → 1 linha por owner empresa, 0 linhas se só houver pessoas singulares no imóvel.

Ignorado quando `ownerScope === 'none'` (a rule não toca owners).

**Sobre `hint`** (extensão 2026-05-02):

Texto auxiliar curto renderizado debaixo do título do card pelo `<SubtaskCardBase>`. Útil para regras condicionais ou notas:
- `"Obrigatório para imóveis posteriores a 07 de Agosto de 1951"` — Licença de Utilização
- `"Código de acesso válido"` — Certidão Comercial, RCBE
- `"Uma por proprietário, mesmo em caso de casados"` — Ficha de Branqueamento

Propagado para `proc_subtasks.config.hint` via populate. Zero mudança de UI necessária — o `<SubtaskCardBase>` lê e renderiza automaticamente.

**Invariantes a respeitar:**
- `rule.key` é **único em todo o registry**, não apenas dentro do `processType`. Permite lookup O(1) no front-end sem precisar de saber o tipo de processo da linha.
- `rule.key` é **imutável em produção**. Renomear implica data migration (`UPDATE proc_subtasks SET subtask_key = '<new>' WHERE subtask_key = '<old>'`) antes do deploy do código.
- `rule.taskKind` corresponde ao `title` da `tpl_tasks` onde se materializa. Se o template for editado, actualizar a rule.
- `rule.complete()` pode devolver `payload` — fica em `config.payload` para auditoria. Nada sensível aqui (não hash, não cifrar — são dados normais do processo).

### 3.1 Rules **hybrid** — reusar UI legacy

Casos em que a subtarefa já tem um renderer legacy excelente (email, upload, generate_doc, form, etc.) e só queremos:
- Ficar na pista hardcoded (idempotência, `subtask_key`, `supersedesTplSubtaskId`, per-owner expansion)
- Reusar a UI existente (ícone + sheet + fluxo de envio/submissão + completion endpoint legacy)

**Três campos compõem o padrão:**

| Campo | Tipo | Efeito |
|---|---|---|
| `Component: null` | `null` | Pre-check em `subtask-card-list.tsx` devolve `null` e cai para o switch legacy, que resolve por `config.type`. |
| `supersedesTplSubtaskId` | `string \| string[]` | Antes do populate, apaga rows legacy (`subtask_key LIKE 'legacy_%'`, `is_completed=false`) com estes `tpl_subtask_id` no mesmo processo. Evita duplicação. |
| `configBuilder(ctx)` | `fn` | Popula `proc_subtasks.config` com o shape que o switch legacy + sheet esperam (ex.: `type: 'email'`, `has_person_type_variants`, `singular_config`, `coletiva_config`). Merged com os marcadores `hardcoded/process_type/rule_key`. |

**Completion em rules hybrid:** o `complete` handler é tipicamente **no-op** — o sheet legacy chama o endpoint PUT tradicional (`/api/processes/[id]/tasks/[taskId]/subtasks/[subtaskId]`) que já cuida de `is_completed`, `log_emails`, activity `'email_sent'`, etc. O endpoint novo `/subtasks/[id]/complete` fica reservado para rules com Component próprio.

**UX inline — label + badge:** `SubtaskCardEmail` e `SubtaskCardDoc` (via prop `compact?: boolean`) aceitam opcionalmente `label` (default: "Email"/"Documento") e `badge` (ReactNode). Quando a row é hybrid (`config.hardcoded === true`), `subtask-card-list.tsx` passa `subtask.title` como label e rende um `<Badge>Singular</Badge>` ou `<Badge>Coletivo</Badge>` a partir de `subtask.owner.person_type` — mantido visível mesmo após conclusão. O ícone muda por tipo: `Mail` para email, `FileSignature` para generate_doc. O mesmo padrão pode ser replicado em `SubtaskCardUpload`, `SubtaskCardChecklist`, etc. quando fizerem sentido.

**Exemplos de referência:**
- [`email-pedido-doc.ts`](../../lib/processes/subtasks/rules/angariacao/email-pedido-doc.ts) — email per-owner (`ownerScope: 'all'`)
- [`geracao-cmi.ts`](../../lib/processes/subtasks/rules/angariacao/geracao-cmi.ts) — documento único para o contacto principal (`ownerScope: 'main_contact_only'`)

```ts
export const emailPedidoDocRule: SubtaskRule = {
  key: 'email_pedido_doc',
  taskKind: 'Enviar e-mail ao cliente com pedido de documento',
  repeatPerOwner: true,
  supersedesTplSubtaskId: 'cff4c3ac-af4f-454e-951b-f1bbdb0cb178',
  titleBuilder: (ctx) => `Email - ${ctx.owner?.name?.trim().split(/\s+/)[0] ?? 'proprietário'}`,
  configBuilder: () => ({
    type: 'email',
    has_person_type_variants: true,
    singular_config: { email_library_id: '450c31c0-...' },
    coletiva_config: { email_library_id: '1cbdd950-...' },
  }),
  Component: null,
  complete: async () => ({}),
}
```

Renderiza como `[📧 Email - Mariano [Singular]]` na lista da task; click abre o mesmo `<SubtaskEmailSheet>` com a template certa por `person_type`; enviar marca concluído.

---

## 4. `dueRule` — declarativa vs imperativa

**Declarativa (90% dos casos):**

```ts
dueRule: { after: 'email_pedido_doc', offset: '48h', shiftOnNonBusinessDay: true }
```

- `offset` aceita `"Nh"` (horas) ou `"Nd"` (dias). Parsed por [`parseOffset()`](../../lib/processes/subtasks/business-days.ts).
- Com `shiftOnNonBusinessDay: true`, a data final passa por `shiftToNextBusinessDay()` que consulta `holidays_pt` e avança até ao próximo dia útil (seg-sex, não-feriado).

**Imperativa (escape hatch):**

```ts
dueRule: async ({ prereqCompletedAt, businessDay }) => {
  const raw = new Date(prereqCompletedAt.getTime())
  raw.setUTCHours(raw.getUTCHours() + 24)
  const shifted = await businessDay(raw)
  if (shifted.getUTCHours() < 9) shifted.setUTCHours(9, 0, 0, 0)
  return shifted
}
```

Use apenas quando a regra precisa de lógica composta (ex.: "24h depois mas nunca antes das 9h"). A declarativa é sempre preferida porque é legível e auditável.

---

## 5. Populate + Complete — APIs canónicas

Dois endpoints, um padrão por cada acção:

### `POST /api/processes/[id]/subtasks/populate-<processType>`

Exemplo: `populate-angariacao`. Materializa rules × proc_tasks × owners? em `proc_subtasks` via `INSERT ... ON CONFLICT DO NOTHING`. **Sync**, **não-transaccional**, **idempotente**. Ver [`populate.ts`](../../lib/processes/subtasks/populate.ts).

Autorização padrão: consultor do imóvel OU permissão `pipeline` (broker, gestora, etc.).

Emite activity `'subtasks_populated'` quando `inserted > 0`.

**Integração recomendada:** chamar server-side no fim da aprovação (ver [`app/api/processes/[id]/approve/route.ts`](../../app/api/processes/[id]/approve/route.ts) pós-`recalculateProgress()`). Erros parciais não devem reverter a aprovação — o consultor pode retomar via `<RetomarSubtasksButton>`.

### `POST /api/processes/[id]/subtasks/[subtaskId]/complete`

Fecha uma subtarefa hardcoded:
1. Resolve rule pelo `subtask_key` (`getRuleByKey()`).
2. Invoca `rule.complete(ctx)` — captura `payload`.
3. UPDATE `proc_subtasks SET is_completed=true, completed_at, completed_by, config.payload`.
4. Emite activity `'subtask_completed'`.
5. Chama `propagateDueDates()` — isolado por try/catch por sibling.

Ver [`route.ts`](../../app/api/processes/[id]/subtasks/[subtaskId]/complete/route.ts).

---

## 6. Propagação de `due_date`

Quando uma subtarefa fecha, `propagateDueDates()`:

1. Para cada rule dependente (`dueRule.after === completed.subtask_key`),
2. SELECT siblings `(proc_task_id, subtask_key=rule.key)` ainda não completos,
3. Calcula novo `due_date` (offset + shift),
4. UPDATE + emite activity `'due_date_set'` com metadata completa.

**Importante:** siblings já completos são **skipped** (no-op). O consultor pode ter concluído antecipadamente — não queremos recalcular prazos de coisas feitas.

Erros por sibling são isolados em try/catch — não revertem a conclusão principal. A timeline (`proc_task_activities`) preserva o estado exacto para diagnóstico.

---

## 7. Activity log — 3 novos tipos

Adicionados ao `TASK_ACTIVITY_TYPE_CONFIG` em [`lib/constants.ts`](../../lib/constants.ts):

- `subtasks_populated` (ícone `Sparkles`, cor `text-violet-500`) — visível por defeito.
- `subtask_completed` (ícone `CheckSquare`, cor `text-emerald-500`) — visível por defeito.
- `due_date_set` (ícone `Clock`, cor `text-muted-foreground`) — **escondido por defeito**, toggle "Mostrar eventos do sistema" na timeline desafixa.

O set `SYSTEM_EVENT_ACTIVITY_TYPES` (mesmo ficheiro) é a whitelist de tipos "ruidosos" que ficam escondidos. Replicar o padrão para activity types futuros que sejam system-generated.

---

## 8. Registry de componentes React

Cada rule fornece um `Component: ComponentType<SubtaskComponentProps>` que recebe `{ subtask, processId, onComplete }`. O front-end resolve via [`getComponentForSubtaskKey()`](../../lib/processes/subtasks/components-registry.ts). O padrão de integração está em [`subtask-card-list.tsx`](../../components/processes/subtask-card-list.tsx): **pre-check** — se a chave é hardcoded, renderiza o Component; caso contrário cai no switch legacy por `config.type`.

Base visual partilhada: [`<HardcodedCardBase>`](../../components/processes/subtasks/hardcoded-card-base.tsx) — título, owner subtitle, due date badge, acção "Concluir". Cards específicos (email, upload, CMI, KYC, ...) estendem a base com children customizados.

---

## 8.1 Vista agrupada — `<GroupedSubtasksView>` (2026-05-02)

Quando uma task hardcoded tem subtasks com expansão per-owner (via `ownerScope` + `personTypeFilter`), renderizá-las em lista flat é visualmente confuso (várias linhas "Cartão de Cidadão — João", "Cartão de Cidadão — Maria", ...). Para essas tasks, usa-se [`<GroupedSubtasksView>`](../../components/processes/grouped-subtasks-view.tsx) que agrupa dinamicamente por `subtask.owner_id`:

- `null` → grupo **"Imóvel"** (ícone `Building2`, fixo, um só)
- UUID de owner → grupo **por owner** (ícone `Building2` se `coletiva`, `User` se `singular`; badge "Pessoa colectiva" / "Pessoa singular")

Cada grupo é um `<Collapsible>` aberto por defeito, com header contendo ícone, nome, badge de tipo, barra de progresso, `N/M` e `%`. O body lista as subtasks via o mesmo `renderCard` que a vista flat usa (delega no pre-check hardcoded → hybrid cards → sheets legacy).

### Quando usar

No `<SubtaskCardList>`, detectado via whitelist de `task.title`:

```ts
const GROUPED_TASK_TITLES = new Set([
  'Documentos do Imóvel',
  'Documentos Pessoa Colectiva',
  'Documentos Pessoa Singular',
])
const useGroupedView = GROUPED_TASK_TITLES.has(task.title)
```

Para replicar noutros processos, acrescentar os títulos das tasks à whitelist (ou generalizar para detectar via `config.hardcoded === true` + presença de `owner_id`).

### Split de tasks no template — estratégia

Quando a task legacy do template agregava múltiplas entidades (ex.: "Armazenar documentos" misturava imóvel + coletiva + singular num único bucket), a **estratégia limpa** é dividir em 3 tasks separadas no template. Cada task tem rules próprias com `ownerScope` específico, e o `<GroupedSubtasksView>` dá a apresentação visual correcta.

**Como fazer sem quebrar processos existentes** (FK `proc_tasks.tpl_task_id` tem `delete_rule: NO ACTION`):

1. **Renomear** a tpl_task legacy (ex.: "Armazenar documentos" → "Documentos do Imóvel"). Preserva `tpl_task_id` e FKs dos `proc_tasks` existentes.
2. **Shift** do `order_index` das tasks subsequentes no mesmo stage (+= N onde N = nº de tasks novas a inserir).
3. **INSERT** das tasks novas (ex.: "Documentos Pessoa Colectiva", "Documentos Pessoa Singular") em `gen_random_uuid()`, com `order_index` contíguo.
4. **DELETE** dos tpl_subtasks legacy (FK `proc_subtasks.tpl_subtask_id` tem `ON DELETE SET NULL` — safe; os `proc_subtasks` existentes ficam órfãos mas preservam identidade via `subtask_key = 'legacy_tpl_*'`).
5. **INSERT** dos novos tpl_subtasks distribuídos pelas 3 tasks.

Ver [`20260502_split_armazenar_documentos_task.sql`](../../supabase/migrations/20260502_split_armazenar_documentos_task.sql) como template canónico.

---

## 9. Backfill para processos em curso

Script [`scripts/backfill-angariacao-subtasks.ts`](../../scripts/backfill-angariacao-subtasks.ts). Run-book no topo do ficheiro. Idempotente, safe para correr várias vezes. Processos `current_status='completed'` **não são tocados** — decisão do stakeholder.

Correr **1×** após deploy:

```bash
pnpm dlx tsx scripts/backfill-angariacao-subtasks.ts
```

---

## 10. Checklist para replicar em novos processos

Para adicionar um novo tipo de processo (ex.: negócio, recrutamento):

- [ ] Criar `lib/processes/subtasks/rules/<processType>/<rule>.ts` por rule.
- [ ] Criar barrel `lib/processes/subtasks/rules/<processType>/index.ts` que agrega `SubtaskRule[]`.
- [ ] Ligar em `registry.ts`: `REGISTRY['<processType>'] = <processType>Rules`.
- [ ] Adicionar `<processType>` a `ProcessType` em `types.ts`.
- [ ] Criar `POST /api/processes/[id]/subtasks/populate-<processType>/route.ts` espelhando o de `angariacao` — validação do `process_type`, auditoria, activity emit.
- [ ] Decidir integração: chamar `populateSubtasks()` no approve do novo processo (pattern de angariação) OU num trigger dedicado.
- [ ] Para cada rule com `Component` novo, criar o card em `components/processes/subtasks/<rule>-card.tsx`.
- [ ] Para rules com `hint`, verificar que `<SubtaskCardBase>` continua a renderizar `config.hint` — default para subtasks hardcoded.
- [ ] Se a task agrupa subtasks por entidade (imóvel + múltiplos owners), adicionar `task.title` à `GROUPED_TASK_TITLES` em `subtask-card-list.tsx` para activar `<GroupedSubtasksView>`.
- [ ] Se o template legacy mistura entidades num único task, considerar split via migration SQL (ver §8.1) em vez de rules num bucket único.
- [ ] Se introduzir novos `activity_type`, adicionar entradas em `TASK_ACTIVITY_TYPE_CONFIG`.
- [ ] Criar script de backfill se houver processos em curso que precisem de materialização retroactiva.
- [ ] Adicionar bloco ao topo de `CLAUDE.md` descrevendo a entrega.

---

## 11. Troubleshooting

**"Subtarefa sem rule no registry"** — aparece quando o front-end carrega uma linha com `subtask_key` que não está no registry. Possíveis causas:
- Key foi renomeada sem data migration → `UPDATE proc_subtasks SET subtask_key='<new>' WHERE subtask_key='<old>'`.
- Rule foi removida → decidir: mover linhas para `subtask_key='legacy_removed_<uuid>'` OU restaurar a rule.
- Linha é legacy (`legacy_tpl_*` / `legacy_adhoc_*`) → esperado, cai no renderer legacy.

**Populate "inserted=0" em processo que devia ter subtarefas** — possíveis causas:
- `rule.taskKind` não corresponde a nenhum `proc_tasks.title` (template foi editado).
- Processo ainda não foi aprovado (não tem `proc_tasks`).
- Já foi populado antes (idempotente — esperado).

**`due_date` cai num dia não-útil** — `holidays_pt` provavelmente não tem o ano coberto. Seed inicial cobre 3 anos; estender com `INSERT ... ON CONFLICT DO NOTHING` antes da viragem de ano.

---

## 12. Specs OpenSpec relacionados

- [specs/subtasks-runtime/spec.md](../../openspec/changes/add-hardcoded-process-subtasks/specs/subtasks-runtime/spec.md) — contrato `SubtaskRule`, identidade, propagação, activity types.
- [specs/subtasks-angariacao/spec.md](../../openspec/changes/add-hardcoded-process-subtasks/specs/subtasks-angariacao/spec.md) — rules de angariação, populate on create, backfill.
- [design.md](../../openspec/changes/add-hardcoded-process-subtasks/design.md) — decisões arquitectónicas e trade-offs.
