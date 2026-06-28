"use client";
import { lazy, Suspense, useEffect, useState } from "react";

const Agentation = lazy(() => import("agentation").then((m) => ({ default: m.Agentation })));

export default function AgentationWrapper() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <Agentation />
    </Suspense>
  );
}
