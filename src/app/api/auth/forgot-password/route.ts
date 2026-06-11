/**
 * Forgot password — generates a reset token and emails the user.
 * In dev (no SMTP configured) the link is printed to server console.
 */
import { NextRequest } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { sendEmail } from "@/lib/email";
import { withApi, parseJson, ok } from "@/lib/api-helpers";
import { env } from "@/lib/env";

const ForgotSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase().trim()),
});

const ResetSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(200),
});

export const POST = withApi(async (req: NextRequest) => {
  const url = new URL(req.url);
  if (url.searchParams.get("action") === "reset") {
    const body = await parseJson(req, ResetSchema);
    const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpires: { $gt: new Date() },
    }).select("+resetTokenHash +resetTokenExpires");
    if (!user) {
      return ok({ message: "If the email exists, the password has been reset." });
    }
    const bcrypt = await import("bcryptjs");
    user.passwordHash = await bcrypt.hash(body.password, 10);
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;
    await user.save();
    return ok({ message: "Password reset." });
  }

  const body = await parseJson(req, ForgotSchema);
  const user = await User.findOne({ email: body.email });
  if (!user) {
    // do not reveal existence
    return ok({ message: "If the email exists, a reset link has been sent." });
  }
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  user.resetTokenHash = tokenHash;
  user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
  await user.save();

  const link = `${env.NEXTAUTH_URL}/reset-password?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your password",
    html: `<p>Click to reset: <a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`,
  });

  return ok({ message: "If the email exists, a reset link has been sent." });
});
