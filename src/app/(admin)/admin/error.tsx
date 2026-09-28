"use client";

import { useEffect } from "react";

/**
 * Fallback for an unexpected failure on an admin page, inside the admin shell,
 * so navigation still works. `retry` re-fetches and re-renders the segment.
 */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p role="alert" className="max-w-prose">
        This page hit a problem. Try again, or open another page from the menu. If you were
        saving a change, check that it saved.
      </p>
      {error.digest ? (
        <p className="text-sm opacity-75">
          Reference: <span className="tabular">{error.digest}</span>
        </p>
      ) : null}
      <div>
        <button type="button" onClick={retry} className="btn btn-primary">
          Try again
        </button>
      </div>
    </main>
  );
}
