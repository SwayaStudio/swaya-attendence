/**
 * NextAuth middleware — protects dashboard routes and enforces role-prefix rules.
 */
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const ROLE_PREFIXES: { prefix: string; allow: string[] }[] = [
  { prefix: "/super-admin", allow: ["super_admin"] },
  { prefix: "/admin", allow: ["admin", "super_admin"] },
  { prefix: "/manager", allow: ["manager", "admin", "super_admin"] },
  { prefix: "/employee", allow: ["employee", "manager", "admin", "super_admin"] },
];

const PUBLIC_AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

function roleHome(role: string): string {
  if (role === "super_admin") return "/super-admin";
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager";
  return "/employee";
}

function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    // Public auth pages — let them through. If already signed in, send to role home.
    if (isPublicAuthPath(pathname)) {
      if (token) {
        return NextResponse.redirect(new URL(roleHome(token.role as string), req.url));
      }
      return NextResponse.next();
    }

    if (!token) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = token.role as string;

    // If user hits "/" while already signed in, send to their home.
    if (pathname === "/") {
      return NextResponse.redirect(new URL(roleHome(role), req.url));
    }

    // Role-prefix enforcement
    for (const rule of ROLE_PREFIXES) {
      if (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) {
        if (!rule.allow.includes(role)) {
          return NextResponse.redirect(new URL(roleHome(role), req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // We do the redirect manually in the middleware fn above.
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/super-admin/:path*",
    "/admin/:path*",
    "/manager/:path*",
    "/employee/:path*",
  ],
};
