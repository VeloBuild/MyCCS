import { z } from 'zod';
import {
  ALLOWED_INPUT_IMAGE_MIME_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_STORAGE_BUCKET,
  MEDIA_VARIANT_LIMITS,
  OUTPUT_IMAGE_MIME_TYPE,
  type AllowedInputImageMime,
  type MediaKind,
} from '../supabase/functions/_shared/media-upload-constants';

export {
  ALLOWED_INPUT_IMAGE_MIME_TYPES,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_STORAGE_BUCKET,
  MEDIA_VARIANT_LIMITS,
  OUTPUT_IMAGE_MIME_TYPE,
  type AllowedInputImageMime,
  type MediaKind,
};

export const MediaKindSchema = z.enum(['logo', 'cover', 'flyer']);

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
