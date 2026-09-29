"use client";

import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * Print controls for the invoice page. "Print / Save as PDF" opens the browser
 * print dialog (the page is print-styled to show only the receipt). Hidden when
 * printing via the `no-print` class.
 */
export function InvoiceActions({ backHref }: { backHref: string }) {
  return (
    <div className="no-print mb-6 flex items-center justify-between">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft size={16} /> Back to order
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <Printer size={15} /> Print / Save as PDF
      </button>
    </div>
  );
}
