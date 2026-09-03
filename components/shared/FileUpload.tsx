"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

const PDF_MAX_BYTES = 25 * 1024 * 1024; // 25 MB — matches the server limit.

/**
 * Admin PDF picker → uploads to R2 via POST /api/uploads with `allowPdf` (the
 * same-origin NextAuth cookie authorizes it) and returns the public URL through
 * `onUploaded`. Used e.g. for a banner button that opens a catalogue PDF — the
 * returned URL is a direct file link, so the storefront opens it inline in a new
 * tab. The server enforces its own type/size limits regardless.
 */
export function FileUpload({
  folder = "docs",
  label = "Upload PDF",
  onUploaded,
}: {
  folder?: string;
  label?: string;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after an error
    if (!file) return;

    setError(null);
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      setError("Too large (max 25 MB).");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      fd.append("allowPdf", "1");
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onUploaded(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {busy ? "Uploading…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
