# ERP Infinity — Sistema de Gestão Imobiliária

Sistema de gestão interno para a **Infinity Group** (Portugal).

## 🚀 Estado do Projecto

**Última actualização:** 2026-02-17

### ✅ FASE 1 — Fundação (CONCLUÍDA)
- Autenticação completa (Supabase Auth)
- Layout do dashboard com sidebar inset
- Sistema de permissões
- Dashboard com KPIs básicos
- 30+ ficheiros criados
- 17 componentes shadcn/ui instalados

**Ver detalhes:** [docs/FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md)

### 🟠 FASE 2 — Módulos Core (PRÓXIMA)
- Módulo Imóveis completo
- Módulo Proprietários
- Módulo Documentos
- Dashboard completo

---

## 📋 Stack Tecnológica

- **Framework:** Next.js 16 (App Router, Server Components)
- **Linguagem:** TypeScript (strict)
- **UI:** shadcn/ui + Radix UI + Tailwind CSS v4
- **Backend/DB:** Supabase (PostgreSQL)
- **Storage:** Cloudflare R2
- **Maps:** Mapbox GL JS
- **Auth:** Supabase Auth

---

## 🛠️ Instalação e Setup

### 1. Clonar Repositório
```bash
git clone <repo-url>
cd erp-infinity-v2
```

### 2. Instalar Dependências
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
Criar ficheiro `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://umlndumjfamfsswwjgoo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Cloudflare R2
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=public
R2_PUBLIC_DOMAIN=https://pub-xxx.r2.dev
R2_UPLOAD_PATH=imoveis-imagens
R2_DOCUMENTS_PATH=imoveis

# Mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ1...
```

### 4. Iniciar Servidor de Desenvolvimento
```bash
npm run dev
```

Abrir: http://localhost:3000

---

## 📚 Documentação

### Documentos Principais
- **[CLAUDE.md](CLAUDE.md)** — Guia completo do projecto (especificações técnicas, schema DB, padrões)
- **[FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md)** — Documentação detalhada da Fase 1

### Estrutura do Projecto
```
app/
├── (auth)/login/          # Página de login
├── (dashboard)/           # Dashboard protegido
├── api/auth/callback/     # Callback Supabase Auth
└── layout.tsx             # Layout raiz (Sonner, Mapbox CSS)

components/
├── layout/                # Sidebar, breadcrumbs
└── ui/                    # shadcn/ui components

lib/
├── supabase/              # Clientes Supabase (client, server, admin)
├── validations/           # Schemas Zod
└── constants.ts           # STATUS_COLORS + labels PT-PT

hooks/
├── use-user.ts            # Hook de autenticação
├── use-permissions.ts     # Hook de permissões
└── use-debounce.ts        # Debounce

types/
└── database.ts            # Types gerados do Supabase

middleware.ts              # Protecção de rotas
```

---

## 🔐 Autenticação

### Criar Utilizador de Teste

1. Ir para Supabase Dashboard → Authentication → Users
2. Adicionar utilizador
3. Criar registo em `dev_users`:
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

### Login
- Email: `teste@infinity.pt`
- Password: definida no passo 2

---

## 🎨 Padrões de Desenvolvimento

### 1. Idioma
**Tudo em Português de Portugal (PT-PT)**
- Botões: "Guardar", "Cancelar", "Eliminar"
- Mensagens: "Tem a certeza de que pretende..."
- Sem resultados: "Nenhum resultado encontrado"

### 2. Componentes
- Máximo 150 linhas por componente
- Extrair sub-componentes quando necessário
- Usar hooks customizados para lógica de estado

### 3. Toasts (Sonner)
```typescript
toast.success('Imóvel criado com sucesso')
toast.error('Erro ao guardar. Tente novamente.')
toast.loading('A guardar...')
```

### 4. Status Colors
```typescript
import { STATUS_COLORS } from '@/lib/constants'

const status = STATUS_COLORS['active']
// { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Activo' }
```

### 5. Permissões
```typescript
import { usePermissions } from '@/hooks/use-permissions'

const { hasPermission } = usePermissions()

if (!hasPermission('properties')) {
  return <AccessDenied />
}
```

---

## 🧪 Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Iniciar servidor de produção
npm run lint         # Linting
```

---

## 📦 Componentes Instalados

**17 componentes shadcn/ui:**
- sidebar, form, sonner, skeleton, avatar, popover, command
- dialog, tabs, breadcrumb, tooltip, sheet, dropdown-menu
- button, input, label, card

---

## 🔗 Links Úteis

- **Supabase Dashboard:** https://supabase.com/dashboard/project/umlndumjfamfsswwjgoo
- **shadcn/ui Docs:** https://ui.shadcn.com
- **Mapbox Docs:** https://docs.mapbox.com
- **Next.js Docs:** https://nextjs.org/docs

---

## 📧 Suporte

Para questões ou bugs, consultar:
- [CLAUDE.md](CLAUDE.md) — Especificações completas
- [FASE-01-IMPLEMENTACAO.md](docs/FASE-01-IMPLEMENTACAO.md) — Guia de implementação

---

© 2026 Infinity Group — Sistema interno de gestão imobiliária
