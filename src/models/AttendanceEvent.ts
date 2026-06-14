import { Schema, model, models } from "mongoose";
import { GeoPointSchema } from "./GeoPoint";

/**
 * Immutable ledger of EVERY check-in and check-out, one row per event, indexed by
 * work date. Unlike AttendanceSession (which merges check-in + check-out into one
 * doc), this records each event separately with HOW it happened (manual, native
 * geofence, end-of-shift, etc.) — for later auditing of whether the app behaved
 * correctly. Append-only; never updated.
 */
const AttendanceEventSchema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    attendanceDayId: { type: Schema.Types.ObjectId, ref: "AttendanceDay", index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: "AttendanceSession", index: true },
    siteId: { type: Schema.Types.ObjectId, ref: "WorkSite" },

    type: { type: String, enum: ["check-in", "check-out"], required: true },
    // HOW the event happened.
    source: {
      type: String,
      enum: [
        "manual", // employee tapped check-in/out (incl. offline sync)
        "geofence_enter", // native OS geofence ENTER (app killed)
        "geofence_exit", // native OS geofence EXIT (app killed)
        "auto_sustained_absence", // pings showed sustained absence
        "auto_shift_end", // scheduled shift end
        "auto_ping_gap", // tracking went silent past the gap
      ],
      required: true,
      index: true,
    },

    at: { type: Date, required: true, index: true },
    // Company-timezone calendar date "YYYY-MM-DD" — query the ledger by this.
    workDate: { type: String, required: true, index: true },

    location: { type: GeoPointSchema, default: null },
    accuracyMeters: { type: Number },
    distanceFromSiteMeters: { type: Number },
    sessionStatus: { type: String },
  },
  { timestamps: true }
);

// Primary audit queries: by company+date, and by employee+date.
AttendanceEventSchema.index({ companyId: 1, workDate: 1, at: 1 });
AttendanceEventSchema.index({ employeeId: 1, workDate: 1, at: 1 });

export const AttendanceEvent =
  (models.AttendanceEvent as any) || model("AttendanceEvent", AttendanceEventSchema);
