import { NextRequest } from "next/server";
import { storeJson, handleOptions } from "@/lib/store";
import {
  uploadToR2,
  deleteFromR2,
  keyFromUrl,
  r2Configured,
  isAllowedType,
  MAX_UPLOAD_BYTES,
} from "@/lib/r2";

export const OPTIONS = handleOptions;

/**
 * POST /api/store/uploads  (storefront, CORS)
 * multipart/form-data: file, purpose ("personalization" | "vendor")
 * Returns { url } — the public R2 URL to carry in the cart / enquiry payload.
 * Vendor uploads may be PDFs (proposal/catalog); personalization is images only.
 */
export async function POST(req: NextRequest) {
  if (!r2Configured)
    return storeJson({ error: "Image storage is not configured yet." }, 503);

  try {
    const form = await req.formData();
    const file = form.get("file");
    const purpose = form.get("purpose")?.toString() ?? "personalization";
    const folder =
      purpose === "vendor"
        ? "vendor"
        : purpose === "careers"
          ? "careers"
          : "personalization";
    // Vendor proposals and career resumes may be PDFs; personalization is images.
    const allowPdf = folder === "vendor" || folder === "careers";

    if (!(file instanceof File))
      return storeJson({ error: "No file provided" }, 400);
    if (file.size > MAX_UPLOAD_BYTES)
      return storeJson({ error: "File too large (max 10 MB)" }, 413);
    if (!isAllowedType(file.type, allowPdf))
      return storeJson(
        {
          error: allowPdf
            ? "Unsupported file type (PDF, PNG, JPG or WEBP)"
            : "Unsupported file type (PNG, JPG, WEBP or GIF)",
        },
        415,
      );

    const { url } = await uploadToR2(folder, file);
    return storeJson({ url });
  } catch (error) {
    console.error("POST /api/store/uploads failed", error);
    return storeJson({ error: "Upload failed" }, 500);
  }
}

/**
 * DELETE /api/store/uploads  — remove a just-uploaded storefront file from R2.
 * Body: { url }. Restricted to the personalization/ and vendor/ folders so a
 * caller can't delete admin/product images.
 */
export async function DELETE(req: NextRequest) {
  if (!r2Configured) return storeJson({ ok: true });
  try {
    const { url } = (await req.json().catch(() => ({}))) as { url?: string };
    const key = url ? keyFromUrl(url) : null;
    if (!key) return storeJson({ error: "Invalid file URL" }, 400);
    if (
      !key.startsWith("personalization/") &&
      !key.startsWith("vendor/") &&
      !key.startsWith("careers/")
    )
      return storeJson({ error: "Not allowed" }, 403);
    await deleteFromR2(key);
    return storeJson({ ok: true });
  } catch (error) {
    console.error("DELETE /api/store/uploads failed", error);
    return storeJson({ error: "Delete failed" }, 500);
  }
}
