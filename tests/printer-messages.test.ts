import { describe, expect, it } from "vitest";

import { PrinterSetupError, connectErrorMessage, printErrorMessage } from "@/providers/printer/messages";

/**
 * What a student sees when the printer does not work. Browser error text, such
 * as "User cancelled the requestDevice() chooser.", never reaches the screen.
 */

function domError(name: string, message: string) {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("connectErrorMessage", () => {
  it("says nothing when the chooser was closed without picking a printer", () => {
    expect(connectErrorMessage(domError("NotFoundError", "User cancelled the requestDevice() chooser."))).toBeNull();
  });

  it("keeps the app's own setup messages", () => {
    const own = new PrinterSetupError("Open the cart in the Bluefy browser.");
    expect(connectErrorMessage(own)).toBe("Open the cart in the Bluefy browser.");
  });

  it("explains blocked Bluetooth in plain words", () => {
    expect(connectErrorMessage(domError("SecurityError", "Bluetooth adapter not available."))).toMatch(/Bluetooth/);
    expect(connectErrorMessage(domError("SecurityError", "x"))).not.toMatch(/adapter|SecurityError/);
  });

  it("gives a plain sentence for anything else", () => {
    const message = connectErrorMessage(domError("NetworkError", "GATT Server is disconnected."));
    expect(message).toMatch(/^[A-Z]/);
    expect(message).not.toMatch(/GATT|NetworkError|requestDevice/);
    expect(connectErrorMessage("weird")).not.toBeNull();
  });
});

describe("printErrorMessage", () => {
  it("tells the student what to check, not what the browser said", () => {
    const message = printErrorMessage();
    expect(message).toMatch(/paper|on/);
  });
});
