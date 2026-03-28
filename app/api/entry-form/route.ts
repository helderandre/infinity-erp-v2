import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { sendEmail, replaceVariables } from "@/lib/email/send"

const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function uploadToR2(file: File, path: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const key = `entry-forms/${path}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

  await S3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  )

  return `${process.env.R2_PUBLIC_DOMAIN}/${key}`
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()

    const submissionId = crypto.randomUUID()

    // Upload files if present
    let idFrontUrl: string | null = null
    let idBackUrl: string | null = null
    let photoUrl: string | null = null

    const idFront = formData.get("id_document_front") as File | null
    const idBack = formData.get("id_document_back") as File | null
    const photo = formData.get("professional_photo") as File | null

    if (idFront && idFront.size > 0) {
      idFrontUrl = await uploadToR2(idFront, submissionId)
    }
    if (idBack && idBack.size > 0) {
      idBackUrl = await uploadToR2(idBack, submissionId)
    }
    if (photo && photo.size > 0) {
      photoUrl = await uploadToR2(photo, submissionId)
    }

    // Parse form fields
    const getValue = (key: string): string | null => {
      const val = formData.get(key)
      if (!val || val === "" || val === "null") return null
      return val.toString().trim()
    }

    const getBool = (key: string): boolean => {
      const val = formData.get(key)
      return val === "true" || val === "on"
    }

    const candidateIdValue = getValue("candidate_id")

    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any)
      .from("recruitment_entry_submissions")
      .insert({
        id: submissionId,
        candidate_id: candidateIdValue,
        full_name: getValue("full_name") ?? "Sem nome",
        cc_number: getValue("cc_number"),
        cc_expiry: getValue("cc_expiry"),
        cc_issue_date: getValue("cc_issue_date"),
        date_of_birth: getValue("date_of_birth"),
        nif: getValue("nif"),
        niss: getValue("niss"),
        naturalidade: getValue("naturalidade"),
        estado_civil: getValue("estado_civil"),
        display_name: getValue("display_name"),
        full_address: getValue("full_address"),
        professional_phone: getValue("professional_phone"),
        emergency_contact_name: getValue("emergency_contact_name"),
        emergency_contact_phone: getValue("emergency_contact_phone"),
        personal_email: getValue("personal_email"),
        email_suggestion_1: getValue("email_suggestion_1"),
        email_suggestion_2: getValue("email_suggestion_2"),
        email_suggestion_3: getValue("email_suggestion_3"),
        has_sales_experience: getBool("has_sales_experience"),
        has_real_estate_experience: getBool("has_real_estate_experience"),
        previous_agency: getValue("previous_agency"),
        instagram_handle: getValue("instagram_handle"),
        facebook_page: getValue("facebook_page"),
        id_document_front_url: idFrontUrl,
        id_document_back_url: idBackUrl,
        professional_photo_url: photoUrl,
      })
      .select("id")
      .single()

    if (error) {
      console.error("[Entry Form] DB Error:", error.message)
      return NextResponse.json({ error: "Erro ao submeter formulário" }, { status: 500 })
    }

    // Send emails (non-blocking — don't fail the submission if emails fail)
    const recipientEmail = getValue("personal_email")
    const candidateName = getValue("display_name") || getValue("full_name") || ""
    const candidatePhone = getValue("professional_phone") || ""
    const submissionLink = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.infinitygroup.pt'}/dashboard/recrutamento/formulario`

    const emailVars = {
      nome: candidateName,
      email: recipientEmail || "",
      telefone: candidatePhone,
      link_submissao: submissionLink,
    }

    // Fire all emails in parallel, non-blocking
    sendEntryEmails(admin, recipientEmail, emailVars)
      .catch(err => console.error("[Entry Form] Email error:", err))

    return NextResponse.json({ success: true, id: data.id })
  } catch (error) {
    console.error("[Entry Form] Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// ─── Entry Emails ─────────────────────────────────────────────────────────────

async function loadTemplateBySlug(admin: any, slug: string) {
  const { data } = await (admin as any)
    .from("tpl_email_library")
    .select("subject, body_html, slug")
    .eq("slug", slug)
    .single()
  return data
}

async function sendFromTemplate(
  admin: any,
  slug: string,
  to: string,
  variables: Record<string, string>,
  fallbackSubject: string,
  fallbackBody: string,
) {
  const tpl = await loadTemplateBySlug(admin, slug)
  const subject = replaceVariables(tpl?.subject || fallbackSubject, variables)
  const bodyHtml = replaceVariables(tpl?.body_html || fallbackBody, variables)

  const result = await sendEmail({ to, subject, bodyHtml })
  if (!result.success) {
    console.error(`[Entry Form] Failed to send ${slug}:`, result.error)
  } else {
    console.log(`[Entry Form] ${slug} sent to ${to}, id:`, result.id)
  }
}

async function sendEntryEmails(admin: any, recipientEmail: string | null, vars: Record<string, string>) {
  const tasks: Promise<void>[] = []

  // 1. Welcome email to the candidate
  if (recipientEmail) {
    tasks.push(sendFromTemplate(
      admin, 'entry_welcome', recipientEmail, vars,
      'Bem-vindo(a) à Infinity Group, {{nome}}!',
      '<p>Olá <strong>{{nome}}</strong>, obrigado por submeter o formulário. A equipa irá analisar os dados em breve.</p>',
    ))
  }

  // 2. Internal notification to admin
  tasks.push(sendFromTemplate(
    admin, 'entry_internal_notification', 'duartegtlcosta@gmail.com', vars,
    'Nova submissão de formulário: {{nome}}',
    '<p><strong>{{nome}}</strong> submeteu o formulário de entrada.</p><p>Email: {{email}} | Tel: {{telefone}}</p><p><a href="{{link_submissao}}">Ver Submissão</a></p>',
  ))

  // 3. Convictus notification
  tasks.push(sendFromTemplate(
    admin, 'entry_convictus', 'duartegtlcosta@gmail.com', vars,
    'Novo consultor em integração: {{nome}}',
    '<p><strong>{{nome}}</strong> está em processo de integração na Infinity Group.</p>',
  ))

  await Promise.allSettled(tasks)
}
