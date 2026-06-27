import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const logoUrl = await getSetting("logo_url");
    if (!logoUrl) {
      return new NextResponse(null, { status: 204 });
    }

    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
