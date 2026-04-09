// Page UA — dispatche selon le type (video | quiz | resource)
// Implémentation complète : Phase 1

export default function UAPage({ params }: { params: { id: string } }) {
  return (
    <main className="max-w-4xl mx-auto p-6">
      <p className="text-gray-400">TODO: Phase 1 — UA {params.id}</p>
    </main>
  );
}
