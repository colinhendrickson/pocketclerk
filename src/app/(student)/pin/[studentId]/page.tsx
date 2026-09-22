import Link from "next/link";
import { notFound } from "next/navigation";

import { getStudent } from "@/lib/queries";

import { PinForm } from "./pin-form";
import { requirePairedDevice } from "@/app/(student)/require-device";

export const dynamic = "force-dynamic";

export default async function PinPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  await requirePairedDevice();
  const { studentId } = await params;
  const student = await getStudent(studentId);
  if (!student || !student.active) notFound();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <PinForm studentId={student.id} studentName={student.displayName} />
      <Link href="/" className="btn btn-ghost min-h-[60px] text-[20px] font-bold">
        Not you? Go back
      </Link>
    </main>
  );
}
