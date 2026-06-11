/**
 * Super-admin: list all users across all companies.
 */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Company } from "@/models";
import { requireRole, ok, withApi } from "@/lib/api-helpers";

export const GET = withApi(async (req: NextRequest) => {
  await requireRole(["super_admin"]);
  const users = await User.find().select("fullName email role companyId isActive").lean();
  const companies = await Company.find().select("name").lean();
  const cMap = new Map(companies.map((c) => [String(c._id), c.name]));
  const enriched = users.map((u) => ({
    id: String(u._id),
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    isActive: u.isActive,
    companyName: cMap.get(String(u.companyId)) || "—",
  }));
  return ok({ users: enriched });
});