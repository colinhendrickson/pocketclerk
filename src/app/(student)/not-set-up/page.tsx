import { Logo } from "@/components";
import { PRODUCT_NAME } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

/**
 * What an unpaired visitor sees.
 *
 * Deliberately says almost nothing. No student names, no menu, no indication of
 * how to get in. Someone who reached this address by accident learns only that
 * the cart exists, which the branding already tells them.
 */
export default function NotSetUpPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <Logo size={72} />
      <h1 className="text-[34px] font-extrabold">{PRODUCT_NAME}</h1>
      <p className="max-w-md text-[22px] font-bold">
        This device is not set up for the cart yet.
      </p>
      <p className="max-w-md text-[18px] font-bold opacity-70">
        Ask the teacher who looks after the cart to set it up on this iPad.
      </p>
    </main>
  );
}
