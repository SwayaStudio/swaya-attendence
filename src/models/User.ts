import { Schema, model, models } from "mongoose";

const UserSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["super_admin", "admin", "manager", "employee"],
      default: "employee",
      index: true,
    },
    employeeCode: { type: String, trim: true },
    department: { type: String },
    designation: { type: String },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    joiningDate: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

UserSchema.index(
  { companyId: 1, employeeCode: 1 },
  { unique: true, sparse: true }
);

export const User = (models.User as any) || model("User", UserSchema);
