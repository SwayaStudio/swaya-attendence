"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
// leaflet/dist/leaflet.css is loaded once from src/app/layout.tsx

// Fix default marker icons (Leaflet's default markers are broken in bundlers).
if (typeof window !== "undefined") {
  // @ts-expect-error -- delete is fine
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

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
    map.setView([lat, lng], zoom);
  }, [lat, lng, zoom, map]);
  return null;
}

export function GeofenceMap({ value, onChange, height = 400, zoom = 14 }: Props) {
  const center: [number, number] = [value.lat, value.lng];
  const [editable] = useState(true);

  return (
    <div style={{ height, width: "100%" }} className="rounded-md overflow-hidden border">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterOn lat={value.lat} lng={value.lng} zoom={zoom} />
        <Marker
          position={center}
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
          radius={value.radiusMeters}
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
  return (
    <div style={{ height, width: "100%" }} className="rounded-md overflow-hidden border">
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} />
        <Circle center={[lat, lng]} radius={radiusMeters} pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15 }} />
      </MapContainer>
    </div>
  );
}