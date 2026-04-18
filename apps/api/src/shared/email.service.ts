import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger';

interface SendEmailParams {
  to: { email: string; name?: string };
  templateId: string;
  params?: Record<string, unknown>;
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId: string }> {
  const response = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: env.EMAIL_FROM_ADDRESS, name: env.EMAIL_FROM_NAME },
      to: [params.to],
      templateId: Number(params.templateId),
      params: params.params,
    },
    {
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    },
  );

  logger.debug('Email sent', { to: params.to.email, templateId: params.templateId });
  return { messageId: response.data.messageId };
}

// ─── Envoi HTML direct via Brevo ─────────────────────────────────────────────

interface SendHtmlEmailParams {
  to: { email: string; name?: string };
  subject: string;
  html: string;
}

/**
 * Envoi d'un email HTML direct (sans template Brevo).
 * Throw en cas d'erreur : l'appelant gère le fallback / logging.
 */
export async function sendHtmlEmail(params: SendHtmlEmailParams): Promise<void> {
  if (!env.BREVO_API_KEY) {
    logger.warn('BREVO_API_KEY not set — HTML email skipped', { to: params.to.email, subject: params.subject });
    return;
  }

  await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    {
      sender: { email: env.EMAIL_FROM_ADDRESS, name: env.EMAIL_FROM_NAME },
      to: [params.to],
      subject: params.subject,
      htmlContent: params.html,
    },
    {
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    },
  );

  logger.debug('HTML email sent', { to: params.to.email, subject: params.subject });
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
