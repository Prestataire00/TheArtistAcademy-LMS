'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Une erreur est survenue</h1>
      <p className="text-gray-500 mb-6">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
      >
        Réessayer
      </button>
    </div>
  );
}
