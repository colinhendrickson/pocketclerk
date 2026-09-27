import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";

// Import from types directly: the help index pulls in server-only code, and
// this component is also used client-side.
import { PAGE_NAMES, type AdminRoute, type Guide } from "@/lib/help/types";

export interface GuideViewProps {
  guide: Guide;
  /** Current page, so the guide omits a link back to it. */
  currentRoute?: AdminRoute;
}

/**
 * One guide as a disclosure with numbered steps. Shared by the per-page help
 * panel and the Admin home guide list; the `id` is a link target.
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
        {guide.link ? <OutsideLink {...guide.link} /> : null}
      </div>
    </details>
  );
}

/** External link that opens in a new tab. */
export function OutsideLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-outline btn-sm self-start"
    >
      {label}
      <ExternalLink size={16} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
