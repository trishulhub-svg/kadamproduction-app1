// src/components/AgentationDev.tsx
// Agentation visual feedback toolbar (bottom-right).
// Client-only via next/dynamic — portals into document.body.
"use client";

import dynamic from "next/dynamic";

const Agentation = dynamic(
  () => import("agentation").then((mod) => mod.Agentation),
  { ssr: false }
);

export function AgentationDev() {
  // Optional local Agent Sync (MCP): NEXT_PUBLIC_AGENTATION_ENDPOINT=http://localhost:4747
  const endpoint = process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || undefined;

  return (
    <Agentation
      className="kp-agentation"
      {...(endpoint ? { endpoint } : {})}
    />
  );
}
