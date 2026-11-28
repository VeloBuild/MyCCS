// shortcut: Mobile push token acquisition uses an injectable PushTokenDriver plus native Linking deep links without installing expo-notifications yet because getExpoPushTokenAsync requires an EAS projectId; wire expo-notifications plugin and EAS projectId in spec-08-qa-security-release.
import type { SupabaseClient } from '@supabase/supabase-js';
import { Linking } from 'react-native';
import { z } from 'zod';
import {
  ExpoPushTokenSchema,
  PushPlatformSchema,
  parseNotificationDeepLink,
  type PushPlatform,
} from '../../shared/gmetrix';

export const RegisteredPushTokenSchema = z
  .object({
    id: z.string().uuid(),
    expoPushToken: ExpoPushTokenSchema,
    platform: PushPlatformSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type RegisteredPushToken = z.infer<typeof RegisteredPushTokenSchema>;

export interface PushTokenDriver {
  getExpoPushToken(): Promise<string | null>;
  getPlatform(): PushPlatform;
}

export interface PushTokensRpcClient {
  rpc(
    fn: string,
    params?: Record<string, unknown>
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from(relation: string): {
    delete(): {
      eq(
        col: string,
        val: unknown
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

export interface LinkingLike {
  getInitialURL(): Promise<string | null | undefined>;
  addEventListener(
    type: 'url',
    listener: (event: { url: string }) => void
  ): { remove(): void };
}

export type NotificationDeepLinkRoute = { tab: 'keys'; section: 'my_keys' };

export function adaptPushTokensRpcClient(
  client: SupabaseClient
): PushTokensRpcClient {
  return client as unknown as PushTokensRpcClient;
}

export async function registerDevicePushToken(
  client: PushTokensRpcClient,
  expoPushToken: string,
  platform: PushPlatform
): Promise<RegisteredPushToken> {
  const parsedToken = ExpoPushTokenSchema.parse(expoPushToken);
  const parsedPlatform = PushPlatformSchema.parse(platform);

  const { data, error } = await client.rpc('register_push_token', {
    p_expo_push_token: parsedToken,
    p_platform: parsedPlatform,
  });

  if (error) {
    throw new Error(error.message);
  }

  return RegisteredPushTokenSchema.parse(data);
}

export async function syncDevicePushToken(
  client: PushTokensRpcClient,
  driver: PushTokenDriver
): Promise<RegisteredPushToken | null> {
  const rawToken = await driver.getExpoPushToken();
  if (!rawToken || rawToken.trim().length === 0) {
    return null;
  }

  return registerDevicePushToken(client, rawToken, driver.getPlatform());
}

export async function unregisterDevicePushToken(
  client: PushTokensRpcClient,
  expoPushToken: string
): Promise<void> {
  const parsedToken = ExpoPushTokenSchema.parse(expoPushToken);

  const { error } = await client
    .from('push_tokens')
    .delete()
    .eq('expo_push_token', parsedToken);

  if (error) {
    throw new Error(error.message);
  }
}

export function resolveDeepLinkToHubRoute(
  url: string | null | undefined
): NotificationDeepLinkRoute | null {
  if (!url) {
    return null;
  }
  return parseNotificationDeepLink(url);
}

export function subscribeToNotificationDeepLinks(
  onRoute: (route: NotificationDeepLinkRoute) => void,
  linking: LinkingLike = Linking
): () => void {
  let active = true;

  if (typeof linking.getInitialURL === 'function') {
    void Promise.resolve(linking.getInitialURL())
      .then((initialUrl) => {
        if (!active) {
          return;
        }
        const route = resolveDeepLinkToHubRoute(initialUrl);
        if (route) {
          onRoute(route);
        }
      })
      .catch(() => {});
  }

  const subscription =
    typeof linking.addEventListener === 'function'
      ? linking.addEventListener('url', ({ url }) => {
          if (!active) {
            return;
          }
          const route = resolveDeepLinkToHubRoute(url);
          if (route) {
            onRoute(route);
          }
        })
      : null;

  return () => {
    active = false;
    subscription?.remove?.();
  };
}
