import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  // JWT interne
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),

  // SSO Dendreo
  DENDREO_JWT_PUBLIC_KEY: z.string().min(1),
  DENDREO_JWT_ALGORITHM: z.string().default('RS256'),
  DENDREO_JWT_EXPIRY_TOLERANCE_SECONDS: z.coerce.number().default(30),

  // Bunny.net
  BUNNY_API_KEY: z.string().min(1),
  BUNNY_LIBRARY_ID: z.string().min(1),
  BUNNY_STREAM_HOSTNAME: z.string().min(1),
  BUNNY_STORAGE_ZONE: z.string().min(1),
  BUNNY_STORAGE_API_KEY: z.string().min(1),
  BUNNY_CDN_HOSTNAME: z.string().min(1),
  BUNNY_SIGNED_URL_SECRET: z.string().min(1),
  BUNNY_WEBHOOK_SECRET: z.string().min(1),

  // Email
  BREVO_API_KEY: z.string().min(1),
  EMAIL_FROM_ADDRESS: z.string().email(),
  EMAIL_FROM_NAME: z.string().default('The Artist Academy'),

  // URLs
  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1),

  // Webhooks Dendreo
  DENDREO_WEBHOOK_URL: z.string().url().optional(),
  DENDREO_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides :');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
