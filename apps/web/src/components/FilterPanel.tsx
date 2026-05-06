'use client';

import type { FilterDef, FilterValue, FilterValues } from '@/lib/useTableState';
import { MultiSelectDropdown } from './MultiSelectDropdown';

interface FilterPanelProps {
  open: boolean;
  filters: FilterDef[];
  values: FilterValues;
  onChange: (key: string, value: FilterValue) => void;
  onReset: () => void;
  activeCount: number;
}

/**
 * Panneau dépliable de filtres avancés (slide-down sous la barre de
 * recherche). Rend un contrôle adapté au type de chaque filtre :
 *   - multi          : checkboxes
 *   - dateRange      : 2 inputs date
 *   - numericRange   : 2 inputs range
 *   - singleSelect   : radios
 */
export function FilterPanel({ open, filters, values, onChange, onReset, activeCount }: FilterPanelProps) {
  if (!open) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filters.map((def) => (
          <div key={def.key}>
            <label className="block text-xs font-medium text-gray-700 mb-2">{def.label}</label>
            {def.type === 'multi' && def.variant !== 'dropdown' && (
              <MultiCheckboxes
                options={def.options}
                value={(values[def.key] as string[]) ?? []}
                onChange={(v) => onChange(def.key, v)}
              />
            )}
            {def.type === 'multi' && def.variant === 'dropdown' && (
              <MultiSelectDropdown
                label={def.label}
                placeholder={def.placeholder ?? 'Toutes les options'}
                options={def.options}
                selected={(values[def.key] as string[]) ?? []}
                onChange={(v) => onChange(def.key, v)}
              />
            )}
            {def.type === 'dateRange' && (
              <DateRangeInput
                value={(values[def.key] as { from?: string; to?: string }) ?? {}}
                onChange={(v) => onChange(def.key, v)}
                presets={def.presets ?? false}
              />
            )}
            {def.type === 'numericRange' && (
              <NumericRangeInput
                min={def.min}
                max={def.max}
                step={def.step ?? 1}
                suffix={def.suffix}
                value={(values[def.key] as { min?: number; max?: number }) ?? {}}
                onChange={(v) => onChange(def.key, v)}
              />
            )}
            {def.type === 'singleSelect' && (
              <SingleSelectRadios
                options={def.options}
                value={values[def.key] as string | undefined}
                onChange={(v) => onChange(def.key, v)}
              />
            )}
            {def.type === 'toggle' && (
              <ToggleSwitch
                label={def.description ?? def.label}
                value={values[def.key] === true}
                onChange={(v) => onChange(def.key, v)}
              />
            )}
          </div>
        ))}
      </div>

      {activeCount > 0 && (
        <div className="pt-3 mt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onReset}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            Effacer tous les filtres ({activeCount})
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-controls ────────────────────────────────────────────────────────────

function MultiCheckboxes({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              checked
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            aria-pressed={checked}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DateRangeInput({
  value,
  onChange,
  presets,
}: {
  value: { from?: string; to?: string };
  onChange: (v: { from?: string; to?: string }) => void;
  presets: boolean;
}) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const presetOptions = presets ? [
    { label: "Aujourd'hui", compute: () => ({ from: todayStr, to: todayStr }) },
    {
      label: '7 derniers jours',
      compute: () => ({ from: new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10), to: todayStr }),
    },
    {
      label: '30 derniers jours',
      compute: () => ({ from: new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10), to: todayStr }),
    },
    {
      label: 'Ce mois-ci',
      compute: () => {
        const first = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        return { from: first, to: todayStr };
      },
    },
  ] : [];

  return (
    <div className="space-y-2">
      {presets && (
        <div className="flex flex-wrap gap-1">
          {presetOptions.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.compute())}
              className="px-2 py-1 text-[11px] rounded-full border border-gray-200 bg-white text-gray-600 hover:border-gray-300 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value.from ?? ''}
          onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <span className="text-gray-400 text-xs">→</span>
        <input
          type="date"
          value={value.to ?? ''}
          onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
          className="flex-1 min-w-0 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
    </div>
  );
}

function NumericRangeInput({
  min,
  max,
  step,
  suffix,
  value,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  suffix?: string;
  value: { min?: number; max?: number };
  onChange: (v: { min?: number; max?: number }) => void;
}) {
  const lo = value.min ?? min;
  const hi = value.max ?? max;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Min</span>
            <span>{lo}{suffix ?? ''}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={lo}
            onChange={(e) => {
              const v = Number(e.target.value);
              const newMin = Math.min(v, hi);
              onChange({ min: newMin === min ? undefined : newMin, max: value.max });
            }}
            className="w-full accent-brand-600"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Max</span>
            <span>{hi}{suffix ?? ''}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={hi}
            onChange={(e) => {
              const v = Number(e.target.value);
              const newMax = Math.max(v, lo);
              onChange({ min: value.min, max: newMax === max ? undefined : newMax });
            }}
            className="w-full accent-brand-600"
          />
        </div>
      </div>
    </div>
  );
}

function ToggleSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex items-center gap-2 text-left"
    >
      <span
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          value ? 'bg-brand-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            value ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </span>
      <span className="text-xs text-gray-600">{label}</span>
    </button>
  );
}

function SingleSelectRadios({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(checked ? undefined : opt.value)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              checked
                ? 'bg-brand-50 border-brand-300 text-brand-700'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            aria-pressed={checked}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
