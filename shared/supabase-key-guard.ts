function isServiceRoleJwt(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  const payloadSegment = parts[1];
  if (!payloadSegment || !/^[A-Za-z0-9_-]+$/.test(payloadSegment)) {
    return false;
  }

  const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return (
      typeof decoded === 'object' &&
      decoded !== null &&
      (decoded as { role?: unknown }).role === 'service_role'
    );
  } catch {
    return false;
  }
}

export function isSecretSupabaseKeyPrefix(value: string): boolean {
  return value.trim().toLowerCase().startsWith('sb_secret_');
}

export function isSupabaseServiceRoleJwt(value: string): boolean {
  return isServiceRoleJwt(value.trim());
}

export function assertPublishableClientKey(
  value: string | undefined,
  envName = 'VITE_SUPABASE_PUBLISHABLE_KEY'
): void {
  if (!value) {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }
  if (isSecretSupabaseKeyPrefix(trimmed)) {
    throw new Error(`Backend secret keys (sb_secret_*) must never be used in ${envName}.`);
  }
  if (isSupabaseServiceRoleJwt(trimmed)) {
    throw new Error(`Supabase service_role JWTs must never be used in ${envName}.`);
  }
}
