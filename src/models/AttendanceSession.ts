import { Schema, model, models } from "mongoose";
import { GeoPointSchema } from "./GeoPoint";

const AttendanceSessionSchema = new Schema(
  {
    attendanceDayId: {
      type: Schema.Types.ObjectId,
      ref: "AttendanceDay",
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    siteId: {
      type: Schema.Types.ObjectId,
      ref: "WorkSite",
      required: true,
      index: true,
    },
    checkInAt: { type: Date, required: true },
    checkInLocation: { type: GeoPointSchema, required: true },
    checkInAccuracyMeters: { type: Number },
    checkInDistanceMeters: { type: Number },
    checkOutAt: { type: Date, default: null },
    checkOutLocation: { type: GeoPointSchema, default: null },
    checkOutAccuracyMeters: { type: Number },
    checkOutDistanceMeters: { type: Number },
    status: {
      type: String,
      enum: ["active", "completed", "auto_closed", "flagged"],
      default: "active",
      index: true,
    },
    deviceId: { type: String },
    appVersion: { type: String },
  },
  { timestamps: true }
);

AttendanceSessionSchema.index({ employeeId: 1, status: 1 });
// Sort active-session lookups by checkInAt without an in-memory sort.
AttendanceSessionSchema.index({ employeeId: 1, status: 1, checkInAt: -1 });
// recomputeDayTotals / today: all sessions of a day in check-in order.
AttendanceSessionSchema.index({ attendanceDayId: 1, checkInAt: 1 });
AttendanceSessionSchema.index({ checkInLocation: "2dsphere" });

export const AttendanceSession =
  (models.AttendanceSession as any) || model("AttendanceSession", AttendanceSessionSchema);
