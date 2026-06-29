"use client";
import { lazy, Suspense, Component, useEffect, useState } from "react";

const Agentation = lazy(() => import("agentation").then((m) => ({ default: m.Agentation })));

class AgentationErrorBoundary extends Component<{ children: React.ReactNode }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

export default function AgentationWrapper() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <AgentationErrorBoundary>
      <Suspense fallback={null}>
        <Agentation />
      </Suspense>
    </AgentationErrorBoundary>
  );
}
