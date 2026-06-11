/**
 * Signup: creates a new Company and the first admin user.
 */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { Company, User } from "@/models";
import { SignupSchema } from "@/lib/validators";
import { withApi, parseJson, ok, fail, ApiError } from "@/lib/api-helpers";

export const POST = withApi(async (req: NextRequest) => {
  const body = await parseJson(req, SignupSchema);
  const { companyName, fullName, email, password, timezone } = body;

  const existing = await User.findOne({ email }).lean();
  if (existing) throw new ApiError("Email already in use", 409);

  const company = await Company.create({
    name: companyName,
    timezone,
    isActive: true,
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await User.create({
    companyId: company._id,
    fullName,
    email,
    passwordHash,
    role: "admin",
    isActive: true,
  });

  return ok(
    {
      company: { id: String(company._id), name: company.name },
      user: {
        id: String(admin._id),
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        companyId: String(admin.companyId),
      },
    },
    { status: 201 }
  );
});
