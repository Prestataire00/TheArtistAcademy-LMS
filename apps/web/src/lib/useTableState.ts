'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SortDir = 'asc' | 'desc';
export type SortState = { field: string; direction: SortDir } | null;

export type FilterDef =
  | {
      type: 'multi';
      key: string;
      label: string;
      options: Array<{ value: string; label: string }>;
      variant?: 'chips' | 'dropdown';
      placeholder?: string;
    }
  | { type: 'dateRange'; key: string; label: string }
  | {
      type: 'numericRange';
      key: string;
      label: string;
      min: number;
      max: number;
      step?: number;
      suffix?: string;
    }
  | { type: 'singleSelect'; key: string; label: string; options: Array<{ value: string; label: string }> }
  | { type: 'toggle'; key: string; label: string; description?: string };

export type FilterValue =
  | string[]                         // multi
  | { from?: string; to?: string }   // dateRange
  | { min?: number; max?: number }   // numericRange
  | string | undefined               // singleSelect
  | boolean;                         // toggle

export type FilterValues = Record<string, FilterValue>;

interface UseTableStateOptions {
  filterDefs?: FilterDef[];
  defaultSort?: SortState;
  pageSize?: number;
  searchDebounceMs?: number;
  searchParam?: string;
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

function readSearchParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function writeSearchParams(params: URLSearchParams) {
  if (typeof window === 'undefined') return;
  const qs = params.toString();
  const url = new URL(window.location.href);
  url.search = qs ? `?${qs}` : '';
  window.history.replaceState(null, '', url.toString());
}

function emptyFilters(defs: FilterDef[]): FilterValues {
  const out: FilterValues = {};
  for (const def of defs) {
    if (def.type === 'multi') out[def.key] = [];
    else if (def.type === 'dateRange') out[def.key] = {};
    else if (def.type === 'numericRange') out[def.key] = {};
    else if (def.type === 'toggle') out[def.key] = false;
    else out[def.key] = undefined;
  }
  return out;
}

function readFiltersFromUrl(defs: FilterDef[], params: URLSearchParams): FilterValues {
  const out: FilterValues = {};
  for (const def of defs) {
    if (def.type === 'multi') {
      const raw = params.get(def.key);
      out[def.key] = raw ? raw.split(',').filter(Boolean) : [];
    } else if (def.type === 'dateRange') {
      const from = params.get(`${def.key}From`) ?? undefined;
      const to = params.get(`${def.key}To`) ?? undefined;
      out[def.key] = { from, to };
    } else if (def.type === 'numericRange') {
      const minRaw = params.get(`${def.key}Min`);
      const maxRaw = params.get(`${def.key}Max`);
      out[def.key] = {
        min: minRaw !== null ? Number(minRaw) : undefined,
        max: maxRaw !== null ? Number(maxRaw) : undefined,
      };
    } else if (def.type === 'toggle') {
      out[def.key] = params.get(def.key) === 'true';
    } else {
      out[def.key] = params.get(def.key) ?? undefined;
    }
  }
  return out;
}

function writeFiltersToParams(defs: FilterDef[], values: FilterValues, params: URLSearchParams) {
  for (const def of defs) {
    const v = values[def.key];
    if (def.type === 'multi') {
      const arr = (v as string[]) ?? [];
      if (arr.length > 0) params.set(def.key, arr.join(','));
      else params.delete(def.key);
    } else if (def.type === 'dateRange') {
      const r = (v as { from?: string; to?: string }) ?? {};
      if (r.from) params.set(`${def.key}From`, r.from); else params.delete(`${def.key}From`);
      if (r.to) params.set(`${def.key}To`, r.to); else params.delete(`${def.key}To`);
    } else if (def.type === 'numericRange') {
      const r = (v as { min?: number; max?: number }) ?? {};
      if (typeof r.min === 'number') params.set(`${def.key}Min`, String(r.min)); else params.delete(`${def.key}Min`);
      if (typeof r.max === 'number') params.set(`${def.key}Max`, String(r.max)); else params.delete(`${def.key}Max`);
    } else if (def.type === 'toggle') {
      if (v === true) params.set(def.key, 'true'); else params.delete(def.key);
    } else {
      const s = v as string | undefined;
      if (s) params.set(def.key, s); else params.delete(def.key);
    }
  }
}

function isFilterActive(def: FilterDef, value: FilterValue): boolean {
  if (def.type === 'multi') return ((value as string[]) ?? []).length > 0;
  if (def.type === 'dateRange') {
    const r = (value as { from?: string; to?: string }) ?? {};
    return Boolean(r.from || r.to);
  }
  if (def.type === 'numericRange') {
    const r = (value as { min?: number; max?: number }) ?? {};
    return r.min !== undefined || r.max !== undefined;
  }
  if (def.type === 'toggle') return value === true;
  return Boolean(value);
}

function readSortFromUrl(params: URLSearchParams): SortState {
  const raw = params.get('sort');
  if (!raw) return null;
  const [field, direction] = raw.split(':');
  if (!field || (direction !== 'asc' && direction !== 'desc')) return null;
  return { field, direction };
}

function writeSortToParams(sort: SortState, params: URLSearchParams) {
  if (sort) params.set('sort', `${sort.field}:${sort.direction}`);
  else params.delete('sort');
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTableState(opts: UseTableStateOptions = {}) {
  const {
    filterDefs = [],
    defaultSort = null,
    pageSize = 50,
    searchDebounceMs = 200,
    searchParam = 'q',
  } = opts;

  const filterDefsRef = useRef(filterDefs);
  filterDefsRef.current = filterDefs;

  // ─── Initial state from URL ───────────────────────────────────────────────
  const [searchInput, setSearchInputState] = useState<string>(() => {
    const p = readSearchParams();
    return p.get(searchParam) ?? '';
  });
  const [search, setSearch] = useState<string>(searchInput);

  const [sort, setSortState] = useState<SortState>(() => {
    const p = readSearchParams();
    return readSortFromUrl(p) ?? defaultSort;
  });

  const [filters, setFilters] = useState<FilterValues>(() => {
    const p = readSearchParams();
    return { ...emptyFilters(filterDefs), ...readFiltersFromUrl(filterDefs, p) };
  });

  const [page, setPage] = useState<number>(0);

  // ─── URL sync ─────────────────────────────────────────────────────────────
  const syncUrl = useCallback((s: string, sortValue: SortState, f: FilterValues) => {
    const params = readSearchParams();
    if (s) params.set(searchParam, s); else params.delete(searchParam);
    writeSortToParams(sortValue, params);
    writeFiltersToParams(filterDefsRef.current, f, params);
    writeSearchParams(params);
  }, [searchParam]);

  // Debounced search → committed search + URL
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setSearchInput = useCallback((next: string) => {
    setSearchInputState(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(next);
      syncUrl(next, sortRef.current, filtersRef.current);
      setPage(0);
    }, searchDebounceMs);
  }, [searchDebounceMs, syncUrl]);

  // Refs to read latest values from event handlers without triggering
  // re-renders, et — surtout — pour éviter d'exécuter des effets de bord
  // (history.replaceState, intercepté par le Router Next) à l'intérieur
  // d'un updater setState qui tourne en phase de render.
  const sortRef = useRef(sort);
  sortRef.current = sort;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const searchRef = useRef(search);
  searchRef.current = search;

  const cycleSort = useCallback((field: string) => {
    const prev = sortRef.current;
    let next: SortState;
    if (!prev || prev.field !== field) next = { field, direction: 'asc' };
    else if (prev.direction === 'asc') next = { field, direction: 'desc' };
    else next = null;
    setSortState(next);
    syncUrl(searchRef.current, next, filtersRef.current);
  }, [syncUrl]);

  const setFilter = useCallback((key: string, value: FilterValue) => {
    const next = { ...filtersRef.current, [key]: value };
    setFilters(next);
    syncUrl(searchRef.current, sortRef.current, next);
    setPage(0);
  }, [syncUrl]);

  const resetFilters = useCallback(() => {
    const empty = emptyFilters(filterDefsRef.current);
    setFilters(empty);
    syncUrl(searchRef.current, sortRef.current, empty);
    setPage(0);
  }, [syncUrl]);

  const resetSearchAndFilters = useCallback(() => {
    const empty = emptyFilters(filterDefsRef.current);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSearchInputState('');
    setSearch('');
    setFilters(empty);
    syncUrl('', sortRef.current, empty);
    setPage(0);
  }, [syncUrl]);

  const activeFilterCount = useMemo(
    () => filterDefs.reduce((acc, def) => acc + (isFilterActive(def, filters[def.key]) ? 1 : 0), 0),
    [filterDefs, filters],
  );

  return {
    search,
    searchInput,
    setSearchInput,
    sort,
    cycleSort,
    filters,
    setFilter,
    resetFilters,
    resetSearchAndFilters,
    activeFilterCount,
    page,
    setPage,
    pageSize,
  };
}

// ─── Sort comparator ─────────────────────────────────────────────────────────

function normalizeStr(v: unknown): string {
  if (v == null) return '';
  return String(v).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Trie un tableau selon un comparator par champ. Les valeurs null/undefined
 * sont systématiquement renvoyées en queue, indépendamment de la direction.
 */
export function sortItems<T>(
  items: T[],
  sort: SortState,
  accessors: Record<string, (item: T) => unknown>,
): T[] {
  if (!sort) return items;
  const get = accessors[sort.field];
  if (!get) return items;

  const dir = sort.direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    const va = get(a);
    const vb = get(b);

    const aNull = va === null || va === undefined;
    const bNull = vb === null || vb === undefined;
    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;

    const sa = normalizeStr(va);
    const sb = normalizeStr(vb);
    return sa.localeCompare(sb) * dir;
  });
}
