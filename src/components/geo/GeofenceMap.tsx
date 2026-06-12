"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
// leaflet/dist/leaflet.css is loaded once from src/app/layout.tsx

// A self-contained SVG pin (no external image / CDN), so the marker always
// renders in the Android WebView even when the marker-image CDN is blocked.
const sitePinIcon = L.divIcon({
  className: "",
  html: `<svg width="26" height="38" viewBox="0 0 26 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 25 13 25s13-15.25 13-25C26 5.82 20.18 0 13 0z" fill="#2563eb"/>
    <circle cx="13" cy="13" r="5" fill="#ffffff"/>
  </svg>`,
  iconSize: [26, 38],
  iconAnchor: [13, 38],
});

export type GeofenceValue = {
  lat: number;
  lng: number;
  radiusMeters: number;
};

type Props = {
  value: GeofenceValue;
  onChange: (v: GeofenceValue) => void;
  height?: number | string;
  zoom?: number;
};

function ClickToSetCenter({ onSet }: { onSet: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onSet(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RecenterOn({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], zoom);
    }
  }, [lat, lng, zoom, map]);
  return null;
}

/** Leaflet throws on NaN/Infinity — coerce any invalid number to a safe default. */
function num(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function GeofenceMap({ value, onChange, height = 400, zoom = 14 }: Props) {
  const safeLat = num(value.lat, 0);
  const safeLng = num(value.lng, 0);
  // Radius 0 renders nothing but never crashes; clamp out NaN/negatives.
  const safeRadius = Math.max(0, num(value.radiusMeters, 0));
  const center: [number, number] = [safeLat, safeLng];
  const [editable] = useState(true);

  return (
    <div style={{ height, width: "100%" }} className="rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterOn lat={safeLat} lng={safeLng} zoom={zoom} />
        <Marker
          position={center}
          icon={sitePinIcon}
          draggable={editable}
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const pos = m.getLatLng();
              onChange({ ...value, lat: pos.lat, lng: pos.lng });
            },
          }}
        />
        <Circle
          center={center}
          radius={safeRadius}
          pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15 }}
        />
        <ClickToSetCenter
          onSet={(lat, lng) => onChange({ ...value, lat, lng })}
        />
      </MapContainer>
    </div>
  );
}

export function MapReadOnly({ lat, lng, radiusMeters, height = 300 }: { lat: number; lng: number; radiusMeters: number; height?: number | string }) {
  const safeLat = num(lat, 0);
  const safeLng = num(lng, 0);
  const safeRadius = Math.max(0, num(radiusMeters, 0));
  return (
    <div style={{ height, width: "100%" }} className="rounded-md overflow-hidden border">
      <MapContainer center={[safeLat, safeLng]} zoom={15} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[safeLat, safeLng]} icon={sitePinIcon} />
        <Circle center={[safeLat, safeLng]} radius={safeRadius} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15 }} />
      </MapContainer>
    </div>
  );
}