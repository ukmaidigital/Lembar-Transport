import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);
const SESSION_COOKIE = process.env.SESSION_COOKIE || "lt_token";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  // Driver and admin areas are not localized; they require a session except for their login/registration entry points.
  if (pathname.startsWith("/driver")) {
    if (!hasSession && !pathname.startsWith("/driver/masuk")) {
      const url = req.nextUrl.clone();
      url.pathname = "/driver/masuk";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (pathname.startsWith("/admin")) {
    if (!hasSession && !pathname.startsWith("/admin/masuk")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/masuk";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  // Customer account pages require a session.
  const accountMatch = pathname.match(/^\/(en\/)?akun(\/|$)/);
  if (accountMatch && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = `${accountMatch[1] ? "/en" : ""}/masuk`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|sw\\.js|manifest\\.webmanifest|icons|.*\\..*).*)"],
};
