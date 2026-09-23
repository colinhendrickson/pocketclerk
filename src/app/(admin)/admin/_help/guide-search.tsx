"use client";

import { useEffect, useId, useMemo, useState } from "react";

import type { Guide, GuideTopic } from "@/lib/help/types";

import { GuideView } from "./guide-view";

export interface GuideSearchProps {
  topics: GuideTopic[];
  guides: Guide[];
}

/**
 * Every guide, grouped by topic, with a box to narrow them down.
 *
 * The search matches the words in a guide's steps as well as its title, since
 * people search for what they see ("PIN", "receipt", "email"), not for how a
 * guide happens to be titled. The number of matches is announced as it changes.
 */
export function GuideSearch({ topics, guides }: GuideSearchProps) {
  const [query, setQuery] = useState("");
  const inputId = useId();

  // "How to do this" in the setup checklist links to #guide-<id>. A link to a
  // closed guide would scroll to a one-line title, so the guide is opened,
  // shown even if a search was hiding it, and given focus.
  useEffect(() => {
    function openFromHash() {
      if (!window.location.hash.startsWith("#guide-")) return;
      setQuery("");
      requestAnimationFrame(() => {
        const target = document.getElementById(window.location.hash.slice(1));
        if (!(target instanceof HTMLDetailsElement)) return;
        target.open = true;
        target.scrollIntoView({ block: "start" });
        target.querySelector("summary")?.focus();
      });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return guides;
    return guides.filter((guide) => {
      const text = [guide.title, ...guide.steps, guide.note ?? ""].join(" ").toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [guides, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-bold">
          Search the guides
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="For example: PIN, receipt, price"
          autoComplete="off"
          className="input input-bordered w-full max-w-md"
        />
        <p aria-live="polite" className="text-sm opacity-70">
          {query.trim() === ""
            ? `${guides.length} guides`
            : matches.length === 0
              ? "No guides match. Try a different word."
              : `${matches.length} ${matches.length === 1 ? "guide matches" : "guides match"}`}
        </p>
      </div>

      {topics.map((topic) => {
        const inTopic = matches.filter((guide) => guide.topic === topic);
        if (inTopic.length === 0) return null;
        return (
          <section key={topic} className="flex flex-col gap-2">
            <h3 className="font-extrabold">{topic}</h3>
            {inTopic.map((guide) => (
              <GuideView key={guide.id} guide={guide} currentRoute="/admin" />
            ))}
          </section>
        );
      })}
    </div>
  );
}
