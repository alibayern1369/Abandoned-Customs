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
      <button type="button" onClick={() => window.print()} className="ui-btn ui-btn-primary">
        چاپ / ذخیره PDF
      </button>
    </div>
  );
}
