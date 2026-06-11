/**
 * Capacitor configuration — wraps the deployed Vercel app in a native Android/iOS shell.
 *
 * The app loads `https://swaya-attendance.vercel.app` in its WebView instead of a
 * bundled static export. This keeps the web and mobile clients in lockstep — every
 * Vercel deploy is immediately visible to the app users with no App Store update.
 *
 * Background location is provided by @capacitor-community/background-geolocation,
 * which uses an Android foreground service so the OS keeps the tracker alive
 * even when the app is closed.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.swaya.attendance',
  appName: 'Swaya Attendance',
  webDir: '.next',
  // Load the live Vercel deployment instead of bundled static files.
  server: {
    url: 'https://swaya-attendance.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    // Background location is requested at runtime; static permissions live in
    // AndroidManifest.xml (see android/app/src/main/AndroidManifest.xml).
    backgroundColor: '#ffffff',
  },
};

export default config;
