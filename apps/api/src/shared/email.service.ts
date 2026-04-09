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
