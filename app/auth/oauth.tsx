import { Redirect } from 'expo-router';

export default function OAuthCallbackScreen() {
  // SessionProvider processes the original URL and validates the pending OAuth nonce.
  return <Redirect href="/konto" />;
}
