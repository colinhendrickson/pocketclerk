import Link from "next/link";

import { branding } from "@/lib/branding";
import { listActiveStudents } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Sign-in: tap your name.
 *
 * Names are large targets in a grid rather than a dropdown or a typed field.
 * There is no free-text entry anywhere on this screen by design: the only thing
 * a student has to produce from memory is four digits, on the next screen.
 */
export default async function SignInPage() {
  const students = await listActiveStudents();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 p-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <p className="text-[18px] font-bold opacity-70">{branding.programName}</p>
        <h1 className="text-[44px] font-extrabold leading-tight">
          {branding.cartName}
        </h1>
        <p className="text-[22px] font-bold">Tap your name to start your shift</p>
      </header>

      {students.length === 0 ? (
        <p className="text-[20px] font-bold opacity-70">
          No students have been added yet.
        </p>
      ) : (
        <ul className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <li key={student.id}>
              <Link
                href={`/pin/${student.id}`}
                className="btn min-h-[96px] w-full justify-start gap-4 rounded-box border-base-300 bg-base-100 text-[26px] font-extrabold"
              >
                <span
                  aria-hidden="true"
                  className="avatar avatar-placeholder"
                >
                  <span className="grid size-[56px] place-items-center rounded-full bg-neutral text-neutral-content text-[24px] font-extrabold">
                    {student.displayName.charAt(0)}
                  </span>
                </span>
                {student.displayName}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
