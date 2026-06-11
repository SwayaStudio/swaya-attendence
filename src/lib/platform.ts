/**
 * Platform detection — picks the right code path for native vs web.
 *
 * The app runs in three contexts:
 *   - regular browser (e.g. Vercel URL in Chrome): `isNative() === false`
 *   - Capacitor Android app: `isNative() === true`, `getPlatform() === 'android'`
 *   - Capacitor iOS app:     `isNative() === true`, `getPlatform() === 'ios'`
 *
 * Used by the tracker to choose between web's `useBackgroundTracker` (a JS
 * setInterval) and the native background-geolocation plugin (Android
 * foreground service).
 */

import type { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    Capacitor?: typeof Capacitor;
  }
}

/** True when running inside the Capacitor WebView. */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  return window.Capacitor?.isNativePlatform() === true;
}

/** 'android' | 'ios' | 'web' — what the app is running on. */
export function getPlatform(): 'android' | 'ios' | 'web' {
  if (!isNative()) return 'web';
  return window.Capacitor!.getPlatform() as 'android' | 'ios';
}
