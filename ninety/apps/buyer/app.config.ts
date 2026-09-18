import type { ExpoConfig } from 'expo/config';

/**
 * Expo configuration.
 *
 * Three environments — development, staging and production — each with its own
 * application id and its own API base URL, so they coexist on one device.
 *
 * That separation is not tidiness. The alternative, which happens more often
 * than it should, is testers on the production API creating real requests that
 * fan out to real yards, who answer them, and who learn that our alerts are
 * sometimes fiction.
 */
type Environment = 'development' | 'staging' | 'production';

const ENVIRONMENT = (process.env.APP_ENV as Environment | undefined) ?? 'development';

const PER_ENVIRONMENT: Record<Environment, { suffix: string; label: string; apiBase: string }> = {
  development: { suffix: '.dev', label: 'NINETY Dev', apiBase: 'http://10.0.2.2:3000' },
  staging: { suffix: '.staging', label: 'NINETY Staging', apiBase: 'https://staging-api.ninety.example' },
  production: { suffix: '', label: 'NINETY', apiBase: 'https://api.ninety.example' },
};

const current = PER_ENVIRONMENT[ENVIRONMENT];

const config: ExpoConfig = {
  name: current.label,
  slug: 'ninety-buyer',
  scheme: 'ninety',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  // Arabic and English from day one. RTL is enabled in the native shell, not
  // faked in JavaScript — `I18nManager.forceRTL` is what actually mirrors a
  // React Native layout.
  locales: { ar: './src/locales/store.ar.json', en: './src/locales/store.en.json' },
  assetBundlePatterns: ['**/*'],
  icon: './assets/icon.png',
  splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#0b0d10' },

  android: {
    package: `ae.ninety.buyer${current.suffix}`,
    // Auto-incremented in CI. A forgotten bump is a rejected upload at the worst
    // possible moment.
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? '1'),
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#0b0d10' },
    permissions: [
      'android.permission.CAMERA',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.POST_NOTIFICATIONS',
    ],
    // Declared here and in the Data Safety form. The two must agree.
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.READ_CONTACTS'],
  },

  ios: {
    // Configured so it compiles and runs on a device. NOT submitted: Android is
    // the launch priority and an iOS review queue is a distraction in month five.
    bundleIdentifier: `ae.ninety.buyer${current.suffix}`,
    buildNumber: process.env.IOS_BUILD_NUMBER ?? '1',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'Photograph the damaged part so yards can identify it.',
      NSLocationWhenInUseUsageDescription: 'Set the delivery pin for your part.',
    },
  },

  plugins: [
    ['expo-camera', { cameraPermission: 'Photograph the damaged part so yards can identify it.' }],
    ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Set the delivery pin for your part.' }],
    'expo-secure-store',
    'expo-localization',
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#f5b700' }],
  ],

  extra: {
    apiBase: process.env.API_BASE ?? current.apiBase,
    environment: ENVIRONMENT,
    marketCode: process.env.MARKET_CODE ?? 'AE',
    sentryDsn: process.env.SENTRY_DSN ?? '',
    eas: { projectId: process.env.EAS_PROJECT_ID ?? '' },
  },

  updates: { url: process.env.EAS_UPDATE_URL ?? '' },
  runtimeVersion: { policy: 'appVersion' },
};

export default config;
