/**
 * ESC/POS printers start in code page 437, so anything outside printable ASCII
 * prints as garbage and throws off column padding. Receipt text is reduced to
 * printable ASCII before it is laid out.
 */

const REPLACEMENTS: [RegExp, string][] = [
  [/[‘’‚‛′ʼ]/g, "'"],
  [/[“”„‟″]/g, '"'],
  [/[‐-―−]/g, "-"],
  [/…/g, "..."],
  [/[  -   　]/g, " "],
  // Invisible joiners, variation selectors and skin tones, so one emoji
  // becomes one "?".
  [/[​-‍⁠︀-️﻿\u{1f3fb}-\u{1f3ff}]/gu, ""],
];

export function toPrintableAscii(text: string): string {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // NFKD splits accented letters into base letter plus combining mark.
  out = out.normalize("NFKD").replace(/\p{M}/gu, "");

  let ascii = "";
  for (const char of out) {
    const code = char.codePointAt(0) ?? 0;
    ascii += code >= 0x20 && code <= 0x7e ? char : "?";
  }
  return ascii;
}
