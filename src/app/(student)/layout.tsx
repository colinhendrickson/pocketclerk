import { ThemeColor } from "@/app/theme-color";

/**
 * Shell for every student-facing screen.
 *
 * `touch-action: manipulation` disables double-tap-to-zoom, which on a kiosk is
 * only ever triggered by accident and leaves the screen stuck at an unusable
 * magnification mid-order. It is applied here and not globally: the admin area
 * is a desktop surface where pinch-zoom is a legitimate accessibility tool.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-full flex-1 flex-col bg-base-200 text-base-content [touch-action:manipulation]"
    >
      <ThemeColor />
      {children}
    </div>
  );
}
