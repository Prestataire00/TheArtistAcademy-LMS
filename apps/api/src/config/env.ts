import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  // JWT interne
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),

  // SSO Dendreo (HS256 — secret partagé)
  // DENDREO_SIGNATURE_KEY : nouvelle var unifiée (HMAC webhooks + JWT SSO).
  // DENDREO_JWT_SECRET / DENDREO_WEBHOOK_SECRET : conservées pour rétrocompat ;
  // si SIGNATURE_KEY est défini, il est préféré.
  DENDREO_SIGNATURE_KEY: z.string().default(''),
  DENDREO_JWT_SECRET: z.string().default(''),
  DENDREO_JWT_EXPIRY_TOLERANCE_SECONDS: z.coerce.number().default(30),
  DENDREO_LMS_NAME: z.string().default('TAALMS'),

  // Supabase
  SUPABASE_URL: z.string().url().default('http://localhost'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().default('videos'),
  SUPABASE_RESOURCES_BUCKET: z.string().default('resources'),
  SUPABASE_SIGNED_URL_EXPIRES_IN: z.coerce.number().default(7200), // 2h en secondes

  // Email (Resend — optionnel en dev)
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM_ADDRESS: z.string().default('noreply@the-artist-academy.fr'),
  EMAIL_FROM_NAME: z.string().default('The Artist Academy'),
  REMINDER_DELAY_DAYS: z.coerce.number().default(7),

  // URLs
  API_URL: z.string().url().default('http://localhost:3001'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Webhooks Dendreo
  DENDREO_WEBHOOK_SECRET: z.string().default(''),
  DENDREO_API_KEY: z.string().default(''),
  DENDREO_TENANT_ID: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables d\'environnement invalides :');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Si DIRECT_URL n'est pas fourni (Railway Postgres addon n'injecte que DATABASE_URL),
// on retombe sur DATABASE_URL pour que prisma migrate deploy fonctionne.
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

export const env = parsed.data;
