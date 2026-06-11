import { Schema, model, models } from "mongoose";

const EmployeeDeviceSchema = new Schema(
  {
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
    deviceId: { type: String, required: true },
    deviceName: { type: String },
    platform: {
      type: String,
      enum: ["android", "ios", "web"],
      required: true,
    },
    isPrimary: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

EmployeeDeviceSchema.index({ employeeId: 1, deviceId: 1 }, { unique: true });

export const EmployeeDevice = (models.EmployeeDevice as any) || model("EmployeeDevice", EmployeeDeviceSchema);
