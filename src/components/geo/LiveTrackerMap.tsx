"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
// leaflet/dist/leaflet.css is loaded once from src/app/layout.tsx

// A self-contained SVG pin (no external image), so it always renders in the
// Android WebView even if the marker-image CDN is blocked or offline.
const sitePinIcon = L.divIcon({
  className: "",
  html: `<svg width="26" height="38" viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 25 13 25s13-15.25 13-25C26 5.82 20.18 0 13 0z" fill="#2563eb"/>
    <circle cx="13" cy="13" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [26, 38],
  iconAnchor: [13, 38],
});

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
        <Marker position={[siteLat, siteLng]} icon={sitePinIcon} />
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