// src/app/(dashboard)/error.tsx
"use client";
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold text-red-700">Something went wrong</h2>
        <p className="mt-1 text-sm text-gray-600">An unexpected error occurred. Please try again.</p>
        <button onClick={reset} className="mt-4 rounded-lg bg-kp-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Try Again
        </button>
      </div>
    </div>
  );
}
