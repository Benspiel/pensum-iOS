import type { ExpoConfig } from 'expo/config';

const developmentBundleId = 'dev.buchholz.pensum';
const bundleIdentifier = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || developmentBundleId;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || 'd5310afc-6b5f-4c1a-b198-5a833472ae77';
const appleTeamId = process.env.EXPO_PUBLIC_APPLE_TEAM_ID;
const owner = process.env.EXPO_PUBLIC_EXPO_OWNER || 'bookwoods-team';
const slug = process.env.EXPO_PUBLIC_EAS_PROJECT_SLUG || 'pensum';

const config: ExpoConfig = {
  name: 'Pensum',
  slug,
  version: '0.1.1',
  orientation: 'default',
  scheme: ['pensum', 'appwrite-callback-6af569a7000d660f3559'],
  icon: './assets/app-icon.png',
  userInterfaceStyle: 'automatic',
  owner,
  ios: {
    bundleIdentifier,
    supportsTablet: true,
    ...(appleTeamId ? { appleTeamId } : {}),
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/app-icon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    '@react-native-community/datetimepicker',
    // Push-Berechtigung (aps-environment) nur, wenn das Signaturprofil sie enthält: EXPO_PUBLIC_PUSH_ENTITLEMENT=true im EAS-Build setzen.
    ...(process.env.EXPO_PUBLIC_PUSH_ENTITLEMENT === 'true' ? ['expo-notifications' as const] : []),
    ['expo-secure-store', { faceIDPermission: false }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Pensum verwendet das von dir ausgewählte Foto für das Lernwerkzeug.',
        cameraPermission: 'Pensum verwendet die Kamera für Tafelbilder und Arbeitsblätter.',
        microphonePermission: false,
      },
    ],
  ],
  extra: { eas: { projectId: easProjectId } },
};

export default config;
