/**
 * Testes unitários para `business-days`.
 *
 * Correr com `node --test --import tsx` (ou qualquer test runner que
 * suporte node:test — vitest/jest funcionam com minor setup).
 *
 * Nenhum runner está configurado em `package.json`; este ficheiro
 * documenta o contrato e pode ser executado ad-hoc quando necessário.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isBusinessDay,
  shiftToNextBusinessDay,
  parseOffset,
  addOffset,
  __resetHolidayCache,
} from '../business-days'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeFakeSupabase(holidaysByYear: Record<number, string[]>): SupabaseClient {
  return {
    from: (table: string) => {
      if (table !== 'holidays_pt') throw new Error(`unexpected table ${table}`)
      const fluent = {
        select: () => fluent,
        gte: (_col: string, from: string) => {
          ;(fluent as unknown as { _from: string })._from = from
          return fluent
        },
        lte: (_col: string, to: string) => {
          const from = (fluent as unknown as { _from: string })._from
          const year = Number(from.slice(0, 4))
          const dates = holidaysByYear[year] ?? []
          return Promise.resolve({
            data: dates.filter((d) => d >= from && d <= to).map((date) => ({ date })),
            error: null,
          })
        },
      }
      return fluent as unknown as ReturnType<SupabaseClient['from']>
    },
  } as unknown as SupabaseClient
}

test('parseOffset aceita horas e dias', () => {
  assert.deepEqual(parseOffset('24h'), { unit: 'h', amount: 24 })
  assert.deepEqual(parseOffset('3d'), { unit: 'd', amount: 3 })
  assert.deepEqual(parseOffset('  48H  '), { unit: 'h', amount: 48 })
  assert.equal(parseOffset(''), null)
  assert.equal(parseOffset('24'), null)
  assert.equal(parseOffset('x'), null)
})

test('addOffset soma horas/dias sem mutar input', () => {
  const base = new Date('2026-05-01T10:00:00Z')
  const after24h = addOffset(base, { unit: 'h', amount: 24 })
  assert.equal(after24h.toISOString(), '2026-05-02T10:00:00.000Z')
  assert.equal(base.toISOString(), '2026-05-01T10:00:00.000Z', 'base não é mutado')

  const after3d = addOffset(base, { unit: 'd', amount: 3 })
  assert.equal(after3d.toISOString(), '2026-05-04T10:00:00.000Z')
})

test('isBusinessDay rejeita Sábado e Domingo', async () => {
  __resetHolidayCache()
  const fake = makeFakeSupabase({ 2026: [] })
  // 2026-05-02 é sábado; 2026-05-03 é domingo
  assert.equal(await isBusinessDay(new Date('2026-05-02T10:00:00Z'), fake), false)
  assert.equal(await isBusinessDay(new Date('2026-05-03T10:00:00Z'), fake), false)
  assert.equal(await isBusinessDay(new Date('2026-05-04T10:00:00Z'), fake), true)
})

test('isBusinessDay rejeita feriado em holidays_pt', async () => {
  __resetHolidayCache()
  const fake = makeFakeSupabase({ 2026: ['2026-04-25'] }) // Dia da Liberdade
  // 25 Abril 2026 é sábado, mas holiday também
  assert.equal(await isBusinessDay(new Date('2026-04-25T10:00:00Z'), fake), false)
})

test('shiftToNextBusinessDay salta fim-de-semana para segunda', async () => {
  __resetHolidayCache()
  const fake = makeFakeSupabase({ 2026: [] })
  // 2026-05-02 (sáb) → 2026-05-04 (seg)
  const shifted = await shiftToNextBusinessDay(new Date('2026-05-02T10:00:00Z'), fake)
  assert.equal(shifted.toISOString(), '2026-05-04T10:00:00.000Z')
})

test('shiftToNextBusinessDay salta feriado em cima de fim-de-semana sequencial', async () => {
  __resetHolidayCache()
  // Cenário: sexta-feira é feriado (2026-04-03, Sexta Santa); sáb/dom fim-de-semana;
  // segunda (2026-04-06) também hipotético feriado → tem de ir para terça.
  const fake = makeFakeSupabase({ 2026: ['2026-04-03', '2026-04-06'] })
  // Input: sexta-feira santa (feriado)
  const shifted = await shiftToNextBusinessDay(new Date('2026-04-03T10:00:00Z'), fake)
  assert.equal(shifted.toISOString(), '2026-04-07T10:00:00.000Z', 'saltou sex+sáb+dom+seg para ter')
})

test('shiftToNextBusinessDay retorna a própria data se já dia útil', async () => {
  __resetHolidayCache()
  const fake = makeFakeSupabase({ 2026: [] })
  // 2026-05-04 é segunda, útil.
  const shifted = await shiftToNextBusinessDay(new Date('2026-05-04T14:00:00Z'), fake)
  assert.equal(shifted.toISOString(), '2026-05-04T14:00:00.000Z')
})
