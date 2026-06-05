import { z } from 'zod'

const textField = (max = 255) =>
  z.string().trim().min(1, 'Campo obrigatório').max(max, `Máximo ${max} caracteres`)

export const faturacaoSchema = z.object({
  nome: textField(160),
  sede: textField(255),
  nipc: textField(20),
})

export const convictusSchema = z.object({
  agencia: z.object({
    nome: textField(160),
    morada: textField(255),
    telefone: textField(40),
  }),
  sede: z.object({
    nome: textField(160),
    morada: textField(255),
    telefone: textField(40),
    ami: textField(20),
  }),
})

export const updateByScope = {
  faturacao: faturacaoSchema,
  convictus: convictusSchema,
} as const

export type FaturacaoInput = z.infer<typeof faturacaoSchema>
export type ConvictusInput = z.infer<typeof convictusSchema>
