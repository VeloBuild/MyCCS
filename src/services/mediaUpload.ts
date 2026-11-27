import {
  ImageManipulator,
  SaveFormat,
  type ImageLoadOptions,
  type ImageResult,
  type SaveOptions,
} from 'expo-image-manipulator';
import {
  CompressImageRequestMetaSchema,
  CompressImageResponseSchema,
  MAX_MEDIA_UPLOAD_BYTES,
  MEDIA_VARIANT_LIMITS,
  MediaKindSchema,
  OUTPUT_IMAGE_MIME_TYPE,
  type CompressImageResponse,
  type MediaKind,
} from '../../shared/media-upload';
import { assertPublishableClientKey } from '../../shared/supabase-key-guard';

export interface ManipulatedImageRef {
  saveAsync(options?: SaveOptions): Promise<ImageResult>;
  release?(): void;
}

export interface ImageManipulatorContextLike {
  renderAsync(): Promise<ManipulatedImageRef>;
  release?(): void;
}

export interface ImageManipulatorDriver {
  manipulate(source: string, options?: ImageLoadOptions): ImageManipulatorContextLike;
}

export type FetchLike = typeof fetch;

export interface PreparedUploadImage {
  uri: string;
  width: number;
  height: number;
  mimeType: typeof OUTPUT_IMAGE_MIME_TYPE;
}

export interface UploadCompressedOrgMediaParams {
  localUri: string;
  organizationId: string;
  kind: MediaKind;
  accessToken: string;
  supabaseUrl: string;
  publishableKey: string;
  fileSizeBytes?: number;
  fetchFn?: FetchLike;
  manipulator?: ImageManipulatorDriver;
  readPreparedBlob?: (uri: string) => Promise<Blob | null>;
}

interface ReactNativeFormDataFile {
  uri: string;
  name: string;
  type: string;
}

type WebFormDataLike = FormData & {
  append(name: string, value: Blob | string, fileName?: string): void;
};

function isWebRuntime(): boolean {
  const runtime = globalThis as { window?: unknown; document?: unknown };
  return runtime.window !== undefined && runtime.document !== undefined;
}

async function defaultReadPreparedBlob(uri: string): Promise<Blob | null> {
  const isInlineWebUri = uri.startsWith('blob:') || uri.startsWith('data:');
  if (!isWebRuntime() && !isInlineWebUri) {
    return null;
  }

  const response = await globalThis.fetch(uri);
  if (!response.ok) {
    throw new Error('Failed to read prepared image data for upload.');
  }
  return response.blob();
}

function assertHttpBaseUrl(rawUrl: string): string {
  const normalized = rawUrl.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Supabase URL must use http or https protocol.');
    }
  } catch {
    throw new Error('Supabase URL must use http or https protocol.');
  }
  return normalized;
}

export async function precompressImageForUpload(
  localUri: string,
  kind: MediaKind,
  manipulator: ImageManipulatorDriver = ImageManipulator
): Promise<PreparedUploadImage> {
  const trimmedUri = localUri.trim();
  if (trimmedUri.length === 0) {
    throw new Error('Local image URI is required.');
  }

  const parsedKind = MediaKindSchema.parse(kind);
  const limit = MEDIA_VARIANT_LIMITS[parsedKind];

  const context = manipulator.manipulate(trimmedUri, {
    maxWidth: limit.maxWidth,
    maxHeight: limit.maxHeight,
  });
  let rendered: ManipulatedImageRef | undefined;
  try {
    rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.WEBP,
      compress: limit.compress,
    });

    return {
      uri: saved.uri,
      width: saved.width,
      height: saved.height,
      mimeType: OUTPUT_IMAGE_MIME_TYPE,
    };
  } finally {
    try {
      rendered?.release?.();
    } finally {
      context.release?.();
    }
  }
}

export async function uploadCompressedOrgMedia(
  params: UploadCompressedOrgMediaParams
): Promise<CompressImageResponse> {
  const meta = CompressImageRequestMetaSchema.parse({
    organizationId: params.organizationId,
    kind: params.kind,
  });

  const accessToken = params.accessToken.trim();
  if (accessToken.length === 0) {
    throw new Error('Authenticated session access token is required.');
  }

  const normalizedBaseUrl = assertHttpBaseUrl(params.supabaseUrl);

  const publishableKey = params.publishableKey.trim();
  if (publishableKey.length === 0) {
    throw new Error('Supabase publishable key is required.');
  }
  assertPublishableClientKey(publishableKey, 'SUPABASE_PUBLISHABLE_KEY');

  const prepared = await precompressImageForUpload(
    params.localUri,
    meta.kind,
    params.manipulator
  );

  const preparedBlob = params.readPreparedBlob
    ? await params.readPreparedBlob(prepared.uri)
    : await defaultReadPreparedBlob(prepared.uri);

  const effectiveSizeBytes = preparedBlob?.size ?? params.fileSizeBytes;
  if (effectiveSizeBytes !== undefined) {
    if (!Number.isFinite(effectiveSizeBytes) || effectiveSizeBytes <= 0) {
      throw new Error('Compressed image file is empty.');
    }
    if (effectiveSizeBytes > MAX_MEDIA_UPLOAD_BYTES) {
      throw new Error('Image exceeds the 5 MiB upload limit.');
    }
  }

  const formData = new FormData();
  formData.append('organization_id', meta.organizationId);
  formData.append('kind', meta.kind);
  const filename = `${meta.kind}.webp`;
  if (preparedBlob !== null) {
    (formData as WebFormDataLike).append('file', preparedBlob, filename);
  } else {
    const filePart: ReactNativeFormDataFile = {
      uri: prepared.uri,
      name: filename,
      type: OUTPUT_IMAGE_MIME_TYPE,
    };
    formData.append('file', filePart as unknown as Blob);
  }

  const fetchFn = params.fetchFn ?? globalThis.fetch;
  const response = await fetchFn(`${normalizedBaseUrl}/functions/v1/compress-image`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: publishableKey,
    },
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const serverError =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Image upload failed (${response.status}).`;
    throw new Error(serverError);
  }

  return CompressImageResponseSchema.parse(payload);
}
