'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'
import { cn } from '@/lib/utils'

const MIN_LENGTH = 8

type StrengthLevel = {
  score: number
  label: string
  color: string
  textColor: string
}

const STRENGTH_LEVELS: StrengthLevel[] = [
  { score: 0, label: 'Muito fraca', color: 'bg-red-500', textColor: 'text-red-600' },
  { score: 1, label: 'Fraca', color: 'bg-orange-500', textColor: 'text-orange-600' },
  { score: 2, label: 'Razoável', color: 'bg-yellow-500', textColor: 'text-yellow-600' },
  { score: 3, label: 'Forte', color: 'bg-lime-500', textColor: 'text-lime-600' },
  { score: 4, label: 'Muito forte', color: 'bg-emerald-500', textColor: 'text-emerald-600' },
]

function evaluatePassword(password: string) {
  const checks = {
    length: password.length >= MIN_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }

  const variety = [checks.lowercase, checks.uppercase, checks.number, checks.symbol].filter(Boolean).length
  let score = 0
  if (checks.length) {
    score = Math.min(4, variety)
    if (password.length >= 12 && variety >= 3) score = 4
  }

  return { checks, level: STRENGTH_LEVELS[score] }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const { checks, level } = useMemo(() => evaluatePassword(password), [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < MIN_LENGTH) {
      toast.error(`A palavra-passe deve ter pelo menos ${MIN_LENGTH} caracteres.`)
      return
    }

    if (password !== confirmPassword) {
      toast.error('As palavras-passe não coincidem.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        toast.error('Erro ao redefinir palavra-passe', {
          description: error.message,
        })
        return
      }

      toast.success('Palavra-passe redefinida com sucesso!', {
        description: 'A redirecionar para o dashboard...',
      })
      router.push('/dashboard')
      router.refresh()
    } catch {
      toast.error('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Nova palavra-passe
        </CardTitle>
        <CardDescription>
          Defina a sua nova palavra-passe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova palavra-passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={`Mínimo ${MIN_LENGTH} caracteres`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                className="pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {password.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        i < level.score ? level.color : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Força da palavra-passe</span>
                  <span className={cn('font-medium', level.textColor)}>{level.label}</span>
                </div>

                <ul className="grid grid-cols-1 gap-1 pt-1 text-xs sm:grid-cols-2">
                  <Requirement ok={checks.length} label={`Pelo menos ${MIN_LENGTH} caracteres`} />
                  <Requirement ok={checks.lowercase} label="Uma letra minúscula" />
                  <Requirement ok={checks.uppercase} label="Uma letra maiúscula" />
                  <Requirement ok={checks.number} label="Um número" />
                  <Requirement ok={checks.symbol} label="Um símbolo" />
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar palavra-passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repita a palavra-passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
                minLength={MIN_LENGTH}
                className="pl-9 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                disabled={loading}
                tabIndex={-1}
                aria-label={showConfirm ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && confirmPassword !== password && (
              <p className="text-xs text-red-600">As palavras-passe não coincidem.</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || password.length < MIN_LENGTH || password !== confirmPassword}
          >
            {loading ? (
              <>
                <Spinner variant="infinite" size={16} className="mr-2" />
                A redefinir...
              </>
            ) : (
              'Redefinir palavra-passe'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function Requirement({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={cn('flex items-center gap-1.5', ok ? 'text-emerald-600' : 'text-muted-foreground')}>
      {ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
      <span>{label}</span>
    </li>
  )
}
