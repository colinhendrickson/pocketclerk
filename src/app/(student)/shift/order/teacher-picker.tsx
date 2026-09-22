"use client";

import { UserPlus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { BigButton, TeacherCard } from "@/components";
import type { TeacherSummary } from "@/lib/queries";

import { createTeacher } from "../../actions";

export interface TeacherPickerProps {
  teachers: TeacherSummary[];
  onPick: (teacher: TeacherSummary) => void;
}

/**
 * Choosing a customer, or adding one.
 *
 * Filtering is by initial letter rather than a search field. A cart that serves
 * forty classrooms needs some way to narrow the list, and a row of letter
 * buttons does that without a keyboard: no spelling, no autocorrect, no
 * software keyboard covering half the screen. The letters shown are only the
 * ones that actually have teachers behind them, so a tap always produces
 * results and never an empty screen.
 */
export function TeacherPicker({ teachers, onPick }: TeacherPickerProps) {
  const [letter, setLetter] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  /** Teachers are stored as "Mrs. Smith", so the surname drives the letter. */
  const initialOf = (name: string) => {
    const parts = name.trim().split(/\s+/);
    const surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    return surname.charAt(0).toUpperCase();
  };

  const letters = useMemo(
    () => [...new Set(teachers.map((t) => initialOf(t.name)))].sort(),
    [teachers],
  );

  const visible = letter
    ? teachers.filter((t) => initialOf(t.name) === letter)
    : teachers;

  if (adding) {
    return <AddTeacherForm onCancel={() => setAdding(false)} onCreated={onPick} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      {letters.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by last name">
          <button
            type="button"
            onClick={() => setLetter(null)}
            aria-pressed={letter === null}
            className={`btn min-h-[60px] min-w-[60px] text-[20px] font-extrabold ${
              letter === null ? "btn-secondary" : "btn-outline btn-secondary"
            }`}
          >
            All
          </button>
          {letters.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLetter(l === letter ? null : l)}
              aria-pressed={l === letter}
              className={`btn min-h-[60px] min-w-[60px] text-[20px] font-extrabold ${
                l === letter ? "btn-secondary" : "btn-outline btn-secondary"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((teacher) => (
          <TeacherCard
            key={teacher.id}
            name={teacher.name}
            room={teacher.room ? `Room ${teacher.room}` : undefined}
            noteCount={teacher.notes.length}
            onSelect={() => onPick(teacher)}
          />
        ))}
      </div>

      <BigButton icon={UserPlus} onClick={() => setAdding(true)} className="mt-auto">
        Add a teacher who is not on the list
      </BigButton>
    </div>
  );
}

interface AddTeacherFormProps {
  onCancel: () => void;
  onCreated: (teacher: TeacherSummary) => void;
}

/**
 * The only free-text entry in the student flow.
 *
 * It exists because the client's specification requires it: a cart that reaches
 * a classroom whose teacher is not on the list has to be able to serve them.
 * Email is optional, since a teacher without one simply gets a paper receipt.
 */
function AddTeacherForm({ onCancel, onCreated }: AddTeacherFormProps) {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTeacher({ name, room, email });
      if (result.ok) {
        onCreated({ ...result.teacher });
        return;
      }
      setError(
        result.error === "duplicate"
          ? "That teacher is already on the list."
          : result.error === "no_shift"
            ? "Your shift ended. Sign in again."
            : "Check the name, and the email if you entered one.",
      );
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
      <h2 className="text-[34px] font-extrabold">Add a teacher</h2>

      <label className="flex flex-col gap-2">
        <span className="text-[20px] font-bold">Name</span>
        <input
          id="teacher-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          placeholder="Mrs. Smith"
          className="input input-bordered min-h-[60px] text-[22px] font-bold"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[20px] font-bold">Room (optional)</span>
        <input
          id="teacher-room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="114"
          className="input input-bordered min-h-[60px] text-[22px] font-bold"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-[20px] font-bold">Email (optional)</span>
        <input
          id="teacher-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="off"
          placeholder="teacher@example.edu"
          className="input input-bordered min-h-[60px] text-[22px] font-bold"
        />
        <span className="text-[18px] font-bold opacity-70">
          Leave this empty if you do not know it. They will still get a printed
          receipt.
        </span>
      </label>

      {error ? (
        <p role="alert" className="alert alert-warning rounded-box text-[22px] font-extrabold">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-4">
        <BigButton
          variant="primary"
          disabled={pending || name.trim().length < 2}
          onClick={submit}
        >
          {pending ? "Saving…" : "Save and start the order"}
        </BigButton>
        <BigButton disabled={pending} onClick={onCancel}>
          Back to the list
        </BigButton>
      </div>
    </div>
  );
}
