/**
 * Reset password — exchange token + new password for a successful reset.
 */
import { NextRequest } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { z } from "zod";
import { withApi, parseJson, ok } from "@/lib/api-helpers";

const ResetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(200),
});

export const POST = withApi(async (req: NextRequest) => {
  const body = await parseJson(req, ResetSchema);
  const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpires: { $gt: new Date() },
  }).select("+resetTokenHash +resetTokenExpires");
  if (!user) {
    return ok({ message: "If the token is valid, your password has been reset." });
  }
  user.passwordHash = await bcrypt.hash(body.password, 10);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  return ok({ message: "Password reset." });
});
