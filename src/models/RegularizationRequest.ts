import { Schema, model, models } from "mongoose";

const RegularizationRequestSchema = new Schema(
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
    requestType: {
      type: String,
      enum: [
        "forgot_check_in",
        "forgot_check_out",
        "gps_issue",
        "outside_site_reason",
        "manual_correction",
      ],
      required: true,
    },
    requestedCheckInAt: { type: Date, default: null },
    requestedCheckOutAt: { type: Date, default: null },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewerNote: { type: String },
  },
  { timestamps: true }
);

export const RegularizationRequest =
  (models.RegularizationRequest as any) ||
  model("RegularizationRequest", RegularizationRequestSchema);
