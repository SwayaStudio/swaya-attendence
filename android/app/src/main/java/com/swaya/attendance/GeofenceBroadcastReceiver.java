package com.swaya.attendance;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.util.Log;

import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Receives OS geofence ENTER/EXIT transitions — fires even when the app is killed
 * or after reboot — and POSTs them to /api/geofence-event using the native token
 * stored by the web app (@capacitor/preferences -> "CapacitorStorage"). No
 * WebView/JavaScript is involved.
 */
public class GeofenceBroadcastReceiver extends BroadcastReceiver {
    private static final String TAG = "GeofenceReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        GeofencingEvent event = GeofencingEvent.fromIntent(intent);
        if (event == null || event.hasError()) {
            return;
        }

        int transition = event.getGeofenceTransition();
        final String transitionName;
        if (transition == Geofence.GEOFENCE_TRANSITION_ENTER) {
            transitionName = "ENTER";
        } else if (transition == Geofence.GEOFENCE_TRANSITION_EXIT) {
            transitionName = "EXIT";
        } else {
            return;
        }

        Location loc = event.getTriggeringLocation();
        final double lat = loc != null ? loc.getLatitude() : 0;
        final double lng = loc != null ? loc.getLongitude() : 0;
        final float accuracy = loc != null ? loc.getAccuracy() : 0;

        SharedPreferences prefs =
            context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        final String token = prefs.getString("geofence_token", null);
        final String baseUrl = prefs.getString("geofence_url", null);
        if (token == null || baseUrl == null) {
            Log.w(TAG, "no token/url stored — skipping geofence post");
            return;
        }

        // Network I/O must not run on the main thread; keep the broadcast alive.
        final PendingResult pending = goAsync();
        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                JSONObject body = new JSONObject();
                body.put("token", token);
                body.put("transition", transitionName);
                body.put("lat", lat);
                body.put("lng", lng);
                body.put("accuracy", accuracy);
                body.put("capturedAt", isoNow());

                URL url = new URL(baseUrl + "/api/geofence-event");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setDoOutput(true);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
                int code = conn.getResponseCode();
                Log.d(TAG, "geofence-event " + transitionName + " -> HTTP " + code);
            } catch (Exception e) {
                Log.e(TAG, "geofence post failed", e);
            } finally {
                if (conn != null) conn.disconnect();
                pending.finish();
            }
        }).start();
    }

    private static String isoNow() {
        SimpleDateFormat f =
            new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }
}
