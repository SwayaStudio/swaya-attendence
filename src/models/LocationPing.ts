import { Schema, model, models } from "mongoose";
import { GeoPointSchema } from "./GeoPoint";

const LocationPingSchema = new Schema(
  {
    attendanceDayId: {
      type: Schema.Types.ObjectId,
      ref: "AttendanceDay",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "AttendanceSession",
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
    capturedAt: { type: Date, required: true, default: () => new Date(), index: true },
    location: { type: GeoPointSchema, required: true },
    accuracyMeters: { type: Number },
    distanceFromSiteMeters: { type: Number },
    isInsideGeofence: { type: Boolean, required: true, index: true },
    isMockLocation: { type: Boolean, default: false, index: true },
    isGpsEnabled: { type: Boolean, default: true },
    batteryPercentage: { type: Number, min: 0, max: 100 },
    networkType: {
      type: String,
      enum: ["wifi", "mobile_data", "offline", "unknown"],
      default: "unknown",
    },
    appState: {
      type: String,
      enum: ["foreground", "background", "killed", "unknown"],
      default: "unknown",
    },
  },
  { timestamps: true }
);

LocationPingSchema.index({ location: "2dsphere" });
LocationPingSchema.index({ employeeId: 1, capturedAt: -1 });
LocationPingSchema.index({ attendanceDayId: 1, capturedAt: 1 });
LocationPingSchema.index({ sessionId: 1, capturedAt: 1 });

export const LocationPing = (models.LocationPing as any) || model("LocationPing", LocationPingSchema);
