import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'

// GET — list all recruitment contract templates
export async function GET() {
  try {
    const supabase = await createClient() as any

    // Use a simple key-value approach via the existing settings or a custom query
    const { data, error } = await supabase
      .from('recruitment_contracts')
      .select('*')
      .order('section')

    if (error) {
      // Table might not exist — create it
      if (error.message.includes('recruitment_contracts')) {
        return NextResponse.json([])
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — upload a contract PDF for a section
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const section = formData.get('section') as string | null

    if (!file || !section) {
      return NextResponse.json({ error: 'Ficheiro e secção obrigatórios' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas ficheiros PDF são aceites' }, { status: 400 })
    }

    // Upload to R2
    const buffer = Buffer.from(await file.arrayBuffer())
    const key = `recrutamento/contratos/${section}/${Date.now()}.pdf`

    const s3 = getR2Client()
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    }))

    const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key

    const label = section === 'contrato_prestacao_servicos' ? 'Contrato de Prestação de Serviços' : 'Contrato de Rescisão'

    // Delete existing for this section, then insert
    await (supabase as any).from('recruitment_contracts').delete().eq('section', section)
    const { error: insertError } = await (supabase as any)
      .from('recruitment_contracts')
      .insert({ section, name: label, file_url: url, updated_at: new Date().toISOString() })

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[contracts upload]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — remove a contract for a section
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const section = searchParams.get('section')

    if (!section) {
      return NextResponse.json({ error: 'Secção obrigatória' }, { status: 400 })
    }

    const { error } = await (supabase as any)
      .from('recruitment_contracts')
      .delete()
      .eq('section', section)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
