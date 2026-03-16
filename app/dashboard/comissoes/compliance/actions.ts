// @ts-nocheck
"use server"

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  DealCompliance,
  ImpicFormData,
  RiskLevel,
  ComplianceStatus,
} from '@/types/compliance'
import { HIGH_RISK_COUNTRIES, RISK_FLAGS } from '@/types/compliance'

// ─── getCompliance ──────────────────────────────────────────────────────────
// Get or create (upsert) a compliance record for a deal.
export async function getCompliance(dealId: string): Promise<DealCompliance> {
  try {
    const admin = createAdminClient()

    // Try to fetch existing record
    const { data: existing, error: fetchError } = await (admin as any)
      .from('temp_deal_compliance')
      .select('*')
      .eq('deal_id', dealId)
      .maybeSingle()

    if (fetchError) throw fetchError

    if (existing) return existing as DealCompliance

    // Create with defaults
    const defaults = {
      deal_id: dealId,
      buyer_pep_check: false,
      buyer_pep_result: null,
      buyer_risk_level: 'low',
      buyer_funds_declared: false,
      buyer_docs_complete: false,
      seller_pep_check: false,
      seller_pep_result: null,
      seller_risk_level: 'low',
      seller_is_company: false,
      seller_docs_complete: false,
      payment_method: null,
      cash_amount: 0,
      risk_flags: [],
      overall_risk_level: 'low',
      impic_reported: false,
      suspicious_activity_reported: false,
      status: 'pending',
    }

    const { data: created, error: insertError } = await (admin as any)
      .from('temp_deal_compliance')
      .insert(defaults)
      .select('*')
      .single()

    if (insertError) throw insertError

    return created as DealCompliance
  } catch (error) {
    console.error('[getCompliance] Error:', error)
    throw new Error('Erro ao obter dados de compliance.')
  }
}

// ─── updateCompliance ───────────────────────────────────────────────────────
// Update compliance fields and auto-detect risk flags.
export async function updateCompliance(
  dealId: string,
  data: Partial<DealCompliance>
): Promise<DealCompliance> {
  try {
    const admin = createAdminClient()

    // Update the record first
    const { data: updated, error: updateError } = await (admin as any)
      .from('temp_deal_compliance')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('deal_id', dealId)
      .select('*')
      .single()

    if (updateError) throw updateError

    const record = updated as DealCompliance

    // Auto-detect risk flags
    const flags: string[] = []

    // Cash over 15k
    if (
      (record.payment_method === 'cash' || record.payment_method === 'mixed') &&
      record.cash_amount > 15000
    ) {
      flags.push('cash_over_15k')
    }

    // Cash payment
    if (record.payment_method === 'cash' || record.payment_method === 'mixed') {
      flags.push('cash_payment')
    }

    // High-risk country
    if (
      (record.buyer_nationality && HIGH_RISK_COUNTRIES.includes(record.buyer_nationality)) ||
      (record.seller_nationality && HIGH_RISK_COUNTRIES.includes(record.seller_nationality))
    ) {
      flags.push('high_risk_country')
    }

    // PEP checks
    if (record.buyer_pep_result === 'flagged') {
      flags.push('pep_buyer')
    }
    if (record.seller_pep_result === 'flagged') {
      flags.push('pep_seller')
    }

    // Missing docs
    if (!record.buyer_docs_complete) {
      flags.push('missing_docs_buyer')
    }
    if (!record.seller_docs_complete) {
      flags.push('missing_docs_seller')
    }

    // Funds not declared — check deal value from temp_deals
    if (!record.buyer_funds_declared) {
      const { data: deal } = await (admin as any)
        .from('temp_deals')
        .select('deal_value')
        .eq('id', dealId)
        .maybeSingle()

      if (deal && deal.deal_value > 50000) {
        flags.push('funds_not_declared')
      }
    }

    // Missing NIF
    if (!record.buyer_nif) {
      flags.push('no_nif_buyer')
    }
    if (!record.seller_nif) {
      flags.push('no_nif_seller')
    }

    // Compute overall risk level from highest severity flag
    let overallRisk: RiskLevel = 'low'
    for (const flag of flags) {
      const flagDef = RISK_FLAGS[flag]
      if (flagDef) {
        if (flagDef.severity === 'high') {
          overallRisk = 'high'
          break
        }
        if (flagDef.severity === 'medium') {
          overallRisk = 'medium'
        }
      }
    }

    // Compute status
    let status: ComplianceStatus = 'pending'
    if (overallRisk === 'high' || flags.some((f) => RISK_FLAGS[f]?.severity === 'high')) {
      status = 'flagged'
    } else if (
      record.buyer_docs_complete &&
      record.seller_docs_complete &&
      record.impic_reported
    ) {
      status = 'complete'
    }

    // Update with computed fields
    const { data: final, error: finalError } = await (admin as any)
      .from('temp_deal_compliance')
      .update({
        risk_flags: flags,
        overall_risk_level: overallRisk,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('deal_id', dealId)
      .select('*')
      .single()

    if (finalError) throw finalError

    return final as DealCompliance
  } catch (error) {
    console.error('[updateCompliance] Error:', error)
    throw new Error('Erro ao actualizar dados de compliance.')
  }
}

// ─── markAsReported ─────────────────────────────────────────────────────────
// Mark a deal as reported to IMPIC.
export async function markAsReported(
  dealId: string,
  reference: string,
  date: string
): Promise<DealCompliance> {
  try {
    const admin = createAdminClient()

    // Get deal date to compute quarter
    const { data: deal } = await (admin as any)
      .from('temp_deals')
      .select('deal_date')
      .eq('id', dealId)
      .maybeSingle()

    let impicQuarter: string | null = null
    if (deal?.deal_date) {
      const dealDate = new Date(deal.deal_date)
      const month = dealDate.getMonth() + 1
      const year = dealDate.getFullYear()
      if (month <= 3) impicQuarter = `Q1 ${year}`
      else if (month <= 6) impicQuarter = `Q2 ${year}`
      else if (month <= 9) impicQuarter = `Q3 ${year}`
      else impicQuarter = `Q4 ${year}`
    }

    const { data: updated, error } = await (admin as any)
      .from('temp_deal_compliance')
      .update({
        impic_reported: true,
        impic_report_date: date,
        impic_reference: reference,
        impic_quarter: impicQuarter,
        updated_at: new Date().toISOString(),
      })
      .eq('deal_id', dealId)
      .select('*')
      .single()

    if (error) throw error

    return updated as DealCompliance
  } catch (error) {
    console.error('[markAsReported] Error:', error)
    throw new Error('Erro ao marcar como reportado ao IMPIC.')
  }
}

// ─── getComplianceOverview ──────────────────────────────────────────────────
// Return all deals with compliance status for a given quarter/year.
export async function getComplianceOverview(quarter?: string, year?: number) {
  try {
    const admin = createAdminClient()

    // Get all compliance records
    let query = (admin as any).from('temp_deal_compliance').select('*')

    if (quarter && year) {
      query = query.eq('impic_quarter', `${quarter} ${year}`)
    }

    const { data: complianceRecords, error: compError } = await query

    if (compError) throw compError

    const records = (complianceRecords || []) as DealCompliance[]

    // Get associated deals
    const dealIds = records.map((r) => r.deal_id)

    let deals: any[] = []
    if (dealIds.length > 0) {
      const { data: dealData, error: dealError } = await (admin as any)
        .from('temp_deals')
        .select('*')
        .in('id', dealIds)

      if (dealError) throw dealError
      deals = dealData || []
    }

    // Build map
    const dealMap = new Map(deals.map((d: any) => [d.id, d]))

    const combined = records.map((compliance) => ({
      deal: dealMap.get(compliance.deal_id) || null,
      compliance,
    }))

    // Compute totals
    const totalDeals = combined.length
    const reported = records.filter((r) => r.impic_reported).length
    const pending = records.filter((r) => r.status === 'pending').length
    const flagged = records.filter((r) => r.status === 'flagged').length

    return {
      items: combined,
      totals: {
        total_deals: totalDeals,
        reported,
        pending,
        flagged,
      },
    }
  } catch (error) {
    console.error('[getComplianceOverview] Error:', error)
    throw new Error('Erro ao obter resumo de compliance.')
  }
}

// ─── generateImpicFormData ──────────────────────────────────────────────────
// Build ImpicFormData by joining deal + compliance + property + owners.
export async function generateImpicFormData(dealId: string): Promise<ImpicFormData> {
  try {
    const admin = createAdminClient()

    // Get compliance record
    const { data: compliance, error: compError } = await (admin as any)
      .from('temp_deal_compliance')
      .select('*')
      .eq('deal_id', dealId)
      .single()

    if (compError) throw compError

    // Get deal with property info
    const { data: deal, error: dealError } = await (admin as any)
      .from('temp_deals')
      .select('*')
      .eq('id', dealId)
      .single()

    if (dealError) throw dealError

    // Get property if available
    let property: any = null
    if (deal.property_id) {
      const { data: prop } = await (admin as any)
        .from('dev_properties')
        .select('*, dev_property_internal(*)')
        .eq('id', deal.property_id)
        .maybeSingle()

      property = prop
    }

    // Get main owner (seller) if property exists
    let mainOwner: any = null
    if (deal.property_id) {
      const { data: ownerLink } = await (admin as any)
        .from('property_owners')
        .select('owners(*)')
        .eq('property_id', deal.property_id)
        .eq('is_main_contact', true)
        .maybeSingle()

      mainOwner = ownerLink?.owners || null
    }

    // Get consultant name
    let consultantName = ''
    if (deal.consultant_id) {
      const { data: consultant } = await (admin as any)
        .from('dev_users')
        .select('commercial_name')
        .eq('id', deal.consultant_id)
        .maybeSingle()

      consultantName = consultant?.commercial_name || ''
    }

    const comp = compliance as DealCompliance

    return {
      // Mediador
      ami_license: '', // Must be filled manually
      agency_name: 'Infinity Group',
      consultant_name: consultantName,
      // Imóvel
      property_type: property?.property_type || '',
      property_address: property?.address_street || '',
      property_parish: property?.address_parish || '',
      property_city: property?.city || '',
      property_postal_code: property?.postal_code || '',
      // Transacção
      transaction_type: deal.business_type || '',
      transaction_value: deal.deal_value || 0,
      transaction_date: deal.deal_date || '',
      payment_method: comp.payment_method || '',
      // Comprador
      buyer_name: comp.buyer_name || '',
      buyer_nif: comp.buyer_nif || '',
      buyer_cc: comp.buyer_cc_number || '',
      buyer_nationality: comp.buyer_nationality || '',
      buyer_address: comp.buyer_address || '',
      // Vendedor
      seller_name: comp.seller_name || mainOwner?.name || '',
      seller_nif: comp.seller_nif || mainOwner?.nif || '',
      seller_cc: comp.seller_cc_number || '',
      seller_nationality: comp.seller_nationality || mainOwner?.nationality || '',
      seller_address: comp.seller_address || mainOwner?.address || '',
    } satisfies ImpicFormData
  } catch (error) {
    console.error('[generateImpicFormData] Error:', error)
    throw new Error('Erro ao gerar dados do formulário IMPIC.')
  }
}

// ─── getComplianceAlerts ────────────────────────────────────────────────────
// Return alerts: approaching deadlines, high-risk without docs, cash > 15k not reported.
export async function getComplianceAlerts() {
  try {
    const admin = createAdminClient()

    // Get all non-reported compliance records
    const { data: records, error } = await (admin as any)
      .from('temp_deal_compliance')
      .select('*')

    if (error) throw error

    const allRecords = (records || []) as DealCompliance[]

    // Get deal dates for deadline calculation
    const dealIds = allRecords.map((r) => r.deal_id)
    let deals: any[] = []
    if (dealIds.length > 0) {
      const { data: dealData } = await (admin as any)
        .from('temp_deals')
        .select('id, deal_date, deal_value, title')
        .in('id', dealIds)

      deals = dealData || []
    }
    const dealMap = new Map(deals.map((d: any) => [d.id, d]))

    const alerts: {
      type: 'deadline' | 'high_risk' | 'cash_not_reported'
      severity: RiskLevel
      message: string
      deal_id: string
      deal_title: string
    }[] = []

    const now = new Date()

    for (const record of allRecords) {
      const deal = dealMap.get(record.deal_id)
      const dealTitle = deal?.title || record.deal_id

      // Deals approaching deadline without report
      if (!record.impic_reported && deal?.deal_date) {
        const dealDate = new Date(deal.deal_date)
        const month = dealDate.getMonth() + 1
        const year = dealDate.getFullYear()

        let deadlineDate: Date
        if (month <= 3) deadlineDate = new Date(year, 5, 30) // June 30
        else if (month <= 6) deadlineDate = new Date(year, 8, 30) // Sep 30
        else if (month <= 9) deadlineDate = new Date(year, 11, 31) // Dec 31
        else deadlineDate = new Date(year + 1, 2, 31) // Mar 31 next year

        const daysUntilDeadline = Math.ceil(
          (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysUntilDeadline <= 30 && daysUntilDeadline > 0) {
          alerts.push({
            type: 'deadline',
            severity: daysUntilDeadline <= 7 ? 'high' : 'medium',
            message: `Prazo IMPIC em ${daysUntilDeadline} dias para "${dealTitle}"`,
            deal_id: record.deal_id,
            deal_title: dealTitle,
          })
        } else if (daysUntilDeadline <= 0) {
          alerts.push({
            type: 'deadline',
            severity: 'high',
            message: `Prazo IMPIC ultrapassado para "${dealTitle}"`,
            deal_id: record.deal_id,
            deal_title: dealTitle,
          })
        }
      }

      // High-risk deals without full docs
      if (
        record.overall_risk_level === 'high' &&
        (!record.buyer_docs_complete || !record.seller_docs_complete)
      ) {
        alerts.push({
          type: 'high_risk',
          severity: 'high',
          message: `Negócio de alto risco "${dealTitle}" com documentação incompleta`,
          deal_id: record.deal_id,
          deal_title: dealTitle,
        })
      }

      // Cash > 15k not reported
      if (record.cash_amount > 15000 && !record.impic_reported) {
        alerts.push({
          type: 'cash_not_reported',
          severity: 'high',
          message: `Numerário > 15.000€ em "${dealTitle}" — não reportado ao IMPIC`,
          deal_id: record.deal_id,
          deal_title: dealTitle,
        })
      }
    }

    // Sort by severity (high first)
    const severityOrder: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return alerts
  } catch (error) {
    console.error('[getComplianceAlerts] Error:', error)
    throw new Error('Erro ao obter alertas de compliance.')
  }
}
