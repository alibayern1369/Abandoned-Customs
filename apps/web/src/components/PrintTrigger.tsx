'use client';

import { useEffect } from 'react';

/** Opens the browser print dialog once after mount (Save as PDF works too). */
export function PrintTrigger() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="mb-4 flex gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
      >
        چاپ / ذخیره PDF
      </button>
    </div>
  );
}
