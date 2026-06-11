import { Schema, model, models } from "mongoose";

const ShiftTemplateSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    graceMinutes: { type: Number, default: 10 },
    minimumWorkMinutes: { type: Number, default: 480 },
    isNightShift: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ShiftTemplate = (models.ShiftTemplate as any) || model("ShiftTemplate", ShiftTemplateSchema);
