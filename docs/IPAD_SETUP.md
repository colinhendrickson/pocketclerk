# Setting up the iPad

A one-page guide for whoever runs the cart. No technical knowledge assumed.

This takes about ten minutes, once. After that the iPad is ready every morning.

---

## 1. Install Bluefy and connect the iPad

The cart's receipt printer connects over Bluetooth, and Apple does not let Safari
talk to it. **Bluefy** is a free browser that can, so the cart runs in Bluefy.

1. On the iPad, open the **App Store**, search for **Bluefy – Web BLE Browser**,
   and install it. It is free and has no ads.
2. On the admin side (on any device), open **Admin home**. In the setup
   checklist, find **Connect the cart's iPad** and press **Email it to me**.
3. On the iPad, open that email. **Press and hold** the link, choose **Copy**,
   then open **Bluefy** and paste it into the address bar. Do not just tap the
   link: that opens Safari, and the iPad would be connected in Safari instead.
4. The iPad shows the list of students. It is connected, and stays connected in
   Bluefy.

> **No printer?** Then Safari works too: open the connection link in Safari, tap
> **Share → Add to Home Screen**, and use that icon. Everything else on this page
> is the same.

## 2. Lock the iPad to the app

This is the important step. It stops a student leaving the app, opening
settings, or getting into anything else on the device.

1. Open **Settings → Accessibility → Guided Access**.
2. Turn **Guided Access** on.
3. Tap **Passcode Settings → Set Guided Access Passcode** and choose a code.
   **Do not use the same code as a student PIN.** Write it somewhere you will
   find it; there is no way to recover it from the iPad.
4. Turn **Accessibility Shortcut** on.

To lock the iPad each morning:

1. Open **Bluefy** (or the cart's home-screen icon, on a cart with no printer).
2. **Triple-click the side button.**
3. Tap **Start**.

To unlock it at the end of the day, triple-click the side button again and enter
your passcode.

While Guided Access is on, the home button and app switcher do nothing. The
student can only use the cart.

## 3. Stop the screen turning off mid-shift

1. **Settings → Display & Brightness → Auto-Lock**.
2. Choose **Never**.

Keep the iPad on a charger between shifts, since this uses more battery.

---

## Every morning

1. Wake the iPad and open Bluefy.
2. Triple-click the side button, tap **Start**.
3. Turn the printer on (hold its power button until the light comes on). Once a
   student has signed in, tap **Connect printer** on their shift screen and
   choose the printer, usually named after its model, such as PT-210. It stays
   connected for the rest of the shift.
4. Hand it to the student.

## Every evening

1. Triple-click the side button, enter your passcode, tap **End**.
2. Put the iPad on its charger.

---

## If something goes wrong

**A student is stuck on a screen.** Tap the back arrow at the top left. Every
screen except the sign-in screen has one.

**A student forgot their PIN.** After five wrong tries the app locks that
student out for fifteen minutes. Set a new PIN on the admin **Students** page
(**Reset PIN**), which also ends the lockout.

**The printer will not connect.** Check that the cart is open in Bluefy, not
Safari, and that the printer is switched on, charged and has paper, then tap
**Connect printer** again. You do not need to pair it in the iPad's Bluetooth
settings. Receipts are never lost while the printer is off: they queue up and
print once it is working.

**The cart shows "This device is not set up".** It is open in a browser that has
not been connected, usually Safari instead of Bluefy. Repeat step 1.

**"No AirPrint printers found" or similar.** That message is not about this app.
The cart's printer connects over Bluetooth, not the school network.

**The app will not load at all.** Check the iPad is on WiFi. If the app still
does not load, orders cannot be taken; the cart can still run on paper and the
orders entered later.

**You cannot get out of Guided Access.** Triple-click the side button and enter
the passcode. If the passcode is lost, hold the top button and either volume
button to force a restart, which ends Guided Access.

---

## Signing in to the admin pages from the iPad

Apart from connecting it once (step 1), keep your email off the cart's iPad.
It is a shared device a student uses, and a mailbox opened on it stays open;
if you opened Mail for step 1, sign out of it afterwards.

You do not have to. Go to the address and add **/admin**, type your email
address, and a six-digit code arrives on your phone. Usually you can read it
straight off the notification without opening the mail. Type the code on the
iPad and you are in.

The same email also has a link, which is the quicker option on a computer where
your mail is already open. Either one works once and expires in fifteen minutes.
After five wrong codes, ask for a new one.

## What the student sees

1. **Tap your name**, then enter a four-digit PIN. That clocks them in.
2. **Start classroom order** is the big button. Pick a teacher, tap items, then
   count the change.
3. **Inventory** at the end of the shift: count what is left, restock what is
   low.
4. **Clock out** once the closing checklist is finished. Hours and rewards are
   worked out automatically.
