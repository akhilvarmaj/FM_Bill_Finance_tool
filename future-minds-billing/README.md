# Future Minds Billing

Future Minds | Robotics - AI - Coding

## Status

Phase 1 foundation implemented: Next.js App Router, TypeScript, Tailwind, PostgreSQL/Prisma identity schema and migration, Argon2id passwords, opaque database sessions, public pending registration, server-side authorization helpers, and branded responsive authentication screens.

Neon is connected, migrations are deployed, and administrator login/logout have been verified against the running app. This is not yet a production-ready billing system.

Implemented next: permission-aware workspace navigation, administrative account dashboard, paginated user search, pending approvals/rejection/deactivation, staff creation, individual permission grants, password resets, and a read-only paginated audit viewer. Account mutations revoke sessions and write transactional audit entries. Live verification passed registration, pending-login denial, approval, staff permission denial, deactivation and session revocation. The labelled verification staff account remains inactive.

School workflows include course, parent, batch and student creation/list/search/edit, automatic student IDs, initial and additional enrollments, monthly/one-time plans, and audited administrator linking of parent accounts to unassigned families. Linking refuses to merge families with existing children. Existing enrollment prices are not changed by course/profile edits.

Financial workflows now include transactional invoice numbering and fee calculations, partial payments with retry protection, database-enforced immutable payment history, unpaid invoice cancellation, invoice search, A4 PDF downloads with amount-in-words and a blank stamp area, and manual WhatsApp/email composition. One-time enrollments receive only one active invoice; monthly periods must fall within the course term.

Monthly Dues shows course-duration schedules. "Generate due invoices" creates up to 20 unpaid invoices per request for elapsed billing dates; repeat when more remain. It skips already-invoiced periods, including cancelled periods, and never generates monthly invoices for one-time plans. Cancelled periods may be replaced manually. Optional unattended generation uses `npm run worker` and administrator-enabled Automation settings. The worker must remain running.

Other implemented screens: payment history, parent child selector and scoped family invoices, 7/3/1-day and due/overdue invoice reminders, per-user reminder resolution, marketing expenses, date-filtered financial reports, monthly targets, and institute contact/invoice-prefix settings. Report grants are independent. All displayed financial figures come from the database.

New additions: searchable enrollment management with guarded audited edits and automatic course-fee defaults; scoped global search; CSV exports with spreadsheet-formula protection; calendar-year reports and exact monetary aggregation; institute logo in PDFs; durable delivery history and SMTP invoice PDF attachments; configurable automatic monthly billing and email reminders through a background worker.

This remains a development implementation, not the complete production specification. WhatsApp opens click-to-chat and records an unconfirmed handoff. SMTP is not configured; real email delivery has not been tested. SMTP acceptance is not inbox delivery, and ambiguous outcomes are not automatically retried. Reminder resolution applies to the current day and stage. PDFs use institute details at download time; broader script coverage remains pending. See the workspace OPERATIONS.md for setup, tested scope and blockers.

## Local Setup

Requirements: Node.js 24 LTS, npm, and access to PostgreSQL 16 or newer. The configured free Neon database requires no local database installation.

A user-local Node runtime was installed at `%LOCALAPPDATA%\FutureMinds\runtime\node-v24.21.0-win-x64` on the initial development machine. Add that directory to your terminal PATH, or install Node.js normally. It is not bundled with the application.

1. Run `npm ci` from this directory.
2. Set the variables shown in `.env.example` in your local `.env` or deployment secret manager. This machine already has private Neon settings; do not overwrite them. Set DATABASE_URL privately; never paste credentials into chat or commit them. Keep the example file free of passwords.
3. Set APP_URL to the exact browser origin, including port. Use HTTPS in production. Change it when using a different development port.
4. Run `npm run db:generate`, then `npm run db:migrate` against a dedicated database.
5. Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and a unique BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters in your environment. Run `npm run db:admin`. It refuses to replace an existing administrator. Remove the bootstrap password afterward.
6. Run `npm run dev` and open http://localhost:3000/login.

For Windows corporate certificates, `NODE_USE_SYSTEM_CA=1` lets Node 24 use the trusted operating-system CA store. Do not disable TLS verification.

## Verification

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover identity, account administration, enrollment validation and linking guards, fee arithmetic, schedule boundaries, reporting dates and WhatsApp encoding. Most service tests mock the database.

The opt-in PostgreSQL billing integration test covers partial/full payments, retry protection, overpayment denial, payment immutability, monthly and one-time duplicates, cancellation/replacement, parent invoice ownership, course-term enforcement and actual A4 PDF generation. All its fixtures are rolled back. Run it in PowerShell using `$env:RUN_DB_INTEGRATION='1'; npm test -- src/lib/billing/integration.test.ts; Remove-Item Env:RUN_DB_INTEGRATION` against a dedicated test database where possible.

Verified locally: production build, typecheck, lint, unit tests, rollback billing integration, and authenticated desktop/mobile smoke checks of the new screens. Empty-state browser checks do not replace populated financial workflow end-to-end tests. Remaining checks include concurrent requests, full parent portal isolation, account-linking integration, reporting reconciliation, backups and recovery.

## Security Boundaries

- ADMIN has full permission access only while APPROVED. STAFF defaults to no grants. PARENT never inherits staff permissions.
- Roles and grants are loaded from the database on each authenticated request. Never accept them from the browser.
- Future endpoints must use the authorization guards and constrain parent queries by the authenticated parent user ID before loading children or financial records.
- Only STAFF and PARENT may register publicly, always PENDING. Admin approves them through Users & Access.
- Sessions expire after eight hours; only SHA-256 token digests are stored. Production cookies are Secure, HttpOnly, SameSite=Lax and use the __Host- prefix.
- Mutations require the configured Origin. Authentication throttles are atomic database counters with 15-minute windows. Configure per-IP limits at a trusted reverse proxy before deployment; the app deliberately does not trust arbitrary forwarded-IP headers.
- Provision separate migration and least-privilege application database users. Database triggers reject audit/payment/item mutation and restrict invoice changes to unpaid cancellation. Expired sessions/throttle rows need a scheduled retention job before deployment.
- Error responses never expose database errors or credentials. Deployment logging/monitoring, backups, recovery, comprehensive CSP and security review remain Phase 10 work.
- No financial data, demo passwords, fake revenue, or sample successful logins have been added.

## Architecture

- `src/app`: pages and thin API routes
- `src/components`: shared UI
- `src/lib/auth`: validation, password/token primitives, policy, service, and HTTP security
- `src/lib/db.ts`: server-only Prisma client
- `prisma`: normalized identity schema and migrations
- `scripts/bootstrap-admin.ts`: environment-configured, one-time administrator creation

## Remaining Work

- Unified student/parent entry and complete original enrollment lifecycle acceptance checks. Guarded fee, batch, schedule and active-status editing is implemented.
- Live email-provider verification and optional WhatsApp provider integration. Configurable email reminders, invoice generation, durable delivery status and local worker are implemented. No paid provider is configured.
- Refund/credit-note workflows and reviewed invoice correction policies; paid invoices cannot currently be cancelled or changed.
- Further PDF customization and broader multilingual verification. Logo embedding and SMTP PDF attachments are implemented; SMTP credentials are required privately.
- Notification types beyond pending registrations and unpaid invoices, and remaining reporting requirements from the original specification. Scoped global search, CSV exports and year selection are implemented.
- Development seed tooling, populated end-to-end tests, concurrency/security review, monitoring, backups/recovery, retention and production deployment.

Keep application, lint, typecheck and test gates passing as these remaining workflows are implemented. No claim of full specification completion is made.
