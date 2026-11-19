import type { ExpoConfig } from 'expo/config';

const developmentBundleId = 'dev.buchholz.pensum';
const bundleIdentifier = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || developmentBundleId;
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const appleTeamId = process.env.EXPO_PUBLIC_APPLE_TEAM_ID;
const owner = process.env.EXPO_PUBLIC_EXPO_OWNER;
const slug = process.env.EXPO_PUBLIC_EAS_PROJECT_SLUG || 'pensum-ios';

const config: ExpoConfig = {
  name: 'Pensum',
  slug,
  version: '0.1.0',
  orientation: 'default',
  scheme: ['pensum', 'appwrite-callback-6af569a7000d660f3559'],
  icon: './assets/app-icon.png',
  userInterfaceStyle: 'automatic',
  ...(owner ? { owner } : {}),
  ios: {
    bundleIdentifier,
    supportsTablet: true,
    ...(appleTeamId ? { appleTeamId } : {}),
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  plugins: [
    'expo-router',
    'expo-font',
    '@react-native-community/datetimepicker',
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
  ...(easProjectId ? { extra: { eas: { projectId: easProjectId } } } : {}),
};

export default config;
