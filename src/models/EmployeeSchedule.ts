import { Schema, model, models } from "mongoose";

const EmployeeScheduleSchema = new Schema(
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
    shiftTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "ShiftTemplate",
      required: true,
    },
    workDate: { type: String, required: true, index: true },
    expectedStartAt: { type: Date },
    expectedEndAt: { type: Date },
    isWorkingDay: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EmployeeScheduleSchema.index({ employeeId: 1, workDate: 1 }, { unique: true });
EmployeeScheduleSchema.index({ companyId: 1, workDate: 1 });
EmployeeScheduleSchema.index({ siteId: 1, workDate: 1 });

export const EmployeeSchedule =
  (models.EmployeeSchedule as any) || model("EmployeeSchedule", EmployeeScheduleSchema);
