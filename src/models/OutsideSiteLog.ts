import { Schema, model, models } from "mongoose";
import { GeoPointSchema } from "./GeoPoint";

const OutsideSiteLogSchema = new Schema(
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
    exitedAt: { type: Date, required: true },
    returnedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    exitLocation: { type: GeoPointSchema, default: null },
    returnLocation: { type: GeoPointSchema, default: null },
    reason: { type: String, default: null },
    status: {
      type: String,
      enum: ["open", "closed", "approved", "rejected", "flagged"],
      default: "open",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewerNote: { type: String, default: null },
  },
  { timestamps: true }
);

OutsideSiteLogSchema.index({ employeeId: 1, exitedAt: -1 });
OutsideSiteLogSchema.index({ attendanceDayId: 1, exitedAt: 1 });

export const OutsideSiteLog = (models.OutsideSiteLog as any) || model("OutsideSiteLog", OutsideSiteLogSchema);
