// ─── Training Module Types ───────────────────────────────

export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type CourseStatus = 'draft' | 'published' | 'archived'
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'failed' | 'expired'
export type LessonContentType = 'video' | 'pdf' | 'text' | 'external_link' | 'quiz'
export type VideoProvider = 'youtube' | 'vimeo' | 'r2' | 'other'
export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed'
export type QuizQuestionType = 'single_choice' | 'multiple_choice' | 'true_false'
export type TrainingNotificationType =
  | 'new_course'
  | 'course_assigned'
  | 'deadline_reminder'
  | 'certificate_expiring'
  | 'quiz_passed'
  | 'quiz_failed'
  | 'course_completed'
  | 'new_comment_reply'

// ─── Category ────────────────────────────────────────────

export interface TrainingCategory {
  id: string
  name: string
  slug: string
  description?: string | null
  icon?: string | null
  color: string
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
  course_count?: number
}

// ─── Course ──────────────────────────────────────────────

export interface TrainingCourse {
  id: string
  title: string
  slug: string
  description?: string | null
  summary?: string | null
  cover_image_url?: string | null
  category_id: string
  category?: TrainingCategory | null
  difficulty_level: CourseDifficulty
  tags: string[]
  instructor_id?: string | null
  instructor_name?: string | null
  instructor?: {
    id: string
    commercial_name: string
  } | null
  estimated_duration_minutes?: number | null
  is_mandatory: boolean
  mandatory_for_roles: string[]
  has_certificate: boolean
  certificate_validity_months?: number | null
  passing_score: number
  prerequisite_course_ids: string[]
  status: CourseStatus
  published_at?: string | null
  created_by: string
  created_at: string
  updated_at: string

  // Joined
  modules?: TrainingModule[]
  module_count?: number
  lesson_count?: number
  enrollment_count?: number
  completion_rate?: number
  enrollment?: TrainingEnrollment | null
}

// ─── Module ──────────────────────────────────────────────

export interface TrainingModule {
  id: string
  course_id: string
  title: string
  description?: string | null
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
  lessons?: TrainingLesson[]
  quiz?: TrainingQuiz | null
  lesson_count?: number
  completed_lesson_count?: number
}

// ─── Lesson ──────────────────────────────────────────────

export interface TrainingLesson {
  id: string
  module_id: string
  title: string
  description?: string | null
  content_type: LessonContentType
  video_url?: string | null
  video_provider?: VideoProvider | null
  video_duration_seconds?: number | null
  pdf_url?: string | null
  text_content?: string | null
  external_url?: string | null
  order_index: number
  is_active: boolean
  estimated_minutes?: number | null
  created_at: string
  updated_at: string
  progress?: TrainingLessonProgress | null
  materials?: TrainingLessonMaterial[]
  material_count?: number
}

// ─── Lesson Material ────────────────────────────────────

export type LessonMaterialType = 'file' | 'link'

export interface TrainingLessonMaterial {
  id: string
  lesson_id: string
  material_type: LessonMaterialType
  file_url?: string | null
  file_name?: string | null
  file_extension?: string | null
  file_size_bytes?: number | null
  file_mime_type?: string | null
  link_url?: string | null
  link_title?: string | null
  description?: string | null
  order_index: number
  created_at: string
  updated_at: string
}

// ─── Quiz ────────────────────────────────────────────────

export interface TrainingQuiz {
  id: string
  module_id?: string | null
  course_id?: string | null
  title: string
  description?: string | null
  passing_score: number
  max_attempts: number
  time_limit_minutes?: number | null
  shuffle_questions: boolean
  show_correct_answers: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  questions?: TrainingQuizQuestion[]
  question_count?: number
  best_attempt?: TrainingQuizAttempt | null
}

export interface TrainingQuizQuestion {
  id: string
  quiz_id: string
  question_text: string
  question_type: QuizQuestionType
  options: Array<{
    id: string
    text: string
    is_correct: boolean
  }>
  explanation?: string | null
  points: number
  order_index: number
}

// ─── Enrollment ──────────────────────────────────────────

export interface TrainingEnrollment {
  id: string
  user_id: string
  course_id: string
  status: EnrollmentStatus
  progress_percent: number
  enrolled_at: string
  started_at?: string | null
  completed_at?: string | null
  deadline?: string | null
  certificate_issued: boolean
  certificate_url?: string | null
  certificate_expires_at?: string | null
  assigned_by?: string | null
  created_at: string
  updated_at: string
  is_overdue?: boolean
  course?: TrainingCourse | null
  user?: { id: string; commercial_name: string } | null
}

// ─── Lesson Progress ─────────────────────────────────────

export type CompletionSource = 'auto_watch' | 'manual' | 'admin_override' | 'quiz_pass'

export interface TrainingLessonProgress {
  id: string
  user_id: string
  lesson_id: string
  enrollment_id: string
  status: LessonProgressStatus
  video_watched_seconds: number
  video_watch_percent: number
  last_video_position_seconds: number
  completion_source: CompletionSource | null
  started_at?: string | null
  completed_at?: string | null
  last_accessed_at?: string | null
  time_spent_seconds: number
  created_at: string
  updated_at: string
}

// ─── Quiz Attempt ────────────────────────────────────────

export interface TrainingQuizAttempt {
  id: string
  user_id: string
  quiz_id: string
  enrollment_id: string
  score: number
  passed: boolean
  answers: Array<{
    question_id: string
    selected_options: string[]
    is_correct: boolean
    points_earned: number
  }>
  started_at: string
  completed_at?: string | null
  time_spent_seconds?: number | null
  attempt_number: number
  created_at: string
}

// ─── Learning Path ───────────────────────────────────────

export interface TrainingLearningPath {
  id: string
  title: string
  slug: string
  description?: string | null
  cover_image_url?: string | null
  is_mandatory: boolean
  mandatory_for_roles: string[]
  estimated_duration_minutes?: number | null
  status: CourseStatus
  created_by: string
  created_at: string
  updated_at: string
  courses?: Array<TrainingCourse & { order_index: number; is_required: boolean }>
  course_count?: number
  enrollment?: TrainingPathEnrollment | null
}

export interface TrainingPathEnrollment {
  id: string
  user_id: string
  learning_path_id: string
  status: 'enrolled' | 'in_progress' | 'completed'
  progress_percent: number
  enrolled_at: string
  completed_at?: string | null
  deadline?: string | null
  assigned_by?: string | null
}

// ─── Comment ─────────────────────────────────────────────

export interface TrainingComment {
  id: string
  lesson_id: string
  user_id: string
  content: string
  parent_id?: string | null
  is_resolved: boolean
  created_at: string
  updated_at: string
  user?: { id: string; commercial_name: string } | null
  replies?: TrainingComment[]
  // Flattened fields (added by admin API)
  lesson_title?: string
  course_id?: string
  course_title?: string
  user_name?: string
}

// ─── Certificate ─────────────────────────────────────────

export interface TrainingCertificate {
  id: string
  user_id: string
  course_id?: string | null
  enrollment_id?: string | null
  is_external: boolean
  external_title?: string | null
  external_provider?: string | null
  external_file_url?: string | null
  title: string
  certificate_code?: string | null
  pdf_url?: string | null
  issued_at: string
  expires_at?: string | null
  is_valid: boolean
  created_at: string
  course?: { id: string; title: string } | null
}

// ─── Notification ────────────────────────────────────────

export interface TrainingNotification {
  id: string
  user_id: string
  notification_type: TrainingNotificationType
  title: string
  message: string
  course_id?: string | null
  lesson_id?: string | null
  quiz_id?: string | null
  is_read: boolean
  read_at?: string | null
  created_at: string
}

// ─── Stats ───────────────────────────────────────────────

export interface TrainingOverviewStats {
  total_courses: number
  total_published_courses: number
  total_enrollments: number
  total_completions: number
  average_completion_rate: number
  average_quiz_score: number
  total_certificates_issued: number
  top_courses: Array<{
    course_id: string
    title: string
    enrollments: number
    completion_rate: number
  }>
  recent_completions: Array<{
    user_id: string
    user_name: string
    course_title: string
    completed_at: string
  }>
}

export interface UserTrainingStats {
  user_id: string
  user_name: string
  total_enrolled: number
  total_completed: number
  total_in_progress: number
  total_failed: number
  completion_rate: number
  average_quiz_score: number
  total_time_spent_minutes: number
  certificates: TrainingCertificate[]
  courses: Array<TrainingEnrollment & { course_title: string }>
}

// ─── Leaderboard ─────────────────────────────────────────

export interface TrainingLeaderboardEntry {
  user_id: string
  user_name: string
  profile_photo_url?: string | null
  total_points: number
  courses_completed: number
  rank: number
}

// ─── Lesson Rating ──────────────────────────────────────

export interface TrainingLessonRating {
  id: string
  user_id: string
  lesson_id: string
  rating: number  // 1-5
  created_at: string
  updated_at: string
}

// ─── Lesson Report ──────────────────────────────────────

export type LessonReportStatus = 'open' | 'in_review' | 'resolved' | 'dismissed'

export interface TrainingLessonReport {
  id: string
  user_id: string
  lesson_id: string
  reason: string
  comment?: string | null
  status: LessonReportStatus
  resolved_by?: string | null
  resolved_at?: string | null
  resolution_note?: string | null
  created_at: string
  updated_at: string
  // Flattened fields (added by admin API)
  lesson_title?: string
  course_id?: string
  course_title?: string
  user_name?: string
}

// === ADMIN ANALYTICS TYPES ===

export interface AdminReportWithDetails extends TrainingLessonReport {
  user?: { commercial_name: string; profile_photo_url?: string }
  lesson?: { title: string }
  course?: { id: string; title: string }
}

export interface AdminCommentWithDetails extends TrainingComment {
  lesson?: { title: string }
  course?: { id: string; title: string }
}

export interface CourseCompletionStats {
  course_id: string
  title: string
  status: string
  total_enrolled: number
  total_completed: number
  completion_rate: number
  avg_progress: number
}

export interface UserCompletionStats {
  user_id: string
  commercial_name: string
  profile_photo_url?: string
  courses_enrolled: number
  courses_completed: number
  avg_progress: number
  last_activity?: string
}

export interface UserCourseDetail {
  enrollment_id: string
  course_id: string
  course_title: string
  status: string
  progress_percent: number
  enrolled_at: string
  completed_at?: string
  lessons: {
    lesson_id: string
    title: string
    status: string
    completed_at?: string
    time_spent_seconds: number
  }[]
}

export interface MaterialDownloadStats {
  material_id: string
  material_name: string
  course_id: string
  lesson_id: string
  total_downloads: number
  unique_users: number
  last_download?: string
}

export interface MaterialDownloadEvent {
  id: string
  material_id: string
  material_name: string
  lesson_id: string
  course_id: string
  user_id: string
  file_size_bytes?: number
  file_type?: string
  downloaded_at: string
  user?: { commercial_name: string; profile_photo_url?: string }
}

export interface AdminOverviewStats {
  total_reports_open: number
  total_comments_unresolved: number
  avg_completion_rate: number
  total_downloads: number
}

// === COURSE ACTIVITY DASHBOARD ===

export interface CourseActivityLessonRow {
  lesson_id: string
  title: string
  module_id: string
  module_title: string
  order_index: number
  content_type: LessonContentType
  total_viewed: number
  avg_watch_percent: number
  avg_time_spent_seconds: number
  completed_count: number
  completion_by_source: {
    auto_watch: number
    manual: number
    admin_override: number
    quiz_pass: number
    unknown: number
  }
  reports_count: number
}

export interface CourseActivityQuizRow {
  quiz_id: string
  title: string
  lesson_id: string | null
  module_id: string | null
  attempts_count: number
  unique_attempters: number
  pass_rate: number
  avg_score: number
}

export interface CourseActivitySummary {
  total_enrolled: number
  in_progress: number
  completed: number
  avg_progress_percent: number
  avg_time_spent_seconds: number
  certificates_issued: number
  open_reports: number
}

export interface CourseActivityPayload {
  course: {
    id: string
    title: string
    total_modules: number
    total_lessons: number
    total_quizzes: number
  }
  summary: CourseActivitySummary
  lessons: CourseActivityLessonRow[]
  quizzes: CourseActivityQuizRow[]
}

export interface CourseEnrollmentLessonDetail {
  lesson_id: string
  title: string
  module_id: string
  module_title: string
  order_index: number
  content_type: LessonContentType
  status: LessonProgressStatus
  completion_source: CompletionSource | null
  time_spent_seconds: number
  video_watch_percent: number
  last_video_position_seconds: number
  completed_at: string | null
  last_accessed_at: string | null
}

export interface CourseEnrollmentQuizDetail {
  quiz_id: string
  quiz_title: string
  attempt_id: string
  score: number
  passed: boolean
  attempt_number: number
  completed_at: string | null
}

export interface CourseEnrollmentDetail {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  profile_photo_url: string | null
  enrolled_at: string
  status: EnrollmentStatus
  progress_percent: number
  completed_at: string | null
  last_activity_at: string | null
  total_time_spent_seconds: number
  lessons_total: number
  lessons_completed: number
  lessons: CourseEnrollmentLessonDetail[]
  quiz_attempts: CourseEnrollmentQuizDetail[]
}

export interface CourseEnrollmentsResponse {
  data: CourseEnrollmentDetail[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// === VOICE FILL ===

export interface VoiceFillResponse {
  transcription: string
  fields: Partial<{
    title: string
    summary: string
    description: string
    difficulty_level: CourseDifficulty
    instructor_name: string
    estimated_duration_minutes: number
    is_mandatory: boolean
    has_certificate: boolean
    passing_score: number
    tags: string[]
    category_name: string
  }>
  category_match: { id: string; name: string } | null
}
