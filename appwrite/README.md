# Appwrite Backend Blueprint

Use this blueprint to create the Appwrite backend for Verola.

## Project

Create one Appwrite project and add a Web platform for the deployed app domain and local development origin.

Environment variables:

```bash
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your-project-id
VITE_APPWRITE_DATABASE_ID=verola
VITE_APPWRITE_ORGANISATION_COLLECTION_ID=organisations
VITE_APPWRITE_INVITE_FUNCTION_ID=send-company-invite-function-id
VITE_APP_URL=https://your-verola-domain.com
VITE_APPWRITE_LOGO_BUCKET_ID=organisation-logos
```

## Company Invite And Setup Function

The browser must not contain service role keys or email provider secrets. To run company invites in production, create an Appwrite Function and put Appwrite server SDK credentials plus email provider credentials in that function's environment.

Frontend payload sent to the function:

```json
{
  "action": "send_invite_email",
  "inviteId": "INV-123",
  "token": "raw-token-visible-only-in-email-link",
  "businessId": "fresh-fold",
  "businessName": "Fresh Fold Laundry",
  "contactName": "Ava Owner",
  "adminEmail": "owner@example.com",
  "phone": "+61400000111",
  "role": "business_admin",
  "inviteUrl": "https://your-app.com/invite/raw-token-visible-only-in-email-link",
  "expiresAt": "2026-06-02T00:00:00.000Z",
  "logoUrl": "https://your-appwrite-logo-url"
}
```

The function should:

- verify the caller is a platform super admin
- create or update the `organisationInvites` record with a hash of the token, never the raw token
- look up `/invite/:token` by hashing the provided token and comparing it with `tokenHash`
- reject expired or already accepted invites
- create or link the Appwrite Auth user
- add the user to the organisation team with role `business_admin`
- mark the invite as `accepted`
- send the email to `adminEmail` only when email credentials are configured
- include the organisation logo URL in branded email templates when a safe public or signed URL is available
- never return provider secrets to the frontend
- return a success response when the email has been accepted by the provider

In local demo mode, Verola stores tokens in browser storage and falls back to a copyable setup link if `VITE_APPWRITE_INVITE_FUNCTION_ID` is not configured.

## Authentication And Roles

Use Appwrite Auth for user accounts.

Use Appwrite Teams for tenant isolation:

- One team per business organisation.
- Team roles: `business_admin`, `staff`.
- A platform team can hold `super_admin` users.
- Collection permissions should grant document access to the relevant organisation team role.
- Invited users should only receive memberships for their assigned organisation team and role.
- Super Admin users must never be added to organisation teams unless they are explicitly acting through server-side platform functions.

Super-admin operations such as creating organisations, changing subscriptions, disabling organisations, and provisioning team memberships should run through Appwrite Functions with a server SDK API key. Do not expose server keys to the browser.

Recommended setup flow:

- Create the platform owner in Appwrite Auth.
- Add the platform owner to the platform team with role `super_admin`.
- Super Admin invites a company by email.
- The invite acceptance function creates or links the user, adds them to only that organisation team, and assigns `business_admin`.
- Business Admin can invite staff into the same organisation team with role `staff`.
- Login routing should be based on the authenticated user's Appwrite team roles, not URL choice.

## Messaging Security

Verola uses a Bring Your Own SMS Provider model only.

- Each organisation must connect ClickSend or Telnyx before SMS can be sent.
- The platform does not store or use a shared SMS provider account.
- Provider credentials are posted only to secure Appwrite Functions.
- Functions encrypt credentials before writing `smsProviderCredentials`.
- Full API keys are never returned to the frontend; return only `maskedKeyPreview`.
- Do not store provider secrets in localStorage.
- Do not use browser-accessible `VITE_` environment variables for provider secrets.
- Do not log raw API keys, passwords, or decrypted credential payloads.
- Only organisation users with `business_admin` can connect, update, test, or disconnect provider settings.

## Database Collections

Create database ID: `verola`.

### organisations

Tracks every tenant/business.

Attributes:

- `name` string required
- `industry` string required
- `location` string
- `isEnabled` boolean required default `true`
- `plan` enum `starter`, `growth`, `scale`
- `subscriptionStatus` enum `trialing`, `active`, `past_due`, `cancelled`
- `logoFileId` string
- `logoUrl` string
- `logoName` string
- `primaryColour` string required default `#0f766e`
- `accentColour` string required default `#f59e0b`
- `messagingEnabled` boolean required default `false`
- `smsProvider` enum `clicksend`, `telnyx`
- `smsSenderName` string required default `VEROLA`
- `smsSetupStatus` enum `not_configured`, `connected`, `failed` required default `not_configured`
- `adminEmail` string
- `contactName` string
- `contactPhone` string
- `teamId` string required

Indexes:

- key index on `teamId`
- fulltext index on `name`
- key index on `isEnabled`

Permissions:

- read/update: platform super-admin function
- read: organisation team members
- update colours and non-logo business settings: `business_admin`
- update messaging status fields: Appwrite Functions only after provider credential validation
- update `logoFileId`: platform super-admin function only
- serve logos through `Storage.getFileView` for public/logo-safe buckets or through a signed URL function for private buckets

### organisationInvites

Secure business onboarding invites. Store only a server-side hash of the invite token; never store the raw token in a client-readable document.

Attributes:

- `organisationId` string required
- `businessName` string required
- `contactName` string
- `adminEmail` string required
- `phone` string
- `tokenHash` string required
- `role` enum `business_admin`, `staff`
- `status` enum `pending`, `accepted`, `expired`
- `invitedByUserId` string
- `acceptedByUserId` string
- `createdAt` datetime
- `expiresAt` datetime
- `acceptedAt` datetime

Indexes:

- key index on `organisationId`
- key index on `adminEmail`
- key index on `status`
- unique index on `tokenHash`

Permissions:

- create/read/update: Appwrite invite function only
- never grant public read by token
- the frontend should call the invite function to look up, accept, or resend invites

### customers

Attributes:

- `organisationId` string required
- `fullName` string required
- `phone` string required
- `email` string
- `notes` string

Indexes:

- key index on `organisationId`
- key index on `phone`
- fulltext index on `fullName`

Permissions:

- create/read/update/delete: organisation team roles `business_admin`, `staff`

### jobs

Attributes:

- `organisationId` string required
- `customerId` string required
- `jobNumber` string required
- `itemSummary` string required
- `serviceType` string
- `priority` enum `standard`, `urgent`, `hold`
- `estimate` string
- `notes` string
- `status` enum `collected`, `in_progress`, `ready_for_pickup`, `completed`
- `paymentStatus` enum `unpaid`, `paid`
- `paidAt` datetime
- `promisedAt` datetime
- `completedAt` datetime
- `createdBy` string

Indexes:

- key index on `organisationId`
- key index on `status`
- key index on `priority`
- key index on `paymentStatus`
- key index on `jobNumber`
- key index on `customerId`

Permissions:

- create/read/update: organisation team roles `business_admin`, `staff`
- delete: `business_admin`

### jobStatusEvents

Append-only event history for customer jobs.

Attributes:

- `organisationId` string required
- `jobId` string required
- `status` enum `collected`, `in_progress`, `ready_for_pickup`, `completed`
- `changedBy` string

Indexes:

- key index on `organisationId`
- key index on `jobId`

Permissions:

- read/create: organisation team roles `business_admin`, `staff`
- no client update/delete permissions

### smsTemplates

Attributes:

- `organisationId` string required
- `status` enum `collected`, `in_progress`, `ready_for_pickup`, `completed`
- `body` string required
- `isEnabled` boolean required default `true`

Indexes:

- key index on `organisationId`
- key index on `status`

Permissions:

- read/create/update/delete: `business_admin`

### workflowStages

Per-business names and action labels for the four workflow stages.

Attributes:

- `organisationId` string required
- `statusKey` enum `collected`, `in_progress`, `ready_for_pickup`, `completed`
- `label` string required
- `buttonLabel` string required
- `nextStep` string required
- `tone` string

Indexes:

- key index on `organisationId`
- key index on `statusKey`

Permissions:

- read: organisation team roles `business_admin`, `staff`
- create/update/delete: `business_admin`

### smsProviderCredentials

Encrypted Bring Your Own SMS Provider settings. Raw provider credentials must never be stored in browser state, localStorage, or client-readable documents.

Attributes:

- `organisationId` string required
- `provider` enum `clicksend`, `telnyx` required
- `encryptedCredentials` string required
- `maskedKeyPreview` string
- `connectionStatus` enum `not_configured`, `connected`, `failed`
- `lastTestedAt` datetime
- `createdAt` datetime
- `updatedAt` datetime

Indexes:

- key index on `organisationId`
- key index on `provider`
- key index on `connectionStatus`

Permissions:

- read masked status only through an Appwrite Function for organisation role `business_admin`
- create/update/delete: Appwrite Function only
- no direct client read permission for `encryptedCredentials`

### smsLogs

Audit log for BYO SMS delivery attempts.

Attributes:

- `organisationId` string required
- `customerId` string required
- `jobId` string required
- `provider` enum `clicksend`, `telnyx` required
- `phoneNumber` string required
- `messageBody` string required
- `templateKey` string
- `status` enum `pending`, `sent`, `delivered`, `failed`
- `providerMessageId` string
- `errorMessage` string
- `sentByUserId` string
- `createdAt` datetime

Indexes:

- key index on `organisationId`
- key index on `jobId`
- key index on `customerId`
- key index on `status`
- key index on `provider`

Permissions:

- read: organisation team role `business_admin`
- create/update: Appwrite Function only
- staff can see job progress without direct SMS log or credential access

### staffShifts

Clock-in and clock-out records for staff.

Attributes:

- `organisationId` string required
- `staffUserId` string required
- `staffName` string required
- `clockInAt` datetime required
- `clockOutAt` datetime
- `status` enum `clocked_in`, `clocked_out`
- `totalMinutes` integer

Indexes:

- key index on `organisationId`
- key index on `staffUserId`
- key index on `status`

Permissions:

- create/update own active shift: organisation team role `staff`
- read all organisation shifts: `business_admin`
- read own shift history: `staff`

### rosterShifts

Roster requests sent by business admins for staff to accept or decline.

Attributes:

- `organisationId` string required
- `staffUserId` string required
- `staffName` string required
- `role` string
- `shiftDate` string required
- `startTime` string required
- `endTime` string required
- `area` string
- `responseStatus` enum `draft`, `sent`, `accepted`, `declined`
- `respondedAt` datetime
- `createdBy` string

Indexes:

- key index on `organisationId`
- key index on `staffUserId`
- key index on `shiftDate`
- key index on `responseStatus`

Permissions:

- create/read/update/delete roster shifts, including accidental shift removal: `business_admin`
- read own roster shifts: `staff`
- update own `responseStatus` and `respondedAt`: `staff`

## Functions

Recommended functions:

- `provision-organisation`: creates an organisation document, Appwrite team, default SMS templates, default workflow stages, and first admin membership.
- `manage-business-invite`: super-admin creates invites, sends invite email when configured, verifies `/invite/:token`, creates or links the business admin account, assigns the organisation team role, and marks the invite accepted.
- `connect-sms-provider`: organisation-admin only function that validates ClickSend or Telnyx credentials, encrypts them server-side, stores only masked previews for display, and updates `organisations.messagingEnabled`.
- `test-sms-provider`: organisation-admin only function that tests the saved provider without exposing secrets.
- `disconnect-sms-provider`: organisation-admin only function that deletes stored provider credentials and marks messaging as `not_configured`.
- `update-job-status`: validates tenant membership, updates the job, appends a status event, and only sends or queues SMS when the organisation has a connected provider.
- `send-sms`: loads encrypted BYO provider credentials server-side, sends through ClickSend or Telnyx, and writes `smsLogs`.
- `send-roster-shift`: business-admin only function that creates a roster shift and notifies the assigned staff member.
- `respond-to-roster-shift`: staff-only function that records accept/decline without allowing staff to edit shift time or assignment.
- `manage-subscription`: syncs billing state from Stripe or another payment provider.
- `disable-organisation`: flips `isEnabled` and removes active access until re-enabled.
- `upload-organisation-logo`: Super Admin-only function that stores a tenant logo and updates `organisations.logoFileId`.

## Storage

Create an `organisation-logos` bucket for white-label business logos.

Recommended settings:

- allowed extensions: `png`, `jpg`, `jpeg`, `svg`, `webp`
- maximum file size: `2 MB`
- antivirus enabled
- encryption enabled

Permissions:

- read: organisation team members and customer/status pages that need that organisation's logo, or use a signed URL function
- create/update/delete: platform super-admin function only

Store uploaded logo file IDs on the `organisations.logoFileId` attribute.
Store colours on `organisations.primaryColour` and `organisations.accentColour`.
