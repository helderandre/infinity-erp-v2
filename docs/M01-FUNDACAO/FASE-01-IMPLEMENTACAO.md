# FASE 01 — Fundação do ERP Infinity

**Data de Conclusão:** 2026-02-17
**Status:** ✅ **CONCLUÍDA**

---

## 📋 Resumo Executivo

A Fase 1 estabeleceu a fundação completa do ERP Infinity, incluindo autenticação, estrutura de pastas, layout do dashboard com sidebar inset, e todos os componentes base necessários para as próximas fases.

**Tempo estimado de implementação:** ~45 minutos
**Ficheiros criados:** 30+
**Tecnologias configuradas:** Next.js 16, Supabase Auth, shadcn/ui, Mapbox GL, Sonner

---

## 🎯 Objectivos Alcançados

### 1. Estrutura de Pastas Completa ✅

```
lib/
├── supabase/
│   ├── client.ts          # Cliente browser (createBrowserClient)
│   ├── server.ts          # Cliente server components (createServerClient)
│   └── admin.ts           # Cliente service role (bypass RLS)
├── validations/
│   ├── property.ts        # Schemas Zod para imóveis
│   ├── lead.ts            # Schemas Zod para leads
│   └── owner.ts           # Schemas Zod para proprietários
├── constants.ts           # STATUS_COLORS + labels PT-PT + formatadores
└── utils.ts              # Função cn() para classnames

hooks/
├── use-user.ts           # Hook para dados do utilizador autenticado
├── use-permissions.ts    # Hook para verificar permissões por módulo
└── use-debounce.ts       # Hook para debounce (search, etc.)

types/
└── database.ts           # Types gerados do Supabase (auto-gerado)

components/
├── layout/
│   ├── app-sidebar.tsx       # Sidebar variant="inset" com navegação
│   └── breadcrumbs.tsx       # Breadcrumbs dinâmicos PT-PT
└── ui/                       # shadcn/ui components (30+)

app/
├── (auth)/
│   ├── layout.tsx           # Layout público centrado
│   └── login/
│       └── page.tsx         # Página de login com formulário
├── (dashboard)/
│   ├── layout.tsx           # Layout protegido com sidebar
│   └── page.tsx             # Dashboard principal com KPIs
├── api/
│   └── auth/
│       └── callback/
│           └── route.ts     # Callback handler Supabase Auth
├── layout.tsx               # Layout raiz (Sonner, Mapbox CSS, PT-PT)
├── page.tsx                 # Redirect para /dashboard
└── globals.css              # Estilos globais + animações

middleware.ts                 # Protecção de rotas + redirects
```

**Total de ficheiros criados:** 30+

---

## 🔐 Sistema de Autenticação

### Clientes Supabase

#### 1. **lib/supabase/client.ts** — Cliente Browser
```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Uso:**
- Componentes client-side (`'use client'`)
- Hooks (useUser, usePermissions)
- Acções do utilizador (login, logout, queries)

#### 2. **lib/supabase/server.ts** — Cliente Server Components
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { /* ... */ }
      }
    }
  )
}
```

**Uso:**
- Server Components
- Server Actions
- Route Handlers (quando não precisa de service role)

#### 3. **lib/supabase/admin.ts** — Cliente Admin (Service Role)
```typescript
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
```

**Uso:**
- Route Handlers que precisam de bypass RLS
- Operações administrativas (criar utilizadores, etc.)
- **⚠️ APENAS servidor, nunca expor ao cliente**

---

### Middleware de Protecção

**Ficheiro:** `middleware.ts`

**Funcionalidades:**
- ✅ Protege todas as rotas do dashboard (requer autenticação)
- ✅ Redireciona utilizadores não autenticados para `/login`
- ✅ Redireciona utilizadores autenticados de `/login` para `/dashboard`
- ✅ Preserva query param `?redirect=` para voltar à página pretendida
- ✅ Mantém cookies de sessão sincronizados

**Rotas públicas:** `/login`, `/`
**Rotas protegidas:** Todas as outras

---

### Hooks de Autenticação

#### **hooks/use-user.ts**

**Retorna:**
```typescript
{
  user: UserWithRole | null     // Dados do utilizador + role
  loading: boolean               // Estado de carregamento
  error: Error | null            // Erro (se houver)
  isAuthenticated: boolean       // Atalho para !!user
}
```

**Interface UserWithRole:**
```typescript
interface UserWithRole extends DevUser {
  role: Role | null      // Dados do role com permissões
  auth_user: User | null // Utilizador do Supabase Auth
}
```

**Exemplo de uso:**
```typescript
const { user, loading } = useUser()

if (loading) return <Skeleton />
if (!user) return <LoginPrompt />

return <div>Bem-vindo, {user.commercial_name}</div>
```

#### **hooks/use-permissions.ts**

**Métodos:**
- `hasPermission(module)` — Verifica se tem permissão para um módulo
- `hasAnyPermission(modules[])` — Verifica se tem pelo menos uma permissão
- `hasAllPermissions(modules[])` — Verifica se tem todas as permissões
- `isBroker()` — Verifica se é Broker/CEO
- `isTeamLeader()` — Verifica se é Team Leader

**Exemplo de uso:**
```typescript
const { hasPermission } = usePermissions()

if (!hasPermission('properties')) {
  return <AccessDenied />
}

return <PropertiesList />
```

---

## 🎨 Layout e Componentes

### Sidebar (Variant Inset)

**Ficheiro:** `components/layout/app-sidebar.tsx`

**Características:**
- ✅ Variant **"inset"** (conforme solicitado)
- ✅ Colapsável com ícones
- ✅ Navegação com permissões dinâmicas
- ✅ Menu de utilizador com avatar e logout
- ✅ Ícones Lucide React
- ✅ Activo state nos links
- ✅ Tooltips nos ícones quando colapsado

**Módulos do menu:**
1. Dashboard
2. Imóveis
3. Leads
4. Processos
5. Documentos
6. Proprietários
7. Consultores
8. Equipas
9. Comissões
10. Marketing
11. Definições

**Cada módulo só aparece se o utilizador tiver permissão!**

---

### Breadcrumbs

**Ficheiro:** `components/layout/breadcrumbs.tsx`

**Características:**
- ✅ Geração automática baseada no pathname
- ✅ Tradução de segmentos para PT-PT
- ✅ Detecção de UUIDs (mostra "Detalhe")
- ✅ Links clicáveis para navegação

**Exemplo:**
```
/imoveis/novo → Imóveis / Novo
/imoveis/[uuid] → Imóveis / Detalhe
/leads → Leads
```

---

### Dashboard Principal

**Ficheiro:** `app/(dashboard)/page.tsx`

**Secções:**

1. **KPIs (Cards de Estatísticas)**
   - Total de Imóveis (com activos)
   - Leads Activos
   - Consultores Activos
   - Processos em Andamento
   - **Dados em tempo real do Supabase**

2. **Actividade Recente** (placeholder)
3. **Tarefas Pendentes** (placeholder)

**Skeleton Loading:**
- Server Component com Suspense
- Skeleton states durante carregamento
- Animações suaves

---

## 📦 Constantes e Validações

### lib/constants.ts

**Conteúdo completo:**

#### 1. **STATUS_COLORS** — Sistema de cores por status
```typescript
{
  pending_approval: { bg, text, dot, label: 'Pendente Aprovação' },
  active: { bg, text, dot, label: 'Activo' },
  sold: { bg, text, dot, label: 'Vendido' },
  // ... 20+ status diferentes
}
```

**Categorias:**
- Propriedades (6 status)
- Leads (5 status)
- Tarefas de Processo (4 status)
- Prioridade (4 níveis)
- Documentos (3 status)

#### 2. **Labels PT-PT** — Todas as entidades
```typescript
PROPERTY_TYPES      // Apartamento, Moradia, Terreno, etc.
BUSINESS_TYPES      // Venda, Arrendamento, Trespasse
PROPERTY_CONDITIONS // Novo, Usado - Como Novo, etc.
ENERGY_CERTIFICATES // A+, A, B, C, ..., Isento
CONTRACT_REGIMES    // Exclusivo, Não Exclusivo, Angariação
LEAD_SOURCES        // Portal - Idealista, Website, etc.
LEAD_TYPES          // Comprador, Vendedor, Inquilino, etc.
ACTIVITY_TYPES      // Chamada, Email, WhatsApp, etc.
PERSON_TYPES        // Singular, Coletiva
MARITAL_STATUS      // Solteiro(a), Casado(a), etc.
ACTION_TYPES        // Upload, Email, Gerar Documento, Manual
SOLAR_ORIENTATIONS  // Norte, Sul, Este, Oeste, etc.
VIEWS               // Mar, Serra, Rio, Cidade, etc.
EQUIPMENT           // Ar Condicionado, Painéis Solares, etc.
FEATURES            // Varanda, Terraço, Piscina, etc.
TYPOLOGIES          // T0, T1, T2, ..., Loft, Duplex
MODULES             // Dashboard, Imóveis, Leads, etc.
ROLES               // Broker/CEO, Consultor, etc.
```

#### 3. **Formatadores**
```typescript
formatCurrency(value)   // → "1.500,00 €"
formatDate(date)        // → "17/02/2026"
formatDateTime(date)    // → "17/02/2026 15:30"
formatArea(area)        // → "150 m²"
formatPercentage(value) // → "15%"
```

---

### lib/validations/

#### **property.ts** — Schemas Zod para Imóveis
```typescript
propertySchema            // Dados gerais do imóvel
propertySpecsSchema       // Especificações técnicas
propertyInternalSchema    // Dados internos (não públicos)
propertyMediaSchema       // Media (fotos, vídeos)
```

#### **lead.ts** — Schemas Zod para Leads
```typescript
leadSchema               // Dados do lead
leadActivitySchema       // Actividades do lead
```

#### **owner.ts** — Schemas Zod para Proprietários
```typescript
ownerSchema              // Dados do proprietário (+ validação pessoa colectiva)
propertyOwnerSchema      // Ligação imóvel-proprietário
```

**Validações incluem:**
- ✅ Tipos obrigatórios
- ✅ Validações de email/NIF
- ✅ Validações condicionais (pessoa colectiva)
- ✅ Mensagens de erro em PT-PT

---

## 🎨 Componentes shadcn/ui Instalados

**Total:** 17 componentes

1. ✅ **form** — Formulários com react-hook-form
2. ✅ **sonner** — Toasts (notificações)
3. ✅ **skeleton** — Loading states
4. ✅ **avatar** — Fotos de perfil
5. ✅ **popover** — Dropdowns contextuais
6. ✅ **command** — Command palette
7. ✅ **dialog** — Modais
8. ✅ **tabs** — Navegação por tabs
9. ✅ **breadcrumb** — Breadcrumbs
10. ✅ **sidebar** — Sidebar navegação
11. ✅ **tooltip** — Tooltips
12. ✅ **sheet** — Sidebar mobile
13. ✅ **dropdown-menu** — Menus dropdown
14. ✅ **button** — Botões
15. ✅ **input** — Campos de texto
16. ✅ **label** — Labels de formulário
17. ✅ **card** — Cards de conteúdo

**Componentes já existentes (instalados antes):**
- badge, input, textarea, select, separator, alert-dialog, combobox

---

## 🌐 Configuração Global

### app/layout.tsx — Layout Raiz

**Configurações aplicadas:**
```tsx
<html lang="pt" suppressHydrationWarning>
  {/* Mapbox CSS */}
  import "mapbox-gl/dist/mapbox-gl.css"

  {/* Sonner Toaster */}
  <Toaster position="top-right" richColors />

  {/* Tooltip Provider */}
  <TooltipProvider>{children}</TooltipProvider>
</html>
```

**Metadata:**
```typescript
{
  title: "ERP Infinity | Gestão Imobiliária",
  description: "Sistema de gestão interno para a Infinity Group"
}
```

---

### app/globals.css — Estilos Globais

**Adições:**
```css
/* Animação fadeInUp para itens de lista */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fadeInUp 0.3s ease-out forwards;
}
```

**Uso:**
```tsx
<div className="animate-in">...</div>
```

---

## 🔄 Fluxo de Autenticação

### 1. Login
```
Utilizador acede a /login
  ↓
Preenche email + password
  ↓
Submit → createClient().auth.signInWithPassword()
  ↓
Success → toast.success + redirect /dashboard
  ↓
Error → toast.error + mensagem PT-PT
```

### 2. Middleware
```
Request → middleware.ts
  ↓
Verifica auth → supabase.auth.getUser()
  ↓
Se autenticado + rota pública → redirect /dashboard
  ↓
Se não autenticado + rota protegida → redirect /login?redirect=...
  ↓
Se OK → NextResponse.next()
```

### 3. Dashboard
```
Acesso a /dashboard
  ↓
layout.tsx → render AppSidebar + SidebarInset
  ↓
page.tsx → Suspense → DashboardStats (Server Component)
  ↓
Queries Supabase em paralelo
  ↓
Render KPIs + Actividade
```

---

## 🧪 Como Testar

### 1. Verificar Build
```bash
npm run build
```
**Deve compilar sem erros.**

### 2. Iniciar Dev Server
```bash
npm run dev
```
**Abrir:** http://localhost:3000

### 3. Fluxo de Teste

1. **Aceder à raiz** → deve redirecionar para `/login`
2. **Fazer login com credenciais válidas** → deve redirecionar para `/dashboard`
3. **Ver dashboard** → deve mostrar KPIs e sidebar
4. **Testar sidebar** → clicar nos links (sem permissão, não deve aparecer)
5. **Testar logout** → deve voltar para `/login`
6. **Breadcrumbs** → navegar e ver breadcrumbs a actualizar

---

## 📊 Dados de Teste

### Criar Utilizador de Teste

**Via Supabase Dashboard:**
1. Ir para Authentication → Users
2. Add User
3. Email: `teste@infinity.pt`
4. Password: `senha123`
5. Criar registo em `dev_users`:
   ```sql
   INSERT INTO dev_users (id, commercial_name, professional_email, role_id, is_active)
   VALUES (
     '<user-id-do-auth>',
     'Utilizador Teste',
     'teste@infinity.pt',
     '<role-id-broker>',
     true
   );
   ```

**Role Broker tem todas as permissões!**

---

## 🎯 Próximos Passos (FASE 2)

Com a fundação completa, as próximas implementações serão:

### **FASE 2 — Módulos Core** 🟠

1. **Dashboard Completo**
   - Gráficos (leads por mês, imóveis por status)
   - Actividade recente real
   - Tarefas pendentes reais

2. **Módulo Imóveis**
   - ✅ Listagem com filtros e search
   - ✅ Formulário multi-step (Geral → Specs → Internos → Proprietários → Media)
   - ✅ Componente Mapbox (PropertyAddressMapPicker)
   - ✅ Upload de imagens ao R2
   - ✅ Detalhe com tabs

3. **Módulo Proprietários**
   - ✅ CRUD completo
   - ✅ Reutilização por NIF/email
   - ✅ Ligação a imóveis

4. **Módulo Documentos**
   - ✅ Upload com validação
   - ✅ Gestão de tipos
   - ✅ Preview de PDFs

---

## 📝 Notas Importantes

### Permissões
- Sistema baseado em `roles.permissions` (JSONB)
- Cada módulo tem um booleano no objecto de permissões
- Sidebar filtra automaticamente os itens visíveis
- Use `usePermissions()` para condicionar UI

### Língua
- **TUDO em Português de Portugal (PT-PT)**
- Botões: "Guardar", "Cancelar", "Eliminar"
- Confirmações: "Tem a certeza de que pretende..."
- Sem resultados: "Nenhum resultado encontrado"

### Toasts (Sonner)
```typescript
// Sucesso
toast.success('Imóvel criado com sucesso')

// Erro
toast.error('Erro ao guardar. Tente novamente.')

// Loading
const id = toast.loading('A guardar...')
toast.dismiss(id)

// Promise
toast.promise(saveProperty(), {
  loading: 'A guardar...',
  success: 'Guardado!',
  error: 'Erro ao guardar.'
})
```

### Status Colors
```tsx
import { STATUS_COLORS } from '@/lib/constants'

const status = STATUS_COLORS['active']
// { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'Activo' }

<span className={cn(status.bg, status.text, 'px-2 py-1 rounded')}>
  {status.label}
</span>
```

---

## ✅ Checklist de Conclusão

- [x] Estrutura de pastas completa
- [x] Clientes Supabase (client, server, admin)
- [x] Types do Supabase gerados
- [x] Constantes PT-PT (STATUS_COLORS + labels)
- [x] Validações Zod (property, lead, owner)
- [x] Hooks de autenticação (useUser, usePermissions)
- [x] Página de login
- [x] Middleware de protecção
- [x] Sidebar variant="inset"
- [x] Breadcrumbs dinâmicos
- [x] Dashboard com KPIs
- [x] Layout raiz configurado (Mapbox CSS, Sonner, PT-PT)
- [x] Componentes shadcn instalados
- [x] Animações CSS

---

## 🎉 Conclusão

A **FASE 1 — Fundação** está **100% completa** e pronta para uso!

O ERP Infinity tem agora:
- ✅ Autenticação funcional e segura
- ✅ Layout profissional com sidebar inset
- ✅ Sistema de permissões robusto
- ✅ Dashboard com dados reais
- ✅ Estrutura escalável para os próximos módulos
- ✅ Toda a UI em PT-PT

**Pode agora prosseguir para a FASE 2 (Módulos Core) com confiança!** 🚀
