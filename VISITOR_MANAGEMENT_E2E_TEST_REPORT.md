# Visitor Management — End-to-End Test Report

**Branch:** `test/visitor-e2e` (from `upstream/UI/Fix/Changes` @ `baf03acd`)
**Date:** 2026-09-28
**Result:** 95 end-to-end tests passing; 37 bugs found and fixed (mobile + backend).

## How the tests work

Each test renders the real mobile screens with the real Redux store, thunks and API client, and
talks to a real backend started on port 5099 against a freshly seeded database
(`mmg_visitor_e2e`: two communities, admin, guard, two residents, an outsider community).
Only native pieces are faked (router, camera, secure storage). Every test checks three layers:
what the user sees, what the app sent, and what the backend stored.

```bash
cd mobile/mobile-app
npm run test:e2e:visitor      # needs local MongoDB (replica set) on 27017; port 5099 free
```

| Phase | File | Tests | Scope |
|---|---|---:|---|
| P0 | `p0.harness` | 4 | Real login, org headers, role-based home |
| P1 | `p1.guestPass`, `p1.passTypes`, `p1.adminPass` | 12 | Guest, group, cab, delivery, service and admin passes |
| P2 | `p2.residentPasses`, `p2.publicPass` | 8 | Pass list, search, share, revoke, public link |
| P3 | `p3.guardGate` | 11 | Scan/typed code, admit, every refusal, double-scan race |
| P4 | `p4.walkIn` | 8 | Walk-in request, live approval/denial, guard walk-in board, blacklist |
| P5 | `p5.checkout` | 6 | Inside list, checkout, pass expiry |
| P6 | `p6.admin` | 6 | Community passes, admin revoke, blacklist, analytics |
| P7 | `p7.history` | 5 | Resident history, admin audit log, CSV |
| P8 | `p8.rolesTenancy` | 30 | Role gating, 20 hostile API calls, socket snooping |
| P9 | `p9.journeys` | 3 | Guest, walk-in and recurring-staff journeys end to end |
| P10 | `p10.notifications` + `e2e/VISITOR_DEVICE_CHECKLIST.md` | 2 | Notification routing; manual device checklist |

## Bugs found and fixed

Severity: **Critical** = core flow broken or unsafe entry; **High** = security, data integrity or a
major flow wrong; **Medium** = wrong/misleading behaviour with a workaround; **Low** = cosmetic.

### Pass creation (P1)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 1 | Critical | Residents could not create **any** visitor pass ("A unit is required…") | The resident screens never passed the resident's villa, and the wizard overwrote it with `undefined` | New `selectActiveVillaId`; invite, cab, delivery and staff screens pass it; wizard keeps it for residents |
| 2 | High | Admin picked a villa in "Target Destination" but the pass was created community-wide | Two independent villa pickers; the wizard only read its own | Admin scope is now one controlled state shared by the header and the scope step |
| 3 | Medium | "Arriving Now (Valid 4 Hours)" pass stayed valid until midnight | No end time was set for that slot | End time = issue time + 4 h |
| 4 | Medium | Invalid phone reached the backend; resident saw only "Validation failed" | No client check; thunk ignored field details | Wizard validates 10 digits; create-pass shows the backend's field message |
| 5 | Medium | Passes created 00:00–05:30 IST were dated yesterday | Dates built with `toISOString()` (UTC day) in 18 places | `toLocalDateKey()` helper used everywhere |

### Resident pass management (P2)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 6 | High | Pass list showed "Guest Visitor" and a **fake entry code** (last 6 chars of the DB id); search never matched | Raw nested backend passes rendered by components expecting flat fields | Passes normalised on fetch (`toListPass`) |
| 7 | Medium | A failed revoke closed the sheet as if it worked | Rejected thunk result never checked | Error shown in the sheet; sheet stays open |
| 8 | Medium | Revoke confirm button read "Are you sure you want to revoke this invitation?" | Auto-translation turned "Confirm Revoke" into the `confirm_revoke` key | Label changed to "Revoke Pass" (2 modals) |
| 9 | Low | "…invalidate the entry pass forRev Me." | JSX whitespace lost in translated text | Single template string |

### Guard gate (P3)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 10 | Critical | **Every** pre-approved gate entry failed with HTTP 500 | Atomic `consumeForEntry` used a pipeline update without Mongoose 9's `updatePipeline` flag | Flag added (backend) |
| 11 | Critical | Refused entries (used up, wrong time/day, **blacklisted**) were shown to the guard as "successfully admitted" | Hook returned rejected thunk results instead of throwing; the catch was unreachable | Hook throws with the backend reason; sheet closes so the reason is visible |
| 12 | Medium | Scan sheet showed "Estate" and "Host Resident" | Single-pass lookup returned ids, not the unit/host | Backend populates unit and host; console shows "Villa A-101 (Block A)" |
| 13 | High | A code reused by another community could resolve to the wrong community's pass | Short-code lookup ignored the community | Signed-in lookups scoped to the community; new short keys unique across communities |

### Walk-ins (P4)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 14 | High | A blacklisted phone number could walk in under another name | App never sent the phone; backend never stored or checked it | `snapshot.phone` sent, validated, stored and blacklist-checked |
| 15 | High | Guards never received walk-in outcomes live | Backend emits to `org:<id>:guards`, which the app never joined | App joins the guard room for gate/admin users |
| 16 | Medium | Guard board dropped resolved requests instead of showing APPROVED / DENIED BY HOST | Socket reducer removed the item | Outcomes kept in `resolvedList` for the board |
| 17 | Medium | Resident's failed approve/deny was silent | Rejected result ignored | Error banner and list refresh |
| 37 | Medium | Guard's Walk-Ins tab lost approved/denied outcomes after an app restart; labels were inconsistent ("Approved" vs "DENIED BY HOST"); resolved cards kept counting "Waiting N mins"; gate name was invented | Tab only loaded pending requests; outcomes lived in memory; `approved` label hit a generic i18n key; walk-ins were sent without a gate | New `GET /visitor-log/org/:orgId/walk-ins?since=` (gate/manager only) loads today's walk-ins in every status; tab merges it with live updates; "APPROVED BY HOST" label in 7 languages; "Approved/Denied at HH:MM"; console sends its gate name |

### Inside & checkout (P5)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 18 | High | Scanning a visitor who is inside showed "ACCESS REJECTED" with no check-out button | Console marked the scan `REJECTED` | Marked `VERIFIED`; check-out action appears |
| 19 | Medium | Failed checkout from the Inside list was only logged to the console | Error swallowed | Error banner and list refresh |

### Admin console (P6)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 20 | High | Community pass registry showed "Guest Visitor" and fake codes | Same as #6 | Same normalisation |
| 21 | Medium | Admin revoke asked twice; the second revoke failed silently and no reason was recorded | Sheet revoked, then the screen opened a second "Force Revoke" dialog | One confirmation; reason "Revoked by community admin" recorded |
| 22 | Medium | Blacklist screen and count covered only the first 10 entries | Endpoint default page size | App requests the full list |
| 23 | Medium | Adding a duplicate blacklist entry closed the form as if it worked; removals failed silently | Rejected results ignored | Form shows the reason; removal errors shown |
| 24 | High | **Analytics were fabricated**: hard-coded hourly chart, heatmap, category fallback and peak hour; "entries today" counted all-time logs | Placeholder values never replaced | `computeGateAnalytics` builds every figure from real gate logs |

### History & audit (P7)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 25 | Medium | Unused passes past their end date stayed "Upcoming" forever | Nothing expired unused passes | Listing expires them and records the transition (backend) |
| 26 | High | **Admin audit log was built from passes, not gate events**: entry/exit were the validity window, guard/gate were constants, walk-ins were missing, and the CSV exported those values | Screen used the pass registry | Screen reads the gate log; backend history adds gate, unit and action history |
| 27 | Medium | Admin force-checkout reason was dropped | Checkout ignored `reason` | Validated and stored in the log's action history |
| 28 | Low | Log cards invented "Security Gate" / "Main Gate" when unknown | Hard-coded fallbacks | Shows "—" |
| 29 | Low | Force-checkout confirm read "Check Out Visitor?" | i18n key collision (as #8) | Label "Force Check-Out" |

### Roles & tenancy (P8)

| # | Sev. | What was wrong | Root cause | Fix |
|---|---|---|---|---|
| 30 | High | Guards saw and could open Admin Console, Blacklist and Community Passes | `visitor:admin` unlocked by `visitor:guard` in permission synonyms and the guard fallback list | Removed from both |
| 31 | Medium | Admin screens reachable by deep link for any role | No role gate on the admin stack / audit log | Redirect unless admin |
| 32 | High | A guard could revoke any resident's pass | Gate operators passed the ownership check | Only the issuing resident or a manager may change a pass (backend) |
| 33 | High | Any user could add blacklist entries; **any community** could delete them by id | No role check; delete not scoped | Manager-only, community-scoped (backend) |
| 34 | High | Names like "Ravi (Jr" crashed pass creation and gate entry (500) | Blacklist matched with a regex built from the visitor's name | Name escaped before matching (backend) |
| 35 | High | Any socket could join another user's or community's rooms and receive gate alerts (names, phones) | `join_room` was unauthenticated | Private rooms require the matching user / active membership / gate permission (backend `socketRoomPolicy.js`) |

### Other

| # | Sev. | What was wrong | Fix |
|---|---|---|---|
| 36 | Low | Villa picker showed "Villa A-101 - Block Block A" | No double "Block" prefix |

## Not fixed — for follow-up

- **Web frontend sockets:** private rooms now need a token (handshake) or the `token` cookie. Web
  hooks that connect with neither (e.g. `useResidentBookingSocket`, `useSecurityLogs`) will no
  longer receive `user:`/`org:` room events and should pass `auth: { token }`.
- Resident history lists passes, not visits; it does not show actual check-in/out times.
- `kid-exit` screen is a stub; `useGuardGateScanner` hook is unused dead code.
- Short keys issued **before** this fix may still collide across communities on the public link until they expire.
- Analytics read the latest 500 gate logs; very busy communities need a backend aggregate endpoint.
- The app-wide auto-translation of free text into i18n keys caused two label collisions here; other screens may have the same issue.
- Pre-existing, unrelated: 2 unit suites fail on the upstream branch (`financialUxHardening`, `offlinePaymentFlows`).
- Device-only checks (camera, push delivery, WhatsApp share) are in `mobile/mobile-app/e2e/VISITOR_DEVICE_CHECKLIST.md`.
