# Verola

Modern multi-tenant SaaS platform for service businesses that track customer drop-off jobs and send customer SMS updates through each business's own provider.

## What is included

- Super Admin portal for organisations, subscriptions, branding defaults, analytics, and tenant enable/disable controls.
- Business Admin portal for staff, BYO messaging setup, SMS templates, customer jobs, search, and customer history.
- Staff portal for fast mobile-first job status updates and shift clock-in/clock-out.
- Login gate with assigned Super Admin, Business Admin, and Staff dashboard access.
- Company invite flow from Super Admin using the business admin email address.
- Logo upload locked to Super Admin while business admins can manage colours and SMS templates.
- Sequenced workflow board so managers and staff can quickly see what is collected, in progress, ready for pickup, and completed.
- Business admins can rename workflow stages, action labels, and next-step hints per business.
- Editable SMS templates and internal job notes for handover context.
- Bring Your Own SMS Provider only: each organisation connects ClickSend or Telnyx and pays that provider directly.
- Paid/unpaid tracking on every job, with staff/admin able to mark payment received at any point in the workflow.
- Appwrite-ready backend blueprint with Auth, Teams, Databases, Functions, and Storage.
- Demo-mode UI that runs before Appwrite credentials are configured.

## Local setup

```bash
npm install
npm run dev
```

Local dashboard routes:

- Login: `http://localhost:5173/login`
- Super Admin: `http://localhost:5173/super-admin`
- Business Admin: `http://localhost:5173/business-admin`
- Staff: `http://localhost:5173/staff`

In local demo mode, users must sign in with an email assigned to the selected role. Production auth should be enforced by Appwrite Auth and Teams, not frontend-only checks.

Create `.env` when you are ready to connect Appwrite:

```bash
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_DATABASE_ID=verola
VITE_APPWRITE_ORGANISATION_COLLECTION_ID=organisations
VITE_APPWRITE_INVITE_FUNCTION_ID=send-company-invite-function-id
VITE_APP_URL=https://your-verola-domain.com
VITE_APPWRITE_LOGO_BUCKET_ID=organisation-logos
```

Build the backend from:

```bash
appwrite/README.md
```

Or provision the main database and collections with:

```bash
APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1 APPWRITE_PROJECT_ID=your-project-id APPWRITE_API_KEY=your-server-key npm run appwrite:provision
```

Invite emails:

- Invite links use `/invite/:token` and the base URL from `VITE_APP_URL`; if it is missing, the current origin is used.
- In local demo mode, Verola stores invite tokens in browser storage so you can test the setup flow without exposing service keys.
- For production, deploy an Appwrite Function that creates, looks up, sends, and accepts invites. Set `VITE_APPWRITE_INVITE_FUNCTION_ID` to that function ID.
- If email sending is not configured, the UI shows: "Email sending is not configured. Copy and send the invite link manually."
- The frontend sends only invite metadata, the generated token, and the invite URL to the function. Email provider secrets and Appwrite server keys must stay inside Appwrite Function environment variables.

## BYO SMS flow

Jobs move through:

1. `collected`
2. `in_progress`
3. `ready_for_pickup`
4. `completed`

Each status change records a job event. If the organisation has connected ClickSend or Telnyx, the app shows an SMS preview before sending through that organisation's provider. If messaging is not configured, the status still updates and the user sees: "SMS not configured. Status updated, but no customer message was sent."

Verola is BYO provider only: each business owns the provider account and pays ClickSend or Telnyx directly.
