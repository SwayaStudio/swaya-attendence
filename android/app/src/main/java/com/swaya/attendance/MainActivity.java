package com.swaya.attendance;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register the local native geofence plugin before the bridge starts.
        registerPlugin(GeofencePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
