import { listCrew, type ActiveShift } from "@/lib/queries";
import { getCrewSession, getShiftSession } from "@/lib/session";

export interface CrewSession {
  /** The student at the register, or null if their shift is not open today. */
  current: ActiveShift | null;
  /** Everyone clocked in on this iPad, longest-working first, the register included. */
  crew: ActiveShift[];
}

/** Reads the crew for a student page (ticket 4.21; src/lib/crew.ts). */
export async function loadCrew(): Promise<CrewSession> {
  const [currentId, crewIds] = await Promise.all([getShiftSession(), getCrewSession()]);
  const crew = await listCrew(crewIds);
  return { current: crew.find((member) => member.id === currentId) ?? null, crew };
}
