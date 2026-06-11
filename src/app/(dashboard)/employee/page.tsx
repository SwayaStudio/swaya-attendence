"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { formatDuration, formatTime } from "@/lib/utils";
import dynamic from "next/dynamic";
import { LocationTracker } from "@/components/geo/LocationTracker";
import {
  CheckCircle2,
  XCircle,
  MapPin,
  Clock,
  Battery,
  Wifi,
  Loader2,
} from "lucide-react";

// LiveTrackerMap uses react-leaflet which calls `window` at module-init.
// Render it on the client only to avoid SSR ReferenceErrors.
const LiveTrackerMap = dynamic(
  () => import("@/components/geo/LiveTrackerMap").then((m) => m.LiveTrackerMap),
  { ssr: false, loading: () => <div className="h-[250px] w-full rounded-md border bg-muted animate-pulse" /> }
);

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

type TodayState = {
  day: any;
  sessions: any[];
  site: any;
};

export default function EmployeePage() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState<TodayState | null>(null);
  const [lastLat, setLastLat] = useState<number | null>(null);
  const [lastLng, setLastLng] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [network, setNetwork] = useState<string>("unknown");
  const [tracking, setTracking] = useState(false);

  const loadToday = useCallback(async () => {
    const res = await fetch("/api/attendance/today");
    const json = await res.json();
    if (json.ok) setToday(json.data);
  }, []);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const pos = await getPosition();
      const coords = pos.coords;
      setLastLat(coords.latitude);
      setLastLng(coords.longitude);

      // battery
      const bat = (await navigator.getBattery())?.level;
      setBattery(bat != null ? Math.round(bat * 100) : null);
      setNetwork(navigator.onLine ? "mobile_data" : "offline");

      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          isMockLocation: false,
          deviceId: "web-" + (await import("crypto")).randomUUID?.()?.slice(0, 8) || Date.now(),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: "Check-in failed", description: json.error, variant: "destructive" });
        return;
      }
      toast({ title: "Checked in at " + json.data.site.name });
      setTracking(true);
      loadToday();
    } catch (e: any) {
      toast({ title: "Location error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    try {
      const pos = await getPosition();
      const coords = pos.coords;
      setLastLat(coords.latitude);
      setLastLng(coords.longitude);

      const res = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast({ title: "Check-out failed", description: json.error, variant: "destructive" });
        return;
      }
      toast({ title: "Checked out successfully" });
      setTracking(false);
      loadToday();
    } catch (e: any) {
      toast({ title: "Location error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const status = today?.day?.status || "pending";
  const isCheckedIn = status === "present" || status === "late";
  const site = today?.site;
  const currentSession = today?.sessions?.[0];

  return (
    <div className="space-y-6">
      <LocationTracker active={isCheckedIn} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Today</h1>
        <Badge variant={status === "present" ? "success" : status === "late" ? "warning" : "secondary"}>
          {status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
          <CardDescription>{site?.name || "No site assigned"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {site && (
            <LiveTrackerMap
              siteLat={site.location.coordinates[1]}
              siteLng={site.location.coordinates[0]}
              radiusMeters={site.radiusMeters}
              currentLat={lastLat}
              currentLng={lastLng}
              height={250}
            />
          )}

          {!isCheckedIn ? (
            <Button className="w-full gap-2" size="lg" onClick={handleCheckIn} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-5 w-5" />
              Check in
            </Button>
          ) : (
            <Button className="w-full gap-2" variant="destructive" size="lg" onClick={handleCheckOut} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <XCircle className="h-5 w-5" />
              Check out
            </Button>
          )}

          {/* Session info */}
          {currentSession && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Check-in</Label>
                <p>{formatTime(session.checkInAt)}</p>
              </div>
              {today?.day?.lastCheckOutAt && (
                <div>
                  <Label className="text-muted-foreground">Check-out</Label>
                  <p>{formatTime(today.day.lastCheckOutAt)}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Work time</Label>
                <p>{formatDuration(today?.day?.totalWorkSeconds || 0)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Outside</Label>
                <p>{formatDuration(today?.day?.totalOutsideSeconds || 0)}</p>
              </div>
            </div>
          )}

          {/* Device status */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Battery className="h-3 w-3" /> {battery ?? "—"}%
            </span>
            <span className="flex items-center gap-1">
              <Wifi className="h-3 w-3" /> {network}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* History summary */}
      <Card>
        <CardHeader>
          <CardTitle>Recent days</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View your attendance history on the <a href="/employee/history" className="text-primary underline">history page</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}