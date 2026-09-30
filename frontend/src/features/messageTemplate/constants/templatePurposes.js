/**
 * Message template purposes the backend understands (messageTemplate.model.js `purpose` enum).
 * Billing templates are email-only; when a community has not saved one, residents receive the
 * built-in design from backend/src/features/invoice/invoice.email.js.
 */

const INVITE_HTML = `<div style="font-family: sans-serif; padding: 24px; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px;">
  <h2 style="color: #4f46e5; margin-bottom: 16px;">Workspace Invitation</h2>
  <p>You have been invited to join our secure workspace.</p>
  <p>Please click the button below to set up your password and complete your registration:</p>
  <div style="margin: 32px 0; text-align: center;">
    <a href="{{invite_link}}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Accept & Activate Account
    </a>
  </div>
  <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 32px 0;" />
  <p style="color: #6b7280; font-size: 0.85rem;">
    If you're having trouble clicking the button, copy and paste this link in your browser:<br/>
    <a href="{{invite_link}}" style="color: #4f46e5;">{{invite_link}}</a>
  </p>
</div>`

const BILLING_PLACEHOLDERS = [
  'resident_name',
  'community_name',
  'invoice_number',
  'billing_period',
  'amount_due',
  'total_amount',
  'due_date',
  'app_link',
  'pay_link',
]

const billingHtml = ({
  heading,
  intro,
  showPay,
}) => `<div style="font-family: sans-serif; padding: 24px; color: #1c1917; max-width: 520px; margin: 0 auto; border: 1px solid #e7e5e4; border-radius: 16px;">
  <p style="color: #78716c; font-size: 13px; margin: 0 0 6px;">{{community_name}}</p>
  <h2 style="margin: 0 0 12px;">${heading}</h2>
  <p>${intro}</p>
  <table style="width: 100%; background: #faf7f4; border-radius: 12px; padding: 12px; font-size: 14px;">
    <tr><td>Invoice</td><td align="right"><strong>{{invoice_number}}</strong></td></tr>
    <tr><td>Billing period</td><td align="right"><strong>{{billing_period}}</strong></td></tr>
    <tr><td>${showPay ? 'Amount due' : 'Amount paid'}</td><td align="right"><strong>${showPay ? '{{amount_due}}' : '{{amount_paid}}'}</strong></td></tr>
    ${showPay ? '<tr><td>Due date</td><td align="right"><strong>{{due_date}}</strong></td></tr>' : '<tr><td>Reference</td><td align="right"><strong>{{payment_reference}}</strong></td></tr>'}
  </table>
  <p style="margin: 24px 0 8px;">
    <a href="{{app_link}}" style="background: #ea580c; color: #ffffff; padding: 12px 22px; border-radius: 10px; text-decoration: none; font-weight: 600; display: inline-block;">${showPay ? 'View &amp; Pay in App' : 'View in App'}</a>
  </p>
  ${showPay ? '<p><a href="{{pay_link}}" style="color: #ea580c;">Pay online without the app</a></p>' : ''}
</div>`

export const TEMPLATE_PURPOSES = {
  user_invitation: {
    label: 'User invitation',
    channels: ['email', 'sms'],
    required: ['invite_link'],
    placeholders: ['invite_link', 'reject_link', 'community_name'],
    defaultName: 'Default Invitation',
    defaultSubject: 'Invitation to join Workspace',
    defaultBody: {
      email: INVITE_HTML,
      sms: 'Hello!\n\nYou have been invited to join our workspace. Click the link to register your account:\n\n{{invite_link}}',
    },
  },
  invoice_generated: {
    label: 'Billing — new invoice',
    channels: ['email'],
    required: ['app_link'],
    placeholders: BILLING_PLACEHOLDERS,
    defaultName: 'New invoice email',
    defaultSubject: 'New invoice {{invoice_number}} — {{amount_due}} due {{due_date}}',
    defaultBody: {
      email: billingHtml({
        heading: 'Your new invoice is ready',
        intro:
          'Hi {{resident_name}}, your community has issued a new invoice. You can pay it in the app using your wallet balance or any payment method.',
        showPay: true,
      }),
    },
  },
  invoice_reminder: {
    label: 'Billing — due soon reminder',
    channels: ['email'],
    required: ['app_link'],
    placeholders: BILLING_PLACEHOLDERS,
    defaultName: 'Due soon reminder email',
    defaultSubject: 'Reminder: {{amount_due}} due {{due_date}} ({{invoice_number}})',
    defaultBody: {
      email: billingHtml({
        heading: 'Payment due soon',
        intro:
          'Hi {{resident_name}}, this is a friendly reminder that your invoice is due on {{due_date}}.',
        showPay: true,
      }),
    },
  },
  invoice_overdue: {
    label: 'Billing — overdue notice',
    channels: ['email'],
    required: ['app_link'],
    placeholders: BILLING_PLACEHOLDERS,
    defaultName: 'Overdue notice email',
    defaultSubject: 'Overdue: {{amount_due}} for invoice {{invoice_number}}',
    defaultBody: {
      email: billingHtml({
        heading: 'Your invoice is overdue',
        intro:
          'Hi {{resident_name}}, the due date of {{due_date}} has passed. Please pay as soon as possible to avoid late fees.',
        showPay: true,
      }),
    },
  },
  invoice_receipt: {
    label: 'Billing — payment receipt',
    channels: ['email'],
    required: [],
    placeholders: [
      'resident_name',
      'community_name',
      'invoice_number',
      'billing_period',
      'amount_paid',
      'amount_due',
      'payment_reference',
      'app_link',
    ],
    defaultName: 'Payment receipt email',
    defaultSubject: 'Payment received — {{amount_paid}} for {{invoice_number}}',
    defaultBody: {
      email: billingHtml({
        heading: 'Thank you, payment received',
        intro:
          'Hi {{resident_name}}, we have received your payment. Your receipt and full history are in the app.',
        showPay: false,
      }),
    },
  },
}

export const PURPOSE_OPTIONS = Object.entries(TEMPLATE_PURPOSES).map(([value, cfg]) => ({
  value,
  label: cfg.label,
}))

export const isBillingPurpose = (purpose) => String(purpose || '').startsWith('invoice_')

export const token = (key) => `{{${key}}}`

/** Required placeholders missing from subject+body. */
export const missingPlaceholders = (purpose, text) =>
  (TEMPLATE_PURPOSES[purpose]?.required || []).filter(
    (key) => !String(text || '').includes(token(key)),
  )
