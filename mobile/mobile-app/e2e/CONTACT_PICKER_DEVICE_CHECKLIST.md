# Contact Picker & International Phone — Device Checklist

Contact access is native, so a **new EAS build** is required (an OTA update cannot add the `READ_CONTACTS` permission or the iOS usage text).

Before testing, save these contacts on the device:

| Contact | Numbers |
|---|---|
| Ravi Local | `098765 43210` (no country code) |
| Aisha UAE | `+971 50 123 4567` |
| Sam Multi | `+44 7400 123456` (mobile), `+1 415 555 2671` (work) |
| No Number | email only: `nonum@example.com` |

## 1. Permission (Android)
- [ ] First tap on the contacts icon shows the system permission prompt.
- [ ] Deny → "Contacts access needed" alert; **Open Settings** opens app settings; the field can still be typed manually.
- [ ] Deny with "don't ask again" → the next tap shows the alert without a system prompt.
- [ ] Allow → the system contact picker opens.

## 2. Permission (iOS)
- [ ] The picker opens with **no** permission prompt.

## 3. Picking (repeat on each screen below)
- [ ] Ravi Local → name filled, phone shows 🇮🇳 +91 `9876543210` (community country IN).
- [ ] Aisha UAE → country switches to 🇦🇪 +971, number `501234567`.
- [ ] Sam Multi → "choose a number" sheet lists both; the chosen one fills and sets the flag.
- [ ] No Number → name filled, phone left unchanged.
- [ ] Cancel the picker → nothing changes.
- [ ] Fields stay editable after a pick.

| Screen | Role | Also fills |
|---|---|---|
| Invite visitor → Guest details | Resident | name |
| Invite visitor → Group → Add guests | Resident | name (add several) |
| Staff pass → Staff details | Resident | name |
| Cab pass → Driver phone | Resident | — |
| Amenity booking → Additional guests | Resident | name |
| Staff & vendor directory → Invite | Admin | name, email |
| Complaint → Assign → External vendor | Admin | vendor name |
| Villas → Villa details → Invite resident | Admin | email |
| Visitor admin → Blacklist visitor | Admin | name |

## 4. International numbers without contacts
- [ ] Country picker lists all countries; search by name, code (`AE`) and dial code (`+971`).
- [ ] Paste `+44 7400 123456` into any phone field → country switches to 🇬🇧.
- [ ] A too-short number shows the amber hint and blocks submit.
- [ ] Guard walk-in and Admin walk-in console accept a UAE number and submit.
- [ ] Web build: no contacts icon appears.

## 5. Community country
- [ ] Workspace Settings → Country = United Arab Emirates → Save.
- [ ] Log out and in (any role): new phone fields default to 🇦🇪; `050 123 4567` saves as `+971501234567`.
- [ ] Set it back to India.

## 6. Backend & data
- [ ] New passes, walk-ins and blacklist entries store E.164 (`+91…`, `+971…`).
- [ ] A visitor blacklisted with an old 10-digit number is still flagged when the pass has `+91…`.
- [ ] Dry run: `node backend/scripts/migrate-phones-e164.js` → review the counts and unparseable list.
- [ ] Apply: `node backend/scripts/migrate-phones-e164.js --apply` (take a DB backup first).

## 7. Store compliance (before release)
- [ ] **Google Play Console → App content → Data safety**: declare *Contacts* as **collected**. Purpose: App functionality. Not shared. Not processed ephemerally. The user picks one contact, whose name and number are saved on the visitor/staff record they create. There is no bulk upload.
- [ ] **Play Console → Sensitive permissions**: `READ_CONTACTS` justification = "User picks a single contact to fill a visitor's or staff member's name and phone number."
- [ ] **Privacy Policy** (`Nahom_Privacy_Policy.pdf`): add a *Contacts* section: accessed only when the user taps the contacts button; only the chosen contact's name, number and email are used; the address book is never uploaded or stored.
- [ ] **App Store Connect → App Privacy**: *Contacts* collected, App Functionality, linked to the user, not used for tracking.
