import { StatusBar } from 'expo-status-bar';
import { AuthIdentityScreen } from './src/screens/AuthIdentityScreen';

export default function App() {
  return (
    <>
      <AuthIdentityScreen />
      <StatusBar style="auto" />
    </>
  );
}
