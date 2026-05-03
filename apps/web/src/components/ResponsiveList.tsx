'use client';

import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  label: ReactNode;
  /** Texte simple utilisé en mobile et pour aria-label si label est un ReactNode. */
  mobileLabel?: string;
  render: (item: T) => ReactNode;
  mobileHidden?: boolean;
  align?: 'left' | 'center' | 'right';
};

export type ResponsiveListProps<T> = {
  items: T[];
  columns: Column<T>[];
  titleKey: (item: T) => ReactNode;
  subtitleKey?: (item: T) => ReactNode;
  badgeKey?: (item: T) => ReactNode;
  actions?: (item: T) => ReactNode;
  rowKey?: (item: T, index: number) => string | number;
  rowClassName?: (item: T) => string;
};

export function ResponsiveList<T>({
  items,
  columns,
  titleKey,
  subtitleKey,
  badgeKey,
  actions,
  rowKey,
  rowClassName,
}: ResponsiveListProps<T>) {
  const alignClass = (a?: 'left' | 'center' | 'right') =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <>
      {/* ─── Desktop : tableau ─────────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 font-medium text-gray-500 ${alignClass(c.align)}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, i) => {
              const cls = rowClassName?.(item) ?? '';
              return (
                <tr
                  key={rowKey ? rowKey(item, i) : i}
                  className={`hover:bg-gray-50 ${cls}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${alignClass(c.align)}`}>
                      {c.render(item)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Mobile : cartes ───────────────────────────────────── */}
      <ul className="md:hidden space-y-3">
        {items.map((item, i) => {
          const cls = rowClassName?.(item) ?? '';
          return (
            <li
              key={rowKey ? rowKey(item, i) : i}
              className={`bg-white rounded-lg border border-gray-200 p-4 space-y-3 ${cls}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 break-words">{titleKey(item)}</div>
                  {subtitleKey && (
                    <div className="text-xs text-gray-500 mt-0.5">{subtitleKey(item)}</div>
                  )}
                </div>
                {badgeKey && <div className="flex-shrink-0">{badgeKey(item)}</div>}
              </div>

              {columns
                .filter((c) => !c.mobileHidden)
                .map((c) => (
                  <div key={c.key} className="text-sm">
                    <div className="text-[11px] text-gray-400 mb-0.5">{c.mobileLabel ?? c.label}</div>
                    <div className="text-gray-700">{c.render(item)}</div>
                  </div>
                ))}

              {actions && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 border-t border-gray-100">
                  {actions(item)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
