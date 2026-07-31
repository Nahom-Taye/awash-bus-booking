import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { isRole } from "@/lib/validation";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default auth(async (req) => {
  const { nextUrl } = req;
  const segments = nextUrl.pathname.split("/");
  const locale = routing.locales.includes(segments[1] as "en" | "am")
    ? (segments[1] as "en" | "am")
    : null;

  if (!locale) {
    return intlMiddleware(req);
  }

  const pathname = `/${segments.slice(2).join("/")}`;
  const isProtected =
    pathname === "/passenger" ||
    pathname.startsWith("/passenger/") ||
    pathname === "/operator" ||
    pathname.startsWith("/operator/");

  if (!isProtected) {
    return intlMiddleware(req);
  }

  const user = req.auth?.user;

  const loginUrl = new URL(`/${locale}/login`, nextUrl.origin);

  if (!user?.id || !isRole(user.role)) {
    if (pathname === "/passenger/dashboard") {
      loginUrl.searchParams.set(
        "callbackUrl",
        `${nextUrl.pathname}${nextUrl.search}`,
      );
    }
    return NextResponse.redirect(loginUrl);
  }

  const databaseUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  if (!databaseUser || databaseUser.role !== user.role) {
    return NextResponse.redirect(loginUrl);
  }

  if (
    pathname.startsWith("/passenger") &&
    databaseUser.role !== "PASSENGER"
  ) {
    return NextResponse.redirect(
      new URL(`/${locale}/operator/dashboard`, nextUrl.origin),
    );
  }

  if (
    pathname.startsWith("/operator") &&
    databaseUser.role !== "OPERATOR"
  ) {
    return NextResponse.redirect(
      new URL(`/${locale}/passenger/dashboard`, nextUrl.origin),
    );
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
