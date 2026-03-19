import { z } from 'zod'

const uuidRegex = /^[0-9a-f-]{36}$/

// ─── Categories ──────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100).trim(),
  description: z.string().max(500).optional().or(z.literal('')),
  icon: z.string().max(50).optional().or(z.literal('')),
  color: z.string().max(30).default('blue-500'),
  order_index: z.number().int().min(0).default(0),
})

export const updateCategorySchema = createCategorySchema.partial()

// ─── Courses ─────────────────────────────────────────────

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  description: z.string().max(5000).optional().or(z.literal('')),
  summary: z.string().max(300).optional().or(z.literal('')),
  cover_image_url: z.string().url().optional().nullable(),
  category_id: z.string().regex(uuidRegex, 'Categoria inválida'),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  tags: z.array(z.string()).default([]),
  instructor_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
  instructor_name: z.string().max(100).optional().or(z.literal('')),
  estimated_duration_minutes: z.number().int().min(1).optional().nullable(),
  is_mandatory: z.boolean().default(false),
  mandatory_for_roles: z.array(z.string()).default([]),
  has_certificate: z.boolean().default(false),
  certificate_validity_months: z.number().int().min(1).optional().nullable(),
  passing_score: z.number().int().min(0).max(100).default(70),
  prerequisite_course_ids: z.array(z.string().regex(uuidRegex)).default([]),
})

export const updateCourseSchema = createCourseSchema.partial()

// ─── Modules ─────────────────────────────────────────────

export const createModuleSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  description: z.string().max(2000).optional().or(z.literal('')),
  order_index: z.number().int().min(0).default(0),
})

export const updateModuleSchema = createModuleSchema.partial()

// ─── Lessons ─────────────────────────────────────────────

export const createLessonSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  description: z.string().max(2000).optional().or(z.literal('')),
  content_type: z.enum(['video', 'pdf', 'text', 'external_link', 'quiz']),
  video_url: z.string().url('URL inválido').optional().or(z.literal('')),
  video_provider: z.enum(['youtube', 'vimeo', 'r2', 'other']).optional(),
  video_duration_seconds: z.number().int().min(1).optional().nullable(),
  pdf_url: z.string().url('URL inválido').optional().or(z.literal('')),
  text_content: z.string().max(50000).optional().or(z.literal('')),
  external_url: z.string().url('URL inválido').optional().or(z.literal('')),
  order_index: z.number().int().min(0).default(0),
  estimated_minutes: z.number().int().min(1).optional().nullable(),
})

export const updateLessonSchema = createLessonSchema.partial()

// ─── Quizzes ─────────────────────────────────────────────

export const createQuizSchema = z.object({
  module_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
  course_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
  title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  description: z.string().max(2000).optional().or(z.literal('')),
  passing_score: z.number().int().min(0).max(100).default(70),
  max_attempts: z.number().int().min(0).default(0),
  time_limit_minutes: z.number().int().min(1).optional().nullable(),
  shuffle_questions: z.boolean().default(false),
  show_correct_answers: z.boolean().default(true),
})

export const updateQuizSchema = createQuizSchema.partial()

// ─── Quiz Questions ──────────────────────────────────────

export const createQuestionSchema = z.object({
  question_text: z.string().min(1, 'Pergunta é obrigatória').max(1000).trim(),
  question_type: z.enum(['single_choice', 'multiple_choice', 'true_false']),
  options: z.array(z.object({
    id: z.string(),
    text: z.string().min(1, 'Texto da opção é obrigatório'),
    is_correct: z.boolean(),
  })).min(2, 'Mínimo 2 opções'),
  explanation: z.string().max(2000).optional().or(z.literal('')),
  points: z.number().int().min(1).default(1),
  order_index: z.number().int().min(0).default(0),
})

export const updateQuestionSchema = createQuestionSchema.partial()

// ─── Lesson Material ────────────────────────────────────

export const createLessonMaterialSchema = z.object({
  material_type: z.enum(['file', 'link']),
  link_url: z.string().url('URL inválido').optional().or(z.literal('')),
  link_title: z.string().min(1).max(200).optional().or(z.literal('')),
  description: z.string().max(500).optional().or(z.literal('')),
})

export type CreateLessonMaterialInput = z.infer<typeof createLessonMaterialSchema>

// ─── Progress ────────────────────────────────────────────

export const updateLessonProgressSchema = z.object({
  status: z.enum(['in_progress', 'completed']).optional(),
  video_watched_seconds: z.number().int().min(0).optional(),
  video_watch_percent: z.number().int().min(0).max(100).optional(),
  time_spent_seconds: z.number().int().min(0).optional(),
})

// ─── Quiz Attempt ────────────────────────────────────────

export const submitQuizAttemptSchema = z.object({
  answers: z.array(z.object({
    question_id: z.string().regex(uuidRegex),
    selected_options: z.array(z.string()).min(1, 'Seleccione pelo menos uma opção'),
  })).min(1, 'Responda a pelo menos uma pergunta'),
  time_spent_seconds: z.number().int().min(0).optional(),
})

// ─── Assignment ──────────────────────────────────────────

export const assignCourseSchema = z.object({
  user_ids: z.array(z.string().regex(uuidRegex)).min(1, 'Seleccione pelo menos um utilizador'),
  deadline: z.string().datetime().optional(),
})

// ─── Bookmarks ───────────────────────────────────────────

export const createBookmarkSchema = z.object({
  course_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
  lesson_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
}).refine(
  data => (data.course_id && data.course_id !== '') || (data.lesson_id && data.lesson_id !== ''),
  { message: 'Deve especificar um curso ou uma lição' }
)

// ─── Comments ────────────────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comentário é obrigatório').max(2000).trim(),
  parent_id: z.string().regex(uuidRegex).optional().or(z.literal('')),
})

// ─── External Certificate ────────────────────────────────

export const createExternalCertificateSchema = z.object({
  external_title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  external_provider: z.string().min(1, 'Entidade formadora é obrigatória').max(200).trim(),
  issued_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
})

// ─── Learning Paths ──────────────────────────────────────

export const createLearningPathSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').max(200).trim(),
  description: z.string().max(5000).optional().or(z.literal('')),
  is_mandatory: z.boolean().default(false),
  mandatory_for_roles: z.array(z.string()).default([]),
  estimated_duration_minutes: z.number().int().min(1).optional().nullable(),
  course_ids: z.array(z.string().regex(uuidRegex)).default([]),
})

export const updateLearningPathSchema = createLearningPathSchema.partial()

// ─── Lesson Rating ──────────────────────────────────────

export const rateLessonSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Avaliação deve ser entre 1 e 5'),
})

export type RateLessonInput = z.infer<typeof rateLessonSchema>

// ─── Lesson Report ──────────────────────────────────────

export const reportLessonSchema = z.object({
  reason: z.enum([
    'video_corrupted',
    'audio_issues',
    'wrong_content',
    'file_corrupted',
    'broken_link',
    'other',
  ], { message: 'Seleccione um motivo' }),
  comment: z.string().max(1000).optional(),
})

export type ReportLessonInput = z.infer<typeof reportLessonSchema>

// ─── Inferred Types ──────────────────────────────────────

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type CreateCourseInput = z.infer<typeof createCourseSchema>
export type CreateModuleInput = z.infer<typeof createModuleSchema>
export type CreateLessonInput = z.infer<typeof createLessonSchema>
export type CreateQuizInput = z.infer<typeof createQuizSchema>
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>
export type SubmitQuizAttemptInput = z.infer<typeof submitQuizAttemptSchema>
export type AssignCourseInput = z.infer<typeof assignCourseSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CreateLearningPathInput = z.infer<typeof createLearningPathSchema>

// === ADMIN SCHEMAS ===

export const updateReportStatusSchema = z.object({
  status: z.enum(['in_review', 'resolved', 'dismissed']),
  resolution_note: z.string().max(1000).optional(),
})

export type UpdateReportStatusInput = z.infer<typeof updateReportStatusSchema>
