import { ThemeColor } from "@/app/theme-color";

import { PrinterProvider } from "./printer-provider";

/**
 * Shell for every student-facing screen. `touch-action: manipulation` disables
 * accidental double-tap zoom on the kiosk; it is scoped here so the admin area
 * keeps pinch-zoom for accessibility. The printer lives here so its Bluetooth
 * connection outlasts page changes and shifts.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-full flex-1 flex-col bg-base-200 text-base-content [touch-action:manipulation]"
    >
      <ThemeColor />
      <PrinterProvider>{children}</PrinterProvider>
    </div>
  );
}
