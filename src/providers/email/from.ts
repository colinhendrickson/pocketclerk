/**
 * The `From` header, with a name a person can recognise.
 *
 * `EMAIL_FROM` is usually a bare address, and a bare address is what an inbox
 * shows: the first sign-in email arrived as "info", indistinguishable from any
 * other automated mail. Wrapping it in the cart's name makes the sender line
 * say what the message is from before anyone opens it.
 *
 * An address that already carries a display name is left alone, so a
 * deployment that wants a different sender name can set one in `EMAIL_FROM`
 * and have it respected.
 *
 * The name is quoted and escaped rather than inserted raw. `&`, commas and
 * full stops are ordinary in a cart's name and change how a header parses when
 * unquoted; a line break would start a new header entirely. Pure, so the rules
 * are tested directly.
 */
export function formatFrom(address: string, displayName: string): string {
  const trimmed = address.trim();
  if (trimmed.includes("<")) return trimmed;

  const name = displayName
    .replace(/[\r\n]+/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .trim();

  return name ? `"${name}" <${trimmed}>` : trimmed;
}
