"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { MapPin, Plus, Trash2 } from "lucide-react";

// Leaflet is window-dependent — load only on the client.
const GeofenceMap = dynamic(
  () => import("@/components/geo/GeofenceMap").then((m) => m.GeofenceMap),
  { ssr: false, loading: () => <div className="h-[400px] grid place-items-center">Loading map…</div> }
);

const MapReadOnly = dynamic(
  () => import("@/components/geo/GeofenceMap").then((m) => m.MapReadOnly),
  { ssr: false, loading: () => <div className="h-[200px] grid place-items-center">…</div> }
);

export default function SitesPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    address: "",
    lat: 12.971599,
    lng: 77.594566,
    radiusMeters: 150,
  });

  const load = async () => {
    const res = await fetch("/api/sites");
    const json = await res.json();
    if (json.ok) setSites(json.data.sites || []);
  };
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setLoading(true);
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const json = await res.json();
    setLoading(false);
    if (json.ok) {
      toast({ title: "Site created" });
      setOpen(false);
      setDraft({ name: "", address: "", lat: 12.971599, lng: 77.594566, radiusMeters: 150 });
      load();
    } else {
      toast({ title: "Failed", description: json.error, variant: "destructive" });
    }
  }

  async function remove(id: string) {
    if (!confirm("Deactivate this site?")) return;
    const res = await fetch(`/api/sites/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.ok) {
      toast({ title: "Site deactivated" });
      load();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Work sites</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New site</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New work site</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div>
                <Label>Address</Label>
                <Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={draft.lat}
                    onChange={(e) => setDraft({ ...draft, lat: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={draft.lng}
                    onChange={(e) => setDraft({ ...draft, lng: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Radius (meters)</Label>
                <Input
                  type="number"
                  value={draft.radiusMeters}
                  onChange={(e) => setDraft({ ...draft, radiusMeters: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Click on the map to set the center, or drag the marker.</Label>
                <GeofenceMap
                  value={{ lat: draft.lat, lng: draft.lng, radiusMeters: draft.radiusMeters }}
                  onChange={(v) => setDraft({ ...draft, lat: v.lat, lng: v.lng, radiusMeters: v.radiusMeters })}
                  height={300}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={loading || !draft.name}>
                {loading ? "Saving…" : "Save site"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sites.length === 0 ? (
        <Card><CardContent className="p-6">No sites yet. Click &quot;New site&quot; to create one.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sites.map((s) => (
            <Card key={s._id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    {s.address && <p className="text-sm text-muted-foreground">{s.address}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(s._id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm flex items-center gap-2 text-muted-foreground mb-2">
                  <MapPin className="h-3 w-3" />
                  {s.location.coordinates[1].toFixed(5)}, {s.location.coordinates[0].toFixed(5)} · {s.radiusMeters}m
                </p>
                <MapReadOnly
                  lat={s.location.coordinates[1]}
                  lng={s.location.coordinates[0]}
                  radiusMeters={s.radiusMeters}
                  height={200}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}