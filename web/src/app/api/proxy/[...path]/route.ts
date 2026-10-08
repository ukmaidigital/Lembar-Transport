import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/** BFF proxy: forwards /api/proxy/* to the Laravel API, attaching the token from the httpOnly cookie. */
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(`${API}/${path.join("/")}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));
  const headers = new Headers();
  for (const h of ["accept", "accept-language", "content-type", "idempotency-key", "x-device"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("accept", "application/json");
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const init: RequestInit & { duplex?: string } = { method: req.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = req.body;
    init.duplex = "half";
  }
  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch {
    return NextResponse.json({ error: { code: "API_UNREACHABLE", message: "Server API tidak dapat dihubungi." } }, { status: 502 });
  }
  const res = new NextResponse(upstream.body, { status: upstream.status });
  for (const h of ["content-type", "content-disposition", "x-request-id"]) {
    const v = upstream.headers.get(h);
    if (v) res.headers.set(h, v);
  }
  if (upstream.status === 401 && token) {
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
