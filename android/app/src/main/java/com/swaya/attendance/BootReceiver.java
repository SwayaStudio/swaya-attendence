package com.swaya.attendance;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/**
 * On device reboot, if the employee was checked in (flag stored by the web app
 * via @capacitor/preferences), post a notification prompting them to reopen the
 * app so location tracking resumes. Modern Android restricts silently launching
 * apps / foreground services from BOOT_COMPLETED, so a tap-to-resume prompt is
 * the reliable approach.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            return;
        }

        // @capacitor/preferences stores values in the "CapacitorStorage" prefs file.
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String checkedIn = prefs.getString("checkedIn", "false");
        if (!"true".equals(checkedIn)) {
            return;
        }

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            return;
        }

        String channelId = "attendance_boot";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId, "Attendance", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
        }

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pi = PendingIntent.getActivity(context, 0, launch, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Resume attendance tracking")
            .setContentText("Your phone restarted. Tap to reopen and resume location tracking.")
            .setAutoCancel(true)
            .setContentIntent(pi);

        nm.notify(1001, builder.build());
    }
}
