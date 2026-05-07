'use client';

import { useRef, useState } from 'react';
import { useClickOutside } from '@/lib/useClickOutside';

export interface RoleTagOption {
  value: string;
  label: string;
}

interface RoleTagSelectProps {
  options: RoleTagOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Input multi-select à tags : les valeurs sélectionnées s'affichent
 * comme tags supprimables (× sur chaque), un caret ouvre un dropdown
 * des options restantes. Pensé pour de petites listes (~5 options) où
 * la dropdown compact-summary du MultiSelectDropdown générique ne
 * matche pas la UX attendue.
 */
export function RoleTagSelect({
  options, value, onChange, placeholder = 'Choisir...', ariaLabel,
}: RoleTagSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside([ref], () => setOpen(false), open);

  const labelMap = new Map(options.map((o) => [o.value, o.label]));
  const remaining = options.filter((o) => !value.includes(o.value));

  function add(v: string) {
    if (!value.includes(v)) onChange([...value, v]);
    if (remaining.length <= 1) setOpen(false);
  }

  function remove(v: string) {
    onChange(value.filter((x) => x !== v));
  }

  return (
    <div ref={ref} className="relative">
      <div
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((v) => !v); }
          if (e.key === 'Escape') setOpen(false);
        }}
        className={`w-full min-h-[42px] flex flex-wrap items-center gap-1.5 px-2 py-1.5 border rounded-lg text-sm bg-white cursor-pointer transition-colors ${
          open ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        {value.length === 0 ? (
          <span className="text-gray-400 px-1">{placeholder}</span>
        ) : (
          value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 bg-brand-50 text-brand-700 text-xs font-medium pl-2 pr-1 py-0.5 rounded-full">
              {labelMap.get(v) ?? v}
              <button
                type="button"
                aria-label={`Retirer ${labelMap.get(v) ?? v}`}
                onClick={(e) => { e.stopPropagation(); remove(v); }}
                className="ml-0.5 w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-brand-100 text-brand-700"
              >×</button>
            </span>
          ))
        )}
        <svg className={`ml-auto w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {open && remaining.length > 0 && (
        <ul role="listbox" className="absolute z-20 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
          {remaining.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                onClick={() => add(opt.value)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >{opt.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
