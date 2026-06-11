"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
// leaflet/dist/leaflet.css is loaded once from src/app/layout.tsx

export function LiveTrackerMap({
  siteLat,
  siteLng,
  radiusMeters,
  currentLat,
  currentLng,
  height = 300,
}: {
  siteLat: number;
  siteLng: number;
  radiusMeters: number;
  currentLat?: number | null;
  currentLng?: number | null;
  height?: number | string;
}) {
  // Make sure leaflet css loaded
  return (
    <div style={{ height, width: "100%" }} className="rounded-md overflow-hidden border">
      <MapContainer center={[siteLat, siteLng]} zoom={15} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[siteLat, siteLng]} />
        <Circle
          center={[siteLat, siteLng]}
          radius={radiusMeters}
          pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15 }}
        />
        {currentLat != null && currentLng != null && (
          <Marker
            position={[currentLat, currentLng]}
            icon={L.divIcon({
              className: "",
              html: `<div style="width:18px;height:18px;border-radius:9999px;background:#ef4444;border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.3);"></div>`,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            })}
          />
        )}
      </MapContainer>
    </div>
  );
}