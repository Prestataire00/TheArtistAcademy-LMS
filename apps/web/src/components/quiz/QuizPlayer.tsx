'use client';

// Composant quiz :
// - Affiche les questions (QCM, Vrai/Faux, Réponse courte)
// - Auto-correction immédiate pour QCM et Vrai/Faux
// - Soumission → POST /api/v1/uas/:id/quiz/attempts
// Implémentation complète : Phase 1

export function QuizPlayer({ uaId }: { uaId: string }) {
  return (
    <div className="p-6 bg-white rounded-lg border">
      <p className="text-gray-400 text-sm">TODO: Phase 1 — QuizPlayer ({uaId})</p>
    </div>
  );
}
