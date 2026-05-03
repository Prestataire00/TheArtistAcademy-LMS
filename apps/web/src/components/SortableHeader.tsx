'use client';

import type { SortState } from '@/lib/useTableState';

interface SortableHeaderProps {
  field: string;
  label: string;
  currentSort: SortState;
  onSortChange: (field: string) => void;
  align?: 'left' | 'right' | 'center';
}

/**
 * En-tête de colonne triable. Cycle au clic : asc → desc → ordre par défaut.
 * Affiche ↑ / ↓ / pas d'icône selon l'état courant.
 */
export function SortableHeader({
  field,
  label,
  currentSort,
  onSortChange,
  align = 'left',
}: SortableHeaderProps) {
  const active = currentSort?.field === field;
  const dir = active ? currentSort?.direction : null;

  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <button
      type="button"
      onClick={() => onSortChange(field)}
      className={`inline-flex items-center gap-1 -mx-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 transition-colors font-medium text-gray-500 select-none w-full ${justify}`}
      aria-label={`Trier par ${label}`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className="w-3 inline-flex items-center justify-center text-gray-400">
        {dir === 'asc' && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        )}
        {dir === 'desc' && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </span>
    </button>
  );
}
