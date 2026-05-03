'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const prev = () => page > 0 && onPageChange(page - 1);
  const next = () => page < totalPages - 1 && onPageChange(page + 1);

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <button
        type="button"
        onClick={prev}
        disabled={page === 0}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Précédent
      </button>
      <span className="text-gray-500">Page {page + 1} / {totalPages}</span>
      <button
        type="button"
        onClick={next}
        disabled={page >= totalPages - 1}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Suivant
      </button>
    </div>
  );
}
