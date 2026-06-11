/**
 * Email helper — Nodemailer with console fallback for dev.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { env, isEmailConfigured } from "./env";

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;
  if (isEmailConfigured) {
    cachedTransport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  } else {
    // stream transport — nothing is sent; we capture to JSON
    cachedTransport = nodemailer.createTransport({
      jsonTransport: true,
    });
  }
  return cachedTransport;
}

export type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail(args: SendArgs) {
  const info = await getTransport().sendMail({
    from: env.EMAIL_FROM,
    ...args,
  });
  if (!isEmailConfigured) {
    // eslint-disable-next-line no-console
    console.log("\n📧 [email] (no SMTP configured — printed to console)");
    // eslint-disable-next-line no-console
    console.log(`  To:      ${args.to}`);
    // eslint-disable-next-line no-console
    console.log(`  Subject: ${args.subject}`);
    // eslint-disable-next-line no-console
    console.log(`  Preview: ${args.html.replace(/<[^>]+>/g, "").slice(0, 200)}…`);
    // eslint-disable-next-line no-console
    console.log("");
  } else if (info && typeof info === "object" && "messageId" in info) {
    // eslint-disable-next-line no-console
    console.log(`[email] sent: ${(info as { messageId: string }).messageId}`);
  }
  return info;
}
