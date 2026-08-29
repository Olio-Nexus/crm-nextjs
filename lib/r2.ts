import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

/**
 * Cloudflare R2 (S3-compatible) object storage for uploaded images/files.
 * Configured via env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET, R2_PUBLIC_BASE_URL (the bucket's public URL — R2.dev or a custom
 * domain). Uploaded objects are returned as a public URL that drops straight
 * into the existing string/JSON image fields (no schema change).
 */
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET;
const PUBLIC_BASE = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

/** True only when every required R2 var is present. */
export const r2Configured = Boolean(
  ACCOUNT_ID &&
    BUCKET &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY,
);

const client = r2Configured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Allow-list of accepted content types. PDFs only where explicitly permitted. */
export function isAllowedType(type: string, allowPdf = false): boolean {
  if (allowPdf && type === "application/pdf") return true;
  return (
    type === "image/png" ||
    type === "image/jpeg" ||
    type === "image/webp" ||
    type === "image/gif"
  );
}

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a file to R2 under `folder/` with a random key (never trust the client
 * filename). Returns the public URL. Throws if R2 isn't configured or the
 * public base URL is unset.
 */
export async function uploadToR2(
  folder: string,
  file: { arrayBuffer(): Promise<ArrayBuffer>; type: string },
): Promise<UploadResult> {
  if (!client || !BUCKET) throw new Error("R2 is not configured");
  if (!PUBLIC_BASE) throw new Error("R2_PUBLIC_BASE_URL is not set");

  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "") || "misc";
  const ext = EXT[file.type] ?? "bin";
  const key = `${safeFolder}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: bytes,
      ContentType: file.type,
    }),
  );

  return { url: `${PUBLIC_BASE}/${key}`, key };
}

/** Extract the object key from a public URL (only for URLs in our bucket). */
export function keyFromUrl(url: string): string | null {
  if (!PUBLIC_BASE || !url) return null;
  const prefix = `${PUBLIC_BASE}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/** Delete an object by key. No-op if R2 isn't configured. */
export async function deleteFromR2(key: string): Promise<void> {
  if (!client || !BUCKET) throw new Error("R2 is not configured");
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
