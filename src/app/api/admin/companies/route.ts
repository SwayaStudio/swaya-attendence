/**
 * Companies CRUD — super admin only.
 */
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Company, User } from "@/models";
import { requireRole, ok, withApi, fail } from "@/lib/api-helpers";
import { z } from "zod";

const Schema = z.object({
  name: z.string().min(2).max(200),
  timezone: z.string().default("Asia/Kolkata"),
  isActive: z.boolean().default(true),
});

export const GET = withApi(async () => {
  await requireRole(["super_admin"]);
  const companies = await Company.find().sort({ createdAt: -1 }).lean();
  const enriched = await Promise.all(
    companies.map(async (c: { _id: unknown; name: string; timezone: string; isActive: boolean; createdAt: Date; updatedAt: Date }) => {
      const count = await User.countDocuments({ companyId: c._id as never });
      return { ...c, userCount: count };
    })
  );
  return ok({ companies: enriched });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole(["super_admin"]);
  const body = Schema.parse(await req.json());
  const company = await Company.create(body);
  return ok({ company }, { status: 201 });
});

export const PATCH = withApi(async (req: NextRequest) => {
  await requireRole(["super_admin"]);
  const body = Schema.partial().parse(await req.json());
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !Types.ObjectId.isValid(id)) return fail("Invalid id", 400);
  const company = await Company.findByIdAndUpdate(id, { $set: body }, { new: true });
  if (!company) return fail("Not found", 404);
  return ok({ company });
});