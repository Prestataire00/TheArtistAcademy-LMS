'use client';

import { useEffect, useRef, useState } from 'react';

export type ViewerType = 'pdf' | 'image' | 'video' | 'ppt' | 'other';

const PPT_MIMES = new Set([
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export function getViewerType(mimeType: string): ViewerType {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (PPT_MIMES.has(mimeType)) return 'ppt';
  return 'other';
}

/** IntersectionObserver hook : retourne true dès que l'élément est entré
 *  dans le viewport (sticky — ne repasse jamais à false). */
function useEnteredViewport(rootMargin = '200px') {
  const ref = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (entered || !ref.current) return;
    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setEntered(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entered, rootMargin]);

  return { ref, entered };
}

interface ResourceViewerProps {
  resourceId: string;
  fileType: string;
  fileName: string;
  /** Fetcher qui retourne la signed URL pour ce resourceId. Différent côté
   *  player (`/player/resources/:id/preview`) et admin (`/admin/resources/:uaId/preview`). */
  fetchSignedUrl: (resourceId: string) => Promise<string>;
  /** Handler optionnel pour le bouton "Télécharger" du fallback PPT/other et
   *  pour le bouton "Télécharger à la place" en cas d'erreur générique. */
  onDownload?: () => void;
  /** Si true, charge la signed URL immédiatement (pour slide-over admin et
   *  page UA dédiée). Si false (par défaut), lazy load via IntersectionObserver
   *  (pour la liste ressources). */
  eager?: boolean;
  /** Hauteur du viewer en pixels. Défaut 600 (liste/slide-over),
   *  700 sur la page UA dédiée. */
  height?: number;
  /** Lien "Retour à la formation" — affiché dans les écrans LockedState
   *  (verrouillage frontend ou réponse UA_LOCKED de l'API). Côté admin
   *  (pas de notion de verrouillage), ne pas passer. */
  backToFormationHref?: string;
  /** Si true, le viewer affiche le LockedState immédiatement sans tenter de
   *  charger la signed URL. Permet de bloquer aussi les types PPT/other qui
   *  sinon court-circuitent l'appel API et n'auraient jamais l'info UA_LOCKED.
   *  Côté admin : laisser undefined / false. */
  isLocked?: boolean;
}

export function ResourceViewer({
  resourceId,
  fileType,
  fileName,
  fetchSignedUrl,
  onDownload,
  eager = false,
  height = 600,
  backToFormationHref,
  isLocked = false,
}: ResourceViewerProps) {
  const viewerType = getViewerType(fileType);
  const needsUrl = viewerType === 'pdf' || viewerType === 'image' || viewerType === 'video';

  const { ref, entered } = useEnteredViewport();
  const shouldLoad = eager || entered;

  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code: string | null } | null>(null);

  useEffect(() => {
    // isLocked court-circuite tout fetch — on n'appelle même pas l'API.
    if (isLocked || !needsUrl || !shouldLoad || url || error) return;
    let cancelled = false;
    fetchSignedUrl(resourceId)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err as Error & { code?: string };
        setError({ message: e.message ?? 'Erreur', code: e.code ?? null });
      });
    return () => { cancelled = true; };
  }, [isLocked, needsUrl, shouldLoad, url, error, resourceId, fetchSignedUrl]);

  // Court-circuit : verrouillage connu d'avance (linear pathway côté player).
  // Doit passer AVANT le rendu PPT/other pour les bloquer aussi. Placé APRÈS
  // les hooks pour respecter les rules-of-hooks si le prop change à l'exécution.
  if (isLocked) {
    return <LockedState height={height} backToFormationHref={backToFormationHref} />;
  }

  // ─── PPT placeholder (pas de fetch nécessaire) ─────────────────────────
  if (viewerType === 'ppt') {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg" style={{ height }}>
        <div className="w-16 h-16 rounded-lg bg-orange-50 flex items-center justify-center mb-4">
          <span className="text-xl font-bold text-orange-600">PPT</span>
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">Aperçu PowerPoint non disponible dans le navigateur</p>
        <p className="text-xs text-gray-500 mb-5">Téléchargez le fichier pour le consulter</p>
        {onDownload && (
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Télécharger
          </button>
        )}
      </div>
    );
  }

  // ─── Other (fallback, pas de fetch nécessaire) ─────────────────────────
  if (viewerType === 'other') {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg" style={{ height }}>
        <p className="text-sm font-medium text-gray-700 mb-1">Aperçu non disponible pour ce type de fichier</p>
        <p className="text-xs text-gray-500 mb-5">{fileType}</p>
        {onDownload && (
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Télécharger
          </button>
        )}
      </div>
    );
  }

  // ─── PDF / Image / Video : viewer avec lazy loading ────────────────────
  return (
    <div ref={ref} style={{ minHeight: height }}>
      {!shouldLoad || (!url && !error) ? (
        <Skeleton height={height} />
      ) : error ? (
        error.code === 'UA_LOCKED' ? (
          <LockedState height={height} backToFormationHref={backToFormationHref} />
        ) : (
          <ErrorState height={height} message={error.message} onDownload={onDownload} />
        )
      ) : url ? (
        <Loaded url={url} viewerType={viewerType} fileName={fileName} height={height} />
      ) : null}
    </div>
  );
}

function Skeleton({ height }: { height: number }) {
  return (
    <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ height }}>
      <div className="w-6 h-6 border-2 border-gray-300 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

function LockedState({ height, backToFormationHref }: { height: number; backToFormationHref?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6 py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg"
      style={{ height }}
    >
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-800 mb-1">Ressource verrouillée</p>
      <p className="text-xs text-gray-500 mb-5 max-w-sm">
        Termine l&apos;unité d&apos;apprentissage précédente pour accéder à cette ressource.
      </p>
      {backToFormationHref && (
        <a
          href={backToFormationHref}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 text-sm rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          Retour à la formation
        </a>
      )}
    </div>
  );
}

function ErrorState({ height, message, onDownload }: { height: number; message: string; onDownload?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-8 bg-red-50 border border-red-100 rounded-lg" style={{ height }}>
      <p className="text-sm font-medium text-red-700 mb-1">Impossible de charger l&apos;aperçu</p>
      <p className="text-xs text-red-600 mb-5">{message}</p>
      {onDownload && (
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 transition-colors font-medium"
        >
          Télécharger à la place
        </button>
      )}
    </div>
  );
}

function Loaded({ url, viewerType, fileName, height }: { url: string; viewerType: ViewerType; fileName: string; height: number }) {
  if (viewerType === 'pdf') {
    return (
      <iframe
        src={url}
        title={fileName}
        width="100%"
        height={height}
        style={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}
      />
    );
  }
  if (viewerType === 'image') {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-lg" style={{ height }}>
        <img
          src={url}
          alt={fileName}
          style={{ maxHeight: height, maxWidth: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }
  if (viewerType === 'video') {
    return (
      <div className="flex items-center justify-center bg-black rounded-lg overflow-hidden" style={{ maxHeight: height }}>
        <video controls style={{ maxHeight: height, maxWidth: '100%' }}>
          <source src={url} />
          Votre navigateur ne supporte pas la lecture vidéo.
        </video>
      </div>
    );
  }
  return null;
}
