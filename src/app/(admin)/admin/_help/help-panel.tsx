import { CircleHelp } from "lucide-react";

import { PAGE_HELP, guideById, type AdminRoute } from "@/lib/help";

import { GuideView } from "./guide-view";
import { RememberedDetails } from "./remembered-details";

export interface HelpPanelProps {
  route: AdminRoute;
}

/**
 * "About this page": what the page is for, and the tasks people come to it
 * for, each opening into its steps right here, without leaving the page.
 *
 * Every admin page renders one under its heading; tests/help.test.ts fails if
 * a page does not.
 */
export function HelpPanel({ route }: HelpPanelProps) {
  const help = PAGE_HELP[route];
  const guides = help.tasks.map(guideById).filter((guide) => guide !== undefined);

  return (
    <div data-tour="help">
      <RememberedDetails
        storageKey={`pocketclerk:help:${route}`}
        className="rounded-box border border-base-300 bg-base-100"
        summaryClassName="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-2 font-extrabold"
        summary={
          <>
            <CircleHelp size={20} aria-hidden="true" className="shrink-0 text-info" />
            About this page
          </>
        }
      >
        <div className="flex flex-col gap-3 px-4 pb-4">
          <p className="max-w-prose">{help.purpose}</p>
          <h2 className="text-sm font-extrabold opacity-70">How do I…</h2>
          <div className="flex flex-col gap-2">
            {guides.map((guide) => (
              <GuideView key={guide.id} guide={guide} currentRoute={route} />
            ))}
          </div>
        </div>
      </RememberedDetails>
    </div>
  );
}
