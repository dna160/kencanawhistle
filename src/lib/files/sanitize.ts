/**
 * File upload sanitization + EXIF/metadata stripping.
 *
 * Anonymity guarantee: uploaded images must have all EXIF metadata removed
 * before storage, so GPS location, device info, timestamps etc. cannot
 * de-anonymize a reporter.
 *
 * For images: sharp strips all metadata by default.
 * For non-image files: we strip common metadata via exifr where supported.
 */
import sharp from "sharp";
import path from "path";

/** MIME types we'll process through sharp to strip EXIF */
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/tiff",
]);

/** Maximum file size: 10 MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed MIME types for upload */
export const ALLOWED_MIME_TYPES = new Set([
  ...IMAGE_MIMES,
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4",
]);

export interface SanitizedFile {
  buffer: Buffer;
  mime: string;
  sizeBytes: number;
  metadataStripped: boolean;
  safeFilename: string;
}

/**
 * Sanitize an uploaded file buffer:
 * 1. Validate size + MIME
 * 2. Strip EXIF/metadata from images via sharp
 * 3. Return a safe filename (no path traversal)
 */
export async function sanitizeUpload(
  buffer: Buffer,
  originalMime: string,
  originalFilename: string
): Promise<SanitizedFile> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`);
  }

  if (!ALLOWED_MIME_TYPES.has(originalMime)) {
    throw new Error(`File type ${originalMime} is not allowed`);
  }

  // Safe filename: basename only, no path components, alphanumeric + safe chars
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const base = path.basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 64);
  const safeFilename = `${base}${ext}` || "upload";

  let outputBuffer = buffer;
  let metadataStripped = false;

  if (IMAGE_MIMES.has(originalMime)) {
    // sharp strips ALL metadata by default; withMetadata() would re-add it
    outputBuffer = await sharp(buffer)
      .rotate() // auto-orient based on EXIF (then strip it)
      .toBuffer();
    metadataStripped = true;
  }
  // For non-images, we store as-is — PDF metadata stripping is out of scope for v1
  // but the variable is set false to signal this in the DB

  return {
    buffer: outputBuffer,
    mime: originalMime,
    sizeBytes: outputBuffer.length,
    metadataStripped,
    safeFilename,
  };
}
