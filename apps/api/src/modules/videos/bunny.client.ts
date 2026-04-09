import axios from 'axios';
import crypto from 'crypto';
import { bunnyConfig } from '../../config/bunny';

const streamApi = axios.create({
  baseURL: bunnyConfig.streamBaseUrl,
  headers: { AccessKey: bunnyConfig.apiKey },
});

/**
 * Crée une vidéo dans la librairie Bunny.net et retourne l'upload URL.
 */
export async function createBunnyVideo(title: string): Promise<{ videoId: string; uploadUrl: string }> {
  const { data } = await streamApi.post('/videos', { title });
  return {
    videoId: data.guid,
    uploadUrl: `https://video.bunnycdn.com/tusupload`,
  };
}

/**
 * Récupère les infos d'une vidéo Bunny (statut transcodage, durée, etc.)
 */
export async function getBunnyVideo(videoId: string) {
  const { data } = await streamApi.get(`/videos/${videoId}`);
  return data;
}

/**
 * Génère une Signed URL HLS valide pour X secondes.
 * Format Bunny : token = SHA256(secret + path + expiry)
 */
export function generateSignedHlsUrl(videoId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + bunnyConfig.signedUrlTtlSeconds;
  const path = `/${videoId}/playlist.m3u8`;
  const token = crypto
    .createHash('sha256')
    .update(bunnyConfig.signedUrlSecret + path + expiry)
    .digest('hex');

  return `https://${bunnyConfig.streamHostname}${path}?token=${token}&expires=${expiry}`;
}
