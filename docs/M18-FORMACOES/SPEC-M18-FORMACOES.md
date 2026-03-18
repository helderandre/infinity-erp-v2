# M18 — Formações (Plataforma de Formação e Desenvolvimento)

**Versão:** 2.0
**Data:** 2026-03-16
**Estado:** Implementado

## Visão Geral

Plataforma interna de formação contínua para consultores e staff da Infinity Group. Permite criar, gerir e acompanhar cursos de formação com vídeos, PDFs, testes de avaliação e certificados internos. Os gestores podem acompanhar o progresso individual e por equipa.

---

## Base de Dados (16 tabelas TEMP)

### Tabelas Criadas

| Tabela | Descrição |
|--------|-----------|
| `TEMP_training_categories` | Categorias de formação (Comercial, Processual, Marketing, etc.) |
| `TEMP_training_courses` | Cursos de formação com metadata completa |
| `TEMP_training_modules` | Módulos dentro de cada curso (agrupam lições) |
| `TEMP_training_lessons` | Lições individuais (vídeo, PDF, texto, link externo) |
| `TEMP_training_quizzes` | Testes de avaliação (por módulo ou curso) |
| `TEMP_training_quiz_questions` | Perguntas dos quizzes (escolha única/múltipla/V-F) |
| `TEMP_training_enrollments` | Inscrições dos utilizadores em cursos |
| `TEMP_training_lesson_progress` | Progresso por lição (vídeo watched %, tempo gasto) |
| `TEMP_training_quiz_attempts` | Tentativas de quiz com respostas e scores |
| `TEMP_training_learning_paths` | Percursos de formação (sequências de cursos) |
| `TEMP_training_learning_path_courses` | Cursos num percurso (junction table) |
| `TEMP_training_path_enrollments` | Inscrições em percursos |
| `TEMP_training_comments` | Comentários/dúvidas por lição |
| `TEMP_training_bookmarks` | Favoritos (cursos e lições) |
| `TEMP_training_certificates` | Certificados emitidos (internos e externos) |
| `TEMP_training_notifications` | Notificações de formação |

### Categorias Seed (8)

Comercial, Processual, Marketing, Liderança, Jurídico/Legal, Tecnologia/Ferramentas, Desenvolvimento Pessoal, Onboarding.

---

## API Routes (32 endpoints)

### Categorias
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/training/categories` | Listar categorias activas |
| POST | `/api/training/categories` | Criar categoria |
| PUT | `/api/training/categories/[id]` | Editar categoria |
| DELETE | `/api/training/categories/[id]` | Desactivar categoria |

### Cursos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/training/courses` | Listar cursos (filtros: categoria, dificuldade, status, search, paginação) |
| POST | `/api/training/courses` | Criar curso |
| GET | `/api/training/courses/[id]` | Detalhe do curso (módulos, lições, progresso do utilizador) |
| PUT | `/api/training/courses/[id]` | Editar curso |
| DELETE | `/api/training/courses/[id]` | Arquivar curso |
| POST | `/api/training/courses/[id]/publish` | Publicar curso |
| POST | `/api/training/courses/[id]/enroll` | Inscrever utilizador actual |
| POST | `/api/training/courses/[id]/assign` | Atribuir curso a múltiplos utilizadores |

### Módulos & Lições
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/training/courses/[id]/modules` | Criar módulo |
| PUT | `/api/training/modules/[id]` | Editar módulo |
| DELETE | `/api/training/modules/[id]` | Eliminar módulo |
| POST | `/api/training/modules/[id]/lessons` | Criar lição |
| PUT | `/api/training/lessons/[id]` | Editar lição |
| DELETE | `/api/training/lessons/[id]` | Eliminar lição |
| PUT | `/api/training/courses/[id]/lessons/[lessonId]/progress` | Actualizar progresso da lição |

### Quizzes
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/training/quizzes` | Criar quiz |
| PUT | `/api/training/quizzes/[id]` | Editar quiz |
| DELETE | `/api/training/quizzes/[id]` | Eliminar quiz |
| GET | `/api/training/quizzes/[id]/questions` | Listar perguntas |
| POST | `/api/training/quizzes/[id]/questions` | Criar pergunta |
| PUT | `/api/training/questions/[id]` | Editar pergunta |
| DELETE | `/api/training/questions/[id]` | Eliminar pergunta |
| POST | `/api/training/quizzes/[id]/attempt` | Submeter tentativa |
| GET | `/api/training/quizzes/[id]/attempts` | Listar tentativas do utilizador |

### Utilizador
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/training/my-courses` | Os meus cursos (inscrições com progresso) |
| GET | `/api/training/my-certificates` | Os meus certificados |
| GET/POST | `/api/training/bookmarks` | Favoritos (listar/toggle) |

### Percursos
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/training/learning-paths` | Listar percursos |
| POST | `/api/training/learning-paths` | Criar percurso |
| GET | `/api/training/learning-paths/[id]` | Detalhe do percurso |
| PUT | `/api/training/learning-paths/[id]` | Editar percurso |
| POST | `/api/training/learning-paths/[id]/enroll` | Inscrever em percurso |

### Comentários
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET/POST | `/api/training/courses/[id]/lessons/[lessonId]/comments` | Comentários por lição |
| PUT | `/api/training/comments/[id]` | Editar comentário |
| DELETE | `/api/training/comments/[id]` | Eliminar comentário |
| PUT | `/api/training/comments/[id]/resolve` | Resolver comentário |

### Estatísticas & Notificações
| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/training/stats/overview` | Estatísticas gerais |
| GET | `/api/training/stats/users/[userId]` | Estatísticas por utilizador |
| GET | `/api/training/notifications` | Notificações do utilizador |
| PUT | `/api/training/notifications/[id]/read` | Marcar como lida |
| PUT | `/api/training/notifications/read-all` | Marcar todas como lidas |

---

## Frontend

### Páginas (13)

| URL | Descrição |
|-----|-----------|
| `/dashboard/formacoes` | Catálogo de formações (grid de cursos com filtros) |
| `/dashboard/formacoes/meus-cursos` | Os meus cursos (tabs: Em Progresso, Concluídos, Todos) |
| `/dashboard/formacoes/certificados` | Os meus certificados (tabs: Internos, Externos) |
| `/dashboard/formacoes/cursos/[id]` | Detalhe do curso (curriculum, sobre, certificado) |
| `/dashboard/formacoes/cursos/[id]/licoes/[lessonId]` | Player de lição (vídeo/PDF/texto + sidebar + comentários) |
| `/dashboard/formacoes/cursos/[id]/quiz/[quizId]` | Quiz player (perguntas paginadas + timer + resultados) |
| `/dashboard/formacoes/percursos` | Listagem de percursos de formação |
| `/dashboard/formacoes/percursos/[id]` | Detalhe do percurso (timeline de cursos) |
| `/dashboard/formacoes/estatisticas` | Dashboard de estatísticas (admin) |
| `/dashboard/formacoes/gestao` | Gestão de cursos (admin: tabela com CRUD) |
| `/dashboard/formacoes/gestao/novo` | Criar novo curso |
| `/dashboard/formacoes/gestao/[id]/editar` | Editar curso (tabs: Detalhes, Conteúdo, Configuração) |
| `/dashboard/formacoes/gestao/categorias` | Gestão de categorias |

### Componentes (20)

| Componente | Descrição |
|------------|-----------|
| `course-card` | Card de curso para o catálogo (imagem, badges, progresso) |
| `training-filters` | Barra de filtros (search, categoria, dificuldade) |
| `difficulty-badge` | Badge de nível de dificuldade com cor |
| `course-progress-bar` | Barra de progresso do curso |
| `bookmark-button` | Botão de favorito (toggle) |
| `course-detail-header` | Header hero do detalhe do curso |
| `course-curriculum` | Lista de módulos/lições com accordion |
| `lesson-player` | Player de vídeo (YouTube, Vimeo, nativo) com tracking |
| `lesson-pdf-viewer` | Viewer de PDF com botão de download |
| `lesson-text-content` | Renderizador de conteúdo texto/HTML |
| `lesson-sidebar` | Navegação lateral com módulos/lições |
| `lesson-comments` | Secção de comentários com replies |
| `quiz-player` | Player de quiz (perguntas paginadas, timer) |
| `quiz-results` | Resultados do quiz (score, respostas correctas/incorrectas) |
| `quiz-builder` | Admin: construtor de quizzes |
| `course-builder` | Admin: construtor de módulos e lições |
| `training-stats-overview` | Dashboard de estatísticas (KPIs, top cursos) |
| `certificate-card` | Card de certificado |
| `learning-path-card` | Card de percurso de formação |
| `training-notifications-dropdown` | Dropdown de notificações no header |

### Hooks (8)

| Hook | Descrição |
|------|-----------|
| `use-training-courses` | Listagem de cursos com filtros e debounce |
| `use-training-course` | Detalhe de um curso |
| `use-training-enrollment` | Inscrições do utilizador |
| `use-training-lesson` | Tracking de progresso de lição |
| `use-training-quiz` | Perguntas, tentativas e submissão de quiz |
| `use-training-stats` | Estatísticas gerais e por utilizador |
| `use-training-notifications` | Notificações com mark as read |
| `use-training-bookmarks` | Favoritos com toggle |

---

## Funcionalidades

### Para Consultores
- Catálogo de formações com filtros por categoria, dificuldade e pesquisa
- Inscrição em cursos e percursos de formação
- Player de vídeo com resume (continua onde parou)
- Viewer de PDF e conteúdo de texto
- Testes de avaliação com nota mínima e múltiplas tentativas
- Progresso detalhado por lição e por curso
- Certificados internos (emitidos automaticamente ao concluir)
- Certificados externos (upload manual)
- Favoritos/bookmarks em cursos e lições
- Comentários/dúvidas por lição
- Notificações de novas formações, prazos e resultados
- Percursos de formação (sequências de cursos)

### Para Gestores/Admin
- Criar e gerir cursos (rascunho → publicação → arquivo)
- Construtor visual de módulos e lições
- Construtor de quizzes com perguntas de escolha única/múltipla/V-F
- Atribuir formações a consultores com prazo
- Formações obrigatórias por role
- Dashboard de estatísticas (taxa de conclusão, notas, top cursos)
- Gestão de categorias
- Gestão de percursos de formação
- Acompanhar progresso individual e por equipa

### Tipos de Conteúdo
- **Vídeo**: YouTube, Vimeo, nativo (R2/outro) — com tracking de progresso
- **PDF**: Visualização inline + download
- **Texto**: Conteúdo HTML renderizado
- **Link externo**: Abertura em nova tab

### Sistema de Avaliação
- Quizzes por módulo ou por curso
- Tipos de pergunta: escolha única, escolha múltipla, verdadeiro/falso
- Nota mínima configurável por curso (default: 70%)
- Limite de tentativas configurável (0 = ilimitado)
- Timer opcional por quiz
- Shuffle de perguntas opcional
- Resultados com explicação por pergunta

### Certificados
- Emissão automática ao concluir curso (se has_certificate = true)
- Validade configurável (meses)
- Certificados externos (upload manual por consultores)
- Código único por certificado

---

## Permissão

Módulo: `training`
- Adicionado a `ALL_PERMISSION_MODULES` em `lib/auth/roles.ts`
- Adicionado a `MODULES` e `PERMISSION_MODULES` em `lib/constants.ts`
- Sidebar entry: "Formações" com icon `GraduationCap`

---

## Notas Técnicas

1. Todas as tabelas usam prefixo `TEMP_` (temporário, para renomear após validação)
2. 8 categorias seeded automaticamente
3. Auto-complete de lição de vídeo quando visto ≥ 90%
4. Progresso do enrollment recalculado automaticamente ao completar lições
5. Enrollment status muda para `completed` quando todas as lições + quizzes passados
6. Quiz score calculado server-side (opções correctas não enviadas ao cliente no player)
7. Comentários suportam threading (parent_id) e resolução
8. Notificações criadas automaticamente ao atribuir cursos
