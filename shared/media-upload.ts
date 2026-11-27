import { z } from 'zod';

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

export const MediaKindSchema = z.enum(['logo', 'cover', 'flyer']);
export type MediaKind = z.infer<typeof MediaKindSchema>;
export type AllowedInputImageMime = (typeof ALLOWED_INPUT_IMAGE_MIME_TYPES)[number];

export const CompressImageRequestMetaSchema = z
  .object({
    organizationId: z.string().uuid(),
    kind: MediaKindSchema,
  })
  .strict();
export type CompressImageRequestMeta = z.infer<typeof CompressImageRequestMetaSchema>;

export const CompressImageResponseSchema = z
  .object({
    bucket: z.literal(MEDIA_STORAGE_BUCKET),
    path: z.string().min(1),
    publicUrl: z
      .string()
      .url()
      .refine((value) => {
        try {
          const protocol = new URL(value).protocol;
          return protocol === 'https:' || protocol === 'http:';
        } catch {
          return false;
        }
      }, 'URL must use http or https protocol.'),
    mimeType: z.literal(OUTPUT_IMAGE_MIME_TYPE),
    sizeBytes: z.number().int().positive().max(MAX_MEDIA_UPLOAD_BYTES),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    exifStripped: z.literal(true),
  })
  .strict();
export type CompressImageResponse = z.infer<typeof CompressImageResponseSchema>;
