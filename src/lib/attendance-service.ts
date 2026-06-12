/**
 * Server-side attendance business logic.
 * Pure functions over the data — no Express, no Next specifics.
 */
import { Types } from "mongoose";
import { connectDB } from "./db";
import {
  AttendanceDay,
  AttendanceSession,
  EmployeeSchedule,
  EmployeeSiteAssignment,
  GeofenceEvent,
  LocationPing,
  OutsideSiteLog,
  ShiftTemplate,
  WorkSite,
} from "@/models";
import { haversineDistanceMeters, isInsideGeofence } from "./geo";
import { todayWorkDate, isWithinLocalTimeWindow } from "./workdate";
import { getCompanyTimezone } from "./company";
import { flagPings, type PingLike } from "./attendance";
import { env } from "./env";

export type CheckInInput = {
  employeeId: string;
  companyId: string;
  timezone: string;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  isMockLocation?: boolean;
  deviceId: string;
  appVersion?: string;
  appState?: "foreground" | "background" | "killed" | "unknown";
  networkType?: "wifi" | "mobile_data" | "offline" | "unknown";
  batteryPercentage?: number;
};

export type CheckInResult =
  | { ok: true; attendanceDay: any; session: any; site: any }
  | { ok: false; reason: string; nearestSite?: any; distance?: number };

/**
 * Find the work site the employee is currently inside.
 * Considers all active assignments, then any site the user is within radius of.
 */
export async function findSiteForCheckIn(opts: {
  companyId: string;
  employeeId: string;
  lat: number;
  lng: number;
  accuracyMeters?: number;
}) {
  await connectDB();
  const assignments = await EmployeeSiteAssignment.find({
    companyId: new Types.ObjectId(opts.companyId),
    employeeId: new Types.ObjectId(opts.employeeId),
    isActive: true,
  }).lean();

  if (assignments.length === 0) return null;

  const sites = await WorkSite.find({
    _id: { $in: assignments.map((a: { siteId: unknown }) => a.siteId) },
    isActive: true,
  }).lean();

  // pick the site where the user is inside
  let bestInside: { site: any; distance: number } | null = null;
  let bestOverall: { site: any; distance: number } | null = null;
  for (const s of sites) {
    const [lng, lat] = s.location.coordinates;
    const { distance } = isInsideGeofence(
      { lat: opts.lat, lng: opts.lng },
      { lat, lng },
      s.radiusMeters,
      opts.accuracyMeters ?? 0
    );
    if (!bestOverall || distance < bestOverall.distance) {
      bestOverall = { site: s, distance };
    }
    if (
      distance <= s.radiusMeters + (opts.accuracyMeters ?? 0) &&
      (!bestInside || distance < bestInside.distance)
    ) {
      bestInside = { site: s, distance };
    }
  }
  return bestInside || bestOverall;
}

export async function processCheckIn(input: CheckInInput): Promise<CheckInResult> {
  await connectDB();
  // Enforce scheduled shift hours (when the employee has a schedule for today).
  const gate = await scheduleGate(input.employeeId, todayWorkDate(input.timezone));
  if (!gate.ok) return { ok: false, reason: gate.reason };

  const found = await findSiteForCheckIn(input);
  if (!found) {
    return { ok: false, reason: "no_assignment" };
  }
  if (found.distance > found.site.radiusMeters + (input.accuracyMeters ?? 0)) {
    return {
      ok: false,
      reason: "outside_geofence",
      nearestSite: found.site,
      distance: found.distance,
    };
  }

  // Server-side mock-location check
  const lastPing = await LocationPing.findOne({
    employeeId: new Types.ObjectId(input.employeeId),
  })
    .sort({ capturedAt: -1 })
    .lean();
  if (lastPing && !input.isMockLocation) {
    const dist = haversineDistanceMeters(
      { lat: lastPing.location.coordinates[1], lng: lastPing.location.coordinates[0] },
      { lat: input.lat, lng: input.lng }
    );
    const dtSec = (Date.now() - new Date(lastPing.capturedAt).getTime()) / 1000;
    if (dtSec > 1) {
      const speed = (dist / dtSec) * 3.6;
      if (speed > env.MOCK_LOCATION_SPEED_KMH) {
        input.isMockLocation = true; // server-side flagged
      }
    }
  }

  const workDate = todayWorkDate(input.timezone);

  // Upsert attendance day
  const day = await AttendanceDay.findOneAndUpdate(
    {
      employeeId: new Types.ObjectId(input.employeeId),
      workDate,
    },
    {
      $setOnInsert: {
        companyId: new Types.ObjectId(input.companyId),
        siteId: found.site._id,
        workDate,
        status: "pending",
      },
      $set: { isFlagged: false },
    },
    { upsert: true, new: true }
  );

  // Optional: lookup schedule for the day
  const schedule = await EmployeeSchedule.findOne({
    employeeId: new Types.ObjectId(input.employeeId),
    workDate,
  }).lean();

  // Create session
  const session = await AttendanceSession.create({
    attendanceDayId: day._id,
    companyId: new Types.ObjectId(input.companyId),
    employeeId: new Types.ObjectId(input.employeeId),
    siteId: found.site._id,
    checkInAt: new Date(),
    checkInLocation: { type: "Point", coordinates: [input.lng, input.lat] },
    checkInAccuracyMeters: input.accuracyMeters,
    checkInDistanceMeters: found.distance,
    status: input.isMockLocation ? "flagged" : "active",
    deviceId: input.deviceId,
    appVersion: input.appVersion,
  });

  // First ping
  await LocationPing.create({
    attendanceDayId: day._id,
    sessionId: session._id,
    companyId: new Types.ObjectId(input.companyId),
    employeeId: new Types.ObjectId(input.employeeId),
    siteId: found.site._id,
    capturedAt: new Date(),
    location: { type: "Point", coordinates: [input.lng, input.lat] },
    accuracyMeters: input.accuracyMeters,
    distanceFromSiteMeters: found.distance,
    isInsideGeofence: true,
    isMockLocation: input.isMockLocation ?? false,
    isGpsEnabled: true,
    batteryPercentage: input.batteryPercentage,
    networkType: input.networkType ?? "unknown",
    appState: input.appState ?? "unknown",
  });

  // Geofence event: entered_site
  await GeofenceEvent.create({
    attendanceDayId: day._id,
    sessionId: session._id,
    companyId: new Types.ObjectId(input.companyId),
    employeeId: new Types.ObjectId(input.employeeId),
    siteId: found.site._id,
    eventType: "entered_site",
    eventAt: new Date(),
    location: { type: "Point", coordinates: [input.lng, input.lat] },
    accuracyMeters: input.accuracyMeters,
    distanceFromSiteMeters: found.distance,
  });

  // Update day
  day.firstCheckInAt = day.firstCheckInAt ?? new Date();
  if (schedule) {
    day.scheduleId = schedule._id;
    if (schedule.expectedStartAt) {
      const graceMin = await getGraceMinutesForSchedule(schedule);
      const lateMs = new Date().getTime() - new Date(schedule.expectedStartAt).getTime();
      if (lateMs > graceMin * 60_000) {
        day.lateByMinutes = Math.floor(lateMs / 60_000);
        day.status = "late";
      } else {
        day.status = "present";
      }
    } else {
      day.status = "present";
    }
  } else {
    day.status = "present";
  }
  if (input.isMockLocation) {
    day.isFlagged = true;
    day.flagReasons = Array.from(new Set([...(day.flagReasons || []), "mock_location_at_check_in"]));
  }
  await day.save();

  return {
    ok: true,
    attendanceDay: day.toObject(),
    session: session.toObject(),
    site: found.site,
  };
}

async function getGraceMinutesForSchedule(schedule: any): Promise<number> {
  if (!schedule?.shiftTemplateId) return 0;
  const tpl = await ShiftTemplate.findById(schedule.shiftTemplateId).lean();
  return tpl?.graceMinutes ?? 0;
}

export async function processCheckOut(opts: {
  employeeId: string;
  companyId: string;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  isMockLocation?: boolean;
  deviceId?: string;
  appVersion?: string;
  timezone: string;
}) {
  await connectDB();
  // Enforce scheduled shift hours (when the employee has a schedule for today).
  const gate = await scheduleGate(opts.employeeId, todayWorkDate(opts.timezone));
  if (!gate.ok) return { ok: false as const, reason: gate.reason };

  const session = await AttendanceSession.findOne({
    employeeId: new Types.ObjectId(opts.employeeId),
    status: { $in: ["active", "flagged"] },
  }).sort({ checkInAt: -1 });
  if (!session) return { ok: false as const, reason: "no_active_session" };

  const { day } = await finalizeSession({
    session,
    lat: opts.lat,
    lng: opts.lng,
    accuracyMeters: opts.accuracyMeters,
    checkOutAt: new Date(),
    status: opts.isMockLocation ? "flagged" : "completed",
  });
  return { ok: true as const, session, day };
}

/**
 * Close out an attendance session and roll its summary up to the day.
 * Shared by manual check-out and the automatic geofence-exit check-out.
 * `checkOutAt` is the effective end time (for auto check-out this is the
 * moment the employee crossed the site boundary, not when we processed it).
 */
async function finalizeSession(opts: {
  session: any;
  lat: number;
  lng: number;
  accuracyMeters?: number;
  checkOutAt: Date;
  status: "completed" | "auto_closed" | "flagged";
  reason?: string;
}) {
  const { session } = opts;

  // Never let a back-dated check-out land before check-in (would yield negative /
  // zeroed durations and corrupt the day totals).
  const checkInMs = new Date(session.checkInAt).getTime();
  const checkOutAt =
    opts.checkOutAt.getTime() < checkInMs ? new Date(checkInMs) : opts.checkOutAt;

  session.checkOutAt = checkOutAt;
  session.checkOutLocation = { type: "Point", coordinates: [opts.lng, opts.lat] };
  session.checkOutAccuracyMeters = opts.accuracyMeters;
  session.status = opts.status;

  // distance from site at check-out
  const [siteLng, siteLat] = (await WorkSite.findById(session.siteId).lean())!.location.coordinates;
  session.checkOutDistanceMeters = haversineDistanceMeters(
    { lat: siteLat, lng: siteLng },
    { lat: opts.lat, lng: opts.lng }
  );
  await session.save();

  // Close any open outside logs as of the check-out time.
  await OutsideSiteLog.updateMany(
    { sessionId: session._id, returnedAt: null },
    { $set: { returnedAt: session.checkOutAt, status: "closed" } }
  );

  // Roll up the WHOLE day across all sessions (cumulative work/inside/outside,
  // including the away-gaps between sessions) — never just this one session.
  const totals = await recomputeDayTotals(session.attendanceDayId);

  const day = await AttendanceDay.findById(session.attendanceDayId);
  if (day) {
    day.lastCheckOutAt = session.checkOutAt;
    day.totalWorkSeconds = totals.totalWorkSeconds;
    day.totalInsideSeconds = totals.totalInsideSeconds;
    day.totalOutsideSeconds = totals.totalOutsideSeconds;
    day.outsideVisitCount = totals.outsideVisitCount;

    const reasons = new Set(day.flagReasons || []);
    if (totals.totalOutsideSeconds > 30 * 60) {
      day.isFlagged = true;
      reasons.add("excessive_outside_time");
    }
    if (opts.reason) {
      reasons.add(opts.reason);
    }
    day.flagReasons = Array.from(reasons);
    if (day.status === "pending") day.status = "present";
    if (day.totalWorkSeconds < 4 * 3600 && day.status === "present") {
      day.status = "half_day";
    }
    await day.save();
  }
  return { ok: true as const, session, day };
}

/**
 * Cumulative totals for a whole attendance day, summed across ALL of its sessions:
 *   work    = Σ (checkOut − checkIn)            [for the open session, up to `nowMs`]
 *   inside  = Σ in-session time inside the geofence
 *   outside = Σ in-session time outside  +  Σ away-gaps (prev checkOut → next checkIn)
 * The "away gap" is the time the employee was fully checked out between sessions.
 */
async function recomputeDayTotals(attendanceDayId: any, nowMs?: number) {
  // One query for the day's sessions and ONE for all of its pings (grouped in
  // memory) — avoids an N+1 of one ping query per session on this hot path.
  const [sessions, allPings] = await Promise.all([
    AttendanceSession.find({ attendanceDayId }).sort({ checkInAt: 1 }).lean(),
    LocationPing.find({ attendanceDayId })
      .select("sessionId capturedAt isInsideGeofence")
      .sort({ capturedAt: 1 })
      .lean(),
  ]);

  const pingsBySession = new Map<string, any[]>();
  for (const p of allPings) {
    const key = String(p.sessionId);
    const arr = pingsBySession.get(key);
    if (arr) arr.push(p);
    else pingsBySession.set(key, [p]);
  }

  let totalWorkSeconds = 0;
  let totalInsideSeconds = 0;
  let totalOutsideSeconds = 0;
  let outsideVisitCount = 0;
  let prevCheckOutMs: number | null = null;

  for (const s of sessions) {
    const startMs = new Date(s.checkInAt).getTime();
    const endMs = s.checkOutAt ? new Date(s.checkOutAt).getTime() : (nowMs ?? Date.now());
    totalWorkSeconds += Math.max(0, Math.floor((endMs - startMs) / 1000));

    const summ = summarizePings(pingsBySession.get(String(s._id)) || [], String(s.siteId), endMs);
    totalInsideSeconds += summ.totalInside;
    totalOutsideSeconds += summ.totalOutside;
    outsideVisitCount += summ.outsideVisitCount;

    // Time spent away between the previous check-out and this check-in counts as outside.
    if (prevCheckOutMs != null) {
      totalOutsideSeconds += Math.max(0, Math.floor((startMs - prevCheckOutMs) / 1000));
      outsideVisitCount += 1;
    }
    prevCheckOutMs = endMs;
  }

  return { totalWorkSeconds, totalInsideSeconds, totalOutsideSeconds, outsideVisitCount };
}

/**
 * Live cumulative day totals (all sessions + away gaps) while a session is open,
 * computed up to "now" so the employee dashboard can show them ticking. Returns
 * null when there is no active session.
 */
export async function liveTotalsForActiveSession(employeeId: string) {
  const session = await AttendanceSession.findOne({
    employeeId: new Types.ObjectId(employeeId),
    status: { $in: ["active", "flagged"] },
  }).sort({ checkInAt: -1 });
  if (!session) return null;
  return recomputeDayTotals(session.attendanceDayId, Date.now());
}

/** The scheduled shift end (UTC) for a session's day, or null if not scheduled. */
async function getShiftEnd(session: any): Promise<Date | null> {
  const day = await AttendanceDay.findById(session.attendanceDayId).lean();
  if (!day) return null;
  const schedule = await EmployeeSchedule.findOne({
    employeeId: session.employeeId,
    workDate: day.workDate,
  }).lean();
  if (!schedule || !schedule.isWorkingDay || !schedule.expectedEndAt) return null;
  return new Date(schedule.expectedEndAt);
}

/** Close one session at its scheduled shift end, storing cumulative day totals. */
async function closeSessionAtShiftEnd(session: any, shiftEnd: Date) {
  const lastPing = await LocationPing.findOne({ sessionId: session._id })
    .sort({ capturedAt: -1 })
    .lean();
  const coords = (lastPing?.location?.coordinates ?? session.checkInLocation?.coordinates ?? [
    0, 0,
  ]) as [number, number];
  await finalizeSession({
    session,
    lat: coords[1],
    lng: coords[0],
    accuracyMeters: lastPing?.accuracyMeters,
    checkOutAt: shiftEnd,
    status: "auto_closed",
    reason: "auto_checkout_shift_ended",
  });
}

/**
 * Sweep all still-open sessions and auto check-out any whose scheduled shift end
 * has already passed. Used by the cron backstop (covers the case where the app
 * was killed and stopped sending pings). Returns how many were closed.
 */
export async function autoCloseEndedShifts(): Promise<number> {
  await connectDB();
  const sessions = await AttendanceSession.find({
    status: { $in: ["active", "flagged"] },
  }).sort({ checkInAt: 1 });
  let closed = 0;
  for (const session of sessions) {
    const shiftEnd = await getShiftEnd(session);
    if (shiftEnd && Date.now() > shiftEnd.getTime()) {
      await closeSessionAtShiftEnd(session, shiftEnd);
      closed++;
    }
  }
  return closed;
}

/**
 * Enforce that check-in / check-out happen within the scheduled shift window.
 * Window = [shift start − grace, shift end]. If no schedule exists for the day,
 * there is no gate. A scheduled non-working day blocks check-in entirely.
 */
async function scheduleGate(
  employeeId: string,
  workDate: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const schedule = await EmployeeSchedule.findOne({
    employeeId: new Types.ObjectId(employeeId),
    workDate,
  }).lean();
  if (!schedule) return { ok: true };
  if (!schedule.isWorkingDay) {
    return { ok: false, reason: "Today is a scheduled day off — no check-in required." };
  }
  if (schedule.expectedStartAt && schedule.expectedEndAt) {
    const shift = await ShiftTemplate.findById(schedule.shiftTemplateId).lean();
    const graceMs = (shift?.graceMinutes ?? 0) * 60_000;
    const start = new Date(schedule.expectedStartAt).getTime() - graceMs;
    const end = new Date(schedule.expectedEndAt).getTime();
    const now = Date.now();
    if (now < start || now > end) {
      return { ok: false, reason: "You can only check in or out during your scheduled shift hours." };
    }
  }
  return { ok: true };
}

function summarizePings(
  pings: any[],
  _siteId: string,
  endTimeMs?: number
): { totalInside: number; totalOutside: number; outsideVisitCount: number } {
  let totalInside = 0;
  let totalOutside = 0;
  let outsideVisitCount = 0;
  let inOutsideRun = false;

  const cap = endTimeMs ?? Date.now();
  for (let i = 0; i < pings.length; i++) {
    const p = pings[i];
    const next = pings[i + 1];
    const inside = !!p.isInsideGeofence;
    // Clamp EVERY interval's end to the session end (checkout / "now"), so pings
    // captured after the effective checkout don't add time and intervals can't be
    // double-counted against the away-gap.
    const rawEnd = next ? new Date(next.capturedAt).getTime() : cap;
    const tEnd = Math.min(rawEnd, cap);
    const dt = Math.max(0, Math.floor((tEnd - new Date(p.capturedAt).getTime()) / 1000));
    if (inside) {
      totalInside += dt;
      if (inOutsideRun) {
        inOutsideRun = false;
      }
    } else {
      totalOutside += dt;
      if (!inOutsideRun) {
        outsideVisitCount++;
        inOutsideRun = true;
      }
    }
  }
  return { totalInside, totalOutside, outsideVisitCount };
}

export async function processPings(opts: {
  employeeId: string;
  companyId: string;
  pings: Array<{
    lat: number;
    lng: number;
    accuracyMeters?: number;
    isMockLocation?: boolean;
    deviceId?: string;
    appVersion?: string;
    appState?: string;
    networkType?: string;
    batteryPercentage?: number;
    capturedAt?: string;
  }>;
}) {
  await connectDB();
  const employeeId = new Types.ObjectId(opts.employeeId);
  const companyId = new Types.ObjectId(opts.companyId);

  const session = await AttendanceSession.findOne({
    employeeId,
    status: { $in: ["active", "flagged"] },
  }).sort({ checkInAt: -1 });
  if (!session) return { ok: false as const, reason: "no_active_session" };

  const site = await WorkSite.findById(session.siteId).lean();
  if (!site) return { ok: false as const, reason: "no_site" };
  const [siteLng, siteLat] = site.location.coordinates;

  // Company timezone (cached) — used to evaluate the lunch-break window.
  const timezone = await getCompanyTimezone(opts.companyId);

  // End-of-shift auto check-out: if the scheduled shift end has already passed,
  // close the session at the shift-end time (storing totals) instead of tracking
  // further. The employee never has to press check-out at the end of the day.
  const shiftEnd = await getShiftEnd(session);
  if (shiftEnd && Date.now() > shiftEnd.getTime()) {
    await closeSessionAtShiftEnd(session, shiftEnd);
    return {
      ok: true as const,
      received: 0,
      autoCheckedOut: true,
      autoCheckoutAt: shiftEnd.toISOString(),
    };
  }

  // Determine previous "inside" state from last ping
  const lastPing = await LocationPing.findOne({ sessionId: session._id })
    .sort({ capturedAt: -1 })
    .lean();
  let currentlyInside = lastPing ? !!lastPing.isInsideGeofence : true;

  const sorted = [...opts.pings].sort(
    (a, b) =>
      new Date(a.capturedAt ?? Date.now()).getTime() -
      new Date(b.capturedAt ?? Date.now()).getTime()
  );

  const flagging: any[] = [];
  let autoCheckedOut = false;
  let autoCheckoutAt: Date | null = null;

  for (const p of sorted) {
    const { inside, distance } = isInsideGeofence(
      { lat: p.lat, lng: p.lng },
      { lat: siteLat, lng: siteLng },
      site.radiusMeters,
      p.accuracyMeters ?? 0
    );
    // Ignore unreliable readings: a ping whose reported GPS accuracy is worse than
    // the configured limit should NOT move the geofence state — otherwise junk
    // readings inflate "outside" time and cause false exits. Carry the last state.
    const reliable =
      p.accuracyMeters == null || p.accuracyMeters <= env.MAX_PING_ACCURACY_METERS;
    const effectiveInside = reliable ? inside : currentlyInside;
    const capturedAt = p.capturedAt ? new Date(p.capturedAt) : new Date();
    await LocationPing.create({
      attendanceDayId: session.attendanceDayId,
      sessionId: session._id,
      companyId,
      employeeId,
      siteId: session.siteId,
      capturedAt,
      location: { type: "Point", coordinates: [p.lng, p.lat] },
      accuracyMeters: p.accuracyMeters,
      distanceFromSiteMeters: distance,
      isInsideGeofence: effectiveInside,
      isMockLocation: p.isMockLocation ?? false,
      isGpsEnabled: true,
      batteryPercentage: p.batteryPercentage,
      networkType: (p.networkType as any) ?? "unknown",
      appState: (p.appState as any) ?? "unknown",
    });
    // Geofence event on transition
    if (effectiveInside !== currentlyInside) {
      await GeofenceEvent.create({
        attendanceDayId: session.attendanceDayId,
        sessionId: session._id,
        companyId,
        employeeId,
        siteId: session.siteId,
        eventType: effectiveInside ? "entered_site" : "exited_site",
        eventAt: capturedAt,
        location: { type: "Point", coordinates: [p.lng, p.lat] },
        accuracyMeters: p.accuracyMeters,
        distanceFromSiteMeters: distance,
      });
      if (effectiveInside) {
        // close any open outside log
        const openLog = await OutsideSiteLog.findOne({
          sessionId: session._id,
          returnedAt: null,
        })
          .sort({ exitedAt: -1 })
          .lean();
        if (openLog) {
          const durationSeconds = Math.max(
            0,
            Math.floor((capturedAt.getTime() - new Date(openLog.exitedAt).getTime()) / 1000)
          );
          await OutsideSiteLog.updateOne(
            { _id: openLog._id },
            { $set: { returnedAt: capturedAt, durationSeconds, status: "closed" } }
          );
        }
      } else {
        await OutsideSiteLog.create({
          attendanceDayId: session.attendanceDayId,
          sessionId: session._id,
          companyId,
          employeeId,
          siteId: session.siteId,
          exitedAt: capturedAt,
          exitLocation: { type: "Point", coordinates: [p.lng, p.lat] },
          distanceFromSiteMeters: distance,
          status: "open",
        });
      }
      currentlyInside = effectiveInside;
    }
  }

  // Run mock detection over the whole session
  const allPings = await LocationPing.find({ sessionId: session._id })
    .sort({ capturedAt: 1 })
    .lean();
  const pingLikes: PingLike[] = allPings.map((p: { location: { coordinates: [number, number] }; accuracyMeters: number; isMockLocation: boolean; capturedAt: Date }) => ({
    lat: p.location.coordinates[1],
    lng: p.location.coordinates[0],
    accuracyMeters: p.accuracyMeters,
    isMockLocation: p.isMockLocation,
    capturedAt: p.capturedAt,
  }));
  const flags = flagPings(pingLikes);
  if (flags.length) {
    const day = await AttendanceDay.findById(session.attendanceDayId);
    if (day) {
      day.isFlagged = true;
      const reasons = new Set(day.flagReasons || []);
      for (const f of flags) {
        for (const r of f.reasons) reasons.add(r);
      }
      day.flagReasons = Array.from(reasons);
      await day.save();
    }
  }

  // Auto check-out on SUSTAINED absence: the most recent N pings are ALL beyond
  // the geofence radius + buffer. Requiring several consecutive readings means a
  // single GPS-drift spike (employee actually sitting still) won't end the shift.
  // Suppressed during the lunch window (company timezone).
  if (env.AUTO_CHECKOUT_ENABLED && !autoCheckedOut) {
    const need = Math.max(1, env.AUTO_CHECKOUT_CONSECUTIVE_PINGS);
    const threshold = site.radiusMeters + env.AUTO_CHECKOUT_BUFFER_METERS;
    const latest = allPings[allPings.length - 1];
    const tail = allPings.slice(-need);
    // Each of the last N pings must be a RELIABLE reading that is beyond the
    // buffer. An inaccurate reading breaks the streak so junk can't check anyone out.
    const reliableAway = (pp: any) =>
      (pp.accuracyMeters == null || pp.accuracyMeters <= env.MAX_PING_ACCURACY_METERS) &&
      (pp.distanceFromSiteMeters ?? 0) > threshold;
    const sustainedAway = tail.length >= need && tail.every(reliableAway);
    if (latest && sustainedAway) {
      // Back-date the check-out to when they crossed the site boundary (the open
      // outside-site log), falling back to the latest ping.
      const openLog = await OutsideSiteLog.findOne({
        sessionId: session._id,
        returnedAt: null,
      })
        .sort({ exitedAt: -1 })
        .lean();
      const leftAt = openLog ? new Date(openLog.exitedAt) : new Date(latest.capturedAt);
      // Suppress during lunch — check BOTH the trigger time and the effective
      // (back-dated) check-out time, so a lunch departure is never auto-closed.
      const lunchPause =
        env.AUTO_CHECKOUT_LUNCH_BREAK_ENABLED &&
        (isWithinLocalTimeWindow(new Date(latest.capturedAt), timezone, env.AUTO_CHECKOUT_LUNCH_START, env.AUTO_CHECKOUT_LUNCH_END) ||
          isWithinLocalTimeWindow(leftAt, timezone, env.AUTO_CHECKOUT_LUNCH_START, env.AUTO_CHECKOUT_LUNCH_END));
      if (!lunchPause) {
        await finalizeSession({
          session,
          lat: latest.location.coordinates[1],
          lng: latest.location.coordinates[0],
          accuracyMeters: latest.accuracyMeters,
          checkOutAt: leftAt,
          status: "auto_closed",
          reason: "auto_checkout_left_site",
        });
        autoCheckedOut = true;
        autoCheckoutAt = leftAt;
      }
    }
  }

  // Keep the day's running (cumulative) work/inside/outside totals fresh so live
  // displays and in-progress reports reflect every session plus the away-gaps
  // (skip if we just auto-closed the session above).
  if (!autoCheckedOut) {
    const totals = await recomputeDayTotals(session.attendanceDayId, Date.now());
    await AttendanceDay.findByIdAndUpdate(session.attendanceDayId, {
      $set: {
        totalWorkSeconds: totals.totalWorkSeconds,
        totalInsideSeconds: totals.totalInsideSeconds,
        totalOutsideSeconds: totals.totalOutsideSeconds,
        outsideVisitCount: totals.outsideVisitCount,
      },
    });
  }

  return {
    ok: true as const,
    received: sorted.length,
    autoCheckedOut,
    autoCheckoutAt: autoCheckoutAt ? autoCheckoutAt.toISOString() : null,
  };
}
