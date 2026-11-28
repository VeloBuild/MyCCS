import { useEffect, useState, type ReactElement } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PublicProfileDto } from '../../shared/auth';
import { IdentityCard } from '../components/IdentityCard';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import {
  type AuthSupabaseClient,
  provisionCurrentUserProfile,
  restoreAuthenticatedSession,
  signInWithInstitutionalEmail,
  signOutCurrentSession,
  signUpWithInstitutionalEmail,
  verifySignupOtpAndProvisionProfile,
} from '../services/auth';

type AuthStep = 'signup' | 'signin' | 'otp';

export interface AuthenticatedRenderContext {
  profile: PublicProfileDto;
  busy: boolean;
  errorMessage: string | null;
  onSignOut: () => void;
}

export interface AuthIdentityScreenProps {
  client?: AuthSupabaseClient;
  renderAuthenticated?: (context: AuthenticatedRenderContext) => ReactElement;
}

export function AuthIdentityScreen({
  client,
  renderAuthenticated,
}: AuthIdentityScreenProps) {
  const [step, setStep] = useState<AuthStep>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [profile, setProfile] = useState<PublicProfileDto | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolveClient = (): AuthSupabaseClient => client ?? getSupabaseClient();

  const clearSensitiveFields = () => {
    setPassword('');
    setStudentId('');
    setOtpCode('');
    setFullName('');
  };

  useEffect(() => {
    if (!client && !isSupabaseConfigured()) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const restored = await restoreAuthenticatedSession(
          client ?? getSupabaseClient()
        );
        if (!active || !restored.session) {
          return;
        }
        setProfile(restored.profile);
        setSignedInEmail(
          restored.profile?.email ??
            restored.session.user?.email ??
            'Verified institutional session'
        );
      } catch (err) {
        if (active) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Session restore failed.'
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [client]);

  const handleSwitchStep = (nextStep: 'signup' | 'signin') => {
    setErrorMessage(null);
    clearSensitiveFields();
    setStep(nextStep);
  };

  const handleEnterOtpStep = () => {
    setErrorMessage(null);
    setStep('otp');
  };

  const handleSignUp = async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const result = await signUpWithInstitutionalEmail(resolveClient(), {
        email,
        password,
        fullName,
        studentId,
      });
      setEmail(result.email);
      setStep('otp');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Signup failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const provisioned = await verifySignupOtpAndProvisionProfile(
        resolveClient(),
        {
          email,
          token: otpCode,
          fullName,
          studentId,
        }
      );
      setProfile(provisioned);
      setSignedInEmail(provisioned.email);
      clearSensitiveFields();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'OTP verification failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const { user, profile: loadedProfile } =
        await signInWithInstitutionalEmail(resolveClient(), {
          email,
          password,
        });
      setProfile(loadedProfile);
      setSignedInEmail(
        loadedProfile?.email ?? user.email ?? email.trim().toLowerCase()
      );
      clearSensitiveFields();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteProfile = async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      const provisioned = await provisionCurrentUserProfile(resolveClient(), {
        fullName,
        studentId,
      });
      setProfile(provisioned);
      setSignedInEmail(provisioned.email);
      clearSensitiveFields();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Profile provisioning failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      await signOutCurrentSession(resolveClient());
      setProfile(null);
      setSignedInEmail(null);
      clearSensitiveFields();
      setStep('signin');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Sign-out failed.');
    } finally {
      setBusy(false);
    }
  };

  if (profile) {
    if (renderAuthenticated) {
      return renderAuthenticated({
        profile,
        busy,
        errorMessage,
        onSignOut: handleSignOut,
      });
    }

    return (
      <IdentityCard
        profile={profile}
        busy={busy}
        errorMessage={errorMessage}
        onSignOut={handleSignOut}
      />
    );
  }

  if (signedInEmail) {
    return (
      <View style={styles.container} testID="complete-profile-form">
        <Text style={styles.title}>Complete MyCCS Profile</Text>
        <Text style={styles.meta}>{signedInEmail}</Text>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
          testID="complete-fullname-input"
        />
        <TextInput
          style={styles.input}
          placeholder="Private Student ID"
          value={studentId}
          onChangeText={setStudentId}
          testID="complete-student-id-input"
        />
        <Pressable
          style={styles.button}
          onPress={handleCompleteProfile}
          disabled={busy}
          testID="complete-profile-button"
        >
          <Text style={styles.buttonText}>Complete Profile & Provision QR</Text>
        </Pressable>
        {errorMessage ? (
          <Text style={styles.error} testID="error-text">
            {errorMessage}
          </Text>
        ) : null}
        <Pressable
          style={styles.secondaryButton}
          onPress={handleSignOut}
          disabled={busy}
          testID="signout-button"
        >
          <Text style={styles.secondaryButtonText}>Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MyCCS Institutional Auth</Text>
      <View style={styles.tabRow}>
        <Pressable
          onPress={() => handleSwitchStep('signup')}
          style={[styles.tab, step === 'signup' && styles.tabActive]}
          testID="switch-signup-tab"
        >
          <Text style={styles.tabText}>Sign Up</Text>
        </Pressable>
        <Pressable
          onPress={() => handleSwitchStep('signin')}
          style={[styles.tab, step === 'signin' && styles.tabActive]}
          testID="switch-signin-tab"
        >
          <Text style={styles.tabText}>Sign In</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.input}
        placeholder="name@lpunetwork.edu.ph"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID="email-input"
      />

      {step !== 'otp' ? (
        <TextInput
          style={styles.input}
          placeholder="Password (min 8 chars)"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="password-input"
        />
      ) : null}

      {step === 'signup' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            testID="fullname-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Private Student ID"
            value={studentId}
            onChangeText={setStudentId}
            testID="student-id-input"
          />
          <Pressable
            style={styles.button}
            onPress={handleSignUp}
            disabled={busy}
            testID="signup-button"
          >
            <Text style={styles.buttonText}>Send 6-Digit OTP</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={handleEnterOtpStep}
            disabled={busy}
            testID="enter-otp-link"
          >
            <Text style={styles.linkText}>Already have a 6-digit OTP?</Text>
          </Pressable>
        </>
      ) : null}

      {step === 'otp' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-Digit Email OTP"
            keyboardType="number-pad"
            maxLength={6}
            value={otpCode}
            onChangeText={setOtpCode}
            testID="otp-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={fullName}
            onChangeText={setFullName}
            testID="fullname-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Private Student ID"
            value={studentId}
            onChangeText={setStudentId}
            testID="student-id-input"
          />
          <Pressable
            style={styles.button}
            onPress={handleVerifyOtp}
            disabled={busy}
            testID="verify-otp-button"
          >
            <Text style={styles.buttonText}>Verify OTP & Provision QR</Text>
          </Pressable>
        </>
      ) : null}

      {step === 'signin' ? (
        <Pressable
          style={styles.button}
          onPress={handleSignIn}
          disabled={busy}
          testID="signin-button"
        >
          <Text style={styles.buttonText}>Sign In</Text>
        </Pressable>
      ) : null}

      {errorMessage ? (
        <Text style={styles.error} testID="error-text">
          {errorMessage}
        </Text>
      ) : null}
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
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  tabActive: {
    backgroundColor: '#cbd5e1',
  },
  tabText: {
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
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
  secondaryButton: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  linkText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    marginTop: 12,
  },
  meta: {
    color: '#4b5563',
    marginTop: 4,
    marginBottom: 16,
  },
});
