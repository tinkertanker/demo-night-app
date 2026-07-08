import { type NextRequest, NextResponse } from "next/server";

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip auth check if admin/[eventId]/submissions
  if (path.endsWith("/submissions")) {
    return NextResponse.next();
  }

  // NextAuth prefixes the cookie with __Secure- on any https deployment
  const session = !!(
    req.cookies.get("__Secure-next-auth.session-token") ??
    req.cookies.get("next-auth.session-token")
  );
  if (!session) {
    return NextResponse.redirect(
      new URL(`/api/auth/signin?callbackUrl=${path}`, req.url),
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
