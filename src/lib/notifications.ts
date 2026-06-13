/**
 * Local (on-device) notifications via @capacitor/local-notifications.
 *
 * Used to tell an employee they were auto-checked-out, even when the app is in
 * the background or closed (the tracking foreground service keeps JS alive to
 * fire it). On the web the plugin falls back to the browser Notifications API;
 * if unavailable it's a silent no-op.
 */

/** Notify the employee that they've been checked out and should check in again. */
export async function notifyCheckedOut(): Promise<void> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    // Make sure we're allowed to post notifications.
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") {
      perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2_000_000_000),
          title: "You've been checked out",
          body: "You left the work site or your shift ended. Please check in again if you're still working.",
        },
      ],
    });
  } catch {
    // Plugin not available (e.g. plain browser without permission) — ignore.
  }
}
