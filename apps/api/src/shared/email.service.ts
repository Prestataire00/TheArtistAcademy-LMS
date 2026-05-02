import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from './logger';

const resend = new Resend(env.RESEND_API_KEY);

interface SendHtmlEmailParams {
  to: { email: string; name?: string };
  subject: string;
  html: string;
}

/**
 * Envoi d'un email HTML direct via Resend.
 * Throw en cas d'erreur : l'appelant gère le fallback / logging.
 * Retourne l'id Resend du message envoyé (null si RESEND_API_KEY absente).
 */
export async function sendHtmlEmail(params: SendHtmlEmailParams): Promise<string | null> {
  if (!env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set — HTML email skipped', { to: params.to.email, subject: params.subject });
    return null;
  }

  const from = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM_ADDRESS}>`;

  const { data, error } = await resend.emails.send({
    from,
    to: [params.to.email],
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    // On lève avec message explicite pour que l'appelant puisse logger / stocker l'erreur
    const message = (error as any)?.message ?? JSON.stringify(error);
    const wrapped = new Error(message);
    (wrapped as any).details = error;
    throw wrapped;
  }

  logger.debug('HTML email sent', { to: params.to.email, subject: params.subject, id: data?.id });
  return data?.id ?? null;
}

// ─── Password reset email ────────────────────────────────────────────────────

interface PasswordResetEmailParams {
  to: { email: string; name?: string };
  resetUrl: string;
  fullName: string;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 15px; color: #111827;">Bonjour ${params.fullName},</p>
      <p style="font-size: 15px; color: #374151;">Vous avez demande la reinitialisation de votre mot de passe sur The Artist Academy.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${params.resetUrl}" style="display: inline-block; padding: 12px 28px; background-color: #B5294E; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Reinitialiser mon mot de passe</a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">Ce lien est valable 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
      <p style="font-size: 13px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">The Artist Academy</p>
    </div>
  `.trim();

  await sendHtmlEmail({
    to: params.to,
    subject: 'Reinitialisation de votre mot de passe — The Artist Academy',
    html,
  });
}
