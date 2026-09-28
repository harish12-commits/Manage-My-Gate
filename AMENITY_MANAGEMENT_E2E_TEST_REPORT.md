# Amenity Management — End-to-End Test Report

**Branch:** `test/amenity-e2e` (from `upstream/test/develop` @ `2c0a8e95`)
**Date:** 2026-09-28
**Result:** 159 end-to-end tests passing; 60 bugs found and fixed (mobile + backend); amenity booking moved to V2 only.

## How the tests work

Each test renders the real mobile screens with the real Redux store, thunks and API client, and
talks to a real backend started on port 5098 against a freshly seeded database
(`mmg_amenity_e2e`: two communities; admin, amenity manager, guard, two resident owners, a family
member and a resident of the other community; wallets; one facility of every type; a Razorpay test
gateway). The backend runs its real background workers (hold expiry, outbox notifications,
reservation lifecycle) every second. Only native pieces are faked (router, camera, secure storage,
the Razorpay WebView). Every test checks what the user sees, what the app sent, and what the
backend stored — including wallet balances and ledger-backed payments.

```bash
cd mobile/mobile-app
npm run test:e2e:amenity      # needs local MongoDB (replica set) on 27017; port 5098 free
```

| Phase | File | Tests | Scope |
|---|---|---:|---|
| P0 | `p0.harness` | 5 | Real login, org headers, V2 facilities, replica-set transactions, workers |
| P1 | `p1.securityMoney` | 17 | Role grants, cross-community access, payment forgery, price tampering |
| P2a | `p2a.archetypes` | 24 | Booking, pricing and capacity rules of the five facility types |
| P2b | `p2b.settingsRefunds` | 14 | Community settings, quota, cancellation policy and refunds |
| P3 | `p3.payments` | 20 | Wallet, Razorpay, advance + balance, cash at the gate, refunds, staff waivers |
| P4 | `p4.lifecycle` | 14 | Check-in/out, return inspection, deposits, approval expiry, no-show/unpaid/overdue review |
| P5a | `p5a.bookingWizard` | 7 | Resident booking wizard on V2 for every facility type and payment method |
| P5b | `p5b.myBookings` | 7 | Balance payment, refund preview, cancel, review notice, live updates |
| P5c | `p5c.v2Only` | 3 | V1↔V2 sync removed; legacy endpoints refuse managed facilities |
| P6 | `p6.gateScanner` | 5 | Collect balance and admit, exits with inspection, security logs, gate time zone |
| P7a | `p7a.bookingQueue` | 6 | Staff approvals, rejections, review decisions, cancel, cash |
| P7b | `p7b.bookOnBehalf` | 4 | Staff booking for a resident |
| P7c | `p7c.settings` | 3 | Amenity settings screen |
| P7d | `p7d.facilityCreation` | 4 | Facility creation wizard payloads and edit round-trip |
| P7e | `p7e.reporting` | 7 | Staff calendar, ledger and dashboard on V2 |
| P8 | `p8.notifications` | 6 | Notifications reach the right person and open the right screen |
| P9 | `p9.journeys` | 13 | Party hall, tool loan and pay-at-gate journeys across resident, staff and guard |

Also added: 15 unit tests for the facility creation payload and validation
(`amenityCreationFacilityTypes.test.ts`); existing unit tests updated where screens changed
(mobile unit suite 707/707). The visitor E2E suite (95/95) was re-run after every phase.

## Decisions taken with the product owner

- **Payments** follow the Billing & Invoice architecture: one wallet, one ledger, one payment flow.
  Wallet, Razorpay and cash at the gate all settle through the shared payment core. Billing
  behaviour was not changed; amenity only adds to the shared core.
- **Advance model:** per facility, the admin sets an advance as fixed ₹ or % of the price; the
  deposit is collected with the advance; the balance is paid online or at the gate (the guard
  collects it before entry). Residents never type an amount.
- **Cancellation:** the facility's policy tiers apply to everything paid; the deposit is always
  refunded; refunds go to the resident's wallet (an online payment that arrives after its hold
  expired is refunded to the card/UPI).
- **Unpaid balance / no-show / item not returned:** flagged for staff, who decide.
- **Shared facilities:** one resident books and pays for the whole group.
- **Staff bookings** for a resident are free of charge and need no further approval.
- **Facility types:** each of the five types books by its own rules (see P2a); event spaces choose
  whole day / sessions / hourly at creation; rooms are hourly or overnight; tools are multi-day loans.
- **V2 only:** the V1↔V2 two-way sync (commit `30863c74`) was replaced; bookings live in V2 only.

## Bugs found and fixed

Severity: **Critical** = core flow broken, money wrong or unsafe; **High** = security, data
integrity or a major flow wrong; **Medium** = wrong/misleading behaviour with a workaround;
**Low** = cosmetic.

### Security & money (P1)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 1 | Critical | Residents had the amenity **admin** permission (facility, resource and maintenance admin APIs) | Default tenant roles included `amenities:amenities` | Shared default-role module; boot self-heal strips it from existing tenant roles |
| 2 | Critical | Any caller could mark any booking **PAID** through a custom payment webhook (unauthenticated when the secret was unset) | V2 `/payments/webhook` accepted a hand-made payload | Endpoint removed; payments settle only from verified captures |
| 3 | Critical | Opening a cancelled booking several times credited the refund several times (₹1,000 → ₹3,100) | Reading a reservation settled `REFUND_PENDING` into the wallet | Reads have no side effects; refunds settle once, idempotently |
| 4 | Critical | A client-sent price of ₹1 was charged as-is on the legacy booking endpoint | Server trusted `pricingDetails` from the app | Always priced server-side; client fields whitelisted |
| 5 | High | Admin rights in one community widened access in another (list, view, cancel) | Four copies of an admin check read global permissions | One tenant-scoped admin-scope helper |
| 6 | High | A typed pass code could resolve to another community's booking | Code lookup by numeric suffix across communities | Exact number, guard's community only |
| 7 | High | Guards could delete security-log entries | Delete allowed for gate permissions | Amenity admins only |
| 8 | High | Viewing a booking rewrote its price and paid amount | Price "repair" on read | Removed |
| 9 | Medium | A resource could be moved to another facility by an update | `facilityId` accepted on update | Stripped |
| 10 | Medium | Legacy `/bookings` API without permission checks was reachable | Still mounted | Unmounted |
| 11 | Medium | Every facility event was dead-lettered by the outbox | No handler for `FACILITY_*` | Acknowledged |

### Facility types & availability (P2a)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 12 | Critical | A released court slot could never be booked again (E11000) | Slot/bucket documents kept after release | Occupancy derived from overlapping holds and bookings under a facility lock |
| 13 | Critical | Shared pools behaved like exclusive courts: the first booking blocked the slot | One allocation model for every type | Per-type profiles: shared capacity up to the pool's size |
| 14 | High | Tools already on loan did not count against stock | Allocated stock ignored | Stock counted on every day of a loan |
| 15 | High | Courts were priced per player; the turnaround buffer was ignored | Generic pricing | Priced per slot on a buffer-spaced grid |
| 16 | High | Notice period, advance window, schedule shape and party size were not enforced | Rules only in the old UI | Enforced at hold time and in daily slots |
| 17 | High | Cancelling refunded a re-priced amount, not what was paid | Refund recalculated from the facility | Refund based on the booking's paid amount |
| 18 | Medium | Clients could send their own quota limit | `quotaLimit` accepted from the app | Removed; from community settings |
| 19 | Medium | Editing pricing or cancellation settings reset the untouched fields | Partial updates replaced whole objects | Merged |

### Settings & cancellation (P2b)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 20 | High | Cancellation policy was not applied; later facility edits changed existing bookings' terms | Policy read live from the facility, not enforced | Policy frozen on each booking; tiers applied; deposit always refunded |
| 21 | Medium | The monthly quota used the limit from the month's first booking | Limit stored per allocation | Current limit used |
| 22 | Medium | No community settings for quota, approval window, early entry or no-show grace | Missing | Settings module (API + P7c screen) |

### Payments (P3)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 23 | Critical | Paying online never confirmed the booking | Razorpay path ended before confirm | Order → checkout → verify; the server creates the booking from the verified payment |
| 24 | Critical | Amenity payments bypassed the ledger (two payment paths, V1 and V2) | Mobile booked paid slots through legacy V1 | One settlement path through the shared payment core, ledger in the same transaction |
| 25 | High | Advance/balance, pay-at-gate and cash collection did not exist | Not modelled | Payment policy per facility; balance online or at the gate with a receipt |
| 26 | High | A replayed confirm could charge twice; an unaffordable confirm left a half-made booking | No idempotency / no transaction | Idempotent, transactional |
| 27 | Medium | Guards could admit a visitor with money still owed | No check | Entry refused (402) until the balance is collected |

### Lifecycle & gate (P4)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 28 | Critical | Check-in failed for **every** room and tool booking | Populated ids passed to the maintenance query (cast error) | Plain ids |
| 29 | High | Approval requests never expired; nothing handled no-shows, unpaid balances or overdue returns | No lifecycle | Lifecycle worker + staff review decisions |
| 30 | High | Deposits were never settled; check-out recorded nothing on the booking | Not implemented | Return inspection, damage charge from the deposit, rest to the wallet |

### Resident app (P5)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 31 | High | The wizard computed slots on the phone; overnight rooms, sessions and multi-day loans could not be booked | Client-side slot maths | Windows come from the server for every type |
| 32 | High | "My Bookings" showed the full price as paid and nothing about balances or refunds | Paid amount defaulted to the total | Payment section: paid, balance, refunds, deposit settlement; pay balance online or from the wallet |
| 33 | High | Cancelling showed no refund; the dialog promised an "automated refund" | No preview | Server refund preview before cancelling, reason captured |
| 34 | High | Live booking updates never arrived | Server emitted to `user:[object Object]`; app listened for event names V2 never sends | Plain room ids; app listens to V2 events |
| 35 | Medium | Balance payments did not update other devices, or updated them with stale data | Event fired inside the uncommitted transaction | Published after commit |
| 36 | Medium | My Bookings only ever showed the first page | Paging read a field the API never sends; page 2 replaced the list | Paging from the API; later pages append |
| 37 | High | V1 and V2 wrote into each other: fake reservations with the user as unit and the full price as paid | Two-way sync | Sync removed; V2 list paginated in the database |
| 38 | High | Bookings made through the legacy endpoints were invisible to V2 availability | V1 could book V2 facilities | Legacy booking refuses managed facilities (410) |

### Gate scanner (P6)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 39 | High | V2 check-ins, exits and refusals were never written to the security log | Only the legacy path logged | Every scan logged with booking and guard |
| 40 | High | The guard could not record exits or returns from the scanner | Check-out was stubbed out | Second scan offers "Record exit" or the return inspection |
| 41 | Medium | A balance due showed only "Verification Refused" | 402 not handled | "Collect ₹X cash & admit" |
| 42 | Medium | "Entry permitted from" showed the server's time zone | `toLocaleTimeString` on the server | Facility time zone |
| 43 | Medium | Scanner screen called hooks after an early redirect | Hooks-order violation | Route only gates access; console is its own component |
| 44 | Low | Check-in result used fields V2 bookings don't have (party size, date) | Legacy field names | Real V2 fields |

### Staff screens (P7)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 45 | High | Staff had no V2 screen to approve, reject, decide flagged bookings, cancel or record cash | Missing | Booking Queue |
| 46 | Medium | Calendar-only staff could not cancel bookings | Route permission | `admin_calander` allowed |
| 47 | Medium | Bookings could be rejected without a reason | Optional field | Reason required |
| 48 | High | Staff could not book for a resident on V2 (only an unused V1 dialog) | Missing | Resident + facility picker, wizard in the resident's name, free of charge |
| 49 | Medium | Settings screen was a placeholder | Missing | Real settings screen |
| 50 | High | A 0% refund or 0-hour cutoff was saved as 100% / 24 h | `parseInt(x \|\| 100)` | Blank-only fallback |
| 51 | High | Free facilities could not have a deposit (tool loans) | Choosing "Free" zeroed and hid the deposit | Deposit always editable |
| 52 | Medium | Editing a facility reset its open days to all week and its booking window to 7 days | Read fields V2 facilities don't have | Read from weekly hours and the facility |
| 53 | Medium | Creation wizard could not set event sessions, overnight rooms or the advance | Fields missing | Added, with validation shared by step and publish checks |
| 54 | Low | Rate label said "₹/slot" | Hard-coded | States how it is charged (per hour, per person per hour, per night, per booking) |
| 55 | High | Calendar, ledger and dashboard read legacy V1 data | Never migrated | V2 reporting endpoints |
| 56 | Medium | Calendar times were shown in UTC (06:00 IST → 00:30) and included turnaround buffers | UTC formatting; effective window | Facility time zone; booked time |
| 57 | Medium | Dashboard showed a hard-coded "+14% Live" trend; "Total Revenue" was this month's collections | Placeholder values | Removed; relabelled; approvals and decisions cards added |
| 58 | Low | Booking rows invented "Villa 101" when the unit was unknown; pending approvals showed as Confirmed | Fallbacks and status mapping | "—"; Pending |

### Notifications (P8)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 59 | High | Tapping any amenity notification opened the generic list | No route for `/amenities/reservations/<id>` links | Booking detail; staff notifications open the Booking Queue |
| 60 | Medium | A booking notification with an id opened the booking wizard | Mapped to the wizard, which takes a facility id | Booking detail |

## Not fixed — for follow-up

- **Billing (shared payment core), deferred by decision — the owner will review billing separately:**
  a partial Razorpay invoice payment can be applied twice (invoice listener); record-cash and
  cash-collections accept the resident action-centre permission; wallet cash-out may debit twice;
  the cash-collections report filters `PAID` where payments store `success`;
  `payInvoiceWithWallet` bypasses the shared wallet debit and settlement.
- **Maintenance module:** reschedule uses `$push` inside `$set`; the recurring-maintenance path
  imports a V1 model; resolutions are not restricted by role. Admin maintenance screen still has V1
  fallbacks and calls the service from the screen.
- **Facility catalog:** the V2 facility service still mirrors facilities into the V1 `amenities`
  collection (same ids); Discover and the admin catalog read that list. Retire once the web
  frontends move to V2.
- **Web frontends** (`frontend/`, `tailwind-frontend/`) still use the legacy `/amenity-bookings`
  booking endpoints (now refused for managed facilities) and V1 occupancy/trends widgets.
- **Legacy endpoints** `/amenity-bookings` (booking, manual, queue, stats) remain mounted for the
  web; remove after the web migration.
- **No balance-due reminder** notification before a booking starts.
- **Translations:** new amenity strings were added in English; tile labels in all 7 languages.
- **Backend legacy amenity unit suites:** 83 of 360 tests fail, identically before and after this
  work (written against the old behaviour); they need rewriting. Billing phase 3
  "Signature Verification" also fails on the upstream branch.
- **Local tooling:** `mobile-app/.expo/types/router.d.ts` (generated, git-ignored) was left corrupted
  by the Expo dev server; restart it or delete the file.
- **Device-only checks** (camera scanning, Razorpay checkout, push delivery, pass sharing) are in
  `mobile/mobile-app/e2e/AMENITY_DEVICE_CHECKLIST.md`.
