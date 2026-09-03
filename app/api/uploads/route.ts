import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  uploadToR2,
  deleteFromR2,
  keyFromUrl,
  r2Configured,
  isAllowedType,
  MAX_UPLOAD_BYTES,
} from "@/lib/r2";

/**
 * POST /api/uploads  (admin only)
 * multipart/form-data: file, folder? (products | categories | blogs | ...)
 * Returns { url } — the public R2 URL to store in the image field.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!r2Configured)
    return NextResponse.json(
      { error: "Image storage is not configured yet." },
      { status: 503 },
    );

  try {
    const form = await req.formData();
    const file = form.get("file");
    const folder = (form.get("folder")?.toString() || "products").toLowerCase();
    // PDFs are accepted only when the caller explicitly opts in (e.g. a banner
    // button that opens a catalogue). Image fields stay image-only.
    const allowPdf = form.get("allowPdf") === "1";

    if (!(file instanceof File))
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES)
      return NextResponse.json(
        { error: "File too large (max 25 MB)" },
        { status: 413 },
      );
    if (!isAllowedType(file.type, allowPdf))
      return NextResponse.json(
        {
          error: allowPdf
            ? "Unsupported file type (PNG, JPG, WEBP, GIF or PDF)"
            : "Unsupported file type (PNG, JPG, WEBP or GIF)",
        },
        { status: 415 },
      );

    const { url } = await uploadToR2(folder, file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("POST /api/uploads failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/**
 * DELETE /api/uploads  (admin only) — remove an image from R2.
 * Body: { url }. Only deletes objects in our bucket (ignores external URLs).
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!r2Configured) return NextResponse.json({ ok: true });

  try {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    const key = url ? keyFromUrl(url) : null;
    // Not one of ours (external/placeholder URL) — nothing to delete.
    if (!key) return NextResponse.json({ ok: true, skipped: true });
    await deleteFromR2(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/uploads failed", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
