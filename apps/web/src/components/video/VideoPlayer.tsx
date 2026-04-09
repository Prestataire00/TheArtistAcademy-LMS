'use client';

// Lecteur vidéo HLS avec :
// - Reprise au dernier point de lecture (videoPositionSeconds)
// - Heartbeat progression toutes les 15s (POST /api/v1/progress/video)
// - Déclenchement complétion côté client (optimiste) si ≥ seuil
// Implémentation complète : Phase 1

interface VideoPlayerProps {
  signedHlsUrl: string;
  enrollmentId: string;
  uaId: string;
  videoPositionSeconds: number;
  completionThreshold?: number; // défaut 99
  onCompleted?: () => void;
}

export function VideoPlayer(_props: VideoPlayerProps) {
  return (
    <div className="aspect-video bg-black flex items-center justify-center rounded-lg">
      <p className="text-gray-400 text-sm">TODO: Phase 1 — VideoPlayer hls.js</p>
    </div>
  );
}
