/**
 * Ambient declarations for side-effect asset imports (CSS, etc.).
 *
 * Next.js normally provides these via the auto-generated `next-env.d.ts`, but
 * that file is git-ignored, so a fresh checkout (or the editor before a build
 * has run) reports "Cannot find module ... for side-effect import of './x.css'".
 * Declaring them here — a committed file — makes the types available everywhere,
 * independent of whether `next-env.d.ts` has been generated yet.
 */
declare module "*.css";
declare module "*.scss";
declare module "*.sass";
