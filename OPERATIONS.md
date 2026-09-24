# Operations and Completion Status

## Local operation

- App: `npm run dev`, http://localhost:3000.
- Background jobs: `npm run worker`. Keep this process and the database available. It checks every minute; closing the terminal or shutting down the computer stops jobs.
- One-shot jobs: `npm run jobs:run`.
- Database migrations: `npm run db:migrate`. Uses private `DIRECT_URL` when supplied, otherwise converts a Neon pooled hostname to the direct hostname for migrations only. Application traffic remains pooled.
- Settings controls automatic billing, automatic email reminders, the India-local start hour and reminder offsets. Both automatic actions default off. Enabling records the approving administrator; deactivating that administrator stops automatic jobs.
- A scheduled HTTP runner may POST `/api/automation/run` with `Authorization: Bearer <JOB_SECRET>`. Configure a random secret of at least 32 characters privately. Use HTTPS outside localhost. Never expose this secret in browser code.

Billing jobs process up to 20 invoices per iteration, with a database lease and per-enrollment invoice locks. Subsequent iterations handle remaining invoices. Cancelled periods are not automatically recreated. Existing invoices are not rewritten by enrollment edits. Changing a billed enrollment's plan or start date is rejected.

## Email setup

Configure these privately in the environment, then restart the worker and app:

```text
SMTP_HOST
SMTP_PORT=587
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

Use an SMTP service/account whose terms permit the intended messages. No paid provider has been selected or configured. Port 465 uses TLS; other ports require STARTTLS. Certificate verification remains enabled.

Email PDF queues a saved parent recipient and a durable request ID. The worker rechecks sender permissions, parent recipient, invoice cancellation and reminder balance before sending. It submits a generated PDF attachment. `ACCEPTED` means the SMTP server accepted the message, not that it reached the inbox. `UNKNOWN` outcomes require provider-log investigation; they are not automatically retried. Confirmed failures may be retried up to five attempts. Queued reminders are deduplicated per invoice/day. Overdue reminders may be queued once each day while enabled.

WhatsApp remains manual click-to-chat. Invoice delivery handoffs are recorded, but dashboard/notification reminder links are not delivery records. Delivery is unconfirmed in both cases. No WhatsApp Cloud API credentials, templates, webhook verification or paid messaging have been configured. Do not describe handoffs as delivery confirmations.

## Dashboard and billing workflow

- Dashboard and Notifications show Next 7 days, Due today, Overdue, Paid and All filters, with blue, amber, red and green status badges. The seven-day view includes today's dues and unbilled monthly fees scheduled through seven days ahead.
- Remind opens a prepared WhatsApp message to the saved parent WhatsApp number (or mobile fallback). The operator must press Send in WhatsApp. Paid rows have no reminder action.
- Upcoming totals include scheduled fees; total outstanding includes issued invoices only. Cancelled invoices are excluded.
- Create Bill supports an existing enrollment or guided parent/student/course entry followed by bill review. Creating the student saves the enrollment before final invoice confirmation. Optional scholarship and discount fields are grouped.
- Navigation is grouped by function; layouts adapt for mobile and respect reduced-motion preferences.

## Verification completed

- 74 standard tests passed after the redesign; the opt-in database integration test is skipped in the standard suite. Separate PostgreSQL rollback integration for billing, PDF output and delivery handoff authorization/idempotency passed before this redesign.
- Typecheck, lint and production build passed.
- Dependency audit: zero known vulnerabilities after a scoped `deepmerge-ts` override under Prisma configuration. Recheck compatibility and audit when updating Prisma.
- Desktop/mobile browser checks for enrollment, settings, delivery history, search, reports and notifications; four CSV exports; unauthenticated export/job denial.
- Redesign checks at desktop/mobile widths: populated isolated collection previews verify four distinct status colors and reminder actions, live billing review/back and parent-to-student progression work without saving records. Intake service tests use mocked database transactions; full persisted intake end-to-end coverage remains outstanding.
- Actual worker startup verified with billing/reminders disabled and SMTP absent. No real emails were sent. No financial test fixtures were retained.

## Not certified complete

The complete original 48-section specification is not available in the accessible transcript; only its summary is available. Full acceptance requires that specification as a workspace document and a line-by-line requirements audit. Passing the checks above is not a claim of complete requirements coverage.

Outstanding known work includes development seed requirements, invoice correction/refund policy and implementation, complete event notifications, populated browser end-to-end/concurrency testing, deployment monitoring/backups/recovery/retention, and live provider verification. Automated WhatsApp delivery requires an explicit provider decision and private configuration; manual click-to-chat works without one.

The existing environment credentials were exposed in conversation attachments. Rotate the database credential with Neon and reset the actual administrator account password privately. Changing only the bootstrap environment password does not change an existing account's password. Never commit the private environment file.