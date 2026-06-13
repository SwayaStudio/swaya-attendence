package com.swaya.attendance;

import android.Manifest;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * JS bridge for the native OS geofence. Called from the web app (while it's open)
 * to register/remove a ~100m geofence around the work site. Once registered, the
 * OS fires ENTER/EXIT to GeofenceBroadcastReceiver even after the app is killed.
 */
@CapacitorPlugin(name = "GeofenceTracker")
public class GeofencePlugin extends Plugin {

    @PluginMethod
    public void addGeofence(PluginCall call) {
        Double lat = call.getDouble("lat");
        Double lng = call.getDouble("lng");
        Double radius = call.getDouble("radius", 100.0);
        if (lat == null || lng == null) {
            call.reject("lat and lng are required");
            return;
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            call.reject("location_permission_not_granted");
            return;
        }
        try {
            GeofenceHelper.register(getContext(), lat, lng, radius.floatValue())
                .addOnSuccessListener(unused -> call.resolve())
                .addOnFailureListener(e -> call.reject("add_geofence_failed: " + e.getMessage()));
        } catch (Exception e) {
            call.reject("add_geofence_exception: " + e.getMessage());
        }
    }

    @PluginMethod
    public void removeGeofence(PluginCall call) {
        try {
            GeofenceHelper.remove(getContext())
                .addOnSuccessListener(unused -> call.resolve())
                .addOnFailureListener(e -> call.reject(e.getMessage()));
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
