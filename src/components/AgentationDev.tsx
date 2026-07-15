// src/components/AgentationDev.tsx
// Dev-only Agentation visual feedback toolbar (bottom-right).
// Client-only via next/dynamic — Agentation portals into document.body.
"use client";

import dynamic from "next/dynamic";

const Agentation = dynamic(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false }
);

export function AgentationDev() {
  if (process.env.NODE_ENV !== "development") return null;

  // Optional local Agent Sync (MCP) — set NEXT_PUBLIC_AGENTATION_ENDPOINT=http://localhost:4747
  const endpoint = process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || undefined;

  return (
    <Agentation
      className="kp-agentation"
      {...(endpoint ? { endpoint } : {})}
    />
  );
}
