// ─── Training Module Types ───────────────────────────────

export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type CourseStatus = 'draft' | 'published' | 'archived'
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'failed' | 'expired'
export type LessonContentType = 'video' | 'pdf' | 'text' | 'external_link'
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

export interface TrainingLessonProgress {
  id: string
  user_id: string
  lesson_id: string
  enrollment_id: string
  status: LessonProgressStatus
  video_watched_seconds: number
  video_watch_percent: number
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
