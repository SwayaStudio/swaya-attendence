/**
 * CSV helpers — pure, dependency-free, used by report exports.
 */

/**
 * Make a value safe to write into a CSV cell:
 *  1. Neutralise spreadsheet formula injection — Excel/Sheets execute a cell that
 *     begins with = + - @ (or a leading tab/CR) as a formula. Prefix those with a
 *     single quote so they render as literal text.
 *  2. Quote-escape when the value contains a comma, quote, or newline.
 */
export function csvEscape(s: string): string {
  if (s == null) return "";
  let out = String(s);
  if (/^[=+\-@\t\r]/.test(out)) out = `'${out}`;
  if (/[",\n]/.test(out)) return `"${out.replace(/"/g, '""')}"`;
  return out;
}
