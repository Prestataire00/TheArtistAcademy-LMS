'use client';

import { useMemo, useRef, useState } from 'react';
import { normalizeForSearch } from '@/lib/search';
import { useClickOutside } from '@/lib/useClickOutside';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  label: string;
  searchable?: boolean;
}

/**
 * Dropdown multi-select avec recherche interne, conçu pour scaler à 50+
 * options. Bouton fermé affiche un résumé compact ("Formation X, +N").
 * Popover s'ouvre en absolute sous le bouton, ferme au clic extérieur ou
 * sur Échap.
 */
export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
  label,
  searchable = true,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside([containerRef], () => setOpen(false), open);

  const selectedLabels = useMemo(() => {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return selected.map((v) => map.get(v)).filter(Boolean) as string[];
  }, [options, selected]);

  const filteredOptions = useMemo(() => {
    if (!query) return options;
    const q = normalizeForSearch(query);
    return options.filter((o) => normalizeForSearch(o.label).includes(q));
  }, [options, query]);

  const buttonLabel = (() => {
    if (selectedLabels.length === 0) return placeholder;
    if (selectedLabels.length === 1) return selectedLabels[0];
    return `${selectedLabels[0]}, +${selectedLabels.length - 1}`;
  })();

  function toggle(value: string) {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  }

  function selectAll() {
    onChange(options.map((o) => o.value));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`w-full inline-flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md border bg-white transition-colors ${
          open
            ? 'border-brand-500 ring-2 ring-brand-500/30'
            : 'border-gray-200 hover:border-gray-300'
        } ${selectedLabels.length === 0 ? 'text-gray-400' : 'text-gray-700'}`}
      >
        <span className="truncate text-left flex-1">{buttonLabel}</span>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 left-0 right-0 min-w-[260px] bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-gray-100">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
          )}

          <ul className="max-h-[320px] overflow-y-auto py-1" role="listbox" aria-multiselectable>
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400">Aucun résultat</li>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.value)}
                      role="option"
                      aria-selected={checked}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`w-4 h-4 flex items-center justify-center rounded border flex-shrink-0 ${
                          checked
                            ? 'bg-brand-600 border-brand-600 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                        aria-hidden="true"
                      >
                        {checked && (
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 truncate">{opt.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {(options.length > 1 || selected.length > 0) && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-100 bg-gray-50">
              {options.length > 1 ? (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Tout sélectionner
                </button>
              ) : <span />}
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                >
                  Effacer
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
