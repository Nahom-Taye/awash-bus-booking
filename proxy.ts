import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;

  const loginUrl = new URL("/login", nextUrl.origin);

  // Not authenticated -> send to login
  if (!user) {
    return NextResponse.redirect(loginUrl);
  }

  // Passenger area: only PASSENGER role allowed
  if (nextUrl.pathname.startsWith("/passenger") && user.role !== "PASSENGER") {
    return NextResponse.redirect(loginUrl);
  }

  // Operator area: only OPERATOR role allowed
  if (nextUrl.pathname.startsWith("/operator") && user.role !== "OPERATOR") {
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/passenger/:path*", "/operator/:path*"],
};
