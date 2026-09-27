// TypeScript 6 no longer loads @types packages on its own; name this one.
/// <reference types="web-bluetooth" />

import { renderReceiptText, type Receipt } from "../renderer/receipt";
import type { PrintResult, ReceiptPrinter } from "./index";

/**
 * Drives a 58mm BLE thermal printer from the tablet's browser, since no server
 * can reach a printer paired to the tablet. Commodity boards disagree on which
 * GATT service carries the print characteristic, so this probes known
 * candidates and uses the first writable one.
 * See docs/adr/0009-receipts-over-web-bluetooth.md.
 */

/**
 * GATT services seen on commodity ESC/POS printers, most common first. The last
 * two cover dual-mode boards (a common vendor service and the Microchip/ISSC
 * transparent UART); they come from published UUIDs and are not yet confirmed
 * on hardware.
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

  /** Opens the device chooser and connects. Must be called from a user gesture. */
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
    // Surface a powered-off printer as not ready instead of a hanging write.
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
   * Writes in MTU-sized chunks with a short pause after each, because these
   * printers have small buffers and drop bytes when fed too fast.
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
      // Service not present; try the next candidate.
    }
  }
  return null;
}

/**
 * Encodes the receipt as ESC/POS using only initialize, align, feed and cut,
 * the subset every printer in this class implements consistently.
 */
export function encodeReceipt(receipt: Receipt): Uint8Array {
  const text = renderReceiptText(receipt);
  const body = new TextEncoder().encode(`${text}\n`);

  const prefix = Uint8Array.from([
    ESC, 0x40, // initialize
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
