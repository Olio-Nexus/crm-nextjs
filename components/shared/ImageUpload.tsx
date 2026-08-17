"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Admin image picker → uploads to R2 via POST /api/uploads (same-origin, so the
 * NextAuth session cookie authorizes it) and returns each public URL through
 * `onUploaded`. Validates type + size on the client for a fast, clear error;
 * the server enforces its own limits regardless.
 *
 * With `multiple`, several files can be picked at once — they upload one by one
 * and `onUploaded` fires per successful file (so callers can append each URL).
 */
export function ImageUpload({
  folder = "products",
  maxBytes = DEFAULT_MAX_BYTES,
  label = "Upload image",
  multiple = false,
  onUploaded,
}: {
  folder?: string;
  maxBytes?: number;
  label?: string;
  multiple?: boolean;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxMb = Math.round(maxBytes / (1024 * 1024));

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // let the same file(s) be re-picked after an error
    if (!files.length) return;

    setError(null);
    setBusy(true);
    const errors: string[] = [];
    for (const file of files) {
      if (!ALLOWED.includes(file.type)) {
        errors.push(`${file.name}: use PNG, JPG or WEBP`);
        continue;
      }
      if (file.size > maxBytes) {
        errors.push(`${file.name}: too large (max ${maxMb} MB)`);
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Upload failed.");
        onUploaded(data.url as string);
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
    }
    if (errors.length) setError(errors.join(" · "));
    setBusy(false);
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
        accept="image/png,image/jpeg,image/webp"
        multiple={multiple}
        className="hidden"
        onChange={handleFiles}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
