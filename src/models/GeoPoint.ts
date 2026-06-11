/**
 * Shared GeoJSON Point sub-schema.
 * IMPORTANT: coordinates are [longitude, latitude] — not [lat, lng].
 */
import { Schema } from "mongoose";

export const GeoPointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: (v: number[]) =>
          Array.isArray(v) &&
          v.length === 2 &&
          v[0] >= -180 &&
          v[0] <= 180 &&
          v[1] >= -90 &&
          v[1] <= 90,
        message: "coordinates must be [longitude, latitude] in valid ranges",
      },
    },
  },
  { _id: false }
);

export type GeoPoint = {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
};
