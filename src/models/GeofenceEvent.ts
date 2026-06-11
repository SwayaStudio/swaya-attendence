import { Schema, model, models } from "mongoose";
import { GeoPointSchema } from "./GeoPoint";

const GeofenceEventSchema = new Schema(
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
    eventType: {
      type: String,
      enum: [
        "entered_site",
        "exited_site",
        "gps_lost",
        "gps_restored",
        "mock_location_detected",
      ],
      required: true,
      index: true,
    },
    eventAt: { type: Date, required: true, default: () => new Date(), index: true },
    location: { type: GeoPointSchema, default: null },
    accuracyMeters: { type: Number },
    distanceFromSiteMeters: { type: Number },
    notes: { type: String },
  },
  { timestamps: true }
);

GeofenceEventSchema.index({ location: "2dsphere" });
GeofenceEventSchema.index({ attendanceDayId: 1, eventAt: 1 });
GeofenceEventSchema.index({ employeeId: 1, eventAt: -1 });

export const GeofenceEvent = (models.GeofenceEvent as any) || model("GeofenceEvent", GeofenceEventSchema);
