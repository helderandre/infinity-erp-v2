'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp'
import { toast } from 'sonner'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/kibo-ui/spinner'

const RESEND_COOLDOWN = 60

function VerifyOtpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!email) {
      router.replace('/forgot-password')
    }
  }, [email, router])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleVerify = useCallback(async (code: string) => {
    if (code.length !== 8) return
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      })

      if (error) {
        toast.error('Código inválido', {
          description: 'O código introduzido está incorrecto ou expirou.',
        })
        setOtp('')
        return
      }

      toast.success('Código verificado!')
      router.push('/reset-password')
    } catch {
      toast.error('Ocorreu um erro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [email, router])

  const handleResend = async () => {
    setResending(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email)

      if (error) {
        toast.error('Erro ao reenviar código', {
          description: error.message,
        })
        return
      }

      toast.success('Código reenviado!', {
        description: 'Verifique o seu email.',
      })
      setResendCooldown(RESEND_COOLDOWN)
      setOtp('')
    } catch {
      toast.error('Ocorreu um erro ao reenviar.')
    } finally {
      setResending(false)
    }
  }

  const handleOtpChange = (value: string) => {
    setOtp(value)
    if (value.length === 8) {
      handleVerify(value)
    }
  }

  if (!email) return null

  return (
    <Card>

      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Verificar código
        </CardTitle>
        <CardDescription>
          Introduza o código de 8 dígitos enviado para{' '}
          <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex justify-center">
            <InputOTP
              maxLength={8}
              value={otp}
              onChange={handleOtpChange}
              disabled={loading}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} className="size-11 text-base" />
                <InputOTPSlot index={1} className="size-11 text-base" />
                <InputOTPSlot index={2} className="size-11 text-base" />
                <InputOTPSlot index={3} className="size-11 text-base" />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={4} className="size-11 text-base" />
                <InputOTPSlot index={5} className="size-11 text-base" />
                <InputOTPSlot index={6} className="size-11 text-base" />
                <InputOTPSlot index={7} className="size-11 text-base" />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner variant="infinite" size={16} />
              A verificar...
            </div>
          )}

          <div className="flex items-center justify-center gap-1 text-sm">
            <span className="text-muted-foreground">Não recebeu o código?</span>
            {resendCooldown > 0 ? (
              <span className="text-muted-foreground">
                Reenviar em {resendCooldown}s
              </span>
            ) : (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? (
                  <Spinner variant="infinite" size={12} className="mr-1" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Reenviar código
              </Button>
            )}
          </div>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Alterar email
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpForm />
    </Suspense>
  )
}
