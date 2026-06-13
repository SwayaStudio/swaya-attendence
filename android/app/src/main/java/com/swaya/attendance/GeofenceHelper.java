package com.swaya.attendance;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.tasks.Task;

import java.util.Collections;

/**
 * Shared geofence registration logic, used by both the Capacitor plugin (when the
 * app is open) and the BootReceiver (to re-register after a reboot, since Android
 * drops geofences on reboot). Caller is responsible for the location permission.
 */
public final class GeofenceHelper {
    public static final String GEOFENCE_ID = "swaya-site";
    public static final String ACTION = "com.swaya.attendance.GEOFENCE_EVENT";

    private GeofenceHelper() {}

    static PendingIntent pendingIntent(Context ctx) {
        Intent intent = new Intent(ctx, GeofenceBroadcastReceiver.class);
        intent.setAction(ACTION);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        // Geofencing requires a MUTABLE PendingIntent on Android 12+ (the OS adds
        // the transition extras to it).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        return PendingIntent.getBroadcast(ctx, 0, intent, flags);
    }

    @SuppressLint("MissingPermission")
    static Task<Void> register(Context ctx, double lat, double lng, float radiusMeters) {
        Geofence geofence = new Geofence.Builder()
            .setRequestId(GEOFENCE_ID)
            .setCircularRegion(lat, lng, radiusMeters)
            .setExpirationDuration(Geofence.NEVER_EXPIRE)
            .setTransitionTypes(
                Geofence.GEOFENCE_TRANSITION_ENTER | Geofence.GEOFENCE_TRANSITION_EXIT)
            .build();

        GeofencingRequest request = new GeofencingRequest.Builder()
            // Fire immediately if the employee is already inside at registration.
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofence(geofence)
            .build();

        return LocationServices.getGeofencingClient(ctx)
            .addGeofences(request, pendingIntent(ctx));
    }

    static Task<Void> remove(Context ctx) {
        return LocationServices.getGeofencingClient(ctx)
            .removeGeofences(Collections.singletonList(GEOFENCE_ID));
    }
}
