"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";

// MapReadOnly uses react-leaflet which calls `window` at module-init.
// Render it on the client only to avoid SSR ReferenceErrors.
const MapReadOnly = dynamic(
  () => import("@/components/geo/GeofenceMap").then((m) => m.MapReadOnly),
  {
    ssr: false,
    loading: () => <div className="h-[250px] w-full rounded-md border bg-muted animate-pulse" />
  }
);

export default function SitesPage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/assignments").then((r) => r.json()),
      fetch("/api/sites").then((r) => r.json()),
    ])
      .then(([a, s]) => {
        if (a.ok) setAssignments(a.data.assignments || []);
        if (s.ok) setSites(s.data.sites || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><CardContent className="p-6">Loading...</CardContent></Card>;

  const assignedSiteIds = new Set(assignments.map((a) => String(a.siteId)));
  const mySites = sites.filter((s) => assignedSiteIds.has(String(s._id)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My work sites</h1>

      {mySites.length === 0 ? (
        <Card><CardContent className="p-6">No sites assigned yet.</CardContent></Card>
      ) : (
        mySites.map((site) => (
          <Card key={site._id}>
            <CardHeader>
              <CardTitle>{site.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {site.address && <p className="text-sm text-muted-foreground mb-2">{site.address}</p>}
              <MapReadOnly
                lat={site.location.coordinates[1]}
                lng={site.location.coordinates[0]}
                radiusMeters={site.radiusMeters}
                height={250}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}