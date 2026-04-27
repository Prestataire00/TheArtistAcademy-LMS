'use client';

import { LogoutButton } from '@/components/LogoutButton';

export default function FormateurLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed top-3 right-3 z-50">
        <LogoutButton className="px-3 py-2 text-xs font-medium text-gray-600 bg-white/90 backdrop-blur border border-gray-200 rounded-lg shadow-sm hover:bg-white hover:text-gray-900 transition-colors min-h-[36px]" />
      </div>
      {children}
    </>
  );
}
