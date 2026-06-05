import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { OnboardingStageKey } from '@/types/recruitment'

// Calculate current stage based on onboarding data + submission
function calculateCurrentStage(onboarding: any, submission: any): OnboardingStageKey {
  // Stage 1: Form submitted
  if (!submission) return 'form_submitted'

  // Stage 2: Admin validation
  if (submission.status !== 'approved') return 'admin_validation'

  // Stage 3: Contract Sede
  if (onboarding?.contract_sede_status !== 'signed') return 'contract_sede'

  // Stage 4: Contract Ours
  if (onboarding?.contract_ours_status !== 'signed') return 'contract_ours'

  // Stage 5: Access creation
  if (!onboarding?.app_access_created || !onboarding?.remax_access_granted) return 'access_creation'

  // Stage 6: Email & Materials
  if (!onboarding?.email_created || !onboarding?.materials_ready) return 'email_materials'

  // Stage 7: Initial Training
  if (!onboarding?.initial_training_completed) return 'initial_training'

  // Stage 8: Plan 66 days
  return 'plan_66_days'
}

function calculatePercentComplete(currentStage: OnboardingStageKey): number {
  const stageOrder: OnboardingStageKey[] = [
    'form_submitted', 'admin_validation', 'contract_sede', 'contract_ours',
    'access_creation', 'email_materials', 'initial_training', 'plan_66_days',
  ]
  const idx = stageOrder.indexOf(currentStage)
  return Math.round((idx / stageOrder.length) * 100)
}

// GET — returns onboarding record + linked submission + calculated stage
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params
    const admin = createAdminClient() as any

    const [onbRes, subRes] = await Promise.all([
      admin.from('recruitment_onboarding')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle(),
      admin.from('recruitment_entry_submissions')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle(),
    ])

    const onboarding = onbRes.data || null
    const submission = subRes.data || null
    const current_stage = calculateCurrentStage(onboarding, submission)
    const percent_complete = calculatePercentComplete(current_stage)

    return NextResponse.json({
      onboarding,
      submission,
      current_stage,
      percent_complete,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT — updates onboarding fields + recalculates current_stage
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params
    const body = await request.json()
    const admin = createAdminClient() as any

    // Remove computed/joined fields
    const { current_stage: _, sent_by_user: __, ...updateData } = body

    // Upsert onboarding record
    const { data: onboarding, error } = await admin
      .from('recruitment_onboarding')
      .upsert({
        ...updateData,
        candidate_id: candidateId,
      }, { onConflict: 'candidate_id' })
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Recalculate stage
    const { data: submission } = await admin
      .from('recruitment_entry_submissions')
      .select('*')
      .eq('candidate_id', candidateId)
      .maybeSingle()

    const newStage = calculateCurrentStage(onboarding, submission)

    // Update cached stage
    if (newStage !== onboarding.current_stage) {
      await admin
        .from('recruitment_onboarding')
        .update({ current_stage: newStage })
        .eq('candidate_id', candidateId)
    }

    return NextResponse.json({
      onboarding: { ...onboarding, current_stage: newStage },
      current_stage: newStage,
      percent_complete: calculatePercentComplete(newStage),
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
