import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const logoUrl = await getSetting("logo_url");
    if (!logoUrl) {
      return new NextResponse(null, { status: 204 });
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <clipPath id="r">
      <rect width="512" height="512" rx="96"/>
    </clipPath>
  </defs>
  <rect width="512" height="512" fill="#ffffff" rx="96"/>
  <g clip-path="url(#r)">
    <image href="${escapeXml(logoUrl)}" x="56" y="56" width="400" height="400" preserveAspectRatio="xMidYMid meet"/>
  </g>
</svg>`;

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
