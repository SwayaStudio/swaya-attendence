import { Schema, model, models } from "mongoose";

const CompanySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    timezone: { type: String, default: "Asia/Kolkata" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Company =
  (models.Company as any) || model("Company", CompanySchema);
