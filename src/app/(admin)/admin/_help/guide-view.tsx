import { ChevronRight } from "lucide-react";
import Link from "next/link";

// From types directly: the help index also loads server-only rules, and this
// component is used by the client-side guide search on Admin home.
import { PAGE_NAMES, type AdminRoute, type Guide } from "@/lib/help/types";

export interface GuideViewProps {
  guide: Guide;
  /** The page this is shown on, so a guide does not offer to go where you are. */
  currentRoute?: AdminRoute;
}

/**
 * One guide: its question as a disclosure, its numbered steps inside.
 *
 * Shared by the help panel on each page and the guide list on Admin home, so a
 * task reads the same wherever someone finds it. The `id` lets Admin home link
 * straight to a guide.
 */
export function GuideView({ guide, currentRoute }: GuideViewProps) {
  return (
    <details
      id={`guide-${guide.id}`}
      className="group rounded-box border border-base-300 bg-base-100"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 font-bold [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="shrink-0 transition-transform group-open:rotate-90"
        />
        {guide.title}
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <ol className="flex list-decimal flex-col gap-1 pl-6">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {guide.note ? (
          <p className="rounded-box bg-base-200 p-3 text-sm">
            <strong>Good to know: </strong>
            {guide.note}
          </p>
        ) : null}
        {guide.page && guide.page !== currentRoute ? (
          <Link href={guide.page} className="btn btn-outline btn-sm self-start">
            Go to {PAGE_NAMES[guide.page]}
          </Link>
        ) : null}
      </div>
    </details>
  );
}
