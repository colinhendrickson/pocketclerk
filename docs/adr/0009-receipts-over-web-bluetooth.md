# 9. Receipts print over Web Bluetooth, in the Bluefy browser on iPad

Status: accepted (tickets 1.9, 3.5, 4.8); awaiting a test on the deployment's printer

## Context

The plan was a PDF receipt opened in the iOS print sheet, which reaches any
AirPrint printer. The program's printer turned out to be a small 58mm Bluetooth
thermal printer, the kind sold under many names for about $30, which AirPrint
cannot reach.

On an iPad, classic Bluetooth is closed to anything that is not an MFi-certified
accessory, and certified receipt printers cost several hundred dollars. Bluetooth
Low Energy is open, and a web page can use it through the Web Bluetooth API. But
Safari does not implement Web Bluetooth, and a web app added to the home screen
runs on Safari.

## Decision

Receipts are rendered as plain text and sent as ESC/POS, the command language
these printers share, over Web Bluetooth (`src/providers/printer/web-bluetooth.ts`,
behind the `ReceiptPrinter` interface).

The printers in this class are a handful of boards that disagree about which GATT
service carries the print characteristic, so the app does not hard-code one: it
asks for any device, then probes the known services and uses the first writable
characteristic. Only four ESC/POS commands are used (initialize, align, feed,
cut), the ones every firmware agrees on.

On the iPad the cart runs in Bluefy, a free browser that implements Web
Bluetooth, instead of Safari or a home-screen icon. The admin help explains this,
links to Bluefy on the App Store, and warns that each browser keeps its own device
pairing, so the pairing link has to be opened inside Bluefy.

Printing stays asynchronous ([ADR 2](0002-receipt-job-queue.md)): the iPad claims
its own print jobs from the queue, because no server can reach a printer paired
to a tablet. A sale never waits for the printer.

## Consequences

A $30 printer works, with no native app and no app store release.

The cart depends on a third-party browser. Guided Access can lock the iPad to it
as easily as to Safari, but it is one more thing staff have to be told, which is
why the setup guide and the checklist say it where they are read.

The deployment's printer, a PT-210, is dual-mode (classic and low energy) and
ESC/POS compatible. Two service UUIDs used by dual-mode boards were added to the
probe from their published values; it has not yet been tested with the printer in
hand. That test is an open item.
