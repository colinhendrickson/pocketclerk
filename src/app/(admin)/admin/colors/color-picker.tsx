"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Logo } from "@/components";
import { DEFAULT_PRIMARY, PRESET_COLORS, checkPrimary, normalizeHex } from "@/lib/colors";

import { saveColor } from "./actions";

export interface ColorPickerProps {
  /** The saved color, or null for the theme's own. */
  saved: string | null;
}

/**
 * Choosing the main color.
 *
 * The preview repaints only itself, by setting the color variables on its own
 * box, so nothing else on the site changes until Save. The readability check
 * runs as the color changes and says, in words, whether it passes and what to
 * pick instead if not; the server runs the same check before saving.
 */
export function ColorPicker({ saved }: ColorPickerProps) {
  const router = useRouter();
  const [color, setColor] = useState(saved ?? DEFAULT_PRIMARY);
  const [typed, setTyped] = useState(saved ?? DEFAULT_PRIMARY);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hexId = useId();
  const pickerId = useId();
  const checkId = useId();

  const check = checkPrimary(color);
  const unchanged = color === (saved ?? DEFAULT_PRIMARY);

  function choose(hex: string) {
    setColor(hex);
    setTyped(hex);
    setMessage(null);
    setError(null);
  }

  function save(value: string | null) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await saveColor(value);
      if (result.ok) {
        setMessage(
          value === null
            ? "Back to the original teal. Every page uses it now."
            : "Saved. Every page, including the cart, uses this color now.",
        );
        router.refresh();
        return;
      }
      setError(
        result.error === "unreadable"
          ? "That color makes text too hard to read, so it was not saved."
          : "That is not a color. Pick one above, or type one like #1d4ed8.",
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="presets-heading" data-tour="color-presets" className="flex flex-col gap-3">
        <h2 id="presets-heading" className="text-lg font-extrabold">
          Pick a color
        </h2>
        <div role="radiogroup" aria-labelledby="presets-heading" className="flex flex-wrap gap-3">
          {PRESET_COLORS.map((preset) => {
            const selected = color === preset.hex;
            return (
              <button
                key={preset.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(preset.hex)}
                className={`btn h-auto min-h-11 gap-2 py-2 ${selected ? "btn-outline" : "btn-ghost"}`}
              >
                <span
                  aria-hidden="true"
                  className="grid size-7 place-items-center rounded-full border border-base-300"
                  style={{ backgroundColor: preset.hex }}
                >
                  {selected ? <Check size={16} className="text-white" /> : null}
                </span>
                {preset.name}
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="exact-heading" data-tour="color-exact" className="flex flex-col gap-3">
        <h2 id="exact-heading" className="text-lg font-extrabold">
          Or use an exact color
        </h2>
        <p className="max-w-prose text-sm opacity-75">
          To match the school&rsquo;s color exactly, choose it with the color picker, or type
          its code, which starts with # and is often in a school&rsquo;s brand guide or website.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor={pickerId} className="flex flex-col gap-1">
            <span className="text-sm font-bold opacity-75">Color picker</span>
            <input
              id={pickerId}
              type="color"
              value={color}
              onChange={(event) => choose(event.target.value)}
              className="h-11 w-20 cursor-pointer rounded-field border border-base-300 bg-base-100"
            />
          </label>
          <label htmlFor={hexId} className="flex flex-col gap-1">
            <span className="text-sm font-bold opacity-75">Color code</span>
            <input
              id={hexId}
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
                const hex = normalizeHex(event.target.value);
                if (hex) choose(hex);
              }}
              onBlur={() => setTyped(color)}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={checkId}
              className="input input-bordered w-36 font-mono"
            />
          </label>
        </div>
      </section>

      <section aria-labelledby="preview-heading" data-tour="color-preview" className="flex flex-col gap-3">
        <h2 id="preview-heading" className="text-lg font-extrabold">
          Preview
        </h2>
        <div
          className="flex flex-wrap items-center gap-4 rounded-box border border-base-300 bg-base-100 p-5"
          style={
            {
              "--color-primary": color,
              "--color-primary-content": check.buttonText,
            } as React.CSSProperties
          }
        >
          <Logo size={48} />
          <button type="button" tabIndex={-1} aria-hidden="true" className="btn btn-primary">
            Start classroom order
          </button>
          <span className="font-extrabold text-primary">A highlighted word</span>
          <progress className="progress progress-primary w-40" value={3} max={5} aria-hidden="true" />
        </div>

        <p
          id={checkId}
          role="status"
          className={`rounded-box p-3 text-sm font-bold ${check.ok ? "bg-base-200" : "alert alert-warning"}`}
        >
          {check.ok
            ? `Easy to read. Text on this color will be ${check.buttonText === "#ffffff" ? "white" : "near-black"}.`
            : "Too light: text on it, and this color as text, would be hard to read."}
        </p>
        {!check.ok && check.suggestion ? (
          <button
            type="button"
            onClick={() => choose(check.suggestion!)}
            className="btn btn-outline btn-sm self-start"
          >
            <span
              aria-hidden="true"
              className="size-4 rounded-full"
              style={{ backgroundColor: check.suggestion }}
            />
            Use a darker shade that reads well ({check.suggestion})
          </button>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3" data-tour="color-save">
        <button
          type="button"
          onClick={() => save(color === DEFAULT_PRIMARY ? null : color)}
          disabled={!check.ok || unchanged || pending}
          className="btn btn-primary"
        >
          {pending ? "Saving…" : "Save color"}
        </button>
        {saved !== null ? (
          <button type="button" onClick={() => save(null)} disabled={pending} className="btn btn-ghost">
            Back to the original teal
          </button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="alert alert-success rounded-box">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="alert alert-warning rounded-box">
          {error}
        </p>
      ) : null}
    </div>
  );
}
