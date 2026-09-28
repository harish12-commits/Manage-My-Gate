# Amenity Management — Device Checklist

Checks the automated E2E suite cannot cover (native camera, the Razorpay WebView, push delivery,
sharing). Run on a physical Android and iOS device against a staging backend with Razorpay in test
mode. Tick each item and note the device / OS.

## Resident

- [ ] Book a court and pay **online**: the Razorpay page opens, a test card/UPI succeeds, the app
      shows "Reservation Confirmed!" and the booking appears in My Bookings as Paid.
- [ ] Cancel the Razorpay page midway: the app says the payment was cancelled; the time stays held
      until the countdown ends; no booking is created.
- [ ] Book the party hall (advance): pay the advance from the wallet; later pay the balance
      **online** from the booking detail.
- [ ] Top up the wallet from the booking wizard when the balance is too low.
- [ ] Open the gate pass and **share** it (WhatsApp); the shared QR scans at the gate.
- [ ] Receive a **push notification** when staff approve / reject / cancel a booking; tapping it
      opens the booking detail (app in background and app closed).
- [ ] My Bookings updates live when staff act on a booking while the screen is open.

## Guard

- [ ] Scan a resident's QR with the **camera** in low light and with the flashlight on.
- [ ] Scan a pay-at-gate booking: "Collect ₹X cash & admit" records the cash and admits.
- [ ] Scan a borrowed item on return: the inspection sheet opens; the keypad accepts the damage
      amount; the result shows the deposit returned / kept.
- [ ] A pass scanned before its window shows the earliest entry time in local time.

## Staff

- [ ] Receive push notifications for approval requests and bookings needing review; tapping opens
      the Booking Queue.
- [ ] Book for a resident from the Booking Queue; the resident gets the confirmation.
- [ ] Export the ledger CSV and open it on the device.
