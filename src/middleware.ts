import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((request) => {
  if (request.auth) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.href);

  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: [
    "/upload/:path*",
    "/garden/:path*",
    "/api/uploads/:path*",
    "/api/scans/:path*",
  ],
};
