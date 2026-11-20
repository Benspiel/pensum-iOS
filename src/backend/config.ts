// Public Appwrite identifiers from the Pensum web checkout (js/config.js).
export const endpoint = 'https://appwrite.buchholz.dev/v1';
export const projectId = '6af569a7000d660f3559';
export const databaseId = 'pensum';
export const bundleIdentifier = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || 'dev.buchholz.pensum';
export const appwriteCallbackScheme = `appwrite-callback-${projectId}`;
// Appwrite Messaging: APNs-Anbieter „Pensum Apple“ und das Thema, das alle Geräte abonnieren (Nachrichten an alle in der Console).
export const pushProviderId = process.env.EXPO_PUBLIC_PUSH_PROVIDER_ID || '6b0014fb002ccb259a7e';
export const pushTopicId = 'alle';
export const googleAuthEnabled = process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === 'true';

export const tableIds = {
  subjects: 'subjects',
  grades: 'grades',
  handwriting: 'handwriting',
  mindmaps: 'mindmaps',
  decks: 'decks',
  cards: 'cards',
  planner: 'planner',
  chats: 'chats',
  chatMessages: 'chat_messages',
  toolVisits: 'tool_visits',
  pushDevices: 'push_devices',
} as const;

export const functionIds = {
  deleteAccount: 'delete-account',
  mindmap: '6afad2e10029c7718dc2',
  lehrerSchmidt: 'lehrer-schmidt',
  abschreiben: 'abschreiben',
  aufgaben: 'aufgaben',
  kiChat: 'ki-chat',
  adminStats: 'admin-stats',
} as const;

export const teamIds = { tester: 'tester', kiTester: 'ki-tester', admin: 'admin' } as const;
