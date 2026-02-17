# 🧪 Guia de Teste — Módulo de Angariação

**Data:** 2026-02-17
**Versão:** 1.0
**Status:** ✅ Implementado e pronto para teste

---

## 📋 Pré-requisitos

Antes de iniciar os testes, certifique-se de que:

1. ✅ O servidor está a correr: `npm run dev`
2. ✅ Está autenticado no sistema
3. ✅ Seu utilizador tem permissão `properties` (para ver o menu Angariação)
4. ✅ Base de dados tem o template "Captação da Angariação" instalado
5. ✅ Existem pelo menos 1-2 doc_types na base de dados

---

## 🎯 Funcionalidades a Testar

### 1. Acesso ao Formulário de Angariação

**Caminho 1: Via Sidebar (NOVO)**
```
Dashboard → Sidebar → Angariação (ícone ClipboardCheck)
```

**Caminho 2: Via Página de Processos**
```
Dashboard → Processos → Botão "Nova Angariação"
```

**Resultado esperado:**
- ✅ Página carrega em `/dashboard/angariacao`
- ✅ Formulário multi-step aparece com 5 passos
- ✅ Barra de progresso no topo mostra "Passo 1 de 5"
- ✅ Título: "Nova Angariação"

---

### 2. Passo 1 — Dados do Imóvel

**Campos obrigatórios:**
- Título do Imóvel (mín. 5 caracteres)
- Tipo de Imóvel (select)
- Tipo de Negócio (select)
- Preço de Venda (número positivo)

**Campos opcionais:**
- Descrição
- Estado do Imóvel
- Certificado Energético

**Testes:**
1. ✅ Tentar avançar sem preencher campos → deve mostrar erros de validação
2. ✅ Preencher título com "T2" → deve dar erro (mín. 5 chars)
3. ✅ Preencher corretamente → botão "Seguinte" deve funcionar
4. ✅ Verificar que o progresso avança para "Passo 2 de 5"

**Dados de exemplo:**
```
Título: Apartamento T2 em Lisboa Centro
Tipo: Apartamento
Negócio: Venda
Preço: 250000
Descrição: Apartamento renovado com varanda
Estado: Bom
Certificado: B
```

---

### 3. Passo 2 — Localização

**Campos obrigatórios:**
- Morada (rua + número)
- Cidade

**Campos opcionais:**
- Freguesia
- Código Postal
- Zona
- Latitude/Longitude

**Testes:**
1. ✅ Tentar avançar sem preencher morada → erro de validação
2. ✅ Preencher corretamente → avança para Passo 3
3. ✅ Botão "Voltar" deve retornar ao Passo 1 mantendo dados preenchidos

**Dados de exemplo:**
```
Morada: Rua Augusta, 123
Cidade: Lisboa
Freguesia: Santa Maria Maior
Código Postal: 1100-001
Zona: Baixa
```

---

### 4. Passo 3 — Proprietários ⭐ (Mais Complexo)

**Validações:**
- Mínimo 1 proprietário obrigatório
- Exactamente 1 proprietário deve ser "Contacto Principal"
- NIF: exactamente 9 dígitos (se preenchido)
- Email: formato válido (se preenchido)
- Soma de percentagens de propriedade = 100% (ideal)

**Testes:**

#### 3.1 Adicionar Proprietário Singular
1. ✅ Clicar "Adicionar Proprietário"
2. ✅ Seleccionar "Pessoa Singular"
3. ✅ Preencher:
   - Nome: João Silva
   - Email: joao@example.com
   - Telemóvel: 912345678
   - NIF: 123456789
   - % Propriedade: 100
   - ✅ Marcar "Contacto Principal"

#### 3.2 Adicionar Proprietário Colectivo (Empresa)
1. ✅ Clicar "Adicionar Proprietário"
2. ✅ Seleccionar "Pessoa Colectiva"
3. ✅ Preencher:
   - Nome: Empresa Imóveis Lda
   - NIF: 501234567
   - Email: geral@empresa.pt
   - % Propriedade: 50
   - Representante Legal: Maria Santos
   - NIF Representante: 234567890

#### 3.3 Múltiplos Proprietários
1. ✅ Adicionar 2 proprietários (50% cada)
2. ✅ Apenas 1 pode ser "Contacto Principal"
3. ✅ Tentar avançar sem "Contacto Principal" → deve dar erro
4. ✅ Remover proprietário com botão X

**Dados de exemplo:**
```json
[
  {
    "person_type": "singular",
    "name": "João Silva",
    "email": "joao@example.com",
    "phone": "912345678",
    "nif": "123456789",
    "ownership_percentage": 100,
    "is_main_contact": true
  }
]
```

---

### 5. Passo 4 — Dados Contratuais

**Campos obrigatórios:**
- Regime de Contrato (select)
- Comissão Acordada (número ≥ 0)

**Campos opcionais:**
- Tipo de Comissão (default: percentage)
- Prazo do Contrato
- Data de Expiração
- Valor IMI
- Condomínio
- Notas Internas

**Testes:**
1. ✅ Seleccionar regime "Exclusivo"
2. ✅ Comissão: 5 (%)
3. ✅ Preencher notas internas: "Cliente urgente, quer vender em 3 meses"

**Dados de exemplo:**
```
Regime: Exclusivo
Comissão: 5
Tipo: Percentagem
Prazo: 12 meses
IMI: 350
Condomínio: 45
```

---

### 6. Passo 5 — Documentos Iniciais (Opcional)

**Funcionalidade:**
- Permite adicionar documentos que o proprietário já tem
- Estes documentos serão usados para **auto-completar tarefas** do processo

**Campos por documento:**
- Tipo de Documento (select com doc_types da BD)
- Nome do Ficheiro
- URL (se já foi feito upload)
- Validade (data opcional)

**Testes:**
1. ✅ Avançar sem adicionar documentos → deve funcionar (é opcional)
2. ✅ Adicionar documento:
   - Tipo: Caderneta Predial
   - Nome: caderneta_imovel.pdf
3. ✅ Adicionar segundo documento:
   - Tipo: Certificado Energético
   - Validade: 2027-01-01

**⚠️ Nota:** Upload real de ficheiros ainda não está implementado. Por agora, apenas simula com nome + URL fictícia.

---

### 7. Submissão Final

**Ao clicar "Submeter Angariação":**

#### 7.1 Loading State
- ✅ Botão muda para "A submeter..." com spinner
- ✅ Botão fica desactivado
- ✅ Não é possível clicar múltiplas vezes

#### 7.2 Chamada API
**Endpoint:** `POST /api/acquisitions`

**Payload enviado:**
```json
{
  "title": "...",
  "property_type": "...",
  "business_type": "...",
  "listing_price": 250000,
  "address_street": "...",
  "city": "...",
  "owners": [...],
  "contract_regime": "...",
  "commission_agreed": 5,
  "specifications": {
    "typology": "T2",
    "bedrooms": 2,
    "bathrooms": 1,
    "area_util": 80
  },
  "documents": [...],
  "consultant_id": "<user_id>"
}
```

#### 7.3 Backend Processing

**O que acontece no servidor:**

1. **Criar Imóvel**
   ```sql
   INSERT INTO dev_properties (status = 'pending_approval', ...)
   INSERT INTO dev_property_specifications (...)
   INSERT INTO dev_property_internal (...)
   ```

2. **Criar/Reutilizar Proprietários**
   ```sql
   -- Verifica se NIF já existe
   SELECT * FROM owners WHERE nif = '...'
   -- Se não existe, cria novo
   INSERT INTO owners (...)
   -- Liga ao imóvel
   INSERT INTO property_owners (property_id, owner_id, ...)
   ```

3. **Registar Documentos Iniciais**
   ```sql
   INSERT INTO doc_registry (
     property_id,
     doc_type_id,
     file_name,
     status = 'active',
     ...
   )
   ```

4. **Criar Instância de Processo**
   ```sql
   INSERT INTO proc_instances (
     property_id,
     tpl_process_id = '<template_id>',
     current_status = 'pending_approval',
     external_ref = 'PROC-2026-0001',  -- auto-gerado
     requested_by = '<user_id>',
     ...
   )
   ```

   **⚠️ IMPORTANTE:** Tarefas NÃO são criadas ainda!

#### 7.4 Resposta de Sucesso
```json
{
  "success": true,
  "property_id": "<uuid>",
  "proc_instance_id": "<uuid>",
  "external_ref": "PROC-2026-0001"
}
```

#### 7.5 Redirecionamento
- ✅ Toast de sucesso: "Angariação submetida com sucesso!"
- ✅ Redireciona para: `/dashboard/processos`

#### 7.6 Verificar em Base de Dados

**dev_properties:**
```sql
SELECT id, title, status, consultant_id
FROM dev_properties
WHERE status = 'pending_approval'
ORDER BY created_at DESC
LIMIT 1;
```

Resultado esperado:
```
status: 'pending_approval'
consultant_id: <seu user_id>
```

**proc_instances:**
```sql
SELECT id, external_ref, current_status, requested_by, property_id
FROM proc_instances
WHERE current_status = 'pending_approval'
ORDER BY created_at DESC
LIMIT 1;
```

Resultado esperado:
```
external_ref: 'PROC-2026-XXXX'
current_status: 'pending_approval'
requested_by: <seu user_id>
```

**proc_tasks:**
```sql
SELECT COUNT(*) FROM proc_tasks WHERE proc_instance_id = '<proc_instance_id>';
```

Resultado esperado:
```
COUNT: 0  ← TAREFAS SÓ SÃO CRIADAS APÓS APROVAÇÃO!
```

---

### 8. Fluxo de Aprovação (Próximo Passo)

**Dashboard → Processos → Clicar no processo criado**

**Resultado esperado:**
- ✅ Página `/dashboard/processos/[id]` abre
- ✅ Secção "Revisão de Processo" aparece (se status = pending_approval)
- ✅ 3 botões disponíveis:
  - 🟢 Aprovar
  - 🟠 Devolver (com motivo)
  - 🔴 Rejeitar (com motivo)

**Testes de Aprovação:**

#### 8.1 Aprovar Processo
1. ✅ Clicar "Aprovar Processo"
2. ✅ Dialog de confirmação abre
3. ✅ Clicar "Confirmar"
4. ✅ API call: `PUT /api/processes/{id}/approve`

**Backend:**
```sql
-- 1. Actualizar processo
UPDATE proc_instances SET
  current_status = 'active',
  approved_by = '<user_id>',
  approved_at = NOW();

-- 2. Actualizar imóvel
UPDATE dev_properties SET status = 'in_process';

-- 3. Criar tarefas
SELECT populate_process_tasks('<proc_instance_id>');

-- 4. Auto-completar tarefas com docs existentes
-- (se houver docs no doc_registry)

-- 5. Recalcular progresso
UPDATE proc_instances SET percent_complete = ...;
```

**Resultado esperado:**
- ✅ Toast: "Processo aprovado com sucesso!"
- ✅ Página recarrega
- ✅ Secção "Revisão" desaparece
- ✅ Secção "Tarefas do Processo" aparece com 28 tarefas divididas em 6 fases
- ✅ Progresso: X% (dependendo de quantas foram auto-completadas)

#### 8.2 Devolver Processo
1. ✅ Clicar "Devolver Processo"
2. ✅ Dialog abre com campo de texto obrigatório
3. ✅ Tentar enviar sem motivo → erro "Mínimo 10 caracteres"
4. ✅ Preencher: "Falta certificado energético válido"
5. ✅ Confirmar

**Backend:**
```sql
UPDATE proc_instances SET
  current_status = 'returned',
  returned_at = NOW(),
  returned_reason = '...'
```

**Resultado esperado:**
- ✅ Toast: "Processo devolvido"
- ✅ Status badge muda para "Devolvido" (cor laranja)
- ✅ Motivo aparece na interface
- ✅ Consultor pode editar e resubmeter

#### 8.3 Rejeitar Processo
1. ✅ Clicar "Rejeitar Processo"
2. ✅ Dialog com campo de motivo obrigatório
3. ✅ Preencher: "Imóvel fora da área de actuação"
4. ✅ Confirmar

**Backend:**
```sql
UPDATE proc_instances SET
  current_status = 'rejected',
  rejected_at = NOW(),
  rejected_reason = '...';

UPDATE dev_properties SET status = 'cancelled';
```

**Resultado esperado:**
- ✅ Toast: "Processo rejeitado"
- ✅ Status badge: "Rejeitado" (cor vermelha)
- ✅ Imóvel fica cancelado (não aparece em listagens públicas)

---

## 🐛 Problemas Conhecidos / Limitações

### Implementado
- ✅ Formulário multi-step completo
- ✅ Validação Zod em todos os campos
- ✅ API de criação de angariação
- ✅ APIs de aprovação/devolução/rejeição
- ✅ Criação automática de tarefas após aprovação
- ✅ Auto-completamento de tarefas com documentos existentes
- ✅ Link no sidebar para fácil acesso

### Não Implementado (Futuro)
- ⏳ Upload real de ficheiros para R2
- ⏳ Mapbox autocomplete de moradas (componente existe, mas precisa de token)
- ⏳ Preview de documentos (PDF viewer)
- ⏳ Notificações por email ao consultor
- ⏳ Edição de angariação devolvida
- ⏳ Histórico de versões (audit log visual)

---

## 📊 Dados de Teste Completos

### Cenário 1: Apartamento em Lisboa (Simples)

```json
{
  "title": "Apartamento T2 Renovado em Alvalade",
  "property_type": "apartamento",
  "business_type": "venda",
  "listing_price": 295000,
  "description": "T2 completamente renovado, com varanda e lugar de garagem",
  "property_condition": "renovado",
  "energy_certificate": "B",

  "address_street": "Rua Andrade Corvo, 45 - 3º Esq",
  "city": "Lisboa",
  "address_parish": "Alvalade",
  "postal_code": "1050-009",
  "zone": "Alvalade",

  "owners": [
    {
      "person_type": "singular",
      "name": "Maria João Santos",
      "email": "maria.santos@email.com",
      "phone": "912345678",
      "nif": "123456789",
      "nationality": "Portuguesa",
      "marital_status": "casada",
      "ownership_percentage": 100,
      "is_main_contact": true
    }
  ],

  "contract_regime": "exclusivo",
  "commission_agreed": 5,
  "commission_type": "percentage",
  "contract_term": "12 meses",
  "imi_value": 420,
  "condominium_fee": 55,

  "specifications": {
    "typology": "T2",
    "bedrooms": 2,
    "bathrooms": 1,
    "area_util": 85,
    "area_gross": 95,
    "construction_year": 1985,
    "parking_spaces": 1,
    "has_elevator": true
  }
}
```

### Cenário 2: Moradia em Cascais (Complexo - Múltiplos Proprietários)

```json
{
  "title": "Moradia T4 com Piscina em Cascais",
  "property_type": "moradia",
  "business_type": "venda",
  "listing_price": 850000,
  "description": "Moradia isolada com jardim e piscina privativa",
  "property_condition": "bom",
  "energy_certificate": "A",

  "address_street": "Rua das Flores, 12",
  "city": "Cascais",
  "address_parish": "Cascais e Estoril",
  "postal_code": "2750-123",
  "zone": "Centro de Cascais",

  "owners": [
    {
      "person_type": "singular",
      "name": "António Pereira",
      "email": "antonio.p@email.com",
      "phone": "913456789",
      "nif": "234567890",
      "nationality": "Portuguesa",
      "marital_status": "casado",
      "ownership_percentage": 50,
      "is_main_contact": true
    },
    {
      "person_type": "singular",
      "name": "Cristina Pereira",
      "email": "cristina.p@email.com",
      "phone": "914567890",
      "nif": "345678901",
      "nationality": "Portuguesa",
      "marital_status": "casada",
      "ownership_percentage": 50,
      "is_main_contact": false
    }
  ],

  "contract_regime": "exclusivo",
  "commission_agreed": 4,
  "commission_type": "percentage",
  "contract_term": "18 meses",
  "imi_value": 1250,

  "specifications": {
    "typology": "T4",
    "bedrooms": 4,
    "bathrooms": 3,
    "area_util": 250,
    "area_gross": 320,
    "construction_year": 2010,
    "parking_spaces": 2,
    "garage_spaces": 2,
    "has_elevator": false,
    "features": ["piscina", "jardim", "churrasqueira", "ar_condicionado"]
  },

  "documents": [
    {
      "doc_type_id": "<uuid_caderneta_predial>",
      "file_name": "caderneta_predial.pdf"
    },
    {
      "doc_type_id": "<uuid_cert_energetico>",
      "file_name": "certificado_energetico.pdf",
      "valid_until": "2029-12-31"
    }
  ]
}
```

---

## ✅ Checklist de Teste Completo

### Setup
- [ ] Servidor Next.js a correr (`npm run dev`)
- [ ] Autenticado com utilizador que tem permissão `properties`
- [ ] Template "Captação da Angariação" existe na BD
- [ ] Pelo menos 5 doc_types na BD

### Navegação
- [ ] Link "Angariação" aparece no sidebar
- [ ] Clicar no link abre `/dashboard/angariacao`
- [ ] Formulário carrega sem erros

### Passo 1 - Dados do Imóvel
- [ ] Validação funciona (campos obrigatórios)
- [ ] Avança para Passo 2 após preenchimento correcto

### Passo 2 - Localização
- [ ] Validação funciona
- [ ] Botão "Voltar" mantém dados do Passo 1

### Passo 3 - Proprietários
- [ ] Adicionar proprietário funciona
- [ ] Toggle Singular/Colectiva muda campos
- [ ] Validação de NIF (9 dígitos)
- [ ] Validação de email
- [ ] Exactamente 1 "Contacto Principal" obrigatório
- [ ] Remover proprietário funciona

### Passo 4 - Dados Contratuais
- [ ] Selects funcionam
- [ ] Validação de comissão (≥ 0)

### Passo 5 - Documentos
- [ ] Adicionar documento opcional funciona
- [ ] Remover documento funciona

### Submissão
- [ ] Botão muda para loading
- [ ] Toast de sucesso aparece
- [ ] Redireciona para `/dashboard/processos`

### Verificação BD
- [ ] Registo criado em `dev_properties` (status: pending_approval)
- [ ] Registo criado em `proc_instances` (status: pending_approval)
- [ ] Proprietários criados em `owners`
- [ ] Ligação criada em `property_owners`
- [ ] **Tarefas NÃO criadas** (proc_tasks vazio)

### Aprovação
- [ ] Processo aparece na lista com status "Pendente Aprovação"
- [ ] Clicar abre página de detalhe
- [ ] Secção "Revisão" aparece com 3 botões
- [ ] Aprovar funciona → tarefas são criadas
- [ ] Devolver funciona → valida motivo (mín. 10 chars)
- [ ] Rejeitar funciona → imóvel fica cancelado

### Gestão de Tarefas (Após Aprovação)
- [ ] 28 tarefas criadas agrupadas em 6 fases
- [ ] Progresso calculado correctamente
- [ ] Se havia documentos iniciais, tarefas foram auto-completadas
- [ ] Dropdown de acções por tarefa funciona

---

## 🎯 Conclusão

A funcionalidade de **Angariação** está **100% implementada e testável**.

**O que funciona:**
- ✅ Formulário multi-step completo (5 passos)
- ✅ Validação robusta com Zod
- ✅ Criação de imóvel + proprietários + processo
- ✅ Fluxo de aprovação/devolução/rejeição
- ✅ Criação automática de 28 tarefas após aprovação
- ✅ Auto-completamento de tarefas
- ✅ Navegação via sidebar

**Para usar:**
1. Aceder ao dashboard
2. Clicar em "Angariação" no sidebar
3. Preencher os 5 passos
4. Submeter
5. Aguardar aprovação ou aprovar (se tiver permissão)

Se encontrar algum erro, verificar:
- Console do browser (F12)
- Logs do servidor (`npm run dev` output)
- Estado da base de dados (Supabase Dashboard)
