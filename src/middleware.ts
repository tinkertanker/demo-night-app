import { type NextRequest, NextResponse } from "next/server";

import {
  AUTH_SESSION_COOKIES,
  LEGACY_AUTH_SESSION_COOKIES,
} from "~/lib/auth-cookies";

function hasCookie(req: NextRequest, names: readonly string[]) {
  return names.some((name) => req.cookies.get(name)?.value);
}

function expireLegacySessionCookies(res: NextResponse) {
  for (const name of LEGACY_AUTH_SESSION_COOKIES) {
    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
    });
  }
}

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip auth check if admin/[eventId]/submissions
  if (path.endsWith("/submissions")) {
    return NextResponse.next();
  }

  if (hasCookie(req, AUTH_SESSION_COOKIES)) {
    return NextResponse.next();
  }

  const signInUrl = new URL(
    `/api/auth/signin?callbackUrl=${path}`,
    req.url,
  );
  const res = NextResponse.redirect(signInUrl);
  if (hasCookie(req, LEGACY_AUTH_SESSION_COOKIES)) {
    expireLegacySessionCookies(res);
  }
  return res;
}

export const config = {
  matcher: ["/admin/:path*"],
};
