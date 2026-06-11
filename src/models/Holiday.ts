import { Schema, model, models } from "mongoose";

const HolidaySchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    holidayDate: { type: String, required: true },
  },
  { timestamps: true }
);

HolidaySchema.index({ companyId: 1, holidayDate: 1 }, { unique: true });

export const Holiday = (models.Holiday as any) || model("Holiday", HolidaySchema);
