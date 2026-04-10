'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface VideoPlayerProps {
  uaId: string;
  completionThreshold?: number;
}

interface ProgressData {
  videoPositionSeconds: number;
  videoPercentWatched: number;
  status: string;
}

export function VideoPlayer({ uaId, completionThreshold = 99 }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const srcSetRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Sends progress to backend — never logs the URL
  const sendProgress = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.duration || video.duration === Infinity) return;

    const positionSeconds = Math.floor(video.currentTime);
    const percentWatched = Math.round((video.currentTime / video.duration) * 100);

    try {
      const res = await api.post<{ data: { status: string } }>(`/player/uas/${uaId}/progress`, {
        positionSeconds,
        percentWatched,
      });
      if (res.data.status === 'completed') {
        setCompleted(true);
      }
    } catch {
      // Silently fail — progress save is best-effort
    }
  }, [uaId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Get saved progress (resume position)
        const progressRes = await api.get<{ data: ProgressData }>(`/player/uas/${uaId}/progress`);
        const savedPosition = progressRes.data.videoPositionSeconds;
        if (progressRes.data.status === 'completed') {
          setCompleted(true);
        }

        // 2. Get signed URL
        const streamRes = await api.get<{ data: { signedUrl: string } }>(`/player/uas/${uaId}/stream`);

        if (cancelled) return;

        const video = videoRef.current;
        if (!video) return;

        // Set source — the signed URL never appears in DOM (set via JS only)
        video.src = streamRes.data.signedUrl;
        srcSetRef.current = true;

        // Resume at saved position once metadata is loaded
        video.addEventListener('loadedmetadata', () => {
          if (savedPosition > 5 && savedPosition < video.duration - 10) {
            video.currentTime = savedPosition;
          }
        }, { once: true });

        setLoading(false);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Impossible de charger la video');
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      // Clean up: revoke object URL if any, clear interval
      if (intervalRef.current) clearInterval(intervalRef.current);
      const video = videoRef.current;
      if (video) video.src = '';
    };
  }, [uaId, sendProgress]);

  // Setup heartbeat interval on play, clear on pause/end
  function handlePlay() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(sendProgress, 10_000);
  }

  function handlePause() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    sendProgress();
  }

  function handleEnded() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    sendProgress();
  }

  if (error) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-white font-medium mb-1">Impossible de charger la video</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
            <div className="flex items-center gap-3 text-gray-400">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-sm">Chargement...</span>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          controlsList="nodownload"
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
        />
      </div>

      {/* Completion banner */}
      {completed && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2.5 text-sm">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Video terminee</span>
        </div>
      )}
    </div>
  );
}
