/**
 * Cross-platform battery + network readers.
 *
 * Uses the official Capacitor plugins (@capacitor/device, @capacitor/network).
 * On the native Android/iOS app these read real OS values; in a plain browser
 * the plugins' web implementations fall back to the Web Battery / Network
 * Information APIs (which may be unavailable — battery then reads null).
 *
 * Imports are dynamic so this module is safe to evaluate during SSR.
 */
export type NetworkType = "wifi" | "mobile_data" | "offline" | "unknown";

/** Battery charge 0–100, or null when the platform doesn't expose it. */
export async function readBatteryPercent(): Promise<number | null> {
  try {
    const { Device } = await import("@capacitor/device");
    const info = await Device.getBatteryInfo();
    if (typeof info.batteryLevel === "number" && !Number.isNaN(info.batteryLevel)) {
      return Math.round(info.batteryLevel * 100);
    }
  } catch {
    // plugin/web API unavailable
  }
  return null;
}

function mapConnection(connected: boolean, type?: string): NetworkType {
  if (!connected) return "offline";
  if (type === "wifi") return "wifi";
  if (type === "cellular") return "mobile_data";
  return "unknown";
}

/** Current network type. */
export async function readNetworkType(): Promise<NetworkType> {
  try {
    const { Network } = await import("@capacitor/network");
    const status = await Network.getStatus();
    return mapConnection(status.connected, status.connectionType);
  } catch {
    if (typeof navigator !== "undefined") {
      return navigator.onLine ? "mobile_data" : "offline";
    }
    return "unknown";
  }
}

/**
 * Subscribe to live network changes. Returns an unsubscribe function. On the web
 * the plugin bridges to the browser's online/offline events.
 */
export async function subscribeNetwork(cb: (t: NetworkType) => void): Promise<() => void> {
  try {
    const { Network } = await import("@capacitor/network");
    const handle = await Network.addListener("networkStatusChange", (status) => {
      cb(mapConnection(status.connected, status.connectionType));
    });
    return () => {
      void handle.remove();
    };
  } catch {
    return () => {};
  }
}
