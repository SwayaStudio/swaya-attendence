/**
 * Small in-memory cache for a company's timezone. The timezone is read on every
 * hot-path request (pings, today poll, check-in/out) but changes almost never, so
 * caching it avoids a Company.findById round-trip each time.
 */
import { Company } from "@/models";
import { env } from "./env";

const cache = new Map<string, { tz: string; at: number }>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function getCompanyTimezone(companyId: string): Promise<string> {
  const key = String(companyId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tz;
  const company = await Company.findById(companyId).select("timezone").lean();
  const tz = company?.timezone || env.DEFAULT_TIMEZONE;
  cache.set(key, { tz, at: Date.now() });
  return tz;
}
