// TypeScript 6 no longer loads @types packages on its own; name this one.
/// <reference types="web-bluetooth" />

import { renderReceiptText, type Receipt } from "../renderer/receipt";
import type { PrintResult, ReceiptPrinter } from "./index";

/**
 * Drives a cheap 58mm Bluetooth thermal printer straight from the browser.
 *
 * Why this exists in the browser at all: the printer is paired to the tablet,
 * not to a network, so no server can reach it. The receipt queue accounts for
 * that by letting the tablet claim its own print jobs.
 *
 * Why Bluetooth Low Energy specifically: iPadOS refuses classic Bluetooth to
 * anything that is not an MFi-certified accessory, and MFi printers start at
 * several hundred dollars. Low-energy printers are reachable from a web page,
 * which is the whole reason the hardware was chosen this way. Safari does not
 * implement Web Bluetooth, so on iPad the application runs inside a browser
 * that does; Chrome on Android works without that step.
 *
 * The printers in this price range are the same handful of boards sold under
 * many names, and they do not agree on which GATT service carries the print
 * characteristic. Rather than hard-code one vendor's UUIDs, this probes the
 * known candidates and uses the first writable characteristic it finds.
 */

/**
 * GATT services seen on commodity ESC/POS printers, most common first.
 *
 * The last two are for dual-mode (classic and low-energy) boards like the
 * PT-210 the first deployment uses: the service many cheap Chinese printer
 * boards expose over BLE, and the Microchip/ISSC "transparent UART" used by
 * dual-mode Bluetooth modules. Added from their published UUIDs, not yet
 * confirmed against a PT-210 in hand; the probe tries every candidate, so an
 * extra one costs nothing.
 */
const CANDIDATE_SERVICES: BluetoothServiceUUID[] = [
  0xff00,
  0xffe0,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  0xffe5,
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

/** BLE writes are capped by the negotiated MTU; 180 is safe across firmwares. */
const CHUNK_BYTES = 180;

const ESC = 0x1b;
const GS = 0x1d;

export class WebBluetoothPrinter implements ReceiptPrinter {
  readonly name = "web-bluetooth";
  readonly runsOn = "client" as const;

  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private device: BluetoothDevice | null = null;

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  async isReady(): Promise<boolean> {
    return this.characteristic !== null && this.device?.gatt?.connected === true;
  }

  /**
   * Opens the browser's device chooser and connects.
   *
   * Must be called from a user gesture; the browser refuses otherwise, which is
   * why the shift screen has an explicit "Connect printer" button rather than
   * connecting on load. One tap per shift.
   */
  async connect(): Promise<void> {
    if (!WebBluetoothPrinter.isSupported()) {
      throw new Error(
        "This browser cannot reach Bluetooth printers. On an iPad, open the cart in the Bluefy browser instead of Safari.",
      );
    }

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: CANDIDATE_SERVICES,
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error("Could not connect to the printer.");

    this.characteristic = await findWritableCharacteristic(server);
    if (!this.characteristic) {
      throw new Error(
        "Connected, but this printer does not expose a service the app can write to.",
      );
    }

    this.device = device;
    // A printer that is switched off mid-shift should surface as not-ready
    // rather than as a write that hangs.
    device.addEventListener("gattserverdisconnected", () => {
      this.characteristic = null;
    });
  }

  async print(receipt: Receipt): Promise<PrintResult> {
    if (!this.characteristic) {
      return { ok: false, error: "Printer is not connected." };
    }

    try {
      await this.writeChunked(encodeReceipt(receipt));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Print failed.",
      };
    }
  }

  /**
   * Writes in MTU-sized pieces, without a response.
   *
   * These printers have small buffers and drop bytes when a large payload
   * arrives faster than the head can consume it, so each chunk is followed by a
   * short pause. It is slower than it needs to be on good firmware and correct
   * on bad firmware, which is the right trade for a receipt that takes a second
   * either way.
   */
  private async writeChunked(bytes: Uint8Array): Promise<void> {
    const characteristic = this.characteristic;
    if (!characteristic) throw new Error("Printer is not connected.");

    for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
      const chunk = bytes.slice(offset, offset + CHUNK_BYTES);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValue(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

async function findWritableCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  for (const uuid of CANDIDATE_SERVICES) {
    try {
      const service = await server.getPrimaryService(uuid);
      for (const characteristic of await service.getCharacteristics()) {
        const { write, writeWithoutResponse } = characteristic.properties;
        if (write || writeWithoutResponse) return characteristic;
      }
    } catch {
      // This printer does not expose that service. Try the next candidate.
    }
  }
  return null;
}

/**
 * Encodes the receipt as ESC/POS.
 *
 * Only four commands are used: initialise, set alignment, feed, and cut. Every
 * printer in this class implements them, and anything more elaborate is where
 * the cheap firmwares start to differ from each other.
 */
export function encodeReceipt(receipt: Receipt): Uint8Array {
  const text = renderReceiptText(receipt);
  const body = new TextEncoder().encode(`${text}\n`);

  const prefix = Uint8Array.from([
    ESC, 0x40, // initialise
    ESC, 0x61, 0x00, // align left
  ]);
  const suffix = Uint8Array.from([
    0x0a, 0x0a, 0x0a, // feed past the tear bar
    GS, 0x56, 0x01, // partial cut, ignored by printers without a cutter
  ]);

  const out = new Uint8Array(prefix.length + body.length + suffix.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  out.set(suffix, prefix.length + body.length);
  return out;
}
