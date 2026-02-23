import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { uploadDocumentToR2, type DocumentContext } from '@/lib/r2/documents'
import { MAX_FILE_SIZE } from '@/lib/validations/document'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Autenticacao
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 })
    }

    // 2. Ler FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const docTypeId = formData.get('doc_type_id') as string | null
    const propertyId = formData.get('property_id') as string | null
    const ownerId = formData.get('owner_id') as string | null
    const consultantId = formData.get('consultant_id') as string | null
    const validUntil = formData.get('valid_until') as string | null
    const notes = formData.get('notes') as string | null

    // 3. Validacoes basicas
    if (!file) {
      return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
    }
    if (!docTypeId) {
      return NextResponse.json(
        { error: 'Tipo de documento obrigatorio' },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Ficheiro demasiado grande. Maximo: 20MB' },
        { status: 400 }
      )
    }

    // 4. Validar extensao contra doc_types.allowed_extensions
    const { data: docType, error: dtError } = await supabase
      .from('doc_types')
      .select('allowed_extensions, name, category')
      .eq('id', docTypeId)
      .single()

    if (dtError || !docType) {
      return NextResponse.json(
        { error: 'Tipo de documento nao encontrado' },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !docType.allowed_extensions?.includes(ext)) {
      return NextResponse.json(
        {
          error: `Formato nao permitido para "${docType.name}". Aceite: ${docType.allowed_extensions?.join(', ')}`,
        },
        { status: 400 }
      )
    }

    // 4b. Inferir owner_id quando é doc de proprietário sem owner_id explícito
    let resolvedOwnerId = ownerId
    if (
      !resolvedOwnerId &&
      propertyId &&
      docType.category?.startsWith('Proprietário')
    ) {
      const { data: mainOwner } = await supabase
        .from('property_owners')
        .select('owner_id')
        .eq('property_id', propertyId)
        .eq('is_main_contact', true)
        .maybeSingle()

      if (mainOwner) {
        resolvedOwnerId = mainOwner.owner_id
      } else {
        const { data: firstOwner } = await supabase
          .from('property_owners')
          .select('owner_id')
          .eq('property_id', propertyId)
          .limit(1)
          .maybeSingle()

        if (firstOwner) {
          resolvedOwnerId = firstOwner.owner_id
        }
      }
    }

    // 5. Determinar contexto de upload (path no R2)
    let ctx: DocumentContext
    if (propertyId) {
      ctx = { type: 'property', propertyId }
    } else if (resolvedOwnerId) {
      ctx = { type: 'owner', ownerId: resolvedOwnerId }
    } else if (consultantId) {
      ctx = { type: 'consultant', consultantId }
    } else {
      return NextResponse.json(
        {
          error:
            'Deve indicar property_id, owner_id ou consultant_id',
        },
        { status: 400 }
      )
    }

    // 6. Converter File → Buffer e upload ao R2
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url, key } = await uploadDocumentToR2(
      buffer,
      file.name,
      file.type,
      ctx
    )

    // 7. Registar na BD
    if (consultantId) {
      const { data: doc, error: insertError } = await supabase
        .from('consultant_documents')
        .insert({
          consultant_id: consultantId,
          doc_type_id: docTypeId,
          file_url: url,
          file_name: file.name,
          uploaded_by: user.id,
          valid_until: validUntil || null,
          status: 'active',
          metadata: { size: file.size, mimetype: file.type, r2_key: key },
          notes: notes || null,
        })
        .select('id')
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: 'Erro ao registar documento', details: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { id: doc!.id, url, file_name: file.name },
        { status: 201 }
      )
    }

    // doc_registry para property/owner
    const { data: doc, error: insertError } = await supabase
      .from('doc_registry')
      .insert({
        property_id: propertyId || null,
        owner_id: resolvedOwnerId || null,
        doc_type_id: docTypeId,
        file_url: url,
        file_name: file.name,
        uploaded_by: user.id,
        valid_until: validUntil || null,
        status: 'active',
        metadata: { size: file.size, mimetype: file.type, r2_key: key },
        notes: notes || null,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: 'Erro ao registar documento', details: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { id: doc!.id, url, file_name: file.name },
      { status: 201 }
    )
  } catch (error) {
    console.error('Erro no upload de documento:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
