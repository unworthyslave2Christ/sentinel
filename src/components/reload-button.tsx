"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReloadButtonProps = {
  label?: string;
  className?: string;
};

/**
 * Re-fetches the current dashboard route's server-rendered data without
 * navigating away from the page. Add <ReloadButton /> to any dashboard page
 * that should expose a manual reload action.
 */
export default function ReloadButton({
  label = "Reload",
  className = "",
}: ReloadButtonProps) {
  const router = useRouter();
  const [reloading, setReloading] = useState(false);

  const reload = async () => {
    if (reloading) return;

    setReloading(true);
    try {
      router.refresh();
      // Keep the busy state long enough for the user to see the feedback,
      // while allowing the refreshed server payload to render normally.
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setReloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={reload}
      disabled={reloading}
      aria-label={reloading ? "Reloading" : label}
      className={`inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <svg
        aria-hidden="true"
        className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" />
      </svg>
      {reloading ? "Reloading…" : label}
    </button>
  );
}
