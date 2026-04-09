// Page landing formation — affichée après le SSO
// Affiche : titre, description, progression globale, liste modules, bouton Reprendre
// Implémentation complète : Phase 1

export default function FormationPage({ params }: { params: { id: string } }) {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <p className="text-gray-400">
        TODO: Phase 1 — landing formation {params.id}
      </p>
    </main>
  );
}
