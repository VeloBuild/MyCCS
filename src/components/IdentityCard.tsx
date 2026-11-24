import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicProfileDto } from '../../shared/auth';

export interface IdentityCardProps {
  profile: PublicProfileDto;
  busy: boolean;
  errorMessage: string | null;
  onSignOut: () => void;
}

export function IdentityCard({
  profile,
  busy,
  errorMessage,
  onSignOut,
}: IdentityCardProps) {
  return (
    <View style={styles.container} testID="identity-card">
      <Text style={styles.title}>MyCCS Identity</Text>
      <Text style={styles.label}>{profile.fullName}</Text>
      <Text style={styles.meta}>
        {`${profile.email} · ${profile.role}`}
      </Text>
      <View style={styles.qrBox}>
        <Text style={styles.qrHeading}>Permanent Personal QR Token</Text>
        <Text style={styles.qrToken} testID="qr-token-text">
          {profile.qrToken}
        </Text>
      </View>
      {errorMessage ? (
        <Text style={styles.error} testID="error-text">
          {errorMessage}
        </Text>
      ) : null}
      <Pressable
        style={styles.button}
        onPress={onSignOut}
        disabled={busy}
        testID="signout-button"
      >
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#111827',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  meta: {
    color: '#4b5563',
    marginTop: 4,
    marginBottom: 16,
  },
  qrBox: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
  },
  qrHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  qrToken: {
    fontSize: 13,
    color: '#0f172a',
  },
  error: {
    color: '#b91c1c',
    marginTop: 12,
  },
  button: {
    backgroundColor: '#1d4ed8',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
