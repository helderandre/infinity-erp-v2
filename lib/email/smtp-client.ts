import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'

interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

/**
 * Verify SMTP connection is valid
 */
export async function verifySmtp(config: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  })

  try {
    await transport.verify()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  } finally {
    transport.close()
  }
}

/**
 * Send an email via SMTP.
 * Returns the raw RFC822 message so it can be appended to IMAP Sent folder.
 */
export async function sendViaSMTP(
  config: SmtpConfig,
  options: {
    from: { name: string; address: string }
    to: string[]
    cc?: string[]
    bcc?: string[]
    subject: string
    html: string
    text?: string
    inReplyTo?: string
    references?: string
    attachments?: { filename: string; contentType: string; content: Buffer }[]
  }
) {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  })

  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: { name: options.from.name, address: options.from.address },
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      text: options.text,
      inReplyTo: options.inReplyTo,
      references: options.references,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        content: a.content,
      })),
    }

    // 1. Send the email via SMTP
    const result = await transport.sendMail(mailOptions)

    // 2. Build raw RFC822 source for IMAP APPEND (Sent folder)
    //    We use MailComposer to rebuild the message with the actual Message-ID
    let rawMessage: Buffer | undefined
    try {
      const composer = new MailComposer({
        ...mailOptions,
        messageId: result.messageId,
        date: new Date(),
      })
      rawMessage = await new Promise<Buffer>((resolve, reject) => {
        composer.compile().build((err: Error | null, msg: Buffer) => {
          if (err) reject(err)
          else resolve(msg)
        })
      })
    } catch {
      // Raw message building is best-effort — email was still sent
    }

    return {
      ok: true as const,
      messageId: result.messageId,
      response: result.response,
      rawMessage,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false as const, error: message }
  } finally {
    transport.close()
  }
}
