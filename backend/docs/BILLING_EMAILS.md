# Billing emails & pay-online links

## What residents receive

| Email | When | Buttons |
|---|---|---|
| Invoice ready | Invoice generated (billing run or manual billing) | **View & Pay in App**, Pay online without the app |
| Due soon | Daily 09:00 IST, once, when due within 3 days | same |
| Overdue | Daily 09:00 IST, once, when overdue (last 7 days) | same |
| Receipt | After every successful payment (app, wallet, cash, bank approval, online link) | View in App |
| Manual reminder | Admin presses "Send reminder" (always sent) | same as due soon / overdue |

- **View & Pay in App** → `https://<domain>/billing/invoice/<id>`. With the app installed, the OS opens the invoice screen directly (logged-out users land there after login). Without the app, a web page offers *Open in app*, *Install*, and *Pay online*.
- **Pay online** → `https://<domain>/api/billing-links/<token>/pay`. It is resolved at click time:
  - unpaid → a fresh Razorpay link for the **current** outstanding amount (the old link is cancelled if the amount changed);
  - paid / cancelled / bank transfer under review → a status page, never a charge;
  - token invalid or older than 120 days → "link expired" page.
- After any successful payment the active Razorpay link is cancelled, so the old amount can't be paid twice.

## Community admin setup

1. **Integration Hub → Email (SMTP)**: add the community's mailbox (host, port, username, app password). Billing emails are sent from it with the community name as the sender.
   - If a community has no SMTP, the **platform** SMTP is used. It never falls back to another community's mailbox.
   - With neither configured, no email is sent (logged). The in-app notification still arrives, and the next cron run or a manual reminder retries.
2. **Integration Hub → Razorpay**: add the community's keys. Without keys, "Pay online" gives a mock link (dev only).
3. Optional: **Message Templates** with type `email` and purpose `invoice_generated`, `invoice_reminder`, `invoice_overdue` or `invoice_receipt` override the default design. Placeholders: `{{resident_name}} {{community_name}} {{invoice_number}} {{billing_period}} {{amount_due}} {{total_amount}} {{amount_paid}} {{due_date}} {{app_link}} {{pay_link}} {{payment_reference}}`.
   - The web template editor currently only edits the invitation template. Billing templates can be created through the API until a purpose picker is added.

## Deployment checklist

- [ ] `PUBLIC_APP_URL` (optional) — the public web origin for links. Defaults to `https://$MOBILE_UNIVERSAL_LINK_DOMAIN` (`app.managemygate.com`). The web server must proxy `/api` to the backend (already the case in `frontend/nginx.conf`).
- [ ] `JWT_SECRET` must be set. Pay tokens use a key derived from it, so rotating it expires all emailed pay links (residents can still pay in the app).
- [ ] **Razorpay webhook** → `POST /api/invoices/webhook` with event `payment_link.paid`, per community account.
- [ ] **iOS universal links**: replace `<APPLE_TEAM_ID>` in `apple-app-site-association` (frontend and backend copies). Until then iOS opens the web landing page, which still works.
- [ ] **Android app links**: `/billing` is in `app.json` intent filters, so a **new EAS build** is required.
- [ ] Deploy the web frontend (new public route `/billing/invoice/:id`).

## Code map

- `src/features/invoice/invoice.email.js` — templates, once-only sending, queue
- `src/features/invoice/invoicePayLink.service.js` — tokens, link builder, fresh-link logic, link retirement
- `src/features/invoice/invoicePayLink.router.js` — public pay-online endpoint + status pages
- `src/features/invoice/invoiceReminder.cron.js` — due-soon / overdue job
- `src/utils/email.utils.js` — SMTP resolution (community → platform → env)
- Tests: `tests/invoice.billingEmail.test.mjs`
