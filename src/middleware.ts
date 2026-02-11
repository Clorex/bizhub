// FILE: src/middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * IMPORTANT:
 * This project uses Firebase token auth in the client and server route handlers.
 * The earlier scaffold middleware was redirecting /vendor/analytics based on cookies,
 * which breaks your flow and causes /vendor/analytics -> /vendor/dashboard?redirect=...
 *
 * We disable middleware logic here.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};