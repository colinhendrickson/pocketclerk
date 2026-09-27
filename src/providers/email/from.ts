/**
 * Builds the `From` header, adding the cart's name as the display name unless
 * `EMAIL_FROM` already has one. The name is quoted and escaped, and line breaks
 * are stripped to prevent header injection.
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
