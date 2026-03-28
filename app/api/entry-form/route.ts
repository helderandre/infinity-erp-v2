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

    // Send welcome email (non-blocking — don't fail the submission if email fails)
    const recipientEmail = getValue("personal_email")
    if (recipientEmail) {
      sendWelcomeEmail(admin, recipientEmail, {
        nome: getValue("display_name") || getValue("full_name") || "",
        email: recipientEmail,
        telefone: getValue("professional_phone") || "",
      }).catch(err => console.error("[Entry Form] Welcome email error:", err))
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (error) {
    console.error("[Entry Form] Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

async function sendWelcomeEmail(
  admin: any,
  recipientEmail: string,
  variables: Record<string, string>
) {
  // Try to load the editable template from DB
  const { data: tpl } = await (admin as any)
    .from("recruitment_email_templates")
    .select("subject, body_html, from_email, from_name, is_active")
    .eq("slug", "welcome_entry_form")
    .single()

  if (tpl && !tpl.is_active) {
    console.log("[Entry Form] Welcome email template is disabled, skipping")
    return
  }

  // Fallback defaults if template doesn't exist yet
  const subject = tpl?.subject || "Bem-vindo(a) à Infinity Group, {{nome}}!"
  const bodyHtml = tpl?.body_html || `
    <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #0a0a0a;">Bem-vindo(a) à equipa!</h2>
    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #404040;">
      Olá <strong>{{nome}}</strong>, obrigado por submeter o formulário de entrada na Infinity Group. A nossa equipa irá analisar os seus dados em breve.
    </p>
    <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #404040;">Com os melhores cumprimentos,<br/><strong>Equipa Infinity Group</strong></p>
  `

  const finalSubject = replaceVariables(subject, variables)
  const finalBody = replaceVariables(bodyHtml, variables)

  const result = await sendEmail({
    to: recipientEmail,
    subject: finalSubject,
    bodyHtml: finalBody,
    from: tpl?.from_email || "geral@infinitygroup.pt",
    fromName: tpl?.from_name || "Infinity Group",
  })

  if (!result.success) {
    console.error("[Entry Form] Failed to send welcome email:", result.error)
  } else {
    console.log("[Entry Form] Welcome email sent to", recipientEmail, "id:", result.id)
  }
}
