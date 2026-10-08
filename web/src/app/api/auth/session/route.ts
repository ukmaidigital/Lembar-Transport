import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** BFF: store the Sanctum token in an httpOnly cookie (POST) or clear it (DELETE). */
export async function POST(req: NextRequest) {
  const { token, expires_at } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: { code: "TOKEN_REQUIRED", message: "token wajib" } }, { status: 422 });
  }
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expires_at ? new Date(expires_at) : undefined,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
