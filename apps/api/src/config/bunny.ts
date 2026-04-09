import { env } from './env';

export const bunnyConfig = {
  apiKey: env.BUNNY_API_KEY,
  libraryId: env.BUNNY_LIBRARY_ID,
  streamHostname: env.BUNNY_STREAM_HOSTNAME,
  storageZone: env.BUNNY_STORAGE_ZONE,
  storageApiKey: env.BUNNY_STORAGE_API_KEY,
  cdnHostname: env.BUNNY_CDN_HOSTNAME,
  signedUrlSecret: env.BUNNY_SIGNED_URL_SECRET,
  webhookSecret: env.BUNNY_WEBHOOK_SECRET,

  streamBaseUrl: `https://video.bunnycdn.com/library/${env.BUNNY_LIBRARY_ID}`,
  storageBaseUrl: `https://storage.bunnycdn.com/${env.BUNNY_STORAGE_ZONE}`,

  // Durée de validité des signed URLs vidéo (2 heures)
  signedUrlTtlSeconds: 2 * 60 * 60,
};
