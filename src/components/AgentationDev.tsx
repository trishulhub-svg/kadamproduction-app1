// src/components/AgentationDev.tsx
// Dev-only visual feedback toolbar for AI coding agents (Agentation).
"use client";

import { Agentation } from "agentation";

export function AgentationDev() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Agentation />;
}
