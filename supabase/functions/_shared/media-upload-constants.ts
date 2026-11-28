export const MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MEDIA_STORAGE_BUCKET = 'org-media' as const;
export const ALLOWED_INPUT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const OUTPUT_IMAGE_MIME_TYPE = 'image/webp' as const;

export const MEDIA_VARIANT_LIMITS = {
  logo: { maxWidth: 512, maxHeight: 512, compress: 0.8 },
  cover: { maxWidth: 1600, maxHeight: 900, compress: 0.8 },
  flyer: { maxWidth: 1600, maxHeight: 1600, compress: 0.82 },
} as const;

export type MediaKind = keyof typeof MEDIA_VARIANT_LIMITS;
export type AllowedInputImageMime = (typeof ALLOWED_INPUT_IMAGE_MIME_TYPES)[number];
