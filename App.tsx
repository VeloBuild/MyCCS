import { StatusBar } from 'expo-status-bar';
import { AuthIdentityScreen } from './src/screens/AuthIdentityScreen';
import { MyCcsHubScreen } from './src/screens/MyCcsHubScreen';

export default function App() {
  return (
    <>
      <AuthIdentityScreen
        renderAuthenticated={({ profile, busy, errorMessage, onSignOut }) => (
          <MyCcsHubScreen
            profile={profile}
            busy={busy}
            errorMessage={errorMessage}
            onSignOut={onSignOut}
          />
        )}
      />
      <StatusBar style="auto" />
    </>
  );
}
