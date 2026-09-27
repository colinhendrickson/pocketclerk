import { formatSignInCode } from "@/lib/sign-in-code";

/**
 * The admin sign-in email, rendered as plain text and HTML (the text body keeps
 * the code usable in clients without HTML). The code appears in the subject,
 * the preview line and as the largest element in the body. Colors are literal
 * copies of the committed `pocketclerk` theme, since mail clients do not load
 * stylesheets; a deployment's own theme is never read here.
 */

export interface SignInEmail {
  name: string;
  code: string;
  link: string;
  cartName: string;
  programName: string;
  /** Absolute URL of the deployment's logo, when one is configured. */
  logoUrl: string | null;
  /** Code lifetime, as shown to the reader. */
  expiresMinutes: number;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Mirrors the `pocketclerk` daisyUI theme in `src/app/globals.css`. */
const COLORS = {
  page: "#f5f0e8",
  card: "#fffcf7",
  border: "#e2d9cc",
  ink: "#1c2624",
  muted: "#4a5f5a",
  primary: "#0b6e5f",
  onPrimary: "#ffffff",
  codeWash: "#eef5f2",
} as const;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Escapes text for an HTML body or attribute. All interpolated values come from
 * configuration or the database and must not be able to inject markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderSignInEmail(email: SignInEmail): RenderedEmail {
  const code = formatSignInCode(email.code);

  // Code first, so it shows on a lock screen without opening the mail.
  const subject = `${code} is your ${email.cartName} sign-in code`;

  const text = [
    `${email.cartName}`,
    `${email.programName}`,
    "",
    `Hello ${email.name},`,
    "",
    `Your sign-in code:  ${code}`,
    "",
    "Type it on the sign-in screen. Use the code on the cart's iPad, so you",
    "never have to sign into your email on it.",
    "",
    "On a computer where your email is already open, this link does the same:",
    "",
    email.link,
    "",
    `Either one works once and expires in ${email.expiresMinutes} minutes.`,
    "Asking for a new code replaces this one.",
    "",
    `Someone asked to sign in to ${email.cartName} with this address. If it`,
    "was not you, ignore this email. Nobody can sign in without the code or",
    "the link.",
  ].join("\n");

  return { subject, text, html: renderHtml(email, code) };
}

function renderHtml(email: SignInEmail, code: string): string {
  const cart = escapeHtml(email.cartName);
  const program = escapeHtml(email.programName);
  const name = escapeHtml(email.name);
  const link = escapeHtml(email.link);
  const c = COLORS;

  const masthead = email.logoUrl
    ? `<img src="${escapeHtml(email.logoUrl)}" alt="${cart}" height="48" style="display:block;height:48px;width:auto;border:0;margin:0 auto 12px;">`
    : "";

  // Hidden inbox preview text. The trailing spacers stop clients filling the
  // preview with the start of the body.
  const preheader = `Your code is ${code}. It expires in ${email.expiresMinutes} minutes.`;
  const spacer = "&#847;&zwnj;&nbsp;".repeat(40);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(code)} is your ${cart} sign-in code</title>
</head>
<body style="margin:0;padding:0;background:${c.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}${spacer}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.page};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${c.card};border:1px solid ${c.border};border-radius:14px;">
        <tr>
          <td align="center" style="background:${c.primary};border-radius:13px 13px 0 0;padding:28px 24px 24px;font-family:${FONT};">
            ${masthead}
            <div style="font-size:22px;line-height:28px;font-weight:800;color:${c.onPrimary};">${cart}</div>
            <div style="font-size:13px;line-height:18px;font-weight:600;color:${c.onPrimary};opacity:0.85;margin-top:4px;">${program}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;font-family:${FONT};color:${c.ink};">
            <div style="font-size:13px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${c.muted};">Administrator sign-in</div>
            <p style="font-size:16px;line-height:24px;margin:12px 0 0;">Hello ${name},</p>
            <p style="font-size:16px;line-height:24px;margin:8px 0 0;">Here is your sign-in code. Type it on the sign-in screen.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 28px;">
            <div style="background:${c.codeWash};border:1px solid ${c.border};border-radius:10px;padding:18px 12px;font-family:${FONT};font-size:40px;line-height:44px;font-weight:800;letter-spacing:8px;color:${c.ink};font-variant-numeric:tabular-nums;">${escapeHtml(code)}</div>
            <div style="font-family:${FONT};font-size:13px;line-height:18px;color:${c.muted};margin-top:10px;">Works once. Expires in ${email.expiresMinutes} minutes.</div>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 28px 0;font-family:${FONT};color:${c.ink};">
            <p style="font-size:15px;line-height:22px;margin:0;"><strong>On the cart&rsquo;s iPad, use the code.</strong> There is no need to sign into your email on a device the students use.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 0;">
            <div style="border-top:1px solid ${c.border};"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 0;font-family:${FONT};color:${c.ink};">
            <p style="font-size:15px;line-height:22px;margin:0;">On a computer where your email is already open, this does the same thing:</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:16px 28px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background:${c.primary};border-radius:10px;">
                  <a href="${link}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:${c.onPrimary};text-decoration:none;border-radius:10px;">Sign in on this computer</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:20px 12px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${c.muted};text-align:center;">
            Someone asked to sign in to ${cart} with this address. If it was not you, ignore this email. Nobody can sign in without the code or the link, and asking for a new code replaces this one.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
