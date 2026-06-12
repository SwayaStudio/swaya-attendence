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
import { todayWorkDate } from "./workdate";
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
  autoCheckout?: boolean;
}) {
  const { session } = opts;

  session.checkOutAt = opts.checkOutAt;
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

  // Replay pings to summarise inside/outside time
  const pings = await LocationPing.find({ sessionId: session._id })
    .sort({ capturedAt: 1 })
    .lean();
  const { totalInside, totalOutside, outsideVisitCount } = summarizePings(
    pings,
    session.siteId.toString()
  );

  const day = await AttendanceDay.findByIdAndUpdate(
    session.attendanceDayId,
    {
      $set: {
        lastCheckOutAt: session.checkOutAt,
        totalWorkSeconds: Math.max(
          0,
          Math.floor((session.checkOutAt.getTime() - session.checkInAt.getTime()) / 1000)
        ),
        totalInsideSeconds: totalInside,
        totalOutsideSeconds: totalOutside,
        outsideVisitCount,
      },
    },
    { new: true }
  );

  // Close any open outside logs as of the check-out time
  await OutsideSiteLog.updateMany(
    { sessionId: session._id, returnedAt: null },
    { $set: { returnedAt: session.checkOutAt, status: "closed" } }
  );

  if (day) {
    const reasons = new Set(day.flagReasons || []);
    if (totalOutside > 30 * 60) {
      day.isFlagged = true;
      reasons.add("excessive_outside_time");
    }
    if (opts.autoCheckout) {
      reasons.add("auto_checkout_left_site");
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

function summarizePings(
  pings: any[],
  _siteId: string
): { totalInside: number; totalOutside: number; outsideVisitCount: number } {
  let totalInside = 0;
  let totalOutside = 0;
  let outsideVisitCount = 0;
  let inOutsideRun = false;

  for (let i = 0; i < pings.length; i++) {
    const p = pings[i];
    const next = pings[i + 1];
    const inside = !!p.isInsideGeofence;
    const tEnd = next ? new Date(next.capturedAt).getTime() : Date.now();
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
      isInsideGeofence: inside,
      isMockLocation: p.isMockLocation ?? false,
      isGpsEnabled: true,
      batteryPercentage: p.batteryPercentage,
      networkType: (p.networkType as any) ?? "unknown",
      appState: (p.appState as any) ?? "unknown",
    });
    // Geofence event on transition
    if (inside !== currentlyInside) {
      await GeofenceEvent.create({
        attendanceDayId: session.attendanceDayId,
        sessionId: session._id,
        companyId,
        employeeId,
        siteId: session.siteId,
        eventType: inside ? "entered_site" : "exited_site",
        eventAt: capturedAt,
        location: { type: "Point", coordinates: [p.lng, p.lat] },
        accuracyMeters: p.accuracyMeters,
        distanceFromSiteMeters: distance,
      });
      if (inside) {
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
      currentlyInside = inside;
    }

    // Automatic check-out: the employee has moved beyond the geofence radius
    // plus a buffer (which absorbs GPS jitter near the boundary). Close the
    // session as of the moment they crossed the site boundary.
    if (
      env.AUTO_CHECKOUT_ENABLED &&
      !inside &&
      distance > site.radiusMeters + env.AUTO_CHECKOUT_BUFFER_METERS
    ) {
      // The boundary crossing is the open outside log's exitedAt; fall back to
      // this ping if no log exists (e.g. first ping already beyond the buffer).
      const openLog = await OutsideSiteLog.findOne({
        sessionId: session._id,
        returnedAt: null,
      })
        .sort({ exitedAt: -1 })
        .lean();
      const leftAt = openLog ? new Date(openLog.exitedAt) : capturedAt;

      await finalizeSession({
        session,
        lat: p.lat,
        lng: p.lng,
        accuracyMeters: p.accuracyMeters,
        checkOutAt: leftAt,
        status: "auto_closed",
        autoCheckout: true,
      });

      autoCheckedOut = true;
      autoCheckoutAt = leftAt;
      break;
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

  return {
    ok: true as const,
    received: sorted.length,
    autoCheckedOut,
    autoCheckoutAt: autoCheckoutAt ? autoCheckoutAt.toISOString() : null,
  };
}
