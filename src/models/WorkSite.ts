import { Schema, model, models } from "mongoose";
import { GeoPointSchema } from "./GeoPoint";

const WorkSiteSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    address: { type: String },
    location: {
      type: GeoPointSchema,
      required: true,
    },
    radiusMeters: { type: Number, required: true, default: 150 },
    allowedAccuracyMeters: { type: Number, default: 50 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

WorkSiteSchema.index({ location: "2dsphere" });

export const WorkSite = (models.WorkSite as any) || model("WorkSite", WorkSiteSchema);
