export interface AgentWeeklyReport {
  id: string
  agent_id: string
  week_start: string // YYYY-MM-DD (Monday)
  notes_wins: string | null
  notes_challenges: string | null
  notes_next_week: string | null
  ai_summary: string | null
  ai_advice: AiAdvice | null
  ai_generated_at: string | null
  created_at: string
  updated_at: string
}

export interface AiAdvice {
  /** 2-3 specific actionable tips for next week */
  tips: string[]
  /** What the agent did well */
  strengths: string[]
  /** Where to focus next */
  focus_areas: string[]
}
