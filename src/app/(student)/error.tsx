"use client";

import { useEffect } from "react";

import { BigButton } from "@/components";

/**
 * Calm fallback for an unexpected failure on a student screen, in place of the
 * raw error page. `retry` re-fetches and re-renders the segment.
 */
export default function StudentError({
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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-[44px] font-extrabold">Something went wrong</h1>
      <p role="alert" className="max-w-md text-[22px] font-bold">
        Try again. If it keeps happening, ask a teacher for help.
      </p>
      <div className="w-full max-w-md">
        <BigButton variant="primary" onClick={retry}>
          Try again
        </BigButton>
      </div>
    </main>
  );
}
