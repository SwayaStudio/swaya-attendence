"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

/**
 * A stable-ish device id for this browser. Uses the Web Crypto API (available in
 * browsers and the Android WebView) and persists it in localStorage. Never
 * imports the Node `crypto` module, which would fail to bundle on the client.
 */
function getDeviceId(): string {
  if (typeof window === "undefined") return "web";
  try {
    const KEY = "geo-attendance-device-id";
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      const rand =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10);
      id = "web-" + rand;
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "web-" + Math.random().toString(36).slice(2, 10);
  }
}

/** H:MM:SS — used for the live, ticking work timer. */
function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h}:${pad(m)}:${pad(sec)}`;
}

type TodayState = {
  day: any;
  sessions: any[];
  site: any;
  schedule?: any;
  shift?: any;
  leave?: any;
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
  const [nowTs, setNowTs] = useState(0);

  const loadSeq = useRef(0);
  const loadToday = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const res = await fetch("/api/attendance/today");
      const json = await res.json();
      // Ignore a response that a newer request has already superseded.
      if (seq !== loadSeq.current) return;
      if (json.ok) setToday(json.data);
    } catch {
      /* network error — keep last good state, next poll retries */
    }
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
      const bat = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.()
        .then((b) => b.level)
        .catch(() => undefined);
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
          deviceId: getDeviceId(),
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

  const handleAutoCheckout = useCallback(() => {
    toast({
      title: "Checked out automatically",
      description: "You left the work site, so your session was closed.",
    });
    setTracking(false);
    loadToday();
  }, [loadToday]);

  const status = today?.day?.status || "pending";
  const site = today?.site;
  const currentSession = today?.sessions?.[0];
  // "Checked in" means a session is still open — not the day's overall status,
  // which stays "present"/"late" even after the employee checks out.
  const isCheckedIn = !!today?.sessions?.some(
    (s: any) => s.status === "active" || s.status === "flagged"
  );
  // A scheduled non-working day (weekly off / company holiday) — no check-in needed.
  const isDayOff = today?.schedule != null && today.schedule.isWorkingDay === false;
  // An approved leave covering today — also no check-in needed.
  const isOnLeave = today?.leave != null;
  const noCheckInNeeded = isOnLeave || isDayOff;

  // While checked in: tick the work timer every second, and re-fetch the day
  // every 15s so the (server-computed) outside time stays current.
  useEffect(() => {
    if (!isCheckedIn) return;
    setNowTs(Date.now());
    const tick = setInterval(() => setNowTs(Date.now()), 1000);
    const poll = setInterval(() => loadToday(), 15000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [isCheckedIn, loadToday]);

  const activeSession = today?.sessions?.find(
    (s: any) => s.status === "active" || s.status === "flagged"
  );
  // Sum of already-completed sessions today (so work time is cumulative, not just
  // the current session).
  const completedWorkSeconds = (today?.sessions || []).reduce((acc: number, s: any) => {
    if (!s.checkOutAt) return acc;
    return acc + Math.max(0, Math.floor((new Date(s.checkOutAt).getTime() - new Date(s.checkInAt).getTime()) / 1000));
  }, 0);
  // Work time = completed sessions + the open session ticking live; falls back to
  // the stored cumulative total when not checked in.
  const liveWorkSeconds =
    isCheckedIn && activeSession?.checkInAt && nowTs
      ? completedWorkSeconds + Math.max(0, Math.floor((nowTs - new Date(activeSession.checkInAt).getTime()) / 1000))
      : today?.day?.totalWorkSeconds || 0;

  return (
    <div className="space-y-6">
      <LocationTracker active={isCheckedIn} onAutoCheckout={handleAutoCheckout} />
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
          {site && Array.isArray(site.location?.coordinates) && (
            <LiveTrackerMap
              siteLat={site.location.coordinates[1]}
              siteLng={site.location.coordinates[0]}
              radiusMeters={site.radiusMeters}
              currentLat={lastLat}
              currentLng={lastLng}
              height={250}
            />
          )}

          {noCheckInNeeded && !isCheckedIn ? (
            <div className="rounded-md border bg-muted p-4 text-center">
              <p className="font-medium">{isOnLeave ? "On leave" : "Day off"}</p>
              <p className="text-sm text-muted-foreground">
                {isOnLeave
                  ? `You're on approved ${today?.leave?.leaveType || ""} leave today — no check-in required.`
                  : "Today is a weekly off or company holiday — no check-in required."}
              </p>
            </div>
          ) : !isCheckedIn ? (
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
                <p>{formatTime(currentSession.checkInAt)}</p>
              </div>
              {today?.day?.lastCheckOutAt && (
                <div>
                  <Label className="text-muted-foreground">Check-out</Label>
                  <p>{formatTime(today.day.lastCheckOutAt)}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Work time</Label>
                <p className={isCheckedIn ? "tabular-nums" : undefined}>
                  {isCheckedIn ? formatHMS(liveWorkSeconds) : formatDuration(liveWorkSeconds)}
                </p>
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