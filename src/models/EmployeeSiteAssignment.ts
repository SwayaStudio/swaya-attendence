import { Schema, model, models } from "mongoose";

const EmployeeSiteAssignmentSchema = new Schema(
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
    siteId: {
      type: Schema.Types.ObjectId,
      ref: "WorkSite",
      required: true,
      index: true,
    },
    validFrom: { type: Date, required: true, default: () => new Date() },
    validTo: { type: Date, default: null },
    isPrimary: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmployeeSiteAssignmentSchema.index({
  employeeId: 1,
  siteId: 1,
  validFrom: 1,
});

export const EmployeeSiteAssignment =
  (models.EmployeeSiteAssignment as any) ||
  model("EmployeeSiteAssignment", EmployeeSiteAssignmentSchema);
