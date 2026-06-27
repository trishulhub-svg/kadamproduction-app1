// src/app/api/manifest/route.ts
import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const logoUrl = await getSetting("logo_url");

  const manifest = {
    name: "Kadam Production",
    short_name: "KadamProd",
    description: "Professional Event Services — operations dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      { src: logoUrl ? "/api/icon" : "/icon-192.png", sizes: "192x192", type: logoUrl ? "image/svg+xml" : "image/png", purpose: "any" },
      { src: logoUrl ? "/api/icon" : "/icon-512.png", sizes: "512x512", type: logoUrl ? "image/svg+xml" : "image/png", purpose: "any maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
