"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

export interface PairingLinkProps {
  url: string;
  /** The signed-in admin's address, so "Email it to me" needs no typing. */
  email: string;
}

/**
 * The link that connects the cart's iPad, and two ways to get it onto the iPad.
 *
 * Typing a long link on an iPad is where setup stalls, so the realistic path is
 * to email it to yourself and tap it there. Copying covers everyone else.
 */
export function PairingLink({ url, email }: PairingLinkProps) {
  const [copied, setCopied] = useState(false);

  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    "Connect the cart's iPad",
  )}&body=${encodeURIComponent(`Open this on the cart's iPad:\n\n${url}`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard access can be refused; the link is on screen to select.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <code className="block break-all rounded-box bg-base-200 p-3 text-sm">{url}</code>
      <div className="flex flex-wrap gap-2">
        <a href={mailto} className="btn btn-outline btn-sm">
          <Mail size={16} aria-hidden="true" />
          Email it to me
        </a>
        <button type="button" onClick={copy} className="btn btn-outline btn-sm">
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p role="status" className="sr-only">
        {copied ? "Link copied." : ""}
      </p>
    </div>
  );
}
