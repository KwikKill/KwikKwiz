import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;
  const isAdmin = token?.isAdmin === true;
  const path = request.nextUrl.pathname;

  // Redirect to login if not authenticated
  if (!isAuthenticated && path !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect non-admins away from admin pages
  if (isAuthenticated && !isAdmin && path.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/quiz/:path*",
    "/session/:path*",
  ],
};