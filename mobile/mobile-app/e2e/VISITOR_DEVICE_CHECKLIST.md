# Visitor management — device checklist (P10)

The automated suite (`npm run test:e2e:visitor`) drives the real screens against a real
backend, but it runs in Jest. A few things only a real phone can prove. Run this list on
an Android device (and iOS if available) against a staging backend before release.

Use two phones where a step needs two people: **R** = resident, **G** = guard.
Tick each step; note the build number and device at the top.

## 1. Camera scanning (guard)
- [ ] G: open Gate Console → camera permission prompt appears once; after "Allow" the live preview shows.
- [ ] G: deny permission on a fresh install → the console offers a "grant permission" action instead of a black box.
- [ ] R: create a guest pass → G scans the QR from R's screen at arm's length, in daylight and under indoor light.
- [ ] G: scan the same QR from a printed/WhatsApp-forwarded image.
- [ ] G: scan a supermarket barcode → shown as not a visitor pass, no crash.
- [ ] G: torch toggle works; minimise/restore the scanner keeps working.
- [ ] G: after "Confirm Gate Entry", the scanner is ready for the next visitor without reopening the screen.

## 2. Sharing the pass (resident)
- [ ] R: "Share Barcode & Pass to WhatsApp" opens WhatsApp with the QR image and the 6-digit code.
- [ ] R: without WhatsApp installed → the system share sheet opens instead (no broken wa.me page).
- [ ] R: "Share Pass" text contains the visitor name, code and validity; "Copy Code" puts exactly the 6 digits on the clipboard.
- [ ] Visitor (no app): the shared link opens the public pass page showing name and validity, **not** the phone number.

## 3. Push notifications and deep links
- [ ] G sends a walk-in for R's villa → R's phone (app in background) gets "Gate Approval Required" within ~5 s on the high-priority visitor channel.
- [ ] R taps that notification from a killed app → lands on **Gate Walk-In Approvals** with the request listed.
- [ ] R approves → G's Walk-Ins board flips to **APPROVED** without pulling to refresh; G also gets "Walk-in Entry Approved".
- [ ] R denies another → G sees **DENIED BY HOST** live.
- [ ] Visitor checks in / out → R gets "Visitor Checked In" / "Checked Out"; tapping opens Visitor Passes.
- [ ] Another resident's phone (same community) receives **none** of R's gate notifications.

## 4. Connectivity
- [ ] G: airplane mode, confirm entry → a clear error is shown; the visitor is **not** marked admitted. Reconnect and retry works.
- [ ] R: airplane mode while a walk-in is resolved elsewhere → on reconnect the stale request disappears; tapping Approve on it shows "already resolved".
- [ ] Kill and reopen the app on each role → the correct home tiles for the role (resident: passes; guard: Gate Console; admin: Admin Console, Blacklist, Community Passes).

## 5. Time and locale
- [ ] Create a pass between 00:00 and 05:30 IST → its date is today, not yesterday.
- [ ] "Arriving Now" guest pass → valid for 4 hours from creation.
- [ ] Switch app language (e.g. Hindi/Arabic) → wizard buttons, revoke/check-out confirmations read as actions, not questions.

## Known limits of the automated suite
- The camera is simulated by feeding the scanned text; lens focus, lighting and barcode formats are covered only here.
- Push delivery (FCM/APNs) is not exercised; the suite checks the notification records and the screen they open.
- The Jest clock is real; time-window rules are tested relative to "now", so an unusual device clock is covered only here.
